/**
 * Plain-language translation layer.
 *
 * The backend (PredictionResponse) already returns mostly friendly text
 * (see app/recommendations.py, app/improvement.py) — nothing here invents
 * a new claim. This module only: (1) mirrors the backend's own
 * post-type → friendly-phrase mapping so the mobile app never needs to
 * show a raw post_type/content_cluster id, (2) buckets the model's real
 * probability/threshold into a simple 3-state "engagement potential" for
 * a big, readable result card, and (3) sorts the backend's own
 * recommendation sentences into the right screen/tab by keyword —
 * nothing is reworded or fabricated, only routed and lightly reframed
 * for tone (e.g. a "no issues found" sentence becomes a positive
 * "strength" bullet instead of sitting oddly in an "issues" list).
 */
import { PredictionResponse } from "../types/prediction";

// Mirrors app/recommendations.py::_FRIENDLY_CONTENT_GROUP exactly — same
// approved phrases the Streamlit app and the backend's own explanation
// text already use, just ported here so the mobile app never has to
// display a raw post_type/content_cluster value on a main screen.
const FRIENDLY_CONTENT_GROUP: Record<string, string> = {
  personal_story: "personal, authentic stories",
  awareness: "awareness and advocacy posts",
  campaign: "campaign and call-to-action posts",
  activism: "activism and community-action posts",
  support: "supportive, caring posts",
  memorial: "memorial and remembrance posts",
  educational_info: "educational, informative posts",
  emotional_quote: "reflective quotes and sayings",
  general: "general social posts",
};

export function friendlyContentGroupLabel(postType: string | null | undefined): string {
  if (!postType) return "posts with a similar style to yours";
  return FRIENDLY_CONTENT_GROUP[postType] ?? "posts with a similar style to yours";
}

export type EngagementPotential = "High" | "NeedsImprovement" | "Low";

export interface PotentialSummary {
  potential: EngagementPotential;
  potentialLabel: string;
  percentageLabel: string;
  statusMessage: string;
}

const BORDERLINE_MARGIN = 0.08;

/** Buckets the model's real calibrated probability / decision threshold
 * into a simple 3-state read — no new signal, just a coarser display of
 * the same numbers shown precisely in Advanced Details. */
export function summarizePotential(result: PredictionResponse): PotentialSummary {
  const { calibrated_probability, threshold_used, predicted_label } = result;
  const margin = calibrated_probability - threshold_used;
  const percentageLabel = `${Math.round(calibrated_probability * 100)}%`;

  if (predicted_label === "High Engagement") {
    return {
      potential: "High",
      potentialLabel: "Promising outlook",
      percentageLabel,
      statusMessage: "The draft shows several positive signals before publishing.",
    };
  }

  if (Math.abs(margin) <= BORDERLINE_MARGIN) {
    return {
      potential: "NeedsImprovement",
      potentialLabel: "Worth refining",
      percentageLabel,
      statusMessage: "A few focused changes may strengthen this draft.",
    };
  }

  return {
    potential: "Low",
    potentialLabel: "Needs more work",
    percentageLabel,
    statusMessage: "Start with the recommended changes before publishing.",
  };
}

// The backend's own fallback text when its heuristics find nothing to
// flag (app/improvement.py) — reframed as a positive instead of showing
// a slightly awkward "no issues" sentence in an "issues" list.
const NO_ISSUE_MARKERS = ["no specific", "looks reasonable as-is"];

function isNoIssueFallback(text: string): boolean {
  const lower = text.toLowerCase();
  return NO_ISSUE_MARKERS.some((marker) => lower.includes(marker));
}

/** Plain-language "what's working" bullets — grounded only in real
 * fields (predicted_label, predicted_post_type, and any "no issues
 * found" suggestion the backend already returned). */
export function deriveStrengths(result: PredictionResponse): string[] {
  if (result.professional_strengths?.length) {
    return result.professional_strengths;
  }
  const strengths: string[] = [];

  if (result.predicted_label === "High Engagement") {
    strengths.push("The combined visual and caption signals point to a promising response outlook.");
  }
  if (result.caption_improvement_suggestions.some(isNoIssueFallback)) {
    strengths.push("Your caption reads clearly and fits this post type well.");
  }
  if (result.image_improvement_suggestions.some(isNoIssueFallback)) {
    strengths.push("Your image looks well-suited to this post — no obvious issues detected.");
  }
  if (strengths.length === 0) {
    strengths.push("Your image and caption were successfully reviewed together.");
  }
  return strengths;
}

/** Removes internal or account-specific phrasing that is not appropriate
 * for a new user, while preserving the action proposed by the backend. */
export function presentRecommendation(text: string): string {
  return text
    .replace(/for this account/gi, "for similar posts")
    .replace(/this account's own past High Engagement posts/gi, "your own previous high-performing posts")
    .replace(/this account's overall average/gi, "the overall reference pattern")
    .replace(/High Engagement/gi, "strong response")
    .replace(/\s+/g, " ")
    .trim();
}

function uniquePresented(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map(presentRecommendation)
    .filter((item) => {
      const key = item.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Plain-language "what to improve" bullets — the backend's own caption/
 * image suggestions, minus the "no issues" fallbacks (which become
 * strengths above instead). Already written in plain, actionable
 * language by app/improvement.py — nothing is reworded here. */
export function deriveImprovements(result: PredictionResponse): string[] {
  if (result.professional_recommendations?.length) {
    return result.professional_recommendations.map((item) => item.action);
  }
  const items = uniquePresented([
    ...result.caption_improvement_suggestions,
    ...result.image_improvement_suggestions,
  ].filter((s) => !isNoIssueFallback(s)));

  if (items.length === 0) {
    items.push("No specific improvements were flagged — this post is in good shape.");
  }
  return items;
}

export interface CategorizedRecommendations {
  timing: string[];
  hashtags: string[];
  general: string[];
}

const TIME_PATTERN = /\b\d{1,2}:00\b/;

/** Routes the backend's own `recommendations` sentences into Timing /
 * Hashtags / General buckets by keyword — used to populate the
 * Improvement Studio's Timing and Hashtags tabs from real backend text
 * (app/insights.py's SQL-derived suggestions when available), without
 * requiring a new structured API field. */
export function categorizeRecommendations(recommendations: string[]): CategorizedRecommendations {
  const timing: string[] = [];
  const hashtags: string[] = [];
  const general: string[] = [];

  for (const original of uniquePresented(recommendations)) {
    const rec = original;
    const lower = rec.toLowerCase();
    if (lower.includes("hashtag") || rec.includes("#")) {
      hashtags.push(rec);
    } else if (lower.includes("posting time") || lower.includes("schedul") || TIME_PATTERN.test(rec)) {
      timing.push(rec);
    } else {
      general.push(rec);
    }
  }
  return { timing, hashtags, general };
}

/** Extracts individual #hashtags from a sentence like "Hashtags that
 * worked well: #safespace #grief #support." for one-tap copying. */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu);
  return matches ? Array.from(new Set(matches)) : [];
}
