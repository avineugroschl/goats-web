"use client";

// Edit-court admin route. Loads the live court doc, gates non-admins,
// hands off to the shared CourtForm. The form's scoped updateDoc never
// touches activeUserIds, operatorIds, schedule, billing, etc. — only the
// 16 admin-editable fields.

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Court } from "@/lib/types";
import CourtForm from "../../CourtForm";

export default function AdminEditCourtPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courtId = params.id;

  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !profile?.isAdmin)) {
      router.push("/");
    }
  }, [authLoading, user, profile, router]);

  useEffect(() => {
    if (!courtId || authLoading || !profile?.isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "courts", courtId));
        if (cancelled) return;
        if (!snap.exists()) {
          setNotFound(true);
        } else {
          setCourt({ id: snap.id, ...snap.data() } as Court);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courtId, authLoading, profile?.isAdmin]);

  if (authLoading || loading || !user || !profile?.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dash-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      </div>
    );
  }

  if (notFound || !court) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-dash-bg">
        <p className="text-sm text-white/40">Court not found.</p>
        <button
          onClick={() => router.push("/admin?tab=liveCourts")}
          className="rounded-xl border border-dash-border px-4 py-2 text-xs text-white/60 hover:text-white"
        >
          Back to Courts
        </button>
      </div>
    );
  }

  return <CourtForm mode="edit" courtId={courtId} existingCourt={court} />;
}
