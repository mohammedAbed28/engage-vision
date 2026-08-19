import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme/theme";
import { useI18n } from "../i18n/I18nProvider";

/** Polished error card — replaces raw error text/tracebacks everywhere
 * in the app (no image selected, empty caption, backend unreachable,
 * prediction failed, unsupported image, etc.). */
export function ErrorCard({ message }: { message: string }) {
  const { rtl } = useI18n();
  return (
    <View style={[styles.card, rtl && styles.rowReverse, styles.error]}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={[styles.text, rtl && styles.textRtl, { color: colors.red }]}>{message}</Text>
    </View>
  );
}

export function WarningCard({ message }: { message: string }) {
  return (
    <View style={[styles.card, styles.warning]}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={[styles.text, { color: colors.amber }]}>{message}</Text>
    </View>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <View style={[styles.card, styles.success]}>
      <Text style={styles.icon}>✅</Text>
      <Text style={[styles.text, { color: colors.green, fontWeight: "700" }]}>{message}</Text>
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

/** Full-screen-friendly loading indicator with a status message, used
 * while the app is analyzing a post or generating an improvement. */
export function LoadingBlock({ message }: { message: string }) {
  const { rtl } = useI18n();
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.purple} />
      <Text style={[styles.loadingText, rtl && styles.textRtl]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  error: { backgroundColor: colors.redSoft, borderColor: colors.redBorder },
  warning: { backgroundColor: colors.amberSoft, borderColor: colors.amberBorder },
  success: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
  icon: { fontSize: 16 },
  text: { flex: 1, fontSize: 13, lineHeight: 18 },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 1.4,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  emptyIcon: { fontSize: 30, marginBottom: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
  loading: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl, gap: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 13 },
});
