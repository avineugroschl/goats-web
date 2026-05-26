"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useSelectedCourt } from "@/lib/selected-court";
import { Reservation, TimeSlot } from "@/lib/types";
import { RESERVATIONS_ENABLED } from "@/lib/features";

type ViewMode = "upcoming" | "past" | "slots";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending_approval: { bg: "bg-status-pending/10", text: "text-status-pending", label: "Pending" },
  confirmed: { bg: "bg-status-confirmed/10", text: "text-status-confirmed", label: "Confirmed" },
  rejected: { bg: "bg-status-rejected/10", text: "text-status-rejected", label: "Rejected" },
  cancelled: { bg: "bg-white/5", text: "text-white/40", label: "Cancelled" },
  expired: { bg: "bg-white/5", text: "text-white/40", label: "Expired" },
  manual: { bg: "bg-status-manual/10", text: "text-status-manual", label: "Manual" },
};

export default function CalendarPage() {
  // Reservations are gated behind a feature flag for now. The full
  // implementation below stays in the file so we can re-enable it instantly
  // by flipping RESERVATIONS_ENABLED.
  if (!RESERVATIONS_ENABLED) {
    return <ReservationsDisabled />;
  }

  return <CalendarPageImpl />;
}

function ReservationsDisabled() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-dash-surface">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <h2 className="font-display mb-2 text-2xl font-bold text-white">Reservations Coming Soon</h2>
        <p className="text-sm leading-relaxed text-white/40">
          Court booking and reservation management aren&apos;t available in this
          version yet. Check back soon.
        </p>
      </div>
    </div>
  );
}

function CalendarPageImpl() {
  const { profile } = useAuth();
  const courtId = useSelectedCourt();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("upcoming");
  const [showManualForm, setShowManualForm] = useState(false);
  const [showSlotConfig, setShowSlotConfig] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Manual reservation form
  const [manualDate, setManualDate] = useState("");
  const [manualStart, setManualStart] = useState("18:00");
  const [manualEnd, setManualEnd] = useState("19:00");
  const [manualNote, setManualNote] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Slot config
  const [slots, setSlots] = useState<Record<string, TimeSlot[]>>({});
  const [reservationsEnabled, setReservationsEnabled] = useState(false);
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotSaved, setSlotSaved] = useState(false);

  useEffect(() => {
    if (!courtId) { setLoading(false); return; }
    loadReservations(courtId);
    loadSlotConfig(courtId);
  }, [courtId]);

  async function loadReservations(cId: string) {
    setLoading(true);
    try {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];

      // Load all reservations for this court
      const resQuery = query(
        collection(db, "reservations"),
        where("courtId", "==", cId),
        orderBy("date", "desc"),
        orderBy("startTime", "asc")
      );
      try {
        const snap = await getDocs(resQuery);
        setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)));
      } catch {
        // Index may not exist yet
        setReservations([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadSlotConfig(cId: string) {
    try {
      const courtDoc = await getDocs(query(collection(db, "courts"), where("__name__", "==", cId)));
      if (!courtDoc.empty) {
        const data = courtDoc.docs[0].data();
        setSlots(data.reservationSlots ?? {});
        setReservationsEnabled(data.reservationsEnabled ?? false);
      }
    } catch {}
  }

  async function handleApprove(reservation: Reservation) {
    setActionLoading(reservation.id);
    try {
      await updateDoc(doc(db, "reservations", reservation.id), {
        status: "confirmed",
        updatedAt: serverTimestamp(),
        confirmedAt: serverTimestamp(),
      });
      setReservations((prev) =>
        prev.map((r) => (r.id === reservation.id ? { ...r, status: "confirmed" } : r))
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(reservation: Reservation) {
    const reason = prompt("Reason for rejection (optional):");
    setActionLoading(reservation.id);
    try {
      await updateDoc(doc(db, "reservations", reservation.id), {
        status: "rejected",
        rejectionReason: reason || "",
        updatedAt: serverTimestamp(),
      });
      setReservations((prev) =>
        prev.map((r) => (r.id === reservation.id ? { ...r, status: "rejected" } : r))
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleManualAdd() {
    if (!courtId || !manualDate || !manualStart || !manualEnd) return;
    setManualSubmitting(true);
    try {
      const newRes: Record<string, unknown> = {
        courtId,
        operatorId: profile?.id ?? "",
        userId: null,
        userName: null,
        date: manualDate,
        startTime: manualStart,
        endTime: manualEnd,
        price: 0,
        status: "manual",
        operatorNote: manualNote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, "reservations"), newRes);
      setReservations((prev) => [
        { id: docRef.id, ...newRes, status: "manual" } as Reservation,
        ...prev,
      ]);
      setManualDate("");
      setManualStart("18:00");
      setManualEnd("19:00");
      setManualNote("");
      setShowManualForm(false);
    } finally {
      setManualSubmitting(false);
    }
  }

  async function saveSlotConfig() {
    if (!courtId) return;
    setSlotSaving(true);
    setSlotSaved(false);
    try {
      await updateDoc(doc(db, "courts", courtId), {
        reservationSlots: slots,
        reservationsEnabled,
      });
      setSlotSaved(true);
      setTimeout(() => setSlotSaved(false), 2000);
    } finally {
      setSlotSaving(false);
    }
  }

  function addSlot(day: string) {
    setSlots((prev) => ({
      ...prev,
      [day]: [...(prev[day] ?? []), { start: "18:00", end: "19:00", price: 3000 }],
    }));
  }

  function removeSlot(day: string, idx: number) {
    setSlots((prev) => ({
      ...prev,
      [day]: prev[day]?.filter((_, i) => i !== idx) ?? [],
    }));
  }

  function updateSlot(day: string, idx: number, field: keyof TimeSlot, value: string | number) {
    setSlots((prev) => ({
      ...prev,
      [day]: prev[day]?.map((s, i) => (i === idx ? { ...s, [field]: value } : s)) ?? [],
    }));
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const upcoming = reservations.filter(
    (r) => r.date >= todayStr && r.status !== "rejected" && r.status !== "cancelled" && r.status !== "expired"
  );
  const past = reservations.filter(
    (r) => r.date < todayStr || r.status === "rejected" || r.status === "cancelled" || r.status === "expired"
  );
  const pending = upcoming.filter((r) => r.status === "pending_approval");

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-dash-surface" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-dash-surface" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Calendar</h1>
          {pending.length > 0 && (
            <p className="text-sm text-status-pending">
              {pending.length} reservation{pending.length !== 1 ? "s" : ""} awaiting approval
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSlotConfig(!showSlotConfig)}
            className="rounded-xl border border-dash-border px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-dash-text-muted transition-colors hover:border-teal hover:text-teal"
          >
            {showSlotConfig ? "Hide Slots" : "Configure Slots"}
          </button>
          <button
            onClick={() => setShowManualForm(!showManualForm)}
            className="rounded-xl bg-teal px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal-dark"
          >
            + Manual Entry
          </button>
        </div>
      </div>

      {/* Slot configuration */}
      {showSlotConfig && (
        <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-white">Reservation Slot Config</h3>
            <button
              onClick={() => setReservationsEnabled(!reservationsEnabled)}
              className="flex items-center gap-3"
            >
              <div className={`relative h-7 w-12 rounded-full transition-colors ${
                reservationsEnabled ? "bg-teal" : "bg-dash-border"
              }`}>
                <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  reservationsEnabled ? "translate-x-5" : "translate-x-0.5"
                }`} />
              </div>
              <span className={`font-display text-xs font-bold ${reservationsEnabled ? "text-teal" : "text-white/40"}`}>
                {reservationsEnabled ? "Reservations On" : "Reservations Off"}
              </span>
            </button>
          </div>

          <div className="space-y-4">
            {DAYS.map((day, di) => (
              <div key={day}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{DAY_LABELS[di]}</span>
                  <button
                    onClick={() => addSlot(day)}
                    className="text-xs text-teal hover:text-teal-dark"
                  >
                    + Add Slot
                  </button>
                </div>
                {(slots[day] ?? []).length === 0 ? (
                  <p className="text-xs text-white/20">No slots — click + Add Slot</p>
                ) : (
                  <div className="space-y-2">
                    {(slots[day] ?? []).map((slot, si) => (
                      <div key={si} className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-bg px-3 py-2">
                        <input
                          type="time"
                          value={slot.start}
                          onChange={(e) => updateSlot(day, si, "start", e.target.value)}
                          className="rounded border border-dash-border bg-dash-surface px-2 py-1 text-xs text-white outline-none focus:border-teal"
                        />
                        <span className="text-xs text-white/30">to</span>
                        <input
                          type="time"
                          value={slot.end}
                          onChange={(e) => updateSlot(day, si, "end", e.target.value)}
                          className="rounded border border-dash-border bg-dash-surface px-2 py-1 text-xs text-white outline-none focus:border-teal"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-white/30">$</span>
                          <input
                            type="number"
                            value={slot.price / 100}
                            onChange={(e) => updateSlot(day, si, "price", Math.round(parseFloat(e.target.value || "0") * 100))}
                            className="w-16 rounded border border-dash-border bg-dash-surface px-2 py-1 text-xs text-white outline-none focus:border-teal"
                          />
                        </div>
                        <button
                          onClick={() => removeSlot(day, si)}
                          className="ml-auto text-white/20 hover:text-status-rejected"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={saveSlotConfig}
            disabled={slotSaving}
            className={`mt-6 rounded-xl px-6 py-2.5 font-display text-sm font-bold uppercase tracking-wider transition-all ${
              slotSaved
                ? "bg-status-confirmed text-white"
                : "bg-teal text-surface-dark hover:bg-teal-dark"
            } disabled:opacity-50`}
          >
            {slotSaved ? "Saved!" : slotSaving ? "Saving..." : "Save Slot Config"}
          </button>
        </div>
      )}

      {/* Manual entry form */}
      {showManualForm && (
        <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
          <h3 className="font-display mb-4 text-lg font-bold text-white">Add Manual Reservation</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">Date</label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white outline-none focus:border-teal"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">Start</label>
              <input
                type="time"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white outline-none focus:border-teal"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">End</label>
              <input
                type="time"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                className="w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white outline-none focus:border-teal"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">Note (optional)</label>
            <input
              type="text"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="e.g. League game, Private event, Maintenance"
              className="w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-teal"
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleManualAdd}
              disabled={manualSubmitting || !manualDate}
              className="rounded-xl bg-teal px-6 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal-dark disabled:opacity-50"
            >
              {manualSubmitting ? "Adding..." : "Add Reservation"}
            </button>
            <button
              onClick={() => setShowManualForm(false)}
              className="font-display text-xs font-bold text-white/40 hover:text-white/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* View mode tabs */}
      <div className="flex gap-1 rounded-xl bg-dash-surface p-1">
        {[
          { id: "upcoming" as const, label: `Upcoming (${upcoming.length})` },
          { id: "past" as const, label: `Past (${past.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`flex-1 rounded-lg py-2.5 font-display text-sm font-bold transition-all ${
              viewMode === tab.id
                ? "bg-teal text-surface-dark"
                : "text-dash-text-muted hover:text-dash-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reservation list */}
      <div className="space-y-3">
        {(viewMode === "upcoming" ? upcoming : past).length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dash-border bg-dash-surface py-16">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p className="mt-3 text-sm text-white/30">
              No {viewMode === "upcoming" ? "upcoming" : "past"} reservations
            </p>
          </div>
        ) : (
          (viewMode === "upcoming" ? upcoming : past).map((res) => {
            const style = STATUS_STYLES[res.status] ?? STATUS_STYLES.cancelled;
            const dateObj = new Date(res.date + "T00:00:00");
            const dateStr = dateObj.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });

            return (
              <div
                key={res.id}
                className="flex items-center gap-4 rounded-2xl border border-dash-border bg-dash-surface px-5 py-4"
              >
                {/* Date block */}
                <div className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-dash-bg">
                  <span className="text-[10px] font-bold uppercase text-dash-text-muted">
                    {dateObj.toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="font-display text-xl font-bold text-white">
                    {dateObj.getDate()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {formatTime(res.startTime)} – {formatTime(res.endTime)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </div>
                  <p className="text-xs text-white/40">
                    {res.status === "manual"
                      ? res.operatorNote || "Manual reservation"
                      : res.userName || "User reservation"}
                    {res.price > 0 && ` · $${(res.price / 100).toFixed(2)}`}
                  </p>
                </div>

                {/* Actions */}
                {res.status === "pending_approval" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(res)}
                      disabled={actionLoading === res.id}
                      className="rounded-lg bg-status-confirmed/10 px-3 py-1.5 text-xs font-bold text-status-confirmed transition-colors hover:bg-status-confirmed/20 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(res)}
                      disabled={actionLoading === res.id}
                      className="rounded-lg bg-status-rejected/10 px-3 py-1.5 text-xs font-bold text-status-rejected transition-colors hover:bg-status-rejected/20 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${m.toString().padStart(2, "0")}${period}`;
}
