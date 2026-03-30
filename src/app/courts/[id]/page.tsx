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

  const activeCount = court.activeUserIds?.length || 0;
  const heroImage = court.photoUrlFull || court.photoUrlCard || court.photoUrl;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/courts"
        className="mb-6 inline-block text-teal hover:text-teal-dark"
      >
        &larr; Back to courts
      </Link>

      {/* Hero Image */}
      {heroImage && (
        <div className="mb-6 overflow-hidden rounded-2xl">
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
        <p className="mb-3 text-teal">{court.address}</p>
        {activeCount > 0 ? (
          <span className="inline-block rounded-full bg-coral/20 px-4 py-2 font-bold text-coral">
            {activeCount} {activeCount === 1 ? "person" : "people"} here now
          </span>
        ) : (
          <span className="inline-block rounded-full bg-surface-variant px-4 py-2 text-text-muted">
            No one here right now
          </span>
        )}
      </div>

      {/* Get the app CTA */}
      <div className="mb-8 rounded-xl border border-coral/30 bg-surface p-4 text-center">
        <p className="mb-1 font-semibold text-coral">
          Want to check in and see who&apos;s playing?
        </p>
        <p className="text-sm text-text-secondary">
          Download the <span className="font-semibold text-text-primary">G.O.A.T.S</span> app to
          check in, rate players, and get real-time updates.
        </p>
      </div>

      {/* Court Info */}
      <section className="mb-8 rounded-xl bg-surface p-6">
        <h2 className="mb-4 text-xl font-bold">Court Details</h2>
        <div className="grid grid-cols-2 gap-4">
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
        <section className="mb-8 rounded-xl bg-surface p-6">
          <h2 className="mb-3 text-xl font-bold">
            <span className="text-gold">G.O.A.T.S</span> Take
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
          className="mb-8 block rounded-xl bg-surface p-4 text-center text-teal transition-colors hover:bg-surface-variant"
        >
          Open in Google Maps &rarr;
        </a>
      )}

      {/* Footer CTA */}
      <div className="py-8 text-center">
        <Link
          href="/"
          className="inline-block rounded-full bg-coral px-8 py-3 font-semibold text-bg transition-colors hover:bg-coral-dark"
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
      <p className="text-xs text-text-muted">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
