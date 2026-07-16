"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  orderBy,
  where,
  limit,
  serverTimestamp,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { OperatorApplication, NewCourtData } from "@/lib/types";

type AdminTab = "applications" | "courts" | "liveCourts" | "dashboard" | "ambassadors";
type DashTab = "comments" | "users" | "profilePics" | "checkIns" | "ratings" | "deletedOperators";

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ADMIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminReviewPanel() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  // Court editors (canEditCourts but not isAdmin) only see the two courts
  // tabs — default them to "courts" since "applications" is hidden.
  const isAdmin = Boolean(profile?.isAdmin);
  const isCourtsOnly = Boolean(profile?.canEditCourts) && !isAdmin;
  const [activeTab, setActiveTab] = useState<AdminTab>(
    isCourtsOnly ? "courts" : "applications"
  );

  useEffect(() => {
    if (!authLoading && (!user || (!profile?.isAdmin && !profile?.canEditCourts))) {
      router.push("/");
    }
  }, [authLoading, user, profile, router]);

  // Honor ?tab=... on first mount so the form pages can navigate back to a
  // specific tab. Read once from window.location to avoid the Suspense
  // requirement of Next.js 15's useSearchParams hook. Also snaps a courts-only
  // editor to "courts" if the currently-selected tab isn't allowed (happens
  // when the profile loads after first render and the default `applications`
  // is no longer visible to them).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const allowed: AdminTab[] = isCourtsOnly
      ? ["courts", "liveCourts"]
      : ["applications", "courts", "liveCourts", "dashboard", "ambassadors"];
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (allowed.includes(tab as AdminTab)) {
      setActiveTab(tab as AdminTab);
    } else {
      setActiveTab((prev) => (allowed.includes(prev) ? prev : allowed[0]));
    }
  }, [isCourtsOnly]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dash-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-dash-bg">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-dash-border px-6 py-4 sm:px-12">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <img src="/app-icon.png" alt="G.O.A.T.S" className="h-8 w-8 rounded-lg" />
            <span className="font-display text-sm font-bold text-white">G.O.A.T.S</span>
          </Link>
          <span className="rounded bg-coral/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-coral">
            {isCourtsOnly ? "Courts Editor" : "Admin"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {profile?.email && (
            <span className="hidden text-xs text-white/30 lg:inline">{profile.email}</span>
          )}
          <Link
            href="/operator/dashboard"
            className="flex items-center gap-2 rounded-lg border border-teal/30 bg-teal/10 px-3 py-1.5 text-xs font-semibold text-teal transition-colors hover:border-teal/60 hover:bg-teal/15"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Operator Dashboard
          </Link>
          <Link href="/" className="hidden text-sm text-white/40 transition-colors hover:text-white/60 sm:inline">
            Back to Site
          </Link>
          <button
            onClick={async () => {
              await signOut(auth);
              router.push("/operator");
            }}
            className="flex items-center gap-2 rounded-lg border border-dash-border px-3 py-1.5 text-xs text-white/50 transition-colors hover:border-coral/40 hover:text-coral"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </nav>

      {/* Tab bar */}
      <div className="border-b border-dash-border px-6 sm:px-12">
        <div className="mx-auto flex max-w-5xl gap-1 pt-4">
          {([
            { id: "applications" as const, label: "Operator Applications" },
            { id: "courts" as const, label: "Pending Courts" },
            { id: "liveCourts" as const, label: "All Courts" },
            { id: "ambassadors" as const, label: "Ambassadors" },
            { id: "dashboard" as const, label: "Dashboard" },
          ]).filter((tab) => !isCourtsOnly || tab.id === "courts" || tab.id === "liveCourts").map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-t-lg px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? "bg-dash-surface text-teal border-b-2 border-teal"
                  : "text-dash-text-muted hover:text-dash-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 sm:px-12">
        {activeTab === "applications" && !isCourtsOnly && <ApplicationsTab />}
        {activeTab === "courts" && <PendingCourtsTab />}
        {activeTab === "liveCourts" && <LiveCourtsTab />}
        {activeTab === "ambassadors" && !isCourtsOnly && <AmbassadorsTab />}
        {activeTab === "dashboard" && !isCourtsOnly && <DashboardTab />}
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: OPERATOR APPLICATIONS (existing, moved into component)
// ═══════════════════════════════════════════════════════════════════════════

function ApplicationsTab() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<OperatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [freeAccess, setFreeAccess] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  useEffect(() => { loadApplications(); }, []);

  async function loadApplications() {
    setLoading(true);
    try {
      const q = query(collection(db, "operator_applications"), orderBy("submittedAt", "desc"));
      const snap = await getDocs(q);
      setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as OperatorApplication)));
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(app: OperatorApplication) {
    setActionLoading(app.id);
    try {
      let courtId = app.courtId;

      if (app.type === "new_court" && app.courtData) {
        const newCourtId = app.courtData.pendingCourtId || crypto.randomUUID();
        const cardUrl = app.courtData.photoUrlCard || "";
        const fullUrl = app.courtData.photoUrlFull || "";

        await setDoc(doc(db, "courts", newCourtId), {
          name: app.courtData.name,
          address: app.courtData.address,
          latitude: app.courtData.latitude || 0,
          longitude: app.courtData.longitude || 0,
          setting: app.courtData.setting,
          accessType: app.courtData.accessType,
          baskets: app.courtData.baskets,
          hasLights: app.courtData.hasLights,
          courtCondition: app.courtData.courtCondition,
          threePointLine: app.courtData.threePointLine || "None",
          phoneNumber: app.courtData.phoneNumber,
          goatsTake: app.courtData.description,
          photoUrl: cardUrl,
          photoUrlCard: cardUrl,
          photoUrlFull: fullUrl,
          activeUserIds: [],
          geofenceRadiusMeters: 100,
          hoursOfOperation: app.courtData.hoursOfOperation || "",
          operatorIds: [app.applicantId],
          verified: true,
          reservationsEnabled: false,
          reservationSlots: {},
          schedule: {},
          promo: null,
          operatorBanner: null,
          published: false,
          approvedAt: serverTimestamp(),
        });
        courtId = newCourtId;
      } else if (app.type === "claim_existing" && courtId) {
        const courtSnap = await getDoc(doc(db, "courts", courtId));
        if (courtSnap.exists()) {
          const existing = courtSnap.data().operatorIds ?? [];
          if (existing.length > 0) {
            alert("This court already has an operator. Reject this application or remove the existing operator first.");
            setActionLoading(null);
            return;
          }
          await updateDoc(doc(db, "courts", courtId), {
            operatorIds: arrayUnion(app.applicantId),
            verified: true,
            approvedAt: serverTimestamp(),
          });
        }
      }

      await updateDoc(doc(db, "operator_applications", app.id), {
        status: "approved",
        reviewedAt: serverTimestamp(),
        reviewedBy: user?.uid ?? "",
      });

      const operatorUpdate: Record<string, unknown> = {
        applicationStatus: "approved",
      };
      if (courtId) {
        operatorUpdate.operatorCourtIds = arrayUnion(courtId);
      }
      if (freeAccess[app.id]) {
        operatorUpdate.subscriptionStatus = "active";
        operatorUpdate.freeAccess = true;
      }
      await setDoc(doc(db, "operators", app.applicantId), operatorUpdate, { merge: true });

      setApplications((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: "approved" } : a)));
    } catch (err) {
      console.error("Failed to approve:", err);
      alert("Failed to approve application. Check console.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(app: OperatorApplication) {
    const reason = prompt("Reason for rejection (optional):");
    setActionLoading(app.id);
    try {
      await updateDoc(doc(db, "operator_applications", app.id), {
        status: "rejected",
        rejectionReason: reason || "",
        reviewedAt: serverTimestamp(),
        reviewedBy: user?.uid ?? "",
      });
      await setDoc(doc(db, "operators", app.applicantId), { applicationStatus: "rejected" }, { merge: true });
      setApplications((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: "rejected" } : a)));
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <LoadingSpinner />;

  const filtered = filter === "all" ? applications : applications.filter((a) => a.status === filter);
  const pendingCount = applications.filter((a) => a.status === "pending").length;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Operator Applications</h1>
          {pendingCount > 0 && <p className="text-sm text-status-pending">{pendingCount} pending review</p>}
        </div>
      </div>

      <FilterBar filter={filter} onChange={setFilter} counts={{
        pending: applications.filter((a) => a.status === "pending").length,
        approved: applications.filter((a) => a.status === "approved").length,
        rejected: applications.filter((a) => a.status === "rejected").length,
        all: applications.length,
      }} />

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <EmptyState text={`No ${filter !== "all" ? filter : ""} applications`} />
        ) : (
          filtered.map((app) => (
            <div key={app.id} className="rounded-2xl border border-dash-border bg-dash-surface p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{app.applicantName}</h3>
                  <p className="text-sm text-white/40">{app.applicantEmail}</p>
                </div>
                <StatusBadge status={app.status} />
              </div>

              <div className="mb-4 grid gap-3 rounded-xl bg-dash-bg p-4 sm:grid-cols-2">
                <InfoRow label="Type" value={app.type === "new_court" ? "New Court" : "Claim Existing"} />
                {app.type === "new_court" && app.courtData && (
                  <>
                    <InfoRow label="Court Name" value={app.courtData.name} />
                    <InfoRow label="Address" value={app.courtData.address} />
                    <InfoRow label="Setting" value={`${app.courtData.setting} · ${app.courtData.accessType}`} />
                    <InfoRow label="Baskets" value={String(app.courtData.baskets)} />
                    {app.courtData.description && (
                      <div className="sm:col-span-2"><InfoRow label="Description" value={app.courtData.description} /></div>
                    )}
                  </>
                )}
                {app.type === "claim_existing" && (
                  <>
                    <InfoRow label="Court ID" value={app.courtId ?? "—"} />
                    <div className="sm:col-span-2">
                      <InfoRow label="Verification" value={(app as unknown as Record<string, string>).verificationInfo ?? "—"} />
                    </div>
                  </>
                )}
                <InfoRow label="Submitted" value={
                  app.submittedAt ? new Date((app.submittedAt as { toDate: () => Date }).toDate()).toLocaleDateString() : "—"
                } />
              </div>

              {app.status === "pending" && (
                <div className="space-y-3">
                  <button
                    onClick={() => setFreeAccess((prev) => ({ ...prev, [app.id]: !prev[app.id] }))}
                    className="flex items-center gap-3 text-sm text-white/60"
                  >
                    <Checkbox checked={freeAccess[app.id]} />
                    Grant free access (skip payment)
                  </button>
                  <div className="flex gap-3">
                    <button onClick={() => handleApprove(app)} disabled={actionLoading === app.id}
                      className="rounded-xl bg-status-confirmed px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-status-confirmed/80 disabled:opacity-50">
                      {actionLoading === app.id ? "..." : "Approve"}
                    </button>
                    <button onClick={() => handleReject(app)} disabled={actionLoading === app.id}
                      className="rounded-xl bg-status-rejected/10 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-status-rejected transition-all hover:bg-status-rejected/20 disabled:opacity-50">
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: PENDING COURTS (user-submitted courts from the app)
// ═══════════════════════════════════════════════════════════════════════════

interface PendingCourt {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  baskets: number;
  setting: string;
  accessType: string;
  hasLights: boolean;
  hoursOfOperation: string;
  phoneNumber: string;
  courtCondition: string;
  threePointLine: string;
  goatsTake: string;
  photoUrl: string;
  photoUrlCard: string;
  photoUrlFull: string;
  userDescription: string;
  submittedBy: string;
  submittedAt: Timestamp | null;
  status: string;
  hiddenByAdmin?: boolean;
}

function PendingCourtsTab() {
  const [courts, setCourts] = useState<PendingCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [view, setView] = useState<"pending" | "history">("pending");

  useEffect(() => { loadCourts(); }, []);

  async function loadCourts() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "pending_courts"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PendingCourt))
        .filter((c) => !c.hiddenByAdmin);
      list.sort((a, b) => {
        const ta = a.submittedAt?.toDate?.()?.getTime() ?? 0;
        const tb = b.submittedAt?.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      });
      setCourts(list);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(court: PendingCourt) {
    if (!court.name.trim() || !court.address.trim()) {
      alert("Court name and address are required.");
      return;
    }
    setActionLoading(court.id);
    try {
      const newCourtRef = doc(collection(db, "courts"));
      await setDoc(newCourtRef, {
        name: court.name,
        address: court.address,
        latitude: court.latitude || 0,
        longitude: court.longitude || 0,
        baskets: court.baskets || 0,
        setting: court.setting || "Outdoor",
        accessType: court.accessType || "Public",
        hasLights: court.hasLights || false,
        hoursOfOperation: court.hoursOfOperation || "",
        phoneNumber: court.phoneNumber || "",
        courtCondition: court.courtCondition || "Okay",
        threePointLine: court.threePointLine || "None",
        goatsTake: court.goatsTake || "",
        photoUrl: court.photoUrlCard || court.photoUrl || "",
        photoUrlCard: court.photoUrlCard || "",
        photoUrlFull: court.photoUrlFull || "",
        activeUserIds: [],
        geofenceRadiusMeters: 100,
      });

      await updateDoc(doc(db, "pending_courts", court.id), {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedCourtId: newCourtRef.id,
      });

      setCourts((prev) => prev.map((c) => c.id === court.id ? { ...c, status: "approved" } : c));
    } catch (err) {
      console.error("Approve failed:", err);
      alert("Failed to approve. Check console.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(courtId: string) {
    setActionLoading(courtId);
    try {
      await updateDoc(doc(db, "pending_courts", courtId), {
        status: "rejected",
        rejectedAt: serverTimestamp(),
      });
      setCourts((prev) => prev.map((c) => c.id === courtId ? { ...c, status: "rejected" } : c));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(courtId: string) {
    if (!confirm("Hide this court from the admin panel?")) return;
    setActionLoading(courtId);
    try {
      await updateDoc(doc(db, "pending_courts", courtId), { hiddenByAdmin: true });
      setCourts((prev) => prev.filter((c) => c.id !== courtId));
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <LoadingSpinner />;

  const pending = courts.filter((c) => c.status === "pending");
  const history = courts.filter((c) => c.status !== "pending");

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold text-white">Pending Courts</h1>

      <div className="mb-6 flex gap-2 rounded-xl bg-dash-surface p-1 max-w-xs">
        <button onClick={() => setView("pending")}
          className={`flex-1 rounded-lg py-2 font-display text-xs font-bold transition-all ${
            view === "pending" ? "bg-teal text-surface-dark" : "text-dash-text-muted hover:text-dash-text"
          }`}>
          Pending ({pending.length})
        </button>
        <button onClick={() => setView("history")}
          className={`flex-1 rounded-lg py-2 font-display text-xs font-bold transition-all ${
            view === "history" ? "bg-teal text-surface-dark" : "text-dash-text-muted hover:text-dash-text"
          }`}>
          History
        </button>
      </div>

      <div className="space-y-4">
        {(view === "pending" ? pending : history).length === 0 ? (
          <EmptyState text={view === "pending" ? "No pending courts" : "No history yet"} />
        ) : (
          (view === "pending" ? pending : history).map((court) => (
            <div key={court.id} className="rounded-2xl border border-dash-border bg-dash-surface p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  {(court.photoUrlCard || court.photoUrl) && (
                    <img src={court.photoUrlCard || court.photoUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-white">{court.name || "Unnamed"}</h3>
                    <p className="text-sm text-white/40">{court.address}</p>
                  </div>
                </div>
                {court.status !== "pending" && <StatusBadge status={court.status} />}
              </div>

              <div className="mb-4 grid gap-3 rounded-xl bg-dash-bg p-4 sm:grid-cols-2">
                <InfoRow label="Setting" value={`${court.setting || "—"} · ${court.accessType || "—"}`} />
                <InfoRow label="Baskets" value={String(court.baskets || 0)} />
                <InfoRow label="Condition" value={court.courtCondition || "—"} />
                <InfoRow label="3PT Line" value={court.threePointLine || "—"} />
                <InfoRow label="Lights" value={court.hasLights ? "Yes" : "No"} />
                <InfoRow label="Submitted" value={court.submittedAt?.toDate?.() ? court.submittedAt.toDate().toLocaleDateString() : "—"} />
                {court.userDescription && (
                  <div className="sm:col-span-2"><InfoRow label="User Notes" value={court.userDescription} /></div>
                )}
                {court.goatsTake && (
                  <div className="sm:col-span-2"><InfoRow label="Description" value={court.goatsTake} /></div>
                )}
              </div>

              <div className="flex gap-3">
                {court.status === "pending" && (
                  <>
                    <button onClick={() => handleApprove(court)} disabled={actionLoading === court.id}
                      className="rounded-xl bg-status-confirmed px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-status-confirmed/80 disabled:opacity-50">
                      {actionLoading === court.id ? "..." : "Approve"}
                    </button>
                    <button onClick={() => handleReject(court.id)} disabled={actionLoading === court.id}
                      className="rounded-xl bg-status-rejected/10 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-status-rejected transition-all hover:bg-status-rejected/20 disabled:opacity-50">
                      Reject
                    </button>
                  </>
                )}
                <button onClick={() => handleDelete(court.id)} disabled={actionLoading === court.id}
                  className="rounded-xl border border-dash-border px-4 py-2.5 text-xs text-white/30 hover:text-white/60 disabled:opacity-50">
                  Hide
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: ALL COURTS (browse + add + edit live courts)
// ═══════════════════════════════════════════════════════════════════════════

interface LiveCourtRow {
  id: string;
  name: string;
  address: string;
  baskets: number;
  setting: string;
  accessType: string;
  photoUrlCard: string;
  photoUrl: string;
  operatorIds?: string[];
}

function LiveCourtsTab() {
  const [courts, setCourts] = useState<LiveCourtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "courts"));
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name ?? "",
          address: data.address ?? "",
          baskets: data.baskets ?? 0,
          setting: data.setting ?? "",
          accessType: data.accessType ?? "",
          photoUrlCard: data.photoUrlCard ?? "",
          photoUrl: data.photoUrl ?? "",
          operatorIds: data.operatorIds ?? [],
        };
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCourts(list);
      setLoading(false);
    })();
  }, []);

  const filtered = search.trim()
    ? courts.filter((c) => {
        const q = search.trim().toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q)
        );
      })
    : courts;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">All Courts</h1>
          <p className="text-sm text-white/40">
            {courts.length} live court{courts.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/courts/new"
          className="flex items-center gap-2 rounded-xl bg-teal px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal/90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Court
        </Link>
      </div>

      <div className="mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or address…"
          className="w-full rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-teal/60 focus:outline-none"
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState text={search.trim() ? "No matching courts" : "No courts yet"} />
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const thumb = c.photoUrlCard || c.photoUrl;
            const isOperatorManaged = (c.operatorIds?.length ?? 0) > 0;
            return (
              <Link
                key={c.id}
                href={`/admin/courts/${c.id}/edit`}
                className="flex items-center gap-4 rounded-xl border border-dash-border bg-dash-surface px-4 py-3 transition-colors hover:border-teal/40"
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-dash-bg text-[10px] text-white/30">
                    No photo
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {c.name || "Unnamed"}
                    </p>
                    {isOperatorManaged && (
                      <span className="rounded-full bg-teal/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-teal">
                        Operator
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-white/40">{c.address || "—"}</p>
                  <p className="mt-0.5 text-[11px] text-white/30">
                    {c.baskets || 0} basket{c.baskets === 1 ? "" : "s"}
                    {c.setting && ` · ${c.setting}`}
                    {c.accessType && ` · ${c.accessType}`}
                  </p>
                </div>
                <div className="shrink-0 text-xs font-semibold text-teal">
                  Edit →
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: ADMIN DASHBOARD (Comments, Users, Profile Pics, Check-Ins, Ratings)
// ═══════════════════════════════════════════════════════════════════════════

function DashboardTab() {
  const [dashTab, setDashTab] = useState<DashTab>("comments");

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold text-white">Dashboard</h1>

      <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-dash-surface p-1">
        {([
          { id: "comments" as const, label: "Comments" },
          { id: "users" as const, label: "Users" },
          { id: "profilePics" as const, label: "Profile Pics" },
          { id: "checkIns" as const, label: "Check-Ins" },
          { id: "ratings" as const, label: "Ratings" },
          { id: "deletedOperators" as const, label: "Deleted Operators" },
        ]).map((tab) => (
          <button key={tab.id} onClick={() => setDashTab(tab.id)}
            className={`rounded-lg px-4 py-2 font-display text-xs font-bold transition-all ${
              dashTab === tab.id ? "bg-teal text-surface-dark" : "text-dash-text-muted hover:text-dash-text"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {dashTab === "comments" && <CommentsPanel />}
      {dashTab === "users" && <UsersPanel />}
      {dashTab === "profilePics" && <ProfilePicsPanel />}
      {dashTab === "checkIns" && <CheckInsPanel />}
      {dashTab === "ratings" && <RatingsPanel />}
      {dashTab === "deletedOperators" && <DeletedOperatorsPanel />}
    </div>
  );
}

function CommentsPanel() {
  const [comments, setComments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [courtNames, setCourtNames] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "comments"), orderBy("timestamp", "desc"), limit(50)));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      setComments(list);

      // Cache court names
      const courtIds = [...new Set(list.map((c) => c.courtId as string).filter(Boolean))];
      const names: Record<string, string> = {};
      await Promise.all(courtIds.map(async (id) => {
        const courtSnap = await getDoc(doc(db, "courts", id));
        if (courtSnap.exists()) names[id] = courtSnap.data().name;
      }));
      setCourtNames(names);
      setLoading(false);
    })();
  }, []);

  async function handleDelete(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    await deleteDoc(doc(db, "comments", commentId));
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      {comments.length === 0 ? <EmptyState text="No comments" /> : comments.map((c) => (
        <div key={c.id as string} className="flex items-start justify-between rounded-xl border border-dash-border bg-dash-bg p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">{c.username as string}</p>
            <p className="mt-1 text-sm text-white/60 line-clamp-2">{c.text as string}</p>
            <p className="mt-1 text-xs text-white/30">
              {courtNames[c.courtId as string] || "Unknown court"} · {formatTs(c.timestamp)}
            </p>
          </div>
          <button onClick={() => handleDelete(c.id as string)} className="ml-3 shrink-0 text-white/30 hover:text-status-rejected">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14H7L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "users"), limit(100)));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-2">
      {users.map((u) => {
        const signupLine = formatSignupLocation(u);
        return (
          <div key={u.id as string} className="flex items-center gap-3 rounded-xl border border-dash-border bg-dash-bg px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal/20 text-xs font-bold text-teal">
              {((u.username as string) || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{u.username as string}</p>
              <p className="text-xs text-white/40">{u.email as string}</p>
              {signupLine && (
                <p className="text-[10px] text-white/40">{signupLine}</p>
              )}
            </div>
            <p className="hidden text-[10px] text-white/20 sm:block">{u.id as string}</p>
          </div>
        );
      })}
    </div>
  );
}

function formatSignupLocation(u: Record<string, unknown>): string | null {
  const name = u.signupNearestCourtName;
  if (typeof name === "string" && name.length > 0) return `From: ${name}`;
  const geo = u.signupLocation as { latitude?: number; longitude?: number } | undefined;
  if (geo && typeof geo.latitude === "number" && typeof geo.longitude === "number") {
    return `From: ${geo.latitude.toFixed(3)}, ${geo.longitude.toFixed(3)}`;
  }
  return null;
}

function ProfilePicsPanel() {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "users"), limit(100)));
      setUsers((snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]).filter((u) => u.photoUrl));
      setLoading(false);
    })();
  }, []);

  async function handleReset(userId: string, photoUrl: string) {
    if (!confirm("Reset this user's profile photo?")) return;
    await updateDoc(doc(db, "users", userId), { photoUrl: "" });
    try {
      // Try to delete from storage
      const path = decodeStoragePath(photoUrl as string);
      if (path) await deleteObject(ref(storage, path));
    } catch { /* best effort */ }
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {users.length === 0 ? <EmptyState text="No profile photos" /> : users.map((u) => (
        <div key={u.id as string} className="rounded-xl border border-dash-border bg-dash-bg p-4 text-center">
          <img src={u.photoUrl as string} alt="" className="mx-auto mb-2 h-20 w-20 rounded-full object-cover" />
          <p className="text-sm font-medium text-white">{u.username as string}</p>
          <button onClick={() => handleReset(u.id as string, u.photoUrl as string)}
            className="mt-2 text-xs text-status-rejected/70 hover:text-status-rejected">
            Reset Photo
          </button>
        </div>
      ))}
    </div>
  );
}

function CheckInsPanel() {
  const [visits, setVisits] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [names, setNames] = useState<{ users: Record<string, string>; courts: Record<string, string> }>({ users: {}, courts: {} });

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "courtVisits"), orderBy("checkInTime", "desc"), limit(50)));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      setVisits(list);

      const userIds = [...new Set(list.map((v) => v.userId as string).filter(Boolean))];
      const courtIds = [...new Set(list.map((v) => v.courtId as string).filter(Boolean))];
      const userNames: Record<string, string> = {};
      const courtNames: Record<string, string> = {};
      await Promise.all([
        ...userIds.map(async (id) => {
          const s = await getDoc(doc(db, "users", id));
          if (s.exists()) userNames[id] = s.data().username || id;
        }),
        ...courtIds.map(async (id) => {
          const s = await getDoc(doc(db, "courts", id));
          if (s.exists()) courtNames[id] = s.data().name || id;
        }),
      ]);
      setNames({ users: userNames, courts: courtNames });
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-2">
      {visits.length === 0 ? <EmptyState text="No check-ins" /> : visits.map((v) => (
        <div key={v.id as string} className="flex items-center justify-between rounded-xl border border-dash-border bg-dash-bg px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">{names.users[v.userId as string] || "Unknown"}</p>
            <p className="text-xs text-white/40">{names.courts[v.courtId as string] || "Unknown court"}</p>
          </div>
          <p className="text-xs text-white/30">{formatTs(v.checkInTime)}</p>
        </div>
      ))}
    </div>
  );
}

function RatingsPanel() {
  const [ratings, setRatings] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "court_ratings"), orderBy("timestamp", "desc"), limit(50)));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      setRatings(list);

      const userIds = [...new Set([
        ...list.map((r) => r.raterId as string),
        ...list.map((r) => r.ratedUserId as string),
      ].filter(Boolean))];
      const userNames: Record<string, string> = {};
      await Promise.all(userIds.map(async (id) => {
        const s = await getDoc(doc(db, "users", id));
        if (s.exists()) userNames[id] = s.data().username || id;
      }));
      setNames(userNames);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-2">
      {ratings.length === 0 ? <EmptyState text="No ratings" /> : ratings.map((r) => {
        const type = r.ratingType as string;
        let value: number;
        if (type === "categories") {
          const cats = ["iq", "passing", "defense", "rebounding", "scoringInside", "midRange", "threePoint", "offTheDribble", "sportsmanship"];
          const sum = cats.reduce((s, c) => s + (Number(r[c]) || 0), 0);
          value = sum / cats.length;
        } else {
          value = Number(r.overallRating) || 0;
        }

        return (
          <div key={r.id as string} className="flex items-center justify-between rounded-xl border border-dash-border bg-dash-bg px-4 py-3">
            <div>
              <p className="text-sm text-white">
                <span className="font-medium">{names[r.raterId as string] || "?"}</span>
                <span className="text-white/30"> → </span>
                <span className="font-medium">{names[r.ratedUserId as string] || "?"}</span>
              </p>
              <p className="text-xs text-white/40">
                {type === "categories" ? "Categories" : "Overall"} · {formatTs(r.timestamp)}
              </p>
            </div>
            <span className={`font-display text-lg font-bold ${type === "categories" ? "text-teal" : "text-coral"}`}>
              {value.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DeletedOperatorsPanel() {
  const [deleted, setDeleted] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "deleted_operators"), orderBy("deletedAt", "desc"), limit(50)));
      setDeleted(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      {deleted.length === 0 ? <EmptyState text="No deleted operator accounts" /> : deleted.map((op) => (
        <div key={op.id as string} className="rounded-xl border border-dash-border bg-dash-bg p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">
                {op.firstName as string} {op.lastName as string}
              </p>
              <p className="text-xs text-white/40">{op.email as string}</p>
            </div>
            <div className="flex items-center gap-2">
              {!!op.authDeleted && (
                <span className="rounded-full bg-status-rejected/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-status-rejected">
                  Auth Deleted
                </span>
              )}
              {!!op.freeAccess && (
                <span className="rounded-full bg-teal/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal">
                  Free
                </span>
              )}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <InfoRow label="Phone" value={(op.phone as string) || "—"} />
            <InfoRow label="Courts" value={
              (op.courtIds as string[])?.length
                ? (op.courtIds as string[]).join(", ")
                : "None"
            } />
            <InfoRow label="Deleted" value={formatTs(op.deletedAt)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 5: AMBASSADORS (referral codes + click/signup counters)
// ═══════════════════════════════════════════════════════════════════════════

interface Ambassador {
  id: string; // doc id IS the code
  name: string;
  clicks: number;
  signups: number;
  active: boolean;
  createdAt: Timestamp | null;
  lastClickAt?: Timestamp | null;
  lastSignupAt?: Timestamp | null;
}

// Avoid ambiguous chars (0/O, 1/I/L) so codes are readable when transcribed.
const AMBASSADOR_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const AMBASSADOR_CODE_LENGTH = 6;

function generateAmbassadorCode(): string {
  let code = "";
  for (let i = 0; i < AMBASSADOR_CODE_LENGTH; i++) {
    code += AMBASSADOR_CODE_ALPHABET[Math.floor(Math.random() * AMBASSADOR_CODE_ALPHABET.length)];
  }
  return code;
}

function AmbassadorsTab() {
  const { user } = useAuth();
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "ambassadors"), orderBy("createdAt", "desc")));
      setAmbassadors(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ambassador)));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      // Generate a code, retry up to a few times on collision.
      let code = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateAmbassadorCode();
        const existing = await getDoc(doc(db, "ambassadors", candidate));
        if (!existing.exists()) {
          code = candidate;
          break;
        }
      }
      if (!code) {
        alert("Could not generate a unique code. Try again.");
        return;
      }

      await setDoc(doc(db, "ambassadors", code), {
        name,
        clicks: 0,
        signups: 0,
        active: true,
        createdAt: serverTimestamp(),
        createdBy: user?.uid ?? "",
      });
      setNewName("");
      await load();
    } catch (err) {
      console.error("Failed to create ambassador:", err);
      alert("Failed to create ambassador. Check console.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(amb: Ambassador) {
    try {
      await updateDoc(doc(db, "ambassadors", amb.id), { active: !amb.active });
      setAmbassadors((prev) => prev.map((a) => a.id === amb.id ? { ...a, active: !amb.active } : a));
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  }

  async function handleDelete(code: string) {
    if (!confirm(`Delete ambassador "${code}"? Their click history will remain in the subcollection but the code will stop attributing new signups.`)) return;
    try {
      await deleteDoc(doc(db, "ambassadors", code));
      setAmbassadors((prev) => prev.filter((a) => a.id !== code));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  async function copyLink(code: string) {
    const url = `https://goatssportsapp.com/r/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((c) => c === code ? null : c), 1500);
    } catch {
      // Fallback: select and copy
      window.prompt("Copy this URL:", url);
    }
  }

  if (loading) return <LoadingSpinner />;

  const activeCount = ambassadors.filter((a) => a.active).length;
  const totalClicks = ambassadors.reduce((s, a) => s + (a.clicks || 0), 0);
  const totalSignups = ambassadors.reduce((s, a) => s + (a.signups || 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Ambassadors</h1>
          <p className="text-sm text-white/40">
            {activeCount} active · {totalClicks} click{totalClicks === 1 ? "" : "s"} · {totalSignups} signup{totalSignups === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Create form */}
      <div className="mb-6 rounded-2xl border border-dash-border bg-dash-surface p-5">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-white/30">New Ambassador</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. Mike Smith)"
            className="flex-1 rounded-xl border border-dash-border bg-dash-bg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-teal/60 focus:outline-none"
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
          />
          <button
            onClick={() => void handleCreate()}
            disabled={creating || !newName.trim()}
            className="rounded-xl bg-teal px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal/90 disabled:opacity-50"
          >
            {creating ? "..." : "Create"}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/30">A 6-character code is generated automatically.</p>
      </div>

      {/* Ambassador list */}
      {ambassadors.length === 0 ? (
        <EmptyState text="No ambassadors yet" />
      ) : (
        <div className="space-y-3">
          {ambassadors.map((amb) => {
            const url = `https://goatssportsapp.com/r/${amb.id}`;
            return (
              <div key={amb.id} className="rounded-2xl border border-dash-border bg-dash-surface p-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">{amb.name}</h3>
                      {!amb.active && (
                        <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-sm font-bold tracking-wider text-teal">{amb.id}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-display text-xl font-bold text-white">{amb.clicks || 0}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Clicks</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl font-bold text-coral">{amb.signups || 0}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Signups</p>
                    </div>
                  </div>
                </div>

                <div className="mb-3 flex items-center gap-2 rounded-lg bg-dash-bg px-3 py-2">
                  <code className="flex-1 truncate text-xs text-white/60">{url}</code>
                  <button
                    onClick={() => void copyLink(amb.id)}
                    className="rounded-md border border-dash-border px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/60 transition-colors hover:border-teal/40 hover:text-teal"
                  >
                    {copiedCode === amb.id ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void handleToggleActive(amb)}
                    className="rounded-lg border border-dash-border px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-white/40 hover:text-white"
                  >
                    {amb.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => void handleDelete(amb.id)}
                    className="rounded-lg border border-dash-border px-3 py-1.5 text-xs text-status-rejected/70 transition-colors hover:border-status-rejected/40 hover:text-status-rejected"
                  >
                    Delete
                  </button>
                  <span className="ml-auto text-[10px] text-white/30">
                    {amb.createdAt ? `Created ${formatTs(amb.createdAt)}` : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function LoadingSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dash-border bg-dash-surface py-16 text-center">
      <p className="text-sm text-white/30">{text}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
      status === "pending" ? "bg-status-pending/10 text-status-pending" :
      status === "approved" ? "bg-status-confirmed/10 text-status-confirmed" :
      "bg-status-rejected/10 text-status-rejected"
    }`}>
      {status}
    </span>
  );
}

function Checkbox({ checked }: { checked?: boolean }) {
  return (
    <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
      checked ? "border-teal bg-teal" : "border-white/20"
    }`}>
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </div>
  );
}

function FilterBar({ filter, onChange, counts }: {
  filter: string;
  onChange: (f: "pending" | "approved" | "rejected" | "all") => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="mb-6 flex gap-1 rounded-xl bg-dash-surface p-1">
      {([
        { id: "pending" as const, label: `Pending (${counts.pending})` },
        { id: "approved" as const, label: "Approved" },
        { id: "rejected" as const, label: "Rejected" },
        { id: "all" as const, label: "All" },
      ]).map((tab) => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          className={`flex-1 rounded-lg py-2.5 font-display text-xs font-bold uppercase tracking-wider transition-all ${
            filter === tab.id ? "bg-teal text-surface-dark" : "text-dash-text-muted hover:text-dash-text"
          }`}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">{label}</p>
      <p className="text-sm text-white/80">{value}</p>
    </div>
  );
}

function formatTs(ts: unknown): string {
  if (!ts) return "—";
  try {
    const date = typeof ts === "object" && "toDate" in (ts as Record<string, unknown>)
      ? (ts as { toDate: () => Date }).toDate()
      : typeof ts === "number"
        ? new Date(ts)
        : null;
    if (!date) return "—";
    return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function decodeStoragePath(url: string): string | null {
  const oIndex = url.indexOf("/o/");
  if (oIndex === -1) return null;
  const pathStart = oIndex + 3;
  const queryIndex = url.indexOf("?", pathStart);
  const encoded = queryIndex !== -1 ? url.substring(pathStart, queryIndex) : url.substring(pathStart);
  return decodeURIComponent(encoded);
}
