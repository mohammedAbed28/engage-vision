import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  Persistence,
  getAuth,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

/**
 * Firebase Web configuration identifies the public EngageVision Firebase
 * project. It is intentionally shipped with the client, as in the original
 * Codex application; authorization is enforced by Firebase Authentication and
 * the Firestore security rules. Private server credentials never belong here.
 */
const firebaseConfig = {
  apiKey: "AIzaSyBA-rETPTtsgu6AiWAwhqPznbC7Uk2nUzo",
  authDomain: "engage-vision.firebaseapp.com",
  projectId: "engage-vision",
  storageBucket: "engage-vision.firebasestorage.app",
  messagingSenderId: "96895673891",
  appId: "1:96895673891:web:21d8d6e09b9b430943b396",
  measurementId: "G-E22DN0Y3TV",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth(): Auth {
  if (Platform.OS === "web") return getAuth(firebaseApp);
  try {
    // Firebase exposes this symbol through its React Native export condition,
    // while the web type surface intentionally omits it.
    const { getReactNativePersistence } = require("@firebase/auth") as {
      getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
    };
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Fast Refresh can initialize the same Auth instance more than once.
    return getAuth(firebaseApp);
  }
}

export const firebaseAuth = createAuth();
export const firestore = getFirestore(firebaseApp);
