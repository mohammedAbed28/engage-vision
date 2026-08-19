import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import {
  ActualOutcome,
  AnalysisHistoryItem,
  DraftPost,
  PersonalizedOutlook,
  PredictionResponse,
  UserProfile,
} from "../types/prediction";

interface StoredUserData {
  version: 2;
  profile: UserProfile | null;
  history: AnalysisHistoryItem[];
}

const EMPTY_DATA: StoredUserData = { version: 2, profile: null, history: [] };

function safeOwnerId(ownerId: string): string {
  return ownerId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function storagePath(ownerId: string): string {
  return `${FileSystem.documentDirectory}engagevision-private-history-v2-${safeOwnerId(ownerId)}.json`;
}

function webStorageKey(ownerId: string): string {
  return `engagevision-private-history-v2:${safeOwnerId(ownerId)}`;
}

async function readData(ownerId: string): Promise<StoredUserData> {
  try {
    if (Platform.OS === "web") {
      const raw = globalThis.localStorage?.getItem(webStorageKey(ownerId));
      if (!raw) return EMPTY_DATA;
      const parsed = JSON.parse(raw) as Partial<StoredUserData>;
      return {
        version: 2,
        profile: parsed.profile ?? null,
        history: Array.isArray(parsed.history) ? parsed.history : [],
      };
    }
    const path = storagePath(ownerId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return EMPTY_DATA;
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(path)) as Partial<StoredUserData>;
    return {
      version: 2,
      profile: parsed.profile ?? null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return EMPTY_DATA;
  }
}

async function writeData(ownerId: string, data: StoredUserData): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(webStorageKey(ownerId), JSON.stringify(data));
    return;
  }
  await FileSystem.writeAsStringAsync(storagePath(ownerId), JSON.stringify(data));
}

export async function loadUserData(ownerId: string): Promise<StoredUserData> {
  return readData(ownerId);
}

export async function persistProfile(ownerId: string, profile: UserProfile): Promise<void> {
  const data = await readData(ownerId);
  await writeData(ownerId, { ...data, profile });
}

export async function persistAnalysis(
  ownerId: string,
  draft: DraftPost,
  result: PredictionResponse,
): Promise<AnalysisHistoryItem> {
  const data = await readData(ownerId);
  const item: AnalysisHistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    followerCountSnapshot: data.profile?.followerCount,
    draft,
    result,
  };
  await writeData(ownerId, { ...data, history: [item, ...data.history].slice(0, 120) });
  return item;
}

export async function persistActualOutcome(
  ownerId: string,
  historyId: string,
  outcome: ActualOutcome,
): Promise<AnalysisHistoryItem[]> {
  const data = await readData(ownerId);
  const history = data.history.map((item) =>
    item.id === historyId ? { ...item, actualOutcome: outcome } : item,
  );
  await writeData(ownerId, { ...data, history });
  return history;
}

export function outcomeEngagementRate(outcome: ActualOutcome): number {
  if (outcome.followerCountAtPost <= 0) return 0;
  const weightedInteractions =
    outcome.likes +
    outcome.comments * 2 +
    outcome.saves * 2 +
    outcome.shares * 2;
  return (weightedInteractions / outcome.followerCountAtPost) * 100;
}

export function medianAccountRate(history: AnalysisHistoryItem[]): number | null {
  const rates = history
    .flatMap((item) => (item.actualOutcome ? [outcomeEngagementRate(item.actualOutcome)] : []))
    .sort((a, b) => a - b);
  if (rates.length < 3) return null;
  const middle = Math.floor(rates.length / 2);
  return rates.length % 2 ? rates[middle] : (rates[middle - 1] + rates[middle]) / 2;
}

/**
 * Personalization remains a separate, transparent product layer. It never
 * rewrites the frozen research model. After at least three real outcomes, a
 * beta-smoothed success rate for comparable content is blended conservatively
 * with the base probability (maximum history weight: 35%).
 */
export function calculatePersonalizedOutlook(
  baseProbability: number,
  postType: string,
  history: AnalysisHistoryItem[],
): PersonalizedOutlook {
  const logged = history.filter((item) => item.actualOutcome);
  const baseline = medianAccountRate(history);
  if (baseline == null) {
    return {
      probability: baseProbability,
      baseProbability,
      applied: false,
      comparablePosts: 0,
      loggedPosts: logged.length,
      personalSuccessRate: null,
      blendWeight: 0,
    };
  }

  const comparable = logged.filter((item) => item.draft.postType === postType);
  if (comparable.length < 3) {
    return {
      probability: baseProbability,
      baseProbability,
      applied: false,
      comparablePosts: comparable.length,
      loggedPosts: logged.length,
      personalSuccessRate: null,
      blendWeight: 0,
    };
  }

  const successes = comparable.filter(
    (item) => item.actualOutcome && outcomeEngagementRate(item.actualOutcome) >= baseline,
  ).length;
  const smoothedSuccessRate = (successes + 2) / (comparable.length + 4);
  const weight = Math.min(0.35, comparable.length / (comparable.length + 12));
  const probability = Math.max(
    0.01,
    Math.min(0.99, baseProbability * (1 - weight) + smoothedSuccessRate * weight),
  );
  return {
    probability,
    baseProbability,
    applied: true,
    comparablePosts: comparable.length,
    loggedPosts: logged.length,
    personalSuccessRate: smoothedSuccessRate,
    blendWeight: weight,
  };
}
