import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Public backend address injected by Expo/EAS at build time.
 * Example: EXPO_PUBLIC_API_BASE_URL=https://api.example.com
 *
 * During Expo development, derive the computer's LAN address from Metro when
 * the launcher variable is missing. `10.0.2.2` is valid only inside the
 * Android emulator and is unreachable from a physical phone.
 */
const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const DEFAULT_LOCAL_API_PORT = 8048;

function hostFromExpo(): string {
  const hostUri = Constants.expoConfig?.hostUri?.trim();
  if (!hostUri) return "";
  try {
    return new URL(hostUri.includes("://") ? hostUri : `http://${hostUri}`).hostname;
  } catch {
    return hostUri.split("/")[0]?.split(":")[0] ?? "";
  }
}

function developmentApiUrl(): string {
  if (!__DEV__) return "";

  const expoHost = hostFromExpo();
  if (expoHost && expoHost !== "localhost" && expoHost !== "127.0.0.1") {
    return `http://${expoHost}:${DEFAULT_LOCAL_API_PORT}`;
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `http://${window.location.hostname || "127.0.0.1"}:${DEFAULT_LOCAL_API_PORT}`;
  }

  return Platform.OS === "android"
    ? `http://10.0.2.2:${DEFAULT_LOCAL_API_PORT}`
    : `http://127.0.0.1:${DEFAULT_LOCAL_API_PORT}`;
}

const developmentUrl = developmentApiUrl();

export const API_BASE_URL = (configuredUrl || (__DEV__ ? developmentUrl : "")).replace(/\/+$/, "");
export const API_IS_CONFIGURED = API_BASE_URL.length > 0;
export const API_USES_SECURE_TRANSPORT = API_BASE_URL.startsWith("https://");

function endpoint(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export const ENDPOINTS = {
  health: endpoint("/health/v3"),
  predictFromUpload: endpoint("/predict-from-upload-v3"),
  approveImprovement: endpoint("/approve-improvement"),
  captionRevision: endpoint("/caption-revision-v3"),
  modelGuidedImageEdit: endpoint("/model-guided-image-edit-v3"),
  modelMetrics: endpoint("/model-metrics"),
};

export const REQUEST_TIMEOUT_MS = 60000;
