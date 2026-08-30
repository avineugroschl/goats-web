"use client";

/**
 * PipelineAccuracyPanel — is the court pipeline getting better?
 *
 * Reads `pipeline_corrections` and nothing else. Each document is self-contained: the
 * approved truth, the admin's per-field ✓/✗ verdicts, and the per-bot claims behind them,
 * joined at write time rather than here. There is no second source to reconcile.
 *
 * Three deliberate choices, because at ten courts a batch a dashboard can very easily lie:
 *
 *  1. COVERAGE IS THE HEADLINE, not accuracy. For the first weeks the true story is how
 *     much has actually been verified. An accuracy figure on top of n=7 manufactures
 *     exactly the false confidence the three-state verdict exists to prevent.
 *
 *  2. PER FIELD, NOT ONE NUMBER. A single figure cannot separate "the pipeline improved"
 *     from "easier courts got reviewed this month", and it points at nothing to fix.
 *     "Hours is 54% and falling while baskets is 91%" names the prompt to change.
 *
 *  3. BATCH AXIS WITH TWO LINES. The pipeline steps when a rule changes, it does not
 *     drift, so batch number is the meaningful axis. Cumulative alone is anchored by
 *     history and hides real improvement; a trailing window alone invents improvement out
 *     of six samples. Both, or neither is honest.
 *
 * Cells under the sample floor show their count instead of a percentage. A confident 100%
 * off three samples is worse than a blank.
 */
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const MIN_SAMPLES = 5;          // below this, show the count and no percentage
const ROLL_WINDOW = 30;         // trailing verdicts behind the responsive line

const FIELD_LABEL: Record<string, string> = {
  name: "Name", address: "Address", latitude: "Latitude", longitude: "Longitude",
  baskets: "Baskets", setting: "Setting", accessType: "Access", hasLights: "Lights",
  courtCondition: "Condition", threePointLine: "3PT line", hoursOfOperation: "Hours",
  phoneNumber: "Phone", goatsTake: "GOATS Take",
};

/** court field -> the bot field in `claims` that predicts it, where a bot can be graded at all. */
const BOT_FIELD: Record<string, string> = {
  baskets: "hoops", hasLights: "lights", courtCondition: "condition", address: "location",
};

type Verdict = "confirmed" | "wrong" | "untouched";
/** Everything the per-field cards and the detail view are computed from. */
type FieldStat = {
  confirmed: number; wrong: number; close: number; untouched: number;
  /** every judged verdict for this field, in review order — the rolling window walks this */
  seq: { batch: number; ok: boolean }[];
  notes: { note: string; court: string; batch: unknown; verdict?: Verdict }[];
  bulk: number;
};
type Stats = {
  per: Record<string, FieldStat>;
  fields: string[]; judged: number; total: number;
  batches: number[]; cards: number; approved: number;
};

type FieldRow = {
  field: string; predicted: unknown; actual: unknown;
  agreed: boolean | null; verdict?: Verdict; via?: string | null; note?: string | null;
};
type Corr = {
  id: string; courtId?: string; courtName?: string; batch?: number | string;
  outcome?: string; fields?: FieldRow[]; cardNote?: string | null;
  claims?: Record<string, Record<string, unknown>> | null;
  claimSources?: Record<string, Record<string, string[]>> | null;
  createdAt?: { seconds?: number } | null;
};

/** Was this bot's claim right, given what was approved? null = not gradable, not "wrong". */
function grade(field: string, claim: unknown, actual: unknown, predicted: unknown): boolean | null {
  if (claim === null || claim === undefined) return null;
  if (field === "baskets") return Number(claim) === Number(actual);
  if (field === "hasLights") return (claim === "Y") === !!actual;
  if (field === "courtCondition") return String(claim).toLowerCase() === String(actual ?? "").toLowerCase();
  if (field === "address") {
    // The bot said 'ok' or 'wrong' about the address it was handed. Truth = did it change?
    const changed = String(predicted ?? "").trim().toLowerCase() !== String(actual ?? "").trim().toLowerCase();
    return (claim === "wrong") === changed;
  }
  return null;
}

const pct = (right: number, n: number) => Math.round((right / n) * 100);
const batchNum = (b: unknown) => (Number.isFinite(Number(b)) ? Number(b) : 0);

export default function PipelineAccuracyPanel() {
  const [rows, setRows] = useState<Corr[] | null>(null);
  const [openField, setOpenField] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "pipeline_corrections"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Corr));
      // Batch order, then write order inside a batch. The rolling window depends on this
      // being the sequence the reviews actually happened in.
      list.sort((a, b) =>
        batchNum(a.batch) - batchNum(b.batch) ||
        (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
      setRows(list);
    })().catch((e) => { console.warn("corrections load failed:", e); setRows([]); });
  }, []);

  const stats = useMemo(() => {
    if (!rows) return null;
    const fields = Object.keys(FIELD_LABEL);
    const per: Record<string, FieldStat> = {};

    for (const f of fields) per[f] = { confirmed: 0, wrong: 0, close: 0, untouched: 0, seq: [], notes: [], bulk: 0 };

    const batches = new Set<number>();
    for (const r of rows) {
      batches.add(batchNum(r.batch));
      for (const fr of r.fields ?? []) {
        const p = per[fr.field];
        if (!p) continue;
        const v = fr.verdict ?? "untouched";
        if (v === "untouched") { p.untouched++; continue; }
        if (v === "confirmed") { p.confirmed++; if (fr.agreed === false) p.close++; }
        else p.wrong++;
        if (fr.via === "bulk") p.bulk++;
        p.seq.push({ batch: batchNum(r.batch), ok: v === "confirmed" });
        if (fr.note) p.notes.push({ note: fr.note, court: r.courtName ?? "?", batch: r.batch, verdict: v });
      }
    }
    const judged = fields.reduce((n, f) => n + per[f].confirmed + per[f].wrong, 0);
    const total = fields.reduce((n, f) => n + per[f].confirmed + per[f].wrong + per[f].untouched, 0);
    return { per, fields, judged, total, batches: [...batches].sort((a, b) => a - b),
             cards: rows.length, approved: rows.filter((r) => r.outcome === "approved").length };
  }, [rows]);

  if (!rows) return <div className="py-12 text-center text-sm text-dash-text-muted">Loading…</div>;

  if (!rows.length) {
    return (
      <div className="space-y-6">
      <LearningPanel />
      <div className="rounded-xl border border-dash-border bg-dash-bg p-6 text-sm text-dash-text-muted">
        <p className="text-dash-text">Nothing reviewed yet.</p>
        <p className="mt-2">
          Approve or reject a draft court in Pending Courts and it shows up here. Tick or cross
          the fields as you go, since only fields you actually judge count toward accuracy.
        </p>
      </div>
      </div>
    );
  }

  const s = stats!;
  const coverage = s.total ? Math.round((s.judged / s.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <LearningPanel />

      {/* headline: how much of this is actually verified */}
      <div className="rounded-xl border border-dash-border bg-dash-bg p-5">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <div className="font-display text-3xl font-bold text-teal">{coverage}%</div>
            <div className="text-[11px] uppercase tracking-wider text-dash-text-muted">verified</div>
          </div>
          <div className="text-xs text-dash-text-muted">
            <div><span className="text-dash-text">{s.judged}</span> of {s.total} fields judged</div>
            <div className="mt-0.5">
              across <span className="text-dash-text">{s.cards}</span> reviewed card
              {s.cards === 1 ? "" : "s"} · {s.approved} approved · {s.batches.filter(Boolean).length} batch
              {s.batches.filter(Boolean).length === 1 ? "" : "es"}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-dash-text-muted/80">
          Unjudged fields are left out of every accuracy figure below rather than counted as
          correct. That is the whole point of the checks: an untouched field is not evidence.
        </p>
      </div>

      {/* per-field small multiples */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {s.fields.map((f) => {
          const p = s.per[f];
          const n = p.confirmed + p.wrong;
          const thin = n < MIN_SAMPLES;
          const open = openField === f;
          return (
            <button
              key={f}
              onClick={() => setOpenField(open ? null : f)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                open ? "border-teal bg-dash-surface" : "border-dash-border bg-dash-bg hover:border-dash-text-muted/40"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-dash-text-muted">{FIELD_LABEL[f]}</span>
                <Spark seq={p.seq} />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                {n === 0 ? (
                  <span className="text-lg text-dash-text-muted/50">—</span>
                ) : thin ? (
                  <span className="text-sm text-dash-text-muted">n={n}, too few</span>
                ) : (
                  <>
                    <span className="font-display text-2xl font-bold text-dash-text">{pct(p.confirmed, n)}%</span>
                    <span className="text-[11px] text-dash-text-muted">n={n}</span>
                  </>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-dash-text-muted">
                {p.close > 0 && <span>{pct(p.close, Math.max(p.confirmed, 1))}% needed a nudge</span>}
                {p.untouched > 0 && <span>{p.untouched} unjudged</span>}
                {p.notes.length > 0 && <span className="text-teal">{p.notes.length} note{p.notes.length === 1 ? "" : "s"}</span>}
              </div>
            </button>
          );
        })}
      </div>

      {openField && <FieldDetail field={openField} rows={rows} stats={s} />}
    </div>
  );
}

/** Tiny per-batch accuracy sparkline. Blank until there is more than one batch to compare. */
function Spark({ seq }: { seq: { batch: number; ok: boolean }[] }) {
  const points = useMemo(() => {
    const byBatch = new Map<number, { r: number; n: number }>();
    for (const v of seq) {
      const c = byBatch.get(v.batch) ?? { r: 0, n: 0 };
      c.n++; if (v.ok) c.r++;
      byBatch.set(v.batch, c);
    }
    return [...byBatch.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c.r / c.n);
  }, [seq]);
  if (points.length < 2) return null;
  const w = 46, h = 14;
  const d = points.map((v, i) =>
    `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * w},${h - v * h}`).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible">
      <path d={d} fill="none" stroke="var(--color-teal)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function FieldDetail({ field, rows, stats }: { field: string; rows: Corr[]; stats: Stats }) {

  const p = stats.per[field];
  const botField = BOT_FIELD[field];

  // per-batch, cumulative and trailing-window accuracy
  const trend = useMemo(() => {
    const byBatch = new Map<number, { r: number; n: number }>();
    for (const v of p.seq) {
      const c = byBatch.get(v.batch) ?? { r: 0, n: 0 };
      c.n++; if (v.ok) c.r++;
      byBatch.set(v.batch, c);
    }
    const batches = [...byBatch.keys()].sort((a, b) => a - b);
    let cr = 0, cn = 0, i = 0;
    return batches.map((b) => {
      const c = byBatch.get(b)!;
      cr += c.r; cn += c.n; i += c.n;
      const win = p.seq.slice(Math.max(0, i - ROLL_WINDOW), i);
      return {
        batch: b, n: c.n,
        cumulative: cr / cn,
        rolling: win.length ? win.filter((v) => v.ok).length / win.length : 0,
      };
    });
  }, [p.seq]);

  // per-bot and per-source accuracy, graded only where a verdict was actually given
  const { byBot, bySource } = useMemo(() => {
    const bot: Record<string, { r: number; n: number }> = {};
    const src: Record<string, { r: number; n: number }> = {};
    if (!botField) return { byBot: bot, bySource: src };
    for (const r of rows) {
      if (r.outcome !== "approved") continue;
      const fr = (r.fields ?? []).find((x) => x.field === field);
      if (!fr || !fr.verdict || fr.verdict === "untouched") continue;
      const claims = r.claims?.[botField] ?? {};
      for (const [model, claim] of Object.entries(claims)) {
        const ok = grade(field, claim, fr.actual, fr.predicted);
        if (ok === null) continue;
        (bot[model] ||= { r: 0, n: 0 }).n++;
        if (ok) bot[model].r++;
        for (const dom of r.claimSources?.[botField]?.[model] ?? []) {
          (src[dom] ||= { r: 0, n: 0 }).n++;
          if (ok) src[dom].r++;
        }
      }
    }
    return { byBot: bot, bySource: src };
  }, [rows, field, botField]);

  return (
    <div className="space-y-5 rounded-xl border border-teal/30 bg-dash-surface p-5">
      <h3 className="font-display text-sm font-bold uppercase tracking-wider text-teal">
        {FIELD_LABEL[field]}
      </h3>

      {trend.length < 3 ? (
        <p className="text-xs text-dash-text-muted">
          Trend needs three batches with a judged {FIELD_LABEL[field].toLowerCase()} before it means
          anything. {trend.length} so far.
        </p>
      ) : (
        <Trend trend={trend} />
      )}

      <Table title="By bot" empty={botField ? "Nothing gradable yet." : "Decided by satellite, not by the bots, so there is no bot to score."} data={byBot} />
      <Table title="By source" empty="No cited sources yet." data={bySource} />

      {p.notes.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-wider text-dash-text-muted">
            Notes ({p.notes.length})
          </div>
          <div className="space-y-2">
            {p.notes.slice().reverse().map((n, i) => (
              <div key={i} className="rounded-lg bg-dash-bg p-3 text-xs">
                <span className={n.verdict === "wrong" ? "text-coral" : "text-status-confirmed"}>
                  {n.verdict === "wrong" ? "✗" : "✓"}
                </span>{" "}
                <span className="text-dash-text">{n.note}</span>
                <div className="mt-1 text-[10px] text-dash-text-muted">
                  {n.court}{n.batch ? ` · batch ${n.batch}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Two lines on a batch axis: slow-but-honest cumulative, responsive-but-noisy trailing window. */
function Trend({ trend }: { trend: { batch: number; n: number; cumulative: number; rolling: number }[] }) {
  const w = 560, h = 130, padL = 30, padB = 22;
  const x = (i: number) => padL + (i / Math.max(trend.length - 1, 1)) * (w - padL - 10);
  const y = (v: number) => 8 + (1 - v) * (h - padB - 8);
  const line = (key: "cumulative" | "rolling") =>
    trend.map((t, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(t[key])}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h} className="min-w-[560px]">
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={padL} y1={y(g)} x2={w - 10} y2={y(g)} stroke="var(--color-dash-border)" strokeWidth="1" />
            <text x={4} y={y(g) + 3} fill="var(--color-dash-text-muted)" fontSize="9">{g * 100}%</text>
          </g>
        ))}
        <path d={line("cumulative")} fill="none" stroke="var(--color-dash-text-muted)" strokeWidth="1.5" />
        <path d={line("rolling")} fill="none" stroke="var(--color-teal)" strokeWidth="2" />
        {trend.map((t, i) => (
          <text key={t.batch} x={x(i)} y={h - 6} textAnchor="middle" fill="var(--color-dash-text-muted)" fontSize="9">
            {t.batch || "?"}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-[10px] text-dash-text-muted">
        <span><span className="text-teal">━</span> last {ROLL_WINDOW} judged</span>
        <span>━ all time</span>
        <span>batch number along the bottom</span>
      </div>
    </div>
  );
}

function Table({ title, data, empty }: { title: string; data: Record<string, { r: number; n: number }>; empty: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1].n - a[1].n);
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-wider text-dash-text-muted">{title}</div>
      {!entries.length ? (
        <p className="text-xs text-dash-text-muted/70">{empty}</p>
      ) : (
        <div className="space-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 text-xs">
              <span className="w-40 shrink-0 truncate text-dash-text">{k}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-dash-bg">
                <div className="h-full rounded bg-teal" style={{ width: `${pct(v.r, v.n)}%`, opacity: v.n < MIN_SAMPLES ? 0.3 : 1 }} />
              </div>
              <span className={`w-24 shrink-0 text-right ${v.n < MIN_SAMPLES ? "text-dash-text-muted/60" : "text-dash-text-muted"}`}>
                {v.n < MIN_SAMPLES ? `${v.r}/${v.n}` : `${pct(v.r, v.n)}%  ${v.r}/${v.n}`}
              </span>
            </div>
          ))}
          <p className="pt-1 text-[10px] text-dash-text-muted/60">
            Faded rows are under {MIN_SAMPLES} samples. Treat those as anecdotes, not evidence.
          </p>
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────

/**
 * LearningPanel — is the pipeline actually changing itself, and did it work?
 *
 * The improve pass runs on Avi's Mac and keeps its state in local files, so without this
 * the dashboard could report accuracy while having no idea an experiment was running. Since
 * the loop deliberately does NOT ask for approval, visibility after the fact is the whole
 * accountability story: a log, not a gate.
 *
 * Reads one document, `pipeline_learning/state`, republished by each pass. It renders even
 * when nothing has been learned, because "ran, found nothing worth changing" is the answer
 * most weeks and is indistinguishable from a broken pass if the panel stays blank.
 */
type Experiment = {
  id: string; field: string; kind: string; status: string; ref?: string; summary?: string;
  appliedBatch?: number; measureAtBatch?: number;
  accuracyBefore?: number; accuracyAfter?: number; fillBefore?: number; fillAfter?: number; delta?: number;
};
type LearningState = {
  lastImproveRun?: string; lastAction?: string;
  lastHarvestRun?: string; lastHarvestAction?: string; examplesHarvested?: number;
  experiments?: Experiment[];
  changelog?: { at?: string; batch?: number; area?: string; field?: string; summary?: string; by?: string }[];
  validators?: { id: string; field: string; action: string; status: string; selfTest?: boolean; cases?: number }[];
  rules?: Record<string, { id: string; field?: string; text: string; status?: string; expiresBatch?: number | null }[]>;
  slotsUsed?: Record<string, number>;
  maxSlots?: number;
  weights?: Record<string, Record<string, { w: number; n: number; acc?: number | null }>>;
};

const EXP_STYLE: Record<string, string> = {
  running: "bg-teal/15 text-teal",
  proven: "bg-status-confirmed/15 text-status-confirmed",
  "proven-by-abstention": "bg-status-confirmed/10 text-status-confirmed/80",
  unproven: "bg-dash-bg text-dash-text-muted",
  reverted: "bg-coral/15 text-coral",
};
const ago = (iso?: string) => {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 90) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 36 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

export function LearningPanel() {
  const [s, setS] = useState<LearningState | null | false>(null);

  useEffect(() => {
    getDoc(doc(db, "pipeline_learning", "state"))
      .then((d) => setS(d.exists() ? (d.data() as LearningState) : false))
      .catch(() => setS(false));
  }, []);

  if (s === null) return null;
  if (s === false) {
    return (
      <div className="rounded-xl border border-dash-border bg-dash-bg p-5 text-xs text-dash-text-muted">
        <div className="font-display text-[11px] font-bold uppercase tracking-wider text-dash-text">Learning</div>
        <p className="mt-2">
          The improve pass has not reported in yet. It runs on your Mac at the start of every
          batch, so this fills in after the next one.
        </p>
      </div>
    );
  }

  const exps = s.experiments ?? [];
  const running = exps.filter((e) => e.status === "running");
  const settled = exps.filter((e) => e.status !== "running").slice().reverse();
  const validators = (s.validators ?? []).filter((v) => v.status !== "reverted");
  const ruleList = Object.entries(s.rules ?? {}).flatMap(([area, rs]) =>
    (rs ?? []).filter((r) => r.status !== "reverted").map((r) => ({ ...r, area })));
  const weightFields = Object.entries(s.weights ?? {});

  return (
    <div className="rounded-xl border border-dash-border bg-dash-bg p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-display text-[11px] font-bold uppercase tracking-wider text-dash-text">Learning</div>
        <div className="text-[10px] text-dash-text-muted">last ran {ago(s.lastImproveRun)}</div>
      </div>

      <p className="mt-2 text-xs text-dash-text">{s.lastAction ?? "no report yet"}</p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-dash-text-muted">
        <span>{validators.length} validator{validators.length === 1 ? "" : "s"}</span>
        <span>
          {ruleList.length} prompt rule{ruleList.length === 1 ? "" : "s"}
          {s.maxSlots ? ` of ${s.maxSlots * Object.keys(s.slotsUsed ?? {}).length} slots` : ""}
        </span>
        <span>{weightFields.length} weighted field{weightFields.length === 1 ? "" : "s"}</span>
        <span>{s.examplesHarvested ?? 0} vision example{s.examplesHarvested === 1 ? "" : "s"}</span>
      </div>

      {running.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-dash-text-muted">In flight</div>
          {running.map((e) => (
            <div key={e.id} className="mt-1.5 rounded-lg bg-dash-surface p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${EXP_STYLE.running}`}>running</span>
                <span className="text-dash-text">{e.kind} on {FIELD_LABEL[e.field] ?? e.field}</span>
                <span className="text-dash-text-muted">
                  was {Math.round((e.accuracyBefore ?? 0) * 100)}% · judged again at batch {e.measureAtBatch}
                </span>
              </div>
              {e.summary && <p className="mt-1 text-[11px] leading-relaxed text-dash-text-muted">{e.summary}</p>}
            </div>
          ))}
        </div>
      )}

      {settled.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-dash-text-muted">Settled</div>
          {settled.slice(0, 6).map((e) => (
            <div key={e.id} className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${EXP_STYLE[e.status] ?? EXP_STYLE.unproven}`}>
                {e.status}
              </span>
              <span className="text-dash-text">{e.kind} on {FIELD_LABEL[e.field] ?? e.field}</span>
              <span className="text-dash-text-muted">
                {Math.round((e.accuracyBefore ?? 0) * 100)}% → {Math.round((e.accuracyAfter ?? 0) * 100)}%
                {e.status === "proven-by-abstention"
                  ? `, but fill fell ${Math.round(((e.fillBefore ?? 0) - (e.fillAfter ?? 0)) * 100)} points`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {(validators.length > 0 || ruleList.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {validators.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-dash-text-muted">Validators (enforced in code)</div>
              {validators.map((v) => (
                <div key={v.id} className="mt-1 text-[11px] text-dash-text">
                  {v.selfTest === false && <span className="mr-1 text-coral" title="failed its own test cases, disabled">⚠</span>}
                  {v.id}
                  <span className="text-dash-text-muted"> · {FIELD_LABEL[v.field] ?? v.field}</span>
                </div>
              ))}
            </div>
          )}
          {ruleList.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-dash-text-muted">Prompt rules (last resort)</div>
              {ruleList.map((r) => (
                <div key={r.id} className="mt-1 text-[11px] text-dash-text">
                  {r.text}
                  <span className="text-dash-text-muted">
                    {" "}· {r.area.replace("_", " ")}{r.expiresBatch ? `, expires batch ${r.expiresBatch}` : ", permanent"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {weightFields.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-dash-text-muted">Bot weights in effect</div>
          {weightFields.map(([field, models]) => (
            <div key={field} className="mt-1 text-[11px]">
              <span className="text-dash-text">{field}</span>
              <span className="text-dash-text-muted">
                {" "}— {Object.entries(models).map(([m, c]) => `${m} ×${c.w}`).join(", ")}
              </span>
            </div>
          ))}
        </div>
      )}

      {(s.changelog ?? []).length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-dash-text-muted hover:text-dash-text">
            Change history ({s.changelog!.length})
          </summary>
          <div className="mt-2 space-y-1">
            {s.changelog!.map((c, i) => (
              <div key={i} className="text-[11px] text-dash-text-muted">
                <span className="text-dash-text-muted/60">{c.at} · batch {c.batch} · {c.by}</span>
                <br />
                <span className="text-dash-text">{c.summary}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
