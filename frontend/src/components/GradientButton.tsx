import React from "react";
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, radius, shadows, spacing } from "../theme/theme";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
}

/** Primary gradient action button (or a flat secondary variant), used for
 * every call-to-action in the app — Analyze Post, improvement choices, etc. */
export default function GradientButton({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}: Props) {
  const { rtl } = useI18n();
  const isDisabled = disabled || loading;

  if (variant === "secondary") {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[styles.secondary, isDisabled && styles.disabled, style]}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <View style={[styles.labelRow, rtl && styles.rowReverse]}>
            <Text style={styles.secondaryText}>{title}</Text>
            <Text style={styles.secondaryArrow}>{rtl ? "←" : "→"}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.86}
      style={[!isDisabled && styles.primaryDepth, style]}
    >
      <LinearGradient
        colors={isDisabled ? ["#3A3F52", "#3A3F52"] : gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.shine} />
        {loading ? (
          <ActivityIndicator color="#17120C" />
        ) : (
          <View style={[styles.labelRow, rtl && styles.rowReverse]}>
            <Text style={[styles.text, isDisabled && styles.textDisabled]}>{title}</Text>
            <View style={styles.arrowBubble}><Text style={styles.arrow}>{rtl ? "←" : "→"}</Text></View>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  rowReverse: { flexDirection: "row-reverse" },
  gradient: {
    borderRadius: 19,
    minHeight: 58,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  primaryDepth: { ...shadows.glow },
  shine: {
    position: "absolute", left: 20, right: 20, top: 1, height: 1,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  text: { color: "#17120C", fontWeight: "900", fontSize: 15, letterSpacing: 0.15 },
  textDisabled: { color: "#9CA3AF" },
  secondary: {
    borderRadius: radius.lg,
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,29,39,0.84)",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  secondaryText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  secondaryArrow: { color: colors.purple, fontSize: 18, fontWeight: "800" },
  arrowBubble: {
    width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(23,18,12,0.14)",
  },
  arrow: { color: "#17120C", fontSize: 16, fontWeight: "900", marginTop: -1 },
  disabled: { opacity: 0.5 },
});
