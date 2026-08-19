import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../App";
import { getModelMetrics } from "../api/client";
import AmbientBackdrop from "../components/AmbientBackdrop";
import { ErrorCard } from "../components/StatusCards";
import { StudioTopBar } from "../components/StudioChrome";
import { useI18n } from "../i18n/I18nProvider";
import { colors, radius, shadows, spacing } from "../theme/theme";
import { ModelMetricsResponse } from "../types/prediction";

type Props = NativeStackScreenProps<RootStackParamList, "ModelDashboard">;

const copy = {
  en: { title: "Model dashboard", verified: "VERIFIED EVALUATION", summary: "Metric summary", matrix: "Confusion matrix", method: "Expected Engagement Lift", note: "These are fixed-test research metrics, not a personal success percentage.", limits: "Scientific limitations", loading: "Loading verified model evidence…" },
  he: { title: "לוח מדדי המודל", verified: "הערכה מאומתת", summary: "סיכום מדדים", matrix: "מטריצת בלבול", method: "מדד שיפור המעורבות ביחס לצפוי", note: "אלה מדדי מחקר על קבוצת בדיקה קבועה, ולא אחוז הצלחה אישי.", limits: "מגבלות מדעיות", loading: "טוען ראיות מאומתות של המודל…" },
  ar: { title: "لوحة مؤشرات النموذج", verified: "تقييم موثّق", summary: "ملخص المؤشرات", matrix: "مصفوفة الالتباس", method: "تحسن التفاعل مقارنة بالمتوقع", note: "هذه مؤشرات بحثية على مجموعة اختبار ثابتة وليست نسبة نجاح شخصية.", limits: "القيود العلمية", loading: "جارٍ تحميل أدلة النموذج الموثقة…" },
} as const;

const metricKeys = [
  ["accuracy", "Accuracy"], ["precision", "Precision"], ["recall", "Recall"],
  ["f1_score", "F1"], ["fbeta_1_25", "Fβ 1.25"], ["roc_auc", "ROC-AUC"],
  ["pr_auc", "PR-AUC"], ["brier_score", "Brier"], ["ece", "ECE"],
] as const;

export default function ModelDashboardScreen({ navigation }: Props) {
  const { language, rtl } = useI18n();
  const c = copy[language];
  const [data, setData] = useState<ModelMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getModelMetrics().then((value) => active && setData(value)).catch(() => active && setError("The verified model metrics could not be loaded."));
    return () => { active = false; };
  }, []);

  return (
    <View style={[styles.root, rtl && styles.rtl]}>
      <AmbientBackdrop />
      <StudioTopBar navigation={navigation} title={c.title} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!data && !error && <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>{c.loading}</Text></View>}
        {error && <ErrorCard message={error} />}
        {data && <>
          <View style={styles.hero}>
            <Text style={[styles.eyebrow, rtl && styles.textRtl]}>{c.verified}</Text>
            <Text style={[styles.heroTitle, rtl && styles.textRtl]}>{c.method}</Text>
            <Text style={[styles.version, rtl && styles.textRtl]}>{data.model_version}</Text>
            <Text style={[styles.target, rtl && styles.textRtl]}>{data.target_version}</Text>
          </View>

          <Text style={[styles.sectionTitle, rtl && styles.textRtl]}>{c.summary}</Text>
          <View style={styles.metricCard}>
            {metricKeys.map(([key, label]) => {
              const value = Number(data.metrics[key]);
              const lowerBetter = key === "brier_score" || key === "ece";
              const width = `${Math.max(2, Math.min(100, value * 100))}%` as `${number}%`;
              return <View key={key} style={styles.metricRow}>
                <View style={styles.metricHeading}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value.toFixed(3)}</Text></View>
                <View style={styles.track}><View style={[styles.fill, { width, backgroundColor: lowerBetter ? colors.primary : colors.cyan }]} /></View>
              </View>;
            })}
          </View>

          <Text style={[styles.sectionTitle, rtl && styles.textRtl]}>{c.matrix}</Text>
          <View style={styles.matrix}>
            <MatrixCell label="TN" value={data.metrics.TN} tone="good" />
            <MatrixCell label="FP" value={data.metrics.FP} tone="warn" />
            <MatrixCell label="FN" value={data.metrics.FN} tone="warn" />
            <MatrixCell label="TP" value={data.metrics.TP} tone="good" />
          </View>
          <View style={styles.note}><Text style={[styles.noteText, rtl && styles.textRtl]}>⚖ {c.note}</Text></View>

          <Text style={[styles.sectionTitle, rtl && styles.textRtl]}>{c.limits}</Text>
          <View style={styles.limitCard}>{data.limitations.map((item) => <Text key={item} style={[styles.limitText, rtl && styles.textRtl]}>• {item}</Text>)}</View>
        </>}
      </ScrollView>
    </View>
  );
}

function MatrixCell({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" }) {
  return <View style={[styles.matrixCell, tone === "good" ? styles.matrixGood : styles.matrixWarn]}><Text style={styles.matrixLabel}>{label}</Text><Text style={styles.matrixValue}>{value.toLocaleString()}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, rtl: { direction: "rtl" }, textRtl: { textAlign: "right", writingDirection: "rtl" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl }, loading: { minHeight: 260, alignItems: "center", justifyContent: "center" }, loadingText: { color: colors.textMuted, marginTop: spacing.md },
  hero: { padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primaryBorder, ...shadows.card },
  eyebrow: { color: colors.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1.7 }, heroTitle: { color: colors.text, fontSize: 24, fontWeight: "900", marginTop: 8 },
  version: { color: colors.primary, fontSize: 12, fontWeight: "800", marginTop: spacing.lg }, target: { color: colors.textFaint, fontSize: 9, marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "900", marginTop: spacing.xl, marginBottom: spacing.sm },
  metricCard: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  metricRow: { marginBottom: spacing.md }, metricHeading: { flexDirection: "row", justifyContent: "space-between" }, metricLabel: { color: colors.textMuted, fontSize: 10.5, fontWeight: "700" }, metricValue: { color: colors.text, fontSize: 11, fontWeight: "900" },
  track: { height: 6, marginTop: 7, borderRadius: 4, overflow: "hidden", backgroundColor: colors.input }, fill: { height: "100%", borderRadius: 4 },
  matrix: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, matrixCell: { width: "47%", minHeight: 86, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  matrixGood: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder }, matrixWarn: { backgroundColor: colors.amberSoft, borderColor: colors.amberBorder }, matrixLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "900" }, matrixValue: { color: colors.text, fontSize: 23, fontWeight: "900", marginTop: 5 },
  note: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft }, noteText: { color: colors.textMuted, fontSize: 10.5, lineHeight: 16 },
  limitCard: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }, limitText: { color: colors.textMuted, fontSize: 10.5, lineHeight: 17, marginBottom: 6 },
});
