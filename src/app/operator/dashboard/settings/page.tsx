"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

export default function OperatorSettings() {
  const { profile } = useAuth();
  const router = useRouter();
  const [billingLoading, setBillingLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const isSubscribed = profile?.subscriptionStatus === "active";
  const isCancelling = profile?.subscriptionStatus === "cancelling";
  const hasAccess = isSubscribed || isCancelling;

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

        {isSubscribed && !isCancelling ? (
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
