import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Privacy Policy — G.O.A.T.S",
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-surface-dark">
      <nav className="flex items-center justify-between px-6 py-4 sm:px-12">
        <Link href="/" className="flex items-center gap-3">
          <img src="/app-icon.png" alt="G.O.A.T.S" className="h-10 w-10 rounded-xl" />
          <span className="font-display text-xl font-bold tracking-tight text-text-on-dark">G.O.A.T.S</span>
        </Link>
      </nav>

      <article className="mx-auto max-w-3xl px-6 py-12 sm:px-12">
        <h1 className="font-display mb-2 text-3xl font-extrabold text-white sm:text-4xl">Privacy Policy</h1>
        <p className="mb-12 text-sm text-white/30">Last updated: April 24, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-white/60">
          <Section title="1. Introduction">
            <p>
              G.O.A.T.S (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates the G.O.A.T.S mobile application
              and the website at goatssportsapp.com. This Privacy Policy explains how we collect, use, and protect
              your information when you use our services.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p className="mb-3 font-medium text-white/80">For Players:</p>
            <ul className="mb-4 list-disc space-y-1.5 pl-5">
              <li><span className="text-white/80">Account Information:</span> Email address, username, and profile photo you provide when creating an account.</li>
              <li><span className="text-white/80">Location Data:</span> Your device&apos;s location to check you in and out of basketball courts, show nearby courts, and calculate distances. Location may be collected in the background if you grant &quot;Always&quot; permission, solely for automatic court check-in/check-out via geofencing. If you grant &quot;Always&quot; location permission, the app collects your location in the background solely to automatically check you in and out of basketball courts via geofencing. This background location data is not used for advertising, is not sold to third parties, and is not used for any purpose other than check-in functionality. You can revoke this permission at any time in your device settings, and the app will continue to function with reduced features.</li>
              <li><span className="text-white/80">Ratings and Activity:</span> Basketball skill ratings you give and receive, court visit history, and chat messages posted at courts.</li>
              <li><span className="text-white/80">Device Information:</span> Firebase Cloud Messaging tokens for delivering push notifications.</li>
              <li><span className="text-white/80">Court Follow Preferences:</span> Which courts you follow to receive operator notifications.</li>
            </ul>
            <p className="mb-3 font-medium text-white/80">For Court Operators:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><span className="text-white/80">Account Information:</span> Name, email address, and phone number provided during operator signup.</li>
              <li><span className="text-white/80">Court Information:</span> Court details, photos, schedules, and announcements you publish.</li>
              <li><span className="text-white/80">Payment Information:</span> Processed securely by Stripe. We do not store your credit card numbers. Stripe&apos;s privacy policy applies to payment data.</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>To provide court check-in/check-out functionality</li>
              <li>To show nearby basketball courts and active players</li>
              <li>To enable the player rating system</li>
              <li>To deliver push notifications about court activity and operator announcements</li>
              <li>To process operator subscription payments via Stripe</li>
              <li>To enable court management features for operators</li>
              <li>To maintain and improve our services</li>
            </ul>
          </Section>

          <Section title="4. Data Storage and Security">
            <p>
              Your data is stored securely using Google Firebase (Firestore and Firebase Storage). We use
              industry-standard security measures including encrypted connections (HTTPS/TLS), Firebase Security
              Rules, and secure authentication. Payment processing is handled entirely by Stripe using
              PCI-compliant infrastructure.
            </p>
          </Section>

          <Section title="5. Data Sharing">
            <p className="mb-3">We do not sell your personal information. Your data is shared only in the following ways:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><span className="text-white/80">Other users:</span> Your username, profile photo, and ratings are visible to other app users. You can enable Anonymous Mode to hide your identity at courts.</li>
              <li><span className="text-white/80">Court operators:</span> Operators can see aggregated check-in statistics and follower counts for their courts. They cannot see individual user identities unless the user is actively checked in (and not in Anonymous Mode).</li>
              <li><span className="text-white/80">Service providers:</span> We use Google Firebase for data storage, authentication, and cloud functions. We use Stripe for payment processing.</li>
            </ul>
          </Section>

          <Section title="6. Your Choices">
            <ul className="list-disc space-y-1.5 pl-5">
              <li><span className="text-white/80">Anonymous Mode:</span> Hide your identity from other users at courts.</li>
              <li><span className="text-white/80">Location Permission:</span> You can change location permissions at any time in your device settings. The app functions with reduced features without location access.</li>
              <li><span className="text-white/80">Notifications:</span> You can unfollow courts to stop receiving operator notifications. You can disable push notifications in your device settings.</li>
              <li><span className="text-white/80">Account Deletion:</span> You may delete your account at any time. See our <Link href="/delete-account" className="text-teal hover:underline">account deletion page</Link> for instructions.</li>
            </ul>
          </Section>

          <Section title="7. Children's Privacy">
            <p>G.O.A.T.S is not intended for children under 13. We do not knowingly collect information from children under 13.</p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify users of significant changes through the app or by email.</p>
          </Section>

          <Section title="9. Contact Us">
            <p>
              If you have questions about this Privacy Policy, contact us at{" "}
              <a href="mailto:office@goatssportsapp.com" className="text-teal hover:underline">office@goatssportsapp.com</a>
              {" "}or{" "}
              <a href="tel:8459250433" className="text-teal hover:underline">(845) 925-0433</a>.
            </p>
          </Section>
        </div>
      </article>

      <Footer />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display mb-3 text-lg font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}
