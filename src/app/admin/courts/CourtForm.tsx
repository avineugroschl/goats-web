"use client";

// Court add/edit form for the website admin panel.
// Mirrors the iOS AdminAddCourtScreen.swift and Android AdminAddCourtScreen.kt
// field-for-field: same dropdown options, same validation (only name + address
// required), same photo pipeline (card 600x400 3:2 + full 600w, both WebP at
// court_photos/{id}_card.webp + _full.webp), same hardcoded
// activeUserIds/geofenceRadiusMeters on create, and the same scoped update
// fields on edit (does not touch operator/billing/presence fields). Latitude
// and longitude are manual text entry; the syncCourtTimeZone Cloud Function
// derives timeZone server-side from them.

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Court } from "@/lib/types";
import {
  uploadCourtMainPhoto,
  deleteCourtMainPhoto,
} from "@/lib/processImage";

const SETTING_OPTIONS = ["Outdoor", "Indoor"] as const;
const ACCESS_OPTIONS = ["Public", "Private"] as const;
const CONDITION_OPTIONS = [
  "Below Average",
  "Okay",
  "Solid",
  "Good",
  "Very Good",
] as const;
const THREE_POINT_OPTIONS = [
  "None",
  "High School",
  "Old NCAA",
  "FIBA",
  "NBA",
] as const;

interface CourtFormProps {
  mode: "new" | "edit";
  courtId: string;
  existingCourt: Court | null;
}

export default function CourtForm({
  mode,
  courtId,
  existingCourt,
}: CourtFormProps) {
  const router = useRouter();

  const [name, setName] = useState(existingCourt?.name ?? "");
  const [address, setAddress] = useState(existingCourt?.address ?? "");
  const [latitude, setLatitude] = useState(
    existingCourt?.latitude ? String(existingCourt.latitude) : ""
  );
  const [longitude, setLongitude] = useState(
    existingCourt?.longitude ? String(existingCourt.longitude) : ""
  );
  const [baskets, setBaskets] = useState(
    existingCourt?.baskets ? String(existingCourt.baskets) : ""
  );
  const [setting, setSetting] = useState(existingCourt?.setting || "Outdoor");
  const [accessType, setAccessType] = useState(
    existingCourt?.accessType || "Public"
  );
  const [hasLights, setHasLights] = useState(existingCourt?.hasLights ?? false);
  const [hoursOfOperation, setHoursOfOperation] = useState(
    existingCourt?.hoursOfOperation ?? ""
  );
  const [phoneNumber, setPhoneNumber] = useState(
    existingCourt?.phoneNumber ?? ""
  );
  const [courtCondition, setCourtCondition] = useState(
    existingCourt?.courtCondition || "Okay"
  );
  const [threePointLine, setThreePointLine] = useState(
    existingCourt?.threePointLine || "None"
  );
  const [goatsTake, setGoatsTake] = useState(existingCourt?.goatsTake ?? "");

  // Photo state. existingPhotoUrl is the URL currently saved on the court;
  // newPhotoFile is a freshly picked file pending upload; photoDeleted means
  // the user clicked Remove and there's no new file to replace it.
  const existingPhotoUrl =
    existingCourt?.photoUrlCard ||
    existingCourt?.photoUrl ||
    "";
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const [photoDeleted, setPhotoDeleted] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFormValid =
    name.trim().length > 0 && address.trim().length > 0;

  function pickPhoto(file: File | null) {
    if (!file) return;
    setNewPhotoFile(file);
    setNewPhotoPreview(URL.createObjectURL(file));
    setPhotoDeleted(false);
  }

  function removePhoto() {
    setNewPhotoFile(null);
    if (newPhotoPreview) {
      URL.revokeObjectURL(newPhotoPreview);
      setNewPhotoPreview(null);
    }
    setPhotoDeleted(true);
  }

  async function handleSave() {
    if (!isFormValid) return;
    setSaving(true);
    setError(null);

    try {
      // Resolve final photo URLs. Three cases:
      //   1. user picked a new file  → delete old (if edit), upload new
      //   2. user removed the photo  → delete old, blank URLs
      //   3. unchanged               → keep existing URLs (edit) / blank (new)
      let photoUrlCard = existingCourt?.photoUrlCard ?? "";
      let photoUrlFull = existingCourt?.photoUrlFull ?? "";

      if (newPhotoFile) {
        if (mode === "edit") {
          await deleteCourtMainPhoto(courtId);
        }
        const urls = await uploadCourtMainPhoto(courtId, newPhotoFile);
        photoUrlCard = urls.cardUrl;
        photoUrlFull = urls.fullUrl;
      } else if (photoDeleted) {
        if (mode === "edit") {
          await deleteCourtMainPhoto(courtId);
        }
        photoUrlCard = "";
        photoUrlFull = "";
      }

      // photoUrl is the legacy backward-compat field — mobile sets it equal
      // to photoUrlCard so old clients reading photoUrl get the card variant.
      const photoUrl = photoUrlCard;

      const formFields = {
        name: name.trim(),
        address: address.trim(),
        latitude: parseFloat(latitude) || 0,
        longitude: parseFloat(longitude) || 0,
        baskets: parseInt(baskets, 10) || 0,
        setting,
        accessType,
        hasLights,
        hoursOfOperation,
        phoneNumber,
        courtCondition,
        threePointLine,
        goatsTake,
        photoUrl,
        photoUrlCard,
        photoUrlFull,
      };

      if (mode === "new") {
        // Hardcoded derived fields match the mobile apps' create path.
        // timeZone is intentionally omitted — syncCourtTimeZone fills it.
        await setDoc(doc(db, "courts", courtId), {
          ...formFields,
          activeUserIds: [],
          geofenceRadiusMeters: 100,
        });
      } else {
        // Scoped update: never touch activeUserIds, operatorIds, verified,
        // schedule, promo, billing, etc. — those have other writers.
        await updateDoc(doc(db, "courts", courtId), formFields);
      }

      router.push("/admin?tab=liveCourts");
    } catch (err) {
      console.error("Save failed:", err);
      setError(
        err instanceof Error ? err.message : "Save failed — check console."
      );
      setSaving(false);
    }
  }

  const photoPreviewUrl = photoDeleted
    ? null
    : newPhotoPreview || existingPhotoUrl || null;

  return (
    <main className="min-h-screen bg-dash-bg">
      <nav className="flex items-center justify-between border-b border-dash-border px-6 py-4 sm:px-12">
        <div className="flex items-center gap-3">
          <Link href="/admin?tab=liveCourts" className="flex items-center gap-3">
            <img
              src="/app-icon.png"
              alt="G.O.A.T.S"
              className="h-8 w-8 rounded-lg"
            />
            <span className="font-display text-sm font-bold text-white">
              G.O.A.T.S
            </span>
          </Link>
          <span className="rounded bg-coral/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-coral">
            Admin
          </span>
        </div>
        <Link
          href="/admin?tab=liveCourts"
          className="text-sm text-white/40 transition-colors hover:text-white/60"
        >
          ← Back to Courts
        </Link>
      </nav>

      <div className="mx-auto max-w-2xl px-6 py-8 sm:px-12">
        <h1 className="font-display mb-8 text-2xl font-bold text-white">
          {mode === "edit" ? "Edit Court" : "Add Court"}
        </h1>

        <div className="space-y-5">
          <TextField
            label="Court Name"
            required
            value={name}
            onChange={setName}
            placeholder="West 4th Street Courts"
          />
          <TextField
            label="Address"
            required
            value={address}
            onChange={setAddress}
            placeholder="6th Ave & W 4th St, New York, NY"
          />

          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Latitude"
              value={latitude}
              onChange={setLatitude}
              placeholder="40.7308"
              inputMode="decimal"
            />
            <TextField
              label="Longitude"
              value={longitude}
              onChange={setLongitude}
              placeholder="-74.0008"
              inputMode="decimal"
            />
          </div>

          <TextField
            label="Number of Baskets"
            value={baskets}
            onChange={setBaskets}
            placeholder="2"
            inputMode="numeric"
          />

          <div className="grid grid-cols-2 gap-4">
            <Dropdown
              label="Setting"
              value={setting}
              options={SETTING_OPTIONS}
              onChange={setSetting}
            />
            <Dropdown
              label="Access Type"
              value={accessType}
              options={ACCESS_OPTIONS}
              onChange={setAccessType}
            />
          </div>

          <Toggle
            label="Has Lights"
            value={hasLights}
            onChange={setHasLights}
          />

          <TextField
            label="Hours of Operation"
            value={hoursOfOperation}
            onChange={setHoursOfOperation}
            placeholder="6 AM – 11 PM daily"
          />

          <TextField
            label="Phone Number"
            value={phoneNumber}
            onChange={setPhoneNumber}
            placeholder="(212) 555-0100"
            inputMode="tel"
          />

          <Dropdown
            label="Court Condition"
            value={courtCondition}
            options={CONDITION_OPTIONS}
            onChange={setCourtCondition}
          />

          <Dropdown
            label="Three-Point Line"
            value={threePointLine}
            options={THREE_POINT_OPTIONS}
            onChange={setThreePointLine}
          />

          <div>
            <FieldLabel>G.O.A.T.S Take</FieldLabel>
            <textarea
              value={goatsTake}
              onChange={(e) => setGoatsTake(e.target.value)}
              rows={5}
              placeholder="Casual description of the court — condition, scene, best times to play…"
              className="w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal/60 focus:outline-none"
            />
          </div>

          <div>
            <FieldLabel>Court Photo</FieldLabel>
            {photoPreviewUrl ? (
              <div className="flex items-start gap-4">
                <img
                  src={photoPreviewUrl}
                  alt=""
                  className="h-32 w-48 rounded-xl border border-dash-border object-cover"
                />
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer rounded-lg border border-dash-border bg-dash-surface px-3 py-1.5 text-center text-xs text-white/70 transition-colors hover:border-teal/40 hover:text-white">
                    Replace
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        pickPhoto(e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="rounded-lg border border-status-rejected/30 px-3 py-1.5 text-xs text-status-rejected transition-colors hover:bg-status-rejected/10"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex h-32 w-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-bg text-xs text-white/40 transition-colors hover:border-teal/40 hover:text-white/70">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mb-1"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Choose photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    pickPhoto(e.target.files?.[0] ?? null)
                  }
                />
              </label>
            )}
            <p className="mt-2 text-xs text-white/30">
              Processed in-browser to WebP — card (600×400) and full (600w).
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-status-rejected/30 bg-status-rejected/10 px-4 py-3 text-sm text-status-rejected">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/admin?tab=liveCourts"
              className="rounded-xl border border-dash-border px-5 py-2.5 text-sm text-white/60 transition-colors hover:text-white"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isFormValid || saving}
              className="rounded-xl bg-teal px-6 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : mode === "edit"
                ? "Save Changes"
                : "Create Court"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Form primitives ──────────────────────────────────────────────────────────

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">
      {children}
      {required && <span className="ml-1 text-coral">*</span>}
    </label>
  );
}

function TextField({
  label,
  required,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "numeric" | "tel" | "text";
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-teal/60 focus:outline-none"
      />
    </div>
  );
}

function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-2.5 text-sm text-white focus:border-teal/60 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-left transition-colors hover:border-white/20"
    >
      <span className="text-sm text-white">{label}</span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? "bg-teal" : "bg-white/10"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}
