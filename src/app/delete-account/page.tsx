import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Delete Account — G.O.A.T.S",
};

export default function DeleteAccount() {
  return (
    <main className="min-h-screen bg-surface-dark">
      <nav className="flex items-center justify-between px-6 py-4 sm:px-12">
        <Link href="/" className="flex items-center gap-3">
          <img src="/app-icon.png" alt="G.O.A.T.S" className="h-10 w-10 rounded-xl" />
          <span className="font-display text-xl font-bold tracking-tight text-text-on-dark">G.O.A.T.S</span>
        </Link>
      </nav>

      <article className="mx-auto max-w-3xl px-6 py-12 sm:px-12">
        <h1 className="font-display mb-2 text-3xl font-extrabold text-white sm:text-4xl">Delete Your Account</h1>
        <p className="mb-12 text-sm text-white/30">How to permanently delete your G.O.A.T.S account</p>

        <div className="space-y-8 text-sm leading-relaxed text-white/60">
          {/* Player account */}
          <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
            <h2 className="font-display mb-4 text-lg font-bold text-white">Player Account (App)</h2>
            <p className="mb-4">To delete your player account, open the G.O.A.T.S app and navigate to:</p>
            <div className="rounded-xl bg-dash-bg px-5 py-4">
              <p className="font-medium text-teal">
                Settings &rarr; Account Management &rarr; Delete Account
              </p>
            </div>
            <p className="mt-4">
              This permanently deletes your account and all associated data including your profile,
              ratings, court visit history, and chat messages. This action cannot be undone.
            </p>
          </div>

          {/* Operator account */}
          <div className="rounded-2xl border border-dash-border bg-dash-surface p-6">
            <h2 className="font-display mb-4 text-lg font-bold text-white">Operator Account (Dashboard)</h2>
            <p className="mb-4">To delete your operator account, sign in to the operator dashboard and navigate to:</p>
            <div className="rounded-xl bg-dash-bg px-5 py-4">
              <p className="font-medium text-teal">
                Account &rarr; Delete Operator Account
              </p>
            </div>
            <p className="mt-4">
              You must cancel your subscription before deleting your operator account. Your court will
              remain listed on the app but will no longer be managed. Your player account (if you have one)
              is not affected.
            </p>
          </div>

          {/* Contact */}
          <div className="rounded-2xl border border-teal/20 bg-teal/5 p-6">
            <h2 className="font-display mb-2 text-lg font-bold text-white">Need Help?</h2>
            <p>
              If you&apos;re unable to delete your account through the app or dashboard, contact us and
              we&apos;ll handle it for you:
            </p>
            <p className="mt-3">
              <a href="mailto:office@goatssportsapp.com" className="font-medium text-teal hover:underline">office@goatssportsapp.com</a>
              <span className="mx-2 text-white/20">|</span>
              <a href="tel:8457467745" className="font-medium text-teal hover:underline">(845) 746-7745</a>
            </p>
          </div>
        </div>
      </article>

      <Footer />
    </main>
  );
}
