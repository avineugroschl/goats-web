import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Terms of Service — G.O.A.T.S",
};

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-surface-dark">
      <nav className="flex items-center justify-between px-6 py-4 sm:px-12">
        <Link href="/" className="flex items-center gap-3">
          <img src="/app-icon.png" alt="G.O.A.T.S" className="h-10 w-10 rounded-xl" />
          <span className="wordmark text-xl text-text-on-dark">G.O.A.T.S</span>
        </Link>
      </nav>

      <article className="mx-auto max-w-3xl px-6 py-12 sm:px-12">
        <h1 className="font-display mb-2 text-3xl font-extrabold text-white sm:text-4xl">Terms of Service</h1>
        <p className="mb-12 text-sm text-white/30">Last updated: August 16, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-white/60">
          <Section title="1. Acceptance of Terms">
            <p>
              These Terms of Service (&quot;Terms&quot;) are a binding agreement between you and Eclipsis L.L.C.
              (&quot;Eclipsis,&quot; &quot;G.O.A.T.S,&quot; &quot;we,&quot; &quot;our,&quot; &quot;us&quot;), the operator
              of the G.O.A.T.S mobile application and the website at goatssportsapp.com (collectively, the &quot;Service&quot;).
              By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms,
              do not use the Service.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              G.O.A.T.S is a basketball court discovery and community platform. The Service allows users to find
              courts, check in to courts, rate other players, and communicate with the basketball community. Court
              operators may use the Service to manage their courts, publish announcements, and communicate with players.
              Players may optionally subscribe to Golden G.O.A.T. to unlock additional in-app features.
            </p>
          </Section>

          <Section title="3. User Accounts">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>You must provide accurate information when creating an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must be at least 13 years old to use the Service.</li>
              <li>One account per person. Creating multiple accounts to manipulate ratings or circumvent restrictions is prohibited.</li>
            </ul>
          </Section>

          <Section title="4. Acceptable Use">
            <p className="mb-3">
              We have zero tolerance for objectionable content or abusive users on the Service. Objectionable content
              includes but is not limited to content that is harassing, threatening, hateful, discriminatory, sexually
              explicit, violent, illegal, or otherwise inappropriate. Users who post objectionable content or engage in
              abusive behavior toward other users will have the offending content removed and may be permanently removed
              from the Service.
            </p>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Submit false or misleading ratings of other players</li>
              <li>Harass, bully, or intimidate other users through ratings, chat, or comments</li>
              <li>Impersonate another person or misrepresent your identity</li>
              <li>Post inappropriate, offensive, or illegal content in chat or comments</li>
              <li>Attempt to manipulate check-in data or location information</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>
                Access or use the Service through any automated means, including bots, scrapers, crawlers, spiders, or
                scripts, except as expressly permitted below
              </li>
              <li>
                Scrape, harvest, copy, or bulk-collect any data from the Service — including court listings, check-in
                and presence data, busyness data, ratings, chat messages, or user profiles — whether by automated or
                manual means
              </li>
              <li>
                Access or attempt to access the Service&apos;s servers, APIs, or databases by any means other than the
                official G.O.A.T.S mobile applications and the goatssportsapp.com website
              </li>
              <li>
                Reverse engineer, decompile, or disassemble any part of the Service, except to the extent this
                restriction is prohibited by applicable law
              </li>
              <li>
                Use any data obtained from the Service to build, train, or improve any competing product, database, or
                machine-learning model
              </li>
              <li>Use the Service for any purpose other than its intended use</li>
            </ul>
            <p className="mt-3">
              Notwithstanding the above, we grant operators of public search engines a limited, revocable permission to
              crawl publicly available pages of the website in accordance with our robots.txt file, solely as necessary
              to create publicly available searchable indices of those pages (but not caches, archives, or datasets of
              Service content). We may revoke this permission at any time.
            </p>
          </Section>

          <Section title="5. Court Operator Terms">
            <p className="mb-3">Court operators who subscribe to the operator plan additionally agree to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Provide accurate information about their court (address, hours, conditions).</li>
              <li>Use push notifications responsibly (maximum 2 per day, relevant content only).</li>
              <li>Not use announcements or promotions for misleading or deceptive purposes.</li>
              <li>Pay the applicable subscription fee. Subscriptions are billed monthly and can be cancelled at any time, with access continuing through the end of the billing period.</li>
              <li>Understand that cancelling the subscription does not remove the court from the app. The court remains listed but is no longer managed.</li>
            </ul>
          </Section>

          <Section title="6. Player Ratings">
            <p>
              The rating system is designed to reflect genuine basketball skill assessments based on playing together.
              Ratings should be honest and based on actual gameplay. Coordinated rating manipulation, revenge ratings,
              or ratings based on factors other than basketball skill are prohibited and may result in account suspension.
            </p>
          </Section>

          <Section title="7. Content and Intellectual Property">
            <p className="mb-3">
              You retain ownership of content you submit (photos, comments, chat messages). By posting content to the
              Service, you grant Eclipsis a non-exclusive, royalty-free license to display that content within the
              Service. You represent that you have the right to share any content you upload. We may remove content
              that violates these terms without notice. If you believe content on the Service infringes your copyright,
              contact us at office@goatssportsapp.com and we will promptly review and remove infringing material.
            </p>
            <p>
              As between you and Eclipsis, the Service itself — including its software, design, and the selection,
              compilation, and arrangement of court data, check-in data, and other Service content — is owned by
              Eclipsis L.L.C., and all rights not expressly granted are reserved.
            </p>
          </Section>

          <Section title="8. Payments and Refunds">
            <p className="mb-3">The Service offers two types of paid subscriptions:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="font-semibold text-white/80">Court Operator subscriptions</strong> are processed by Stripe
                through our website. By subscribing as a court operator, you agree to Stripe&apos;s terms of service.
                Operator subscription fees are non-refundable for partial billing periods. If you cancel, you retain
                access until the end of your current billing period.
              </li>
              <li>
                <strong className="font-semibold text-white/80">Golden G.O.A.T. player subscriptions</strong> are processed
                by Apple through the App Store or by Google through Google Play. These subscriptions are governed by
                Section 9 below and by the applicable platform&apos;s terms.
              </li>
            </ul>
          </Section>

          <Section title="9. Golden G.O.A.T. Subscription">
            <p className="mb-3">
              Golden G.O.A.T. is an auto-renewable subscription that unlocks premium features within the G.O.A.T.S
              mobile application, including expanded saved courts, access to rating history, access to court busyness
              history charts, a golden border on your profile avatar, and additional weight on your ratings of other
              players.
            </p>
            <p className="mb-2">
              <strong className="font-semibold text-white/80">Pricing.</strong> Golden G.O.A.T. is offered at the following
              prices (subject to change):
            </p>
            <ul className="mb-3 list-disc space-y-1.5 pl-5">
              <li>Monthly: $4.99 per month</li>
              <li>Yearly: $14.99 per year</li>
            </ul>
            <p className="mb-3">
              Prices in regions outside the United States may differ based on local pricing tiers set by Apple or
              Google and may include applicable taxes.
            </p>
            <p className="mb-3">
              <strong className="font-semibold text-white/80">Payment and Auto-Renewal.</strong> Payment will be charged to
              your Apple ID account (iOS) or Google Play account (Android) at confirmation of purchase. The subscription
              automatically renews unless auto-renew is turned off before the end of the current period. You can manage
              your subscription and turn off auto-renewal through your Apple ID account settings (iOS) or Google Play
              account settings (Android) after purchase.
            </p>
            <p className="mb-3">
              <strong className="font-semibold text-white/80">Cancellation.</strong> You may cancel your subscription at any
              time through your Apple ID or Google Play account settings. You will retain access to premium features
              through the end of the period you have already paid for. Deleting the G.O.A.T.S app does not cancel your
              subscription.
            </p>
            <p className="mb-3">
              <strong className="font-semibold text-white/80">Refunds.</strong> All purchases are processed by Apple (iOS)
              or Google (Android) and are subject to their respective refund policies. Eclipsis L.L.C. does not process
              refunds for in-app purchases directly. To request a refund on iOS, contact Apple Support through your
              Apple ID account. To request a refund on Android, contact Google Play Support through your Google Play
              account.
            </p>
            <p className="mb-3">
              <strong className="font-semibold text-white/80">Free Trials and Promotions.</strong> Where offered, any free
              trial or promotional period will automatically convert to a paid subscription at the end of the trial
              unless you cancel before the trial ends. Only one free trial per subscription group is permitted per
              account.
            </p>
            <p>
              <strong className="font-semibold text-white/80">Loss of Access.</strong> If your payment method fails or your
              subscription lapses, premium features will become inaccessible until payment is restored. Your account
              and non-premium features remain available.
            </p>
          </Section>

          <Section title="10. Termination">
            <p>
              We reserve the right to suspend or terminate accounts that violate these terms. You may delete your
              account at any time. See our <Link href="/delete-account" className="text-teal hover:underline">account deletion page</Link> for
              instructions.
            </p>
          </Section>

          <Section title="11. Content Moderation and Reporting">
            <p>
              We provide tools within the Service to report objectionable content and to block abusive users. Reports
              of objectionable content or abusive behavior will be reviewed and acted upon within 24 hours, including
              removal of the content and, where appropriate, ejection of the user responsible. Blocking another user
              immediately removes their content from your view within the Service.
            </p>
          </Section>

          <Section title="12. Disclaimers">
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind. We do not guarantee the
              accuracy of court information, player ratings, or real-time check-in data. We are not responsible for
              interactions between users at courts. Use the Service at your own risk.
            </p>
          </Section>

          <Section title="13. In-Person Activity and Assumption of Risk">
            <p className="mb-3">
              The Service facilitates coordination for in-person basketball at public courts. We do not organize,
              supervise, control, or participate in any in-person interaction between users. You acknowledge and agree that:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Attending basketball courts and playing basketball involves inherent risks, including physical injury, altercations or conflicts with other users, theft, property damage, and exposure to hazardous court conditions.</li>
              <li>We do not verify the identity, background, character, or skill level of any user.</li>
              <li>We do not inspect, maintain, or verify the safety or condition of any court listed in the Service.</li>
              <li>Information about courts (including check-in counts, operator announcements, and user-submitted content) may be inaccurate, outdated, or misleading.</li>
              <li>You assume all risk associated with in-person use of courts identified through the Service and with any interaction with other users.</li>
              <li>You are solely responsible for your safety, your personal property, and your conduct when meeting or playing with other users.</li>
            </ul>
            <p className="mt-3">
              To the fullest extent permitted by law, we are not responsible for any injury, loss, damage, dispute,
              or harm arising from in-person interactions between users, from the condition of any court, or from your
              decision to visit any location identified through the Service.
            </p>
          </Section>

          <Section title="14. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Eclipsis L.L.C. shall not be liable for any indirect, incidental,
              special, or consequential damages arising from your use of the Service.
            </p>
          </Section>

          <Section title="15. Governing Law">
            <p>
              These Terms are governed by and construed in accordance with the laws of the State of New York,
              without regard to its conflict of law provisions.
            </p>
          </Section>

          <Section title="16. Changes to Terms">
            <p>
              We may update these Terms from time to time. Continued use of the Service after changes constitutes
              acceptance of the updated terms. We will notify users of significant changes through the app or by email.
              Changes that materially affect existing Golden G.O.A.T. subscribers will be communicated in-app or by
              email before taking effect.
            </p>
          </Section>

          <Section title="17. Contact">
            <p>
              Questions about these Terms? Contact us at{" "}
              <a href="mailto:office@goatssportsapp.com" className="text-teal hover:underline">office@goatssportsapp.com</a>
              {" "}or{" "}
              <a href="tel:8459250433" className="text-teal hover:underline">(845) 925-0433</a>.
            </p>
            <p className="mt-3 font-medium text-white/80">Eclipsis L.L.C.</p>
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
