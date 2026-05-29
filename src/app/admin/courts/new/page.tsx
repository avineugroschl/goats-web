"use client";

// New-court admin route. Generates the Firestore doc ID up-front so the
// photo upload paths (court_photos/{id}_card.webp + _full.webp) are stable
// before save — same flow as the mobile AdminAddCourtScreen.

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import CourtForm from "../CourtForm";

export default function AdminNewCourtPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || !profile?.isAdmin)) {
      router.push("/");
    }
  }, [authLoading, user, profile, router]);

  // Generate the new court ID once, on first render — kept stable across
  // re-renders so the photo upload path doesn't drift if the user picks a
  // photo before saving.
  const newCourtId = useMemo(
    () => doc(collection(db, "courts")).id,
    []
  );

  if (authLoading || !user || !profile?.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dash-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      </div>
    );
  }

  return <CourtForm mode="new" courtId={newCourtId} existingCourt={null} />;
}
