"use client";

import { useEffect, useLayoutEffect, useState, useMemo, useRef } from "react";
import { Court } from "@/lib/types";
import { courtPath } from "@/lib/slug";
import Link from "next/link";
import GetAppCta from "@/components/GetAppCta";

const NYC = { lat: 40.7128, lng: -73.9060 };

// Module-level cache: survives client-side back navigation so returning to
// this page renders the full list instantly — no spinner, no scroll jump.
let courtsCache: Court[] | null = null;

// Record the current scroll position when navigating away from this page
// (to a court, home, etc.) so a soft-nav back restores exactly where you left.
function saveScrollPosition() {
  sessionStorage.setItem("courts_scroll", String(window.scrollY));
}

// Restore scroll before the browser paints (avoids a visible jump). Falls
// back to useEffect during SSR where useLayoutEffect is a no-op.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function getDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CourtsPage() {
  const [courts, setCourts] = useState<Court[]>(courtsCache ?? []);
  const [loading, setLoading] = useState(courtsCache === null);
  const [search, setSearch] = useState(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("courts_search") || "" : ""
  );
  const [filterSetting, setFilterSetting] = useState<string>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("courts_setting") || "All" : "All"
  );
  const [filterConditions, setFilterConditions] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("courts_conditions");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });
  const [showConditionDropdown, setShowConditionDropdown] = useState(false);
  const conditionDropdownRef = useRef<HTMLDivElement>(null);
  const didRestoreScroll = useRef(false);
  // True only when the list was already cached at mount — i.e. we soft-
  // navigated back from a details page. On a fresh load/refresh the module
  // cache is empty, so we skip restore and start at the top.
  const cameFromSoftNav = useRef(courtsCache !== null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        conditionDropdownRef.current &&
        !conditionDropdownRef.current.contains(e.target as Node)
      ) {
        setShowConditionDropdown(false);
      }
    }
    if (showConditionDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showConditionDropdown]);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  }>(NYC);
  const [hasGeoPermission, setHasGeoPermission] = useState(false);
  const [customAddress, setCustomAddress] = useState("");
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [locationLabel, setLocationLabel] = useState("NYC");
  const [geocoding, setGeocoding] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setHasGeoPermission(true);
          setLocationLabel("Your Location");
        },
        () => {
          // Denied — keep NYC default
        }
      );
    }
  }, []);

  useEffect(() => {
    async function fetchCourts() {
      // Server-side read via /api/courts (see that route) — the browser no
      // longer queries Firestore directly, so `courts` doesn't need to be
      // world-readable.
      const res = await fetch("/api/courts");
      if (!res.ok) throw new Error(`courts fetch failed: ${res.status}`);
      const data = (await res.json()) as Court[];
      courtsCache = data;
      setCourts(data);
      setLoading(false);
    }
    fetchCourts();
  }, []);

  // Restore scroll position when returning from a court details page.
  // With the cached list, the full-height list is already in the DOM on
  // mount, so restoring in a layout effect (pre-paint) shows the page
  // already at the right spot — no visible scroll or jump.
  useIsomorphicLayoutEffect(() => {
    if (loading || didRestoreScroll.current) return;
    didRestoreScroll.current = true;
    if (!cameFromSoftNav.current) return; // fresh load/refresh → stay at top
    const saved = sessionStorage.getItem("courts_scroll");
    if (!saved) return;
    const y = parseInt(saved, 10);
    // Defer to rAF so this runs *after* Next.js's router scroll reset (which
    // otherwise snaps us back to the top on back-navigation), but still
    // before the browser paints. behavior:"instant" overrides the global
    // `scroll-behavior: smooth`, so there's no animation.
    requestAnimationFrame(() =>
      window.scrollTo({ top: y, behavior: "instant" })
    );
  }, [loading]);

  useEffect(() => {
    sessionStorage.setItem("courts_search", search);
  }, [search]);

  useEffect(() => {
    sessionStorage.setItem("courts_setting", filterSetting);
  }, [filterSetting]);

  useEffect(() => {
    sessionStorage.setItem("courts_conditions", JSON.stringify([...filterConditions]));
  }, [filterConditions]);

  useEffect(() => {
    if (showAddressInput && addressInputRef.current) {
      addressInputRef.current.focus();
    }
  }, [showAddressInput]);

  const [suggestions, setSuggestions] = useState<
    { display_name: string; lat: string; lon: string }[]
  >([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  function onAddressChange(value: string) {
    setCustomAddress(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&countrycodes=us`,
          { headers: { "User-Agent": "GoatsApp-Web" } }
        );
        const data = await res.json();
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  function selectSuggestion(suggestion: {
    display_name: string;
    lat: string;
    lon: string;
  }) {
    const shortName =
      suggestion.display_name.split(",").slice(0, 2).join(",").trim();
    setUserLocation({
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
    });
    setLocationLabel(shortName);
    setShowAddressInput(false);
    setCustomAddress("");
    setSuggestions([]);
  }

  async function geocodeAddress(address: string) {
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=us`,
        { headers: { "User-Agent": "GoatsApp-Web" } }
      );
      const data = await res.json();
      if (data.length > 0) {
        const shortName =
          data[0].display_name.split(",").slice(0, 2).join(",").trim();
        setUserLocation({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        });
        setLocationLabel(shortName);
        setShowAddressInput(false);
        setCustomAddress("");
        setSuggestions([]);
      }
    } finally {
      setGeocoding(false);
    }
  }

  function useMyLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setHasGeoPermission(true);
        setLocationLabel("Your Location");
        setShowAddressInput(false);
      });
    }
  }

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

    if (filterConditions.size > 0) {
      result = result.filter((c) => filterConditions.has(c.courtCondition));
    }

    result = [...result].sort((a, b) => {
      const distA = getDistanceMiles(
        userLocation.lat, userLocation.lng, a.latitude, a.longitude
      );
      const distB = getDistanceMiles(
        userLocation.lat, userLocation.lng, b.latitude, b.longitude
      );
      return distA - distB;
    });

    return result;
  }, [courts, search, filterSetting, filterConditions, userLocation]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/" onClick={saveScrollPosition} className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <img src="/app-icon.png" alt="G.O.A.T.S" className="h-8 w-8 rounded-lg" />
          <h1 className="wordmark text-base">G.O.A.T.S</h1>
        </Link>
      </div>

      {/* Get the app CTA */}
      <GetAppCta className="mb-6" />

      {/* Search */}
      <input
        type="text"
        placeholder="Search for a court..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full rounded-xl border border-surface-variant bg-surface px-4 py-3 text-text-primary placeholder-text-muted outline-none focus:border-teal"
      />

      {/* Location & Filters */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">Results for:</span>
          <button
            onClick={() => setShowAddressInput(!showAddressInput)}
            className="text-sm font-semibold text-teal hover:text-teal-dark"
          >
            {locationLabel}
          </button>
          {locationLabel !== "Your Location" && hasGeoPermission && (
            <button
              onClick={useMyLocation}
              className="text-xs text-text-muted hover:text-teal"
            >
              (use my location)
            </button>
          )}
          {locationLabel !== "NYC" && locationLabel !== "Your Location" && (
            <button
              onClick={() => {
                setShowAddressInput(false);
                setCustomAddress("");
                if (hasGeoPermission) {
                  useMyLocation();
                } else {
                  setUserLocation(NYC);
                  setLocationLabel("NYC");
                }
              }}
              className="text-xs text-text-muted hover:text-coral"
            >
              &times;
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
        <select
          value={filterSetting}
          onChange={(e) => setFilterSetting(e.target.value)}
          className="appearance-none rounded-xl border border-surface-variant bg-surface px-3 py-2 text-sm text-text-primary outline-none"
        >
          <option value="All">All Settings</option>
          <option value="Outdoor">Outdoor</option>
          <option value="Indoor">Indoor</option>
        </select>
        <div className="relative" ref={conditionDropdownRef}>
          <button
            onClick={() => setShowConditionDropdown((v) => !v)}
            className="rounded-xl border border-surface-variant bg-surface px-3 py-2 text-sm text-text-primary outline-none"
          >
            Condition{filterConditions.size > 0 ? ` (${filterConditions.size})` : ""}
          </button>
          {showConditionDropdown && (
            <div className="absolute z-10 mt-1 w-44 rounded-xl border border-surface-variant bg-surface py-1 shadow-lg">
              {["Very Good", "Good", "Solid", "Okay", "Below Average"].map((c) => (
                <label
                  key={c}
                  className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-surface-variant"
                >
                  <input
                    type="checkbox"
                    checked={filterConditions.has(c)}
                    onChange={() => {
                      setFilterConditions((prev) => {
                        const next = new Set(prev);
                        if (next.has(c)) next.delete(c);
                        else next.add(c);
                        return next;
                      });
                    }}
                    className="accent-teal"
                  />
                  {c}
                </label>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Address Input */}
      {showAddressInput && (
        <div className="relative mb-6">
          <div className="flex gap-2">
            <input
              ref={addressInputRef}
              type="text"
              placeholder="Enter an address..."
              value={customAddress}
              onChange={(e) => onAddressChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customAddress.trim()) {
                  setSuggestions([]);
                  geocodeAddress(customAddress.trim());
                }
              }}
              className="flex-1 rounded-xl border border-surface-variant bg-surface px-4 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-teal"
            />
            <button
              onClick={() => {
                if (customAddress.trim()) {
                  setSuggestions([]);
                  geocodeAddress(customAddress.trim());
                }
              }}
              disabled={geocoding}
              className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-text-on-dark hover:bg-teal-dark disabled:opacity-50"
            >
              {geocoding ? "..." : "Go"}
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-surface-variant bg-surface shadow-lg">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(s);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-surface-variant first:rounded-t-xl last:rounded-b-xl"
                >
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
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
            <CourtCard
              key={court.id}
              court={court}
              userLocation={userLocation}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function CourtCard({
  court,
  userLocation,
}: {
  court: Court;
  userLocation: { lat: number; lng: number };
}) {
  const imageUrl = court.photoUrlCard || court.photoUrl;
  const distance = getDistanceMiles(
    userLocation.lat,
    userLocation.lng,
    court.latitude,
    court.longitude
  );

  return (
    <Link
      href={courtPath(court)}
      onClick={saveScrollPosition}
      className="flex gap-4 rounded-2xl bg-surface p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Thumbnail */}
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-surface-variant">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={court.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <h2 className="truncate text-base font-bold">{court.name}</h2>
        <p className="truncate text-sm text-teal">{court.address}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0 text-xs sm:text-sm">
          <span className="text-text-secondary">
            {court.baskets} basket{court.baskets !== 1 ? "s" : ""}
          </span>
          <span className="font-medium text-teal">{court.setting}</span>
          <span className="text-text-muted">{court.accessType}</span>
        </div>
      </div>

      {/* Distance */}
      <div className="flex flex-shrink-0 items-center">
        <span className="text-sm font-medium text-coral">
          {distance < 0.1
            ? `${Math.round(distance * 5280)} ft`
            : `${distance.toFixed(1)} mi`}
        </span>
      </div>
    </Link>
  );
}
