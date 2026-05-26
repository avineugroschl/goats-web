"use client";

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useSelectedCourt } from "@/lib/selected-court";
import { Court } from "@/lib/types";

interface SentNotification {
  id: string;
  message: string;
  sentAt: Timestamp | null;
  sentBy: string;
  recipientCount?: number;
}

const MAX_PER_DAY = 2;

export default function NotificationsPage() {
  const { profile } = useAuth();
  const courtId = useSelectedCourt();

  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [sentToday, setSentToday] = useState(0);
  const [history, setHistory] = useState<SentNotification[]>([]);
  const [message, setMessage] = useState("");
  const [alsoSetBanner, setAlsoSetBanner] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Load court
  useEffect(() => {
    if (!courtId) { setLoading(false); return; }
    (async () => {
      const snap = await getDoc(doc(db, "courts", courtId));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Court;
        setCourt(data);
        setNotificationsEnabled(data.notificationsEnabled ?? false);
      }
      setLoading(false);
    })();
  }, [courtId]);

  // Live follower count
  useEffect(() => {
    if (!courtId) return;
    const q = query(
      collection(db, "courts", courtId, "followers"),
      where("active", "==", true)
    );
    const unsub = onSnapshot(q, (snap) => {
      setFollowerCount(snap.size);
    });
    return unsub;
  }, [courtId]);

  // Notification history + sent-today count
  useEffect(() => {
    if (!courtId) return;
    const unsub = onSnapshot(
      query(
        collection(db, "courts", courtId, "notifications"),
        orderBy("sentAt", "desc")
      ),
      (snap) => {
        const notifs = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as SentNotification[];
        setHistory(notifs);

        // Count how many were sent today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayCount = notifs.filter((n) => {
          if (!n.sentAt) return false;
          return n.sentAt.toDate() >= todayStart;
        }).length;
        setSentToday(todayCount);
      }
    );
    return unsub;
  }, [courtId]);

  async function handleToggle() {
    if (!courtId) return;
    setSaving(true);
    const newVal = !notificationsEnabled;
    try {
      await updateDoc(doc(db, "courts", courtId), {
        notificationsEnabled: newVal,
      });
      setNotificationsEnabled(newVal);
    } catch (err) {
      console.error(err);
      setError("Failed to update. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!courtId || !profile || !message.trim()) return;
    if (sentToday >= MAX_PER_DAY) {
      setError(`You've already sent ${MAX_PER_DAY} notifications today.`);
      return;
    }
    setSending(true);
    setError("");
    setSendSuccess(false);
    try {
      await addDoc(collection(db, "courts", courtId, "notifications"), {
        message: message.trim(),
        sentAt: serverTimestamp(),
        sentBy: profile.id,
        courtId,
        courtName: court?.name ?? "",
        alsoSetBanner,
      });
      setMessage("");
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to send. Try again.");
    } finally {
      setSending(false);
    }
  }

  const canSend = notificationsEnabled && sentToday < MAX_PER_DAY && message.trim().length > 0;
  const remaining = MAX_PER_DAY - sentToday;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-dash-surface" />
        <div className="h-64 animate-pulse rounded-2xl bg-dash-surface" />
      </div>
    );
  }

  if (!courtId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40">No court assigned yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Notifications</h1>
        <p className="text-sm text-dash-text-muted">
          Send push notifications to players who follow your court
        </p>
      </div>

      {/* Enable toggle */}
      <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
        <div className="flex items-start gap-4">
          <button onClick={handleToggle} disabled={saving} className="mt-0.5">
            <div className={`relative h-7 w-12 rounded-full transition-colors ${
              notificationsEnabled ? "bg-teal" : "bg-dash-border"
            }`}>
              <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                notificationsEnabled ? "translate-x-5" : "translate-x-0.5"
              }`} />
            </div>
          </button>
          <div>
            <p className="font-display text-sm font-bold text-white">
              {notificationsEnabled ? "Notifications Enabled" : "Notifications Disabled"}
            </p>
            <p className="text-xs text-white/40">
              {notificationsEnabled
                ? "Players see a 'Get Notifications' button on your court page and can opt in to receive your messages."
                : "Turn this on to let players opt in to push notifications from your court."}
            </p>
          </div>
        </div>

        {notificationsEnabled && (
          <div className="mt-5 flex items-center gap-6">
            <div className="rounded-xl bg-dash-bg px-5 py-3 text-center">
              <p className="font-display text-2xl font-bold text-teal">{followerCount}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                {followerCount === 1 ? "Follower" : "Followers"}
              </p>
            </div>
            <div className="rounded-xl bg-dash-bg px-5 py-3 text-center">
              <p className="font-display text-2xl font-bold text-white">{remaining}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                Sends left today
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Send notification */}
      {notificationsEnabled && (
        <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
          <h3 className="font-display mb-1 text-lg font-bold text-white">Send a Notification</h3>
          <p className="mb-5 text-xs text-white/40">
            Max {MAX_PER_DAY} per day. Keep it short — this goes straight to their lock screen.
          </p>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder='e.g. "Open gym tonight 7-10pm!" or "New nets just installed, come check them out"'
            className="mb-3 w-full resize-none rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-teal"
          />

          <button
            onClick={() => setAlsoSetBanner(!alsoSetBanner)}
            className="mb-4 flex items-center gap-3 text-sm text-white/60"
          >
            <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
              alsoSetBanner ? "border-teal bg-teal" : "border-white/20"
            }`}>
              {alsoSetBanner && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
            Also set as court banner
          </button>

          <div className="flex items-center justify-between">
            <span className="text-xs text-white/30">{message.length}/200</span>
            <div className="flex items-center gap-3">
              {sendSuccess && (
                <span className="text-xs text-status-confirmed">Sent!</span>
              )}
              {error && (
                <span className="text-xs text-coral">{error}</span>
              )}
              <button
                onClick={handleSend}
                disabled={!canSend || sending}
                className="rounded-xl bg-teal px-6 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal-dark disabled:opacity-50"
              >
                {sending ? "Sending..." : `Send to ${followerCount} follower${followerCount !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {notificationsEnabled && history.length > 0 && (
        <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
          <h3 className="font-display mb-4 text-sm font-bold uppercase tracking-widest text-white/40">
            Sent Notifications
          </h3>
          <div className="space-y-3">
            {history.map((n) => (
              <div key={n.id} className="rounded-xl border border-dash-border bg-dash-bg px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-white/80">{n.message}</p>
                  {n.recipientCount !== undefined && (
                    <span className="shrink-0 rounded-full bg-teal/10 px-2 py-0.5 text-[10px] font-bold text-teal">
                      Sent to {n.recipientCount} follower{n.recipientCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-white/30">
                  {n.sentAt
                    ? n.sentAt.toDate().toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Sending..."}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
