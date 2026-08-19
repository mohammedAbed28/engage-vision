/**
 * Backend API client — the ONLY place in the app that talks to app_api.py.
 * Every call here maps directly onto a real, existing FastAPI endpoint;
 * nothing here fabricates or mocks a response.
 */
import { API_IS_CONFIGURED, ENDPOINTS, REQUEST_TIMEOUT_MS } from "../config";
import { Platform } from "react-native";
import {
  ApproveImprovementResponse,
  BackendHealthResponse,
  CaptionRevisionResponse,
  DraftPost,
  ImageEditQuality,
  ImprovementChoice,
  ModelGuidedImageEditResponse,
  ModelMetricsResponse,
  PredictionResponse,
} from "../types/prediction";

export class ApiError extends Error {
  kind: "network" | "server" | "validation" | "timeout";
  code: string;
  requestId?: string;
  status?: number;

  constructor(
    message: string,
    kind: ApiError["kind"],
    code = "UNKNOWN_ERROR",
    requestId?: string,
    status?: number
  ) {
    super(message);
    this.kind = kind;
    this.code = code;
    this.requestId = requestId;
    this.status = status;
    this.name = "ApiError";
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function guessImageMime(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function appendImageFile(formData: FormData, uri: string): Promise<void> {
  const filename = uri.split("/").pop()?.split("?")[0] || "photo.jpg";
  if (Platform.OS === "web") {
    // Expo ImagePicker returns a browser blob URL on web. React Native's
    // { uri, name, type } multipart shape is not understood by browsers, so
    // resolve it to a real Blob before appending it to FormData.
    const response = await fetch(uri);
    if (!response.ok) {
      throw new ApiError("That image could not be read. Choose it again.", "validation", "IMAGE_READ_FAILED");
    }
    const blob = await response.blob();
    formData.append("image", blob, filename);
    return;
  }
  formData.append("image", {
    uri,
    name: filename,
    type: guessImageMime(uri),
  } as unknown as Blob);
}

/**
 * Calls POST /predict-from-upload — the real app workflow: raw image +
 * caption + post type (+ optional posting time). The backend extracts
 * real text/image embeddings server-side; nothing embedding-related is
 * ever sent from this client.
 */
export async function predictFromUpload(draft: DraftPost): Promise<PredictionResponse> {
  ensureApiConfigured();
  // Fail quickly with a precise connection/version error before spending up
  // to a minute preparing and uploading a multipart image to an unavailable
  // development server.
  await getBackendHealth();
  const formData = new FormData();
  // Native and web require different multipart image shapes.
  await appendImageFile(formData, draft.imageUri);
  formData.append("caption", draft.caption);
  formData.append("post_type", draft.postType);
  formData.append("language", draft.language || "en");
  formData.append("goal", draft.captionGoal || "conversation");
  formData.append("tone", draft.captionTone || "natural");
  formData.append("planned_date", draft.plannedDate);
  formData.append("planned_time", draft.plannedTime);

  let response: Response;
  try {
    response = await fetchWithTimeout(
      ENDPOINTS.predictFromUpload,
      { method: "POST", body: formData },
      REQUEST_TIMEOUT_MS
    );
  } catch (err) {
    throw toApiError(err);
  }

  return handleJsonResponse<PredictionResponse>(response);
}

/**
 * Optional, user-initiated model-guided edit. The backend verifies that every
 * selected direction came from the current EngageVision result, asks the image
 * model to execute only those directions, then evaluates the revision again.
 */
export async function requestModelGuidedImageEdit(
  draft: DraftPost,
  selectedRecommendations: string[],
  quality: ImageEditQuality
): Promise<ModelGuidedImageEditResponse> {
  ensureApiConfigured();
  const formData = new FormData();
  await appendImageFile(formData, draft.imageUri);
  formData.append("caption", draft.caption);
  formData.append("post_type", draft.postType);
  formData.append("language", draft.language || "en");
  formData.append("selected_recommendations", JSON.stringify(selectedRecommendations));
  formData.append("quality", quality);
  formData.append("planned_date", draft.plannedDate);
  formData.append("planned_time", draft.plannedTime);

  let response: Response;
  try {
    response = await fetchWithTimeout(
      ENDPOINTS.modelGuidedImageEdit,
      { method: "POST", body: formData },
      420000
    );
  } catch (err) {
    throw toApiError(err);
  }
  return handleJsonResponse<ModelGuidedImageEditResponse>(response);
}

/**
 * Calls POST /approve-improvement to get a rewritten caption and/or a
 * fresh image-editing prompt for the chosen improvement option. Passes
 * the ALREADY-COMPUTED prediction result so the backend does not need to
 * re-run the model (and therefore does not need embeddings from this
 * client at all).
 */
export async function approveImprovement(
  draft: DraftPost,
  predictionResult: PredictionResponse,
  userChoice: ImprovementChoice
): Promise<ApproveImprovementResponse> {
  ensureApiConfigured();
  const payload = {
    post: {
      text: draft.caption,
      post_type: draft.postType,
      predicted_post_type: predictionResult.predicted_post_type ?? draft.postType,
      language: draft.language || "en",
      post_hour: draft.postHour,
      post_month: draft.postMonth,
      day_of_week: draft.dayOfWeek,
    },
    prediction_result: predictionResult,
    user_choice: userChoice,
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      ENDPOINTS.approveImprovement,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      REQUEST_TIMEOUT_MS
    );
  } catch (err) {
    throw toApiError(err);
  }

  return handleJsonResponse<ApproveImprovementResponse>(response);
}

/**
 * Research-guided caption rewrite. The original image is included so the
 * backend can reproduce the post analysis, constrain the writer with the
 * resulting evidence, and score the revised caption through the same frozen
 * prediction pipeline before returning it.
 */
export async function requestProfessionalCaptionRevision(
  draft: DraftPost
): Promise<CaptionRevisionResponse> {
  ensureApiConfigured();
  const formData = new FormData();
  await appendImageFile(formData, draft.imageUri);
  formData.append("caption", draft.caption);
  formData.append("post_type", draft.postType);
  formData.append("language", draft.language || "en");
  formData.append("tone", draft.captionTone || "natural");
  formData.append("goal", draft.captionGoal || "conversation");
  formData.append("planned_date", draft.plannedDate);
  formData.append("planned_time", draft.plannedTime);

  let response: Response;
  try {
    response = await fetchWithTimeout(
      ENDPOINTS.captionRevision,
      { method: "POST", body: formData },
      240000
    );
  } catch (err) {
    throw toApiError(err);
  }
  return handleJsonResponse<CaptionRevisionResponse>(response);
}

/** Quick reachability check — used to distinguish "backend not running"
 * from other failure modes before the user even tries to analyze a post. */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const health = await getBackendHealth();
    return health.api_version >= 10 && health.service_ready;
  } catch {
    return false;
  }
}

export async function getBackendHealth(): Promise<BackendHealthResponse> {
  ensureApiConfigured();
  let response: Response;
  try {
    response = await fetchWithTimeout(ENDPOINTS.health, {}, 8000);
  } catch (err) {
    throw toApiError(err);
  }
  const health = await handleJsonResponse<BackendHealthResponse>(response);
  if (health.api_version < 10) {
    throw new ApiError(
      "Your phone reached an older EngageVision server.",
      "server",
      "SERVICE_VERSION_MISMATCH",
      undefined,
      409
    );
  }
  return health;
}

export async function getModelMetrics(): Promise<ModelMetricsResponse> {
  ensureApiConfigured();
  let response: Response;
  try {
    response = await fetchWithTimeout(ENDPOINTS.modelMetrics, {}, 8000);
  } catch (err) {
    throw toApiError(err);
  }
  return handleJsonResponse<ModelMetricsResponse>(response);
}

async function handleJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let serverDetail = "";
    let code = "HTTP_ERROR";
    let requestId = response.headers.get("x-request-id") ?? undefined;
    try {
      const body = await response.json();
      if (body?.detail) serverDetail = String(body.detail);
      if (body?.code) code = String(body.code);
      if (body?.request_id) requestId = String(body.request_id);
    } catch {
      // A public-facing message is selected below.
    }

    if (__DEV__) {
      console.warn("EngageVision API request failed", {
        status: response.status,
        code,
        requestId,
      });
    }

    // Inspect stable API codes before the HTTP status. OpenAI reports an empty
    // credit balance as HTTP 429, which must not be shown as ordinary traffic
    // throttling. This ordering is what makes the mobile message actionable.
    const openAISetupCodes = new Set([
      "OPENAI_AUTH_FAILED",
      "OPENAI_PERMISSION_DENIED",
      "OPENAI_BILLING_REQUIRED",
      "OPENAI_MODEL_UNAVAILABLE",
      "OPENAI_SDK_MISSING",
    ]);
    if (openAISetupCodes.has(code)) {
      throw new ApiError(serverDetail || "OpenAI needs one server configuration change.", "server", code, requestId, response.status);
    }

    if (response.status === 413) {
      throw new ApiError("This image is too large to upload. Choose a smaller image and try again.", "validation", code, requestId, response.status);
    }
    if (response.status === 415) {
      throw new ApiError("Choose a JPG, PNG or WebP image and try again.", "validation", code, requestId, response.status);
    }
    if (response.status === 422) {
      throw new ApiError("Some post details could not be read. Go back, review the draft and try again.", "validation", code, requestId, response.status);
    }
    if (response.status === 429) {
      throw new ApiError("There are too many preview requests right now. Wait a moment and try again.", "server", code, requestId, response.status);
    }
    if (response.status === 404) {
      throw new ApiError(
        "Your phone reached an older EngageVision server. Start the updated server and try again.",
        "server",
        "SERVICE_VERSION_MISMATCH",
        requestId,
        response.status
      );
    }
    if (code === "AI_NOT_CONFIGURED") {
      throw new ApiError(
        serverDetail || "The AI improvement service has not been enabled on this server yet.",
        "server",
        code,
        requestId,
        response.status
      );
    }
    if (code === "OPENAI_CONNECTION_FAILED" || code === "OPENAI_TIMEOUT") {
      throw new ApiError(serverDetail || "The server could not complete the OpenAI request.", "network", code, requestId, response.status);
    }
    if (code === "OPENAI_RATE_LIMITED" || code === "OPENAI_TEMPORARY_FAILURE") {
      throw new ApiError(serverDetail || "OpenAI is temporarily busy. Try again shortly.", "server", code, requestId, response.status);
    }
    if (code === "AI_CAPTION_FAILED") {
      throw new ApiError(
        "The caption studio could not finish this revision. Check the server API key and billing, then try once more.",
        "server",
        code,
        requestId,
        response.status
      );
    }
    if (code === "AI_EDIT_FAILED") {
      throw new ApiError(
        "The image studio could not create this revision. Check the server API key and billing, then try once more.",
        "server",
        code,
        requestId,
        response.status
      );
    }
    if (code === "RECOMMENDATION_MISMATCH") {
      throw new ApiError(
        "These recommendations came from an older analysis. Return to the draft and analyze it again.",
        "validation",
        code,
        requestId,
        response.status
      );
    }
    if (code === "NO_MODEL_GUIDED_EDIT") {
      throw new ApiError(
        "EngageVision did not identify a positive image edit for this draft. Keep the original image.",
        "validation",
        code,
        requestId,
        response.status
      );
    }
    if (response.status === 400 && /image|caption|photo|file/i.test(serverDetail)) {
      throw new ApiError(serverDetail, "validation", code, requestId, response.status);
    }
    throw new ApiError(
      serverDetail || "The preview could not be completed right now. Please try again in a moment.",
      "server",
      code,
      requestId,
      response.status
    );
  }
  return (await response.json()) as T;
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error && err.name === "AbortError") {
    return new ApiError(
      "The preview is taking longer than expected. Check your connection and try again.",
      "timeout",
      "REQUEST_TIMEOUT"
    );
  }
  return new ApiError(
    "The preview service is unavailable right now. Check your connection and try again in a moment.",
    "network",
    "SERVICE_UNREACHABLE"
  );
}

function ensureApiConfigured(): void {
  if (!API_IS_CONFIGURED) {
    throw new ApiError("The preview service is not configured for this build.", "network", "CONFIG_MISSING");
  }
}
