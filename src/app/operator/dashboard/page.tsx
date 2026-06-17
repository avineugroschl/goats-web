"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { toZonedTime } from "date-fns-tz";
import { db } from "@/lib/firebase";
import { useSelectedCourt } from "@/lib/selected-court";
import { Court } from "@/lib/types";

// IANA fallback for legacy court docs that predate the syncCourtTimeZone
// Cloud Function and don't carry a `timeZone` field.
const FALLBACK_TIME_ZONE = "America/New_York";

// Returns a Date constructed in system-local time but carrying the calendar
// year/month/day of "now in `tz`". Useful as the anchor for date-walk loops
// (`d.setDate(d.getDate() - 1)`) where we want to iterate calendar dates in
// the court's timezone. The Date's `.getFullYear/Month/Date/Day` all return
// TZ-invariant calendar values once constructed this way, so subsequent
// `formatDayKey(d)` matches the keys we computed in `loadDashboard` via
// `toZonedTime`.
function courtLocalCalendarDate(tz: string, anchor: Date = new Date()): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts: Record<string, string> = {};
  fmt.formatToParts(anchor).forEach((p) => {
    parts[p.type] = p.value;
  });
  return new Date(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10)
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Range = "7d" | "30d" | "3m";

interface UniqueVisit {
  userId: string;
  dayKey: string;     // YYYY-MM-DD in local time
  hour: number;       // 0-23 (earliest check-in hour of that day)
  dow: number;        // 0=Sun ... 6=Sat
  date: Date;         // earliest checkInTime as Date
}

interface ActiveUserProfile {
  id: string;
  username: string;
  photoUrl: string;
  isAnonymous: boolean;
}

const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "3m": 90 };
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Component ──────────────────────────────────────────────────────────────

export default function DashboardOverview() {
  const courtId = useSelectedCourt();

  const [court, setCourt] = useState<Court | null>(null);
  const [visits, setVisits] = useState<UniqueVisit[]>([]);
  const [totalRatings, setTotalRatings] = useState(0);
  const [activeUsers, setActiveUsers] = useState<ActiveUserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [checkInsRange, setCheckInsRange] = useState<Range>("30d");
  const [selectedDow, setSelectedDow] = useState<number | null>(null);
  // When a daily bar is tapped, opens the same hourly modal but in
  // "single day" mode (showing that date's counts, not a DOW average).
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  // ─── Load court + initial data ─────────────────────────────────────────
  useEffect(() => {
    if (!courtId) { setLoading(false); return; }
    loadDashboard(courtId);
  }, [courtId]);

  // ─── Live court doc subscription (drives the Right Now section) ────────
  useEffect(() => {
    if (!courtId) return;
    const unsub = onSnapshot(doc(db, "courts", courtId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Court;
        setCourt(data);
      }
    });
    return unsub;
  }, [courtId]);

  // ─── Live active-users subscription ────────────────────────────────────
  useEffect(() => {
    const ids = court?.activeUserIds ?? [];
    if (ids.length === 0) {
      setActiveUsers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const profiles = await Promise.all(
        ids.map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, "users", uid));
            if (!userSnap.exists()) return null;
            const data = userSnap.data();
            return {
              id: uid,
              username: data.username ?? "Player",
              photoUrl: data.photoUrl ?? "",
              isAnonymous: Boolean(data.isAnonymous),
            } as ActiveUserProfile;
          } catch {
            return null;
          }
        })
      );
      if (!cancelled) {
        setActiveUsers(profiles.filter(Boolean) as ActiveUserProfile[]);
      }
    })();
    return () => { cancelled = true; };
  }, [court?.activeUserIds]);

  async function loadDashboard(cId: string) {
    setLoading(true);
    try {
      // Pull court doc once for the initial render (the live listener takes
      // over after this). We need the court's `timeZone` here too so visit
      // dedupe / DOW / hour assignment all happen in the court's local time
      // rather than the operator's browser locale — otherwise a PST-based
      // operator viewing an NYC court sees 1am NYC sessions land in the
      // previous day's column.
      const courtSnap = await getDoc(doc(db, "courts", cId));
      let courtTimeZone = FALLBACK_TIME_ZONE;
      if (courtSnap.exists()) {
        const courtData = { id: courtSnap.id, ...courtSnap.data() } as Court;
        setCourt(courtData);
        if (courtData.timeZone) courtTimeZone = courtData.timeZone;
      }

      // Pull last 90 days of visits, deduplicate to one earliest check-in per
      // (user, day).
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      ninetyDaysAgo.setHours(0, 0, 0, 0);

      // orderBy("checkInTime", "desc") is required so this query uses the
      // existing courtVisits composite index (courtId ASC + checkInTime DESC).
      // We dedupe to earliest-per-day in memory, so the order doesn't matter
      // for the aggregation.
      const visitsQuery = query(
        collection(db, "courtVisits"),
        where("courtId", "==", cId),
        where("checkInTime", ">=", Timestamp.fromDate(ninetyDaysAgo)),
        orderBy("checkInTime", "desc"),
        limit(5000)
      );
      const visitsSnap = await getDocs(visitsQuery);

      // Build unique-per-(user, day) set, taking the earliest check-in.
      // Day key is computed in the court's timezone via `toZonedTime`, which
      // returns a Date whose local methods (getFullYear/Month/Date/Day/Hours)
      // return values for the target TZ. The `date` field on UniqueVisit
      // stays as the raw UTC instant so cross-day comparisons (`v.date >=
      // ninetyDaysAgo`) still use real time, not local-time wall clock.
      const earliestByKey = new Map<string, { date: Date; zoned: Date; userId: string }>();
      visitsSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.hiddenFromActivity === true) return;
        const ts = data.checkInTime as Timestamp | undefined;
        if (!ts) return;
        const date = ts.toDate();
        const zoned = toZonedTime(date, courtTimeZone);
        const dayKey = formatDayKey(zoned);
        const userId = data.userId as string;
        const key = `${userId}|${dayKey}`;
        const existing = earliestByKey.get(key);
        if (!existing || date < existing.date) {
          earliestByKey.set(key, { date, zoned, userId });
        }
      });

      const unique: UniqueVisit[] = Array.from(earliestByKey.entries()).map(
        ([key, val]) => {
          const [userId, dayKey] = key.split("|");
          return {
            userId,
            dayKey,
            hour: val.zoned.getHours(),
            dow: val.zoned.getDay(),
            date: val.date,
          };
        }
      );

      setVisits(unique);

      // Peer ratings count
      const ratingsQuery = query(
        collection(db, "court_ratings"),
        where("courtId", "==", cId),
        limit(2000)
      );
      const ratingsSnap = await getDocs(ratingsQuery);
      setTotalRatings(ratingsSnap.size);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  // ─── Derived data ──────────────────────────────────────────────────────

  // Court's IANA timezone — falls back to NY for legacy docs without one.
  // All date/DOW/hour math below uses this so an operator in PST viewing
  // an NYC court sees data aligned to NY local time, not browser local.
  const timeZone = court?.timeZone ?? FALLBACK_TIME_ZONE;

  // Time series for the selected range
  const timeSeries = useMemo(() => {
    const days = RANGE_DAYS[checkInsRange];
    const today = courtLocalCalendarDate(timeZone);

    const points: { dayKey: string; label: string; count: number; date: Date }[] = [];
    const counts = new Map<string, number>();
    visits.forEach((v) => counts.set(v.dayKey, (counts.get(v.dayKey) ?? 0) + 1));

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = formatDayKey(d);
      points.push({
        dayKey: key,
        label: d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        count: counts.get(key) ?? 0,
        date: d,
      });
    }
    return points;
  }, [visits, checkInsRange, timeZone]);

  // Day-of-week averages over the last 90 days
  const dayOfWeekAvg = useMemo(() => {
    // For each day-of-week, count occurrences in the 90-day window
    // (a Tuesday could appear ~13 times in 90 days)
    const dowCounts = new Array(7).fill(0); // total visits per dow
    const dowOccurrences = new Array(7).fill(0); // how many of that weekday in window

    const today = courtLocalCalendarDate(timeZone);
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);

    // Count weekday occurrences in [ninetyDaysAgo, today] inclusive.
    // d.getDay() returns the calendar DOW of the constructed Date, which is
    // TZ-invariant — equivalent to the court-local DOW since the anchor was
    // built from court-local year/month/day.
    for (let d = new Date(ninetyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
      dowOccurrences[d.getDay()]++;
    }

    visits.forEach((v) => {
      // Only count visits within the 90-day window
      if (v.date >= ninetyDaysAgo) {
        dowCounts[v.dow]++;
      }
    });

    return DOW_LABELS.map((label, dow) => ({
      label,
      dow,
      avg: dowOccurrences[dow] > 0
        ? Math.round((dowCounts[dow] / dowOccurrences[dow]) * 10) / 10
        : 0,
      total: dowCounts[dow],
    }));
  }, [visits, timeZone]);

  // Hourly breakdown for the popup (selected day-of-week)
  const hourlyForSelectedDow = useMemo(() => {
    if (selectedDow === null) return [];

    // Determine operating hours for this day
    const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][selectedDow];
    const daySchedule = court?.schedule?.[dayName];
    const startHour = daySchedule?.open ? parseInt(daySchedule.open.split(":")[0]) : 0;
    const endHourRaw = daySchedule?.close ? parseInt(daySchedule.close.split(":")[0]) : 23;
    const endHour = endHourRaw < startHour ? 23 : endHourRaw;

    // Count earliest-of-day visits per hour for this day-of-week
    const hourCounts: Record<number, number> = {};
    let dowOccurrences = 0;

    const today = courtLocalCalendarDate(timeZone);
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);

    for (let d = new Date(ninetyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === selectedDow) dowOccurrences++;
    }

    visits.forEach((v) => {
      if (v.dow === selectedDow && v.date >= ninetyDaysAgo) {
        hourCounts[v.hour] = (hourCounts[v.hour] ?? 0) + 1;
      }
    });

    const data: { hour: number; label: string; avg: number }[] = [];
    for (let h = startHour; h <= endHour; h++) {
      data.push({
        hour: h,
        label: formatHour(h),
        avg: dowOccurrences > 0
          ? Math.round(((hourCounts[h] ?? 0) / dowOccurrences) * 10) / 10
          : 0,
      });
    }
    return data;
  }, [selectedDow, visits, court?.schedule, timeZone]);

  const todayCount = useMemo(() => {
    const todayKey = formatDayKey(courtLocalCalendarDate(timeZone));
    return visits.filter((v) => v.dayKey === todayKey).length;
  }, [visits, timeZone]);

  // Hourly breakdown for a single specific calendar day (court-local).
  // Drives the modal when an operator taps a day in the "Daily Check-ins"
  // bar chart. Values are raw counts, not averages — it's one day.
  const hourlyForSelectedDay = useMemo(() => {
    if (selectedDayKey === null) return [];
    const hourCounts: Record<number, number> = {};
    visits.forEach((v) => {
      if (v.dayKey === selectedDayKey) {
        hourCounts[v.hour] = (hourCounts[v.hour] ?? 0) + 1;
      }
    });
    const data: { hour: number; label: string; value: number }[] = [];
    for (let h = 0; h < 24; h++) {
      data.push({ hour: h, label: formatHour(h), value: hourCounts[h] ?? 0 });
    }
    return data;
  }, [selectedDayKey, visits]);

  // Human-friendly label for the selected day, e.g. "Mon, Jun 16" — derived
  // from the dayKey so it always matches the court-local calendar date the
  // operator tapped.
  const selectedDayLabel = useMemo(() => {
    if (!selectedDayKey) return "";
    const [y, m, d] = selectedDayKey.split("-").map((s) => parseInt(s, 10));
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [selectedDayKey]);

  const totalUnique = visits.length;

  // ─── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-dash-surface" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-dash-surface" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-dash-surface" />
      </div>
    );
  }

  if (!courtId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md text-center">
          <h2 className="font-display mb-2 text-2xl font-bold text-white">No Court Assigned Yet</h2>
          <p className="text-sm leading-relaxed text-white/40">
            Your application has been approved but your court hasn&apos;t been linked yet.
            This should happen shortly.
          </p>
        </div>
      </div>
    );
  }

  const liveCount = court?.activeUserIds?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-white">{court?.name ?? "Dashboard"}</h1>
        <p className="text-sm text-dash-text-muted">{court?.address}</p>
      </div>

      {/* RIGHT NOW */}
      <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
        <div className="mb-4 flex items-center gap-3">
          {liveCount > 0 ? (
            <>
              <div className="h-2.5 w-2.5 rounded-full bg-teal animate-pulse" />
              <h3 className="font-display text-sm font-bold uppercase tracking-widest text-teal">
                {liveCount} Player{liveCount !== 1 ? "s" : ""} Right Now
              </h3>
            </>
          ) : (
            <>
              <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white/40">
                No one at the court right now
              </h3>
            </>
          )}
        </div>

        {activeUsers.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {activeUsers.map((user) => (
              <ActiveUserAvatar key={user.id} user={user} />
            ))}
          </div>
        )}
      </div>

      {/* STAT CARDS */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Today" value={todayCount} sub="unique check-ins" />
        <StatCard label="Last 90 Days" value={totalUnique} sub="unique check-ins" />
        <StatCard label="Peer Ratings" value={totalRatings} sub="given at this court" />
      </div>

      {/* DAILY CHECK-INS — bar per day, tap to drill into that day's hours */}
      <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white/40">
            Unique Check-ins per Day
          </h3>
          <RangeToggle value={checkInsRange} onChange={setCheckInsRange} />
        </div>
        <p className="mb-6 text-xs text-dash-text-muted">
          Tap a day for hourly breakdown
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#777777"
                tick={{ fontSize: 11 }}
                interval={Math.max(0, Math.floor(timeSeries.length / 8))}
              />
              <YAxis
                stroke="#777777"
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.max(dataMax, 1)]}
              />
              <Tooltip
                cursor={{ fill: "#3ECFB210" }}
                contentStyle={{
                  background: "#1A1A1A",
                  border: "1px solid #2A2A2A",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#E5E5E5", fontWeight: 600 }}
                itemStyle={{ color: "#3ECFB2" }}
                formatter={(v) => [v as number, "check-ins"]}
              />
              <Bar
                dataKey="count"
                fill="#3ECFB2"
                radius={[6, 6, 0, 0]}
                cursor="pointer"
                onClick={(payload: unknown) => {
                  const p = payload as { dayKey?: string } | undefined;
                  if (p?.dayKey) setSelectedDayKey(p.dayKey);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DAY OF WEEK AVERAGES */}
      <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white/40">
            Avg Check-ins by Day of Week
          </h3>
        </div>
        <p className="mb-6 text-xs text-dash-text-muted">
          Last 90 days · tap a day for hourly breakdown
        </p>
        {(() => {
          const maxAvg = Math.max(...dayOfWeekAvg.map((d) => d.avg), 1);
          return (
            <div className="flex items-end gap-3" style={{ height: 180 }}>
              {dayOfWeekAvg.map((d) => (
                <button
                  key={d.dow}
                  onClick={() => setSelectedDow(d.dow)}
                  className="group flex flex-1 flex-col items-center gap-2 transition-transform hover:scale-105"
                >
                  <span className="text-xs font-medium text-teal opacity-0 transition-opacity group-hover:opacity-100">
                    {d.avg}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-teal/40 to-teal transition-all"
                    style={{
                      height: `${Math.max((d.avg / maxAvg) * 140, 4)}px`,
                    }}
                  />
                  <span className="text-[11px] font-medium text-dash-text-muted group-hover:text-teal">
                    {d.label}
                  </span>
                </button>
              ))}
            </div>
          );
        })()}
      </div>

      {/* FOLLOWERS CHART */}
      <FollowersChart courtId={courtId} />

      {/* HOURLY BREAKDOWN MODAL — drilldown from either a DOW or a date bar */}
      {selectedDow !== null && (
        <HourlyModal
          title={`${DOW_LABELS[selectedDow]} — Hourly`}
          subtitle="Average unique check-ins per hour during operating hours"
          emptyMessage={`No check-ins recorded on ${DOW_LABELS[selectedDow]}s yet`}
          data={hourlyForSelectedDow.map((d) => ({ ...d, value: d.avg }))}
          onClose={() => setSelectedDow(null)}
        />
      )}
      {selectedDayKey !== null && (
        <HourlyModal
          title={selectedDayLabel}
          subtitle="Unique check-ins per hour"
          emptyMessage="No check-ins recorded for this day"
          data={hourlyForSelectedDay}
          onClose={() => setSelectedDayKey(null)}
        />
      )}
    </div>
  );
}

// ─── Components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="rounded-2xl border border-dash-border bg-dash-surface p-5">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-dash-text-muted">{label}</p>
      <p className="font-display text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-dash-text-muted">{sub}</p>
    </div>
  );
}

function RangeToggle({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const ranges: { id: Range; label: string }[] = [
    { id: "7d", label: "7D" },
    { id: "30d", label: "30D" },
    { id: "3m", label: "3M" },
  ];
  return (
    <div className="flex gap-1 rounded-lg bg-dash-bg p-1">
      {ranges.map((r) => (
        <button
          key={r.id}
          onClick={() => onChange(r.id)}
          className={`rounded-md px-3 py-1.5 font-display text-xs font-bold transition-all ${
            value === r.id
              ? "bg-teal text-surface-dark"
              : "text-dash-text-muted hover:text-dash-text"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function ActiveUserAvatar({ user }: { user: ActiveUserProfile }) {
  const initial = (user.username || "?").charAt(0).toUpperCase();
  return (
    <div className="flex w-16 flex-col items-center gap-2">
      {user.isAnonymous ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-dash-bg text-xl font-bold text-white/40">
          ?
        </div>
      ) : user.photoUrl ? (
        <img
          src={user.photoUrl}
          alt={user.username}
          className="h-14 w-14 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal/20 text-lg font-bold text-teal">
          {initial}
        </div>
      )}
      <span className="line-clamp-1 text-center text-xs text-white/60">
        {user.isAnonymous ? "Anonymous" : user.username}
      </span>
    </div>
  );
}

function HourlyModal({
  title,
  subtitle,
  emptyMessage,
  data,
  onClose,
}: {
  title: string;
  subtitle: string;
  emptyMessage: string;
  data: { hour: number; label: string; value: number }[];
  onClose: () => void;
}) {
  const allZero = data.length > 0 && data.every((d) => d.value === 0);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-dash-border bg-dash-surface p-6 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-white">{title}</h3>
            <p className="text-xs text-dash-text-muted">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-dash-border px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-coral/40 hover:text-coral"
          >
            Close
          </button>
        </div>

        {data.length === 0 ? (
          <div className="py-12 text-center text-sm text-white/30">
            No operating hours set for this day. Set them under My Court → Schedule.
          </div>
        ) : allZero ? (
          <div className="rounded-xl border border-dash-border bg-dash-bg py-12 text-center">
            <p className="font-display text-sm font-bold text-white/40">
              {emptyMessage}
            </p>
            <p className="mt-2 text-xs text-white/30">
              Showing hours {data[0].label} – {data[data.length - 1].label}.
              Once players check in, you&apos;ll see the hourly distribution here.
            </p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                <XAxis dataKey="label" stroke="#777777" tick={{ fontSize: 10 }} />
                <YAxis
                  stroke="#777777"
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                  domain={[0, (dataMax: number) => Math.max(dataMax, 1)]}
                />
                <Tooltip
                  cursor={{ fill: "#3ECFB210" }}
                  contentStyle={{
                    background: "#1A1A1A",
                    border: "1px solid #2A2A2A",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v) => [v as number, "check-ins"]}
                />
                <Bar dataKey="value" fill="#3ECFB2" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function FollowersChart({ courtId }: { courtId: string }) {
  const [range, setRange] = useState<Range>("30d");
  const [followers, setFollowers] = useState<{ followedAt: Date; unfollowedAt?: Date; active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "courts", courtId, "followers"),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            followedAt: data.followedAt?.toDate?.() ?? new Date(),
            unfollowedAt: data.unfollowedAt?.toDate?.(),
            active: data.active !== false,
          };
        });
        setFollowers(list);
        setLoading(false);
      }
    );
    return unsub;
  }, [courtId]);

  const chartData = useMemo(() => {
    const days = RANGE_DAYS[range];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const points: { label: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const endOfDay = new Date(d);
      endOfDay.setHours(23, 59, 59, 999);

      // Count how many followers were active as of end of this day
      const count = followers.filter((f) => {
        if (f.followedAt > endOfDay) return false; // hadn't followed yet
        if (!f.active && f.unfollowedAt && f.unfollowedAt <= endOfDay) return false; // unfollowed before this day
        return true;
      }).length;

      points.push({
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count,
      });
    }
    return points;
  }, [followers, range]);

  const currentTotal = followers.filter((f) => f.active).length;

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-dash-surface" />;
  }

  return (
    <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white/40">
            Followers
          </h3>
          <span className="font-display text-lg font-bold text-coral">{currentTotal}</span>
        </div>
        <RangeToggle value={range} onChange={setRange} />
      </div>
      {currentTotal === 0 && followers.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-white/30">
            No followers yet. Enable notifications from the Notifications tab to let players opt in.
          </p>
        </div>
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis
                dataKey="label"
                stroke="#777777"
                tick={{ fontSize: 11 }}
                interval={Math.max(0, Math.floor(chartData.length / 8))}
              />
              <YAxis
                stroke="#777777"
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.max(dataMax, 1)]}
              />
              <Tooltip
                contentStyle={{
                  background: "#1A1A1A",
                  border: "1px solid #2A2A2A",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#E5E5E5", fontWeight: 600 }}
                itemStyle={{ color: "#FF7F50" }}
                formatter={(v) => [v as number, "followers"]}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#FF7F50"
                strokeWidth={2}
                dot={{ fill: "#FF7F50", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}
