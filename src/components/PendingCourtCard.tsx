"use client";

/**
 * PendingCourtCard — editable review card for a pending court.
 *
 * Shows every field as an editable input, with the pipeline's per-field confidence
 * badge (🟢🟡🔴) and an expandable "AI research" panel (per-bot local intel, vision
 * notes, layout votes, satellite link). Lets the admin edit fields, upload a photo,
 * Save (to pending_courts), and Approve (parent copies to the live `courts` collection).
 *
 * Each pipeline-supplied field also carries a ✓/✗ verdict and a note. Editing a value was
 * never enough of a signal on its own: an untouched field could mean "checked, correct" or
 * "never looked at", and treating those the same counts every unexamined field as a win
 * for the bots. The verdict says which, and untouched stays a real third state.
 *
 * Verdicts autosave to the pending doc as you tap, so a queue can be worked through over
 * several sittings; `logPipelineCorrections` freezes them into the correction at approval.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { sameValue } from "@/lib/corrections";
import type { ReviewFeedback, Verdict } from "@/lib/corrections";


type Review = {
  mapsLink?: string;
  hoops?: { value?: number | null; confidence?: string; bot_votes?: Record<string, number | null>; vision?: number | null };
  lights?: { value?: string; confidence?: string; votes?: Record<string, number> };
  layout?: Record<string, string>;
  localIntel?: Record<string, string>;
  vision?: { hoops?: number | null; layout?: string; confidence?: string; notes?: string };
  source?: string;
  // written by write_pending.js but never rendered until now
  confidence?: string;
  flagged?: boolean;
  reviewFlag?: string | null;
  reviewerNotes?: string | null;
  fieldConfidence?: Record<string, string | null>;
  // per-bot verdict on whether the stored address/coordinates match the court they researched
  location?: { disputed?: number; checked?: number; confidence?: string; by_model?: Record<string, string> };
  // immutable snapshot of what the pipeline proposed; 'backfill' = reconstructed after the fact
  predicted?: Record<string, unknown>;
  predictedSource?: string;
};


export type ReviewCourt = {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  baskets: number;
  setting: string;
  accessType: string;
  hasLights: boolean;
  courtCondition: string;
  threePointLine: string;
  hoursOfOperation: string;
  phoneNumber: string;
  bookingUrl?: string;
  goatsTake: string;
  photoUrl?: string;
  photoUrlCard?: string;
  photoUrlFull?: string;
  status: string;
  pipelineReview?: Review;
  reviewFeedback?: ReviewFeedback;
};

/** Every pipeline-supplied field gets judged. Mirrors JUDGED in lib/corrections.ts. */
const JUDGE_LABEL: Record<string, string> = {
  name: "Name", address: "Address", latitude: "Latitude", longitude: "Longitude",
  baskets: "Baskets", setting: "Setting", accessType: "Access", hasLights: "Lights",
  courtCondition: "Condition", threePointLine: "3PT line", hoursOfOperation: "Hours",
  phoneNumber: "Phone", goatsTake: "GOATS Take",
};
const JUDGE_KEYS = Object.keys(JUDGE_LABEL);

/** What the ✓/✗ pair needs to render and report one field. */
type Judge = {
  f: string;
  verdict: Verdict;
  note: string;
  /** value differs from what the pipeline proposed — with ✓ this is the "close" case */
  changed: boolean;
  /** what the pipeline proposed, shown under the input once the value moves away from it */
  was: unknown;
  set: (f: string, v: Verdict) => void;
  setNote: (f: string, note: string) => void;
};


const BADGE: Record<string, string> = { GREEN: "🟢", YELLOW: "🟡", RED: "🔴" };
function Conf({ c }: { c?: string }) {
  if (!c) return null;
  return <span title={`${c} confidence`} className="ml-1 text-xs">{BADGE[c] ?? ""}</span>;
}

/**
 * The ✓/✗ pair that sits on a field's label row.
 *
 * Untouched is the zero-effort default and must stay that way — nine fields times three
 * controls is enough clicking that any friction here means the feature stops being used by
 * the third card, and unused capture is worse than none. So: hollow until tapped, one tap
 * to judge, tap the same mark again to clear back to untouched.
 *
 * "close" appears when a field is ticked AND its value was edited: right enough to pass,
 * still needed a nudge. That is a different problem from being wrong (tighten a prompt vs
 * distrust a source), so it is worth seeing on the card and counting separately.
 */
function VerdictMark({ j }: { j: Judge }) {
  const base = "rounded px-1.5 py-0.5 text-[11px] leading-none transition-colors";
  const on = (v: Verdict) => j.verdict === v;
  return (
    <span className="ml-auto flex items-center gap-1">
      {on("confirmed") && j.changed && (
        <span className="rounded bg-status-confirmed/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-status-confirmed">
          close
        </span>
      )}
      {on("wrong") && j.changed && (
        <span className="rounded bg-teal/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-teal">
          fixed
        </span>
      )}
      <button
        type="button"
        title={on("confirmed") ? "clear" : "correct"}
        onClick={() => j.set(j.f, on("confirmed") ? "untouched" : "confirmed")}
        className={`${base} ${on("confirmed")
          ? "bg-status-confirmed/20 text-status-confirmed"
          : "text-dash-text-muted/50 hover:text-status-confirmed"}`}
      >✓</button>
      <button
        type="button"
        title={on("wrong") ? "clear" : "wrong"}
        onClick={() => j.set(j.f, on("wrong") ? "untouched" : "wrong")}
        className={`${base} ${on("wrong")
          ? "bg-coral/20 text-coral"
          : "text-dash-text-muted/50 hover:text-coral"}`}
      >✗</button>
    </span>
  );
}

/**
 * Note line under a judged field. Hidden until there is a verdict, so the card stays readable.
 *
 * The prompt used to ask "wrong. what's right?", which read as though the correct answer
 * belonged in this box. It does not. The field above is the answer and is what publishes;
 * this is only for anything the value itself cannot say.
 */
function FieldNote({ j }: { j: Judge }) {
  if (j.verdict === "untouched") return null;
  return (
    <div className="mt-1 pl-3">
      <span className="text-[10px] text-dash-text-muted/70">↳ optional. anything worth knowing</span>
      <input
        className="mt-0.5 w-full rounded-lg border border-dash-border bg-dash-bg px-2 py-1 text-xs text-dash-text"
        value={j.note}
        onChange={(e) => j.setNote(j.f, e.target.value)}
      />
    </div>
  );
}

/**
 * What the pipeline originally said, under any field you have moved away from it.
 *
 * `pipelineReview.predicted` has been frozen on the card since it was written and no edit
 * can reach it, so the original was never actually lost — it just had nowhere to appear.
 * Without it the only trace of a change was the "close" chip, which needs a ✓ to show at
 * all, so crossing a field out and fixing it left you with no way to see what you fixed.
 */
function WasHint({ j }: { j: Judge }) {
  if (!j.changed) return null;
  const v = j.was;
  const text =
    v === null || v === undefined || String(v).trim() === ""
      ? "(blank)"
      : typeof v === "boolean"
        ? (v ? "has lights" : "no lights")
        : String(v);
  return (
    <div className="pl-3 text-[10px] leading-relaxed text-dash-text-muted/70" title={text}>
      was {text.length > 140 ? `${text.slice(0, 140)}…` : text}
    </div>
  );
}

function Field({ label, children, conf, judge }: {
  label: string; children: React.ReactNode; conf?: string; judge?: Judge;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="flex items-center text-dash-text-muted">
        {label}<Conf c={conf} />
        {judge && <VerdictMark j={judge} />}
      </span>
      {children}
      {judge && <WasHint j={judge} />}
      {judge && <FieldNote j={judge} />}
    </div>
  );
}
const inputCls = "w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-text";


export default function PendingCourtCard({
  court, busy, onApprove, onReject, onHide,
}: {
  court: ReviewCourt;
  busy: boolean;
  onApprove: (draft: ReviewCourt) => void;
  onReject: (id: string, feedback?: ReviewFeedback) => void;

  onHide: (id: string) => void;
}) {
  const [d, setD] = useState<ReviewCourt>(court);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const rv = court.pipelineReview;
  // Autosave must not fire on mount, or simply opening the queue would rewrite every card.
  const dDirty = useRef(false);
  /**
   * Replacing a value IS the correction. Nothing else has to be tapped.
   *
   * The field is where the fix goes and what gets published, so requiring a ✗ on top of it
   * meant a fixed value with no tap scored as `untouched`, which is the bucket for "nobody
   * looked". The single strongest piece of evidence in the whole card was being thrown away
   * for not being announced twice.
   *
   * Recorded as via:"edit" so it stays separable from a deliberate tap, the same way bulk
   * does. Tap ✓ afterwards if the pipeline was close and you only nudged it. Putting the
   * value back the way it was clears a mark this made, and never one you made yourself.
   */
  const set = <K extends keyof ReviewCourt>(k: K, v: ReviewCourt[K]) => {
    dDirty.current = true; setD((p) => ({ ...p, [k]: v })); setDirty(true);
    if (!canJudge || !JUDGE_KEYS.includes(k as string)) return;
    const f = k as string;
    const moved = !sameValue(f, previousOf(f), v);
    fbDirty.current = true;
    setFb((p) => {
      const fields = { ...(p.fields ?? {}) };
      const cur = fields[f];
      if (moved) {
        if (cur?.verdict) return p;                        // your own judgement stands
        fields[f] = { ...(cur ?? {}), verdict: "wrong", via: "edit" };
      } else {
        if (cur?.via !== "edit") return p;                 // only ever undo our own inference
        const note = cur.note;
        if (note) fields[f] = { note }; else delete fields[f];
      }
      return { ...p, fields };
    });
  };

  const photo = d.photoUrlCard || d.photoUrl || "";

  /**
   * Built from the pin as it stands, not from the link stored at discovery.
   *
   * `pipelineReview.mapsLink` is a string frozen when the court was selected. It matched
   * the card everywhere it was checked, but it cannot follow an edit, so the one time it
   * went stale was the exact moment you were using it: nudging a bad pin and looking again.
   */
  const satelliteLink = useMemo(() => {
    const la = Number(d.latitude), ln = Number(d.longitude);
    if (Number.isFinite(la) && Number.isFinite(ln) && (la || ln)) {
      return `https://www.google.com/maps/@${la},${ln},80m/data=!3m1!1e3`;
    }
    return rv?.mapsLink || "";
  }, [d.latitude, d.longitude, rv]);
  const intelEntries = useMemo(() => Object.entries(rv?.localIntel ?? {}), [rv]);

  // ── per-field verdicts ────────────────────────────────────────────────────
  const [fb, setFb] = useState<ReviewFeedback>(court.reviewFeedback ?? {});
  // Autosave must not fire on mount, or simply opening the queue would stamp every card.
  const fbDirty = useRef(false);

  /**
   * Did this field's value move away from what the pipeline proposed?
   *
   * Prefers the frozen `predicted` snapshot. Falls back to the values the card mounted
   * with for the two free-prose fields it deliberately doesn't carry, which reads as
   * "you edited this in this sitting" — weaker, but honest and never wrong in the
   * direction that invents a correction.
   */
  const previousOf = useCallback((f: string): unknown => {
    const p = rv?.predicted;
    return p && p[f] !== undefined ? p[f] : (court as unknown as Record<string, unknown>)[f];
  }, [rv, court]);

  // sameValue is the comparator the stored correction uses, so the hint on the card and
  // the `agreed` flag in the dashboard can never disagree about what counts as a change.
  const changedFrom = useCallback((f: string): boolean =>
    !sameValue(f, previousOf(f), (d as unknown as Record<string, unknown>)[f]),
  [previousOf, d]);

  const setVerdict = useCallback((f: string, v: Verdict, via: "individual" | "bulk" = "individual") => {
    fbDirty.current = true;
    setFb((p) => {
      const fields = { ...(p.fields ?? {}) };
      // Clearing back to untouched drops the entry entirely rather than storing
      // {verdict:"untouched"} — absent and untouched are the same thing, and one
      // representation of it means the dashboard can't disagree with itself.
      if (v === "untouched") {
        const note = fields[f]?.note;
        if (note) fields[f] = { note };            // keep a note the verdict didn't own
        else delete fields[f];
      } else {
        fields[f] = { ...(fields[f] ?? {}), verdict: v, via };
      }
      return { ...p, fields };
    });
  }, []);

  const setFieldNote = useCallback((f: string, note: string) => {
    fbDirty.current = true;
    setFb((p) => ({ ...p, fields: { ...(p.fields ?? {}), [f]: { ...(p.fields ?? {})[f], note } } }));
  }, []);

  /** Fill in only what hasn't been judged, and mark it bulk so it stays distinguishable. */
  const markAllCorrect = useCallback(() => {
    fbDirty.current = true;
    setFb((p) => {
      const fields = { ...(p.fields ?? {}) };
      for (const f of JUDGE_KEYS) {
        if (!fields[f]?.verdict) fields[f] = { ...(fields[f] ?? {}), verdict: "confirmed", via: "bulk" };
      }
      return { ...p, fields };
    });
  }, []);

  // Verdicts belong to the review, not to the court's values, so they save on their own
  // rather than waiting behind the explicit "Save edits" button. Debounced so holding a key
  // in a note box isn't one write per character.
  const [fbSaved, setFbSaved] = useState(true);
  useEffect(() => {
    if (!fbDirty.current) return;
    setFbSaved(false);
    const t = setTimeout(() => {
      updateDoc(doc(db, "pending_courts", court.id), { reviewFeedback: fb })
        .then(() => setFbSaved(true))
        .catch((e) => console.warn("verdict save failed:", e));
    }, 700);
    return () => clearTimeout(t);
  }, [fb, court.id]);

  /**
   * Field values autosave too, on the same debounce as the verdicts.
   *
   * They used to wait behind the Save button while the ✓/✗ saved themselves, and that split
   * was the one real way to lose work: fix a value, tick it wrong, navigate away, and the
   * tick survived while the fix did not, leaving a card marked wrong that still showed the
   * wrong value. Approve always published the in-memory draft, so this only ever bit you on
   * the way out.
   *
   * Gated to a pending card. An approved one has already been copied into `courts`, so
   * quietly rewriting its draft would put the two permanently out of step.
   */
  useEffect(() => {
    if (!dDirty.current || court.status !== "pending") return;
    const t = setTimeout(() => { save(); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, court.status]);

  // Only a pipeline draft still awaiting a decision can be judged. A hand-submitted court
  // has no prediction to be right or wrong about, and an already-approved one had its
  // correction written at approval — offering ✓/✗ on either would collect taps that go
  // nowhere, which is worse than not offering them.
  const canJudge = !!rv && court.status === "pending";

  const judge = useCallback((f: string): Judge | undefined => canJudge ? ({
    f,
    verdict: fb.fields?.[f]?.verdict ?? "untouched",
    note: fb.fields?.[f]?.note ?? "",
    changed: changedFrom(f),
    was: previousOf(f),
    set: setVerdict,
    setNote: setFieldNote,
  }) : undefined, [canJudge, fb, changedFrom, previousOf, setVerdict, setFieldNote]);


  const judgedCount = JUDGE_KEYS.filter((f) => fb.fields?.[f]?.verdict).length;


  async function save() {
    setSaving(true);
    try {
      await updateDoc(doc(db, "pending_courts", court.id), {
        name: d.name, address: d.address, baskets: Number(d.baskets) || 0,
        setting: d.setting, accessType: d.accessType, hasLights: !!d.hasLights,
        courtCondition: d.courtCondition, threePointLine: d.threePointLine,
        hoursOfOperation: d.hoursOfOperation, phoneNumber: d.phoneNumber,
        bookingUrl: (d.bookingUrl ?? "").trim(),
        goatsTake: d.goatsTake, photoUrlCard: d.photoUrlCard ?? "", photoUrlFull: d.photoUrlFull ?? "",
        // coordinates — editable so a slightly-off pin can be nudged before approval
        ...(Number.isFinite(Number(d.latitude)) ? { latitude: Number(d.latitude) } : {}),
        ...(Number.isFinite(Number(d.longitude)) ? { longitude: Number(d.longitude) } : {}),
      });
      setDirty(false);
    } finally { setSaving(false); }
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `court_photos_pending/${court.id}.${ext}`;
      await uploadBytes(ref(storage, path), file);
      const url = await getDownloadURL(ref(storage, path));
      setD((p) => ({ ...p, photoUrlCard: url, photoUrlFull: url })); setDirty(true);
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          {photo
            ? <img src={photo} alt="" className="h-14 w-14 rounded-lg object-cover" />
            : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-dash-bg text-[10px] text-dash-text-muted">no photo</div>}
          <div>
            <h3 className="text-lg font-semibold text-white">{d.name || "Unnamed"}</h3>
            <p className="text-sm text-white/40">{d.address}</p>
            {satelliteLink && (
              <a href={satelliteLink} target="_blank" rel="noreferrer" className="text-xs text-teal hover:underline">
                Open satellite ↗
              </a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {rv?.location?.confidence === "RED" && (
            <span className="rounded bg-coral/20 px-2 py-0.5 text-[10px] font-semibold text-coral">
              address disputed {rv.location.disputed}/{rv.location.checked}
            </span>
          )}
          {rv?.source && <span className="rounded bg-dash-bg px-2 py-0.5 text-[10px] text-dash-text-muted">{rv.source}</span>}
        </div>
      </div>

      {/* Why the pipeline could not confirm this court. write_pending sets reviewFlag for a
          bad pin, an unconfirmed hoop count, or a disputed address; without this the card
          looked identical to a fully verified one. */}
      {rv?.flagged && rv?.reviewFlag && (
        <div className="mb-4 rounded-xl border border-coral/40 bg-coral/10 p-3">
          <div className="font-display text-[11px] font-bold uppercase tracking-wider text-coral">Needs a look before publishing</div>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-dash-text">{rv.reviewFlag}</p>
        </div>
      )}

      {/* Verdict progress + the bulk shortcut. Without a shortcut the honest-but-tedious
          path (thirteen taps on a card where nothing is wrong) gets abandoned, and an
          abandoned check is worse data than a bulk one that is recorded AS bulk. */}
      {canJudge && (
        <div className="mb-3 flex items-center gap-3 text-[11px]">

          <span className="text-dash-text-muted">
            checked {judgedCount} of {JUDGE_KEYS.length} fields
          </span>
          <button type="button" onClick={markAllCorrect}
            className="rounded border border-status-confirmed/40 px-2 py-0.5 text-status-confirmed hover:bg-status-confirmed/10">
            All correct
          </button>
          {!fbSaved && <span className="text-dash-text-muted/60">saving…</span>}
        </div>
      )}

      {/* editable fields */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name" judge={judge("name")}><input className={inputCls} value={d.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Address" conf={rv?.fieldConfidence?.location ?? undefined} judge={judge("address")}><input className={inputCls} value={d.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="Latitude" judge={judge("latitude")}><input type="number" step="any" className={inputCls} placeholder="e.g. 40.712776" value={d.latitude ?? ""} onChange={(e) => set("latitude", e.target.value === "" ? undefined : Number(e.target.value))} /></Field>
        <Field label="Longitude" judge={judge("longitude")}><input type="number" step="any" className={inputCls} placeholder="e.g. -74.005974" value={d.longitude ?? ""} onChange={(e) => set("longitude", e.target.value === "" ? undefined : Number(e.target.value))} /></Field>
        <Field label="Baskets (hoops)" conf={rv?.hoops?.confidence} judge={judge("baskets")}>
          <input type="number" className={inputCls} value={d.baskets} onChange={(e) => set("baskets", Number(e.target.value))} />
        </Field>
        <Field label="Setting" judge={judge("setting")}>
          <select className={inputCls} value={d.setting} onChange={(e) => set("setting", e.target.value)}>
            <option>Outdoor</option><option>Indoor</option>
          </select>
        </Field>
        <Field label="Access" judge={judge("accessType")}>
          <select className={inputCls} value={d.accessType} onChange={(e) => set("accessType", e.target.value)}>
            {/* "Membership" is canonical (filter matches by prefix); the old
                "Membership Required" stays so existing drafts render right. */}
            <option>Public</option><option>Private</option><option>Membership</option><option>Membership Required</option>
          </select>
        </Field>
        <Field label="Lights" conf={rv?.lights?.confidence} judge={judge("hasLights")}>
          <label className="flex items-center gap-2 py-2 text-sm text-dash-text">
            <input type="checkbox" checked={!!d.hasLights} onChange={(e) => set("hasLights", e.target.checked)} /> has lights
          </label>
        </Field>
        <Field label="Condition" conf={rv?.fieldConfidence?.surface ?? undefined} judge={judge("courtCondition")}><input className={inputCls} value={d.courtCondition} onChange={(e) => set("courtCondition", e.target.value)} /></Field>
        <Field label="3PT line" conf={rv?.fieldConfidence?.threePoint ?? undefined} judge={judge("threePointLine")}><input className={inputCls} value={d.threePointLine} onChange={(e) => set("threePointLine", e.target.value)} /></Field>
        <Field label="Hours" conf={rv?.fieldConfidence?.hours ?? undefined} judge={judge("hoursOfOperation")}><input className={inputCls} placeholder="blank if unverified" value={d.hoursOfOperation} onChange={(e) => set("hoursOfOperation", e.target.value)} /></Field>
        <Field label="Phone" conf={rv?.fieldConfidence?.phone ?? undefined} judge={judge("phoneNumber")}><input className={inputCls} placeholder="blank if unverified" value={d.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} /></Field>
        {/* no verdict: the pipeline never fills this in, so there is nothing of its to judge */}
        <Field label="Booking link"><input className={inputCls} placeholder="blank = no Book button" value={d.bookingUrl ?? ""} onChange={(e) => set("bookingUrl", e.target.value)} /></Field>
      </div>

      <div className="mb-4">
        <Field label="GOATS Take" judge={judge("goatsTake")}><textarea className={`${inputCls} min-h-[80px]`} value={d.goatsTake} onChange={(e) => set("goatsTake", e.target.value)} /></Field>
      </div>

      {/* Card-level note: anything about the court or the draft as a whole that doesn't
          belong to one field. */}
      {canJudge && (
        <div className="mb-4">
          <Field label="Note on this card">

            <textarea
              className={`${inputCls} min-h-[52px]`}
              placeholder="anything about this court or draft that isn't about one field"
              value={fb.cardNote ?? ""}
              onChange={(e) => { fbDirty.current = true; setFb((p) => ({ ...p, cardNote: e.target.value })); }}
            />
          </Field>
        </div>
      )}


      <div className="mb-4 flex items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-dash-border px-3 py-1.5 text-xs text-dash-text hover:bg-dash-bg">
          {photo ? "Replace photo" : "Add photo"}
          <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
        </label>
        {rv && (
          <button onClick={() => setExpanded((s) => !s)} className="text-xs text-teal hover:underline">
            {expanded ? "Hide" : "Show"} AI research ({intelEntries.length} bots)
          </button>
        )}
      </div>

      {/* expandable AI research / provenance */}
      {expanded && rv && (
        <div className="mb-4 space-y-3 rounded-xl bg-dash-bg p-4 text-xs">
          {rv.hoops?.bot_votes && (
            <div><span className="text-dash-text-muted">Hoop votes: </span>
              <span className="text-dash-text">
                {Object.entries(rv.hoops.bot_votes).filter(([, v]) => v != null).map(([k, v]) => `${k}:${v}`).join("  ") || "—"}
                {rv.hoops.vision != null ? `  vision:${rv.hoops.vision}` : ""}
              </span>
            </div>
          )}
          {rv.location?.by_model && Object.keys(rv.location.by_model).length > 0 && (
            <div>
              <div className="text-dash-text-muted">
                Address check ({rv.location.disputed ?? 0} of {rv.location.checked ?? 0} disputed)
              </div>
              {Object.entries(rv.location.by_model).map(([bot, verdict]) => {
                const ok = /^\s*ok\b/i.test(verdict ?? "");
                return (
                  <div key={bot} className={ok ? "text-dash-text-muted" : "text-coral"}>
                    <span className="font-semibold">{bot}:</span> {verdict}
                  </div>
                );
              })}
            </div>
          )}
          {rv.vision?.notes && <div><span className="text-dash-text-muted">Vision: </span><span className="text-dash-text">{rv.vision.notes}</span></div>}
          {rv.reviewerNotes && <div><span className="text-dash-text-muted">Reviewer: </span><span className="text-dash-text">{rv.reviewerNotes}</span></div>}
          {intelEntries.map(([bot, txt]) => (
            <div key={bot}>
              <div className="font-semibold text-dash-text">{bot}</div>
              <div className="whitespace-pre-wrap text-dash-text-muted">{txt}</div>
            </div>
          ))}
        </div>
      )}

      {/* actions */}
      <div className="flex flex-wrap gap-3">
        {court.status === "pending" && (
          <>
            <button onClick={() => onApprove({ ...d, reviewFeedback: fb })} disabled={busy || saving}

              className="rounded-xl bg-status-confirmed px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-status-confirmed/80 disabled:opacity-50">
              {busy ? "..." : "Approve"}
            </button>
            <button onClick={save} disabled={saving || !dirty}
              className="rounded-xl border border-teal px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-teal hover:bg-teal/10 disabled:opacity-40">
              {saving ? "Saving…" : dirty ? "Save edits" : "Saved"}
            </button>
            <button onClick={() => onReject(court.id, fb)} disabled={busy}

              className="rounded-xl bg-status-rejected/10 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-status-rejected hover:bg-status-rejected/20 disabled:opacity-50">
              Reject
            </button>
          </>
        )}
        <button onClick={() => onHide(court.id)} disabled={busy}
          className="rounded-xl border border-dash-border px-4 py-2.5 text-xs text-white/30 hover:text-white/60 disabled:opacity-50">
          Hide
        </button>
      </div>
    </div>
  );
}
