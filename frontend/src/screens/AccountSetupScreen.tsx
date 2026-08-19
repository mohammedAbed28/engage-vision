import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";

import { RootStackParamList } from "../../App";
import AmbientBackdrop from "../components/AmbientBackdrop";
import GradientButton from "../components/GradientButton";
import { useEngageStore } from "../context/EngageStore";
import { useI18n } from "../i18n/I18nProvider";
import { colors, gradients, radius, shadows, spacing } from "../theme/theme";
import { AppLanguage, UserProfile } from "../types/prediction";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "AccountSetup">;
const LANGUAGES: { value: AppLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "he", label: "עברית" },
  { value: "ar", label: "العربية" },
];
const ACCOUNT_TYPES: UserProfile["accountType"][] = ["personal", "creator", "business", "nonprofit"];

export default function AccountSetupScreen({ route, navigation }: Props) {
  const { profile, saveProfile } = useEngageStore();
  const { user, userProfile, logout } = useAuth();
  const { language, setLanguage, rtl, t } = useI18n();
  const editing = route.params?.editing === true;
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [followers, setFollowers] = useState(profile ? String(profile.followerCount) : "");
  const [accountType, setAccountType] = useState<UserProfile["accountType"]>(profile?.accountType ?? "creator");
  const [saving, setSaving] = useState(false);
  const followerCount = Number(followers.replace(/[,\s]/g, ""));
  const valid = displayName.trim().length > 0 && Number.isFinite(followerCount) && followerCount >= 0;

  useEffect(() => {
    if (!displayName.trim()) {
      const authenticatedName = userProfile?.fullName || user?.displayName || "";
      if (authenticatedName) setDisplayName(authenticatedName);
    }
  }, [displayName, user?.displayName, userProfile?.fullName]);

  async function submit() {
    if (!valid) return;
    setSaving(true);
    const now = new Date().toISOString();
    await saveProfile({
      id: profile?.id ?? `profile-${Date.now()}`,
      displayName: displayName.trim(),
      followerCount: Math.round(followerCount),
      accountType,
      preferredLanguage: language,
      createdAt: profile?.createdAt ?? now,
      updatedAt: now,
    });
    setSaving(false);
    if (editing && navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: "CreatePost" }] });
  }

  function confirmLogout() {
    const messages = {
      en: { title: "Log out?", body: "You will need to authenticate again to open your private workspace.", cancel: "Cancel", action: "Log out" },
      he: { title: "לצאת מהחשבון?", body: "כדי לפתוח שוב את סביבת העבודה הפרטית יהיה צורך להתחבר מחדש.", cancel: "ביטול", action: "יציאה" },
      ar: { title: "تسجيل الخروج؟", body: "ستحتاج إلى تسجيل الدخول مجددًا لفتح مساحة عملك الخاصة.", cancel: "إلغاء", action: "خروج" },
    }[language];
    Alert.alert(messages.title, messages.body, [
      { text: messages.cancel, style: "cancel" },
      { text: messages.action, style: "destructive", onPress: () => void logout() },
    ]);
  }

  return (
    <View style={[styles.root, rtl && styles.rtl]}>
      <AmbientBackdrop />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.brandRow, rtl && styles.rowReverse]}>
            <LinearGradient colors={gradients.primary} style={styles.brandMark}><Text style={styles.brandText}>E</Text></LinearGradient>
            <View>
              <Text style={[styles.brandName, rtl && styles.textRtl]}>EngageVision</Text>
              <Text style={[styles.brandMeta, rtl && styles.textRtl]}>{t("profile.private")}</Text>
            </View>
          </View>

          <Text style={[styles.eyebrow, rtl && styles.textRtl]}>{t("profile.eyebrow")}</Text>
          <Text style={[styles.title, rtl && styles.textRtl]}>{editing ? t("profile.editTitle") : t("profile.title")}</Text>
          <Text style={[styles.subtitle, rtl && styles.textRtl]}>{t("profile.subtitle")}</Text>

          <View style={styles.card}>
            <Text style={[styles.label, rtl && styles.textRtl]}>{t("profile.name")}</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t("profile.namePlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={[styles.input, rtl && styles.textRtl]}
            />

            <Text style={[styles.label, rtl && styles.textRtl]}>{t("profile.followers")}</Text>
            <TextInput
              value={followers}
              onChangeText={setFollowers}
              keyboardType="number-pad"
              placeholder="1,250"
              placeholderTextColor={colors.textFaint}
              style={[styles.input, rtl && styles.textRtl]}
            />
            <Text style={[styles.helper, rtl && styles.textRtl]}>{t("profile.followersHelp")}</Text>

            <Text style={[styles.label, rtl && styles.textRtl]}>{t("profile.accountType")}</Text>
            <View style={[styles.wrap, rtl && styles.rowReverse]}>
              {ACCOUNT_TYPES.map((type) => (
                <TouchableOpacity key={type} onPress={() => setAccountType(type)} style={[styles.chip, accountType === type && styles.chipActive]}>
                  <Text style={[styles.chipText, accountType === type && styles.chipTextActive]}>{t(`profile.type.${type}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, rtl && styles.textRtl]}>{t("profile.language")}</Text>
            <View style={[styles.wrap, rtl && styles.rowReverse]}>
              {LANGUAGES.map((item) => (
                <TouchableOpacity key={item.value} onPress={() => setLanguage(item.value)} style={[styles.chip, language === item.value && styles.chipActive]}>
                  <Text style={[styles.chipText, language === item.value && styles.chipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <GradientButton title={editing ? t("profile.save") : t("profile.continue")} onPress={submit} loading={saving} disabled={!valid} />
          {editing && (
            <GradientButton
              title={{ en: "Log out", he: "יציאה מהחשבון", ar: "تسجيل الخروج" }[language]}
              onPress={confirmLogout}
              variant="secondary"
              style={styles.logout}
            />
          )}
          <Text style={[styles.privacy, rtl && styles.textRtl]}>{t("profile.storage")}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rtl: { direction: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  content: { padding: spacing.xl, paddingTop: 52, paddingBottom: 48 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 42 },
  brandMark: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", ...shadows.glow },
  brandText: { color: "#17120C", fontSize: 20, fontWeight: "900" },
  brandName: { color: colors.text, fontSize: 18, fontWeight: "900" },
  brandMeta: { color: colors.primary, fontSize: 9, fontWeight: "800", letterSpacing: 1.1, marginTop: 2 },
  eyebrow: { color: colors.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 32, lineHeight: 39, fontWeight: "900", marginBottom: spacing.sm },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: spacing.xl },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.xl, ...shadows.card },
  label: { color: colors.text, fontWeight: "800", fontSize: 13, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15 },
  helper: { color: colors.textFaint, fontSize: 11, lineHeight: 17, marginTop: spacing.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.input, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 10 },
  chipActive: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  chipText: { color: colors.textMuted, fontWeight: "700" },
  chipTextActive: { color: colors.primary },
  privacy: { color: colors.textFaint, textAlign: "center", fontSize: 11, lineHeight: 17, marginTop: spacing.md },
  logout: { marginTop: spacing.md, borderColor: colors.redBorder },
});
