import React, { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../App";
import AmbientBackdrop from "../components/AmbientBackdrop";
import { BottomDock, StudioTopBar } from "../components/StudioChrome";
import { useEngageStore } from "../context/EngageStore";
import { localizeRecommendation, useI18n } from "../i18n/I18nProvider";
import { colors, gradients, radius, shadows, spacing } from "../theme/theme";
import { ProfessionalRecommendation } from "../types/prediction";

type Props = NativeStackScreenProps<RootStackParamList, "Results">;

const copy = {
  en: {
    title: "Engagement outlook",
    prediction: "Prediction",
    high: "High",
    low: "Low",
    confidence: "outlook",
    image: "Image signals",
    text: "Text signals",
    available: "{value} checked",
    fusion: "Combined outlook",
    evidence: "Model-based recommendations",
    evidenceHint: "The recommendation engine chose these directions; AI has not selected them",
    imageEvidence: "Image recommendations",
    textEvidence: "Text recommendations",
    controlled: "Model-directed test",
    uncertainty: "High means a stronger chance of exceeding the account-normalized expectation — not guaranteed reach or virality. Compare revisions before choosing one.",
    refine: "Improve this post",
    actual: "Add actual results",
    historyReady: "Your account history also informed this outlook.",
    historyBuilding: "Add real results after publishing to build your account history.",
    points: "{value} pt measured effect",
    noImageEvidence: "The model did not identify a positive visual direction. Open Improve only to run a controlled model-directed test.",
    noTextEvidence: "The model did not identify a text change to send to AI for this post.",
    schedule: "Planned schedule",
  },
  he: {
    title: "תחזית מעורבות",
    prediction: "תחזית",
    high: "גבוהה",
    low: "נמוכה",
    confidence: "תחזית",
    image: "אותות מהתמונה",
    text: "אותות מהכיתוב",
    available: "{value} נבדקו",
    fusion: "תחזית משולבת",
    evidence: "המלצות מבוססות מודל",
    evidenceHint: "מנוע ההמלצות בחר את הכיוונים; ה־AI לא קבע אותם",
    imageEvidence: "המלצות לתמונה",
    textEvidence: "המלצות לטקסט",
    controlled: "בדיקה בהכוונת המודל",
    uncertainty: "תחזית גבוהה פירושה סיכוי חזק יותר לעבור את הציפייה המנורמלת לחשבון — לא הבטחה לחשיפה או לוויראליות. מומלץ להשוות גרסאות.",
    refine: "שיפור הפוסט",
    actual: "הוספת תוצאה בפועל",
    historyReady: "גם היסטוריית החשבון שלך תרמה לתחזית האישית.",
    historyBuilding: "לאחר הפרסום הוסיפו תוצאות אמיתיות כדי לבנות היסטוריית חשבון.",
    points: "השפעה נמדדת: {value} נק׳",
    noImageEvidence: "המודל לא זיהה כיוון חזותי חיובי. ניתן לפתוח שיפור רק כדי להריץ בדיקה מבוקרת בהכוונת המודל.",
    noTextEvidence: "המודל לא זיהה שינוי טקסטואלי שיש להעביר ל־AI עבור הפוסט הזה.",
    schedule: "מועד מתוכנן",
  },
  ar: {
    title: "توقع التفاعل",
    prediction: "التوقع",
    high: "مرتفع",
    low: "منخفض",
    confidence: "توقع",
    image: "إشارات الصورة",
    text: "إشارات النص",
    available: "تم فحص {value}",
    fusion: "التوقع المدمج",
    evidence: "توصيات مبنية على النموذج",
    evidenceHint: "اختار محرك التوصيات هذه الاتجاهات؛ لم يحددها الذكاء الاصطناعي",
    imageEvidence: "توصيات الصورة",
    textEvidence: "توصيات النص",
    controlled: "اختبار موجّه بالنموذج",
    uncertainty: "التوقع المرتفع يعني فرصة أقوى لتجاوز التوقع المعياري للحساب، وليس ضمانًا للانتشار. قارن النسخ قبل الاختيار.",
    refine: "تحسين المنشور",
    actual: "إضافة النتيجة الفعلية",
    historyReady: "ساهم سجل حسابك أيضًا في التوقع الشخصي.",
    historyBuilding: "أضف النتائج الفعلية بعد النشر لبناء سجل حسابك.",
    points: "أثر مقاس: {value} نقطة",
    noImageEvidence: "لم يحدد النموذج اتجاهًا بصريًا إيجابيًا. افتح التحسين فقط لإجراء اختبار مضبوط موجّه بالنموذج.",
    noTextEvidence: "لم يحدد النموذج تغييرًا نصيًا لإرساله إلى الذكاء الاصطناعي لهذا المنشور.",
    schedule: "الموعد المخطط",
  },
} as const;

export default function ResultsScreen({ route, navigation }: Props) {
  const { language, rtl } = useI18n();
  const { draft, result, historyId } = route.params;
  const { personalizedOutlook } = useEngageStore();
  const c = copy[language];
  const [evidenceTab, setEvidenceTab] = useState<"image" | "text">("image");
  const personal = personalizedOutlook(result.calibrated_probability, draft.postType);
  const probability = personal.probability;
  // Keep the research classifier label tied to the frozen model decision.
  // Personal history is a separate outlook layer and must not be compared to
  // a threshold that was calibrated for the base model probability.
  const high = String(result.predicted_label).startsWith("High");
  const recommendations = (result.professional_recommendations || []).filter(
    (item) => item.model_directed
  );
  const imageEvidence = recommendations.filter((item) => item.category === "visual");
  const textEvidence = recommendations.filter((item) =>
    ["caption", "message", "tags", "timing"].includes(item.category)
  );
  const visibleEvidence = (evidenceTab === "image" ? imageEvidence : textEvidence).slice(0, 4);
  const benchmarkSignals = result.historical_benchmark?.signals || [];
  const visualCount = benchmarkSignals.filter((item) =>
    ["brightness", "colorfulness", "text_image_alignment"].includes(item.id)
  ).length;
  const textCount = benchmarkSignals.filter((item) =>
    ["caption_length", "emotion_strength", "hashtag_count", "text_image_alignment"].includes(item.id)
  ).length;

  return (
    <View style={[styles.root, rtl && styles.rtl]}>
      <AmbientBackdrop />
      <StudioTopBar navigation={navigation} title={c.title} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.fusionCard}>
          <View style={[styles.predictionRow, rtl && styles.rowReverse]}>
            <View style={styles.predictionCopy}>
              <Text style={[styles.miniLabel, rtl && styles.textRtl]}>{c.prediction}</Text>
              <Text style={[styles.prediction, { color: high ? colors.cyan : colors.coral }, rtl && styles.textRtl]}>
                {high ? c.high : c.low}
              </Text>
              <Text style={[styles.calibrated, rtl && styles.textRtl]}>{c.fusion}</Text>
            </View>
            <ScoreRing value={probability} label={c.confidence} color={high ? colors.cyan : colors.coral} />
          </View>

          <View style={[styles.signalRow, rtl && styles.rowReverse]}>
            <SignalCard
              icon="▣"
              label={c.image}
              value={c.available.replace("{value}", String(Math.max(visualCount, result.image_improvement_suggestions?.length || 0)))}
              color={colors.blue}
            />
            <SignalCard
              icon="T"
              label={c.text}
              value={c.available.replace("{value}", String(Math.max(textCount, result.caption_improvement_suggestions?.length || 0)))}
              color={colors.coral}
            />
          </View>

          <View style={styles.fusionGraphic}>
            <LinearGradient colors={["rgba(75,168,255,0.85)", "rgba(75,168,255,0.04)"]} style={[styles.signalStream, styles.leftStream]} />
            <View style={styles.fusionCore}>
              <View style={styles.coreGlow} />
              <Text style={styles.coreMark}>✦</Text>
            </View>
            <LinearGradient colors={["rgba(255,128,107,0.04)", "rgba(255,128,107,0.85)"]} style={[styles.signalStream, styles.rightStream]} />
          </View>
          <Text style={styles.fusedLabel}>{c.fusion}</Text>
          <Text style={[styles.fusedResult, { color: high ? colors.cyan : colors.coral }]}>{high ? c.high : c.low}</Text>
        </View>

        <View style={styles.modelStrip}>
          <View style={styles.modelStripItem}>
            <Text style={[styles.modelStripLabel, rtl && styles.textRtl]}>{c.schedule}</Text>
            <Text style={styles.modelStripValue}>{result.planned_date} · {String(result.planned_hour).padStart(2, "0")}:00</Text>
            <Text style={styles.modelStripMeta}>{result.day_of_week}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={[styles.sectionHeader, rtl && styles.rowReverse]}>
            <View>
              <Text style={[styles.sectionTitle, rtl && styles.textRtl]}>{c.evidence}</Text>
              <Text style={[styles.sectionHint, rtl && styles.textRtl]}>{c.evidenceHint}</Text>
            </View>
            <View style={styles.infoDot}><Text style={styles.infoDotText}>i</Text></View>
          </View>
          <View style={[styles.evidenceTabs, rtl && styles.rowReverse]}>
            <TouchableOpacity
              style={[styles.evidenceTab, evidenceTab === "image" && styles.imageTabActive]}
              onPress={() => setEvidenceTab("image")}
            >
              <Text style={[styles.evidenceTabIcon, { color: colors.blue }]}>▣</Text>
              <Text style={[styles.evidenceTabText, evidenceTab === "image" && { color: colors.blue }]}>
                {c.imageEvidence}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.evidenceTab, evidenceTab === "text" && styles.textTabActive]}
              onPress={() => setEvidenceTab("text")}
            >
              <Text style={[styles.evidenceTabIcon, { color: colors.coral }]}>T</Text>
              <Text style={[styles.evidenceTabText, evidenceTab === "text" && { color: colors.coral }]}>
                {c.textEvidence}
              </Text>
            </TouchableOpacity>
          </View>
          {visibleEvidence.length ? visibleEvidence.map((item, index) => (
            <EvidenceRow key={item.id || String(index)} item={item} index={index} />
          )) : (
            <Text style={[styles.emptyEvidence, rtl && styles.textRtl]}>
              {evidenceTab === "image" ? c.noImageEvidence : c.noTextEvidence}
            </Text>
          )}
        </View>

        <View style={[styles.historyStrip, rtl && styles.rowReverse]}>
          <View style={styles.historyIcon}><Text style={styles.historyIconText}>◷</Text></View>
          <Text style={[styles.historyText, rtl && styles.textRtl]}>
            {personal.applied ? c.historyReady : c.historyBuilding}
          </Text>
        </View>

        <View style={[styles.note, rtl && styles.rowReverse]}>
          <Text style={styles.noteIcon}>⚖</Text>
          <Text style={[styles.noteText, rtl && styles.textRtl]}>{c.uncertainty}</Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("ImprovementStudio", { draft, result })}
        >
          <Text style={styles.primaryButtonText}>{c.refine}</Text>
          <Text style={styles.primaryArrow}>{rtl ? "←" : "→"}</Text>
        </TouchableOpacity>
        {historyId && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("LogOutcome", { historyId })}
          >
            <Text style={styles.secondaryButtonText}>＋ {c.actual}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <BottomDock navigation={navigation} active="outlook" draft={draft} result={result} historyId={historyId} />
    </View>
  );
}

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={[styles.scoreRing, { borderColor: color }]}>
      <View style={styles.scoreRingInner}>
        <Text style={styles.scoreValue}>{formatPercent(value)}</Text>
        <Text style={styles.scoreLabel}>{label}</Text>
      </View>
    </View>
  );
}

function SignalCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[styles.signalCard, { borderColor: `${color}55` }]}>
      <View style={[styles.signalIcon, { backgroundColor: `${color}1F`, borderColor: `${color}66` }]}>
        <Text style={[styles.signalIconText, { color }]}>{icon}</Text>
      </View>
      <View style={styles.signalCopy}>
        <Text style={[styles.signalLabel, { color }]}>{label}</Text>
        <Text style={styles.signalValue}>{value}</Text>
      </View>
    </View>
  );
}

function EvidenceRow({ item, index }: { item: ProfessionalRecommendation; index: number }) {
  const { language, rtl } = useI18n();
  const c = copy[language];
  const localized = localizeRecommendation(item, language);
  const visual = item.category === "visual";
  const color = visual ? colors.blue : colors.coral;
  return (
    <View style={[styles.evidenceRow, rtl && styles.rowReverse]}>
      <View style={[styles.evidenceIcon, { backgroundColor: visual ? "rgba(75,168,255,0.13)" : "rgba(255,128,107,0.13)" }]}>
        <Text style={[styles.evidenceIconText, { color }]}>{visual ? "▣" : index + 1}</Text>
      </View>
      <View style={styles.evidenceCopy}>
        <Text style={[styles.evidenceTitle, rtl && styles.textRtl]}>{localized.title}</Text>
        <Text style={[styles.evidenceAction, rtl && styles.textRtl]}>{localized.action}</Text>
      </View>
      <Text style={[styles.impact, { color }]}>
        {item.impact_points != null
          ? c.points.replace("{value}", item.impact_points.toFixed(1))
          : c.controlled}
      </Text>
    </View>
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rtl: { direction: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  fusionCard: {
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primaryBorder,
    backgroundColor: "rgba(15,20,26,0.97)", padding: spacing.lg, overflow: "hidden", ...shadows.card,
  },
  predictionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.md, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  predictionCopy: { flex: 1 },
  miniLabel: { color: colors.textMuted, fontSize: 10, marginBottom: 4 },
  prediction: { fontSize: 35, fontWeight: "900", letterSpacing: -1 },
  calibrated: { color: colors.textFaint, fontSize: 9.5, marginTop: 3 },
  scoreRing: {
    width: 92, height: 92, borderRadius: 46, borderWidth: 7,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.025)",
  },
  scoreRingInner: {
    width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  scoreValue: { color: colors.text, fontSize: 21, fontWeight: "900" },
  scoreLabel: { color: colors.textFaint, fontSize: 7.5, marginTop: 1 },
  signalRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  signalCard: {
    flex: 1, minHeight: 64, flexDirection: "row", alignItems: "center", padding: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.018)",
  },
  signalIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  signalIconText: { fontSize: 14, fontWeight: "900" },
  signalCopy: { flex: 1, marginLeft: spacing.sm },
  signalLabel: { fontSize: 9, fontWeight: "800" },
  signalValue: { color: colors.text, fontSize: 11.5, fontWeight: "800", marginTop: 4 },
  fusionGraphic: { height: 62, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  signalStream: { flex: 1, height: 16, borderRadius: 10 },
  leftStream: { transform: [{ skewY: "-4deg" }] },
  rightStream: { transform: [{ skewY: "4deg" }] },
  fusionCore: {
    width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center",
    marginHorizontal: -2, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: "#111820",
  },
  coreGlow: { position: "absolute", width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(232,197,143,0.18)" },
  coreMark: { color: colors.primary, fontSize: 21 },
  fusedLabel: { color: colors.textFaint, fontSize: 8.5, textAlign: "center" },
  fusedResult: { fontSize: 16, fontWeight: "900", textAlign: "center", marginTop: 2 },
  modelStrip: { flexDirection: "row", marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  modelStripItem: { flex: 1 },
  modelStripDivider: { width: 1, marginHorizontal: spacing.md, backgroundColor: colors.cardBorder },
  modelStripLabel: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  modelStripValue: { color: colors.text, fontSize: 10.5, fontWeight: "800", marginTop: 5 },
  modelStripMeta: { color: colors.textFaint, fontSize: 7.5, marginTop: 4 },
  sectionCard: {
    marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, ...shadows.card,
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  sectionHint: { color: colors.textFaint, fontSize: 9.5, lineHeight: 14, marginTop: 4, maxWidth: 280 },
  infoDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.cardBorder },
  infoDotText: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  evidenceTabs: {
    flexDirection: "row", marginBottom: spacing.xs, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.input, overflow: "hidden",
  },
  evidenceTab: {
    flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  imageTabActive: { backgroundColor: "rgba(75,168,255,0.09)", borderBottomColor: colors.blue },
  textTabActive: { backgroundColor: "rgba(255,128,107,0.09)", borderBottomColor: colors.coral },
  evidenceTabIcon: { fontSize: 11, fontWeight: "900" },
  evidenceTabText: { color: colors.textMuted, fontSize: 9.5, fontWeight: "800" },
  evidenceRow: {
    minHeight: 66, flexDirection: "row", alignItems: "center",
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", paddingVertical: spacing.sm,
  },
  evidenceIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  evidenceIconText: { fontSize: 12, fontWeight: "900" },
  evidenceCopy: { flex: 1 },
  evidenceTitle: { color: colors.text, fontSize: 11.5, fontWeight: "800" },
  evidenceAction: { color: colors.textMuted, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  impact: { maxWidth: 64, fontSize: 8, fontWeight: "800", textAlign: "right", marginLeft: spacing.sm },
  emptyEvidence: { color: colors.textMuted, fontSize: 11, lineHeight: 17, paddingVertical: spacing.md },
  historyStrip: {
    flexDirection: "row", alignItems: "center", marginTop: spacing.md, padding: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder,
  },
  historyIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(232,197,143,0.13)", marginRight: spacing.sm },
  historyIconText: { color: colors.primary, fontSize: 16 },
  historyText: { flex: 1, color: colors.textMuted, fontSize: 10, lineHeight: 15 },
  note: {
    flexDirection: "row", alignItems: "center", marginTop: spacing.md, padding: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: "rgba(232,197,143,0.05)",
  },
  noteIcon: { color: colors.primary, fontSize: 18, marginRight: spacing.md },
  noteText: { flex: 1, color: colors.textMuted, fontSize: 9.5, lineHeight: 14 },
  primaryButton: {
    minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.lg,
    borderRadius: radius.lg, backgroundColor: colors.primary, ...shadows.glow,
  },
  primaryButtonText: { color: "#18120B", fontSize: 14, fontWeight: "900" },
  primaryArrow: { color: "#18120B", fontSize: 18, marginLeft: spacing.md },
  secondaryButton: {
    minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: spacing.sm,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primaryBorder,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
});
