import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import AmbientBackdrop from "../components/AmbientBackdrop";
import Card from "../components/Card";
import { colors, spacing } from "../theme/theme";
import { useI18n } from "../i18n/I18nProvider";

export default function PrivacyScreen() {
  const { rtl, t } = useI18n();
  const sections = Array.from({ length: 6 }, (_, index) => ({ title: t(`privacy.s${index + 1}t`), body: t(`privacy.s${index + 1}b`) }));
  return (
    <View style={[styles.root, rtl && styles.rtl]}>
      <AmbientBackdrop />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.eyebrow, rtl && styles.textRtl]}>{t("privacy.eyebrow")}</Text>
        <Text style={[styles.heading, rtl && styles.textRtl]}>{t("privacy.title")}</Text>
        <Text style={[styles.intro, rtl && styles.textRtl]}>{t("privacy.intro")}</Text>

        {sections.map((section, index) => (
          <Card key={section.title}>
            <View style={[styles.titleRow, rtl && styles.rowReverse]}>
              <Text style={styles.number}>{String(index + 1).padStart(2, "0")}</Text>
              <Text style={[styles.title, rtl && styles.textRtl]}>{section.title}</Text>
            </View>
            <Text style={[styles.body, rtl && styles.textRtl]}>{section.body}</Text>
          </Card>
        ))}

        <Text style={styles.contact}>{t("privacy.contact")}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rtl: { direction: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  eyebrow: { color: colors.cyan, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.8, marginBottom: 8 },
  heading: { color: colors.text, fontSize: 26, fontWeight: "900", marginBottom: 8 },
  intro: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.xl },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  number: { color: colors.cyan, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.1, width: 31 },
  title: { color: colors.text, fontSize: 14.5, fontWeight: "800" },
  body: { color: colors.textMuted, fontSize: 12.5, lineHeight: 19 },
  contact: { color: colors.textFaint, fontSize: 11, lineHeight: 17, textAlign: "center", paddingHorizontal: spacing.lg },
});
