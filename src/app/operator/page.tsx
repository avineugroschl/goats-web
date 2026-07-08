"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import Footer from "@/components/Footer";

export default function OperatorLanding() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  // Auto-redirect already-signed-in users to wherever they belong:
  //  - operators → dashboard
  //  - platform admins / court editors → /admin
  //  - anyone else → stay on this page (they shouldn't be here)
  useEffect(() => {
    if (loading) return;
    if (!user || !profile) return;
    if (profile.isOperator) {
      router.push("/operator/dashboard");
    } else if (profile.isAdmin || profile.canEditCourts) {
      router.push("/admin");
    }
  }, [loading, user, profile, router]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSigningIn(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const uid = credential.user.uid;

      // Gate access: this account must either have an operator record
      // (operators/{uid}), be a platform admin (users/{uid}.isAdmin), or be a
      // court editor (users/{uid}.canEditCourts). Regular player accounts from
      // the mobile app should be rejected.
      const [operatorSnap, userSnap] = await Promise.all([
        getDoc(doc(db, "operators", uid)),
        getDoc(doc(db, "users", uid)),
      ]);
      const isOperator = operatorSnap.exists();
      const isAdmin = userSnap.exists() && Boolean(userSnap.data().isAdmin);
      const canEditCourts =
        isAdmin || (userSnap.exists() && Boolean(userSnap.data().canEditCourts));

      if (!isOperator && !isAdmin && !canEditCourts) {
        await signOut(auth);
        setError(
          "This account isn't set up as a court operator. Sign up below to get started."
        );
        return;
      }

      router.push(isOperator ? "/operator/dashboard" : "/admin");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Try again later.");
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface-dark">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 sm:px-12">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <img
            src="/app-icon.png"
            alt="G.O.A.T.S"
            className="h-10 w-10 rounded-xl"
          />
          <span className="font-display text-xl font-bold tracking-tight text-text-on-dark">
            G.O.A.T.S
          </span>
        </Link>
        <div />
      </nav>

      {/* Hero split layout */}
      <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-7xl flex-col items-center gap-16 px-6 py-16 lg:flex-row lg:gap-20 lg:py-0 sm:px-12">
        {/* Left — Value prop */}
        <div className="flex-1 lg:py-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal/10 px-4 py-1.5">
            <div className="h-2 w-2 rounded-full bg-teal animate-pulse" />
            <span className="font-display text-xs font-semibold uppercase tracking-widest text-teal">
              Court Operators
            </span>
          </div>

          <h1 className="font-display mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
            The real{" "}
            <span className="bg-gradient-to-r from-teal to-teal-dark bg-clip-text text-transparent">
              home court advantage.
            </span>
          </h1>

          <p className="mb-10 max-w-lg text-lg leading-relaxed text-white/60">
            Have your court listed on G.O.A.T.S, track activity, run promotions,
            and keep players in the loop — all from one dashboard.
          </p>

          <div className="grid max-w-md grid-cols-2 gap-4">
            {[
              { stat: "Get Listed", desc: "Put your court on the map" },
              { stat: "Live Stats", desc: "Check-ins, peak hours, trends" },
              { stat: "Promotions", desc: "Run deals, get highlighted" },
              { stat: "Notifications", desc: "Keep players in the loop" },
            ].map((item) => (
              <div
                key={item.stat}
                className="rounded-xl border border-dash-border bg-dash-surface p-4"
              >
                <p className="font-display text-sm font-bold text-teal">
                  {item.stat}
                </p>
                <p className="mt-1 text-xs text-white/40">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Sign in card */}
        <div className="w-full max-w-md lg:py-20">
          <div className="rounded-2xl border border-dash-border bg-dash-surface p-8 shadow-2xl shadow-black/40">
            <h2 className="font-display mb-1 text-2xl font-bold text-white">
              Operator Sign In
            </h2>
            <p className="mb-8 text-sm text-white/40">
              Access your court dashboard
            </p>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-teal"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-3 pr-11 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-teal"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    if (!email.trim()) {
                      setError("Enter your email first, then click Forgot Password.");
                      return;
                    }
                    try {
                      const { sendPasswordResetEmail } = await import("firebase/auth");
                      await sendPasswordResetEmail(auth, email);
                      setError("");
                      alert("Password reset email sent. Check your inbox.");
                    } catch {
                      setError("Failed to send reset email. Check your email and try again.");
                    }
                  }}
                  className="text-xs text-white/30 transition-colors hover:text-teal"
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <p className="text-sm text-coral">{error}</p>
              )}

              <button
                type="submit"
                disabled={signingIn}
                className="w-full rounded-xl bg-teal py-3.5 font-display text-sm font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal-dark disabled:opacity-50"
              >
                {signingIn ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="mt-8 border-t border-dash-border pt-6 text-center">
              <p className="mb-3 text-sm text-white/40">
                Don&apos;t have an operator account?
              </p>
              <Link
                href="/operator/signup"
                className="inline-flex items-center gap-2 font-display text-sm font-bold text-coral transition-colors hover:text-coral-dark"
              >
                Become a Court Operator
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
