/**
 * TypeScript mirrors of app_api.py's Pydantic response models. Keep these
 * in sync with app_api.py — they are a direct 1:1 mapping, not a
 * reinterpretation, of the backend's real response shape.
 */

export interface PredictionResponse {
  predicted_label: "High Engagement" | "Low Engagement";
  success_probability: number;
  calibrated_probability: number;
  threshold_used: number;
  content_cluster: string;
  content_cluster_distance: number;
  used_expert_model: boolean;
  predicted_post_type: string | null;
  explanation: string;
  recommendations: string[];

  caption_improvement_suggestions: string[];
  image_improvement_suggestions: string[];
  ai_image_prompt: string;
  should_improve: boolean;
  improvement_options: string[];

  professional_recommendations: ProfessionalRecommendation[];
  professional_strengths: string[];
  caption_writer_available: boolean;
  image_editor_available: boolean;
  historical_hashtag_suggestions: string[];
  historical_benchmark: HistoricalBenchmark;
  evidence_profile: EvidenceProfile;
  prediction?: "High" | "Low";
  probability?: number;
  planned_date: string;
  planned_hour: number;
  day_of_week: string;
  model_version: string;
  target_version: string;
  method_name: string;
}

export interface HistoricalBenchmarkSignal {
  id: "caption_length" | "emotion_strength" | "text_image_alignment" | "brightness" | "colorfulness" | "hashtag_count" | string;
  current_value: number;
  reference_value: number;
  ratio_to_reference: number;
  unit: string;
  status: "near_reference" | "below_reference" | "above_reference" | string;
}

export interface HistoricalBenchmark {
  available: boolean;
  scope: string;
  sample_size: number;
  cohort_high_rate: number | null;
  dataset_total: number;
  dataset_period_start: string | null;
  dataset_period_end: string | null;
  signals: HistoricalBenchmarkSignal[];
  note: string;
}

export interface EvidenceProfile {
  model_analysis_available: boolean;
  model_bundle_verified: boolean;
  model_name: string;
  historical_analysis_available: boolean;
  historical_scope: "language_and_content_type" | "content_type" | "none" | string;
  historical_sample_size: number;
  caption_ai_available: boolean;
  image_ai_available: boolean;
  research_note: string;
  prediction_source: "frozen_moe" | string;
  recommendation_source: "model_recommendation_engine" | string;
  ai_role: "execution_only" | string;
  validation_source: "same_frozen_moe" | string;
}

export interface BackendHealthResponse {
  status: "ok";
  service_ready: boolean;
  model_guided_image_editor_available: boolean;
  caption_writer_available: boolean;
  api_version: number;
  model_source: {
    verified_bundle: boolean;
    bundle_sha256: string;
    model_name: string;
    created_at: string | null;
    feature_count: number | null;
    expert_count: number | null;
    official_clean_test_metrics: {
      accuracy: number | null;
      precision: number | null;
      recall: number | null;
      f1_score: number | null;
      roc_auc: number | null;
      pr_auc: number | null;
    };
  };
  openai: {
    api_key_configured: boolean;
    text_model: string;
    image_model: string;
    connection_test: string;
  };
}

export interface ModelMetricsResponse {
  model_version: string;
  target_version: string;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    fbeta_1_25: number;
    roc_auc: number;
    pr_auc: number;
    brier_score: number;
    ece: number;
    TN: number;
    FP: number;
    FN: number;
    TP: number;
  };
  limitations: string[];
}

export type AppLanguage = "en" | "he" | "ar";

export type RecommendationCategory = "caption" | "message" | "visual" | "timing" | "tags" | "general";

export interface ProfessionalRecommendation {
  id: string;
  category: RecommendationCategory;
  priority: 1 | 2 | 3;
  title: string;
  action: string;
  evidence: string;
  basis: string;
  source: "model_feature_signal" | "model_counterfactual" | "controlled_experiment" | "historical_cohort" | "user_constraint" | "content_rule" | "no_change_decision" | string;
  model_directed: boolean;
  impact_points: number | null;
  validation: string;
}

export type ImprovementChoice = "caption_only" | "image_prompt_only" | "both" | "none";

export interface BeforeAfterComparison {
  original_caption: string | null;
  improved_caption: string | null;
  improved_image_prompt: string | null;
}

export interface ApproveImprovementResponse {
  user_choice: ImprovementChoice;
  improved_caption: string | null;
  improved_image_prompt: string | null;
  caption_improvement_suggestions: string[] | null;
  image_improvement_suggestions: string[] | null;
  before_after_comparison: BeforeAfterComparison | null;
  improvement_summary: string | null;
  original_post: Record<string, unknown> | null;
}

export type CaptionTone = "natural" | "warm" | "confident" | "informative" | "reflective";
export type CaptionGoal = "reactions" | "conversation" | "awareness" | "saves" | "shares" | "support" | "inform";

export interface CaptionRevisionResponse {
  original_caption: string;
  improved_caption: string;
  editorial_rationale: string;
  goal_execution: string;
  change_summary: string[];
  applied_guidance: string[];
  safety_note: string;
  before_probability: number;
  after_probability: number;
  probability_delta: number;
  before_label: string;
  after_label: string;
  improved_according_to_model: boolean;
  candidates_evaluated: number;
  meaningful_delta_target: number;
  meaningful_target_reached: boolean;
  before_model_score: number;
  after_model_score: number;
  model_score_delta: number;
  calibration_band_unchanged: boolean;
  model_interpretation: string;
  research_note: string;
  recommendation_source: "model_recommendation_engine" | string;
  generation_source: "openai" | "not_run" | string;
  validation_source: "same_frozen_moe" | string;
  accepted_for_display: boolean;
  rejection_reason: string | null;
  best_candidate_probability: number;
  best_candidate_delta: number;
}

export type ImageEditQuality = "low" | "medium" | "high";

/** Result of executing model-selected recommendations and re-evaluating
 * the edited image through the same EngageVision pipeline. */
export interface ModelGuidedImageEditResponse {
  edited_image_base64: string;
  edited_image_mime: string;
  applied_recommendations: string[];
  before_probability: number;
  after_probability: number;
  probability_delta: number;
  before_label: string;
  after_label: string;
  improved_according_to_model: boolean;
  candidates_evaluated: number;
  meaningful_delta_target: number;
  meaningful_target_reached: boolean;
  before_model_score: number;
  after_model_score: number;
  model_score_delta: number;
  calibration_band_unchanged: boolean;
  model_interpretation: string;
  research_note: string;
  recommendation_source: "model_recommendation_engine" | string;
  generation_source: "openai" | "controlled_local_editor" | string;
  validation_source: "same_frozen_moe" | string;
  accepted_for_display: boolean;
  rejection_reason: string | null;
  best_candidate_probability: number;
  best_candidate_delta: number;
  best_candidate_generation_source: string;
}

export const POST_TYPES = [
  "personal_story",
  "awareness",
  "campaign",
  "activism",
  "support",
  "memorial",
  "educational_info",
  "emotional_quote",
  "general",
] as const;

export type PostType = (typeof POST_TYPES)[number];

export function postTypeLabel(postType: string): string {
  return postType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const DAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
] as const;

/** The draft post the user is creating — carried between the Create Post
 * screen and the Result screen (kept for the Improvement Studio's
 * before/after calls). */
export interface DraftPost {
  imageUri: string;
  caption: string;
  postType: string;
  plannedDate: string;
  plannedTime: string;
  postHour: number;
  postMonth: number;
  dayOfWeek: number;
  captionTone?: CaptionTone;
  captionGoal?: CaptionGoal;
  language?: AppLanguage;
}

export interface UserProfile {
  id: string;
  displayName: string;
  followerCount: number;
  accountType: "personal" | "creator" | "business" | "nonprofit";
  preferredLanguage: AppLanguage;
  createdAt: string;
  updatedAt: string;
}

export interface ActualOutcome {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  followerCountAtPost: number;
  loggedAt: string;
}

export interface AnalysisHistoryItem {
  id: string;
  createdAt: string;
  followerCountSnapshot?: number;
  draft: DraftPost;
  result: PredictionResponse;
  actualOutcome?: ActualOutcome;
}

export interface PersonalizedOutlook {
  probability: number;
  baseProbability: number;
  applied: boolean;
  comparablePosts: number;
  loggedPosts: number;
  personalSuccessRate: number | null;
  blendWeight: number;
}
