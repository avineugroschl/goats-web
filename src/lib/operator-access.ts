// Who gets into the operator dashboard, and why.
//
// There are four ways an operator can have access — a paid Stripe
// subscription, a subscription that's cancelling but not yet lapsed, a
// permanent comp (`freeAccess`), and a free trial (`trialEndsAt` in the
// future) — and four places that need to know: the dashboard gate, the
// settings page, the court switcher, and the manage-courts list. Those
// checks used to be written out by hand at each call site, which is how
// they drift apart. Every one of them reads this file instead.

/** Length of a free trial granted at approval, in days. */
export const TRIAL_DAYS = 30;

/**
 * The subset of an operator record the access rules care about. Both
 * `OperatorProfile` and the loose prop bags passed around the dashboard
 * (court switcher, manage-courts) satisfy this structurally.
 */
export interface OperatorAccessFields {
  subscriptionStatus?: "active" | "past_due" | "cancelled" | "cancelling" | "none";
  subscriptionQuantity?: number;
  freeAccess?: boolean;
  trialEndsAt?: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function trialEndMs(op: OperatorAccessFields | null | undefined): number | null {
  if (!op?.trialEndsAt) return null;
  const ms = new Date(op.trialEndsAt).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** True while a granted trial has not yet lapsed. */
export function isTrialActive(op: OperatorAccessFields | null | undefined): boolean {
  const ms = trialEndMs(op);
  return ms !== null && ms > Date.now();
}

/**
 * Whole days left on the trial, rounded up so the last partial day still
 * reads as "1 day left". Zero once the trial has lapsed or was never granted.
 */
export function trialDaysLeft(op: OperatorAccessFields | null | undefined): number {
  const ms = trialEndMs(op);
  if (ms === null) return 0;
  return Math.max(0, Math.ceil((ms - Date.now()) / MS_PER_DAY));
}

/** Paying now, or lapsing at period end but still inside it. */
export function hasPaidAccess(op: OperatorAccessFields | null | undefined): boolean {
  return op?.subscriptionStatus === "active" || op?.subscriptionStatus === "cancelling";
}

/**
 * On a trial with nothing else paying for access. This — not isTrialActive —
 * is what the trial banner and the trial copy should key off: converting
 * mid-trial leaves trialEndsAt sitting in the future, and an operator who has
 * started paying should stop being told they're on a trial.
 */
export function isTrialOnly(op: OperatorAccessFields | null | undefined): boolean {
  return isTrialActive(op) && !hasPaidAccess(op) && !op?.freeAccess;
}

/**
 * True when an approved operator has nothing keeping the dashboard open and
 * should see the paywall. Callers still decide whether the gate applies at
 * all (application status, PAYMENT_GATING_ENABLED).
 */
export function needsSubscription(op: OperatorAccessFields | null | undefined): boolean {
  return !hasPaidAccess(op) && !op?.freeAccess && !isTrialActive(op);
}

/**
 * How many of an operator's courts are unlocked. Comped and trialing
 * operators get all of them: they have no Stripe subscription whose quantity
 * could be raised, so sending them to the activate-court flow would dead-end.
 */
export function courtSeatLimit(op: OperatorAccessFields | null | undefined): number {
  if (op?.freeAccess || isTrialActive(op)) return Infinity;
  return op?.subscriptionQuantity ?? 1;
}

/** ISO timestamp for a trial starting now. Stored on `operators/{uid}.trialEndsAt`. */
export function trialEndingInDays(days: number = TRIAL_DAYS): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString();
}

/** "October 14, 2026" — matches how subscription dates already render. */
export function formatAccessDate(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
