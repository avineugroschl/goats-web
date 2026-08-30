/**
 * corrections.ts — ground truth capture for the court pipeline.
 *
 * Every approval is already a human verdict on what the bots produced; until now that
 * verdict was thrown away. This writes one `pipeline_corrections` doc per reviewed court,
 * comparing what the pipeline PREDICTED (frozen in `pipelineReview.predicted` by
 * write_pending.js, so later edits to the pending doc can't erase it) against what was
 * actually approved.
 *
 * Rows where nothing changed matter as much as the corrections: accuracy needs a
 * denominator. `claims` carries the per-model answers so a field can be attributed to
 * the model that got it right, which is the whole point.
 *
 * TWO INDEPENDENT SIGNALS PER FIELD, never collapsed into one:
 *
 *   agreed   — machine: did the approved value differ from what the pipeline proposed
 *   verdict  — human: confirmed / wrong / untouched, from the ✓✗ on the card
 *
 * The old capture had only `agreed`, which conflates "I checked it and it's right" with
 * "I never looked at it" and silently counts every unexamined field as a win for the bots.
 * `untouched` exists to be EXCLUDED from accuracy and counted for coverage instead.
 *
 * Keeping both also gives the case that matters most for improving a prompt: confirmed
 * AND changed means the pipeline was close enough to pass but needed a nudge, which is a
 * completely different problem from being wrong. That state is derived, not stored, so it
 * can never drift out of sync with the two facts behind it.
 *
 * PROVISIONAL ROWS. A verdict is evidence the moment it is tapped, but the only way one
 * used to reach the dashboard was approving or rejecting the card. A queue worked over
 * several sittings therefore looked, to every downstream reader, exactly like a queue
 * nobody had touched. `provisionalCorrection` builds the same row shape from a card that
 * is still in review: predicted from the frozen snapshot, actual from the card's currently
 * saved values, verdicts from `reviewFeedback`. It is BUILT, never written — the stored
 * collection stays append-only and one row per decision, and a real row always supersedes
 * the provisional one for the same court.
 *
 * Deliberately NOT computing weights or scores here. This is capture only — the analysis
 * can be built any time, but the per-bot record cannot be reconstructed after the fact.
 */

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * DIFFABLE fields — values the machine can compare predicted-vs-approved by itself.
 * Photo / description / booking are human-supplied, so not the bots' to get wrong.
 */
const TRACKED = [
  "address", "latitude", "longitude", "baskets", "hasLights",
  "courtCondition", "threePointLine", "hoursOfOperation", "phoneNumber",
  "setting", "accessType",
] as const;

/**
 * JUDGED fields — everything the card puts a ✓/✗ on. `name` and `goatsTake` join TRACKED
 * as of 2026-08-30: write_pending.js freezes them into `predicted` too, so "did it change"
 * survives a save and a page reload instead of being inferred from what the card happened
 * to mount with. Diffing free prose is blunt (any edit at all reads as changed), which is
 * why the verdict carries them and `agreed` is only ever a hint.
 */
const JUDGED = [...TRACKED, "name", "goatsTake"] as const;
type Tracked = (typeof JUDGED)[number];


type AnyRec = Record<string, unknown>;

/** The admin's explicit judgement on one field. `untouched` = no judgement given. */
export type Verdict = "confirmed" | "wrong" | "untouched";
/**
 * `via` records HOW a verdict was given, because the three are not equal evidence.
 *   individual  a deliberate tap
 *   bulk        swept in by "All correct"
 *   edit        inferred from replacing the value, which is an act, not an opinion
 */
export type FieldFeedback = { verdict?: Verdict; via?: "individual" | "bulk" | "edit"; note?: string };
/** What the card stores on the pending doc as you review, before approval freezes it. */
export type ReviewFeedback = { fields?: Record<string, FieldFeedback>; cardNote?: string };


/**
 * Are these two values the same for correction purposes?
 *
 * Exported so the card's "was 4" hint and the stored `agreed` can never disagree about
 * what counts as a change. Coordinates only count past ~11m, so re-typing 40.712776 as
 * 40.7128 isn't a "correction".
 */
export function sameValue(field: string, a: unknown, b: unknown): boolean {
  if (field === "latitude" || field === "longitude") {
    const na = Number(a), nb = Number(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) return na === nb;
    return Math.abs(na - nb) < 0.0001;
  }
  if (typeof a === "string" || typeof b === "string") {
    return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
  }
  return (a ?? null) === (b ?? null);
}

export type CorrectionField = {
  field: string; predicted: unknown; actual: unknown; agreed: boolean | null;
  verdict: Verdict; via: string | null; note: string | null; confidence: unknown;
};

/**
 * The row shape every reader works from, whether it was stored at a decision or derived
 * from a card still in review. One builder, so the two can never drift apart.
 *
 * `actualValues` is the live court for an approval, the card's own current values for a
 * provisional row, and null for a rejection (there is no approved value to diff against,
 * but the verdicts given before deciding the court shouldn't exist are still real evidence).
 */
function buildCorrection(
  pending: AnyRec,
  actualValues: AnyRec | null,
  outcome: "approved" | "rejected" | "in_review",
  reviewedBy: string | null,
): AnyRec | null {
  const rv = (pending.pipelineReview ?? null) as AnyRec | null;
  if (!rv) return null;                  // hand-submitted court, nothing the pipeline predicted
  const predicted = (rv.predicted ?? null) as AnyRec | null;

  const fb = (pending.reviewFeedback ?? {}) as ReviewFeedback;
  const perField = fb.fields ?? {};
  const anyVerdict = Object.values(perField).some((v) => v?.verdict && v.verdict !== "untouched");

  const fields: CorrectionField[] =
    (predicted && actualValues) || anyVerdict
      ? JUDGED.map((f) => {
          // null, not false, when there is nothing to diff against: a rejection, or a
          // `predicted` snapshot written before this field was tracked. Guessing "changed"
          // there would invent corrections that never happened.
          const diffable = !!actualValues && !!predicted && predicted[f] !== undefined;
          const agreed = diffable ? sameValue(f, predicted![f], actualValues![f]) : null;

          const v = perField[f] ?? {};
          return {
            field: f,
            predicted: predicted?.[f] ?? null,
            actual: actualValues ? actualValues[f] ?? null : null,
            agreed,
            verdict: v.verdict ?? "untouched",
            // how a confirm was given. A bulk "all correct" is still an affirmative act,
            // but it is not the same evidence as nine deliberate taps, so it stays
            // distinguishable rather than being quietly folded in.
            via: v.verdict && v.verdict !== "untouched" ? v.via ?? "individual" : null,
            note: (v.note ?? "").trim() || null,
            confidence: ((rv.fieldConfidence ?? {}) as AnyRec)[fieldConfKey(f)] ?? null,
          };
        })
      : [];

  const judged = fields.filter((f) => f.verdict !== "untouched");

  return {
    courtId: pending.id ?? null,
    courtName: pending.name ?? null,
    batch: rv.batch ?? null,
    source: rv.source ?? null,
    outcome,
    overallConfidence: rv.confidence ?? null,
    flagged: rv.flagged ?? false,
    approvedCourtId: (actualValues?.__newCourtId as string | undefined) ?? null,
    fields,
    changedCount: fields.filter((f) => f.agreed === false).length,
    // Coverage vs accuracy at a glance, without re-walking `fields` on every dashboard read.
    // `close` = passed but nudged: right enough to tick, still edited.
    verdictCounts: {
      confirmed: judged.filter((f) => f.verdict === "confirmed").length,
      wrong: judged.filter((f) => f.verdict === "wrong").length,
      close: judged.filter((f) => f.verdict === "confirmed" && f.agreed === false).length,
      untouched: fields.length - judged.length,
    },
    cardNote: (fb.cardNote ?? "").trim() || null,
    // Was `predicted` frozen at write time, or reconstructed later by backfill_predicted.js?
    // A backfilled snapshot has any pre-existing hand edits baked in, so `agreed` is weaker
    // evidence on those rows — the verdict is what carries them.
    predictedSource: rv.predictedSource ?? "pipeline",
    // Per-bot answers, stamped onto the card by write_pending.js. Copying them here is what
    // makes this document self-contained: truth and the claims behind it in one row, with
    // no read-time join against a claims.jsonl that lives on a single Mac.
    claims: rv.claims ?? null,
    claimSources: rv.claimSources ?? null,
    // Legacy shape, kept so older analysis keeps working where `claims` is absent.
    botClaims: {
      hoops: ((rv.hoops ?? {}) as AnyRec).bot_votes ?? null,
      location: ((rv.location ?? {}) as AnyRec).by_model ?? null,
      surface: ((rv.surface ?? {}) as AnyRec).raw ?? null,
      lights: ((rv.lights ?? {}) as AnyRec).votes ?? null,
    },
    reviewedBy,
  };
}

export async function logPipelineCorrections(
  pending: AnyRec,
  approved: AnyRec | null,
  outcome: "approved" | "rejected",
  reviewedBy: string | null,
): Promise<void> {
  const row = buildCorrection(pending, outcome === "approved" ? approved : null, outcome, reviewedBy);
  if (!row) return;
  await addDoc(collection(db, "pipeline_corrections"), { ...row, createdAt: serverTimestamp() });
}

/**
 * A correction-shaped row for a card that has been marked up but not yet decided.
 *
 * Returns null unless there is something to say: a pipeline card, still pending, carrying
 * at least one verdict or a card note. `actual` is the card's own saved values, which is
 * precisely what would be published if it were approved right now, so `agreed` and the
 * derived `close` state mean the same thing they do on a stored row.
 *
 * Never written to Firestore. Readers merge it in and drop it the moment a real row for
 * the same court exists.
 */
export function provisionalCorrection(pending: AnyRec): AnyRec | null {
  if (pending.status !== "pending" || pending.hiddenByAdmin) return null;
  const fb = (pending.reviewFeedback ?? {}) as ReviewFeedback;
  const hasVerdict = Object.values(fb.fields ?? {}).some((v) => v?.verdict && v.verdict !== "untouched");
  const hasNote = !!(fb.cardNote ?? "").trim()
    || Object.values(fb.fields ?? {}).some((v) => (v?.note ?? "").trim());
  if (!hasVerdict && !hasNote) return null;
  const row = buildCorrection(pending, pending, "in_review", null);
  return row ? { ...row, provisional: true, createdAt: null } : null;
}

/**
 * The one merge rule, so no reader can invent its own.
 *
 * Answering the two questions that decide whether this data stays trustworthy as a queue
 * is worked over weeks:
 *
 *   "what if I change a verdict after saving it?"  A provisional row is DERIVED on every
 *   read, never stored, so changing a ✓ to a ✗ changes the row. There is no second copy to
 *   go stale and nothing to reconcile. Editing a value the same way just moves `agreed`,
 *   and with it the derived `close`.
 *
 *   "what if I approve after saving?"  The approval writes the real row and freezes it.
 *   From that moment the card is no longer `pending`, so it stops producing a provisional
 *   row at all, and this drops any it did produce. Real always beats provisional; they can
 *   never both count.
 *
 * ONE ROW PER COURT, ALWAYS. `logPipelineCorrections` uses addDoc, so a double-clicked
 * Approve could in principle land twice and count that court twice forever. Collapsing to
 * the newest row per court makes that unrepresentable at read time rather than trusting
 * every future writer to be careful.
 *
 * Cards hidden with verdicts on them are deliberately NOT counted — hiding is an explicit
 * "ignore this one". They are returned separately so the dashboard can say so out loud,
 * because the one thing worse than not counting them is not counting them silently.
 */
export function mergeCorrections(
  stored: AnyRec[],
  pendingDocs: AnyRec[],
): { rows: AnyRec[]; provisional: number; hiddenWithVerdicts: number; unmarkedEdits: number } {
  const seconds = (r: AnyRec) => ((r.createdAt as { seconds?: number } | null)?.seconds ?? 0);
  const byCourt = new Map<string, AnyRec>();
  for (const r of stored) {
    const key = String(r.courtId ?? r.id ?? "");
    const prev = byCourt.get(key);
    if (!prev || seconds(r) >= seconds(prev)) byCourt.set(key, r);
  }

  let provisional = 0, hiddenWithVerdicts = 0, unmarkedEdits = 0;
  for (const p of pendingDocs) {
    const key = String(p.id ?? "");
    if (byCourt.has(key)) continue;                  // a decision was made; it wins
    if (p.hiddenByAdmin) {
      const fb = (p.reviewFeedback ?? {}) as ReviewFeedback;
      if (Object.values(fb.fields ?? {}).some((v) => v?.verdict && v.verdict !== "untouched")) {
        hiddenWithVerdicts++;
      }
      continue;
    }
    unmarkedEdits += countUnmarkedEdits(p);
    const row = provisionalCorrection(p);
    if (!row) continue;
    byCourt.set(key, row);
    provisional++;
  }
  return { rows: [...byCourt.values()], provisional, hiddenWithVerdicts, unmarkedEdits };
}

/**
 * Fields whose value was moved off the pipeline's answer but carry no verdict.
 *
 * The card marks a field the moment you replace its value, so this should stay at zero. It
 * is counted anyway because the value and the verdict are two separate writes: if one ever
 * lands without the other, a real correction ends up in the `untouched` bucket, which is
 * the bucket for "nobody looked". Never scored from here, because inventing a verdict is
 * the exact thing the third state exists to prevent. Counted, and said out loud.
 */
function countUnmarkedEdits(p: AnyRec): number {
  const predicted = ((p.pipelineReview ?? {}) as AnyRec).predicted as AnyRec | undefined;
  if (!predicted || p.status !== "pending") return 0;
  const fields = ((p.reviewFeedback ?? {}) as ReviewFeedback).fields ?? {};
  return JUDGED.filter((f) => predicted[f] !== undefined && !sameValue(f, predicted[f], p[f])
    && !(fields[f]?.verdict && fields[f]?.verdict !== "untouched")).length;
}


/** The fields the card puts a ✓/✗ on. Exported so the card and this stay in lockstep. */
export const JUDGED_FIELDS = JUDGED;



/** pipelineReview.fieldConfidence uses its own key names for a couple of fields. */
function fieldConfKey(f: Tracked): string {
  if (f === "baskets") return "hoops";
  if (f === "courtCondition") return "surface";
  if (f === "threePointLine") return "threePoint";
  if (f === "hoursOfOperation") return "hours";
  if (f === "phoneNumber") return "phone";
  if (f === "hasLights") return "lights";
  if (f === "address" || f === "latitude" || f === "longitude") return "location";
  return f;
}
