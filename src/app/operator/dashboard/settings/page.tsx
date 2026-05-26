"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
} from "firebase/firestore";
import { auth, db, functions } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Court } from "@/lib/types";

interface PendingApp {
  id: string;
  type: "new_court" | "claim_existing";
  courtId?: string;
  courtName?: string;
}

export default function OperatorSettings() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billingLoading, setBillingLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showAddSuccess, setShowAddSuccess] = useState(false);

  const isSubscribed = profile?.subscriptionStatus === "active";
  const isCancelling = profile?.subscriptionStatus === "cancelling";
  const isFreeAccess = !!profile?.freeAccess;
  const hasAccess = isSubscribed || isCancelling;

  // Show + auto-dismiss success toast after coming back from add-court.
  useEffect(() => {
    if (searchParams.get("addCourt") === "success") {
      setShowAddSuccess(true);
      // Strip the query param so a reload doesn't re-show the toast.
      const url = new URL(window.location.href);
      url.searchParams.delete("addCourt");
      window.history.replaceState({}, "", url.toString());
      const timer = setTimeout(() => setShowAddSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  async function handleManageBilling() {
    setBillingLoading(true);
    try {
      const createBillingPortalSession = httpsCallable(functions, "createBillingPortalSession");
      const result = await createBillingPortalSession();
      const url = (result.data as { url: string }).url;
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error("Billing portal error:", err);
      alert("Failed to open billing portal. Try again.");
    } finally {
      setBillingLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-white">Account</h1>

      {showAddSuccess && (
        <div className="rounded-2xl border border-status-confirmed/30 bg-status-confirmed/5 px-5 py-4">
          <p className="font-display mb-1 text-xs font-bold uppercase tracking-widest text-status-confirmed">
            Application Submitted
          </p>
          <p className="text-sm text-white/60">
            Your new court application is under review. You&apos;ll see it in your sidebar
            as &quot;Pending&quot; until admin approves.
          </p>
        </div>
      )}

      {/* Manage Courts */}
      {user && profile?.operatorCourtIds && (
        <ManageCourtsSection
          uid={user.uid}
          operatorCourtIds={profile.operatorCourtIds}
          subscriptionQuantity={profile.subscriptionQuantity ?? 1}
          freeAccess={isFreeAccess}
        />
      )}

      {/* Account info */}
      <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
        <h3 className="font-display mb-4 text-sm font-bold uppercase tracking-widest text-white/40">
          Account
        </h3>
        <div className="space-y-3">
          <SettingsRow label="Email" value={profile?.email ?? "—"} />
          <SettingsRow label="Username" value={profile?.username ?? "—"} />
          <SettingsRow
            label="Subscription"
            value={
              isSubscribed ? "Active" :
              isCancelling ? `Cancelled — active until ${
                profile?.subscriptionExpiresAt
                  ? new Date(profile.subscriptionExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                  : "period ends"
              }` :
              profile?.subscriptionStatus === "past_due" ? "Past Due" :
              profile?.subscriptionStatus === "cancelled" ? "Cancelled" :
              "Not active"
            }
            valueColor={
              isSubscribed ? "text-status-confirmed" :
              isCancelling ? "text-status-pending" :
              profile?.subscriptionStatus === "past_due" ? "text-status-pending" :
              "text-white/40"
            }
          />
        </div>
      </div>

      {/* Subscription management */}
      <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
        <h3 className="font-display mb-2 text-sm font-bold uppercase tracking-widest text-white/40">
          Subscription
        </h3>

        {hasAccess ? (
          <div className="space-y-4">
            <p className="text-sm text-white/40">
              {isCancelling
                ? `Your subscription has been cancelled. You still have full access until ${
                    profile?.subscriptionExpiresAt
                      ? new Date(profile.subscriptionExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                      : "the end of your billing period"
                  }.`
                : "Your operator subscription is active. Manage your billing, update your card, or cancel from the Stripe portal. When you cancel, you keep access until the end of your current billing period."}
            </p>
            <button
              onClick={handleManageBilling}
              disabled={billingLoading}
              className="rounded-xl border border-dash-border bg-dash-bg px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-white/70 transition-all hover:border-teal/40 hover:text-white disabled:opacity-50"
            >
              {billingLoading ? "Opening..." : "Manage Billing"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-white/40">
              {profile?.subscriptionStatus === "cancelled"
                ? "Your subscription has been cancelled. Resubscribe to regain access."
                : profile?.subscriptionStatus === "past_due"
                  ? "Your last payment failed. Please update your payment method."
                  : "No active subscription."}
            </p>
            {(profile?.subscriptionStatus === "cancelled" || profile?.subscriptionStatus === "past_due") && (
              <button
                onClick={handleManageBilling}
                disabled={billingLoading}
                className="rounded-xl bg-teal px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal-dark disabled:opacity-50"
              >
                {billingLoading ? "Opening..." : profile?.subscriptionStatus === "past_due" ? "Update Payment Method" : "Resubscribe"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete account */}
      <div className="rounded-2xl border border-status-rejected/20 bg-status-rejected/5 p-6">
        <h3 className="font-display mb-2 text-sm font-bold uppercase tracking-widest text-status-rejected/60">
          Delete Operator Account
        </h3>
        <p className="mb-4 text-sm text-white/40">
          This permanently deletes your operator account. Your player account on the app (if existent) is not affected.
        </p>

        {isSubscribed && !isCancelling && !isFreeAccess ? (
          <p className="text-sm text-status-rejected/70">
            You must cancel your subscription before you can delete your account.
            Use the Manage Billing button above to cancel first.
          </p>
        ) : (
          <>
            {deleteError && <p className="mb-3 text-sm text-status-rejected">{deleteError}</p>}

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-xl border border-status-rejected/30 px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-status-rejected transition-all hover:bg-status-rejected/10"
              >
                Delete Operator Account
              </button>
            ) : (
              <div className="rounded-xl border border-status-rejected/30 bg-dash-bg p-5">
                <p className="mb-4 text-sm font-semibold text-white">
                  Are you sure? This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      setDeleteLoading(true);
                      setDeleteError("");
                      try {
                        const deleteFn = httpsCallable(functions, "deleteOperatorAccount");
                        await deleteFn();
                        await signOut(auth);
                        router.push("/operator");
                      } catch (err: unknown) {
                        const msg = (err as { message?: string })?.message ?? "Failed to delete account";
                        setDeleteError(msg);
                        setShowDeleteConfirm(false);
                      } finally {
                        setDeleteLoading(false);
                      }
                    }}
                    disabled={deleteLoading}
                    className="rounded-xl bg-status-rejected px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-status-rejected/80 disabled:opacity-50"
                  >
                    {deleteLoading ? "Deleting..." : "Yes, Delete My Account"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-xl border border-dash-border px-5 py-2.5 text-xs text-white/40 hover:text-white/60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SettingsRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-white/40">{label}</span>
      <span className={`text-sm font-medium ${valueColor ?? "text-white"}`}>{value}</span>
    </div>
  );
}

function ManageCourtsSection({
  uid,
  operatorCourtIds,
  subscriptionQuantity,
  freeAccess,
}: {
  uid: string;
  operatorCourtIds: string[];
  subscriptionQuantity: number;
  freeAccess: boolean;
}) {
  const [courts, setCourts] = useState<Court[]>([]);
  const [pending, setPending] = useState<PendingApp[]>([]);
  const [claimedCourtNames, setClaimedCourtNames] = useState<Record<string, string>>({});

  // Subscribe to each operatorCourtIds doc.
  useEffect(() => {
    if (operatorCourtIds.length === 0) {
      setCourts([]);
      return;
    }
    const unsubs: Unsubscribe[] = [];
    const map = new Map<string, Court>();
    operatorCourtIds.forEach((id) => {
      const unsub = onSnapshot(doc(db, "courts", id), (snap) => {
        if (snap.exists()) {
          map.set(id, { id: snap.id, ...snap.data() } as Court);
        } else {
          map.delete(id);
        }
        setCourts(operatorCourtIds.map((cid) => map.get(cid)).filter(Boolean) as Court[]);
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((u) => u());
  }, [operatorCourtIds]);

  useEffect(() => {
    const q = query(
      collection(db, "operator_applications"),
      where("applicantId", "==", uid),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(q, (snap) => {
      const apps: PendingApp[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type,
          courtId: data.courtId,
          courtName: data.courtData?.name,
        };
      });
      setPending(apps);
    });
    return unsub;
  }, [uid]);

  // Fetch names for claim_existing pending apps.
  useEffect(() => {
    const idsToFetch = pending
      .filter((p) => p.type === "claim_existing" && p.courtId && !claimedCourtNames[p.courtId])
      .map((p) => p.courtId!) as string[];
    if (idsToFetch.length === 0) return;
    const unsubs: Unsubscribe[] = [];
    idsToFetch.forEach((id) => {
      const unsub = onSnapshot(doc(db, "courts", id), (snap) => {
        if (snap.exists()) {
          setClaimedCourtNames((prev) => ({ ...prev, [id]: snap.data().name ?? "Court" }));
        }
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((u) => u());
  }, [pending, claimedCourtNames]);

  // Order courts by approvedAt ASC (legacy courts sort first).
  const orderedCourts = [...courts].sort((a, b) => {
    const toMillis = (c: Court): number => {
      const ts = c.approvedAt as { toMillis?: () => number } | undefined;
      if (ts && typeof ts.toMillis === "function") {
        try { return ts.toMillis(); } catch { return 0; }
      }
      return 0;
    };
    return toMillis(a) - toMillis(b);
  });

  const activeThreshold = freeAccess ? Infinity : subscriptionQuantity;

  return (
    <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white/40">
            Manage Courts
          </h3>
          <p className="mt-1 text-xs text-white/30">
            {orderedCourts.length} court{orderedCourts.length === 1 ? "" : "s"} in your portfolio
            {pending.length > 0 && ` · ${pending.length} pending`}
          </p>
        </div>
        <Link
          href="/operator/dashboard/add-court"
          className="rounded-xl bg-teal px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal-dark"
        >
          + Add Court
        </Link>
      </div>

      <div className="space-y-2">
        {orderedCourts.length === 0 && pending.length === 0 ? (
          <p className="rounded-xl bg-dash-bg px-4 py-6 text-center text-sm text-white/30">
            No courts yet.
          </p>
        ) : (
          <>
            {orderedCourts.map((court, index) => {
              const isLocked = index >= activeThreshold;
              return (
                <div
                  key={court.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-dash-border bg-dash-bg px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{court.name}</p>
                    <p className="truncate text-xs text-white/40">{court.address}</p>
                  </div>
                  {isLocked ? (
                    <span className="shrink-0 rounded-full bg-status-pending/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-status-pending">
                      Locked
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-status-confirmed/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-status-confirmed">
                      Active
                    </span>
                  )}
                </div>
              );
            })}
            {pending.map((p) => {
              const name = p.type === "new_court"
                ? (p.courtName ?? "New court")
                : (p.courtId ? (claimedCourtNames[p.courtId] ?? "Court") : "Court");
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-dash-border bg-dash-bg px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{name}</p>
                    <p className="truncate text-xs text-white/40">
                      {p.type === "new_court" ? "New court submission" : "Claim request"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-status-pending/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-status-pending">
                    Pending
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
