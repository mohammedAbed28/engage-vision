import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, spacing } from "../theme/theme";

interface Props {
  title: string;
  step?: number;
  icon?: string;
}

/** Section header used at the top of every card — either a numbered step
 * chip (input workflow) or an icon (results sections). */
export default function SectionTitle({ title, step, icon }: Props) {
  return (
    <View style={styles.row}>
      {step != null ? (
        <LinearGradient colors={gradients.primary} style={styles.stepChip}>
          <Text style={styles.stepText}>{step}</Text>
        </LinearGradient>
      ) : icon ? (
        <Text style={styles.icon}>{icon}</Text>
      ) : null}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  stepChip: {
    width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center",
  },
  stepText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  icon: { fontSize: 17 },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
});
