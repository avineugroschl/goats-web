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
 * denominator. `botClaims` carries the per-model answers so a field can be attributed to
 * the model that got it right, which is the whole point.
 *
 * Deliberately NOT computing weights or scores here. This is capture only — the analysis
 * can be built any time, but the per-bot record cannot be reconstructed after the fact.
 */
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/** Fields worth scoring. Photo/description/booking are human-supplied, so not the bots' to get wrong. */
const TRACKED = [
  "address", "latitude", "longitude", "baskets", "hasLights",
  "courtCondition", "threePointLine", "hoursOfOperation", "phoneNumber",
] as const;
type Tracked = (typeof TRACKED)[number];

type AnyRec = Record<string, unknown>;

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

  const fields =
    outcome === "approved" && predicted && approved
      ? TRACKED.map((f) => {
          const agreed = same(f, predicted[f], approved[f]);
          return {
            field: f,
            predicted: predicted[f] ?? null,
            actual: approved[f] ?? null,
            agreed,
            confidence: ((rv.fieldConfidence ?? {}) as AnyRec)[fieldConfKey(f)] ?? null,
          };
        })
      : [];

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
    changedCount: fields.filter((f) => !f.agreed).length,
    // per-model answers, so a field can be attributed to whichever bot was right
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
