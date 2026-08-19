import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import AmbientBackdrop from "../components/AmbientBackdrop";
import GradientButton from "../components/GradientButton";
import { ErrorCard } from "../components/StatusCards";
import { colors, gradients, radius, shadows, spacing } from "../theme/theme";
import { ApiError, predictFromUpload } from "../api/client";
import { API_BASE_URL } from "../config";
import { RootStackParamList } from "../../App";
import { localizedApiError, useI18n } from "../i18n/I18nProvider";
import { useEngageStore } from "../context/EngageStore";

type Props = NativeStackScreenProps<RootStackParamList, "AnalysisLoading">;

const STEP_INTERVAL_MS = 1100;

export default function AnalysisLoadingScreen({ route, navigation }: Props) {
  const { language, rtl, t } = useI18n();
  const steps = [t("loading.step1"), t("loading.step2"), t("loading.step3"), t("loading.step4")];
  const { draft } = route.params;
  const { addAnalysis } = useEngageStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setStepIndex(0);
    const stepTimer = setInterval(() => setStepIndex((index) => Math.min(index + 1, steps.length - 1)), STEP_INTERVAL_MS);

    predictFromUpload(draft)
      .then(async (result) => {
        if (cancelled) return;
        const historyItem = await addAnalysis(draft, result);
        if (cancelled) return;
        clearInterval(stepTimer);
        setStepIndex(steps.length - 1);
        setTimeout(() => !cancelled && navigation.replace("Results", { draft, result, historyId: historyItem.id }), 420);
      })
      .catch((reason) => {
        if (cancelled) return;
        clearInterval(stepTimer);
        setError(
          reason instanceof ApiError
            ? reason
            : new ApiError("We could not complete this preview. Please try again.", "server", "UNKNOWN_ERROR")
        );
      });

    return () => {
      cancelled = true;
      clearInterval(stepTimer);
    };
  }, [addAnalysis, attempt, draft, navigation]);

  if (error) {
    const guidance = getRecoveryGuidance(error, t);
    return (
      <SafeAreaView style={[styles.root, rtl && styles.rtl]} edges={["top", "bottom"]}>
        <AmbientBackdrop />
        <View style={[styles.topBar, rtl && styles.rowReverse]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.editPost")} onPress={() => navigation.goBack()} style={[styles.backButton, rtl && styles.backButtonRtl]}>
            <Text style={styles.backArrow}>{rtl ? "›" : "‹"}</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.topBrand}>ENGAGEVISION</Text>
            <Text style={[styles.topTitle, rtl && styles.textRtl]}>{t("loading.topTitle")}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.errorWrap} showsVerticalScrollIndicator={false}>
          <View style={styles.errorHero}>
            <Image source={{ uri: draft.imageUri }} style={styles.errorImage} />
            <View style={styles.errorBadge}><Text style={styles.errorBadgeText}>!</Text></View>
          </View>
          <Text style={[styles.errorEyebrow, rtl && styles.textRtl]}>{t("loading.connection")}</Text>
          <Text style={[styles.errorTitle, rtl && styles.textRtl]}>{guidance.title}</Text>
          <ErrorCard message={localizedApiError(error.code, language, error.message)} />
          <View style={styles.guidanceCard}>
            <Text style={[styles.guidanceTitle, rtl && styles.textRtl]}>{t("loading.whatCheck")}</Text>
            {guidance.steps.map((step, index) => (
              <View key={step} style={[styles.guidanceRow, rtl && styles.rowReverse]}>
                <View style={[styles.guidanceNumber, rtl && styles.guidanceNumberRtl]}><Text style={styles.guidanceNumberText}>{index + 1}</Text></View>
                <Text style={[styles.guidanceText, rtl && styles.textRtl]}>{step}</Text>
              </View>
            ))}
            {(error.requestId || error.code !== "UNKNOWN_ERROR") && (
              <Text style={[styles.referenceText, rtl && styles.textRtl]}>{t("loading.support", { value: error.requestId || error.code })}</Text>
            )}
            {__DEV__ && <Text style={[styles.targetText, rtl && styles.textRtl]}>{t("loading.devServer", { value: API_BASE_URL || "—" })}</Text>}
          </View>
          <GradientButton title={t("common.tryAgain")} onPress={() => setAttempt((value) => value + 1)} style={styles.buttonGap} />
          <GradientButton title={t("common.editPost")} variant="secondary" onPress={() => navigation.goBack()} style={styles.buttonGapSmall} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const animatedScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });
  const animatedOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.62] });

  return (
    <SafeAreaView style={[styles.root, rtl && styles.rtl]} edges={["top", "bottom"]}>
      <AmbientBackdrop />
      <View style={styles.content}>
        <View style={styles.stage}>
          <Animated.View style={[styles.pulseRing, { opacity: animatedOpacity, transform: [{ scale: animatedScale }] }]} />
          <View style={styles.backDiamond} />
          <LinearGradient colors={gradients.primary} style={styles.analysisOrb}>
            <View style={styles.orbHighlight} />
            <Text style={styles.analysisSymbol}>✦</Text>
          </LinearGradient>
        </View>

        <Text style={styles.eyebrow}>{t("loading.eyebrow")}</Text>
        <Text style={styles.heading}>{t("loading.title")}</Text>
        <Text style={styles.subheading}>{t("loading.subtitle")}</Text>

        <View style={styles.stepList}>
          {steps.map((step, index) => {
            const done = index < stepIndex;
            const active = index === stepIndex;
            return (
              <View key={step} style={[styles.stepRow, rtl && styles.rowReverse, active && styles.stepRowActive]}>
                <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                  <Text style={[styles.stepDotText, (done || active) && styles.stepDotTextActive]}>{done ? "✓" : String(index + 1).padStart(2, "0")}</Text>
                </View>
                <Text style={[styles.stepText, rtl && styles.stepTextRtl, (done || active) && styles.stepTextActive]}>{step}</Text>
                {active && <View style={styles.activeDash} />}
              </View>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function getRecoveryGuidance(error: ApiError, t: (key: string, params?: Record<string, string | number>) => string): { title: string; steps: string[] } {
  if (error.code === "SERVICE_VERSION_MISMATCH") {
    return {
      title: t("loading.oldTitle"),
      steps: [t("loading.old1"), t("loading.old2"), t("loading.old3")],
    };
  }
  if (error.kind === "network") {
    return {
      title: t("loading.networkTitle"),
      steps: [t("loading.network1"), t("loading.network2"), t("loading.network3")],
    };
  }
  if (error.kind === "validation") {
    return {
      title: t("loading.validationTitle"),
      steps: [t("loading.validation1"), t("loading.validation2"), t("loading.validation3")],
    };
  }
  return {
    title: t("loading.serverTitle"),
    steps: [t("loading.server1"), t("loading.server2"), t("loading.server3")],
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rtl: { direction: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backButton: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", marginRight: spacing.md, backgroundColor: "rgba(20,31,56,0.76)", borderWidth: 1, borderColor: colors.cardBorder },
  backButtonRtl: { marginRight: 0, marginLeft: spacing.md },
  backArrow: { color: colors.text, fontSize: 30, lineHeight: 31, marginTop: -3 },
  topBrand: { color: colors.cyan, fontSize: 8, fontWeight: "900", letterSpacing: 1.7 },
  topTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 2 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  stage: { width: 190, height: 170, alignItems: "center", justifyContent: "center" },
  pulseRing: {
    position: "absolute", width: 150, height: 150, borderRadius: 75,
    borderWidth: 1, borderColor: colors.cyan, backgroundColor: "rgba(58,91,220,0.08)",
  },
  backDiamond: {
    position: "absolute", width: 92, height: 92, borderRadius: 28, transform: [{ rotate: "24deg" }],
    backgroundColor: "rgba(90,78,214,0.25)", borderWidth: 1, borderColor: "rgba(188,204,255,0.20)",
  },
  analysisOrb: {
    width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", ...shadows.glow,
  },
  orbHighlight: {
    position: "absolute", width: 36, height: 14, borderRadius: 12, top: 12, left: 16,
    backgroundColor: "rgba(255,255,255,0.30)", transform: [{ rotate: "-25deg" }],
  },
  analysisSymbol: { color: "#fff", fontSize: 28 },
  eyebrow: { color: colors.cyan, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.8, marginTop: spacing.md },
  heading: { color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "center", marginTop: 9 },
  subheading: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 8, maxWidth: 320 },
  stepList: { alignSelf: "stretch", marginTop: spacing.xxl, gap: 8 },
  stepRow: {
    minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: "transparent",
  },
  stepRowActive: { backgroundColor: "rgba(20,31,58,0.70)", borderColor: colors.cardBorder },
  stepDot: {
    width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.cardBorder,
  },
  stepDotActive: { backgroundColor: colors.purpleSoft, borderColor: colors.purple },
  stepDotDone: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
  stepDotText: { color: colors.textFaint, fontSize: 9, fontWeight: "900" },
  stepDotTextActive: { color: colors.text },
  stepText: { color: colors.textFaint, fontSize: 13, fontWeight: "600", marginLeft: spacing.md, flex: 1 },
  stepTextRtl: { marginLeft: 0, marginRight: spacing.md, textAlign: "right", writingDirection: "rtl" },
  stepTextActive: { color: colors.text, fontWeight: "700" },
  activeDash: { width: 18, height: 3, borderRadius: 2, backgroundColor: colors.cyan },
  errorWrap: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  errorHero: { height: 126, borderRadius: radius.lg, overflow: "hidden", marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.backgroundAlt },
  errorImage: { width: "100%", height: "100%", opacity: 0.42 },
  errorBadge: { position: "absolute", alignSelf: "center", top: 35, width: 54, height: 54, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(80,45,58,0.94)", borderWidth: 1, borderColor: colors.redBorder },
  errorBadgeText: { color: colors.red, fontSize: 27, fontWeight: "900" },
  errorEyebrow: { color: colors.amber, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.8, marginBottom: 8 },
  errorTitle: { color: colors.text, fontSize: 25, fontWeight: "900", marginBottom: spacing.xl },
  guidanceCard: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: "rgba(16,26,50,0.82)", borderWidth: 1, borderColor: colors.cardBorder },
  guidanceTitle: { color: colors.text, fontSize: 13.5, fontWeight: "800", marginBottom: spacing.md },
  guidanceRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.md },
  guidanceNumber: { width: 24, height: 24, borderRadius: 9, alignItems: "center", justifyContent: "center", marginRight: spacing.md, backgroundColor: colors.purpleSoft, borderWidth: 1, borderColor: "rgba(185,167,255,0.25)" },
  guidanceNumberRtl: { marginRight: 0, marginLeft: spacing.md },
  guidanceNumberText: { color: colors.purple, fontSize: 10, fontWeight: "900" },
  guidanceText: { color: colors.textMuted, fontSize: 12, lineHeight: 18, flex: 1 },
  referenceText: { color: colors.textFaint, fontSize: 9.5, marginTop: 2 },
  targetText: { color: colors.cyan, fontSize: 9, lineHeight: 14, marginTop: spacing.sm },
  buttonGap: { marginTop: spacing.md },
  buttonGapSmall: { marginTop: spacing.sm },
});
