import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme/theme";
import { ProfessionalRecommendation } from "../types/prediction";
import { localizeRecommendation, useI18n } from "../i18n/I18nProvider";

/** Small colored-accent list item cards reused across Recommendations,
 * Improvement Studio suggestions, and Strengths/Risks. */

export function RecommendationCard({ text }: { text: string }) {
  return (
    <View style={[styles.item, { backgroundColor: colors.purpleSoft, borderLeftColor: colors.purple }]}> 
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

export function SuggestionCard({ text }: { text: string }) {
  return (
    <View style={[styles.item, { backgroundColor: colors.cyanSoft, borderLeftColor: colors.cyan }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

export function StrengthCard({ text }: { text: string }) {
  const { rtl } = useI18n();
  return (
    <View style={[styles.signal, rtl && styles.rowReverse, { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder }]}> 
      <View style={[styles.signalDot, rtl && styles.signalDotRtl, { backgroundColor: colors.green }]} />
      <Text style={[styles.signalText, rtl && styles.textRtl]}>{text}</Text>
    </View>
  );
}

export function RiskCard({ text }: { text: string }) {
  return (
    <View style={[styles.signal, { backgroundColor: colors.amberSoft, borderColor: colors.amberBorder }]}> 
      <View style={[styles.signalDot, { backgroundColor: colors.amber }]} />
      <Text style={styles.signalText}>{text}</Text>
    </View>
  );
}

export function EvidenceRecommendationCard({ item }: { item: ProfessionalRecommendation }) {
  const { language, rtl, t } = useI18n();
  const localized = localizeRecommendation(item, language);
  const measured = localized.impact_points != null;
  const category = localized.category === "caption" || localized.category === "message" ? t("common.caption")
    : localized.category === "visual" ? t("common.visual")
    : localized.category === "timing" ? t("common.timing")
    : localized.category === "tags" ? t("common.tags") : t("common.recommendation");
  return (
    <View style={[styles.evidenceCard, rtl && styles.rtl]}>
      <View style={[styles.evidenceTopRow, rtl && styles.rowReverse]}>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryText}>{category}</Text>
        </View>
        <Text style={styles.priorityText}>{t("common.priority", { value: localized.priority })}</Text>
      </View>
      <Text style={[styles.evidenceTitle, rtl && styles.textRtl]}>{localized.title}</Text>
      <Text style={[styles.detailLabel, rtl && styles.textRtl]}>{t("common.action")}</Text>
      <Text style={[styles.evidenceAction, rtl && styles.textRtl]}>{localized.action}</Text>
      <View style={[styles.whyRow, rtl && styles.rowReverse]}>
        <View style={[styles.whyMark, rtl && styles.whyMarkRtl]}><Text style={styles.whyMarkText}>i</Text></View>
        <View style={styles.whyCopy}>
          <Text style={[styles.detailLabel, rtl && styles.textRtl]}>{t("common.evidence")}</Text>
          <Text style={[styles.whyLabel, rtl && styles.textRtl]}>{measured ? t("common.measured", { value: localized.impact_points?.toFixed(1) || "0.0" }) : t("common.recommendation")}</Text>
          <Text style={[styles.whyText, rtl && styles.textRtl]}>{localized.evidence}</Text>
        </View>
      </View>
      <View style={styles.validationBox}>
        <Text style={[styles.detailLabel, rtl && styles.textRtl]}>{t("common.verify")}</Text>
        <Text style={[styles.validationText, rtl && styles.textRtl]}>{localized.validation}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rtl: { direction: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  item: {
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  text: { color: colors.text, fontSize: 13, lineHeight: 19 },
  signal: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  signalDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6, marginRight: spacing.sm },
  signalDotRtl: { marginRight: 0, marginLeft: spacing.sm },
  signalText: { color: colors.text, fontSize: 13, lineHeight: 19, flex: 1 },
  evidenceCard: {
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md,
    backgroundColor: "rgba(6,12,29,0.54)", borderWidth: 1, borderColor: colors.cardBorder,
  },
  evidenceTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  categoryPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.cyanSoft, borderWidth: 1, borderColor: "rgba(93,230,255,0.22)" },
  categoryText: { color: colors.cyan, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.5 },
  priorityText: { color: colors.textFaint, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  evidenceTitle: { color: colors.text, fontSize: 14.5, lineHeight: 19, fontWeight: "900", marginBottom: 7 },
  evidenceAction: { color: colors.textMuted, fontSize: 12.5, lineHeight: 19 },
  detailLabel: { color: colors.cyan, fontSize: 7.5, fontWeight: "900", letterSpacing: 1, marginBottom: 5 },
  whyRow: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  whyMark: { width: 24, height: 24, borderRadius: 9, alignItems: "center", justifyContent: "center", marginRight: spacing.sm, backgroundColor: colors.purpleSoft },
  whyMarkRtl: { marginRight: 0, marginLeft: spacing.sm },
  whyMarkText: { color: colors.purple, fontSize: 11, fontWeight: "900" },
  whyCopy: { flex: 1 },
  whyLabel: { color: colors.purple, fontSize: 7.8, fontWeight: "900", letterSpacing: 0.9, marginBottom: 4 },
  whyText: { color: colors.textFaint, fontSize: 10.5, lineHeight: 15.5 },
  validationBox: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: "rgba(24,188,235,0.07)", borderWidth: 1, borderColor: "rgba(93,230,255,0.16)" },
  validationText: { color: colors.textMuted, fontSize: 10.5, lineHeight: 16 },
});
