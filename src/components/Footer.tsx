import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-surface-variant/30 bg-surface-dark">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:px-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <span className="font-display text-sm font-bold text-white/80">G.O.A.T.S</span>

          {/* Links */}
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Link href="/privacy" className="text-white/30 transition-colors hover:text-white/60">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-white/30 transition-colors hover:text-white/60">
              Terms of Service
            </Link>
            <Link href="/delete-account" className="text-white/30 transition-colors hover:text-white/60">
              Account Deletion
            </Link>
          </div>

          {/* Contact */}
          <div className="text-sm text-white/30">
            <a href="mailto:office@goatssportsapp.com" className="block transition-colors hover:text-teal">
              office@goatssportsapp.com
            </a>
            <a href="tel:8457467745" className="block mt-1 transition-colors hover:text-teal">
              (845) 746-7745
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 text-center text-xs text-white/20">
          &copy; {new Date().getFullYear()} G.O.A.T.S. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
