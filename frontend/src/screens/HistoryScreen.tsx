import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../App";
import AmbientBackdrop from "../components/AmbientBackdrop";
import Card from "../components/Card";
import GradientButton from "../components/GradientButton";
import { BottomDock, StudioTopBar } from "../components/StudioChrome";
import { useEngageStore } from "../context/EngageStore";
import { localizedPostType, useI18n } from "../i18n/I18nProvider";
import { outcomeEngagementRate } from "../storage/userData";
import { colors, radius, spacing } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "History">;

export default function HistoryScreen({ navigation }: Props) {
  const { history, loggedOutcomeCount, personalBaseline } = useEngageStore();
  const { language, rtl, t } = useI18n();

  return (
    <View style={[styles.root, rtl && styles.rtl]}>
      <AmbientBackdrop />
      <StudioTopBar
        navigation={navigation}
        title={language === "he" ? "היסטוריה" : language === "ar" ? "السجل" : "History"}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.eyebrow, rtl && styles.textRtl]}>{t("history.eyebrow")}</Text>
        <Text style={[styles.heading, rtl && styles.textRtl]}>{t("history.title")}</Text>
        <Text style={[styles.subtitle, rtl && styles.textRtl]}>{t("history.subtitle")}</Text>

        <Card style={styles.baselineCard}>
          <View style={[styles.baselineTop, rtl && styles.rowReverse]}>
            <View>
              <Text style={[styles.baselineLabel, rtl && styles.textRtl]}>{t("history.baseline")}</Text>
              <Text style={[styles.baseline, rtl && styles.textRtl]}>{personalBaseline == null ? "—" : `${personalBaseline.toFixed(2)}%`}</Text>
            </View>
            <View style={styles.counter}><Text style={styles.counterValue}>{loggedOutcomeCount}</Text><Text style={styles.counterLabel}>{t("history.logged")}</Text></View>
          </View>
          <Text style={[styles.muted, rtl && styles.textRtl]}>
            {personalBaseline == null
              ? t("history.needMore", { value: Math.max(0, 3 - loggedOutcomeCount) })
              : t("history.baselineReady")}
          </Text>
        </Card>

        <View style={[styles.sectionRow, rtl && styles.rowReverse]}>
          <Text style={[styles.sectionTitle, rtl && styles.textRtl]}>{t("history.analyses")}</Text>
          <TouchableOpacity onPress={() => navigation.navigate("AccountSetup", { editing: true })}><Text style={styles.profileLink}>{t("history.editProfile")}</Text></TouchableOpacity>
        </View>

        {history.length === 0 ? (
          <Card><Text style={[styles.muted, rtl && styles.textRtl]}>{t("history.empty")}</Text></Card>
        ) : history.map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={[styles.itemTop, rtl && styles.rowReverse]}>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString(language)}</Text>
              <Text style={styles.type}>{localizedPostType(item.draft.postType, language)}</Text>
            </View>
            <Text style={[styles.caption, rtl && styles.textRtl]} numberOfLines={2}>{item.draft.caption}</Text>
            <View style={[styles.metrics, rtl && styles.rowReverse]}>
              <View><Text style={styles.metricValue}>{Math.round(item.result.calibrated_probability * 100)}%</Text><Text style={styles.metricLabel}>{t("history.outlook")}</Text></View>
              {item.actualOutcome && <View><Text style={styles.metricValue}>{outcomeEngagementRate(item.actualOutcome).toFixed(2)}%</Text><Text style={styles.metricLabel}>{t("history.actualRate")}</Text></View>}
            </View>
            {item.actualOutcome ? (
              <View style={styles.loggedPill}><Text style={styles.loggedPillText}>✓ {t("history.outcomeSaved")}</Text></View>
            ) : (
              <TouchableOpacity onPress={() => navigation.navigate("LogOutcome", { historyId: item.id })} style={styles.logButton}>
                <Text style={styles.logButtonText}>＋ {t("history.logOutcome")}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <GradientButton title={t("home.cta")} onPress={() => navigation.navigate("CreatePost")} />
      </ScrollView>
      <BottomDock navigation={navigation} active="history" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rtl: { direction: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  content: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  eyebrow: { color: colors.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 1.8, marginBottom: 8 },
  heading: { color: colors.text, fontSize: 27, fontWeight: "900", marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: spacing.xl },
  baselineCard: { borderColor: colors.primaryBorder },
  baselineTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  baselineLabel: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  baseline: { color: colors.text, fontSize: 34, fontWeight: "900", marginTop: 4 },
  counter: { minWidth: 72, alignItems: "center", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder },
  counterValue: { color: colors.primary, fontSize: 22, fontWeight: "900" },
  counterLabel: { color: colors.textMuted, fontSize: 9, marginTop: 2 },
  muted: { color: colors.textMuted, lineHeight: 20 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
  profileLink: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  item: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: spacing.md },
  itemTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { color: colors.textFaint, fontSize: 10 },
  type: { color: colors.cyan, fontWeight: "800", fontSize: 10 },
  caption: { color: colors.text, fontWeight: "700", fontSize: 14, lineHeight: 20, marginVertical: spacing.md },
  metrics: { flexDirection: "row", gap: spacing.xxl, marginBottom: spacing.sm },
  metricValue: { color: colors.primary, fontSize: 19, fontWeight: "900" },
  metricLabel: { color: colors.textFaint, fontSize: 9, marginTop: 2 },
  logButton: { alignSelf: "flex-start", paddingVertical: spacing.sm },
  logButtonText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  loggedPill: { alignSelf: "flex-start", backgroundColor: colors.greenSoft, borderColor: colors.greenBorder, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  loggedPillText: { color: colors.green, fontSize: 10, fontWeight: "800" },
});
