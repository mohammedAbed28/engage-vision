import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ApplicationVerifier,
  ConfirmationResult,
  User,
  createUserWithEmailAndPassword,
  deleteUser,
  getAdditionalUserInfo,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  DocumentData,
  Timestamp,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { firebaseAuth, firestore } from "../firebase/client";

export type RegistrationMethod = "email" | "phone";

export interface FirebaseUserProfile {
  uid: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  registrationMethod: RegistrationMethod;
  createdAt: Timestamp | null;
}

interface AuthContextValue {
  user: User | null;
  userProfile: FirebaseUserProfile | null;
  initializing: boolean;
  registerWithEmail: (fullName: string, email: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  sendPhoneCode: (phoneNumber: string, verifier: ApplicationVerifier) => Promise<ConfirmationResult>;
  completePhoneAuth: (
    confirmation: ConfirmationResult,
    code: string,
    mode: "signup" | "login",
    fullName?: string,
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toProfile(data: DocumentData): FirebaseUserProfile {
  return {
    uid: String(data.uid || ""),
    fullName: String(data.fullName || ""),
    email: typeof data.email === "string" ? data.email : null,
    phoneNumber: typeof data.phoneNumber === "string" ? data.phoneNumber : null,
    registrationMethod: data.registrationMethod === "phone" ? "phone" : "email",
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
  };
}

async function readUserProfile(uid: string): Promise<FirebaseUserProfile | null> {
  const snapshot = await getDoc(doc(firestore, "users", uid));
  return snapshot.exists() ? toProfile(snapshot.data()) : null;
}

async function writeUserProfile(
  user: User,
  fullName: string,
  registrationMethod: RegistrationMethod,
): Promise<void> {
  await setDoc(doc(firestore, "users", user.uid), {
    uid: user.uid,
    fullName: fullName.trim(),
    email: user.email ?? null,
    phoneNumber: user.phoneNumber ?? null,
    registrationMethod,
    createdAt: serverTimestamp(),
  });
}

function authFlowError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<FirebaseUserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    // Firebase normally restores the session immediately. A damaged/slow
    // network must never leave the product on an anonymous spinner forever.
    const startupGuard = setTimeout(() => {
      if (active) setInitializing(false);
    }, 5000);

    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      if (!active) return;
      clearTimeout(startupGuard);
      setUser(nextUser);
      setInitializing(false);

      if (!nextUser) {
        setUserProfile(null);
        return;
      }

      // The authenticated application can open before the optional Firestore
      // profile finishes loading. Authentication is the security boundary;
      // this document is presentation metadata and is intentionally hydrated
      // in the background.
      void readUserProfile(nextUser.uid)
        .then((profile) => {
          if (active) setUserProfile(profile);
        })
        .catch(() => {
          if (active) setUserProfile(null);
        });
    });

    return () => {
      active = false;
      clearTimeout(startupGuard);
      unsubscribe();
    };
  }, []);

  const registerWithEmail = useCallback(async (fullName: string, email: string, password: string) => {
    const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
    try {
      await updateProfile(credential.user, { displayName: fullName.trim() });
      await writeUserProfile(credential.user, fullName, "email");
      setUserProfile(await readUserProfile(credential.user.uid));
    } catch (error) {
      await deleteUser(credential.user).catch(() => undefined);
      throw error;
    }
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  }, []);

  const sendPhoneCode = useCallback(
    async (phoneNumber: string, verifier: ApplicationVerifier) =>
      signInWithPhoneNumber(firebaseAuth, phoneNumber, verifier),
    [],
  );

  const completePhoneAuth = useCallback(
    async (
      confirmation: ConfirmationResult,
      code: string,
      mode: "signup" | "login",
      fullName?: string,
    ) => {
      const credential = await confirmation.confirm(code);
      const isNewUser = getAdditionalUserInfo(credential)?.isNewUser === true;

      if (mode === "signup" && !isNewUser) {
        await signOut(firebaseAuth);
        throw authFlowError("auth/phone-already-in-use", "This phone number already has an account.");
      }
      if (mode === "login" && isNewUser) {
        await deleteUser(credential.user).catch(() => undefined);
        throw authFlowError("auth/user-not-found", "No account exists for this phone number.");
      }

      if (mode === "signup") {
        const safeName = fullName?.trim() || "";
        try {
          await updateProfile(credential.user, { displayName: safeName });
          await writeUserProfile(credential.user, safeName, "phone");
          setUserProfile(await readUserProfile(credential.user.uid));
        } catch (error) {
          await deleteUser(credential.user).catch(() => undefined);
          throw error;
        }
      }
    },
    [],
  );

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(firebaseAuth, email.trim());
  }, []);

  const logout = useCallback(async () => {
    await signOut(firebaseAuth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      userProfile,
      initializing,
      registerWithEmail,
      loginWithEmail,
      sendPhoneCode,
      completePhoneAuth,
      resetPassword,
      logout,
    }),
    [
      completePhoneAuth,
      initializing,
      loginWithEmail,
      logout,
      registerWithEmail,
      resetPassword,
      sendPhoneCode,
      user,
      userProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
