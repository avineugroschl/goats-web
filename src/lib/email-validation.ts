// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mailcheck = require("mailcheck");
import disposableDomains from "disposable-email-domains";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const disposableSet = new Set(disposableDomains as string[]);

/** Basic syntax validation — stricter than just checking for "@" */
export function isValidEmailSyntax(email: string): boolean {
  // Must have local@domain.tld, no spaces, at least 2-char TLD
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Check if the domain is a known disposable/temp email provider */
export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().split("@")[1]?.toLowerCase();
  return domain ? disposableSet.has(domain) : false;
}

/** Run mailcheck and return a suggestion, or null */
export function getEmailSuggestion(
  email: string
): { address: string; domain: string; full: string } | null {
  let result: { address: string; domain: string; full: string } | null = null;
  Mailcheck.run({
    email: email.trim(),
    suggested: (suggestion: { address: string; domain: string; full: string }) => {
      result = suggestion;
    },
    empty: () => {
      result = null;
    },
  });
  return result;
}

/** Server-side MX record check via Cloud Function */
export async function checkMxRecord(email: string): Promise<boolean> {
  try {
    const checkMx = httpsCallable<{ email: string }, { valid: boolean }>(
      functions,
      "checkEmailMx"
    );
    const result = await checkMx({ email: email.trim() });
    return result.data.valid;
  } catch {
    // If the function fails, don't block signup
    return true;
  }
}
