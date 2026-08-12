import { initializeApp, getApps } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAw7GKyo_FxSL0EiapGNYJoOsfXF2Jvqf0",
  authDomain: "goat-db.firebaseapp.com",
  databaseURL: "https://goat-db-default-rtdb.firebaseio.com",
  projectId: "goat-db",
  storageBucket: "goat-db.firebasestorage.app",
  messagingSenderId: "107746273734",
  appId: "1:107746273734:web:1f60c66f2f3c476c5c6ac7",
  measurementId: "G-2DV6X1DCW0",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// App Check (reCAPTCHA Enterprise). Inert until
// NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY is set in Vercel env — register
// the web app under Firebase console → App Check first. Browser-only:
// reCAPTCHA can't run during SSR/build (server reads use the Admin SDK,
// which doesn't need App Check).
// For local dev after enforcement, set NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN to a
// debug token registered in the console.
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
if (typeof window !== "undefined" && recaptchaSiteKey) {
  if (process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN) {
    (
      self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
