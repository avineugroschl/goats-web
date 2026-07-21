"use client";

/**
 * PendingCourtCard — editable review card for a pending court.
 *
 * Shows every field as an editable input, with the pipeline's per-field confidence
 * badge (🟢🟡🔴) and an expandable "AI research" panel (per-bot local intel, vision
 * notes, layout votes, satellite link). Lets the admin edit fields, upload a photo,
 * Save (to pending_courts), and Approve (parent copies to the live `courts` collection).
 */
import { useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

type Review = {
  mapsLink?: string;
  hoops?: { value?: number | null; confidence?: string; bot_votes?: Record<string, number | null>; vision?: number | null };
  lights?: { value?: string; confidence?: string; votes?: Record<string, number> };
  layout?: Record<string, string>;
  localIntel?: Record<string, string>;
  vision?: { hoops?: number | null; layout?: string; confidence?: string; notes?: string };
  source?: string;
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
  goatsTake: string;
  photoUrl?: string;
  photoUrlCard?: string;
  photoUrlFull?: string;
  status: string;
  pipelineReview?: Review;
};

const BADGE: Record<string, string> = { GREEN: "🟢", YELLOW: "🟡", RED: "🔴" };
function Conf({ c }: { c?: string }) {
  if (!c) return null;
  return <span title={`${c} confidence`} className="ml-1 text-xs">{BADGE[c] ?? ""}</span>;
}

function Field({ label, children, conf }: { label: string; children: React.ReactNode; conf?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-dash-text-muted">{label}<Conf c={conf} /></span>
      {children}
    </label>
  );
}
const inputCls = "rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-text";

export default function PendingCourtCard({
  court, busy, onApprove, onReject, onHide,
}: {
  court: ReviewCourt;
  busy: boolean;
  onApprove: (draft: ReviewCourt) => void;
  onReject: (id: string) => void;
  onHide: (id: string) => void;
}) {
  const [d, setD] = useState<ReviewCourt>(court);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const rv = court.pipelineReview;
  const set = <K extends keyof ReviewCourt>(k: K, v: ReviewCourt[K]) => { setD((p) => ({ ...p, [k]: v })); setDirty(true); };

  const photo = d.photoUrlCard || d.photoUrl || "";
  const intelEntries = useMemo(() => Object.entries(rv?.localIntel ?? {}), [rv]);

  async function save() {
    setSaving(true);
    try {
      await updateDoc(doc(db, "pending_courts", court.id), {
        name: d.name, address: d.address, baskets: Number(d.baskets) || 0,
        setting: d.setting, accessType: d.accessType, hasLights: !!d.hasLights,
        courtCondition: d.courtCondition, threePointLine: d.threePointLine,
        hoursOfOperation: d.hoursOfOperation, phoneNumber: d.phoneNumber,
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
            {rv?.mapsLink && (
              <a href={rv.mapsLink} target="_blank" rel="noreferrer" className="text-xs text-teal hover:underline">
                Open satellite ↗
              </a>
            )}
          </div>
        </div>
        {rv?.source && <span className="rounded bg-dash-bg px-2 py-0.5 text-[10px] text-dash-text-muted">{rv.source}</span>}
      </div>

      {/* editable fields */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className={inputCls} value={d.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Address"><input className={inputCls} value={d.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="Latitude"><input type="number" step="any" className={inputCls} placeholder="e.g. 40.712776" value={d.latitude ?? ""} onChange={(e) => set("latitude", e.target.value === "" ? undefined : Number(e.target.value))} /></Field>
        <Field label="Longitude"><input type="number" step="any" className={inputCls} placeholder="e.g. -74.005974" value={d.longitude ?? ""} onChange={(e) => set("longitude", e.target.value === "" ? undefined : Number(e.target.value))} /></Field>
        <Field label="Baskets (hoops)" conf={rv?.hoops?.confidence}>
          <input type="number" className={inputCls} value={d.baskets} onChange={(e) => set("baskets", Number(e.target.value))} />
        </Field>
        <Field label="Setting">
          <select className={inputCls} value={d.setting} onChange={(e) => set("setting", e.target.value)}>
            <option>Outdoor</option><option>Indoor</option>
          </select>
        </Field>
        <Field label="Access">
          <select className={inputCls} value={d.accessType} onChange={(e) => set("accessType", e.target.value)}>
            <option>Public</option><option>Private</option><option>Membership Required</option>
          </select>
        </Field>
        <Field label="Lights" conf={rv?.lights?.confidence}>
          <label className="flex items-center gap-2 py-2 text-sm text-dash-text">
            <input type="checkbox" checked={!!d.hasLights} onChange={(e) => set("hasLights", e.target.checked)} /> has lights
          </label>
        </Field>
        <Field label="Condition"><input className={inputCls} value={d.courtCondition} onChange={(e) => set("courtCondition", e.target.value)} /></Field>
        <Field label="3PT line"><input className={inputCls} value={d.threePointLine} onChange={(e) => set("threePointLine", e.target.value)} /></Field>
        <Field label="Hours"><input className={inputCls} placeholder="blank if unverified" value={d.hoursOfOperation} onChange={(e) => set("hoursOfOperation", e.target.value)} /></Field>
        <Field label="Phone"><input className={inputCls} placeholder="blank if unverified" value={d.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} /></Field>
      </div>

      <div className="mb-4">
        <Field label="GOATS Take"><textarea className={`${inputCls} min-h-[80px]`} value={d.goatsTake} onChange={(e) => set("goatsTake", e.target.value)} /></Field>
      </div>

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
          {rv.vision?.notes && <div><span className="text-dash-text-muted">Vision: </span><span className="text-dash-text">{rv.vision.notes}</span></div>}
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
            <button onClick={() => onApprove(d)} disabled={busy || saving}
              className="rounded-xl bg-status-confirmed px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-status-confirmed/80 disabled:opacity-50">
              {busy ? "..." : "Approve"}
            </button>
            <button onClick={save} disabled={saving || !dirty}
              className="rounded-xl border border-teal px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-teal hover:bg-teal/10 disabled:opacity-40">
              {saving ? "Saving…" : dirty ? "Save edits" : "Saved"}
            </button>
            <button onClick={() => onReject(court.id)} disabled={busy}
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
