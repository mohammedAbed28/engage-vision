import React, { ReactNode, createContext, useContext, useMemo, useState } from "react";

export type AppearanceMode = "dawn" | "midnight";

interface AppearanceValue {
  mode: AppearanceMode;
  brighter: boolean;
  toggleMode: () => void;
}

const AppearanceContext = createContext<AppearanceValue | null>(null);

/**
 * Keeps the selected Concept 7 identity while offering two contrast-safe
 * atmospheres. "Dawn" is the brighter default; "midnight" matches the deeper
 * presentation concept selected during design review.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppearanceMode>("dawn");
  const value = useMemo<AppearanceValue>(() => ({
    mode,
    brighter: mode === "dawn",
    toggleMode: () => setMode((current) => current === "dawn" ? "midnight" : "dawn"),
  }), [mode]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceValue {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used inside AppearanceProvider");
  return context;
}
