"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Court, DaySchedule, CourtPromo, CourtBanner, ScheduleOverride } from "@/lib/types";
import { uploadCourtMainPhoto, uploadCourtGalleryPhoto } from "@/lib/processImage";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Tab = "info" | "photos" | "schedule" | "announcements" | "promo";

interface GalleryPhoto {
  id: string;
  url: string;
  storagePath?: string;
  uploadedBy?: string;
  uploadedAt?: unknown;
}

export default function CourtManagement() {
  const { profile } = useAuth();
  const courtId = profile?.operatorCourtIds?.[0];

  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [error, setError] = useState("");

  // Editable fields — pre-filled from the court doc
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [description, setDescription] = useState("");
  const [baskets, setBaskets] = useState("");
  const [setting, setSetting] = useState("Outdoor");
  const [accessType, setAccessType] = useState("Public");
  const [hasLights, setHasLights] = useState(false);
  const [hoursOfOperation, setHoursOfOperation] = useState("");
  const [courtCondition, setCourtCondition] = useState("Okay");
  const [threePointLine, setThreePointLine] = useState("None");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Schedule
  const [schedule, setSchedule] = useState<Record<string, DaySchedule | null>>({});
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleOverrides, setScheduleOverrides] = useState<Record<string, ScheduleOverride>>({});
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [editingOverrideDate, setEditingOverrideDate] = useState<string | null>(null);

  // Banner / Promo
  const [bannerText, setBannerText] = useState("");
  const [bannerExpiry, setBannerExpiry] = useState<string>("never"); // "never", "1h", "6h", "endOfDay", "24h", "custom"
  const [bannerCustomExpiry, setBannerCustomExpiry] = useState("");
  const [promoText, setPromoText] = useState("");
  const [promoActive, setPromoActive] = useState(false);

  // Photos
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  // Snapshot of saved state — used to detect unsaved changes
  const savedSnapshot = useRef("");
  const snap = JSON.stringify({
    name, address, latitude, longitude, description, baskets, setting,
    accessType, hasLights, hoursOfOperation, courtCondition, threePointLine,
    phoneNumber, schedule, scheduleEnabled, scheduleOverrides, bannerText,
    promoText, promoActive,
  });
  const hasChanges = savedSnapshot.current !== "" && snap !== savedSnapshot.current;

  // Capture snapshot after load completes
  useEffect(() => {
    if (!loading && court) {
      savedSnapshot.current = snap;
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!courtId) { setLoading(false); return; }
    loadCourt(courtId);
  }, [courtId]);

  // Subscribe to gallery subcollection
  useEffect(() => {
    if (!courtId) return;
    const q = query(
      collection(db, "courts", courtId, "photos"),
      orderBy("uploadedAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setGalleryPhotos(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryPhoto))
      );
    });
    return unsub;
  }, [courtId]);

  async function loadCourt(cId: string) {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "courts", cId));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Court;
        setCourt(data);
        setName(data.name ?? "");
        setAddress(data.address ?? "");
        setLatitude(data.latitude ? String(data.latitude) : "");
        setLongitude(data.longitude ? String(data.longitude) : "");
        setDescription(data.goatsTake ?? "");
        setBaskets(data.baskets ? String(data.baskets) : "");
        setSetting(data.setting || "Outdoor");
        setAccessType(data.accessType || "Public");
        setHasLights(data.hasLights ?? false);
        setHoursOfOperation(data.hoursOfOperation ?? "");
        setCourtCondition(data.courtCondition || "Okay");
        setThreePointLine(data.threePointLine || "None");
        setPhoneNumber(data.phoneNumber ?? "");
        setSchedule(data.schedule ?? {});
        setScheduleEnabled(data.scheduleEnabled ?? false);

        // Load overrides, auto-cleaning stale ones (older than 7 days)
        const raw = (data.scheduleOverrides ?? {}) as Record<string, ScheduleOverride>;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const cutoffKey = cutoff.toISOString().slice(0, 10);
        const cleaned: Record<string, ScheduleOverride> = {};
        let hadStale = false;
        for (const [key, val] of Object.entries(raw)) {
          if (key >= cutoffKey) {
            cleaned[key] = val;
          } else {
            hadStale = true;
          }
        }
        setScheduleOverrides(cleaned);
        // Silently persist the cleanup
        if (hadStale && cId) {
          updateDoc(doc(db, "courts", cId), { scheduleOverrides: cleaned }).catch(() => {});
        }

        const banner = data.operatorBanner as CourtBanner & { expiresAt?: { toDate?: () => Date } } | undefined;
        setBannerText(banner?.text ?? "");
        if (banner?.expiresAt?.toDate) {
          setBannerExpiry("custom");
          setBannerCustomExpiry(banner.expiresAt.toDate().toISOString().slice(0, 16));
        } else {
          setBannerExpiry("never");
          setBannerCustomExpiry("");
        }
        setPromoText((data.promo as CourtPromo)?.text ?? "");
        setPromoActive((data.promo as CourtPromo)?.active ?? false);
      }
    } finally {
      setLoading(false);
    }
  }

  // Build the update payload from current form state
  function buildCourtUpdates(): Record<string, unknown> {
    return {
      name: name.trim(),
      address: address.trim(),
      latitude: parseFloat(latitude) || 0,
      longitude: parseFloat(longitude) || 0,
      goatsTake: description.trim(),
      baskets: parseInt(baskets) || 0,
      setting,
      accessType: accessType.trim() || "Public",
      hasLights,
      hoursOfOperation: hoursOfOperation.trim(),
      courtCondition,
      threePointLine,
      phoneNumber: phoneNumber.trim(),
    };
  }

  // Required-fields check for publish
  function requiredFieldsMissing(): string[] {
    const missing: string[] = [];
    if (!name.trim()) missing.push("Name");
    if (!address.trim()) missing.push("Address");
    if (!latitude.trim() || !parseFloat(latitude)) missing.push("Latitude");
    if (!longitude.trim() || !parseFloat(longitude)) missing.push("Longitude");
    if (!description.trim()) missing.push("Description");
    if (!baskets.trim() || !parseInt(baskets)) missing.push("Baskets");
    if (!setting.trim()) missing.push("Setting");
    if (!accessType.trim()) missing.push("Access Type");
    if (!hoursOfOperation.trim()) missing.push("Hours of Operation");
    if (!courtCondition.trim()) missing.push("Court Condition");
    if (!threePointLine.trim()) missing.push("3PT Line");
    if (!phoneNumber.trim()) missing.push("Phone Number");
    if (!court?.photoUrlCard) missing.push("Main Photo");
    return missing;
  }

  async function handleSave() {
    if (!courtId) return;
    setSaving(true);
    setError("");
    try {
      const updates: Record<string, unknown> = {};

      if (activeTab === "info") {
        Object.assign(updates, buildCourtUpdates());
      } else if (activeTab === "schedule") {
        updates.schedule = schedule;
        updates.scheduleEnabled = scheduleEnabled;
        updates.scheduleOverrides = scheduleOverrides;
      } else if (activeTab === "announcements") {
        if (bannerText.trim()) {
          const bannerData: Record<string, unknown> = {
            text: bannerText.trim(),
            updatedAt: serverTimestamp(),
          };
          // Calculate expiry timestamp
          if (bannerExpiry !== "never") {
            let expiresAt: Date;
            const now = new Date();
            switch (bannerExpiry) {
              case "1h": expiresAt = new Date(now.getTime() + 60 * 60 * 1000); break;
              case "6h": expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000); break;
              case "endOfDay":
                expiresAt = new Date(now);
                expiresAt.setHours(23, 59, 59, 999);
                break;
              case "24h": expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); break;
              case "custom":
                expiresAt = bannerCustomExpiry ? new Date(bannerCustomExpiry) : new Date(now.getTime() + 24 * 60 * 60 * 1000);
                break;
              default: expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            }
            bannerData.expiresAt = expiresAt;
          }
          updates.operatorBanner = bannerData;
        } else {
          updates.operatorBanner = null;
        }
      } else if (activeTab === "promo") {
        updates.promo = {
          active: promoActive,
          text: promoText.trim(),
        };
      }

      await updateDoc(doc(db, "courts", courtId), updates);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      console.error(err);
      setError("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!courtId) return;
    const missing = requiredFieldsMissing();
    if (missing.length > 0) {
      setError(`Missing required fields: ${missing.join(", ")}`);
      return;
    }
    setPublishing(true);
    setError("");
    try {
      // Save current form values + flip published to true in one call
      await updateDoc(doc(db, "courts", courtId), {
        ...buildCourtUpdates(),
        published: true,
      });
      await loadCourt(courtId);
      savedSnapshot.current = snap;
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      console.error(err);
      setError("Publish failed. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleMainPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !courtId) return;
    setUploadingMain(true);
    setError("");
    try {
      const { cardUrl, fullUrl } = await uploadCourtMainPhoto(courtId, file);
      await updateDoc(doc(db, "courts", courtId), {
        photoUrl: cardUrl,
        photoUrlCard: cardUrl,
        photoUrlFull: fullUrl,
      });
      await loadCourt(courtId);
    } catch (err) {
      console.error(err);
      setError("Photo upload failed. Try again.");
    } finally {
      setUploadingMain(false);
      e.target.value = "";
    }
  }

  async function handleGalleryPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0 || !courtId) return;
    setUploadingGallery(true);
    setError("");
    try {
      for (const file of files) {
        const { url, storagePath } = await uploadCourtGalleryPhoto(courtId, file);
        await addDoc(collection(db, "courts", courtId, "photos"), {
          url,
          storagePath,
          uploadedBy: profile?.id ?? "",
          uploadedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error(err);
      setError("Gallery upload failed. Try again.");
    } finally {
      setUploadingGallery(false);
      e.target.value = "";
    }
  }

  async function handleDeleteGalleryPhoto(photo: GalleryPhoto) {
    if (!courtId) return;
    if (!confirm("Delete this photo?")) return;
    try {
      if (photo.storagePath) {
        try {
          await deleteObject(ref(storage, photo.storagePath));
        } catch {
          // best-effort — file may already be gone
        }
      }
      await deleteDoc(doc(db, "courts", courtId, "photos", photo.id));
    } catch (err) {
      console.error(err);
      setError("Delete failed.");
    }
  }

  function updateScheduleDay(day: string, field: "open" | "close", value: string) {
    setSchedule((prev) => ({
      ...prev,
      [day]: { open: prev[day]?.open ?? "06:00", close: prev[day]?.close ?? "22:00", [field]: value },
    }));
  }

  function toggleScheduleDay(day: string) {
    setSchedule((prev) => ({
      ...prev,
      [day]: prev[day] ? null : { open: "06:00", close: "22:00" },
    }));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-dash-surface" />
        <div className="h-96 animate-pulse rounded-2xl bg-dash-surface" />
      </div>
    );
  }

  if (!court) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-white/40">No court found.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "info", label: "Court Info" },
    { id: "photos", label: "Photos" },
    { id: "schedule", label: "Schedule" },
    { id: "announcements", label: "Announcements" },
    { id: "promo", label: "Promo" },
  ];

  const isPublished = court.published !== false;
  const missingForPublish = requiredFieldsMissing();
  const canPublish = missingForPublish.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">My Court</h1>
          <p className="text-sm text-dash-text-muted">{court.name} — {court.address}</p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-xs text-status-confirmed">Saved</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || publishing}
            className="rounded-xl border border-dash-border px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white/70 transition-all hover:border-teal/40 hover:text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || saving || !canPublish || (isPublished && !hasChanges)}
            title={canPublish ? "" : `Missing: ${missingForPublish.join(", ")}`}
            className="rounded-xl bg-teal px-6 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal-dark disabled:opacity-50"
          >
            {publishing ? "Publishing..." : isPublished ? "Update Court" : "Publish Court"}
          </button>
        </div>
      </div>

      {/* Publish-state banner */}
      {!isPublished && (
        <div className="rounded-2xl border border-status-pending/30 bg-status-pending/5 px-5 py-4">
          <p className="font-display mb-2 text-xs font-bold uppercase tracking-widest text-status-pending">
            Court Not Yet Published
          </p>
          <p className="mb-2 text-sm text-white/60">
            Complete the required fields below and click <span className="font-semibold text-white">Publish Court</span> to make it visible in the GOATS app.
          </p>
          {missingForPublish.length > 0 && (
            <p className="text-xs text-status-pending/80">
              Missing: {missingForPublish.join(" · ")}
            </p>
          )}
        </div>
      )}

      {isPublished && (
        <div className="inline-flex items-center gap-2 rounded-full border border-status-confirmed/30 bg-status-confirmed/5 px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-status-confirmed animate-pulse" />
          <span className="text-sm text-status-confirmed font-medium">Court is live</span>
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-dash-surface p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-lg px-4 py-2.5 font-display text-sm font-bold transition-all ${
              activeTab === tab.id
                ? "bg-teal text-surface-dark"
                : "text-dash-text-muted hover:text-dash-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      {/* Tab content */}
      <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
        {/* COURT INFO */}
        {activeTab === "info" && (
          <div className="space-y-5">
            <p className="text-xs text-dash-text-muted">
              All fields below are required to publish.
            </p>

            <Field label="Court Name *">
              <Input value={name} onChange={setName} placeholder="e.g. Main Court" />
            </Field>

            <Field label="Address *">
              <Input value={address} onChange={setAddress} placeholder="123 Main St, City, State" />
            </Field>

            <Field label="Tell us about your court *">
              <TextArea
                value={description}
                onChange={setDescription}
                placeholder="What makes your court special — amenities, parking, vibe, anything players should know..."
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Latitude *">
                <Input value={latitude} onChange={setLatitude} placeholder="40.7128" />
              </Field>
              <Field label="Longitude *">
                <Input value={longitude} onChange={setLongitude} placeholder="-74.0060" />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Setting *">
                <Select value={setting} onChange={setSetting} options={["Indoor", "Outdoor"]} />
              </Field>
              <Field label="Access Type *">
                <Input value={accessType} onChange={setAccessType} placeholder="e.g. Public, Private, Members Only" />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Number of Baskets *">
                <Input value={baskets} onChange={setBaskets} placeholder="2" type="number" />
              </Field>
              <Field label="Court Condition *">
                <Select
                  value={courtCondition}
                  onChange={setCourtCondition}
                  options={["Below Average", "Okay", "Solid", "Good", "Very Good"]}
                />
              </Field>
            </div>

            <Field label="Three Point Line *">
              <Select
                value={threePointLine}
                onChange={setThreePointLine}
                options={["None", "High School", "Old NCAA", "FIBA", "NBA"]}
              />
            </Field>

            <button
              onClick={() => setHasLights(!hasLights)}
              className="flex items-center gap-3 rounded-xl border border-dash-border bg-dash-bg px-4 py-3"
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                hasLights ? "border-teal bg-teal" : "border-white/20"
              }`}>
                {hasLights && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-white/60">Has Lights</span>
            </button>

            <Field label="Hours of Operation *">
              <Input
                value={hoursOfOperation}
                onChange={setHoursOfOperation}
                placeholder="e.g. Mon-Fri 6am-10pm, Sat-Sun 8am-8pm"
              />
            </Field>

            <Field label="Phone Number *">
              <Input value={phoneNumber} onChange={setPhoneNumber} placeholder="(555) 123-4567" />
            </Field>
          </div>
        )}

        {/* PHOTOS */}
        {activeTab === "photos" && (
          <div className="space-y-8">
            {/* Main photo */}
            <div>
              <h3 className="font-display mb-1 text-lg font-bold text-white">Main Photo *</h3>
              <p className="mb-4 text-sm text-white/40">
                Shown on your court card in the app. Required to publish.
              </p>
              <div className="flex items-start gap-5">
                {court.photoUrlCard ? (
                  <img
                    src={court.photoUrlCard}
                    alt={court.name}
                    className="h-32 w-48 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-32 w-48 items-center justify-center rounded-xl border border-dashed border-dash-border bg-dash-bg text-xs text-white/30">
                    No photo
                  </div>
                )}
                <label className="cursor-pointer rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white/60 transition-colors hover:border-teal/30 hover:text-white">
                  {uploadingMain ? "Uploading..." : court.photoUrlCard ? "Replace Photo" : "Upload Photo"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleMainPhotoUpload}
                    className="hidden"
                    disabled={uploadingMain}
                  />
                </label>
              </div>
            </div>

            {/* Gallery */}
            <div>
              <h3 className="font-display mb-1 text-lg font-bold text-white">Photo Gallery</h3>
              <p className="mb-4 text-sm text-white/40">
                Optional. Add as many additional photos as you like — they show in the court&apos;s gallery on the app.
              </p>

              <label className="mb-4 inline-block cursor-pointer rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white/60 transition-colors hover:border-teal/30 hover:text-white">
                {uploadingGallery ? "Uploading..." : "Add Photos"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryPhotoUpload}
                  className="hidden"
                  disabled={uploadingGallery}
                />
              </label>

              {galleryPhotos.length === 0 ? (
                <p className="text-sm text-white/30">No gallery photos yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {galleryPhotos.map((photo) => (
                    <div key={photo.id} className="group relative overflow-hidden rounded-xl">
                      <img
                        src={photo.url}
                        alt=""
                        className="h-32 w-full object-cover"
                      />
                      <button
                        onClick={() => handleDeleteGalleryPhoto(photo)}
                        className="absolute right-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCHEDULE */}
        {activeTab === "schedule" && (
          <div className="space-y-8">
            {/* Toggle */}
            <div className="flex items-start gap-4">
              <button
                onClick={() => setScheduleEnabled(!scheduleEnabled)}
                className="mt-0.5"
              >
                <div className={`relative h-7 w-12 rounded-full transition-colors ${
                  scheduleEnabled ? "bg-teal" : "bg-dash-border"
                }`}>
                  <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    scheduleEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </div>
              </button>
              <div>
                <p className="font-display text-sm font-bold text-white">
                  {scheduleEnabled ? "Structured Schedule Active" : "Structured Schedule Off"}
                </p>
                <p className="text-xs text-white/40">
                  {scheduleEnabled
                    ? "Players see today's hours dynamically based on the schedule below. Overrides take priority over the weekly schedule."
                    : "Players see the free-text Hours of Operation field from the Court Info tab."}
                </p>
              </div>
            </div>

            {scheduleEnabled && (
              <>
                {/* Weekly schedule */}
                <div>
                  <h3 className="font-display mb-4 text-sm font-bold uppercase tracking-widest text-white/40">
                    Weekly Schedule
                  </h3>
                  <div className="space-y-3">
                    {DAYS.map((day, i) => {
                      const daySchedule = schedule[day];
                      return (
                        <div key={day} className="flex items-center gap-4 rounded-xl border border-dash-border bg-dash-bg px-4 py-3">
                          <button
                            onClick={() => toggleScheduleDay(day)}
                            className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                              daySchedule ? "border-teal bg-teal" : "border-white/20"
                            }`}
                          >
                            {daySchedule && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            )}
                          </button>
                          <span className="w-10 text-sm font-medium text-white">{DAY_LABELS[i]}</span>
                          {daySchedule ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={daySchedule.open}
                                onChange={(e) => updateScheduleDay(day, "open", e.target.value)}
                                className="rounded-lg border border-dash-border bg-dash-surface px-3 py-1.5 text-sm text-white outline-none focus:border-teal"
                              />
                              <span className="text-xs text-white/30">to</span>
                              <input
                                type="time"
                                value={daySchedule.close}
                                onChange={(e) => updateScheduleDay(day, "close", e.target.value)}
                                className="rounded-lg border border-dash-border bg-dash-surface px-3 py-1.5 text-sm text-white outline-none focus:border-teal"
                              />
                            </div>
                          ) : (
                            <span className="text-sm text-white/20">Closed</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Schedule overrides calendar */}
                <div>
                  <h3 className="font-display mb-2 text-sm font-bold uppercase tracking-widest text-white/40">
                    Date-Specific Overrides
                  </h3>
                  <p className="mb-4 text-xs text-white/40">
                    Click any date to mark it as closed or set custom hours. Overrides take priority over the weekly schedule.
                  </p>

                  {/* Calendar nav */}
                  <div className="mb-4 flex items-center justify-between">
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                      className="rounded-lg border border-dash-border px-3 py-1.5 text-xs text-white/60 hover:text-white"
                    >
                      &larr;
                    </button>
                    <span className="font-display text-sm font-bold text-white">
                      {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </span>
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                      className="rounded-lg border border-dash-border px-3 py-1.5 text-xs text-white/60 hover:text-white"
                    >
                      &rarr;
                    </button>
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                      <div key={i} className="py-1 text-[10px] font-bold uppercase text-white/30">{d}</div>
                    ))}
                    {(() => {
                      const year = calendarMonth.getFullYear();
                      const month = calendarMonth.getMonth();
                      const firstDow = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const todayKey = new Date().toISOString().slice(0, 10);
                      const cells: React.ReactNode[] = [];

                      // Leading blanks
                      for (let i = 0; i < firstDow; i++) {
                        cells.push(<div key={`blank-${i}`} />);
                      }

                      for (let d = 1; d <= daysInMonth; d++) {
                        const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                        const override = scheduleOverrides[dateKey];
                        const isPast = dateKey < todayKey;
                        const isToday = dateKey === todayKey;
                        const isClosed = override?.closed === true;
                        const hasCustom = override && !override.closed && override.open;

                        cells.push(
                          <button
                            key={dateKey}
                            onClick={() => !isPast && setEditingOverrideDate(dateKey)}
                            disabled={isPast}
                            className={`relative rounded-lg py-2 text-sm transition-all ${
                              isPast
                                ? "cursor-default text-white/15"
                                : isToday
                                  ? "border border-teal/50 font-bold text-teal hover:bg-teal/10"
                                  : "text-white/60 hover:bg-dash-surface-hover hover:text-white"
                            }`}
                          >
                            {d}
                            {isClosed && (
                              <span className="absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-status-rejected" />
                            )}
                            {hasCustom && (
                              <span className="absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-teal" />
                            )}
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>

                  {/* Legend */}
                  <div className="mt-3 flex gap-4 text-[10px] text-white/40">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-status-rejected" /> Closed
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-teal" /> Custom hours
                    </span>
                  </div>

                  {/* Active overrides list */}
                  {Object.keys(scheduleOverrides).length > 0 && (
                    <div className="mt-4 space-y-2">
                      {Object.entries(scheduleOverrides)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([dateKey, ov]) => (
                          <div key={dateKey} className="flex items-center justify-between rounded-lg border border-dash-border bg-dash-bg px-4 py-2">
                            <div className="flex items-center gap-3">
                              <span className={`h-2 w-2 rounded-full ${ov.closed ? "bg-status-rejected" : "bg-teal"}`} />
                              <span className="text-sm text-white/80">
                                {new Date(dateKey + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                              </span>
                              <span className="text-xs text-white/40">
                                {ov.closed ? "Closed" : `${ov.open} – ${ov.close}`}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                const next = { ...scheduleOverrides };
                                delete next[dateKey];
                                setScheduleOverrides(next);
                              }}
                              className="text-xs text-white/30 hover:text-status-rejected"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Override editor modal */}
            {editingOverrideDate && (
              <OverrideEditor
                dateKey={editingOverrideDate}
                existing={scheduleOverrides[editingOverrideDate]}
                onSave={(ov) => {
                  setScheduleOverrides((prev) => ({ ...prev, [editingOverrideDate]: ov }));
                  setEditingOverrideDate(null);
                }}
                onRemove={() => {
                  setScheduleOverrides((prev) => {
                    const next = { ...prev };
                    delete next[editingOverrideDate];
                    return next;
                  });
                  setEditingOverrideDate(null);
                }}
                onClose={() => setEditingOverrideDate(null)}
              />
            )}
          </div>
        )}

        {/* ANNOUNCEMENTS */}
        {activeTab === "announcements" && (
          <div className="space-y-5">
            <div>
              <h3 className="font-display mb-1 text-lg font-bold text-white">Court Banner</h3>
              <p className="text-sm text-white/40">
                Optional. This message shows at the top of your court&apos;s page in the app.
                Use it for status updates, temporary notices, or daily messages.
              </p>
            </div>

            <textarea
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value)}
              rows={3}
              placeholder='e.g. "Courts are wet today — indoor only" or "New nets installed!"'
              className="w-full resize-none rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-teal"
            />

            {bannerText.trim() && (
              <>
                {/* Expiry picker */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
                    Auto-expire
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "never", label: "Never" },
                      { id: "1h", label: "1 hour" },
                      { id: "6h", label: "6 hours" },
                      { id: "endOfDay", label: "End of day" },
                      { id: "24h", label: "24 hours" },
                      { id: "custom", label: "Custom" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setBannerExpiry(opt.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                          bannerExpiry === opt.id
                            ? "bg-teal text-surface-dark"
                            : "border border-dash-border text-white/50 hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {bannerExpiry === "custom" && (
                    <input
                      type="datetime-local"
                      value={bannerCustomExpiry}
                      onChange={(e) => setBannerCustomExpiry(e.target.value)}
                      className="mt-2 rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal"
                    />
                  )}
                </div>

                <div className="rounded-xl border border-teal/20 bg-teal/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-teal/60">Preview</p>
                  <p className="mt-2 text-sm text-white">{bannerText}</p>
                </div>
              </>
            )}

            <p className="text-xs text-dash-text-muted">
              Leave blank to remove the banner.
            </p>
          </div>
        )}

        {/* PROMO */}
        {activeTab === "promo" && (
          <div className="space-y-5">
            <div>
              <h3 className="font-display mb-1 text-lg font-bold text-white">Court Promo</h3>
              <p className="text-sm text-white/40">
                Optional. When active, your court card gets a highlighted border in the
                app&apos;s court list and your promo text is shown.
              </p>
            </div>

            <button
              onClick={() => setPromoActive(!promoActive)}
              className="flex items-center gap-4"
            >
              <div className={`relative h-7 w-12 rounded-full transition-colors ${
                promoActive ? "bg-teal" : "bg-dash-border"
              }`}>
                <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  promoActive ? "translate-x-5" : "translate-x-0.5"
                }`} />
              </div>
              <span className={`font-display text-sm font-bold ${promoActive ? "text-teal" : "text-white/40"}`}>
                {promoActive ? "Promo Active" : "Promo Off"}
              </span>
            </button>

            <Field label="Promo Text">
              <Input
                value={promoText}
                onChange={setPromoText}
                placeholder='e.g. "50% off Tuesday evenings"'
              />
            </Field>

            {promoActive && promoText.trim() && (
              <div className="rounded-xl border-2 border-coral bg-coral/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-coral/60">Card Preview</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-dash-surface" />
                  <div>
                    <p className="text-sm font-semibold text-white">{court?.name}</p>
                    <p className="text-xs text-coral">{promoText}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Override editor ---------- */

function OverrideEditor({
  dateKey,
  existing,
  onSave,
  onRemove,
  onClose,
}: {
  dateKey: string;
  existing?: ScheduleOverride;
  onSave: (ov: ScheduleOverride) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"closed" | "custom">(
    existing?.closed ? "closed" : "custom"
  );
  const [open, setOpen] = useState(existing?.open ?? "06:00");
  const [close, setClose] = useState(existing?.close ?? "22:00");

  const dateLabel = new Date(dateKey + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-dash-border bg-dash-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display mb-1 text-lg font-bold text-white">{dateLabel}</h3>
        <p className="mb-5 text-xs text-dash-text-muted">Set an override for this date</p>

        <div className="mb-5 flex gap-2 rounded-xl bg-dash-bg p-1">
          <button
            onClick={() => setMode("closed")}
            className={`flex-1 rounded-lg py-2.5 font-display text-sm font-bold transition-all ${
              mode === "closed" ? "bg-status-rejected text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            Closed
          </button>
          <button
            onClick={() => setMode("custom")}
            className={`flex-1 rounded-lg py-2.5 font-display text-sm font-bold transition-all ${
              mode === "custom" ? "bg-teal text-surface-dark" : "text-white/40 hover:text-white/60"
            }`}
          >
            Custom Hours
          </button>
        </div>

        {mode === "custom" && (
          <div className="mb-5 flex items-center gap-3">
            <input
              type="time"
              value={open}
              onChange={(e) => setOpen(e.target.value)}
              className="flex-1 rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal"
            />
            <span className="text-xs text-white/30">to</span>
            <input
              type="time"
              value={close}
              onChange={(e) => setClose(e.target.value)}
              className="flex-1 rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => {
              if (mode === "closed") {
                onSave({ closed: true });
              } else {
                onSave({ open, close });
              }
            }}
            className="flex-1 rounded-xl bg-teal py-2.5 font-display text-sm font-bold text-surface-dark"
          >
            Save
          </button>
          {existing && (
            <button
              onClick={onRemove}
              className="rounded-xl border border-status-rejected/30 px-4 py-2.5 text-xs text-status-rejected hover:bg-status-rejected/10"
            >
              Remove
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl border border-dash-border px-4 py-2.5 text-xs text-white/40 hover:text-white/60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Form helpers ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-teal"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full resize-none rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-teal"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white outline-none transition-colors focus:border-teal"
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
