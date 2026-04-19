"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  setDoc,
  addDoc,
  collection,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Court } from "@/lib/types";
import { uploadCourtMainPhoto } from "@/lib/processImage";
import {
  isValidEmailSyntax,
  isDisposableEmail,
  getEmailSuggestion,
  checkMxRecord,
} from "@/lib/email-validation";

type Step = "account" | "court" | "review";
type CourtType = "new_court" | "claim_existing";

interface AccountData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface NewCourtFormData {
  name: string;
  address: string;
  latitude: string;  // string for input control
  longitude: string;
  setting: string;
  accessType: string;
  baskets: string;
  hasLights: boolean;
  hoursOfOperation: string;
  courtCondition: string;
  threePointLine: string;
  phoneNumber: string;
  description: string;
}

export default function OperatorSignup() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>("account");
  const [courtType, setCourtType] = useState<CourtType>("new_court");
  const [error, setError] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  // Redirect if already signed in as an operator
  useEffect(() => {
    if (loading) return;
    if (user && profile?.isOperator) {
      router.push("/operator/dashboard");
    }
  }, [loading, user, profile, router]);
  const [submitting, setSubmitting] = useState(false);

  // Pre-generated UUID for the future court doc. Used as the storage key for
  // photo uploads at signup so the URLs are final from the moment they upload.
  // The admin approval flow will create the court doc with this exact ID.
  const [pendingCourtId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `pending_${Date.now()}`
  );

  // Account data
  const [account, setAccount] = useState<AccountData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  // New court data
  const [courtData, setCourtData] = useState<NewCourtFormData>({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    setting: "Outdoor",
    accessType: "Public",
    baskets: "2",
    hasLights: false,
    hoursOfOperation: "",
    courtCondition: "Okay",
    threePointLine: "None",
    phoneNumber: "",
    description: "",
  });

  // Photo upload
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<{ cardUrl: string; fullUrl: string } | null>(null);

  // Claim existing court
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState("");
  const [courtSearch, setCourtSearch] = useState("");
  const [verificationInfo, setVerificationInfo] = useState("");
  const [loadingCourts, setLoadingCourts] = useState(false);

  // Load courts for claim flow
  useEffect(() => {
    if (courtType === "claim_existing" && courts.length === 0) {
      loadCourts();
    }
  }, [courtType]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCourts() {
    setLoadingCourts(true);
    try {
      const snap = await getDocs(collection(db, "courts"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Court));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCourts(list);
    } finally {
      setLoadingCourts(false);
    }
  }

  const filteredCourts = courts.filter(
    (c) =>
      c.name.toLowerCase().includes(courtSearch.toLowerCase()) ||
      c.address.toLowerCase().includes(courtSearch.toLowerCase())
  );

  async function validateAccount(): Promise<boolean> {
    if (!account.firstName.trim()) { setError("First name is required."); return false; }
    if (!account.lastName.trim()) { setError("Last name is required."); return false; }
    if (!account.email.trim()) { setError("Email is required."); return false; }

    // 1. Syntax validation
    if (!isValidEmailSyntax(account.email)) {
      setError("Please enter a valid email address.");
      return false;
    }

    // 2. Disposable email check
    if (isDisposableEmail(account.email)) {
      setError("Disposable email addresses are not allowed. Please use a real email.");
      return false;
    }

    // 3. Mailcheck typo suggestion (non-blocking — user dismissed it, so proceed)
    const suggestion = getEmailSuggestion(account.email);
    if (suggestion && emailSuggestion !== suggestion.full) {
      // First time seeing this suggestion — show it, don't block
      setEmailSuggestion(suggestion.full);
      setError("");
      return false;
    }

    if (!account.phone.trim()) { setError("Phone number is required."); return false; }
    if (account.password.length < 6) { setError("Password must be at least 6 characters."); return false; }
    if (account.password !== account.confirmPassword) { setError("Passwords don't match."); return false; }

    // 4. MX record check
    const mxValid = await checkMxRecord(account.email);
    if (!mxValid) {
      setError("This email domain doesn't appear to exist. Please check your email address.");
      return false;
    }

    // Check if an operator account with this email already exists
    try {
      const snap = await getDocs(
        query(collection(db, "operators"), where("email", "==", account.email.trim()), limit(1))
      );
      if (!snap.empty) {
        setError("An operator account with this email already exists. Sign in instead.");
        return false;
      }
    } catch (e) {
      console.error("Email check failed:", e);
    }

    // Validate email + password against Firebase Auth NOW so errors show at
    // step 1, not at submit. Try creating the account first — if the email
    // already exists, try signing in to validate the password.
    if (!user) {
      try {
        await createUserWithEmailAndPassword(auth, account.email, account.password);
        // New email — account created successfully, user is now signed in
      } catch (createErr: unknown) {
        const code = (createErr as { code?: string })?.code;
        if (code === "auth/email-already-in-use") {
          // Email exists — validate the password by signing in
          try {
            await signInWithEmailAndPassword(auth, account.email, account.password);
            // Password correct — user is now signed in
          } catch {
            setError("This email already has a G.O.A.T.S account. If you signed up with Google or Apple, use \"Forgot Password\" in the app to set a password first. Otherwise, make sure you're using your existing password.");
            return false;
          }
        } else if (code === "auth/invalid-email") {
          setError("Invalid email address.");
          return false;
        } else {
          setError("Something went wrong. Please try again.");
          return false;
        }
      }
    }

    return true;
  }

  function validateCourt(): boolean {
    if (courtType === "new_court") {
      // Per requirements: only name, address, and description are required at signup.
      // Lat/long, photo, and all other fields are optional here — operator
      // completes the rest from the My Court page before publishing.
      if (!courtData.name.trim()) { setError("Court name is required."); return false; }
      if (!courtData.address.trim()) { setError("Address is required."); return false; }
      if (!courtData.description.trim()) { setError("Description is required."); return false; }
    } else {
      if (!selectedCourtId) { setError("Select a court to claim."); return false; }
      if (!verificationInfo.trim()) { setError("Please explain how you're connected to this court."); return false; }
    }
    return true;
  }

  async function goToStep(next: Step) {
    setError("");
    if (next === "court" && step === "account") {
      const valid = await validateAccount();
      if (!valid) return;
    }
    if (next === "review" && step === "court" && !validateCourt()) return;
    setStep(next);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setUploadedPhotoUrls(null); // invalidate previous upload
  }

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    try {
      let uid = user?.uid;

      // Create Firebase Auth account. If the email is already in use (e.g.,
      // the user has a player account), automatically sign in instead.
      if (!uid) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, account.email, account.password);
          uid = cred.user.uid;
        } catch (createErr: unknown) {
          const code = (createErr as { code?: string })?.code;
          if (code === "auth/email-already-in-use") {
            // Email exists — sign in with the same password
            try {
              const cred = await signInWithEmailAndPassword(auth, account.email, account.password);
              uid = cred.user.uid;
            } catch (signInErr: unknown) {
              const signInCode = (signInErr as { code?: string })?.code;
              if (signInCode === "auth/wrong-password" || signInCode === "auth/invalid-credential") {
                setError("This email already has a G.O.A.T.S account. If you signed up with Google or Apple, use \"Forgot Password\" in the app to set a password first. Otherwise, make sure you're using your existing password.");
              } else {
                setError("Something went wrong. Please try again.");
              }
              setSubmitting(false);
              return;
            }
          } else {
            throw createErr;
          }
        }
      }

      // Upload the main photo if one was chosen. Storage paths use the
      // pre-generated court id so the URLs are final from now on.
      let photoUrlCard: string | undefined;
      let photoUrlFull: string | undefined;
      if (courtType === "new_court" && photoFile) {
        setUploadingPhoto(true);
        try {
          if (uploadedPhotoUrls) {
            photoUrlCard = uploadedPhotoUrls.cardUrl;
            photoUrlFull = uploadedPhotoUrls.fullUrl;
          } else {
            const urls = await uploadCourtMainPhoto(pendingCourtId, photoFile);
            photoUrlCard = urls.cardUrl;
            photoUrlFull = urls.fullUrl;
            setUploadedPhotoUrls(urls);
          }
        } finally {
          setUploadingPhoto(false);
        }
      }

      const fullName = `${account.firstName} ${account.lastName}`.trim();

      // Create the operator record. This is what gates access to /operator/*.
      await setDoc(doc(db, "operators", uid!), {
        id: uid,
        email: account.email || user?.email || "",
        firstName: account.firstName,
        lastName: account.lastName,
        username: fullName || account.email || "",
        phone: account.phone.trim(),
        operatorCourtIds: [],
        subscriptionStatus: "none",
        applicationStatus: "pending",
        createdAt: serverTimestamp(),
      });

      // Create a user doc if one doesn't already exist, so the operator
      // can also sign in on the mobile apps (which require a users/{uid} doc).
      const userDocRef = doc(db, "users", uid!);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        // Generate a unique username from the operator's name
        let username = account.firstName.trim() || account.email.split("@")[0];
        const usernameQuery = query(
          collection(db, "users"),
          where("username", "==", username),
          limit(1)
        );
        const usernameSnap = await getDocs(usernameQuery);
        if (!usernameSnap.empty) {
          username = `${username}${uid!.slice(0, 4)}`;
        }

        await setDoc(userDocRef, {
          id: uid,
          email: account.email || user?.email || "",
          username,
          photoUrl: "",
          profileBlurb: "",
          selfRatingIq: 0,
          selfRatingPassing: 0,
          selfRatingDefense: 0,
          selfRatingRebounding: 0,
          selfRatingScoringInside: 0,
          selfRatingMidRange: 0,
          selfRatingThreePoint: 0,
          selfRatingOffTheDribble: 0,
          selfRatingSportsmanship: 0,
          selfRatingCount: 0,
          generalRating: 0,
          ratingsCount: 0,
          ratingsSum: 0,
          autoCheckInDisabled: false,
          isAdmin: false,
          isAnonymous: false,
        });
      }

      // Create operator application for admin review
      const applicationData: Record<string, unknown> = {
        applicantId: uid,
        applicantName: fullName || user?.email || "",
        applicantEmail: account.email || user?.email || "",
        type: courtType,
        status: "pending",
        submittedAt: serverTimestamp(),
      };

      if (courtType === "new_court") {
        applicationData.courtData = {
          pendingCourtId, // admin will use this as the new court doc ID
          name: courtData.name.trim(),
          address: courtData.address.trim(),
          latitude: parseFloat(courtData.latitude) || 0,
          longitude: parseFloat(courtData.longitude) || 0,
          setting: courtData.setting,
          accessType: courtData.accessType.trim() || "Public",
          baskets: parseInt(courtData.baskets) || 0,
          hasLights: courtData.hasLights,
          hoursOfOperation: courtData.hoursOfOperation.trim(),
          courtCondition: courtData.courtCondition,
          threePointLine: courtData.threePointLine,
          phoneNumber: courtData.phoneNumber.trim(),
          description: courtData.description.trim(),
          photoUrlCard: photoUrlCard ?? "",
          photoUrlFull: photoUrlFull ?? "",
        };
      } else {
        applicationData.courtId = selectedCourtId;
        applicationData.verificationInfo = verificationInfo;
      }

      await addDoc(collection(db, "operator_applications"), applicationData);

      await refreshProfile();
      router.push("/operator/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else {
        setError("Something went wrong. Please try again.");
        console.error(err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCourt = courts.find((c) => c.id === selectedCourtId);
  const steps: Step[] = ["account", "court", "review"];
  const stepIndex = steps.indexOf(step);

  return (
    <main className="min-h-screen bg-surface-dark">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 sm:px-12">
        <Link href="/" className="flex items-center gap-3">
          <img src="/app-icon.png" alt="G.O.A.T.S" className="h-10 w-10 rounded-xl" />
          <span className="font-display text-xl font-bold tracking-tight text-text-on-dark">G.O.A.T.S</span>
        </Link>
        <Link href="/operator" className="text-sm font-medium text-white/50 transition-colors hover:text-white/80">
          Back to Sign In
        </Link>
      </nav>

      <div className={`mx-auto px-6 py-12 sm:px-12 ${step === "account" ? "max-w-5xl" : "max-w-2xl"}`}>
        {/* Progress bar */}
        <div className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            {["Account", "Court Details", "Review"].map((label, i) => (
              <button
                key={label}
                onClick={() => i < stepIndex && goToStep(steps[i])}
                className={`font-display text-xs font-bold uppercase tracking-widest transition-colors ${
                  i <= stepIndex ? "text-teal" : "text-white/20"
                } ${i < stepIndex ? "cursor-pointer hover:text-teal-dark" : "cursor-default"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-dash-border">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal to-teal-dark transition-all duration-500"
              style={{ width: `${((stepIndex + 1) / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        {step === "account" ? (
          <div className="flex flex-col-reverse gap-8 lg:flex-row lg:items-start">
            {/* Left: signup form */}
            <div className="flex-1 rounded-2xl border border-dash-border bg-dash-surface p-8 shadow-2xl shadow-black/40">
              <h2 className="font-display mb-1 text-2xl font-bold text-white">
                Create your operator account
              </h2>
              <p className="mb-8 text-sm text-white/40">
                If you already have a G.O.A.T.S player account, use the same email and password — we&apos;ll link it automatically.
              </p>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <InputField
                    label="First Name *"
                    value={account.firstName}
                    onChange={(v) => setAccount({ ...account, firstName: v })}
                    placeholder="John"
                  />
                  <InputField
                    label="Last Name *"
                    value={account.lastName}
                    onChange={(v) => setAccount({ ...account, lastName: v })}
                    placeholder="Smith"
                  />
                </div>

                <div>
                  <InputField
                    label="Email *"
                    type="email"
                    value={account.email}
                    onChange={(v) => {
                      setAccount({ ...account, email: v });
                      setEmailSuggestion(null);
                    }}
                    placeholder="you@example.com"
                  />
                  {emailSuggestion && (
                    <button
                      type="button"
                      onClick={() => {
                        setAccount({ ...account, email: emailSuggestion });
                        setEmailSuggestion(null);
                      }}
                      className="mt-1.5 text-sm text-teal hover:text-teal-dark transition-colors"
                    >
                      Did you mean <span className="font-semibold">{emailSuggestion}</span>?
                    </button>
                  )}
                </div>

                <InputField
                  label="Phone Number *"
                  value={account.phone}
                  onChange={(v) => setAccount({ ...account, phone: v })}
                  placeholder="(555) 123-4567"
                />

                <InputField
                  label="Password *"
                  type="password"
                  value={account.password}
                  onChange={(v) => setAccount({ ...account, password: v })}
                  placeholder="At least 6 characters"
                />
                <InputField
                  label="Confirm Password *"
                  type="password"
                  value={account.confirmPassword}
                  onChange={(v) => setAccount({ ...account, confirmPassword: v })}
                  placeholder="Confirm your password"
                />
              </div>

              {/* Error + nav for step 1 */}
              {error && <p className="mt-4 text-sm text-coral">{error}</p>}
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => goToStep("court")}
                  className="rounded-xl bg-teal px-8 py-3.5 font-display text-sm font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal-dark"
                >
                  Continue
                </button>
              </div>
            </div>

            {/* Right: pricing card */}
            <div className="w-full lg:w-80 lg:shrink-0">
              <div className="relative overflow-hidden rounded-2xl border border-teal/20 bg-gradient-to-b from-dash-surface to-dash-bg">
                {/* Glow accent */}
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal/8 blur-2xl" />
                <div className="absolute -left-4 bottom-0 h-24 w-24 rounded-full bg-teal/5 blur-xl" />

                <div className="relative p-7">
                  {/* Badge */}
                  <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-teal/20 bg-teal/10 px-3 py-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-teal animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-teal">
                      Operator Plan
                    </span>
                  </div>

                  {/* Price */}
                  <div className="mb-1 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-extrabold tracking-tight text-white">$25</span>
                    <span className="text-sm text-white/40">/mo</span>
                  </div>
                  <p className="mb-7 text-xs text-white/30">
                    Billed monthly. Cancel anytime.
                  </p>

                  {/* Divider */}
                  <div className="mb-6 h-px bg-gradient-to-r from-transparent via-dash-border to-transparent" />

                  {/* Features */}
                  <ul className="space-y-3.5">
                    {[
                      "Real-time check-in analytics",
                      "Player activity dashboard",
                      "Push notifications to followers",
                      "Court announcements & promos",
                      "Custom schedule management",
                      "Photo gallery management",
                      "Verified badge on your court",
                    ].map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        <span className="text-sm leading-snug text-white/70">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className="rounded-2xl border border-dash-border bg-dash-surface p-8 shadow-2xl shadow-black/40">
          {/* Placeholder — step 2 and 3 content starts here */}

          {/* STEP 2: Court Details */}
          {step === "court" && (
            <div>
              <h2 className="font-display mb-1 text-2xl font-bold text-white">
                Court Details
              </h2>
              <p className="mb-8 text-sm text-white/40">
                Add a new court or claim one already listed on G.O.A.T.S. You can finish
                filling in any optional fields from your dashboard later.
              </p>

              {/* Court type toggle */}
              <div className="mb-8 flex gap-2 rounded-xl bg-dash-bg p-1">
                <button
                  onClick={() => setCourtType("new_court")}
                  className={`flex-1 rounded-lg py-2.5 font-display text-sm font-bold transition-all ${
                    courtType === "new_court"
                      ? "bg-teal text-surface-dark"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  New Court
                </button>
                <button
                  onClick={() => setCourtType("claim_existing")}
                  className={`flex-1 rounded-lg py-2.5 font-display text-sm font-bold transition-all ${
                    courtType === "claim_existing"
                      ? "bg-teal text-surface-dark"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  Claim Existing
                </button>
              </div>

              {courtType === "new_court" ? (
                <div className="space-y-4">
                  <InputField
                    label="Court Name *"
                    value={courtData.name}
                    onChange={(v) => setCourtData({ ...courtData, name: v })}
                    placeholder="e.g. Main Court"
                  />
                  <InputField
                    label="Address *"
                    value={courtData.address}
                    onChange={(v) => setCourtData({ ...courtData, address: v })}
                    placeholder="123 Main St, City, State"
                  />

                  <TextAreaField
                    label="Court Description *"
                    value={courtData.description}
                    onChange={(v) => setCourtData({ ...courtData, description: v })}
                    placeholder="Tell users everything about your court — amenities, parking, vibe, anything players should know..."
                  />

                  <div className="pt-2 text-xs font-medium uppercase tracking-wider text-white/30">
                    Everything below is optional — you can finish from the dashboard later
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Latitude"
                      value={courtData.latitude}
                      onChange={(v) => setCourtData({ ...courtData, latitude: v })}
                      placeholder="40.7128"
                    />
                    <InputField
                      label="Longitude"
                      value={courtData.longitude}
                      onChange={(v) => setCourtData({ ...courtData, longitude: v })}
                      placeholder="-74.0060"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <SelectField
                      label="Setting"
                      value={courtData.setting}
                      onChange={(v) => setCourtData({ ...courtData, setting: v })}
                      options={["Indoor", "Outdoor"]}
                    />
                    <InputField
                      label="Access Type"
                      value={courtData.accessType}
                      onChange={(v) => setCourtData({ ...courtData, accessType: v })}
                      placeholder="e.g. Public, Private, Members Only"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Number of Baskets"
                      type="number"
                      value={courtData.baskets}
                      onChange={(v) => setCourtData({ ...courtData, baskets: v })}
                    />
                    <SelectField
                      label="Court Condition"
                      value={courtData.courtCondition}
                      onChange={(v) => setCourtData({ ...courtData, courtCondition: v })}
                      options={["Below Average", "Okay", "Solid", "Good", "Very Good"]}
                    />
                  </div>

                  <SelectField
                    label="Three Point Line"
                    value={courtData.threePointLine}
                    onChange={(v) => setCourtData({ ...courtData, threePointLine: v })}
                    options={["None", "High School", "Old NCAA", "FIBA", "NBA"]}
                  />

                  <button
                    onClick={() => setCourtData({ ...courtData, hasLights: !courtData.hasLights })}
                    className="flex items-center gap-3 rounded-xl border border-dash-border bg-dash-bg px-4 py-3"
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                      courtData.hasLights ? "border-teal bg-teal" : "border-white/20"
                    }`}>
                      {courtData.hasLights && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-white/60">Has Lights</span>
                  </button>

                  <InputField
                    label="Hours of Operation"
                    value={courtData.hoursOfOperation}
                    onChange={(v) => setCourtData({ ...courtData, hoursOfOperation: v })}
                    placeholder="e.g. Mon-Fri 6am-10pm, Sat-Sun 8am-8pm"
                  />

                  <InputField
                    label="Phone Number"
                    value={courtData.phoneNumber}
                    onChange={(v) => setCourtData({ ...courtData, phoneNumber: v })}
                    placeholder="(555) 123-4567"
                  />

                  {/* Photo upload */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
                      Court Photo
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="cursor-pointer rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white/60 transition-colors hover:border-teal/30 hover:text-white">
                        {photoFile ? "Change Photo" : "Choose Photo"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                      </label>
                      {photoPreviewUrl && (
                        <img
                          src={photoPreviewUrl}
                          alt="Preview"
                          className="h-16 w-24 rounded-lg object-cover"
                        />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-dash-text-muted">
                      Optional. We&apos;ll resize and save it as WebP automatically.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <InputField
                    label="Search Courts"
                    value={courtSearch}
                    onChange={setCourtSearch}
                    placeholder="Search by name or address..."
                  />

                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-dash-border bg-dash-bg p-2 dash-scroll">
                    {loadingCourts ? (
                      <p className="py-8 text-center text-sm text-white/30">Loading courts...</p>
                    ) : filteredCourts.length === 0 ? (
                      <p className="py-8 text-center text-sm text-white/30">No courts found</p>
                    ) : (
                      filteredCourts.map((court) => {
                        const hasClaimed = (court.operatorIds?.length ?? 0) > 0;
                        return (
                          <button
                            key={court.id}
                            onClick={() => !hasClaimed && setSelectedCourtId(court.id)}
                            disabled={hasClaimed}
                            className={`w-full rounded-lg p-3 text-left transition-all ${
                              hasClaimed
                                ? "cursor-not-allowed border border-transparent opacity-40"
                                : selectedCourtId === court.id
                                  ? "border border-teal bg-teal/10"
                                  : "border border-transparent hover:bg-dash-surface-hover"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-white">{court.name}</p>
                                <p className="text-xs text-white/40">{court.address}</p>
                              </div>
                              {hasClaimed && (
                                <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/30">
                                  Claimed
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {selectedCourtId && (
                    <TextAreaField
                      label="Verification *"
                      value={verificationInfo}
                      onChange={setVerificationInfo}
                      placeholder="How are you connected to this court? (e.g. I'm the facility manager, owner, etc.)"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Review */}
          {step === "review" && (
            <div>
              <h2 className="font-display mb-1 text-2xl font-bold text-white">
                Review your application
              </h2>
              <p className="mb-8 text-sm text-white/40">
                Make sure everything looks good before submitting.
              </p>

              <div className="space-y-6">
                {/* Account summary */}
                <div className="rounded-xl border border-dash-border bg-dash-bg p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display text-xs font-bold uppercase tracking-widest text-teal">Account</h3>
                    <button onClick={() => setStep("account")} className="text-xs text-white/30 hover:text-white/60">Edit</button>
                  </div>
                  <ReviewRow label="Name" value={`${account.firstName} ${account.lastName}`.trim()} />
                  <ReviewRow label="Email" value={account.email} />
                  <ReviewRow label="Phone" value={account.phone} />
                </div>

                {/* Court summary */}
                <div className="rounded-xl border border-dash-border bg-dash-bg p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display text-xs font-bold uppercase tracking-widest text-teal">Court</h3>
                    <button onClick={() => setStep("court")} className="text-xs text-white/30 hover:text-white/60">Edit</button>
                  </div>
                  {courtType === "new_court" ? (
                    <>
                      <ReviewRow label="Type" value="New Court" />
                      <ReviewRow label="Name" value={courtData.name} />
                      <ReviewRow label="Address" value={courtData.address} />
                      <ReviewRow label="Description" value={courtData.description} />
                      {courtData.latitude && <ReviewRow label="Lat / Lng" value={`${courtData.latitude}, ${courtData.longitude}`} />}
                      <ReviewRow label="Setting" value={`${courtData.setting} · ${courtData.accessType}`} />
                      <ReviewRow label="Baskets" value={String(courtData.baskets)} />
                      <ReviewRow label="Condition" value={courtData.courtCondition} />
                      <ReviewRow label="3PT Line" value={courtData.threePointLine} />
                      <ReviewRow label="Lights" value={courtData.hasLights ? "Yes" : "No"} />
                      {courtData.hoursOfOperation && <ReviewRow label="Hours" value={courtData.hoursOfOperation} />}
                      {courtData.phoneNumber && <ReviewRow label="Phone" value={courtData.phoneNumber} />}
                      <ReviewRow label="Photo" value={photoFile ? "Uploaded" : "Not provided"} />
                    </>
                  ) : (
                    <>
                      <ReviewRow label="Type" value="Claim Existing Court" />
                      <ReviewRow label="Court" value={selectedCourt?.name ?? ""} />
                      <ReviewRow label="Address" value={selectedCourt?.address ?? ""} />
                      <ReviewRow label="Verification" value={verificationInfo} />
                    </>
                  )}
                </div>

                {/* What happens next */}
                <div className="rounded-xl border border-teal/20 bg-teal/5 p-5">
                  <h3 className="font-display mb-2 text-sm font-bold text-teal">What happens next?</h3>
                  <ol className="space-y-2 text-sm text-white/50">
                    <li className="flex gap-3">
                      <span className="font-display font-bold text-teal">1.</span>
                      We review your application (usually within 24-48 hours)
                    </li>
                    <li className="flex gap-3">
                      <span className="font-display font-bold text-teal">2.</span>
                      Once approved, activate your subscription and complete your court details
                    </li>
                    <li className="flex gap-3">
                      <span className="font-display font-bold text-teal">3.</span>
                      Hit Publish and your court goes live in the app
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-4 text-sm text-coral">{error}</p>
          )}

          {/* Navigation buttons (steps 2 & 3 only — step 1 has its own) */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => goToStep(steps[stepIndex - 1] as Step)}
              className="font-display text-sm font-bold text-white/40 transition-colors hover:text-white/70"
            >
              Back
            </button>

            {step === "review" ? (
              <button
                onClick={handleSubmit}
                disabled={submitting || uploadingPhoto}
                className="rounded-xl bg-teal px-8 py-3.5 font-display text-sm font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal-dark disabled:opacity-50"
              >
                {uploadingPhoto ? "Uploading photo..." : submitting ? "Submitting..." : "Submit Application"}
              </button>
            ) : (
              <button
                onClick={() => goToStep(steps[stepIndex + 1] as Step)}
                className="rounded-xl bg-teal px-8 py-3.5 font-display text-sm font-bold uppercase tracking-wider text-surface-dark transition-all hover:bg-teal-dark"
              >
                Continue
              </button>
            )}
          </div>
        </div>
        )}
      </div>
    </main>
  );
}

/* ---------- Reusable form components ---------- */

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
        {label}
      </label>
      <div className="relative">
        <input
          type={isPassword && showPw ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-teal ${isPassword ? "pr-11" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
          >
            {showPw ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-teal"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-dash-border bg-dash-bg px-4 py-3 text-sm text-white outline-none transition-colors focus:border-teal"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <span className="shrink-0 text-sm text-white/30">{label}</span>
      <span className="text-right text-sm font-medium text-white/80">{value}</span>
    </div>
  );
}
