import React, { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as FileSystem from "expo-file-system/legacy";

import { RootStackParamList } from "../../App";
import { ApiError, requestModelGuidedImageEdit } from "../api/client";
import AmbientBackdrop from "../components/AmbientBackdrop";
import { ErrorCard } from "../components/StatusCards";
import { StudioTopBar, ThreeStepProgress } from "../components/StudioChrome";
import { localizeRecommendation, localizedApiError, useI18n } from "../i18n/I18nProvider";
import { colors, radius, shadows, spacing } from "../theme/theme";
import { ModelGuidedImageEditResponse } from "../types/prediction";

type Props = NativeStackScreenProps<RootStackParamList, "ModelGuidedEditor">;

const copy = {
  en: {
    title: "Image improvement",
    steps: ["Model direction", "AI generation", "Model validation"] as [string, string, string],
    choose: "Choose one visual change",
    chooseBody: "Only the selected property will change. The completed image is then evaluated against the original.",
    defaultTitle: "Controlled visual adjustment",
    controlled: "Tested as one isolated change",
    create: "Create and evaluate revision",
    waitTitle: "Improving your image",
    wait: [
      "Preparing the original image…",
      "Creating one focused revision…",
      "Checking the revised image…",
      "Comparing the two outlooks…",
    ],
    waitNote: "The recommendation engine chooses the direction. A controlled editor or AI executes it, and the MoE validates every completed candidate.",
    original: "Original",
    revision: "Revision",
    aiRevision: "AI-generated improvement",
    controlledRevision: "Controlled improvement",
    score: "Outlook",
    changed: "Change completed",
    modelRecommendation: "Model-based recommendation",
    modelReason: "Why the model recommended this",
    modelValidation: "Model validation",
    measuredChange: "Measured change",
    directionalChange: "Directional model signal: {value} points inside the same calibrated band",
    percentagePoints: "{value} percentage points",
    bestOf: "Best of {count} tested images · target {target} points",
    better: "The best tested image reached the meaningful improvement target.",
    notBetter: "No tested image reached the meaningful improvement target. Keep the original or test another direction.",
    keep: "Keep original",
    apply: "Apply revision",
    retry: "Try another change",
    privacy: "Nothing is published automatically.",
  },
  he: {
    title: "שיפור תמונה",
    steps: ["כיוון מהמודל", "יצירת AI", "אימות המודל"] as [string, string, string],
    choose: "בחרו שינוי חזותי אחד",
    chooseBody: "רק המאפיין שנבחר ישתנה. לאחר מכן התמונה המלאה נבדקת מול המקור.",
    defaultTitle: "שינוי חזותי מבוקר",
    controlled: "נבדק כשינוי מבודד אחד",
    create: "יצירת גרסה והערכתה",
    waitTitle: "משפרים את התמונה",
    wait: [
      "מכינים את תמונת המקור…",
      "יוצרים גרסה ממוקדת אחת…",
      "בודקים את התמונה החדשה…",
      "משווים בין שתי התחזיות…",
    ],
    waitNote: "מנוע ההמלצות בוחר את הכיוון. עורך מבוקר או AI מבצע אותו, וה־MoE מאמת כל מועמד שהושלם.",
    original: "מקור",
    revision: "גרסה חדשה",
    aiRevision: "שיפור שנוצר באמצעות AI",
    controlledRevision: "שיפור מבוקר",
    score: "תחזית",
    changed: "השינוי שבוצע",
    modelRecommendation: "המלצה מבוססת מודל",
    modelReason: "מדוע המודל המליץ על כך",
    modelValidation: "אימות המודל",
    measuredChange: "שינוי נמדד",
    directionalChange: "אות כיוון פנימי של המודל: {value} נק׳ בתוך אותה מדרגת כיול",
    percentagePoints: "{value} נקודות אחוז",
    bestOf: "הטובה מתוך {count} תמונות שנבדקו · יעד {target} נק׳",
    better: "התמונה הטובה ביותר שנבדקה הגיעה ליעד השיפור המשמעותי.",
    notBetter: "אף תמונה שנבדקה לא הגיעה ליעד השיפור המשמעותי. מומלץ לשמור את המקור או לבדוק כיוון אחר.",
    keep: "שמירת המקור",
    apply: "שימוש בגרסה",
    retry: "ניסיון שינוי אחר",
    privacy: "שום דבר אינו מתפרסם אוטומטית.",
  },
  ar: {
    title: "تحسين الصورة",
    steps: ["اتجاه النموذج", "إنشاء AI", "تحقق النموذج"] as [string, string, string],
    choose: "اختر تغييرًا بصريًا واحدًا",
    chooseBody: "ستتغير الخاصية المحددة فقط، ثم تُقارن الصورة المكتملة بالأصل.",
    defaultTitle: "تعديل بصري مضبوط",
    controlled: "يُختبر كتغيير منفصل واحد",
    create: "إنشاء النسخة وتقييمها",
    waitTitle: "نحسّن الصورة",
    wait: [
      "نجهز الصورة الأصلية…",
      "ننشئ نسخة مركزة واحدة…",
      "نفحص الصورة الجديدة…",
      "نقارن التوقعين…",
    ],
    waitNote: "يختار محرك التوصيات الاتجاه، وينفذه محرر مضبوط أو AI، ثم يتحقق نموذج MoE من كل مرشح مكتمل.",
    original: "الأصل",
    revision: "النسخة",
    aiRevision: "تحسين مُنشأ بواسطة AI",
    controlledRevision: "تحسين مضبوط",
    score: "التوقع",
    changed: "التغيير المنفذ",
    modelRecommendation: "توصية قائمة على النموذج",
    modelReason: "لماذا أوصى النموذج بذلك",
    modelValidation: "تحقق النموذج",
    measuredChange: "التغيير المقاس",
    directionalChange: "إشارة النموذج الاتجاهية: {value} نقطة داخل نطاق المعايرة نفسه",
    percentagePoints: "{value} نقطة مئوية",
    bestOf: "الأفضل من {count} صور مختبرة · الهدف {target} نقطة",
    better: "بلغت أفضل صورة جرى اختبارها هدف التحسن المعتبر.",
    notBetter: "لم تبلغ أي صورة جرى اختبارها هدف التحسن المعتبر. احتفظ بالأصل أو اختبر اتجاهًا آخر.",
    keep: "الاحتفاظ بالأصل",
    apply: "استخدام النسخة",
    retry: "تجربة تغيير آخر",
    privacy: "لا يتم نشر أي شيء تلقائيًا.",
  },
} as const;

export default function ModelGuidedImageEditorScreen({ route, navigation }: Props) {
  const { language, rtl } = useI18n();
  const { draft, result } = route.params;
  const c = copy[language];
  const visualGuidance = useMemo(
    () => (result.professional_recommendations || []).filter(
      (item) => item.category === "visual" && item.model_directed
    ),
    [result.professional_recommendations]
  );
  const options = useMemo(
    () => (result.image_improvement_suggestions || [])
      .filter(isActionable)
      .map((requestValue) => ({
        requestValue,
        // Professional recommendations may be globally re-ranked. Match by
        // the executable action itself rather than by array position so the
        // direction shown to the user is exactly the direction sent.
        guidance: visualGuidance.find(
          (item) => normalizeDirection(item.action) === normalizeDirection(requestValue)
        ),
      }))
      .slice(0, 3),
    [result.image_improvement_suggestions, visualGuidance]
  );
  const [selected, setSelected] = useState(options[0]?.requestValue || "");
  const [editing, setEditing] = useState(false);
  const [waitIndex, setWaitIndex] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [editResult, setEditResult] = useState<ModelGuidedImageEditResponse | null>(null);

  useEffect(() => {
    if (!editing) {
      setWaitIndex(0);
      return;
    }
    const timer = setInterval(() => setWaitIndex((value) => Math.min(value + 1, c.wait.length - 1)), 24000);
    return () => clearInterval(timer);
  }, [c.wait.length, editing]);

  async function createRevision() {
    if (!selected) return;
    setError(null);
    setEditResult(null);
    setEditing(true);
    try {
      setEditResult(await requestModelGuidedImageEdit(draft, [selected], "medium"));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason : new ApiError("The image could not be improved.", "server", "AI_EDIT_FAILED"));
    } finally {
      setEditing(false);
    }
  }

  async function useRevision() {
    if (!editResult?.accepted_for_display) return;
    const fileUri = `${FileSystem.cacheDirectory}engagevision-revision-${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(fileUri, editResult.edited_image_base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    navigation.navigate("AnalysisLoading", { draft: { ...draft, imageUri: fileUri } });
  }

  const step: 1 | 2 | 3 = editing ? 2 : editResult ? 3 : 1;
  const editedUri = editResult
    ? `data:${editResult.edited_image_mime};base64,${editResult.edited_image_base64}`
    : null;
  const selectedGuidance = options.find((option) => option.requestValue === selected)?.guidance;
  const localizedSelectedGuidance = selectedGuidance
    ? localizeRecommendation(selectedGuidance, language)
    : null;
  const appliedGuidance = editResult
    ? options.find((option) => option.requestValue === editResult.applied_recommendations[0])?.guidance
    : undefined;
  const localizedAppliedGuidance = appliedGuidance
    ? localizeRecommendation(appliedGuidance, language)
    : localizedSelectedGuidance;

  return (
    <View style={[styles.root, rtl && styles.rtl]}>
      <AmbientBackdrop />
      <StudioTopBar navigation={navigation} title={c.title} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThreeStepProgress active={step} labels={c.steps} />

        {editing && (
          <View style={styles.waitCard}>
            <View style={styles.waitImageWrap}>
              <Image source={{ uri: draft.imageUri }} style={styles.waitImage} />
              <View style={styles.waitShade} />
              <View style={styles.waitOrb}><Text style={styles.waitOrbText}>✦</Text></View>
            </View>
            <Text style={[styles.waitTitle, rtl && styles.textRtl]}>{c.waitTitle}</Text>
            <Text style={[styles.waitStage, rtl && styles.textRtl]}>{c.wait[waitIndex]}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${25 + waitIndex * 23}%` as `${number}%` }]} />
            </View>
            <Text style={[styles.waitNote, rtl && styles.textRtl]}>{c.waitNote}</Text>
          </View>
        )}

        {!editing && !editResult && (
          <>
            <View style={styles.hero}>
              <Image source={{ uri: draft.imageUri }} style={styles.heroImage} />
              <View style={styles.heroShade} />
              <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>FOCUSED EDIT</Text></View>
            </View>
            <View style={styles.choiceCard}>
              <Text style={[styles.choiceTitle, rtl && styles.textRtl]}>{c.choose}</Text>
              <Text style={[styles.choiceBody, rtl && styles.textRtl]}>{c.chooseBody}</Text>
              {options.map(({ requestValue, guidance }, index) => {
                const active = selected === requestValue;
                const localized = guidance ? localizeRecommendation(guidance, language) : null;
                return (
                  <TouchableOpacity
                    key={`${requestValue}-${index}`}
                    style={[styles.option, rtl && styles.rowReverse, active && styles.optionActive]}
                    onPress={() => setSelected(requestValue)}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      <Text style={styles.radioText}>{active ? "✓" : index + 1}</Text>
                    </View>
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionTitle, rtl && styles.textRtl]}>{localized?.title || c.defaultTitle}</Text>
                      <Text style={[styles.optionBody, rtl && styles.textRtl]}>{localized?.action || requestValue}</Text>
                      <Text style={[styles.optionMeta, rtl && styles.textRtl]}>{c.controlled}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {error && <ErrorCard message={localizedApiError(error.code, language, error.message)} />}
              <TouchableOpacity style={[styles.createButton, !selected && styles.disabled]} onPress={createRevision} disabled={!selected}>
                <Text style={styles.createText}>{c.create}</Text>
                <Text style={styles.createArrow}>{rtl ? "←" : "→"}</Text>
              </TouchableOpacity>
              <Text style={[styles.privacy, rtl && styles.textRtl]}>{c.privacy}</Text>
            </View>
          </>
        )}

        {!editing && editResult && (
          <>
            {editResult.accepted_for_display && editedUri && (
              <View style={[styles.compareRow, rtl && styles.rowReverse]}>
                <ImageResultPanel label={c.original} uri={draft.imageUri} scoreLabel={c.score} score={editResult.before_probability} />
                <ImageResultPanel
                  label={editResult.generation_source === "openai" ? c.aiRevision : c.controlledRevision}
                  uri={editedUri}
                  scoreLabel={c.score}
                  score={editResult.after_probability}
                  active
                />
              </View>
            )}
            <View style={[styles.resultCard, editResult.improved_according_to_model ? styles.resultPositive : styles.resultNeutral]}>
              <Text style={[styles.changeLabel, rtl && styles.textRtl]}>{c.modelRecommendation}</Text>
              <Text style={[styles.changeText, rtl && styles.textRtl]}>
                {localizedAppliedGuidance?.title || c.defaultTitle}
              </Text>
              <Text style={[styles.changeText, rtl && styles.textRtl]}>
                {c.modelReason}: {localizedAppliedGuidance?.evidence || c.controlled}
              </Text>
              <Text style={[styles.changeLabel, rtl && styles.textRtl]}>{c.modelValidation}</Text>
              <Text style={[styles.resultTitle, rtl && styles.textRtl]}>
                {editResult.improved_according_to_model ? c.better : c.notBetter}
              </Text>
              {editResult.accepted_for_display && <>
                <View style={[styles.deltaRow, rtl && styles.rowReverse]}>
                <View style={styles.deltaCopy}>
                  <Text style={[styles.deltaLabel, rtl && styles.textRtl]}>{c.measuredChange}</Text>
                  <Text style={[styles.deltaMeta, rtl && styles.textRtl]}>
                    {c.bestOf
                      .replace("{count}", String(editResult.candidates_evaluated))
                      .replace("{target}", formatPointDelta(editResult.meaningful_delta_target))}
                  </Text>
                </View>
              <Text style={[styles.deltaValue, editResult.probability_delta > 0 && styles.deltaValuePositive]}>
                  {c.percentagePoints.replace("{value}", formatPointDelta(editResult.probability_delta))}
                </Text>
                </View>
              {editResult.calibration_band_unchanged && Math.abs(editResult.model_score_delta) >= 0.0005 && (
                <Text style={[styles.directionalNote, rtl && styles.textRtl]}>
                  {c.directionalChange.replace("{value}", formatPointDelta(editResult.model_score_delta))}
                </Text>
              )}
                <Text style={[styles.changeLabel, rtl && styles.textRtl]}>{c.changed}</Text>
                <Text style={[styles.changeText, rtl && styles.textRtl]}>
                  {localizedAppliedGuidance?.action || editResult.applied_recommendations[0]}
                </Text>
              </>}
            </View>
            <View style={[styles.decisionRow, rtl && styles.rowReverse]}>
              <TouchableOpacity style={styles.keepButton} onPress={() => navigation.goBack()}>
                <Text style={styles.keepText}>{c.keep}</Text>
              </TouchableOpacity>
              {editResult.accepted_for_display && (
                <TouchableOpacity style={styles.applyButton} onPress={useRevision}>
                  <Text style={styles.applyText}>{c.apply}</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setEditResult(null);
                setError(null);
              }}
            >
              <Text style={styles.retryText}>↻ {c.retry}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ImageResultPanel({
  label,
  uri,
  scoreLabel,
  score,
  active,
}: {
  label: string;
  uri: string;
  scoreLabel: string;
  score: number;
  active?: boolean;
}) {
  return (
    <View style={[styles.imagePanel, active && styles.imagePanelActive]}>
      <Text style={[styles.imagePanelLabel, active && styles.imagePanelLabelActive]}>{label}</Text>
      <Image source={{ uri }} style={styles.compareImage} />
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>{scoreLabel}</Text>
        <View style={[styles.scoreRing, active && styles.scoreRingActive]}>
          <Text style={styles.score}>{formatPercent(score)}</Text>
        </View>
      </View>
    </View>
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPointDelta(value: number): string {
  const points = value * 100;
  return `${points > 0 ? "+" : ""}${points.toFixed(1)}`;
}

function isActionable(value: string): boolean {
  const normalized = value.toLowerCase();
  return !normalized.includes("keep the original image")
    && !normalized.includes("no model-guided image edit")
    && !normalized.includes("no specific image issues");
}

function normalizeDirection(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rtl: { direction: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { height: 230, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.primaryBorder, ...shadows.card },
  heroImage: { width: "100%", height: "100%", resizeMode: "cover" },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,7,10,0.24)" },
  heroBadge: { position: "absolute", top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: "rgba(7,12,17,0.86)", borderWidth: 1, borderColor: colors.primaryBorder },
  heroBadgeText: { color: colors.primary, fontSize: 7.5, fontWeight: "900", letterSpacing: 1.2 },
  choiceCard: { marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card },
  choiceTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  choiceBody: { color: colors.textMuted, fontSize: 10.5, lineHeight: 16, marginTop: 6, marginBottom: spacing.md },
  option: { flexDirection: "row", alignItems: "flex-start", padding: spacing.md, marginTop: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.input },
  optionActive: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  radio: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  radioActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  radioText: { color: "#18120B", fontSize: 10, fontWeight: "900" },
  optionCopy: { flex: 1 },
  optionTitle: { color: colors.text, fontSize: 12.5, fontWeight: "900" },
  optionBody: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  optionMeta: { color: colors.primary, fontSize: 8, fontWeight: "800", marginTop: 7 },
  createButton: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radius.lg, backgroundColor: colors.primary, marginTop: spacing.lg, ...shadows.glow },
  disabled: { opacity: 0.42 },
  createText: { color: "#18120B", fontSize: 13, fontWeight: "900" },
  createArrow: { color: "#18120B", fontSize: 17, marginLeft: spacing.md },
  privacy: { color: colors.textFaint, fontSize: 8.5, textAlign: "center", marginTop: spacing.sm },
  waitCard: { alignItems: "center", padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.card },
  waitImageWrap: { width: "100%", height: 230, borderRadius: radius.md, overflow: "hidden" },
  waitImage: { width: "100%", height: "100%" },
  waitShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(7,10,14,0.58)" },
  waitOrb: { position: "absolute", left: "50%", top: "50%", marginLeft: -32, marginTop: -32, width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(232,197,143,0.20)", borderWidth: 2, borderColor: colors.primary },
  waitOrbText: { color: colors.primary, fontSize: 24 },
  waitTitle: { color: colors.text, fontSize: 17, fontWeight: "900", marginTop: spacing.lg },
  waitStage: { color: colors.primary, fontSize: 11, fontWeight: "800", marginTop: spacing.sm },
  progressTrack: { width: "100%", height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", marginTop: spacing.lg, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  waitNote: { color: colors.textMuted, fontSize: 9.5, lineHeight: 14, textAlign: "center", marginTop: spacing.md },
  compareRow: { flexDirection: "row", gap: spacing.sm },
  imagePanel: { flex: 1, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card },
  imagePanelActive: { borderColor: colors.coral },
  imagePanelLabel: { color: colors.text, fontSize: 11, fontWeight: "900", marginBottom: spacing.sm },
  imagePanelLabelActive: { color: colors.coral },
  compareImage: { width: "100%", height: 205, borderRadius: 10 },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  scoreLabel: { color: colors.textFaint, fontSize: 8 },
  scoreRing: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: colors.cyan },
  scoreRingActive: { borderColor: colors.coral },
  score: { color: colors.text, fontSize: 11, fontWeight: "900" },
  resultCard: { marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  resultPositive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
  resultNeutral: { backgroundColor: colors.amberSoft, borderColor: colors.amberBorder },
  resultTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
  deltaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  deltaCopy: { flex: 1, paddingRight: spacing.sm },
  deltaLabel: { color: colors.textFaint, fontSize: 8.5, fontWeight: "800" },
  deltaMeta: { color: colors.textFaint, fontSize: 8, lineHeight: 12, marginTop: 3 },
  deltaValue: { color: colors.text, fontSize: 10.5, fontWeight: "900" },
  deltaValuePositive: { color: colors.green },
  directionalNote: { color: colors.primary, fontSize: 8.5, lineHeight: 13, marginTop: spacing.sm },
  changeLabel: { color: colors.textFaint, fontSize: 8.5, fontWeight: "800", marginTop: spacing.md },
  changeText: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  decisionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  keepButton: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primaryBorder },
  keepText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  applyButton: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: radius.lg, backgroundColor: colors.primary },
  applyText: { color: "#18120B", fontSize: 11, fontWeight: "900" },
  retryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  retryText: { color: colors.primary, fontSize: 10.5, fontWeight: "800" },
});
