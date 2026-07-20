"use client";

/**
 * PipelineControls — admin controls for the court-enrichment pipeline.
 *
 * Writes jobs to the `pipeline_jobs` collection; a listener on Avi's Mac picks them
 * up, runs the pipeline (select → screenshot → vision → bots → ingest → write), and
 * the finished courts appear in the Pending Courts list below. This component only
 * ENQUEUES + shows live job status — no heavy work happens in the browser.
 *
 * Rendered at the top of PendingCourtsTab in src/app/admin/page.tsx.
 */
import { useEffect, useState } from "react";
import {
  collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

type Job = {
  id: string;
  action?: string;
  status?: string;
  stage?: string;
  name?: string;
  n?: number;
  pendingCount?: number;
  error?: string;
};

const STATUS_COLOR: Record<string, string> = {
  queued: "bg-status-pending/20 text-status-pending",
  processing: "bg-teal/20 text-teal",
  awaiting_chatbots: "bg-teal/20 text-teal",
  needs_review: "bg-teal/20 text-teal",
  cards_ready: "bg-green-500/20 text-green-400",
  needs_human: "bg-coral/20 text-coral",
  error: "bg-coral/20 text-coral",
};

const STAGE_LABEL: Record<string, string> = {
  seeded: "picked courts",
  screenshot_done: "captured satellite",
  bots_pending: "awaiting chatbots",
  awaiting_review: "vision + review",
  bots_ingested: "scored answers",
  carded: "cards ready",
};

export default function PipelineControls() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [locator, setLocator] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const q = query(collection(db, "pipeline_jobs"), orderBy("createdAt", "desc"), limit(12));
    return onSnapshot(q, (snap) =>
      setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Job)))
    );
  }, []);

  async function runBatch() {
    setBusy(true);
    try {
      await addDoc(collection(db, "pipeline_jobs"), {
        action: "run_batch", n: 10, source: "500",
        status: "queued", createdBy: user?.uid ?? null, createdAt: serverTimestamp(),
      });
    } finally { setBusy(false); }
  }

  async function addCourt() {
    if (!name.trim()) return;
    setBusy(true);
    // classify the optional locator: coords "lat,lng" | a maps link | an address
    const loc = locator.trim();
    const payload: Record<string, unknown> = { name: name.trim() };
    if (/^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(loc)) payload.coords = loc.replace(/\s/g, "");
    else if (/^https?:\/\//.test(loc)) payload.mapsLink = loc;
    else if (loc) payload.address = loc;
    if (note.trim()) payload.note = note.trim();
    try {
      await addDoc(collection(db, "pipeline_jobs"), {
        action: "add_court", ...payload,
        status: "queued", createdBy: user?.uid ?? null, createdAt: serverTimestamp(),
      });
      setName(""); setLocator(""); setNote(""); setShowAdd(false);
    } finally { setBusy(false); }
  }

  return (
    <div className="mb-6 rounded-xl border border-dash-border bg-dash-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={runBatch}
          disabled={busy}
          className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-surface-dark hover:opacity-90 disabled:opacity-50"
        >
          + Load more draft courts
        </button>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="rounded-lg border border-dash-border px-4 py-2 text-sm font-medium text-dash-text hover:bg-dash-bg"
        >
          Add a court by name
        </button>
        <span className="text-xs text-dash-text-muted">
          Runs on your Mac (listener + 6 chatbot tabs must be open).
        </span>
      </div>

      {showAdd && (
        <div className="mt-4 grid gap-2 sm:max-w-md">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Court name (required)"
            className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-text"
          />
          <input
            value={locator} onChange={(e) => setLocator(e.target.value)}
            placeholder="Optional: coords, Google Maps link, or address/cross-streets"
            className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-text"
          />
          <input
            value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (rides onto the review card as your input)"
            className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-text"
          />
          <button
            onClick={addCourt} disabled={busy || !name.trim()}
            className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-surface-dark hover:opacity-90 disabled:opacity-50"
          >
            Queue this court
          </button>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="mt-4 space-y-1">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center gap-2 text-xs">
              <span className={`rounded px-2 py-0.5 font-medium ${STATUS_COLOR[j.status ?? ""] ?? "bg-dash-bg text-dash-text-muted"}`}>
                {j.status ?? "—"}
              </span>
              <span className="text-dash-text">
                {j.action === "add_court" ? `add "${j.name}"` : `batch of ${j.n ?? 10}`}
              </span>
              <span className="text-dash-text-muted">
                {j.stage ? (STAGE_LABEL[j.stage] ?? j.stage) : ""}
                {j.status === "cards_ready" && j.pendingCount != null ? ` — ${j.pendingCount} carded` : ""}
                {j.error ? ` — ${j.error}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
