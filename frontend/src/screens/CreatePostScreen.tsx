import React, { useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../App";
import AmbientBackdrop from "../components/AmbientBackdrop";
import EditorialDirectionPicker from "../components/EditorialDirectionPicker";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { ErrorCard } from "../components/StatusCards";
import { BottomDock, StudioTopBar } from "../components/StudioChrome";
import { localizedDay, localizedPostType, useI18n } from "../i18n/I18nProvider";
import { colors, gradients, radius, shadows, spacing } from "../theme/theme";
import { CaptionGoal, CaptionTone, DraftPost, POST_TYPES } from "../types/prediction";

type Props = NativeStackScreenProps<RootStackParamList, "CreatePost">;

const NOW = new Date();
const DEFAULT_DATE = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}-${String(NOW.getDate()).padStart(2, "0")}`;
const DEFAULT_TIME = `${String(NOW.getHours()).padStart(2, "0")}:${String(NOW.getMinutes()).padStart(2, "0")}`;
const DISPLAY_POST_TYPES = ["general", ...POST_TYPES.filter((type) => type !== "general")];
const GOALS: CaptionGoal[] = ["reactions", "conversation", "awareness", "saves", "shares", "support", "inform"];
const TONES: CaptionTone[] = ["natural", "warm", "confident", "informative", "reflective"];
const copy = {
  en: {
    title: "Analyze a post",
    image: "1. Add your image",
    imageHint: "Use the exact image you plan to publish",
    choose: "Choose from gallery",
    replace: "Replace",
    remove: "Remove",
    caption: "2. Write your caption",
    placeholder: "What do you want people to understand or feel?",
    language: "3. Language",
    goal: "4. Post goal",
    goalHint: "Choose what matters most for this post",
    options: "More options",
    optionsHint: "Content type, voice and planned time",
    content: "CONTENT TYPE",
    voice: "VOICE FOR A FUTURE REVISION",
    schedule: "5. Planned publication",
    scheduleHint: "Required — the weekday is calculated automatically",
    date: "Date (YYYY-MM-DD)",
    time: "Time (HH:MM)",
    day: "Calculated weekday",
    invalidSchedule: "Enter a valid publication date and 24-hour time.",
    analyze: "Analyze",
    missing: "Add an image and caption to continue.",
  },
  he: {
    title: "ניתוח פוסט",
    image: "1. הוספת תמונה",
    imageHint: "בחרו את התמונה המדויקת שמתוכננת לפרסום",
    choose: "בחירה מהגלריה",
    replace: "החלפה",
    remove: "הסרה",
    caption: "2. כתיבת כיתוב",
    placeholder: "מה תרצו שאנשים יבינו או ירגישו?",
    language: "3. שפה",
    goal: "4. מטרת הפוסט",
    goalHint: "בחרו מה הכי חשוב בפוסט הזה",
    options: "אפשרויות נוספות",
    optionsHint: "סוג תוכן, סגנון וזמן מתוכנן",
    content: "סוג תוכן",
    voice: "סגנון לשיפור עתידי",
    schedule: "5. מועד פרסום מתוכנן",
    scheduleHint: "שדה חובה — יום השבוע מחושב אוטומטית",
    date: "תאריך (YYYY-MM-DD)",
    time: "שעה (HH:MM)",
    day: "יום מחושב",
    invalidSchedule: "יש להזין תאריך תקין ושעה בפורמט 24 שעות.",
    analyze: "ניתוח הפוסט",
    missing: "יש להוסיף תמונה וכיתוב כדי להמשיך.",
  },
  ar: {
    title: "تحليل منشور",
    image: "1. أضف الصورة",
    imageHint: "استخدم الصورة نفسها التي تنوي نشرها",
    choose: "اختيار من المعرض",
    replace: "استبدال",
    remove: "حذف",
    caption: "2. اكتب النص",
    placeholder: "ماذا تريد أن يفهم الناس أو يشعروا؟",
    language: "3. اللغة",
    goal: "4. هدف المنشور",
    goalHint: "اختر ما يهمك أكثر في هذا المنشور",
    options: "خيارات إضافية",
    optionsHint: "نوع المحتوى والنبرة ووقت النشر",
    content: "نوع المحتوى",
    voice: "نبرة التحسين لاحقًا",
    schedule: "5. موعد النشر المخطط",
    scheduleHint: "مطلوب — يُحسب يوم الأسبوع تلقائيًا",
    date: "التاريخ (YYYY-MM-DD)",
    time: "الوقت (HH:MM)",
    day: "اليوم المحسوب",
    invalidSchedule: "أدخل تاريخًا صالحًا ووقتًا بنظام 24 ساعة.",
    analyze: "تحليل المنشور",
    missing: "أضف صورة ونصًا للمتابعة.",
  },
} as const;

function deriveSchedule(dateText: string, timeText: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText.trim());
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { postHour: hour, postMonth: month, dayOfWeek: (date.getDay() + 6) % 7 };
}

export default function CreatePostScreen({ navigation }: Props) {
  const { language, rtl, t } = useI18n();
  const c = copy[language];
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [postType, setPostType] = useState("general");
  const [goal, setGoal] = useState<CaptionGoal>("conversation");
  const [tone, setTone] = useState<CaptionTone>("natural");
  const [plannedDate, setPlannedDate] = useState(DEFAULT_DATE);
  const [plannedTime, setPlannedTime] = useState(DEFAULT_TIME);
  const [showOptions, setShowOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const schedule = useMemo(() => deriveSchedule(plannedDate, plannedTime), [plannedDate, plannedTime]);

  async function pickImage() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t("create.photoPermission"));
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        quality: 0.82,
      });
      if (!result.canceled && result.assets?.length) setImageUri(result.assets[0].uri);
    } catch {
      setError(t("create.imageOpenError"));
    }
  }

  function analyze() {
    if (!imageUri || !caption.trim()) {
      setError(c.missing);
      return;
    }
    if (!schedule) {
      setError(c.invalidSchedule);
      return;
    }
    const draft: DraftPost = {
      imageUri,
      caption: caption.trim(),
      postType,
      captionGoal: goal,
      captionTone: tone,
      language,
      plannedDate: plannedDate.trim(),
      plannedTime: plannedTime.trim(),
      ...schedule,
    };
    navigation.navigate("AnalysisLoading", { draft });
  }

  return (
    <View style={[styles.root, rtl && styles.rtl]}>
      <AmbientBackdrop />
      <StudioTopBar navigation={navigation} title={c.title} menu />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FieldLabel title={c.image} hint={c.imageHint} rtl={rtl} />
          <TouchableOpacity style={styles.imageBox} onPress={pickImage} activeOpacity={0.88}>
            {imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.image} />
                <LinearGradient colors={["transparent", "rgba(5,7,10,0.84)"]} style={StyleSheet.absoluteFill} />
                <View style={[styles.imageActions, rtl && styles.rowReverse]}>
                  <View style={styles.imagePill}><Text style={styles.imagePillText}>↻ {c.replace}</Text></View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      setImageUri(null);
                    }}
                  >
                    <Text style={styles.removeText}>⌫</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.emptyImage}>
                <View style={styles.uploadIcon}><Text style={styles.uploadIconText}>＋</Text></View>
                <Text style={styles.chooseText}>{c.choose}</Text>
              </View>
            )}
          </TouchableOpacity>

          <FieldLabel title={c.caption} hint={`${caption.length}/2200`} rtl={rtl} />
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder={c.placeholder}
            placeholderTextColor={colors.textFaint}
            style={[styles.captionInput, rtl && styles.textRtl]}
            multiline
            maxLength={2200}
            textAlignVertical="top"
          />

          <FieldLabel title={c.language} rtl={rtl} />
          <LanguageSwitcher />

          <FieldLabel title={c.goal} hint={c.goalHint} rtl={rtl} />
          <EditorialDirectionPicker kind="goal" value={goal} options={GOALS} onChange={setGoal} />

          <FieldLabel title={c.schedule} hint={c.scheduleHint} rtl={rtl} />
          <View style={styles.scheduleCard}>
            <View style={[styles.scheduleInputs, rtl && styles.rowReverse]}>
              <View style={styles.scheduleField}>
                <Text style={[styles.counterLabel, rtl && styles.textRtl]}>{c.date}</Text>
                <TextInput
                  value={plannedDate}
                  onChangeText={setPlannedDate}
                  placeholder="2026-08-03"
                  placeholderTextColor={colors.textFaint}
                  style={[styles.scheduleInput, rtl && styles.textRtl]}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
              </View>
              <View style={styles.scheduleField}>
                <Text style={[styles.counterLabel, rtl && styles.textRtl]}>{c.time}</Text>
                <TextInput
                  value={plannedTime}
                  onChangeText={setPlannedTime}
                  placeholder="18:30"
                  placeholderTextColor={colors.textFaint}
                  style={[styles.scheduleInput, rtl && styles.textRtl]}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
            </View>
            <View style={[styles.derivedDay, rtl && styles.rowReverse]}>
              <Text style={styles.derivedIcon}>◷</Text>
              <Text style={[styles.derivedLabel, rtl && styles.textRtl]}>{c.day}</Text>
              <Text style={[styles.derivedValue, rtl && styles.textRtl]}>
                {schedule ? localizedDay(schedule.dayOfWeek, language, false) : "—"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.moreCard, rtl && styles.rowReverse]}
            onPress={() => setShowOptions((value) => !value)}
          >
            <View style={styles.moreIcon}><Text style={styles.moreIconText}>⚙</Text></View>
            <View style={styles.moreCopy}>
              <Text style={[styles.moreTitle, rtl && styles.textRtl]}>{c.options}</Text>
              <Text style={[styles.moreHint, rtl && styles.textRtl]}>{c.optionsHint}</Text>
            </View>
            <Text style={styles.moreChevron}>{showOptions ? "⌃" : "⌄"}</Text>
          </TouchableOpacity>

          {showOptions && (
            <View style={styles.advancedCard}>
              <Text style={[styles.miniLabel, rtl && styles.textRtl]}>{c.content}</Text>
              <View style={[styles.wrap, rtl && styles.rowReverse]}>
                {DISPLAY_POST_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setPostType(type)}
                    style={[styles.chip, postType === type && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, postType === type && styles.chipTextActive]}>
                      {localizedPostType(type, language)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.miniLabel, rtl && styles.textRtl]}>{c.voice}</Text>
              <EditorialDirectionPicker kind="tone" value={tone} options={TONES} onChange={setTone} />
            </View>
          )}

          {error && <ErrorCard message={error} />}
          <TouchableOpacity
            onPress={analyze}
            disabled={!imageUri || !caption.trim() || !schedule}
            style={[styles.analyzeButton, (!imageUri || !caption.trim() || !schedule) && styles.analyzeDisabled]}
          >
            <LinearGradient colors={gradients.primary} style={styles.analyzeGradient}>
              <Text style={styles.analyzeText}>{c.analyze}</Text>
              <Text style={styles.sparkle}>✦</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomDock navigation={navigation} active="analyze" />
    </View>
  );
}

function FieldLabel({ title, hint, rtl }: { title: string; hint?: string; rtl: boolean }) {
  return (
    <View style={[styles.labelRow, rtl && styles.rowReverse]}>
      <Text style={[styles.label, rtl && styles.textRtl]}>{title}</Text>
      {hint && <Text style={[styles.labelHint, rtl && styles.textRtl]}>{hint}</Text>}
    </View>
  );
}

function Counter({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string | number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.counter}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.counterControls}>
        <TouchableOpacity onPress={onMinus}><Text style={styles.counterButton}>−</Text></TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity onPress={onPlus}><Text style={styles.counterButton}>＋</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  rtl: { direction: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: spacing.md, marginBottom: spacing.sm },
  label: { color: colors.text, fontSize: 13, fontWeight: "800" },
  labelHint: { color: colors.textFaint, fontSize: 9.5, maxWidth: "58%" },
  imageBox: {
    height: 220, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.input,
    borderWidth: 1, borderColor: colors.primaryBorder, ...shadows.card,
  },
  image: { width: "100%", height: "100%", resizeMode: "cover" },
  emptyImage: { flex: 1, alignItems: "center", justifyContent: "center" },
  uploadIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder },
  uploadIconText: { color: colors.primary, fontSize: 24, fontWeight: "300" },
  chooseText: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: spacing.md },
  imageActions: { position: "absolute", left: 10, right: 10, bottom: 10, flexDirection: "row", justifyContent: "space-between" },
  imagePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: "rgba(5,7,10,0.82)", borderWidth: 1, borderColor: "rgba(255,255,255,0.26)" },
  imagePillText: { color: colors.text, fontSize: 10, fontWeight: "800" },
  removeButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(5,7,10,0.82)", borderWidth: 1, borderColor: "rgba(255,255,255,0.26)" },
  removeText: { color: colors.text, fontSize: 15 },
  captionInput: {
    minHeight: 126, borderRadius: radius.md, padding: spacing.md, color: colors.text,
    fontSize: 14, lineHeight: 21, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.cardBorder,
  },
  scheduleCard: {
    padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.primaryBorder, ...shadows.card,
  },
  scheduleInputs: { flexDirection: "row", gap: spacing.sm },
  scheduleField: { flex: 1 },
  scheduleInput: {
    minHeight: 46, marginTop: 6, paddingHorizontal: spacing.sm, borderRadius: radius.sm,
    color: colors.text, fontSize: 13, fontWeight: "800", backgroundColor: colors.input,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  derivedDay: {
    flexDirection: "row", alignItems: "center", marginTop: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.cardBorder,
  },
  derivedIcon: { color: colors.primary, fontSize: 16, marginRight: spacing.sm },
  derivedLabel: { flex: 1, color: colors.textMuted, fontSize: 11 },
  derivedValue: { color: colors.primary, fontSize: 12, fontWeight: "900" },
  moreCard: {
    flexDirection: "row", alignItems: "center", marginTop: spacing.lg, padding: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card,
  },
  moreIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft, marginRight: spacing.md },
  moreIconText: { color: colors.primary, fontSize: 16 },
  moreCopy: { flex: 1 },
  moreTitle: { color: colors.text, fontSize: 12.5, fontWeight: "800" },
  moreHint: { color: colors.textFaint, fontSize: 9.5, marginTop: 3 },
  moreChevron: { color: colors.primary, fontSize: 18 },
  advancedCard: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  miniLabel: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginTop: spacing.sm, marginBottom: spacing.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.input },
  chipActive: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  chipText: { color: colors.textMuted, fontSize: 10.5, fontWeight: "700" },
  chipTextActive: { color: colors.primary },
  timingRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg },
  check: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.cardBorder, marginRight: spacing.sm },
  checkActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkText: { color: "#18120B", fontSize: 11, fontWeight: "900" },
  timingText: { flex: 1, color: colors.textMuted, fontSize: 11 },
  timeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  counter: { flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.input },
  counterLabel: { color: colors.textFaint, fontSize: 9, textAlign: "center" },
  counterControls: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 },
  counterButton: { color: colors.primary, fontSize: 17, paddingHorizontal: 5 },
  counterValue: { color: colors.text, fontSize: 12, fontWeight: "800" },
  analyzeButton: { borderRadius: radius.lg, overflow: "hidden", marginTop: spacing.xl, ...shadows.glow },
  analyzeDisabled: { opacity: 0.42 },
  analyzeGradient: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  analyzeText: { color: "#18120B", fontSize: 15, fontWeight: "900" },
  sparkle: { color: "#18120B", fontSize: 16, marginLeft: spacing.md },
});
