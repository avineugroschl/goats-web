export interface Court {
  id: string;
  name: string;
  address: string;
  baskets: number;
  setting: string;
  accessType: string;
  latitude: number;
  longitude: number;
  activeUserIds: string[];
  hasLights: boolean;
  hoursOfOperation: string;
  courtCondition: string;
  threePointLine: string;
  goatsTake: string;
  photoUrl: string;
  photoUrlCard: string;
  photoUrlFull: string;
  phoneNumber: string;
  // Operator fields (optional — only present on operator-managed courts)
  operatorIds?: string[];
  verified?: boolean;
  reservationsEnabled?: boolean;
  reservationSlots?: Record<string, TimeSlot[]>;
  schedule?: Record<string, DaySchedule | null>;
  scheduleEnabled?: boolean;
  scheduleOverrides?: Record<string, ScheduleOverride>;
  notificationsEnabled?: boolean;
  promo?: CourtPromo | null;
  operatorBanner?: CourtBanner | null;
  // Publish gating: only set on operator-created courts. Missing/true = visible
  // in the apps; false = draft, hidden from app queries (filtered client-side).
  // Admin-created courts and user-submitted approved courts never set this.
  published?: boolean;
  // Stamped by admin approval. Used to order operatorCourtIds deterministically
  // so the activation lock (first N courts where N = subscriptionQuantity) is
  // stable across reloads. Missing on legacy/admin-created courts — those sort first.
  approvedAt?: unknown;
}

export interface TimeSlot {
  start: string; // "18:00"
  end: string;   // "19:00"
  price: number; // cents
}

export interface DaySchedule {
  open: string;  // "06:00"
  close: string; // "22:00"
}

export interface ScheduleOverride {
  closed?: boolean;
  open?: string;   // "10:00" — custom hours for this date
  close?: string;  // "18:00"
}

export interface CourtPromo {
  active: boolean;
  text: string;
  updatedAt?: unknown;
  expiresAt?: unknown;
}

export interface CourtBanner {
  text: string;
  updatedAt: unknown;
}

export interface OperatorApplication {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  type: "new_court" | "claim_existing";
  courtId?: string;
  courtData?: NewCourtData;
  businessName: string;
  verificationInfo: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: unknown;
  reviewedAt?: unknown;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface NewCourtData {
  // Pre-generated UUID assigned at signup time so the photo URL is final
  // from the start (Storage paths reference this id).
  pendingCourtId?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  setting: string;
  accessType: string;
  baskets: number;
  hasLights: boolean;
  hoursOfOperation: string;
  courtCondition: string;
  threePointLine: string;
  phoneNumber: string;
  description: string;
  // Photo URLs uploaded at signup time (optional). Stored at
  // court_photos/{pendingCourtId}_card.webp + _full.webp so the same paths
  // become live when the admin approves and creates the court doc.
  photoUrlCard?: string;
  photoUrlFull?: string;
}

export interface Reservation {
  id: string;
  courtId: string;
  operatorId: string;
  userId: string | null;
  userName: string | null;
  date: string;      // "2026-04-15"
  startTime: string;  // "18:00"
  endTime: string;    // "19:00"
  price: number;      // cents (0 for manual/free)
  status: "pending_approval" | "confirmed" | "rejected" | "cancelled" | "expired" | "manual";
  stripePaymentIntentId?: string;
  operatorNote?: string;
  rejectionReason?: string;
  createdAt: unknown;
  updatedAt: unknown;
  confirmedAt?: unknown;
  cancelledAt?: unknown;
}

// Record stored in the `operators` collection. This is the operator identity,
// completely separate from the player `users/{uid}` doc. A single Firebase Auth
// user can have both (a player account in `users` AND an operator account in
// `operators`), or just one of them.
export interface OperatorRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string; // Combined "First Last" for display + backwards compat
  businessName?: string;
  operatorCourtIds?: string[];
  subscriptionStatus?: "active" | "past_due" | "cancelled" | "cancelling" | "none";
  // Mirror of the Stripe subscription quantity (number of seats / courts paid for).
  // Synced by the Stripe webhook on customer.subscription.updated. First N courts
  // (ordered by approvedAt ASC) are active; the rest are locked pending activation.
  subscriptionQuantity?: number;
  applicationStatus?: "pending" | "approved" | "rejected";
  subscriptionExpiresAt?: string;
  createdAt?: unknown;
}

// Merged profile exposed by the web auth context. Combines the operator record
// (from `operators/{uid}`) with the platform-admin flag (from `users/{uid}.isAdmin`).
// `isOperator` tells the UI whether this user has an operator record at all.
export interface OperatorProfile {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  isAdmin: boolean;
  isOperator: boolean;
  operatorCourtIds?: string[];
  subscriptionStatus?: "active" | "past_due" | "cancelled" | "cancelling" | "none";
  // Number of court seats covered by the current subscription.
  // First N operatorCourtIds (sorted by approvedAt ASC) are active; rest are locked.
  // freeAccess operators are treated as having unlimited seats.
  subscriptionQuantity?: number;
  subscriptionExpiresAt?: string;
  applicationStatus?: "pending" | "approved" | "rejected";
  freeAccess?: boolean;
}
