"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { auth, db } from "./firebase";
import { OperatorProfile } from "./types";

interface AuthContextValue {
  user: User | null;
  profile: OperatorProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const operatorUnsubRef = useRef<Unsubscribe | null>(null);

  // Subscribes to the live `operators/{uid}` doc so admin approvals push to
  // the signed-in user's tab without a refresh. `users/{uid}.isAdmin` is
  // read once — it almost never changes mid-session.
  async function subscribeToProfile(uid: string) {
    // Clean up any previous subscription first.
    operatorUnsubRef.current?.();

    const userSnap = await getDoc(doc(db, "users", uid));
    const isAdmin = userSnap.exists() ? Boolean(userSnap.data().isAdmin) : false;

    operatorUnsubRef.current = onSnapshot(
      doc(db, "operators", uid),
      (operatorSnap) => {
        if (operatorSnap.exists()) {
          const data = operatorSnap.data();
          setProfile({
            id: operatorSnap.id,
            email: data.email ?? "",
            username: data.username ?? "",
            firstName: data.firstName ?? "",
            lastName: data.lastName ?? "",
            isAdmin,
            isOperator: true,
            operatorCourtIds: data.operatorCourtIds ?? [],
            subscriptionStatus: data.subscriptionStatus ?? "none",
            subscriptionQuantity: typeof data.subscriptionQuantity === "number" ? data.subscriptionQuantity : 1,
            subscriptionExpiresAt: data.subscriptionExpiresAt ?? undefined,
            applicationStatus: data.applicationStatus,
            freeAccess: data.freeAccess ?? false,
          });
          return;
        }

        // Not an operator — fall back to a minimal admin-only profile
        // so `/admin` still works for platform admins without operator records.
        if (isAdmin && userSnap.exists()) {
          const data = userSnap.data();
          setProfile({
            id: userSnap.id,
            email: data.email ?? "",
            username: data.username ?? "",
            isAdmin: true,
            isOperator: false,
            operatorCourtIds: [],
            subscriptionStatus: "none",
          });
          return;
        }

        setProfile(null);
      },
      (err) => {
        console.error("operators snapshot error:", err);
      }
    );
  }

  async function refreshProfile() {
    if (user) await subscribeToProfile(user.uid);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await subscribeToProfile(firebaseUser.uid);
      } else {
        operatorUnsubRef.current?.();
        operatorUnsubRef.current = null;
        setProfile(null);
      }
      setLoading(false);
    });
    return () => {
      unsub();
      operatorUnsubRef.current?.();
      operatorUnsubRef.current = null;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
