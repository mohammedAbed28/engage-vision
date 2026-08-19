import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActualOutcome,
  AnalysisHistoryItem,
  DraftPost,
  PersonalizedOutlook,
  PredictionResponse,
  UserProfile,
} from "../types/prediction";
import {
  calculatePersonalizedOutlook,
  loadUserData,
  medianAccountRate,
  persistActualOutcome,
  persistAnalysis,
  persistProfile,
} from "../storage/userData";

interface EngageStoreValue {
  hydrated: boolean;
  profile: UserProfile | null;
  history: AnalysisHistoryItem[];
  personalBaseline: number | null;
  loggedOutcomeCount: number;
  saveProfile: (profile: UserProfile) => Promise<void>;
  addAnalysis: (draft: DraftPost, result: PredictionResponse) => Promise<AnalysisHistoryItem>;
  logOutcome: (historyId: string, outcome: ActualOutcome) => Promise<void>;
  personalizedOutlook: (baseProbability: number, postType: string) => PersonalizedOutlook;
}

const EngageStore = createContext<EngageStoreValue | null>(null);

export function EngageStoreProvider({ children, ownerId }: PropsWithChildren<{ ownerId: string }>) {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);

  useEffect(() => {
    let active = true;
    const hydrationGuard = setTimeout(() => {
      if (active) setHydrated(true);
    }, 3000);

    loadUserData(ownerId)
      .then((data) => {
        if (!active) return;
        setProfile(data.profile);
        setHistory(data.history);
      })
      .finally(() => {
        clearTimeout(hydrationGuard);
        if (active) setHydrated(true);
      });

    return () => {
      active = false;
      clearTimeout(hydrationGuard);
    };
  }, [ownerId]);

  const saveProfile = useCallback(async (next: UserProfile) => {
    await persistProfile(ownerId, next);
    setProfile(next);
  }, [ownerId]);

  const addAnalysis = useCallback(async (draft: DraftPost, result: PredictionResponse) => {
    const item = await persistAnalysis(ownerId, draft, result);
    setHistory((current) => [item, ...current].slice(0, 120));
    return item;
  }, [ownerId]);

  const logOutcome = useCallback(async (historyId: string, outcome: ActualOutcome) => {
    setHistory(await persistActualOutcome(ownerId, historyId, outcome));
  }, [ownerId]);

  const personalizedOutlook = useCallback(
    (baseProbability: number, postType: string) =>
      calculatePersonalizedOutlook(baseProbability, postType, history),
    [history],
  );

  const value = useMemo<EngageStoreValue>(
    () => ({
      hydrated,
      profile,
      history,
      personalBaseline: medianAccountRate(history),
      loggedOutcomeCount: history.filter((item) => item.actualOutcome).length,
      saveProfile,
      addAnalysis,
      logOutcome,
      personalizedOutlook,
    }),
    [addAnalysis, history, hydrated, logOutcome, personalizedOutlook, profile, saveProfile],
  );

  return <EngageStore.Provider value={value}>{children}</EngageStore.Provider>;
}

export function useEngageStore(): EngageStoreValue {
  const value = useContext(EngageStore);
  if (!value) throw new Error("useEngageStore must be used inside EngageStoreProvider");
  return value;
}
