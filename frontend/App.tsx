/**
 * App entry point — navigation setup only. Screen content lives in
 * src/screens/*; shared styling lives in src/theme/theme.ts.
 *
 * Flow: Home → CreatePost → AnalysisLoading → Results → ImprovementStudio
 */
import React from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DarkTheme, NavigationContainer, Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "./src/screens/HomeScreen";
import CreatePostScreen from "./src/screens/CreatePostScreen";
import AnalysisLoadingScreen from "./src/screens/AnalysisLoadingScreen";
import ResultsScreen from "./src/screens/ResultsScreen";
import ImprovementStudioScreen from "./src/screens/ImprovementStudioScreen";
import ModelGuidedImageEditorScreen from "./src/screens/ModelGuidedImageEditorScreen";
import PrivacyScreen from "./src/screens/PrivacyScreen";
import AccountSetupScreen from "./src/screens/AccountSetupScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import LogOutcomeScreen from "./src/screens/LogOutcomeScreen";
import AuthScreen from "./src/screens/AuthScreen";
import ModelDashboardScreen from "./src/screens/ModelDashboardScreen";
import { colors } from "./src/theme/theme";
import { DraftPost, PredictionResponse } from "./src/types/prediction";
import { I18nProvider, useI18n } from "./src/i18n/I18nProvider";
import LanguageSwitcher from "./src/components/LanguageSwitcher";
import { EngageStoreProvider, useEngageStore } from "./src/context/EngageStore";
import { AppearanceProvider, useAppearance } from "./src/context/AppearanceContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LinearGradient } from "expo-linear-gradient";

export type RootStackParamList = {
  AccountSetup: { editing?: boolean } | undefined;
  Home: undefined;
  CreatePost: undefined;
  AnalysisLoading: { draft: DraftPost };
  Results: { draft: DraftPost; result: PredictionResponse; historyId?: string };
  ImprovementStudio: { draft: DraftPost; result: PredictionResponse };
  ModelGuidedEditor: { draft: DraftPost; result: PredictionResponse };
  Privacy: undefined;
  History: undefined;
  LogOutcome: { historyId: string };
  ModelDashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AppearanceProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <AuthenticatedApp />
          </AuthProvider>
        </AppearanceProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function AuthenticatedApp() {
  const { initializing, user } = useAuth();
  const { language } = useI18n();
  const restoringCopy = {
    en: "Restoring your secure session",
    he: "משחזרים את החיבור המאובטח שלך",
    ar: "جارٍ استعادة جلستك الآمنة",
  }[language];

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <LinearGradient
          colors={["#D8AE73", "#F4DDB4"]}
          style={{ width: 64, height: 64, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 18 }}
        >
          <View><ActivityIndicator color="#17120C" /></View>
        </LinearGradient>
        <View style={{ alignItems: "center", gap: 7 }}>
          <View style={{ height: 1, width: 44, backgroundColor: "rgba(216,174,115,0.5)" }} />
          <View>
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "900", letterSpacing: 2.4, textAlign: "center" }}>
              ENGAGEVISION
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 7, textAlign: "center" }}>
              {restoringCopy}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <EngageStoreProvider key={user.uid} ownerId={user.uid}>
      <AppNavigator />
    </EngageStoreProvider>
  );
}

function AppNavigator() {
  const { t, rtl, setLanguage } = useI18n();
  const { hydrated, profile } = useEngageStore();
  const { brighter } = useAppearance();
  const navigationTheme: Theme = React.useMemo(() => ({
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: brighter ? "#172637" : colors.background,
      card: brighter ? "#1B2C3D" : colors.backgroundAlt,
      text: colors.text,
      border: colors.cardBorder,
      primary: colors.primary,
    },
  }), [brighter]);

  React.useEffect(() => {
    if (profile?.preferredLanguage) setLanguage(profile.preferredLanguage);
  }, [profile?.preferredLanguage, setLanguage]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator
          initialRouteName={profile ? "CreatePost" : "AccountSetup"}
          screenOptions={{
            headerStyle: { backgroundColor: brighter ? "#1B2C3D" : colors.backgroundAlt },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "800", fontSize: 16 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: brighter ? "#172637" : colors.background },
            animation: rtl ? "slide_from_left" : "slide_from_right",
            headerRight: () => <LanguageSwitcher />,
          }}
        >
          <Stack.Screen name="AccountSetup" component={AccountSetupScreen} options={{ title: t("nav.profile"), headerShown: Boolean(profile) }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="AnalysisLoading"
            component={AnalysisLoadingScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen name="Results" component={ResultsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ImprovementStudio" component={ImprovementStudioScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ModelGuidedEditor" component={ModelGuidedImageEditorScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: t("nav.privacy") }} />
          <Stack.Screen name="History" component={HistoryScreen} options={{ headerShown: false }} />
          <Stack.Screen name="LogOutcome" component={LogOutcomeScreen} options={{ title: t("nav.outcome") }} />
          <Stack.Screen name="ModelDashboard" component={ModelDashboardScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
  );
}
