// Feature flags for the GOATS web app.
//
// Flip these to gate features that aren't ready to ship. Code paths behind a
// disabled flag should remain in the codebase but be unreachable from the UI
// so they can be re-enabled instantly without rebuilding.

export const RESERVATIONS_ENABLED = false;

// When true, approved operators must have an active subscription before they
// can access the dashboard. Currently false because Stripe isn't wired yet —
// the gating UI exists but is bypassed.
export const PAYMENT_GATING_ENABLED = true;
