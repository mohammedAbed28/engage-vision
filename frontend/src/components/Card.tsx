import React, { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, radius, shadows, spacing } from "../theme/theme";
import { useAppearance } from "../context/AppearanceContext";

/** Base glass-style card used throughout the app for grouped content. */
export default function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { brighter } = useAppearance();
  return (
    <View style={[styles.depth, style]}>
      <LinearGradient
        colors={brighter ? ["rgba(41,58,75,0.98)", "rgba(22,35,48,0.99)"] : gradients.surface}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.card}
      >
        <View style={styles.topHighlight} />
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  depth: {
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  card: {
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    overflow: "hidden",
  },
  topHighlight: {
    position: "absolute",
    left: 24,
    right: 24,
    top: 0,
    height: 1,
    backgroundColor: colors.cardHighlight,
  },
});
