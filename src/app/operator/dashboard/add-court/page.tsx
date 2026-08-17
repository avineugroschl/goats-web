"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Court } from "@/lib/types";
import { uploadCourtMainPhoto } from "@/lib/processImage";

type CourtType = "new_court" | "claim_existing";

interface NewCourtFormData {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  setting: string;
  accessType: string;
  baskets: string;
  hasLights: boolean;
  hoursOfOperation: string;
  courtCondition: string;
  threePointLine: string;
  phoneNumber: string;
  bookingEnabled: boolean;
  bookingUrl: string;
  description: string;
}

export default function AddCourtPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  // Redirect non-operators away.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/operator");
      return;
    }
    if (!profile?.isOperator) {
      router.push(profile?.isAdmin ? "/admin" : "/operator");
    }
  }, [loading, user, profile, router]);

  const [courtType, setCourtType] = useState<CourtType>("new_court");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pre-generated UUID, used as the storage key for photo uploads so URLs
  // are final from the moment they upload. Admin approval will create the
  // court doc with this exact ID.
  const [pendingCourtId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `pending_${Date.now()}`
  );

  const [courtData, setCourtData] = useState<NewCourtFormData>({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    setting: "Outdoor",
    accessType: "Public",
    baskets: "2",
    hasLights: false,
    hoursOfOperation: "",
    courtCondition: "Okay",
    threePointLine: "None",
    phoneNumber: "",
    bookingEnabled: false,
    bookingUrl: "",
    description: "",
  });

  // Photo upload
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<{ cardUrl: string; fullUrl: string } | null>(null);

  // Claim flow
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState("");
  const [courtSearch, setCourtSearch] = useState("");
  const [verificationInfo, setVerificationInfo] = useState("");
  const [loadingCourts, setLoadingCourts] = useState(false);

  useEffect(() => {
    if (courtType === "claim_existing" && courts.length === 0 && !loadingCourts) {
      loadCourts();
    }
  }, [courtType]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCourts() {
    setLoadingCourts(true);
    try {
      const snap = await getDocs(collection(db, "courts"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Court));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCourts(list);
    } finally {
      setLoadingCourts(false);
    }
  }

  const filteredCourts = courts.filter(
    (c) =>
      c.name.toLowerCase().includes(courtSearch.toLowerCase()) ||
      c.address.toLowerCase().includes(courtSearch.toLowerCase())
  );

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setUploadedPhotoUrls(null);
  }

  function validate(): boolean {
    if (courtType === "new_court") {
      if (!courtData.name.trim()) { setError("Court name is required."); return false; }
      if (!courtData.address.trim()) { setError("Address is required."); return false; }
      if (!courtData.description.trim()) { setError("Description is required."); return false; }
    } else {
      if (!selectedCourtId) { setError("Select a court to claim."); return false; }
      if (!verificationInfo.trim()) { setError("Please explain how you're connected to this court."); return false; }
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    if (!user) return;

    setSubmitting(true);
    try {
      let photoUrlCard: string | undefined;
      let photoUrlFull: string | undefined;
      if (courtType === "new_court" && photoFile) {
        setUploadingPhoto(true);
        try {
          if (uploadedPhotoUrls) {
            photoUrlCard = uploadedPhotoUrls.cardUrl;
            photoUrlFull = uploadedPhotoUrls.fullUrl;
          } else {
            const urls = await uploadCourtMainPhoto(pendingCourtId, photoFile);
            photoUrlCard = urls.cardUrl;
            photoUrlFull = urls.fullUrl;
            setUploadedPhotoUrls(urls);
          }
        } finally {
          setUploadingPhoto(false);
        }
      }

      const applicationData: Record<string, unknown> = {
        applicantId: user.uid,
        applicantName: profile?.username ?? "",
        applicantEmail: profile?.email ?? user.email ?? "",
        type: courtType,
        status: "pending",
        submittedAt: serverTimestamp(),
      };

      if (courtType === "new_court") {
        applicationData.courtData = {
          pendingCourtId,
          name: courtData.name.trim(),
          address: courtData.address.trim(),
          latitude: parseFloat(courtData.latitude) || 0,
          longitude: parseFloat(courtData.longitude) || 0,
          setting: courtData.setting,
          accessType: courtData.accessType.trim() || "Public",
          baskets: parseInt(courtData.baskets) || 0,
          hasLights: courtData.hasLights,
          hoursOfOperation: courtData.hoursOfOperation.trim(),
          courtCondition: courtData.courtCondition,
          threePointLine: courtData.threePointLine,
          phoneNumber: courtData.phoneNumber.trim(),
          bookingUrl: courtData.bookingEnabled ? courtData.bookingUrl.trim() : "",
          description: courtData.description.trim(),
          photoUrlCard: photoUrlCard ?? "",
          photoUrlFull: photoUrlFull ?? "",
        };
      } else {
        applicationData.courtId = selectedCourtId;
        applicationData.verificationInfo = verificationInfo;
      }

      await addDoc(collection(db, "operator_applications"), applicationData);
      router.push("/operator/dashboard/settings?addCourt=success");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !profile?.isOperator) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      </div>
    );
  }

  const selectedClaim = courts.find((c) => c.id === selectedCourtId);

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Add a Court</h1>
          <p className="text-sm text-dash-text-muted">
            Submit a new court or claim an existing one. Admin will review your application.
          </p>
        </div>
        <Link
          href="/operator/dashboard/settings"
          className="text-sm text-white/40 transition-colors hover:text-white/60"
        >
          Cancel
        </Link>
      </div>

      {/* Court type toggle */}
      <div className="flex gap-2 rounded-xl bg-dash-surface p-1">
        <button
          type="button"
          onClick={() => setCourtType("new_court")}
          className={`flex-1 rounded-lg py-2.5 font-display text-xs font-bold uppercase tracking-wider transition-all ${
            courtType === "new_court"
              ? "bg-teal text-surface-dark"
              : "text-dash-text-muted hover:text-dash-text"
          }`}
        >
          New Court
        </button>
        <button
          type="button"
          onClick={() => setCourtType("claim_existing")}
          className={`flex-1 rounded-lg py-2.5 font-display text-xs font-bold uppercase tracking-wider transition-all ${
            courtType === "claim_existing"
              ? "bg-teal text-surface-dark"
              : "text-dash-text-muted hover:text-dash-text"
          }`}
        >
          Claim Existing
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-status-rejected/30 bg-status-rejected/5 px-4 py-3 text-sm text-status-rejected">
          {error}
        </div>
      )}

      {courtType === "new_court" ? (
        <div className="space-y-4 rounded-2xl border border-dash-border bg-dash-surface p-6">
          <Field label="Court Name *">
            <input
              value={courtData.name}
              onChange={(e) => setCourtData({ ...courtData, name: e.target.value })}
              className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
            />
          </Field>
          <Field label="Address *">
            <input
              value={courtData.address}
              onChange={(e) => setCourtData({ ...courtData, address: e.target.value })}
              className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Latitude">
              <input
                value={courtData.latitude}
                onChange={(e) => setCourtData({ ...courtData, latitude: e.target.value })}
                className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
                placeholder="40.7128"
              />
            </Field>
            <Field label="Longitude">
              <input
                value={courtData.longitude}
                onChange={(e) => setCourtData({ ...courtData, longitude: e.target.value })}
                className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
                placeholder="-74.0060"
              />
            </Field>
          </div>
          <Field label="Description *">
            <textarea
              value={courtData.description}
              onChange={(e) => setCourtData({ ...courtData, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
              placeholder="Tell us about your court..."
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Setting">
              <select
                value={courtData.setting}
                onChange={(e) => setCourtData({ ...courtData, setting: e.target.value })}
                className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
              >
                <option>Outdoor</option>
                <option>Indoor</option>
              </select>
            </Field>
            <Field label="Access">
              <select
                value={courtData.accessType}
                onChange={(e) => setCourtData({ ...courtData, accessType: e.target.value })}
                className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
              >
                <option>Public</option>
                <option>Private</option>
                <option>Membership</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Baskets">
              <input
                type="number"
                value={courtData.baskets}
                onChange={(e) => setCourtData({ ...courtData, baskets: e.target.value })}
                className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
              />
            </Field>
            <Field label="Condition">
              <select
                value={courtData.courtCondition}
                onChange={(e) => setCourtData({ ...courtData, courtCondition: e.target.value })}
                className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
              >
                <option>Excellent</option>
                <option>Good</option>
                <option>Okay</option>
                <option>Needs Work</option>
              </select>
            </Field>
            <Field label="3PT Line">
              <select
                value={courtData.threePointLine}
                onChange={(e) => setCourtData({ ...courtData, threePointLine: e.target.value })}
                className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
              >
                <option>None</option>
                <option>HS</option>
                <option>NCAA</option>
                <option>NBA</option>
                <option>FIBA</option>
              </select>
            </Field>
          </div>
          <Field label="Hours of Operation">
            <input
              value={courtData.hoursOfOperation}
              onChange={(e) => setCourtData({ ...courtData, hoursOfOperation: e.target.value })}
              className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
              placeholder="e.g. Daily 6am–10pm"
            />
          </Field>
          <Field label="Phone Number">
            <input
              value={courtData.phoneNumber}
              onChange={(e) => setCourtData({ ...courtData, phoneNumber: e.target.value })}
              className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
            />
          </Field>
          <label className="flex items-center gap-3 text-sm text-white/70">
            <input
              type="checkbox"
              checked={courtData.hasLights}
              onChange={(e) => setCourtData({ ...courtData, hasLights: e.target.checked })}
              className="h-4 w-4 rounded border-dash-border bg-dash-bg accent-teal"
            />
            Has lights
          </label>

          <label className="flex items-center gap-3 text-sm text-white/70">
            <input
              type="checkbox"
              checked={courtData.bookingEnabled}
              onChange={(e) => setCourtData({ ...courtData, bookingEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-dash-border bg-dash-bg accent-teal"
            />
            Add a &quot;Book court&quot; button (links to your booking page)
          </label>

          {courtData.bookingEnabled && (
            <Field label="Booking Link URL">
              <input
                value={courtData.bookingUrl}
                onChange={(e) => setCourtData({ ...courtData, bookingUrl: e.target.value })}
                className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
                placeholder="https://…"
              />
            </Field>
          )}

          {/* Photo */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Court Photo (optional)
            </p>
            <div className="flex items-center gap-4">
              {photoPreviewUrl && (
                <img src={photoPreviewUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
              )}
              <label className="cursor-pointer rounded-xl border border-dash-border bg-dash-bg px-4 py-2 text-xs font-medium text-white/70 hover:border-teal/40 hover:text-white">
                {photoFile ? "Change photo" : "Upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-dash-border bg-dash-surface p-6">
          <Field label="Search courts">
            <input
              value={courtSearch}
              onChange={(e) => setCourtSearch(e.target.value)}
              className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
              placeholder="Search by name or address"
            />
          </Field>

          {loadingCourts ? (
            <p className="text-sm text-white/40">Loading courts...</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-dash-border bg-dash-bg">
              {filteredCourts.length === 0 ? (
                <p className="px-4 py-6 text-sm text-white/30">No matching courts.</p>
              ) : (
                filteredCourts.map((c) => {
                  const hasClaimed = (c.operatorIds?.length ?? 0) > 0;
                  const isSelected = c.id === selectedCourtId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => !hasClaimed && setSelectedCourtId(c.id)}
                      disabled={hasClaimed}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                        hasClaimed
                          ? "cursor-not-allowed opacity-40"
                          : isSelected
                            ? "bg-teal/10"
                            : "hover:bg-dash-surface-hover"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{c.name}</p>
                        <p className="truncate text-xs text-white/40">{c.address}</p>
                      </div>
                      {hasClaimed && (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/30">
                          Claimed
                        </span>
                      )}
                      {!hasClaimed && isSelected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3ECFB2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {selectedClaim && (
            <Field label="How are you connected to this court? *">
              <textarea
                value={verificationInfo}
                onChange={(e) => setVerificationInfo(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-white outline-none focus:border-teal/60"
                placeholder="Tell us how you're affiliated with this court (e.g. owner, manager, parks dept contact)..."
              />
            </Field>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Link
          href="/operator/dashboard/settings"
          className="rounded-xl border border-dash-border px-5 py-3 text-sm text-white/60 hover:text-white/80"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || uploadingPhoto}
          className="rounded-xl bg-teal px-6 py-3 font-display text-xs font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal-dark disabled:opacity-50"
        >
          {submitting ? "Submitting..." : uploadingPhoto ? "Uploading photo..." : "Submit Application"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/40">
        {label}
      </span>
      {children}
    </label>
  );
}
