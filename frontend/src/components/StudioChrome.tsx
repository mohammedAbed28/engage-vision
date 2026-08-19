import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RootStackParamList } from "../../App";
import { useEngageStore } from "../context/EngageStore";
import { useAppearance } from "../context/AppearanceContext";
import { useI18n } from "../i18n/I18nProvider";
import { colors, radius, shadows, spacing } from "../theme/theme";
import { DraftPost, PredictionResponse } from "../types/prediction";

type Navigation = Pick<
  NativeStackNavigationProp<RootStackParamList>,
  "navigate" | "canGoBack" | "goBack"
>;
type DockItem = "analyze" | "outlook" | "improve" | "history";

const labels = {
  en: {
    analyze: "Analyze",
    outlook: "Outlook",
    improve: "Improve",
    history: "History",
    noResult: "Analyze a post first",
    profile: "Account",
    info: "Privacy",
    theme: "Change appearance",
  },
  he: {
    analyze: "ניתוח",
    outlook: "תחזית",
    improve: "שיפור",
    history: "היסטוריה",
    noResult: "תחילה יש לנתח פוסט",
    profile: "חשבון",
    info: "פרטיות",
    theme: "שינוי תצוגה",
  },
  ar: {
    analyze: "تحليل",
    outlook: "التوقع",
    improve: "تحسين",
    history: "السجل",
    noResult: "حلّل منشورًا أولًا",
    profile: "الحساب",
    info: "الخصوصية",
    theme: "تغيير المظهر",
  },
} as const;

export function StudioTopBar({
  navigation,
  title,
  menu = false,
}: {
  navigation: Navigation;
  title: string;
  menu?: boolean;
}) {
  const { rtl, language } = useI18n();
  const { brighter, toggleMode } = useAppearance();
  const insets = useSafeAreaInsets();
  const copy = labels[language];
  return (
    <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }, rtl && styles.rowReverse]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={menu ? copy.profile : title}
        style={styles.topButton}
        onPress={() => {
          if (menu) navigation.navigate("AccountSetup", { editing: true });
          else if (navigation.canGoBack()) navigation.goBack();
        }}
      >
        <Text style={styles.topIcon}>{menu ? "☰" : rtl ? "›" : "‹"}</Text>
      </TouchableOpacity>
      <Text style={[styles.topTitle, rtl && styles.textRtl]} numberOfLines={1}>{title}</Text>
      <View style={[styles.topActions, rtl && styles.rowReverse]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={copy.theme}
          style={[styles.themeButton, brighter && styles.themeButtonBright]}
          onPress={toggleMode}
        >
          <Text style={styles.themeText}>{brighter ? "☀" : "☾"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={copy.info}
          style={styles.infoButton}
          onPress={() => navigation.navigate("Privacy")}
        >
          <Text style={styles.infoText}>i</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function BottomDock({
  navigation,
  active,
  draft,
  result,
  historyId,
}: {
  navigation: Navigation;
  active: DockItem;
  draft?: DraftPost;
  result?: PredictionResponse;
  historyId?: string;
}) {
  const { language } = useI18n();
  const { history } = useEngageStore();
  const insets = useSafeAreaInsets();
  const copy = labels[language];
  const latest = history[0];

  function open(item: DockItem) {
    if (item === "analyze") {
      navigation.navigate("CreatePost");
      return;
    }
    if (item === "history") {
      navigation.navigate("History");
      return;
    }
    const targetDraft = draft || latest?.draft;
    const targetResult = result || latest?.result;
    if (!targetDraft || !targetResult) {
      navigation.navigate("CreatePost");
      return;
    }
    if (item === "outlook") {
      navigation.navigate("Results", {
        draft: targetDraft,
        result: targetResult,
        historyId: historyId || latest?.id,
      });
    } else {
      navigation.navigate("ImprovementStudio", { draft: targetDraft, result: targetResult });
    }
  }

  const items: { id: DockItem; icon: string }[] = [
    { id: "analyze", icon: "◎" },
    { id: "outlook", icon: "☆" },
    { id: "improve", icon: "✣" },
    { id: "history", icon: "◷" },
  ];

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <TouchableOpacity
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={styles.dockItem}
            onPress={() => open(item.id)}
          >
            <Text style={[styles.dockIcon, selected && styles.dockIconActive]}>{item.icon}</Text>
            <Text style={[styles.dockLabel, selected && styles.dockLabelActive]}>{copy[item.id]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function ThreeStepProgress({
  active,
  labels: stepLabels,
}: {
  active: 1 | 2 | 3;
  labels: [string, string, string];
}) {
  return (
    <View style={styles.steps}>
      {stepLabels.map((label, index) => {
        const number = (index + 1) as 1 | 2 | 3;
        const selected = active === number;
        const done = active > number;
        return (
          <React.Fragment key={label}>
            <View style={styles.step}>
              <View style={[styles.stepCircle, (selected || done) && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, (selected || done) && styles.stepNumberActive]}>{done ? "✓" : number}</Text>
              </View>
              <Text style={[styles.stepLabel, selected && styles.stepLabelActive]} numberOfLines={1}>{label}</Text>
            </View>
            {number < 3 && <View style={[styles.stepLine, done && styles.stepLineActive]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  topBar: {
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(8,12,17,0.98)",
  },
  topButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  topIcon: { color: colors.text, fontSize: 28, fontWeight: "300" },
  topTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  topActions: { width: 68, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  themeButton: {
    width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(232,197,143,0.28)", backgroundColor: "rgba(255,255,255,0.035)",
  },
  themeButtonBright: { backgroundColor: "rgba(232,197,143,0.14)", borderColor: colors.primaryBorder },
  themeText: { color: colors.primary, fontSize: 14 },
  infoButton: {
    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.55)",
  },
  infoText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  dock: {
    flexDirection: "row",
    paddingTop: 9,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(232,197,143,0.17)",
    backgroundColor: "rgba(8,12,17,0.99)",
    ...shadows.card,
  },
  dockItem: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" },
  dockIcon: { color: colors.textFaint, fontSize: 22, lineHeight: 23 },
  dockIconActive: { color: colors.primary },
  dockLabel: { color: colors.textFaint, fontSize: 9, fontWeight: "700", marginTop: 3 },
  dockLabelActive: { color: colors.primary, fontWeight: "900" },
  steps: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.xl },
  step: { width: 74, alignItems: "center" },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.input,
  },
  stepCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepNumber: { color: colors.textFaint, fontSize: 10, fontWeight: "900" },
  stepNumberActive: { color: "#18120B" },
  stepLabel: { color: colors.textFaint, fontSize: 8.5, marginTop: 7, textAlign: "center" },
  stepLabelActive: { color: colors.primary, fontWeight: "800" },
  stepLine: { flex: 1, height: 1, marginTop: 14, backgroundColor: colors.cardBorder },
  stepLineActive: { backgroundColor: colors.primaryBorder },
});
