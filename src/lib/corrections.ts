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
 * JUDGED fields — everything the card puts a ✓/✗ on. A superset of TRACKED: `name` and
 * `goatsTake` are pipeline output worth judging, but diffing free prose is meaningless
 * (any edit at all reads as "changed"), so they carry a verdict and no `agreed`.
 */
const JUDGED = [...TRACKED, "name", "goatsTake"] as const;
type Tracked = (typeof JUDGED)[number];
const isDiffable = (f: Tracked): boolean => (TRACKED as readonly string[]).includes(f);


type AnyRec = Record<string, unknown>;

/** The admin's explicit judgement on one field. `untouched` = no judgement given. */
export type Verdict = "confirmed" | "wrong" | "untouched";
export type FieldFeedback = { verdict?: Verdict; via?: "individual" | "bulk"; note?: string };
/** What the card stores on the pending doc as you review, before approval freezes it. */
export type ReviewFeedback = { fields?: Record<string, FieldFeedback>; cardNote?: string };


/** Coordinates only count as changed past ~11m, so re-typing 40.712776 as 40.7128 isn't a "correction". */
function same(field: Tracked, a: unknown, b: unknown): boolean {
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

export async function logPipelineCorrections(
  pending: AnyRec,
  approved: AnyRec | null,
  outcome: "approved" | "rejected",
  reviewedBy: string | null,
): Promise<void> {
  const rv = (pending.pipelineReview ?? null) as AnyRec | null;
  if (!rv) return;                       // hand-submitted court, nothing the pipeline predicted
  const predicted = (rv.predicted ?? null) as AnyRec | null;

  const fb = (pending.reviewFeedback ?? {}) as ReviewFeedback;
  const perField = fb.fields ?? {};

  // A rejection has no approved values to diff against, but the admin may still have
  // judged individual fields before deciding the court shouldn't exist. Those verdicts are
  // real evidence, so keep the array whenever anything was judged.
  const anyVerdict = Object.values(perField).some((v) => v?.verdict && v.verdict !== "untouched");
  const fields =
    (outcome === "approved" && predicted && approved) || anyVerdict
      ? JUDGED.map((f) => {
          const gotActual = outcome === "approved" && !!approved;
          // null, not false, when there is nothing to diff against: free-prose fields, a
          // rejection, or a `predicted` snapshot written before this field was tracked.
          // Guessing "changed" there would invent corrections that never happened.
          const diffable = gotActual && predicted && isDiffable(f) && predicted[f] !== undefined;
          const agreed = diffable ? same(f, predicted[f], approved![f]) : null;

          const v = perField[f] ?? {};
          return {
            field: f,
            predicted: predicted?.[f] ?? null,
            actual: gotActual ? approved![f] ?? null : null,
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

  await addDoc(collection(db, "pipeline_corrections"), {
    courtId: pending.id ?? null,
    courtName: pending.name ?? null,
    batch: rv.batch ?? null,
    source: rv.source ?? null,
    outcome,
    overallConfidence: rv.confidence ?? null,
    flagged: rv.flagged ?? false,
    approvedCourtId: (approved?.__newCourtId as string | undefined) ?? null,
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
    createdAt: serverTimestamp(),
  });
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
