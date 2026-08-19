import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useI18n } from "../i18n/I18nProvider";
import { colors, radius, spacing } from "../theme/theme";

type DirectionKind = "goal" | "tone";

export default function EditorialDirectionPicker<T extends string>({
  kind,
  value,
  options,
  onChange,
}: {
  kind: DirectionKind;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  const { rtl, t } = useI18n();
  const [open, setOpen] = useState(false);
  const titleKey = kind === "goal" ? "direction.goalTitle" : "direction.toneTitle";
  const hintKey = kind === "goal" ? "direction.goalHint" : "direction.toneHint";

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, rtl && styles.textRtl]}>{t(titleKey)}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={[styles.summary, rtl && styles.rowReverse, open && styles.summaryOpen]}
      >
        <View style={[styles.summaryIcon, rtl && styles.summaryIconRtl]}>
          <Text style={styles.summaryIconText}>{kind === "goal" ? "◎" : "Aa"}</Text>
        </View>
        <View style={styles.summaryCopy}>
          <Text style={[styles.summaryTitle, rtl && styles.textRtl]}>{t(`${kind}.${value}`)}</Text>
          <Text style={[styles.summaryDescription, rtl && styles.textRtl]}>{t(`${kind}.${value}.desc`)}</Text>
        </View>
        <View style={styles.changePill}>
          <Text style={styles.changeText}>{open ? t("direction.close") : t("direction.change")}</Text>
          <Text style={styles.chevron}>{open ? "⌃" : "⌄"}</Text>
        </View>
      </TouchableOpacity>

      {!open ? (
        <Text style={[styles.hint, rtl && styles.textRtl]}>{t(hintKey)}</Text>
      ) : (
        <View style={styles.optionList}>
          {options.map((option) => {
            const selected = option === value;
            return (
              <TouchableOpacity
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
                style={[styles.option, rtl && styles.rowReverse, selected && styles.optionSelected]}
              >
                <View style={[styles.radio, rtl && styles.radioRtl, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioCore} />}
                </View>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionTitle, rtl && styles.textRtl, selected && styles.optionTitleSelected]}>{t(`${kind}.${option}`)}</Text>
                  <Text style={[styles.optionDescription, rtl && styles.textRtl]}>{t(`${kind}.${option}.desc`)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg },
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.sm },
  summary: {
    minHeight: 78, flexDirection: "row", alignItems: "center", padding: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.cardBorder,
    backgroundColor: colors.input,
  },
  summaryOpen: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  summaryIcon: {
    width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center",
    marginRight: spacing.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder,
  },
  summaryIconRtl: { marginRight: 0, marginLeft: spacing.md },
  summaryIconText: { color: colors.primary, fontSize: 14, fontWeight: "900" },
  summaryCopy: { flex: 1 },
  summaryTitle: { color: colors.text, fontSize: 13, fontWeight: "900", marginBottom: 4 },
  summaryDescription: { color: colors.textMuted, fontSize: 10.5, lineHeight: 15 },
  changePill: { alignItems: "center", justifyContent: "center", marginLeft: spacing.sm, minWidth: 48 },
  changeText: { color: colors.primary, fontSize: 8.5, fontWeight: "900" },
  chevron: { color: colors.primary, fontSize: 16, marginTop: 2 },
  hint: { color: colors.textFaint, fontSize: 9.5, marginTop: 7 },
  optionList: { marginTop: spacing.sm, gap: 7 },
  option: {
    minHeight: 64, flexDirection: "row", alignItems: "center", padding: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.input,
  },
  optionSelected: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  radio: {
    width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center",
    marginRight: spacing.md, borderWidth: 1, borderColor: colors.textFaint,
  },
  radioRtl: { marginRight: 0, marginLeft: spacing.md },
  radioSelected: { borderColor: colors.primary },
  radioCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionCopy: { flex: 1 },
  optionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: "800", marginBottom: 3 },
  optionTitleSelected: { color: colors.text },
  optionDescription: { color: colors.textFaint, fontSize: 10.5, lineHeight: 15 },
});
