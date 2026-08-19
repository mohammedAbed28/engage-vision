import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme/theme";
import { useI18n } from "../i18n/I18nProvider";

/** Prediction outcome badge — High Engagement / Low Engagement. */
export function PredictionBadge({ isHigh, label }: { isHigh: boolean; label: string }) {
  return (
    <View style={[styles.badge, isHigh ? styles.high : styles.low]}>
      <Text style={[styles.text, { color: isHigh ? colors.green : colors.red }]}>
        {isHigh ? "✅" : "⚠️"} {label}
      </Text>
    </View>
  );
}

/** Small pill chip — used for feature badges, post-type/time chips. */
export function Chip({ label }: { label: string }) {
  const { rtl } = useI18n();
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipText, rtl && styles.textRtl]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  high: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
  low: { backgroundColor: colors.redSoft, borderColor: colors.redBorder },
  text: { fontWeight: "800", fontSize: 16 },
  chip: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
  },
  chipText: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
});
