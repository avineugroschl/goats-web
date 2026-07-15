import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.05] bg-[#242424]">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:px-12">
        <div className="flex flex-col items-center gap-6">
          <span className="font-display text-sm font-bold text-white/80">G.O.A.T.S</span>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm">
            <Link href="/basketball-courts" className="text-white/40 transition-colors hover:text-white/70">
              Basketball Courts
            </Link>
            <Link href="/privacy" className="text-white/40 transition-colors hover:text-white/70">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-white/40 transition-colors hover:text-white/70">
              Terms of Service
            </Link>
            <Link href="/delete-account" className="text-white/40 transition-colors hover:text-white/70">
              Account Deletion
            </Link>
          </div>

          {/* Contact */}
          <div className="text-center text-sm text-white/40">
            <a href="mailto:office@goatssportsapp.com" className="transition-colors hover:text-teal">
              office@goatssportsapp.com
            </a>
            <span className="mx-2">·</span>
            <a href="tel:8459250433" className="transition-colors hover:text-teal">
              (845) 925-0433
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.05] text-center text-xs text-white/20">
          &copy; 2026 Eclipsis... All rights reserved.
        </div>
      </div>
    </footer>
  );
}
