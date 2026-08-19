import React, { useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../App";
import { ApiError, requestProfessionalCaptionRevision } from "../api/client";
import AmbientBackdrop from "../components/AmbientBackdrop";
import { ErrorCard } from "../components/StatusCards";
import { BottomDock, StudioTopBar, ThreeStepProgress } from "../components/StudioChrome";
import { localizeRecommendation, localizedApiError, useI18n } from "../i18n/I18nProvider";
import { colors, radius, shadows, spacing } from "../theme/theme";
import { CaptionRevisionResponse, ProfessionalRecommendation } from "../types/prediction";

type Props = NativeStackScreenProps<RootStackParamList, "ImprovementStudio">;

const copy = {
  en: {
    title: "Improvement experiment",
    steps: ["Model direction", "AI generation", "Model validation"] as [string, string, string],
    focus: "Focus for this experiment",
    focusCaption: "Caption revision",
    focusCaptionBody: "AI executes only the structured model direction shown for this post.",
    focusImage: "Visual revision",
    focusImageBody: "Open the model-directed visual experiment.",
    choose: "Choose one focused change",
    chooseBody: "Change one part, evaluate the completed revision, and keep it only when the result is stronger.",
    createCaption: "Improve caption",
    createImage: "Improve image",
    workingTitle: "Generating from the model direction",
    workingBody: "AI writes only from the structured model recommendation. The MoE then scores every candidate; rejected candidates are not shown as improvements.",
    original: "Original",
    revision: "AI-generated improvement",
    assisted: "Model-validated",
    score: "Outlook",
    changed: "What changed",
    measuredChange: "Measured change",
    directionalChange: "Directional model signal: {value} points inside the same calibrated band",
    percentagePoints: "{value} percentage points",
    bestOf: "Best of {count} tested captions · target {target} points",
    better: "The best tested caption reached the meaningful improvement target.",
    notBetter: "No tested caption reached the meaningful improvement target. Keep the original or try a different direction.",
    keep: "Keep original",
    apply: "Apply revision",
    tryAgain: "Try another revision",
    why: "Model-based recommendation",
    reason: "Why the model recommended this",
    more: "Other model-based directions",
    modelValidation: "Model validation",
    noModelCaption: "No model-based caption direction was identified, so AI generation is not started.",
    fallbackChange1: "Clarified the visible subject and strengthened the opening.",
    fallbackChange2: "Executed the structured model direction without adding a new optimization claim.",
  },
  he: {
    title: "ניסוי שיפור",
    steps: ["כיוון מהמודל", "יצירת AI", "אימות המודל"] as [string, string, string],
    focus: "המיקוד לניסוי הזה",
    focusCaption: "גרסת כיתוב",
    focusCaptionBody: "ה־AI מבצע רק את כיוון המודל המובנה שמוצג עבור הפוסט.",
    focusImage: "גרסה חזותית",
    focusImageBody: "פתיחת ניסוי חזותי בהכוונת המודל.",
    choose: "בחרו שינוי ממוקד אחד",
    chooseBody: "משנים חלק אחד, מעריכים את הגרסה המלאה ושומרים אותה רק אם התוצאה חזקה יותר.",
    createCaption: "שיפור הכיתוב",
    createImage: "שיפור התמונה",
    workingTitle: "יוצרים לפי כיוון המודל",
    workingBody: "ה־AI מנסח רק לפי ההמלצה המובנית. לאחר מכן ה־MoE בודק כל מועמד; מועמד שנדחה אינו מוצג כשיפור.",
    original: "מקור",
    revision: "שיפור שנוצר באמצעות AI",
    assisted: "אומת על ידי המודל",
    score: "תחזית",
    changed: "מה השתנה",
    measuredChange: "שינוי נמדד",
    directionalChange: "אות כיוון פנימי של המודל: {value} נק׳ בתוך אותה מדרגת כיול",
    percentagePoints: "{value} נקודות אחוז",
    bestOf: "הטוב מתוך {count} כיתובים שנבדקו · יעד {target} נק׳",
    better: "הכיתוב הטוב ביותר שנבדק הגיע ליעד השיפור המשמעותי.",
    notBetter: "אף כיתוב שנבדק לא הגיע ליעד השיפור המשמעותי. מומלץ לשמור את המקור או לנסות כיוון אחר.",
    keep: "שמירת המקור",
    apply: "שימוש בגרסה",
    tryAgain: "יצירת גרסה נוספת",
    why: "המלצה מבוססת מודל",
    reason: "מדוע המודל המליץ על כך",
    more: "כיוונים נוספים מבוססי מודל",
    modelValidation: "אימות המודל",
    noModelCaption: "לא זוהה כיוון כיתוב מבוסס מודל, ולכן יצירת AI אינה מתחילה.",
    fallbackChange1: "נושא התמונה הובהר והפתיחה חוזקה.",
    fallbackChange2: "ההמלצה המובנית של המודל בוצעה בלי להוסיף טענת אופטימיזציה חדשה.",
  },
  ar: {
    title: "تجربة تحسين",
    steps: ["اتجاه النموذج", "إنشاء AI", "تحقق النموذج"] as [string, string, string],
    focus: "تركيز هذه التجربة",
    focusCaption: "نسخة نصية",
    focusCaptionBody: "ينفذ AI فقط اتجاه النموذج المنظم المعروض لهذا المنشور.",
    focusImage: "نسخة بصرية",
    focusImageBody: "فتح تجربة بصرية موجّهة بالنموذج.",
    choose: "اختر تغييرًا واحدًا",
    chooseBody: "غيّر جزءًا واحدًا وقيّم النسخة المكتملة واحتفظ بها فقط إن كانت أقوى.",
    createCaption: "تحسين النص",
    createImage: "تحسين الصورة",
    workingTitle: "ننشئ وفق اتجاه النموذج",
    workingBody: "يصوغ AI النص فقط وفق التوصية المنظمة، ثم يعيد نموذج MoE تقييم كل مرشح؛ ولا يُعرض المرشح المرفوض كتحسين.",
    original: "الأصل",
    revision: "تحسين مُنشأ بواسطة AI",
    assisted: "تحقق منه النموذج",
    score: "التوقع",
    changed: "ما الذي تغير",
    measuredChange: "التغيير المقاس",
    directionalChange: "إشارة النموذج الاتجاهية: {value} نقطة داخل نطاق المعايرة نفسه",
    percentagePoints: "{value} نقطة مئوية",
    bestOf: "الأفضل من {count} نصوص مختبرة · الهدف {target} نقطة",
    better: "بلغ أفضل نص جرى اختباره هدف التحسن المعتبر.",
    notBetter: "لم يبلغ أي نص جرى اختباره هدف التحسن المعتبر. احتفظ بالأصل أو جرّب اتجاهًا آخر.",
    keep: "الاحتفاظ بالأصل",
    apply: "استخدام النسخة",
    tryAgain: "إنشاء نسخة أخرى",
    why: "توصية قائمة على النموذج",
    reason: "لماذا أوصى النموذج بذلك",
    more: "اتجاهات أخرى قائمة على النموذج",
    modelValidation: "تحقق النموذج",
    noModelCaption: "لم يُحدَّد اتجاه نصي قائم على النموذج، لذلك لن يبدأ إنشاء AI.",
    fallbackChange1: "وُضّح موضوع الصورة وقُوّيت بداية النص.",
    fallbackChange2: "نُفذت توصية النموذج المنظمة من دون إضافة ادعاء تحسين جديد.",
  },
} as const;

export default function ImprovementStudioScreen({ route, navigation }: Props) {
  const { language, rtl } = useI18n();
  const { draft, result } = route.params;
  const c = copy[language];
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [revision, setRevision] = useState<CaptionRevisionResponse | null>(null);
  const recommendations = result.professional_recommendations || [];
  const modelRecommendations = recommendations.filter((item) => item.model_directed);
  const captionFocus = useMemo(
    () => modelRecommendations.find((item) => ["caption", "message", "tags"].includes(item.category)),
    [modelRecommendations]
  );
  const visualAvailable = result.image_editor_available && Boolean(draft.imageUri);
  const step: 1 | 2 | 3 = improving ? 2 : revision ? 3 : 1;
  const visibleChanges = revision?.accepted_for_display
    ? localizedChangeSummary(revision.change_summary, language, [c.fallbackChange1, c.fallbackChange2])
    : [];

  async function createCaptionRevision() {
    setError(null);
    setRevision(null);
    setImproving(true);
    try {
      setRevision(await requestProfessionalCaptionRevision({ ...draft, language }));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason : new ApiError("The revision could not be completed.", "server", "AI_CAPTION_FAILED"));
    } finally {
      setImproving(false);
    }
  }

  function applyRevision() {
    if (!revision?.accepted_for_display) return;
    navigation.navigate("AnalysisLoading", {
      draft: { ...draft, caption: revision.improved_caption, language },
    });
  }

  return (
    <View style={[styles.root, rtl && styles.rtl]}>
      <AmbientBackdrop />
      <StudioTopBar navigation={navigation} title={c.title} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThreeStepProgress active={step} labels={c.steps} />

        {improving && (
          <View style={styles.workingCard}>
            <View style={styles.spinner}><Text style={styles.spinnerText}>✦</Text></View>
            <Text style={[styles.workingTitle, rtl && styles.textRtl]}>{c.workingTitle}</Text>
            <Text style={[styles.workingBody, rtl && styles.textRtl]}>{c.workingBody}</Text>
            <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
          </View>
        )}

        {!improving && !revision && (
          <>
            <View style={styles.focusCard}>
              <Text style={[styles.eyebrow, rtl && styles.textRtl]}>{c.why}</Text>
              <View style={[styles.focusRow, rtl && styles.rowReverse]}>
                <View style={styles.targetIcon}><Text style={styles.targetIconText}>◎</Text></View>
                <View style={styles.focusCopy}>
                  <Text style={[styles.focusTitle, rtl && styles.textRtl]}>
                    {captionFocus ? localizeRecommendation(captionFocus, language).title : c.focusCaption}
                  </Text>
                  <Text style={[styles.focusBody, rtl && styles.textRtl]}>
                    {captionFocus ? localizeRecommendation(captionFocus, language).action : c.noModelCaption}
                  </Text>
                  {captionFocus && (
                    <Text style={[styles.focusBody, rtl && styles.textRtl]}>
                      {c.reason}: {localizeRecommendation(captionFocus, language).evidence}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.choiceCard}>
              <Text style={[styles.choiceTitle, rtl && styles.textRtl]}>{c.choose}</Text>
              <Text style={[styles.choiceBody, rtl && styles.textRtl]}>{c.chooseBody}</Text>
              <ActionChoice
                icon="T"
                title={c.focusCaption}
                body={captionFocus ? localizeRecommendation(captionFocus, language).action : c.noModelCaption}
                action={c.createCaption}
                color={colors.coral}
                onPress={createCaptionRevision}
                disabled={!captionFocus || !result.caption_writer_available}
                rtl={rtl}
              />
              <ActionChoice
                icon="▣"
                title={c.focusImage}
                body={c.focusImageBody}
                action={c.createImage}
                color={colors.blue}
                onPress={() => navigation.navigate("ModelGuidedEditor", { draft, result })}
                disabled={!visualAvailable}
                rtl={rtl}
              />
              {error && <ErrorCard message={localizedApiError(error.code, language, error.message)} />}
            </View>

            {modelRecommendations.length > 1 && (
              <View style={styles.otherCard}>
                <Text style={[styles.otherTitle, rtl && styles.textRtl]}>{c.more}</Text>
                {modelRecommendations.filter((item) => item.id !== captionFocus?.id).slice(0, 3).map((item, index) => (
                  <CompactDirection key={item.id || String(index)} item={item} />
                ))}
              </View>
            )}
          </>
        )}

        {!improving && revision && (
          <>
            {captionFocus && (
              <View style={styles.focusCard}>
                <Text style={[styles.eyebrow, rtl && styles.textRtl]}>{c.why}</Text>
                <Text style={[styles.focusTitle, rtl && styles.textRtl]}>{localizeRecommendation(captionFocus, language).title}</Text>
                <Text style={[styles.focusBody, rtl && styles.textRtl]}>{localizeRecommendation(captionFocus, language).action}</Text>
                <Text style={[styles.focusBody, rtl && styles.textRtl]}>{c.reason}: {localizeRecommendation(captionFocus, language).evidence}</Text>
              </View>
            )}

            {revision.accepted_for_display && <>
              <View style={[styles.compareGrid, rtl && styles.rowReverse]}>
              <ComparePanel
                label={c.original}
                imageUri={draft.imageUri}
                caption={draft.caption}
                score={revision.before_probability}
                scoreLabel={c.score}
              />
              <ComparePanel
                label={c.revision}
                badge={c.assisted}
                imageUri={draft.imageUri}
                caption={revision.improved_caption}
                score={revision.after_probability}
                scoreLabel={c.score}
                active
              />
              </View>

              <View style={[styles.deltaCard, styles.deltaPositive, rtl && styles.rowReverse]}>
              <View style={styles.deltaCopy}>
                <Text style={[styles.deltaLabel, rtl && styles.textRtl]}>{c.measuredChange}</Text>
                <Text style={[styles.deltaMeta, rtl && styles.textRtl]}>
                  {c.bestOf
                    .replace("{count}", String(revision.candidates_evaluated))
                    .replace("{target}", formatPointDelta(revision.meaningful_delta_target))}
                </Text>
              </View>
              <Text style={[styles.deltaValue, revision.probability_delta > 0 && styles.deltaValuePositive]}>
                {c.percentagePoints.replace("{value}", formatPointDelta(revision.probability_delta))}
              </Text>
              </View>
            {revision.calibration_band_unchanged && Math.abs(revision.model_score_delta) >= 0.0005 && (
              <Text style={[styles.directionalNote, rtl && styles.textRtl]}>
                {c.directionalChange.replace("{value}", formatPointDelta(revision.model_score_delta))}
              </Text>
            )}

              <View style={styles.changeCard}>
              <Text style={[styles.changeTitle, rtl && styles.textRtl]}>{c.changed}</Text>
              {visibleChanges.map((item, index) => (
                <View key={`${item}-${index}`} style={[styles.changeRow, rtl && styles.rowReverse]}>
                  <View style={styles.changeMark}><Text style={styles.changeMarkText}>T</Text></View>
                  <Text style={[styles.changeText, rtl && styles.textRtl]}>{item}</Text>
                </View>
              ))}
              </View>
            </>}

            <View style={[styles.verdictCard, revision.improved_according_to_model ? styles.verdictPositive : styles.verdictNeutral]}>
              <Text style={[styles.eyebrow, rtl && styles.textRtl]}>{c.modelValidation}</Text>
              <Text style={[styles.verdictText, rtl && styles.textRtl]}>
                {revision.improved_according_to_model ? c.better : c.notBetter}
              </Text>
            </View>

            <View style={[styles.decisionRow, rtl && styles.rowReverse]}>
              <TouchableOpacity style={styles.keepButton} onPress={() => navigation.goBack()}>
                <Text style={styles.keepText}>{c.keep}</Text>
              </TouchableOpacity>
              {revision.accepted_for_display && (
                <TouchableOpacity style={styles.applyButton} onPress={applyRevision}>
                  <Text style={styles.applyText}>{c.apply}</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.retryButton} onPress={createCaptionRevision}>
              <Text style={styles.retryText}>↻ {c.tryAgain}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      <BottomDock navigation={navigation} active="improve" draft={draft} result={result} />
    </View>
  );
}

function ActionChoice({
  icon,
  title,
  body,
  action,
  color,
  onPress,
  disabled,
  rtl,
}: {
  icon: string;
  title: string;
  body: string;
  action: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  rtl: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionChoice, rtl && styles.rowReverse, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.actionIcon, { borderColor: `${color}66`, backgroundColor: `${color}18` }]}>
        <Text style={[styles.actionIconText, { color }]}>{icon}</Text>
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, rtl && styles.textRtl]}>{title}</Text>
        <Text style={[styles.actionBody, rtl && styles.textRtl]}>{body}</Text>
      </View>
      <View style={[styles.actionButton, { borderColor: `${color}77` }]}>
        <Text style={[styles.actionButtonText, { color }]}>{action}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ComparePanel({
  label,
  badge,
  imageUri,
  caption,
  score,
  scoreLabel,
  active,
}: {
  label: string;
  badge?: string;
  imageUri: string;
  caption: string;
  score: number;
  scoreLabel: string;
  active?: boolean;
}) {
  return (
    <View style={[styles.comparePanel, active && styles.comparePanelActive]}>
      <View style={styles.compareHeader}>
        <Text style={[styles.compareLabel, active && styles.compareLabelActive]}>{label}</Text>
        {badge && <View style={styles.assistedBadge}><Text style={styles.assistedText}>{badge}</Text></View>}
      </View>
      <Image source={{ uri: imageUri }} style={styles.compareImage} />
      <Text style={styles.compareCaption} numberOfLines={5}>{caption}</Text>
      <View style={styles.miniScoreRow}>
        <Text style={styles.miniScoreLabel}>{scoreLabel}</Text>
        <View style={[styles.miniRing, active && styles.miniRingActive]}>
          <Text style={styles.miniScore}>{formatPercent(score)}</Text>
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

function localizedChangeSummary(
  items: string[],
  language: "en" | "he" | "ar",
  fallback: readonly [string, string],
): string[] {
  if (language === "en") return items;
  const expectedScript = language === "he" ? /[\u0590-\u05FF]/ : /[\u0600-\u06FF]/;
  const localized = items.filter((item) => expectedScript.test(item));
  return localized.length >= 2 ? localized : [...fallback];
}

function CompactDirection({ item }: { item: ProfessionalRecommendation }) {
  const { language, rtl } = useI18n();
  const localized = localizeRecommendation(item, language);
  return (
    <View style={[styles.compactRow, rtl && styles.rowReverse]}>
      <Text style={styles.compactCheck}>✓</Text>
      <Text style={[styles.compactText, rtl && styles.textRtl]}>{localized.action}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rtl: { direction: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  focusCard: {
    padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.primaryBorder, backgroundColor: colors.card, ...shadows.card,
  },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.3, marginBottom: spacing.md },
  focusRow: { flexDirection: "row", alignItems: "center" },
  targetIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, marginRight: spacing.md },
  targetIconText: { color: colors.primary, fontSize: 24, fontWeight: "900" },
  focusCopy: { flex: 1 },
  focusTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  focusBody: { color: colors.textMuted, fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  choiceCard: {
    marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card,
  },
  choiceTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  choiceBody: { color: colors.textMuted, fontSize: 10.5, lineHeight: 16, marginTop: 6, marginBottom: spacing.md },
  actionChoice: {
    minHeight: 86, flexDirection: "row", alignItems: "center", padding: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder,
    backgroundColor: colors.input, marginTop: spacing.sm,
  },
  disabled: { opacity: 0.42 },
  actionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, marginRight: spacing.md },
  actionIconText: { fontSize: 15, fontWeight: "900" },
  actionCopy: { flex: 1 },
  actionTitle: { color: colors.text, fontSize: 12.5, fontWeight: "900" },
  actionBody: { color: colors.textFaint, fontSize: 9, lineHeight: 13, marginTop: 3 },
  actionButton: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, marginLeft: spacing.sm },
  actionButtonText: { fontSize: 8, fontWeight: "900" },
  workingCard: {
    alignItems: "center", padding: spacing.xxl, borderRadius: radius.lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primaryBorder,
  },
  spinner: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  spinnerText: { color: colors.primary, fontSize: 24 },
  workingTitle: { color: colors.text, fontSize: 17, fontWeight: "900", marginTop: spacing.lg },
  workingBody: { color: colors.textMuted, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: spacing.sm },
  progressTrack: { width: "100%", height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", marginTop: spacing.xl, overflow: "hidden" },
  progressFill: { width: "72%", height: 5, borderRadius: 3, backgroundColor: colors.primary },
  compareGrid: { flexDirection: "row", gap: spacing.sm },
  comparePanel: {
    flex: 1, minHeight: 330, padding: spacing.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card,
  },
  comparePanelActive: { borderColor: "rgba(255,128,107,0.45)" },
  compareHeader: { minHeight: 25, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  compareLabel: { color: colors.text, fontSize: 11, fontWeight: "900" },
  compareLabelActive: { color: colors.coral },
  assistedBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.coral },
  assistedText: { color: "#1C0E0B", fontSize: 6.5, fontWeight: "900" },
  compareImage: { width: "100%", height: 122, borderRadius: 10, marginTop: 5 },
  compareCaption: { color: colors.textMuted, fontSize: 9.5, lineHeight: 14, minHeight: 75, marginTop: spacing.sm },
  miniScoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  miniScoreLabel: { color: colors.textFaint, fontSize: 8 },
  miniRing: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: colors.cyan },
  miniRingActive: { borderColor: colors.coral },
  miniScore: { color: colors.text, fontSize: 11, fontWeight: "900" },
  deltaCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: spacing.md, paddingHorizontal: spacing.md, minHeight: 44,
    borderRadius: radius.md, borderWidth: 1,
  },
  deltaPositive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
  deltaNeutral: { backgroundColor: colors.amberSoft, borderColor: colors.amberBorder },
  deltaCopy: { flex: 1, paddingRight: spacing.sm },
  deltaLabel: { color: colors.textMuted, fontSize: 9.5, fontWeight: "800" },
  deltaMeta: { color: colors.textFaint, fontSize: 8, lineHeight: 12, marginTop: 3 },
  deltaValue: { color: colors.text, fontSize: 11, fontWeight: "900" },
  deltaValuePositive: { color: colors.green },
  directionalNote: { color: colors.primary, fontSize: 8.5, lineHeight: 13, marginTop: spacing.sm, paddingHorizontal: spacing.sm },
  changeCard: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card },
  changeTitle: { color: colors.primary, fontSize: 10, fontWeight: "900", marginBottom: spacing.sm },
  changeRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  changeMark: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.coralSoft, marginRight: spacing.sm },
  changeMarkText: { color: colors.coral, fontSize: 11, fontWeight: "900" },
  changeText: { flex: 1, color: colors.textMuted, fontSize: 9.5, lineHeight: 14 },
  verdictCard: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  verdictPositive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
  verdictNeutral: { backgroundColor: colors.amberSoft, borderColor: colors.amberBorder },
  verdictText: { color: colors.text, fontSize: 10.5, lineHeight: 16, fontWeight: "800" },
  decisionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  keepButton: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primaryBorder },
  keepText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  applyButton: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: radius.lg, backgroundColor: colors.primary },
  applyText: { color: "#18120B", fontSize: 11, fontWeight: "900" },
  retryButton: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  retryText: { color: colors.primary, fontSize: 10.5, fontWeight: "800" },
  otherCard: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  otherTitle: { color: colors.text, fontSize: 12, fontWeight: "900", marginBottom: spacing.sm },
  compactRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 7, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  compactCheck: { color: colors.green, fontSize: 11, marginRight: spacing.sm },
  compactText: { flex: 1, color: colors.textMuted, fontSize: 9.5, lineHeight: 14 },
});
