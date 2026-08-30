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
  collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, limit, serverTimestamp,
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
  pct?: number;           // live progress written by the listener during review
  reviewed?: number;      // courts finished so far in the review
  reviewTotal?: number;   // courts in the batch
  botsCounted?: number;   // bots whose answers the parser could actually read
  botsTotal?: number;     // bots that answered at all
  botsDead?: string | null; // comma-joined names of bots that parsed to nothing
};

const STATUS_COLOR: Record<string, string> = {
  queued: "bg-status-pending/20 text-status-pending",
  discovering: "bg-teal/20 text-teal",
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
  reviewing: "reviewing courts",
  reenriching: "enriching from late bots",
  reconciling: "checking for late bots",
  bots_ingested: "scored answers",
  carded: "cards ready",
};

// rough % complete by stage (falls back to status)
const STAGE_PCT: Record<string, number> = {
  seeded: 15, screenshot_done: 35, bots_pending: 50, awaiting_review: 72,
  bots_ingested: 82, carded: 100, review_timeout: 100,
};
const STATUS_PCT: Record<string, number> = {
  queued: 5, discovering: 12, processing: 20, awaiting_chatbots: 50, needs_review: 72,
  cards_ready: 100, needs_human: 100, error: 100,
};
function jobPct(j: Job): number {
  // A finished job (cards_ready/error/needs_human) is fixed at its status pct — ignore any
  // stale live `pct` left over from the review poll (which caps at 98).
  if (j.status && !ACTIVE.includes(j.status)) return (j.status ? STATUS_PCT[j.status] : undefined) ?? 100;
  if (typeof j.pct === "number") return j.pct;   // live per-court progress during review
  const byStage = j.stage ? STAGE_PCT[j.stage] : undefined;
  if (byStage != null) return byStage;
  const byStatus = j.status ? STATUS_PCT[j.status] : undefined;
  return byStatus ?? 0;
}
const ACTIVE = ["queued", "discovering", "processing", "awaiting_chatbots", "needs_review"];

export default function PipelineControls() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [locator, setLocator] = useState("");
  const [note, setNote] = useState("");
  const [showFind, setShowFind] = useState(false);
  const [findLoc, setFindLoc] = useState("");
  const [findN, setFindN] = useState(5);
  const [findIndoor, setFindIndoor] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "pipeline_jobs"), orderBy("createdAt", "desc"), limit(12));
    return onSnapshot(q, (snap) =>
      setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Job)))
    );
  }, []);

  // A pipeline run is genuinely in-flight while any job is in an ACTIVE status.
  // `busy` only covers the ~1s enqueue write; `running` is the real "don't start
  // another one" gate — the Mac listener processes batches one at a time.
  const activeJobs = jobs.filter((j) => ACTIVE.includes(j.status ?? ""));
  const running = busy || activeJobs.length > 0;

  // Remove a single job row (also works on a stuck/orphaned one to unblock the gate).
  const clearJob = (id: string) => deleteDoc(doc(db, "pipeline_jobs", id));
  // Wipe every finished/errored job so a fresh run starts with a clean list.
  const clearFinished = () =>
    Promise.all(
      jobs.filter((j) => !ACTIVE.includes(j.status ?? "")).map((j) => clearJob(j.id))
    );

  async function runBatch() {
    if (running) return;
    setBusy(true);
    try {
      await clearFinished();
      await addDoc(collection(db, "pipeline_jobs"), {
        action: "run_batch", n: 10, source: "500",
        status: "queued", createdBy: user?.uid ?? null, createdAt: serverTimestamp(),
      });
    } finally { setBusy(false); }
  }

  async function findCourts() {
    if (running || !findLoc.trim()) return;
    setBusy(true);
    try {
      await clearFinished();
      await addDoc(collection(db, "pipeline_jobs"), {
        action: "discover", location: findLoc.trim(), n: findN, indoor: findIndoor,
        status: "queued", createdBy: user?.uid ?? null, createdAt: serverTimestamp(),
      });
      setFindLoc(""); setShowFind(false);
    } finally { setBusy(false); }
  }

  async function addCourt() {
    if (running || !name.trim()) return;
    setBusy(true);
    // classify the optional locator: coords "lat,lng" | a maps link | an address
    const loc = locator.trim();
    const payload: Record<string, unknown> = { name: name.trim() };
    if (/^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(loc)) payload.coords = loc.replace(/\s/g, "");
    else if (/^https?:\/\//.test(loc)) payload.mapsLink = loc;
    else if (loc) payload.address = loc;
    if (note.trim()) payload.note = note.trim();
    try {
      await clearFinished();
      await addDoc(collection(db, "pipeline_jobs"), {
        action: "add_court", ...payload,
        status: "queued", createdBy: user?.uid ?? null, createdAt: serverTimestamp(),
      });
      setName(""); setLocator(""); setNote(""); setShowAdd(false);
    } finally { setBusy(false); }
  }

  // show all active jobs + only the SINGLE most recent finished one (jobs are desc)
  const latestDone = jobs.find((j) => !ACTIVE.includes(j.status ?? ""));
  const shownJobs = [...activeJobs, ...(latestDone ? [latestDone] : [])];

  return (
    <div className="mb-6 rounded-xl border border-dash-border bg-dash-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={runBatch}
          disabled={running}
          className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-surface-dark hover:opacity-90 disabled:opacity-50"
        >
          + Load more draft courts
        </button>
        <button
          onClick={() => setShowAdd((s) => !s)}
          disabled={running}
          className="rounded-lg border border-dash-border px-4 py-2 text-sm font-medium text-dash-text hover:bg-dash-bg disabled:opacity-50"
        >
          Add a court by name
        </button>
        <button
          onClick={() => setShowFind((s) => !s)}
          disabled={running}
          className="rounded-lg border border-dash-border px-4 py-2 text-sm font-medium text-dash-text hover:bg-dash-bg disabled:opacity-50"
        >
          Find courts in a place
        </button>
        <span className="text-xs text-dash-text-muted">
          {running
            ? "A run is in progress — wait for it to finish before starting another."
            : "Runs on your Mac (listener + 6 chatbot tabs must be open)."}
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
            onClick={addCourt} disabled={running || !name.trim()}
            className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-surface-dark hover:opacity-90 disabled:opacity-50"
          >
            Queue this court
          </button>
        </div>
      )}

      {showFind && (
        <div className="mt-4 grid gap-2 sm:max-w-md">
          <input
            value={findLoc} onChange={(e) => setFindLoc(e.target.value)}
            placeholder="Place, e.g. 'Austin, TX' or 'Bushwick, Brooklyn'"
            className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-text"
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-dash-text">
              How many
              <input type="number" min={1} max={15} value={findN}
                onChange={(e) => setFindN(Number(e.target.value))}
                className="w-16 rounded-lg border border-dash-border bg-dash-bg px-2 py-1.5 text-sm text-dash-text" />
            </label>
            <label className="flex items-center gap-2 text-sm text-dash-text">
              <input type="checkbox" checked={findIndoor} onChange={(e) => setFindIndoor(e.target.checked)} />
              indoor courts
            </label>
          </div>
          <button
            onClick={findCourts} disabled={running || !findLoc.trim()}
            className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-surface-dark hover:opacity-90 disabled:opacity-50"
          >
            Find {findN} {findIndoor ? "indoor " : ""}courts
          </button>
          <span className="text-xs text-dash-text-muted">
            Claude web-searches the area, picks real courts, then runs them through the pipeline.
          </span>
        </div>
      )}

      {shownJobs.length > 0 && (
        <div className="mt-4 space-y-2">
          {shownJobs.map((j) => {
            const pct = jobPct(j);
            return (
              <div key={j.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 font-medium ${STATUS_COLOR[j.status ?? ""] ?? "bg-dash-bg text-dash-text-muted"}`}>
                    {j.status ?? "—"}
                  </span>
                  <span className="text-dash-text">
                    {j.action === "add_court" ? `add "${j.name}"` : `batch of ${j.n ?? 10}`}
                  </span>
                  <span className="text-dash-text-muted">
                    {j.stage ? (STAGE_LABEL[j.stage] ?? j.stage) : ""}
                    {j.reviewed != null && j.reviewTotal ? ` ${j.reviewed}/${j.reviewTotal}` : ""}
                    {j.status === "cards_ready" && j.pendingCount != null ? ` — ${j.pendingCount} carded` : ""}
                    {j.error ? ` — ${j.error}` : ""}
                  </span>
                  {/* A bot whose answer the parser couldn't read contributes no votes, and the
                      thin result is otherwise invisible. Call it out on the finished row. */}
                  {j.botsTotal != null && (
                    <span
                      title={j.botsDead ? `No usable answer from: ${j.botsDead}` : "All bots parsed"}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        j.botsCounted === j.botsTotal ? "text-dash-text-muted" : "bg-coral/20 text-coral"
                      }`}
                    >
                      {j.botsCounted}/{j.botsTotal} bots
                    </span>
                  )}
                  <span className="ml-auto text-dash-text-muted">{pct}%</span>
                  <button
                    onClick={() => clearJob(j.id)}
                    title="Clear this job from the list"
                    aria-label="Clear job"
                    className="text-sm leading-none text-dash-text-muted hover:text-coral"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-dash-bg">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${j.status === "error" ? "bg-coral" : "bg-teal"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
