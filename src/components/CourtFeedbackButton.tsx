"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const MAX_MESSAGE = 2000;
const MAX_EMAIL = 200;

// A gentle "Edits, thoughts, or comments?" prompt on each court page. Opens a
// lightweight overlay where anyone (no sign-in) can leave a note about the
// court plus an optional email. Writes to the `court_feedback` collection,
// keyed by court, for review in the admin dashboard.
export default function CourtFeedbackButton({
  courtId,
  courtName,
  courtSlug,
}: {
  courtId: string;
  courtName: string;
  courtSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    // Reset a moment after the overlay is gone so the form is fresh next open.
    setTimeout(() => {
      setMessage("");
      setEmail("");
      setError("");
      setDone(false);
      setSubmitting(false);
    }, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Please add a note first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await addDoc(collection(db, "court_feedback"), {
        courtId,
        courtName,
        courtSlug,
        message: trimmed.slice(0, MAX_MESSAGE),
        email: email.trim().slice(0, MAX_EMAIL),
        status: "new",
        createdAt: serverTimestamp(),
        userAgent:
          typeof navigator !== "undefined"
            ? navigator.userAgent.slice(0, 300)
            : "",
        pageUrl:
          typeof window !== "undefined" ? window.location.href : "",
      });
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="mb-4 w-full rounded-2xl border border-teal/20 bg-surface p-4 text-center text-sm font-medium text-teal shadow-sm transition-colors hover:bg-teal-light"
      >
        Edits, thoughts, or comments?
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={close}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-black/5 hover:text-text-primary"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {done ? (
              <div className="py-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-light text-teal">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-text-primary">
                  Thanks, we appreciate it.
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  Your note about {courtName} came through.
                </p>
                <button
                  onClick={close}
                  className="mt-5 rounded-full bg-coral px-6 py-2.5 font-semibold text-text-on-dark transition-colors hover:bg-coral-dark"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h2 className="mb-1 text-xl font-bold text-text-primary">
                  Edits, thoughts, or comments?
                </h2>
                <p className="mb-4 text-sm text-text-secondary">
                  Tell us anything about {courtName}: a correction, an idea, or
                  just your take.
                </p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={MAX_MESSAGE}
                  rows={5}
                  placeholder="Share your thoughts here..."
                  autoFocus
                  className="w-full resize-none rounded-xl border border-black/10 bg-surface p-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-teal"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={MAX_EMAIL}
                  placeholder="Email (optional)"
                  className="mt-3 w-full rounded-xl border border-black/10 bg-surface p-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-teal"
                />
                {error && <p className="mt-2 text-sm text-coral">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting || !message.trim()}
                  className="mt-4 w-full rounded-full bg-coral px-6 py-3 font-semibold text-text-on-dark transition-colors hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Sending…" : "Send"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
