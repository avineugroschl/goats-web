"use client";

import { useEffect, useState, useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { RESERVATIONS_ENABLED, PAYMENT_GATING_ENABLED } from "@/lib/features";

const allNavItems = [
  {
    label: "My Court",
    href: "/operator/dashboard/court",
    feature: "always" as const,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: "Stats",
    href: "/operator/dashboard",
    feature: "always" as const,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Calendar",
    href: "/operator/dashboard/calendar",
    feature: "reservations" as const,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: "Notifications",
    href: "/operator/dashboard/notifications",
    feature: "always" as const,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    label: "Account",
    href: "/operator/dashboard/settings",
    feature: "always" as const,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

const navItems = allNavItems.filter(
  (item) => item.feature !== "reservations" || RESERVATIONS_ENABLED
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/operator");
      return;
    }
    // Profile will be null if the user has no operator record and isn't an
    // admin. Pure admins get bounced to /admin (the dashboard is operator-only).
    if (profile && !profile.isOperator) {
      router.push(profile.isAdmin ? "/admin" : "/operator");
    }
  }, [loading, user, profile, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dash-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      </div>
    );
  }

  if (!user || !profile?.isOperator) return null;

  const isPending = profile?.applicationStatus === "pending" && !profile?.operatorCourtIds?.length;
  const isRejected = profile?.applicationStatus === "rejected" && !profile?.operatorCourtIds?.length;
  // Payment gate: approved operators must have an active subscription before
  // they can use the dashboard. Behind a feature flag because Stripe isn't
  // wired yet — flip PAYMENT_GATING_ENABLED to enable.
  const needsPayment =
    PAYMENT_GATING_ENABLED &&
    profile?.applicationStatus === "approved" &&
    profile?.subscriptionStatus !== "active" &&
    profile?.subscriptionStatus !== "cancelling";

  return (
    <div className="flex min-h-screen bg-dash-bg">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-dash-border bg-dash-sidebar transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-dash-border px-6">
          <img src="/app-icon.png" alt="G.O.A.T.S" className="h-8 w-8 rounded-lg" />
          <div>
            <span className="font-display text-sm font-bold text-white">G.O.A.T.S</span>
            <span className="ml-2 rounded bg-teal/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal">
              Operator
            </span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-teal/10 text-teal"
                      : "text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Admin section — only for superadmins */}
          {profile?.isAdmin && (
            <div className="mt-6 border-t border-dash-border pt-4">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-dash-text-muted">
                Admin
              </p>
              <Link
                href="/admin"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  pathname === "/admin"
                    ? "bg-coral/10 text-coral"
                    : "text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text"
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v-2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                Operator Applications
              </Link>
            </div>
          )}
        </nav>

        {/* User info + sign out */}
        <div className="border-t border-dash-border p-4">
          <div className="mb-3 truncate text-xs text-dash-text-muted">
            {profile?.email || user.email}
          </div>
          <button
            onClick={async () => {
              await signOut(auth);
              router.push("/operator");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/30 transition-colors hover:bg-dash-surface-hover hover:text-white/60"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-dash-border px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-dash-text-muted lg:hidden"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            {isPending && (
              <span className="rounded-full bg-status-pending/10 px-3 py-1 text-xs font-semibold text-status-pending">
                Application Pending
              </span>
            )}
            {isRejected && (
              <span className="rounded-full bg-status-rejected/10 px-3 py-1 text-xs font-semibold text-status-rejected">
                Application Rejected
              </span>
            )}
          </div>
          <div />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 dash-scroll">
          {isPending ? (
            <PendingState />
          ) : isRejected ? (
            <RejectedState />
          ) : needsPayment ? (
            <PaymentRequiredState />
          ) : (
            <>
              {!isPending && !isRejected && profile?.operatorCourtIds?.length && profile.operatorCourtIds.length > 0 && (() => {
                // Show unpublished banner on all pages — reads the court doc's published field
                return <UnpublishedBanner courtId={profile.operatorCourtIds[0]} />;
              })()}
              {children}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function UnpublishedBanner({ courtId }: { courtId: string }) {
  const [published, setPublished] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "courts", courtId));
        if (snap.exists()) {
          setPublished(snap.data().published !== false);
        }
      } catch {
        // silent
      }
    })();
  }, [courtId]);

  if (published !== false) return null;

  return (
    <div className="mb-6 rounded-2xl border border-status-pending/30 bg-status-pending/5 px-5 py-4">
      <p className="font-display mb-1 text-xs font-bold uppercase tracking-widest text-status-pending">
        Court Not Yet Published
      </p>
      <p className="text-sm text-white/60">
        Complete your court details and click <span className="font-semibold text-white">Publish Court</span> on
        the My Court page to make it visible in the app.
      </p>
    </div>
  );
}

function PendingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-status-pending/10">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2 className="font-display mb-2 text-2xl font-bold text-white">Application Under Review</h2>
        <p className="text-sm leading-relaxed text-white/40">
          We&apos;re reviewing your application. This usually takes 24-48 hours.
          You&apos;ll get full access to your dashboard once approved.
        </p>
        <DeleteAccountButton />
      </div>
    </div>
  );
}

function RejectedState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-status-rejected/10">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 className="font-display mb-2 text-2xl font-bold text-white">Application Not Approved</h2>
        <p className="text-sm leading-relaxed text-white/40">
          Unfortunately your application wasn&apos;t approved at this time.
          If you believe this is a mistake, reach out to us.
        </p>
        <DeleteAccountButton />
      </div>
    </div>
  );
}

function PaymentRequiredState() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubscribe() {
    setLoading(true);
    setError("");
    try {
      const createCheckoutSession = httpsCallable(functions, "createCheckoutSession");
      const result = await createCheckoutSession();
      const url = (result.data as { url: string }).url;
      if (url) {
        window.location.href = url;
      } else {
        setError("Failed to create checkout session. Try again.");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg">
        {/* Pricing card — matches the signup page card */}
        <div className="relative overflow-hidden rounded-2xl border border-teal/20 bg-gradient-to-b from-dash-surface to-dash-bg">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal/8 blur-2xl" />
          <div className="absolute -left-4 bottom-0 h-24 w-24 rounded-full bg-teal/5 blur-xl" />

          <div className="relative p-8">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-teal/20 bg-teal/10 px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-teal animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal">
                You&apos;re approved
              </span>
            </div>

            <h2 className="font-display mb-1 text-2xl font-bold text-white">
              Activate Your Dashboard
            </h2>
            <p className="mb-6 text-sm text-white/40">
              Subscribe to start managing your court on G.O.A.T.S.
            </p>

            <div className="mb-6 flex items-baseline gap-1">
              <span className="font-display text-4xl font-extrabold tracking-tight text-white">$25</span>
              <span className="text-sm text-white/40">/mo</span>
            </div>

            <div className="mb-6 h-px bg-gradient-to-r from-transparent via-dash-border to-transparent" />

            <ul className="mb-8 space-y-3">
              {[
                "Real-time check-in analytics",
                "Player activity dashboard",
                "Push notifications to followers",
                "Court announcements & promos",
                "Custom schedule management",
                "Photo gallery management",
                "Verified badge on your court",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="text-sm leading-snug text-white/70">{feature}</span>
                </li>
              ))}
            </ul>

            {error && <p className="mb-4 text-sm text-coral">{error}</p>}

            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full rounded-xl bg-teal py-3.5 font-display text-sm font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal-dark disabled:opacity-50"
            >
              {loading ? "Redirecting to checkout..." : "Subscribe — $25/mo"}
            </button>

            <p className="mt-4 text-center text-xs text-white/30">
              Secure payment via Stripe. Cancel anytime.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountButton() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="mt-8">
      {error && <p className="mb-3 text-sm text-status-rejected">{error}</p>}

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="text-xs text-white/30 transition-colors hover:text-status-rejected"
        >
          Delete operator account
        </button>
      ) : (
        <div className="rounded-xl border border-status-rejected/30 bg-dash-bg p-5 text-left">
          <p className="mb-4 text-sm font-semibold text-white">
            Are you sure? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                setLoading(true);
                setError("");
                try {
                  const deleteFn = httpsCallable(functions, "deleteOperatorAccount");
                  await deleteFn();
                  await signOut(auth);
                  router.push("/operator");
                } catch (err: unknown) {
                  const msg = (err as { message?: string })?.message ?? "Failed to delete account";
                  setError(msg);
                  setShowConfirm(false);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="rounded-xl bg-status-rejected px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-status-rejected/80 disabled:opacity-50"
            >
              {loading ? "Deleting..." : "Yes, Delete"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-xl border border-dash-border px-5 py-2.5 text-xs text-white/40 hover:text-white/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
