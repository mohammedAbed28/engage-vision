# Firebase — השלמה לפני פרסום

הקוד משתמש ב־Firebase modular SDK. מסכי הרשמה,
כניסה, שחזור סיסמה, הגנת האפליקציה ויציאה מהחשבון כבר נמצאים באפליקציה.

תצורת ה־Web הציבורית של פרויקט `engage-vision` כבר כלולה בקוד הלקוח, כפי
שהייתה בגרסת Codex המקורית. אין צורך להעתיק אותה ל־`frontend/.env`.
ההרשאות עצמן נאכפות באמצעות Firebase Authentication וכללי Firestore.
מפתחות שרת פרטיים אינם נמצאים ב־Frontend.

## 1. יצירת Firestore ופרסום הכללים

ב־Firebase Console:

1. פתחו **Firestore Database** ולחצו **Create database**.
2. בחרו Production mode ואזור קרוב למשתמשים.
3. פתחו את לשונית **Rules** והדביקו את תוכן `firestore.rules`.
4. לחצו **Publish**.

או דרך Firebase CLI:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

הכללים מאפשרים לכל משתמש לקרוא ולעדכן רק את המסמך שלו
ב־`users/{uid}`. הם דוחים שדות נוספים, ולכן לא ניתן לשמור שם סיסמה או קוד SMS.

## 2. Authentication

ב־Authentication → Sign-in method ודאו שמופעלים:

- Email/Password
- Phone

ב־Authentication → Settings → Authorized domains הוסיפו את דומיין האחסון
הסופי. `localhost` משמש רק לבדיקה מקומית.

## 3. בדיקת Web מלאה

```bash
npm ci
npm run web
```

אימות SMS בדפדפן משתמש ב־`RecaptchaVerifier`. לבדיקות ללא שליחת SMS אמיתי,
מומלץ להגדיר מספר בדיקה וקוד קבוע במסך Phone provider של Firebase.

## 4. פרסום גרסת Web

```bash
npm run export:web
npx firebase-tools deploy --only hosting,firestore:rules
```

## 5. Android

הרשמה באימייל, Firestore ושמירת session עובדים באמצעות Firebase JS SDK.
כדי להפעיל Phone Authentication בחבילת Android נייטיבית:

1. הוסיפו ב־Firebase אפליקציית Android עם package:
   `com.engagevision.ai`.
2. הורידו `google-services.json`.
3. הוסיפו SHA-1 ו־SHA-256 של חתימת EAS/Google Play.
4. עברו לשכבת Firebase Auth הנייטיבית עבור SMS/Play Integrity ובנו
   development build או production build. `RecaptchaVerifier` הוא מנגנון Web
   ואינו נתמך ישירות ב־React Native.

אין להכניס מפתחות שרת, סיסמאות או קודי SMS לקוד האפליקציה.
