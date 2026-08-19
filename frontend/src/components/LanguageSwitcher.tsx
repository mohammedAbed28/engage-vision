import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useI18n } from "../i18n/I18nProvider";
import { AppLanguage } from "../types/prediction";
import { colors, radius } from "../theme/theme";

const OPTIONS: Array<{ value: AppLanguage; label: string; accessible: string }> = [
  { value: "en", label: "EN", accessible: "English" },
  { value: "he", label: "עב", accessible: "עברית" },
  { value: "ar", label: "عر", accessible: "العربية" },
];

/** Persistent language control used in every navigation header. */
export default function LanguageSwitcher() {
  const { language, setLanguage, rtl } = useI18n();
  return (
    <View style={[styles.wrap, rtl && styles.rowReverse]} accessibilityRole="radiogroup">
      {OPTIONS.map((option) => {
        const active = language === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.accessible}
            accessibilityState={{ checked: active }}
            onPress={() => setLanguage(option.value)}
            style={[styles.button, active && styles.buttonActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center", padding: 3, gap: 2,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.cardBorder,
    backgroundColor: "rgba(7,12,28,0.72)",
  },
  rowReverse: { flexDirection: "row-reverse" },
  button: { minWidth: 28, height: 26, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  buttonActive: { backgroundColor: colors.purple, shadowColor: colors.purple, shadowOpacity: 0.32, shadowRadius: 7 },
  label: { color: colors.textFaint, fontSize: 9, fontWeight: "900" },
  labelActive: { color: "#FFFFFF" },
});
