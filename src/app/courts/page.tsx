"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Court } from "@/lib/types";
import Link from "next/link";

type SortOption = "name" | "active" | "baskets";

export default function CourtsPage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("active");
  const [filterSetting, setFilterSetting] = useState<string>("All");
  const [filterAccess, setFilterAccess] = useState<string>("All");

  useEffect(() => {
    async function fetchCourts() {
      const snapshot = await getDocs(collection(db, "courts"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Court[];
      setCourts(data);
      setLoading(false);
    }
    fetchCourts();
  }, []);

  const filtered = useMemo(() => {
    let result = courts;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q)
      );
    }

    if (filterSetting !== "All") {
      result = result.filter((c) => c.setting === filterSetting);
    }

    if (filterAccess !== "All") {
      result = result.filter((c) => c.accessType === filterAccess);
    }

    result = [...result].sort((a, b) => {
      if (sortBy === "active") return (b.activeUserIds?.length || 0) - (a.activeUserIds?.length || 0);
      if (sortBy === "baskets") return b.baskets - a.baskets;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [courts, search, sortBy, filterSetting, filterAccess]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-teal hover:text-teal-dark">
          &larr; Home
        </Link>
        <h1 className="text-2xl font-bold">
          Basketball Courts
        </h1>
        <div className="w-16" />
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search courts by name or address..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full rounded-lg border border-surface-variant bg-surface px-4 py-3 text-text-primary placeholder-text-muted outline-none focus:border-teal"
      />

      {/* Filters & Sort */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="rounded-lg border border-surface-variant bg-surface px-3 py-2 text-sm text-text-primary outline-none"
        >
          <option value="active">Sort: Most Active</option>
          <option value="name">Sort: Name</option>
          <option value="baskets">Sort: Most Baskets</option>
        </select>
        <select
          value={filterSetting}
          onChange={(e) => setFilterSetting(e.target.value)}
          className="rounded-lg border border-surface-variant bg-surface px-3 py-2 text-sm text-text-primary outline-none"
        >
          <option value="All">All Settings</option>
          <option value="Outdoor">Outdoor</option>
          <option value="Indoor">Indoor</option>
        </select>
        <select
          value={filterAccess}
          onChange={(e) => setFilterAccess(e.target.value)}
          className="rounded-lg border border-surface-variant bg-surface px-3 py-2 text-sm text-text-primary outline-none"
        >
          <option value="All">All Access</option>
          <option value="Public">Public</option>
          <option value="Private">Private</option>
          <option value="Membership Required">Membership</option>
        </select>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="mb-4 text-sm text-text-muted">
          {filtered.length} court{filtered.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Court List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-20 text-center text-text-muted">No courts found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((court) => (
            <CourtCard key={court.id} court={court} />
          ))}
        </div>
      )}
    </main>
  );
}

function CourtCard({ court }: { court: Court }) {
  const activeCount = court.activeUserIds?.length || 0;
  const imageUrl = court.photoUrlCard || court.photoUrl;

  return (
    <Link
      href={`/courts/${court.id}`}
      className="flex gap-4 rounded-xl bg-surface p-3 transition-colors hover:bg-surface-variant"
    >
      {/* Thumbnail */}
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-surface-variant">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={court.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">
            &#127936;
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <h2 className="truncate text-lg font-bold">{court.name}</h2>
        <p className="truncate text-sm text-teal">{court.address}</p>
        <div className="mt-1 flex items-center gap-3 text-sm">
          <span className="text-text-primary">
            {court.baskets} basket{court.baskets !== 1 ? "s" : ""}
          </span>
          <span className="font-medium text-teal">{court.setting}</span>
          <span className="text-text-secondary">{court.accessType}</span>
        </div>
      </div>

      {/* Active Users Badge */}
      <div className="flex flex-shrink-0 items-center">
        {activeCount > 0 ? (
          <span className="rounded-full bg-coral/20 px-3 py-1 text-sm font-bold text-coral">
            {activeCount} &#9899;
          </span>
        ) : (
          <span className="rounded-full bg-surface-variant px-3 py-1 text-xs text-text-muted">
            Empty
          </span>
        )}
      </div>
    </Link>
  );
}
