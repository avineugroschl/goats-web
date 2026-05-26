"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Court } from "@/lib/types";

const PRICE_PER_COURT = 25; // $/mo per court

interface ActivateCourtModalProps {
  court: Court;
  currentQuantity: number;
  onClose: () => void;
  onActivated: () => void;
}

export function ActivateCourtModal({
  court,
  currentQuantity,
  onClose,
  onActivated,
}: ActivateCourtModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const newQuantity = currentQuantity + 1;
  const newMonthly = newQuantity * PRICE_PER_COURT;

  async function handleActivate() {
    setSubmitting(true);
    setError("");
    try {
      const activateCourt = httpsCallable(functions, "activateCourt");
      await activateCourt({ courtId: court.id });
      onActivated();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Failed to activate court. Try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-dash-border bg-dash-surface p-6 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal/10 text-teal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-white">Activate Court</h3>
            <p className="text-xs text-white/40">{court.name}</p>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-dash-border bg-dash-bg p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wider text-white/40">New monthly bill</span>
            <span className="font-display text-2xl font-bold text-white">
              ${newMonthly}<span className="text-sm text-white/40">/mo</span>
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-white/60">
            <div className="flex justify-between">
              <span>Current</span>
              <span>${currentQuantity * PRICE_PER_COURT}/mo ({currentQuantity} court{currentQuantity === 1 ? "" : "s"})</span>
            </div>
            <div className="flex justify-between">
              <span>Adding</span>
              <span>+${PRICE_PER_COURT}/mo (1 court)</span>
            </div>
          </div>
        </div>

        <p className="mb-5 text-xs leading-relaxed text-white/40">
          You&apos;ll be charged a prorated amount today for the remainder of this billing
          cycle. Your next monthly bill will be ${newMonthly}.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-status-rejected/10 px-3 py-2 text-sm text-status-rejected">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleActivate}
            disabled={submitting}
            className="flex-1 rounded-xl bg-teal px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal-dark disabled:opacity-50"
          >
            {submitting ? "Activating..." : "Activate"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-dash-border px-5 py-3 text-xs text-white/60 transition-colors hover:text-white/80 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
