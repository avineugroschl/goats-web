"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Court } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CourtDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourt() {
      const snap = await getDoc(doc(db, "courts", id));
      if (snap.exists()) {
        setCourt({ id: snap.id, ...snap.data() } as Court);
      }
      setLoading(false);
    }
    fetchCourt();
  }, [id]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      </main>
    );
  }

  if (!court) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-text-muted">Court not found.</p>
        <Link href="/courts" className="text-teal hover:text-teal-dark">
          &larr; Back to courts
        </Link>
      </main>
    );
  }

  const heroImage = court.photoUrlFull || court.photoUrlCard || court.photoUrl;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/courts"
        className="mb-6 inline-flex items-center gap-2 text-teal hover:text-teal-dark"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to courts
      </Link>

      {/* Hero Image */}
      {heroImage && (
        <div className="mb-6 overflow-hidden rounded-2xl shadow-lg">
          <img
            src={heroImage}
            alt={court.name}
            className="w-full object-cover"
            style={{ aspectRatio: "3 / 2" }}
          />
        </div>
      )}

      {/* Court Name & Active Users */}
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">{court.name}</h1>
        <p className="text-teal">{court.address}</p>
      </div>

      {/* Get the app CTA */}
      <div className="mb-8 flex items-center gap-4 rounded-2xl bg-teal-light p-5">
        <img src="/app-icon.png" alt="G.O.A.T.S" className="h-12 w-12 rounded-xl" />
        <div>
          <p className="font-semibold text-teal-dark">
            See who&apos;s playing and check in
          </p>
          <p className="text-sm text-text-secondary">
            Download the G.O.A.T.S app for real-time updates
          </p>
        </div>
      </div>

      {/* Court Info */}
      <section className="mb-8 rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold">Court Details</h2>
        <div className="grid grid-cols-2 gap-y-5 gap-x-8">
          <InfoRow label="Baskets" value={String(court.baskets)} />
          <InfoRow label="Setting" value={court.setting} />
          <InfoRow label="Access" value={court.accessType} />
          <InfoRow label="Condition" value={court.courtCondition} />
          <InfoRow label="3-Point Line" value={court.threePointLine} />
          <InfoRow label="Lights" value={court.hasLights ? "Yes" : "No"} />
          {court.hoursOfOperation && (
            <InfoRow label="Hours" value={court.hoursOfOperation} />
          )}
          {court.phoneNumber && (
            <InfoRow label="Phone" value={court.phoneNumber} />
          )}
        </div>
      </section>

      {/* Goats Take */}
      {court.goatsTake && (
        <section className="mb-8 rounded-2xl bg-surface p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">
            <span className="text-teal">G.O.A.T.S</span> Take
          </h2>
          <p className="leading-relaxed text-text-secondary">
            {court.goatsTake}
          </p>
        </section>
      )}

      {/* Map Link */}
      {court.latitude !== 0 && court.longitude !== 0 && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${court.latitude},${court.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-8 flex items-center justify-center gap-2 rounded-2xl bg-surface p-4 text-teal shadow-sm transition-shadow hover:shadow-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Open in Google Maps
        </a>
      )}

      {/* Footer CTA */}
      <div className="py-8 text-center">
        <Link
          href="/"
          className="inline-block rounded-full bg-coral px-8 py-3 font-semibold text-text-on-dark transition-colors hover:bg-coral-dark"
        >
          Get the G.O.A.T.S App
        </Link>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
