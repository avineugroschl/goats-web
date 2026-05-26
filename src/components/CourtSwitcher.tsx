"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Court } from "@/lib/types";
import { useSelectedCourt, useSelectedCourtSetter } from "@/lib/selected-court";

interface PendingApp {
  id: string;
  type: "new_court" | "claim_existing";
  status: "pending" | "approved" | "rejected";
  courtId?: string;
  courtName?: string;
}

interface CourtSwitcherProps {
  uid: string;
  operatorCourtIds: string[];
  subscriptionQuantity: number;
  freeAccess?: boolean;
  onActivateCourt: (court: Court) => void;
}

// Sidebar dropdown listing the operator's courts. Active courts are
// selectable; courts beyond the paid subscription quantity are locked and
// open the activation modal; pending applications appear at the bottom as
// non-clickable rows with a "Pending" badge.
export function CourtSwitcher({
  uid,
  operatorCourtIds,
  subscriptionQuantity,
  freeAccess,
  onActivateCourt,
}: CourtSwitcherProps) {
  const selectedCourtId = useSelectedCourt();
  const setSelectedCourtId = useSelectedCourtSetter();

  const [courts, setCourts] = useState<Court[]>([]);
  const [pending, setPending] = useState<PendingApp[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Live-subscribe to each court doc (typically 1-3 courts; N individual
  // listeners is fine and avoids the `in` query 30-id cap).
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

  // Live-subscribe to pending operator_applications for this user.
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
          status: data.status,
          courtId: data.courtId,
          courtName: data.courtData?.name,
        };
      });
      setPending(apps);
    });
    return unsub;
  }, [uid]);

  // Resolve names for claim_existing pending apps (we have a courtId but no name yet).
  const [claimedCourtNames, setClaimedCourtNames] = useState<Record<string, string>>({});
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

  // Order courts by approvedAt ASC (legacy/admin-created courts without
  // approvedAt sort first — their toMillis fallback is 0).
  const orderedCourts = useMemo(() => {
    const toMillis = (c: Court): number => {
      const ts = c.approvedAt as { toMillis?: () => number } | undefined;
      if (ts && typeof ts.toMillis === "function") {
        try { return ts.toMillis(); } catch { return 0; }
      }
      return 0;
    };
    return [...courts].sort((a, b) => toMillis(a) - toMillis(b));
  }, [courts]);

  const lockedThreshold = freeAccess ? Infinity : subscriptionQuantity;

  const selectedCourt = orderedCourts.find((c) => c.id === selectedCourtId) ?? orderedCourts[0];

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSelect(court: Court, index: number) {
    const isLocked = index >= lockedThreshold;
    if (isLocked) {
      onActivateCourt(court);
      setOpen(false);
      return;
    }
    setSelectedCourtId(court.id);
    setOpen(false);
  }

  if (orderedCourts.length === 0 && pending.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-dash-surface-hover"
      >
        <span className="truncate text-sm font-semibold text-white">
          {selectedCourt?.name ?? "Select a court"}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-dash-border bg-dash-sidebar shadow-2xl shadow-black/60">
          <div className="max-h-80 overflow-y-auto py-1">
            {orderedCourts.map((court, index) => {
              const isLocked = index >= lockedThreshold;
              const isSelected = court.id === selectedCourt?.id && !isLocked;
              return (
                <button
                  key={court.id}
                  type="button"
                  onClick={() => handleSelect(court, index)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? "bg-teal/10 text-teal"
                      : isLocked
                        ? "text-white/40 hover:bg-dash-surface-hover"
                        : "text-white/80 hover:bg-dash-surface-hover hover:text-white"
                  }`}
                >
                  <span className="truncate text-sm font-medium">{court.name}</span>
                  {isLocked && (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-status-pending">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                      Activate
                    </span>
                  )}
                  {isSelected && !isLocked && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })}

            {pending.length > 0 && (
              <div className="my-1 border-t border-dash-border" />
            )}

            {pending.map((p) => {
              const name = p.type === "new_court"
                ? (p.courtName ?? "New court")
                : (p.courtId ? (claimedCourtNames[p.courtId] ?? "Court") : "Court");
              return (
                <div
                  key={p.id}
                  className="flex cursor-not-allowed items-center justify-between gap-2 px-3 py-2 text-white/30"
                >
                  <span className="truncate text-sm font-medium">{name}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-status-pending">
                    Pending
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
