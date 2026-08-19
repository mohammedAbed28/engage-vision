import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme/theme";
import { Chip } from "./Badge";
import { localizedPostType, useI18n } from "../i18n/I18nProvider";

interface Props {
  imageUri: string | null;
  caption: string;
  postType: string;
  dayName?: string;
  postHour?: number;
}

/** Phone-style live post preview, shown before analysis so the user sees
 * roughly how their post will look. */
export default function PhonePreview({ imageUri, caption, postType, dayName, postHour }: Props) {
  const { language, rtl, t } = useI18n();
  return (
    <View style={rtl && styles.rtl}>
      <View style={styles.frame}>
        <View style={styles.screen}>
          <View style={styles.imageWrap}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.emptyPhoto}>
                <Text style={styles.emptyIcon}>📷</Text>
                <Text style={styles.emptyText}>{t("preview.noImage")}</Text>
              </View>
            )}
          </View>
          <View style={styles.body}>
            <Text style={[styles.caption, rtl && styles.textRtl]} numberOfLines={4}>
              {caption.trim() ? caption : t("create.captionPlaceholder")}
            </Text>
            <View style={[styles.metaRow, rtl && styles.rowReverse]}>
              <Chip label={localizedPostType(postType, language)} />
              {dayName != null && postHour != null && <Chip label={`${dayName}, ${String(postHour).padStart(2, "0")}:00`} />}
            </View>
          </View>
        </View>
      </View>
      <Text style={styles.previewLabel}>{t("preview.label")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rtl: { direction: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  frame: {
    backgroundColor: "rgba(22,34,62,0.58)",
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.sm + 2,
    maxWidth: 320,
    alignSelf: "center",
    width: "100%",
    shadowColor: "#000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.34,
    shadowRadius: 20, elevation: 10,
  },
  screen: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  imageWrap: { width: "100%", aspectRatio: 1, backgroundColor: "#12172A" },
  image: { width: "100%", height: "100%" },
  emptyPhoto: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  emptyIcon: { fontSize: 28 },
  emptyText: { color: colors.textFaint, fontSize: 13 },
  body: { padding: spacing.md },
  caption: { color: colors.text, fontSize: 13, lineHeight: 18, marginBottom: spacing.sm },
  metaRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  previewLabel: {
    textAlign: "center", color: colors.textFaint, fontSize: 12, marginTop: spacing.sm,
  },
});
