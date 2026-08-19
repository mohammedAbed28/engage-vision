import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FirebaseError } from "firebase/app";
import { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AmbientBackdrop from "../components/AmbientBackdrop";
import GradientButton from "../components/GradientButton";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useAuth } from "../context/AuthContext";
import { firebaseAuth } from "../firebase/client";
import { useI18n } from "../i18n/I18nProvider";
import { colors, gradients, radius, shadows, spacing } from "../theme/theme";
import { AppLanguage } from "../types/prediction";

type AuthMode = "signup" | "login";
type AuthMethod = "email" | "phone";

const COUNTRY_CODES = [
  { code: "+972", flag: "🇮🇱", label: "Israel" },
  { code: "+970", flag: "🇵🇸", label: "Palestine" },
  { code: "+962", flag: "🇯🇴", label: "Jordan" },
  { code: "+971", flag: "🇦🇪", label: "UAE" },
  { code: "+966", flag: "🇸🇦", label: "Saudi Arabia" },
  { code: "+20", flag: "🇪🇬", label: "Egypt" },
  { code: "+1", flag: "🇺🇸", label: "United States" },
  { code: "+44", flag: "🇬🇧", label: "United Kingdom" },
  { code: "+49", flag: "🇩🇪", label: "Germany" },
  { code: "+33", flag: "🇫🇷", label: "France" },
] as const;

const copy: Record<AppLanguage, Record<string, string>> = {
  en: {
    eyebrow: "YOUR PRIVATE ENGAGEMENT STUDIO",
    brandLine: "Analyze privately. Improve deliberately.",
    signupTitle: "Create your EngageVision account",
    signupBody: "Save your post history securely and build a more useful personal outlook over time.",
    loginTitle: "Welcome back",
    loginBody: "Continue your private post analysis and improvement workflow.",
    signup: "Sign up",
    login: "Log in",
    email: "Email",
    phone: "Phone",
    emailMethod: "Email & password",
    phoneMethod: "Phone & SMS",
    fullName: "Full name",
    fullNamePlaceholder: "Your name",
    emailAddress: "Email address",
    emailPlaceholder: "name@example.com",
    password: "Password",
    passwordPlaceholder: "At least 8 characters",
    confirmPassword: "Confirm password",
    confirmPlaceholder: "Repeat your password",
    forgot: "Forgot password?",
    signupAction: "Create secure account",
    loginAction: "Log in securely",
    already: "Already have an account?",
    loginLink: "Log in",
    newHere: "New to EngageVision?",
    signupLink: "Sign up",
    phoneNumber: "Mobile number",
    phonePlaceholder: "50 123 4567",
    phoneHelp: "Choose your country code. Remove the first 0 from the local number.",
    smsConsent: "Firebase will send a verification SMS. Standard carrier charges may apply.",
    sendCode: "Send verification code",
    code: "6-digit verification code",
    codePlaceholder: "123456",
    verifySignup: "Verify and create account",
    verifyLogin: "Verify and log in",
    changeNumber: "Use a different number",
    sent: "A verification code was sent to {phone}.",
    resetSent: "If an account exists for this email, a reset link has been sent.",
    secure: "Firebase protected",
    private: "Private workspace",
    noPasswordStore: "Passwords and SMS codes are never stored in Firestore.",
    terms: "By continuing, you agree to use authentication only for your own account.",
    webPhoneOnly: "SMS verification in the Expo preview runs in the web build. The Android release requires the Firebase Android app configuration.",
  },
  he: {
    eyebrow: "סטודיו המעורבות הפרטי שלכם",
    brandLine: "ניתוח פרטי. שיפור מדוד.",
    signupTitle: "יצירת חשבון EngageVision",
    signupBody: "שמרו היסטוריית פוסטים בצורה מאובטחת ובנו תחזית אישית שימושית יותר לאורך זמן.",
    loginTitle: "שמחים שחזרתם",
    loginBody: "המשיכו את תהליך הניתוח והשיפור הפרטי שלכם.",
    signup: "הרשמה",
    login: "כניסה",
    email: "אימייל",
    phone: "טלפון",
    emailMethod: "אימייל וסיסמה",
    phoneMethod: "טלפון ו־SMS",
    fullName: "שם מלא",
    fullNamePlaceholder: "השם שלכם",
    emailAddress: "כתובת אימייל",
    emailPlaceholder: "name@example.com",
    password: "סיסמה",
    passwordPlaceholder: "לפחות 8 תווים",
    confirmPassword: "אימות סיסמה",
    confirmPlaceholder: "הקלידו שוב את הסיסמה",
    forgot: "שכחתם סיסמה?",
    signupAction: "יצירת חשבון מאובטח",
    loginAction: "כניסה מאובטחת",
    already: "כבר יש לכם חשבון?",
    loginLink: "כניסה",
    newHere: "עדיין אין לכם חשבון?",
    signupLink: "הרשמה",
    phoneNumber: "מספר נייד",
    phonePlaceholder: "50 123 4567",
    phoneHelp: "בחרו קידומת מדינה והסירו את ה־0 הראשון מהמספר המקומי.",
    smsConsent: "Firebase ישלח הודעת אימות. ייתכן חיוב רגיל של חברת הסלולר.",
    sendCode: "שליחת קוד אימות",
    code: "קוד אימות בן 6 ספרות",
    codePlaceholder: "123456",
    verifySignup: "אימות ויצירת חשבון",
    verifyLogin: "אימות וכניסה",
    changeNumber: "שימוש במספר אחר",
    sent: "קוד אימות נשלח אל {phone}.",
    resetSent: "אם קיים חשבון לאימייל הזה, נשלח אליו קישור לאיפוס הסיסמה.",
    secure: "מוגן באמצעות Firebase",
    private: "סביבת עבודה פרטית",
    noPasswordStore: "סיסמאות וקודי SMS לעולם אינם נשמרים ב־Firestore.",
    terms: "בהמשך הפעולה אתם מאשרים להשתמש באימות רק עבור החשבון שלכם.",
    webPhoneOnly: "אימות SMS בתצוגת Expo פועל בגרסת Web. חבילת Android דורשת גם הגדרת אפליקציית Android בפרויקט Firebase.",
  },
  ar: {
    eyebrow: "استوديو التفاعل الخاص بك",
    brandLine: "تحليل خاص. تحسين مدروس.",
    signupTitle: "أنشئ حساب EngageVision",
    signupBody: "احفظ سجل منشوراتك بأمان وابنِ توقعًا شخصيًا أكثر فائدة مع مرور الوقت.",
    loginTitle: "مرحبًا بعودتك",
    loginBody: "تابع مسار تحليل منشوراتك وتحسينها بشكل خاص.",
    signup: "إنشاء حساب",
    login: "تسجيل الدخول",
    email: "البريد",
    phone: "الهاتف",
    emailMethod: "البريد وكلمة المرور",
    phoneMethod: "الهاتف وSMS",
    fullName: "الاسم الكامل",
    fullNamePlaceholder: "اسمك",
    emailAddress: "البريد الإلكتروني",
    emailPlaceholder: "name@example.com",
    password: "كلمة المرور",
    passwordPlaceholder: "8 أحرف على الأقل",
    confirmPassword: "تأكيد كلمة المرور",
    confirmPlaceholder: "أعد كتابة كلمة المرور",
    forgot: "نسيت كلمة المرور؟",
    signupAction: "إنشاء حساب آمن",
    loginAction: "دخول آمن",
    already: "لديك حساب بالفعل؟",
    loginLink: "سجّل الدخول",
    newHere: "جديد في EngageVision؟",
    signupLink: "أنشئ حسابًا",
    phoneNumber: "رقم الهاتف المحمول",
    phonePlaceholder: "50 123 4567",
    phoneHelp: "اختر رمز الدولة واحذف الصفر الأول من الرقم المحلي.",
    smsConsent: "سيرسل Firebase رسالة تحقق. قد تُطبق رسوم شركة الاتصال المعتادة.",
    sendCode: "إرسال رمز التحقق",
    code: "رمز تحقق من 6 أرقام",
    codePlaceholder: "123456",
    verifySignup: "تحقق وأنشئ الحساب",
    verifyLogin: "تحقق وسجّل الدخول",
    changeNumber: "استخدام رقم آخر",
    sent: "تم إرسال رمز تحقق إلى {phone}.",
    resetSent: "إذا كان الحساب موجودًا فسيتم إرسال رابط إعادة تعيين كلمة المرور.",
    secure: "محمي بواسطة Firebase",
    private: "مساحة عمل خاصة",
    noPasswordStore: "لا تُحفظ كلمات المرور أو رموز SMS في Firestore أبدًا.",
    terms: "بالمتابعة، أنت توافق على استخدام المصادقة لحسابك فقط.",
    webPhoneOnly: "يعمل تحقق SMS في معاينة Expo على نسخة الويب. يتطلب إصدار Android إعداد تطبيق Android في مشروع Firebase.",
  },
};

const errorCopy: Record<AppLanguage, Record<string, string>> = {
  en: {
    validationName: "Enter your full name.",
    validationEmail: "Enter a valid email address.",
    validationPassword: "Use at least 8 characters, including a letter and a number.",
    validationLoginPassword: "Enter your password.",
    validationConfirm: "The passwords do not match.",
    validationPhone: "Enter a valid mobile number.",
    validationCode: "Enter the 6-digit verification code.",
    "auth/email-already-in-use": "This email already has an account. Log in instead.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a stronger password.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/user-not-found": "No account was found with these details.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/invalid-phone-number": "Check the country code and mobile number.",
    "auth/phone-already-in-use": "This phone number already has an account. Log in instead.",
    "auth/invalid-verification-code": "The verification code is incorrect.",
    "auth/code-expired": "The verification code expired. Send a new code.",
    "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
    "auth/quota-exceeded": "The Firebase SMS quota has been reached.",
    "auth/captcha-check-failed": "The security check expired. Please try again.",
    "auth/unauthorized-domain": "Add this web address to Firebase Authentication authorized domains.",
    "auth/network-request-failed": "Check your internet connection and try again.",
    "auth/operation-not-allowed": "Enable this sign-in method in Firebase Authentication.",
    "permission-denied": "Firestore blocked the profile write. Publish the included security rules.",
    unknown: "The request could not be completed. Please try again.",
  },
  he: {
    validationName: "יש להזין שם מלא.",
    validationEmail: "יש להזין כתובת אימייל תקינה.",
    validationPassword: "הסיסמה צריכה לכלול לפחות 8 תווים, אות ומספר.",
    validationLoginPassword: "יש להזין את הסיסמה.",
    validationConfirm: "הסיסמאות אינן תואמות.",
    validationPhone: "יש להזין מספר נייד תקין.",
    validationCode: "יש להזין קוד אימות בן 6 ספרות.",
    "auth/email-already-in-use": "כבר קיים חשבון עם האימייל הזה. היכנסו במקום להירשם.",
    "auth/invalid-email": "כתובת האימייל אינה תקינה.",
    "auth/weak-password": "בחרו סיסמה חזקה יותר.",
    "auth/invalid-credential": "האימייל או הסיסמה שגויים.",
    "auth/user-not-found": "לא נמצא חשבון עם הפרטים האלה.",
    "auth/user-disabled": "החשבון הזה הושבת.",
    "auth/invalid-phone-number": "בדקו את קידומת המדינה ואת המספר.",
    "auth/phone-already-in-use": "כבר קיים חשבון למספר הזה. היכנסו במקום להירשם.",
    "auth/invalid-verification-code": "קוד האימות שגוי.",
    "auth/code-expired": "קוד האימות פג. שלחו קוד חדש.",
    "auth/too-many-requests": "בוצעו יותר מדי ניסיונות. המתינו מעט ונסו שוב.",
    "auth/quota-exceeded": "מכסת הודעות ה־SMS של Firebase הסתיימה.",
    "auth/captcha-check-failed": "בדיקת האבטחה פגה. נסו שוב.",
    "auth/unauthorized-domain": "הוסיפו את כתובת האתר לרשימת Authorized domains ב־Firebase.",
    "auth/network-request-failed": "בדקו את חיבור האינטרנט ונסו שוב.",
    "auth/operation-not-allowed": "יש להפעיל את שיטת הכניסה הזו ב־Firebase Authentication.",
    "permission-denied": "Firestore חסם את שמירת הפרופיל. יש לפרסם את כללי האבטחה המצורפים.",
    unknown: "לא ניתן להשלים את הפעולה. נסו שוב.",
  },
  ar: {
    validationName: "أدخل الاسم الكامل.",
    validationEmail: "أدخل بريدًا إلكترونيًا صحيحًا.",
    validationPassword: "استخدم 8 أحرف على الأقل تتضمن حرفًا ورقمًا.",
    validationLoginPassword: "أدخل كلمة المرور.",
    validationConfirm: "كلمتا المرور غير متطابقتين.",
    validationPhone: "أدخل رقم هاتف صحيحًا.",
    validationCode: "أدخل رمز التحقق المكوّن من 6 أرقام.",
    "auth/email-already-in-use": "يوجد حساب بهذا البريد. سجّل الدخول بدلًا من ذلك.",
    "auth/invalid-email": "عنوان البريد غير صحيح.",
    "auth/weak-password": "اختر كلمة مرور أقوى.",
    "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحين.",
    "auth/user-not-found": "لم يتم العثور على حساب بهذه البيانات.",
    "auth/user-disabled": "تم تعطيل هذا الحساب.",
    "auth/invalid-phone-number": "تحقق من رمز الدولة ورقم الهاتف.",
    "auth/phone-already-in-use": "يوجد حساب لهذا الرقم. سجّل الدخول بدلًا من ذلك.",
    "auth/invalid-verification-code": "رمز التحقق غير صحيح.",
    "auth/code-expired": "انتهت صلاحية الرمز. أرسل رمزًا جديدًا.",
    "auth/too-many-requests": "محاولات كثيرة. انتظر قليلًا وحاول مجددًا.",
    "auth/quota-exceeded": "تم بلوغ حصة رسائل Firebase.",
    "auth/captcha-check-failed": "انتهت صلاحية فحص الأمان. حاول مجددًا.",
    "auth/unauthorized-domain": "أضف عنوان الموقع إلى النطاقات المصرح بها في Firebase.",
    "auth/network-request-failed": "تحقق من اتصال الإنترنت وحاول مجددًا.",
    "auth/operation-not-allowed": "فعّل طريقة الدخول هذه في Firebase Authentication.",
    "permission-denied": "منع Firestore حفظ الملف. انشر قواعد الأمان المرفقة.",
    unknown: "تعذر إكمال الطلب. حاول مجددًا.",
  },
};

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (current, [key, value]) => current.replace(`{${key}}`, value),
    template,
  );
}

function errorCode(error: unknown): string {
  if (error instanceof FirebaseError) return error.code.replace("firestore/", "");
  if (error && typeof error === "object" && "code" in error) return String(error.code);
  return "unknown";
}

function normalizePhone(countryCode: string, localNumber: string): string | null {
  let digits = localNumber.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(countryCode.slice(1))) return `+${digits}`;
  digits = digits.replace(/^0+/, "");
  return digits.length >= 7 && digits.length <= 14 ? `${countryCode}${digits}` : null;
}

export default function AuthScreen() {
  const { language, rtl } = useI18n();
  const {
    registerWithEmail,
    loginWithEmail,
    sendPhoneCode,
    completePhoneAuth,
    resetPassword,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const c = copy[language];
  const e = errorCopy[language];
  const [mode, setMode] = useState<AuthMode>("signup");
  const [method, setMethod] = useState<AuthMethod>("email");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [countryCode, setCountryCode] = useState("+972");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const recaptcha = useRef<RecaptchaVerifier | null>(null);

  const isWebPhone = Platform.OS === "web";
  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const passwordValid = useMemo(
    () => password.length >= 8 && /[A-Za-z\u0590-\u05ff\u0600-\u06ff]/.test(password) && /\d/.test(password),
    [password],
  );

  useEffect(() => {
    firebaseAuth.languageCode = language;
  }, [language]);

  useEffect(
    () => () => {
      recaptcha.current?.clear();
      recaptcha.current = null;
    },
    [],
  );

  function resetFeedback() {
    setError("");
    setNotice("");
  }

  function changeMode(next: AuthMode) {
    setMode(next);
    setConfirmation(null);
    setCode("");
    resetFeedback();
    recaptcha.current?.clear();
    recaptcha.current = null;
  }

  function changeMethod(next: AuthMethod) {
    setMethod(next);
    setConfirmation(null);
    setCode("");
    resetFeedback();
    recaptcha.current?.clear();
    recaptcha.current = null;
  }

  function showError(value: unknown) {
    const key = errorCode(value);
    setError(e[key] || e.unknown);
    setNotice("");
  }

  async function submitEmail() {
    resetFeedback();
    if (mode === "signup" && fullName.trim().length < 2) return setError(e.validationName);
    if (!emailValid) return setError(e.validationEmail);
    if (mode === "signup" && !passwordValid) return setError(e.validationPassword);
    if (mode === "login" && password.length < 6) return setError(e.validationLoginPassword);
    if (mode === "signup" && password !== confirmPassword) return setError(e.validationConfirm);
    setLoading(true);
    try {
      if (mode === "signup") await registerWithEmail(fullName, email, password);
      else await loginWithEmail(email, password);
    } catch (value) {
      showError(value);
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    resetFeedback();
    if (!emailValid) return setError(e.validationEmail);
    setLoading(true);
    try {
      await resetPassword(email);
      setNotice(c.resetSent);
    } catch (value) {
      showError(value);
    } finally {
      setLoading(false);
    }
  }

  async function requestCode() {
    resetFeedback();
    if (!isWebPhone) return setError(c.webPhoneOnly);
    if (mode === "signup" && fullName.trim().length < 2) return setError(e.validationName);
    const e164 = normalizePhone(countryCode, phone);
    if (!e164) return setError(e.validationPhone);
    setLoading(true);
    try {
      recaptcha.current?.clear();
      const verifier = new RecaptchaVerifier(firebaseAuth, "engagevision-recaptcha", {
        size: "normal",
        "expired-callback": () => setError(e["auth/captcha-check-failed"]),
      });
      recaptcha.current = verifier;
      await verifier.render();
      setConfirmation(await sendPhoneCode(e164, verifier));
      setVerifiedPhone(e164);
      setNotice(fill(c.sent, { phone: e164 }));
    } catch (value) {
      recaptcha.current?.clear();
      recaptcha.current = null;
      showError(value);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    resetFeedback();
    if (!confirmation || !/^\d{6}$/.test(code)) return setError(e.validationCode);
    setLoading(true);
    try {
      await completePhoneAuth(confirmation, code, mode, fullName);
    } catch (value) {
      showError(value);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, rtl && styles.rtl]}>
      <AmbientBackdrop />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(insets.top + 14, 34), paddingBottom: Math.max(insets.bottom + 26, 42) },
          ]}
        >
          <View style={[styles.topRow, rtl && styles.rowReverse]}>
            <View style={[styles.brand, rtl && styles.rowReverse]}>
              <LinearGradient colors={gradients.primary} style={styles.brandMark}>
                <Text style={styles.brandLetter}>E</Text>
              </LinearGradient>
              <View>
                <Text style={[styles.brandName, rtl && styles.textRtl]}>EngageVision</Text>
                <Text style={[styles.brandLine, rtl && styles.textRtl]}>{c.brandLine}</Text>
              </View>
            </View>
            <LanguageSwitcher />
          </View>

          <View style={styles.hero}>
            <View style={styles.signalRail}>
              <LinearGradient colors={[colors.blue, colors.cyan]} style={styles.signalBlue} />
              <View style={styles.signalCore}><Text style={styles.signalCoreText}>✦</Text></View>
              <LinearGradient colors={[colors.coral, colors.primary]} style={styles.signalCoral} />
            </View>
            <Text style={[styles.eyebrow, rtl && styles.textRtl]}>{c.eyebrow}</Text>
            <Text style={[styles.title, rtl && styles.textRtl]}>
              {mode === "signup" ? c.signupTitle : c.loginTitle}
            </Text>
            <Text style={[styles.subtitle, rtl && styles.textRtl]}>
              {mode === "signup" ? c.signupBody : c.loginBody}
            </Text>
            <View style={[styles.trustRow, rtl && styles.rowReverse]}>
              <View style={styles.trustChip}><Text style={styles.trustIcon}>◇</Text><Text style={styles.trustText}>{c.secure}</Text></View>
              <View style={styles.trustChip}><Text style={styles.trustIcon}>◉</Text><Text style={styles.trustText}>{c.private}</Text></View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={[styles.modeSwitch, rtl && styles.rowReverse]}>
              {(["signup", "login"] as AuthMode[]).map((item) => (
                <TouchableOpacity
                  key={item}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === item }}
                  onPress={() => changeMode(item)}
                  style={[styles.modeButton, mode === item && styles.modeButtonActive]}
                >
                  <Text style={[styles.modeText, mode === item && styles.modeTextActive]}>{c[item]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.methodRow, rtl && styles.rowReverse]}>
              {(["email", "phone"] as AuthMethod[]).map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => changeMethod(item)}
                  style={[styles.methodButton, method === item && styles.methodButtonActive]}
                >
                  <View style={[styles.methodIcon, method === item && styles.methodIconActive]}>
                    <Text style={styles.methodIconText}>{item === "email" ? "@" : "⌁"}</Text>
                  </View>
                  <View style={styles.methodCopy}>
                    <Text style={[styles.methodTitle, rtl && styles.textRtl]}>{c[`${item}Method`]}</Text>
                    <Text style={[styles.methodMeta, method === item && styles.methodMetaActive, rtl && styles.textRtl]}>
                      {item === "email" ? c.email : c.phone}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {method === "email" ? (
              <View>
                {mode === "signup" && (
                  <AuthField
                    label={c.fullName}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder={c.fullNamePlaceholder}
                    rtl={rtl}
                    autoComplete="name"
                  />
                )}
                <AuthField
                  label={c.emailAddress}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={c.emailPlaceholder}
                  rtl={rtl}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
                <AuthField
                  label={c.password}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={c.passwordPlaceholder}
                  rtl={rtl}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  accessory={
                    <TouchableOpacity onPress={() => setShowPassword((current) => !current)} style={styles.eyeButton}>
                      <Text style={styles.eyeText}>{showPassword ? "◉" : "◎"}</Text>
                    </TouchableOpacity>
                  }
                />
                {mode === "signup" && (
                  <AuthField
                    label={c.confirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={c.confirmPlaceholder}
                    rtl={rtl}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                  />
                )}
                {mode === "login" && (
                  <TouchableOpacity onPress={forgotPassword} disabled={loading} style={styles.forgotButton}>
                    <Text style={[styles.forgotText, rtl && styles.textRtl]}>{c.forgot}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View>
                {mode === "signup" && !confirmation && (
                  <AuthField
                    label={c.fullName}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder={c.fullNamePlaceholder}
                    rtl={rtl}
                    autoComplete="name"
                  />
                )}
                {!confirmation ? (
                  <>
                    <Text style={[styles.fieldLabel, rtl && styles.textRtl]}>{c.phoneNumber}</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.countryRow}
                    >
                      {COUNTRY_CODES.map((country) => (
                        <TouchableOpacity
                          key={country.code}
                          accessibilityLabel={`${country.label} ${country.code}`}
                          onPress={() => setCountryCode(country.code)}
                          style={[styles.countryChip, countryCode === country.code && styles.countryChipActive]}
                        >
                          <Text style={styles.countryFlag}>{country.flag}</Text>
                          <Text style={[styles.countryCode, countryCode === country.code && styles.countryCodeActive]}>
                            {country.code}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={[styles.phoneRow, rtl && styles.rowReverse]}>
                      <View style={styles.codeBox}><Text style={styles.codeBoxText}>{countryCode}</Text></View>
                      <TextInput
                        value={phone}
                        onChangeText={setPhone}
                        placeholder={c.phonePlaceholder}
                        placeholderTextColor={colors.textFaint}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        style={[styles.phoneInput, rtl && styles.textRtl]}
                      />
                    </View>
                    <Text style={[styles.helper, rtl && styles.textRtl]}>{c.phoneHelp}</Text>
                    <Text style={[styles.smsConsent, rtl && styles.textRtl]}>{c.smsConsent}</Text>
                    {isWebPhone ? <View nativeID="engagevision-recaptcha" style={styles.recaptcha} /> : (
                      <View style={styles.platformNote}><Text style={[styles.platformNoteText, rtl && styles.textRtl]}>{c.webPhoneOnly}</Text></View>
                    )}
                  </>
                ) : (
                  <>
                    <View style={styles.sentCard}>
                      <Text style={[styles.sentIcon, rtl && styles.textRtl]}>✓</Text>
                      <Text style={[styles.sentText, rtl && styles.textRtl]}>{fill(c.sent, { phone: verifiedPhone })}</Text>
                    </View>
                    <AuthField
                      label={c.code}
                      value={code}
                      onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
                      placeholder={c.codePlaceholder}
                      rtl={rtl}
                      keyboardType="number-pad"
                      autoComplete="sms-otp"
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setConfirmation(null);
                        setCode("");
                        resetFeedback();
                        recaptcha.current?.clear();
                        recaptcha.current = null;
                      }}
                    >
                      <Text style={[styles.changeNumber, rtl && styles.textRtl]}>{c.changeNumber}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {!!error && <View style={styles.errorCard}><Text style={[styles.errorText, rtl && styles.textRtl]}>⚠  {error}</Text></View>}
            {!!notice && <View style={styles.noticeCard}><Text style={[styles.noticeText, rtl && styles.textRtl]}>✓  {notice}</Text></View>}

            <GradientButton
              title={
                method === "email"
                  ? mode === "signup" ? c.signupAction : c.loginAction
                  : confirmation
                    ? mode === "signup" ? c.verifySignup : c.verifyLogin
                    : c.sendCode
              }
              onPress={method === "email" ? submitEmail : confirmation ? verifyCode : requestCode}
              loading={loading}
              disabled={method === "phone" && !isWebPhone}
              style={styles.primaryAction}
            />

            <View style={[styles.switchLinkRow, rtl && styles.rowReverse]}>
              <Text style={styles.switchQuestion}>{mode === "signup" ? c.already : c.newHere}</Text>
              <TouchableOpacity onPress={() => changeMode(mode === "signup" ? "login" : "signup")}>
                <Text style={styles.switchLink}>{mode === "signup" ? c.loginLink : c.signupLink}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.securityNote}>
            <Text style={styles.securityIcon}>▣</Text>
            <Text style={[styles.securityText, rtl && styles.textRtl]}>{c.noPasswordStore}</Text>
          </View>
          <Text style={[styles.terms, rtl && styles.textRtl]}>{c.terms}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function AuthField({
  label,
  accessory,
  rtl,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  accessory?: React.ReactNode;
  rtl: boolean;
}) {
  return (
    <View>
      <Text style={[styles.fieldLabel, rtl && styles.textRtl]}>{label}</Text>
      <View style={[styles.inputWrap, rtl && styles.rowReverse]}>
        <TextInput
          {...props}
          placeholderTextColor={colors.textFaint}
          style={[styles.input, rtl && styles.textRtl]}
        />
        {accessory}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rtl: { direction: "rtl" },
  rowReverse: { flexDirection: "row-reverse" },
  textRtl: { textAlign: "right", writingDirection: "rtl" },
  content: { width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: spacing.lg },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 28 },
  brand: { flexDirection: "row", alignItems: "center", gap: 11, flexShrink: 1 },
  brandMark: {
    width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.48)", ...shadows.glow,
  },
  brandLetter: { color: "#17120C", fontSize: 22, fontWeight: "900" },
  brandName: { color: colors.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  brandLine: { color: colors.textFaint, fontSize: 9, marginTop: 2 },
  hero: { marginBottom: 20 },
  signalRail: { height: 34, flexDirection: "row", alignItems: "center", marginBottom: 18 },
  signalBlue: { flex: 1, height: 3, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  signalCoral: { flex: 1, height: 3, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  signalCore: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.backgroundRaised, borderWidth: 1, borderColor: colors.primaryBorder,
    shadowColor: colors.primary, shadowOpacity: 0.45, shadowRadius: 14, elevation: 6,
  },
  signalCoreText: { color: colors.primary, fontSize: 16 },
  eyebrow: { color: colors.cyan, fontSize: 9, fontWeight: "900", letterSpacing: 2.1, marginBottom: 8 },
  title: { color: colors.text, fontSize: 32, lineHeight: 38, fontWeight: "900", letterSpacing: -0.8, marginBottom: 9 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21, maxWidth: 520 },
  trustRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 15 },
  trustChip: {
    flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.cardBorder,
    backgroundColor: "rgba(20,30,40,0.74)", paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill,
  },
  trustIcon: { color: colors.cyan, fontSize: 11 },
  trustText: { color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.xl,
    padding: spacing.lg, ...shadows.card,
  },
  modeSwitch: {
    flexDirection: "row", backgroundColor: colors.input, borderRadius: radius.lg, padding: 4,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", marginBottom: 14,
  },
  modeButton: { flex: 1, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modeButtonActive: {
    backgroundColor: colors.backgroundRaised, borderWidth: 1, borderColor: colors.primaryBorder,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  modeText: { color: colors.textFaint, fontSize: 13, fontWeight: "800" },
  modeTextActive: { color: colors.primary },
  methodRow: { flexDirection: "row", gap: 9, marginBottom: 12 },
  methodButton: {
    flex: 1, minHeight: 72, flexDirection: "row", alignItems: "center", gap: 9,
    padding: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(8,14,21,0.62)",
  },
  methodButtonActive: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  methodIcon: {
    width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.backgroundRaised, borderWidth: 1, borderColor: colors.cardBorder,
  },
  methodIconActive: { borderColor: colors.primaryBorder },
  methodIconText: { color: colors.primary, fontSize: 16, fontWeight: "900" },
  methodCopy: { flex: 1 },
  methodTitle: { color: colors.text, fontSize: 11, fontWeight: "800" },
  methodMeta: { color: colors.textFaint, fontSize: 9, marginTop: 3 },
  methodMetaActive: { color: colors.primary },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "800", marginTop: 13, marginBottom: 7 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", minHeight: 52, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.input, overflow: "hidden",
  },
  input: { flex: 1, minHeight: 50, paddingHorizontal: 13, color: colors.text, fontSize: 14 },
  eyeButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  eyeText: { color: colors.primary, fontSize: 18 },
  forgotButton: { alignSelf: "flex-end", paddingVertical: 11 },
  forgotText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  countryRow: { gap: 7, paddingBottom: 9 },
  countryChip: {
    minWidth: 68, height: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    paddingHorizontal: 9, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder,
    backgroundColor: colors.input,
  },
  countryChipActive: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  countryFlag: { fontSize: 15 },
  countryCode: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  countryCodeActive: { color: colors.primary },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  codeBox: {
    minWidth: 70, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder,
  },
  codeBoxText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  phoneInput: {
    flex: 1, height: 52, borderRadius: radius.md, paddingHorizontal: 13, color: colors.text,
    borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.input, fontSize: 14,
  },
  helper: { color: colors.textFaint, fontSize: 10, lineHeight: 15, marginTop: 7 },
  smsConsent: { color: colors.textMuted, fontSize: 10, lineHeight: 16, marginTop: 10 },
  recaptcha: { minHeight: 78, marginTop: 12, overflow: "hidden" },
  platformNote: {
    marginTop: 12, borderRadius: radius.md, padding: 11, borderWidth: 1,
    borderColor: colors.amberBorder, backgroundColor: colors.amberSoft,
  },
  platformNoteText: { color: colors.amber, fontSize: 10, lineHeight: 16 },
  sentCard: {
    flexDirection: "row", alignItems: "center", gap: 9, marginTop: 13, padding: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.greenBorder, backgroundColor: colors.greenSoft,
  },
  sentIcon: { color: colors.green, fontSize: 16, fontWeight: "900" },
  sentText: { flex: 1, color: colors.green, fontSize: 11, lineHeight: 17, fontWeight: "700" },
  changeNumber: { color: colors.primary, fontSize: 11, fontWeight: "800", marginTop: 10 },
  errorCard: {
    marginTop: 13, borderRadius: radius.md, padding: 11, backgroundColor: colors.redSoft,
    borderWidth: 1, borderColor: colors.redBorder,
  },
  errorText: { color: colors.red, fontSize: 11, lineHeight: 17, fontWeight: "700" },
  noticeCard: {
    marginTop: 13, borderRadius: radius.md, padding: 11, backgroundColor: colors.greenSoft,
    borderWidth: 1, borderColor: colors.greenBorder,
  },
  noticeText: { color: colors.green, fontSize: 11, lineHeight: 17, fontWeight: "700" },
  primaryAction: { marginTop: 17 },
  switchLinkRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 17 },
  switchQuestion: { color: colors.textFaint, fontSize: 11 },
  switchLink: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  securityNote: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingHorizontal: 18, marginTop: 20,
  },
  securityIcon: { color: colors.cyan, fontSize: 14 },
  securityText: { flexShrink: 1, color: colors.textMuted, fontSize: 10, lineHeight: 15, textAlign: "center" },
  terms: { color: colors.textFaint, fontSize: 9, lineHeight: 14, textAlign: "center", marginTop: 9, paddingHorizontal: 20 },
});
