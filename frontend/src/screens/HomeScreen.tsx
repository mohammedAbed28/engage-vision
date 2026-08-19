import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AmbientBackdrop from "../components/AmbientBackdrop";
import GradientButton from "../components/GradientButton";
import { getBackendHealth } from "../api/client";
import { useEngageStore } from "../context/EngageStore";
import { useAppearance } from "../context/AppearanceContext";
import { useI18n } from "../i18n/I18nProvider";
import { colors, gradients, radius, shadows, spacing } from "../theme/theme";
import { AppLanguage } from "../types/prediction";
import { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { language, setLanguage, rtl, t } = useI18n();
  const { profile, history, loggedOutcomeCount, personalBaseline } = useEngageStore();
  const { brighter, toggleMode } = useAppearance();
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    getBackendHealth().then(() => mounted && setReady(true)).catch(() => mounted && setReady(false));
    return () => { mounted = false; };
  }, []);

  return (
    <View style={[styles.root, rtl && styles.rtl]}>
      <AmbientBackdrop />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.brandRow, rtl && styles.rowReverse]}>
          <View style={styles.brandLockup}>
            <Text style={[styles.brandName, rtl && styles.textRtl]}>EngageVision</Text>
            <View style={styles.brandDivider} />
            <View>
              <Text style={[styles.brandLabel, rtl && styles.textRtl]}>{t("home.signalFusion")}</Text>
              <Text style={[styles.brandMeta, rtl && styles.textRtl]}>{t("home.smartPreview")}</Text>
            </View>
          </View>
          <View style={[styles.headerControls, rtl && styles.rowReverse]}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("home.appearance")}
              onPress={toggleMode}
              style={[styles.appearanceButton, brighter && styles.appearanceButtonBright]}
            >
              <Text style={[styles.appearanceIcon, brighter && styles.appearanceIconBright]}>{brighter ? "☀" : "☾"}</Text>
            </TouchableOpacity>
            <View style={[styles.languageChoices, rtl && styles.rowReverse]}>
              {(["en", "he", "ar"] as AppLanguage[]).map((value) => (
                <TouchableOpacity key={value} onPress={() => setLanguage(value)} style={[styles.languageButton, language === value && styles.languageButtonActive]}>
                  <Text style={[styles.languageButtonText, language === value && styles.languageButtonTextActive]}>{value === "en" ? "EN" : value === "he" ? "עב" : "عر"}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={[styles.welcomeRow, rtl && styles.rowReverse]}>
          <View>
            <Text style={[styles.welcome, rtl && styles.textRtl]}>{t("home.welcome", { value: profile?.displayName || "" })}</Text>
            <Text style={[styles.accountMeta, rtl && styles.textRtl]}>{t("home.accountMeta", { followers: (profile?.followerCount || 0).toLocaleString(), posts: history.length })}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate("AccountSetup", { editing: true })} style={styles.profileButton}>
            <Text style={styles.profileButtonText}>{profile?.displayName?.slice(0, 1).toUpperCase() || "E"}</Text>
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={brighter ? ["#368DE4", "#24435D", "#AF6253"] : gradients.signalFusion}
          start={{ x: 0, y: 0.1 }}
          end={{ x: 1, y: 0.9 }}
          style={styles.hero}
        >
          <View style={styles.heroGoldGlow} />
          <View style={styles.heroBlueGlow} />
          <View style={styles.heroCoralGlow} />
          <View style={styles.signalCanvas}>
            <View style={styles.imageSignal}><Text style={styles.signalIcon}>▧</Text><Text style={styles.signalLabel}>{t("common.visual")}</Text></View>
            <View style={styles.fusionCore}><View style={styles.fusionCoreInner}><Text style={styles.fusionSpark}>✦</Text></View></View>
            <View style={styles.textSignal}><Text style={styles.signalIconCoral}>T</Text><Text style={styles.signalLabel}>{t("common.caption")}</Text></View>
          </View>
          <Text style={[styles.heroEyebrow, rtl && styles.textRtl]}>{t("home.eyebrow")}</Text>
          <Text style={[styles.heroTitle, rtl && styles.textRtl]}>{t("home.newTitle")}</Text>
          <Text style={[styles.heroBody, rtl && styles.textRtl]}>{t("home.newBody")}</Text>
          <View style={[styles.heroStatus, rtl && styles.rowReverse]}>
            <View style={[styles.statusDot, ready === true ? styles.ready : ready === false ? styles.offline : styles.checking]} />
            <Text style={styles.statusText}>{ready === true ? t("home.readySimple") : ready === false ? t("home.offlineSimple") : t("home.checkingSimple")}</Text>
          </View>
        </LinearGradient>

        <View style={[styles.statsRow, rtl && styles.rowReverse]}>
          <View style={[styles.statCard, brighter && styles.statCardBright]}>
            <Text style={styles.statValue}>{history.length}</Text>
            <Text style={styles.statLabel}>{t("home.previews")}</Text>
          </View>
          <View style={[styles.statCard, brighter && styles.statCardBright]}>
            <Text style={styles.statValue}>{loggedOutcomeCount}</Text>
            <Text style={styles.statLabel}>{t("home.realResults")}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardAccent, brighter && styles.statCardAccentBright]}>
            <Text style={[styles.statValue, styles.statValueAccent]}>{personalBaseline == null ? "—" : `${personalBaseline.toFixed(1)}%`}</Text>
            <Text style={styles.statLabel}>{t("home.personalBaseline")}</Text>
          </View>
        </View>

        <GradientButton title={t("home.cta")} onPress={() => navigation.navigate("CreatePost")} />

        <View style={[styles.actionGrid, rtl && styles.rowReverse]}>
          <TouchableOpacity onPress={() => navigation.navigate("History")} style={[styles.actionCard, brighter && styles.actionCardBright]}>
            <View style={[styles.actionIcon, styles.actionIconBlue]}><Text style={styles.actionIconText}>◷</Text></View>
            <Text style={[styles.actionTitle, rtl && styles.textRtl]}>{t("home.history")}</Text>
            <Text style={[styles.actionBody, rtl && styles.textRtl]}>{t("home.historyBody")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("AccountSetup", { editing: true })} style={[styles.actionCard, brighter && styles.actionCardBright]}>
            <View style={[styles.actionIcon, styles.actionIconGold]}><Text style={styles.actionIconTextGold}>◎</Text></View>
            <Text style={[styles.actionTitle, rtl && styles.textRtl]}>{t("home.profile")}</Text>
            <Text style={[styles.actionBody, rtl && styles.textRtl]}>{t("home.profileBody")}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate("ModelDashboard")} style={[styles.dashboardCard, brighter && styles.actionCardBright]}>
          <View style={[styles.actionIcon, styles.actionIconBlue]}><Text style={styles.actionIconText}>▥</Text></View>
          <View style={styles.dashboardCopy}>
            <Text style={[styles.actionTitle, rtl && styles.textRtl]}>{language === "he" ? "לוח מדדי המחקר" : language === "ar" ? "لوحة مؤشرات البحث" : "Research model dashboard"}</Text>
            <Text style={[styles.actionBody, rtl && styles.textRtl]}>{language === "he" ? "מדדים מאומתים, מטריצת בלבול, גרסאות ומגבלות." : language === "ar" ? "مؤشرات موثقة ومصفوفة الالتباس والإصدارات والقيود." : "Verified metrics, confusion matrix, versions and limitations."}</Text>
          </View>
          <Text style={styles.dashboardArrow}>{rtl ? "←" : "→"}</Text>
        </TouchableOpacity>

        <View style={styles.privacyRow}>
          <Text style={styles.privacyNote}>{t("home.neverPublish")}</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Privacy")}><Text style={styles.privacyLink}>{t("home.privacy")}</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rtl: { direction: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: 48 },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 32 },
  brandLockup: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  brandName: { color: colors.primary, fontFamily: "serif", fontSize: 22, fontWeight: "700" },
  brandDivider: { width: 1, height: 34, backgroundColor: colors.primaryBorder, marginHorizontal: 10 },
  brandLabel: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  brandMeta: { color: colors.textFaint, fontSize: 7.5, marginTop: 2 },
  headerControls: { flexDirection: "row", alignItems: "center", flexShrink: 0, gap: 7 },
  appearanceButton: { width: 35, height: 35, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.input },
  appearanceButtonBright: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  appearanceIcon: { color: colors.textMuted, fontSize: 15, fontWeight: "900" },
  appearanceIconBright: { color: colors.primary },
  languageChoices: { flexDirection: "row", flexShrink: 0, padding: 3, gap: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.input },
  languageButton: { minWidth: 31, height: 29, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  languageButtonActive: { backgroundColor: colors.primary },
  languageButtonText: { color: colors.textFaint, fontSize: 9, fontWeight: "900" },
  languageButtonTextActive: { color: "#17120C" },
  welcomeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  welcome: { color: colors.text, fontSize: 22, fontWeight: "900" },
  accountMeta: { color: colors.textMuted, fontSize: 10.5, marginTop: 4 },
  profileButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder },
  profileButtonText: { color: colors.primary, fontSize: 16, fontWeight: "900" },
  hero: { minHeight: 330, borderRadius: radius.xl, padding: spacing.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.primaryBorder, marginBottom: spacing.lg, ...shadows.card },
  heroGoldGlow: { position: "absolute", width: 190, height: 190, borderRadius: 95, right: -90, top: -70, backgroundColor: "rgba(232,197,143,0.20)" },
  heroBlueGlow: { position: "absolute", width: 150, height: 150, borderRadius: 75, left: -75, top: 68, backgroundColor: "rgba(75,168,255,0.18)" },
  heroCoralGlow: { position: "absolute", width: 150, height: 150, borderRadius: 75, right: -75, top: 68, backgroundColor: "rgba(255,128,107,0.18)" },
  signalCanvas: { height: 115, flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  imageSignal: { width: 78, height: 70, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(26,104,194,0.42)", borderWidth: 1, borderColor: "rgba(75,168,255,0.44)", transform: [{ perspective: 700 }, { rotateY: "12deg" }] },
  textSignal: { width: 78, height: 70, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(155,66,57,0.42)", borderWidth: 1, borderColor: "rgba(255,128,107,0.44)", transform: [{ perspective: 700 }, { rotateY: "-12deg" }] },
  signalIcon: { color: colors.blue, fontSize: 24, fontWeight: "900" },
  signalIconCoral: { color: colors.coral, fontSize: 22, fontWeight: "900" },
  signalLabel: { color: colors.textMuted, fontSize: 8.5, fontWeight: "800", marginTop: 4 },
  fusionCore: { width: 82, height: 82, borderRadius: 41, marginHorizontal: -7, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(232,197,143,0.10)", borderWidth: 1, borderColor: colors.primaryBorder, ...shadows.glow },
  fusionCoreInner: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary },
  fusionSpark: { color: colors.primary, fontSize: 23 },
  heroEyebrow: { color: colors.primary, fontSize: 8.5, fontWeight: "900", letterSpacing: 1.7, marginBottom: 7 },
  heroTitle: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: "900", maxWidth: 320 },
  heroBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8, maxWidth: 325 },
  heroStatus: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: spacing.lg },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  ready: { backgroundColor: colors.green },
  offline: { backgroundColor: colors.red },
  checking: { backgroundColor: colors.amber },
  statusText: { color: colors.textMuted, fontSize: 9.5, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, minHeight: 79, justifyContent: "center", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  statCardBright: { backgroundColor: "rgba(34,51,67,0.96)" },
  statCardAccent: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  statCardAccentBright: { backgroundColor: "rgba(88,74,52,0.62)" },
  statValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  statValueAccent: { color: colors.primary },
  statLabel: { color: colors.textFaint, fontSize: 8.5, lineHeight: 12, marginTop: 4 },
  actionGrid: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  actionCard: { flex: 1, minHeight: 143, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, ...shadows.card },
  actionCardBright: { backgroundColor: "rgba(34,51,67,0.97)" },
  actionIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  actionIconBlue: { backgroundColor: "rgba(75,168,255,0.13)", borderWidth: 1, borderColor: "rgba(75,168,255,0.35)" },
  actionIconGold: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder },
  actionIconText: { color: colors.blue, fontSize: 17, fontWeight: "900" },
  actionIconTextGold: { color: colors.primary, fontSize: 17, fontWeight: "900" },
  actionTitle: { color: colors.text, fontSize: 13, fontWeight: "900", marginBottom: 5 },
  actionBody: { color: colors.textMuted, fontSize: 9.5, lineHeight: 14 },
  dashboardCard: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primaryBorder, ...shadows.card },
  dashboardCopy: { flex: 1, marginHorizontal: spacing.md },
  dashboardArrow: { color: colors.primary, fontSize: 20, fontWeight: "900" },
  privacyRow: { alignItems: "center", marginTop: spacing.xl },
  privacyNote: { color: colors.textFaint, fontSize: 10, marginBottom: spacing.sm },
  privacyLink: { color: colors.primary, fontSize: 10.5, textDecorationLine: "underline" },
});
