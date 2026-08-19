import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../App";
import AmbientBackdrop from "../components/AmbientBackdrop";
import Card from "../components/Card";
import GradientButton from "../components/GradientButton";
import { useEngageStore } from "../context/EngageStore";
import { useI18n } from "../i18n/I18nProvider";
import { colors, radius, spacing } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "LogOutcome">;

export default function LogOutcomeScreen({ route, navigation }: Props) {
  const { profile, history, logOutcome } = useEngageStore();
  const { rtl, t } = useI18n();
  const [values, setValues] = useState({ likes: "", comments: "", saves: "", shares: "" });
  const [saving, setSaving] = useState(false);
  const valid = Object.values(values).every((value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0));
  const followerSnapshot = history.find((item) => item.id === route.params.historyId)?.followerCountSnapshot ?? profile?.followerCount;

  async function submit() {
    if (!valid || followerSnapshot == null) return;
    setSaving(true);
    await logOutcome(route.params.historyId, {
      likes: Number(values.likes || 0),
      comments: Number(values.comments || 0),
      saves: Number(values.saves || 0),
      shares: Number(values.shares || 0),
      followerCountAtPost: followerSnapshot,
      loggedAt: new Date().toISOString(),
    });
    setSaving(false);
    navigation.goBack();
  }

  return (
    <View style={[styles.root, rtl && styles.rtl]}>
      <AmbientBackdrop />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.eyebrow, rtl && styles.textRtl]}>{t("outcome.eyebrow")}</Text>
          <Text style={[styles.title, rtl && styles.textRtl]}>{t("outcome.title")}</Text>
          <Text style={[styles.subtitle, rtl && styles.textRtl]}>{t("outcome.subtitle")}</Text>
          <Card>
            {(["likes", "comments", "saves", "shares"] as const).map((key) => (
              <View key={key} style={styles.field}>
                <Text style={[styles.label, rtl && styles.textRtl]}>{t(`outcome.${key}`)}</Text>
                <TextInput
                  value={values[key]}
                  onChangeText={(value) => setValues((current) => ({ ...current, [key]: value }))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textFaint}
                  style={[styles.input, rtl && styles.textRtl]}
                />
              </View>
            ))}
            <View style={styles.snapshot}>
              <Text style={[styles.snapshotLabel, rtl && styles.textRtl]}>{t("outcome.followerSnapshot")}</Text>
              <Text style={styles.snapshotValue}>{followerSnapshot?.toLocaleString() ?? "—"}</Text>
            </View>
          </Card>
          <GradientButton title={t("outcome.save")} onPress={submit} loading={saving} disabled={!valid || followerSnapshot == null} />
          <Text style={[styles.note, rtl && styles.textRtl]}>{t("outcome.note")}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rtl: { direction: "rtl" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  content: { padding: spacing.xl, paddingTop: spacing.xl, paddingBottom: 48 },
  eyebrow: { color: colors.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1.8, marginBottom: 8 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900", marginBottom: spacing.sm },
  subtitle: { color: colors.textMuted, lineHeight: 21, marginBottom: spacing.xl },
  field: { marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: "800", marginBottom: spacing.sm },
  input: { color: colors.text, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, padding: spacing.md, fontSize: 16 },
  snapshot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  snapshotLabel: { color: colors.textMuted, fontSize: 11 },
  snapshotValue: { color: colors.primary, fontSize: 18, fontWeight: "900" },
  note: { color: colors.textFaint, textAlign: "center", fontSize: 10.5, lineHeight: 16, marginTop: spacing.md },
});
