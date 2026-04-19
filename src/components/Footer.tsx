import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-surface-variant/30 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:px-12">
        <div className="flex flex-col items-center gap-6">
          <span className="font-display text-sm font-bold text-text-primary/80">G.O.A.T.S</span>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm">
            <Link href="/privacy" className="text-text-muted transition-colors hover:text-text-primary">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-text-muted transition-colors hover:text-text-primary">
              Terms of Service
            </Link>
            <Link href="/delete-account" className="text-text-muted transition-colors hover:text-text-primary">
              Account Deletion
            </Link>
          </div>

          {/* Contact */}
          <div className="text-center text-sm text-text-muted">
            <a href="mailto:office@goatssportsapp.com" className="transition-colors hover:text-teal">
              office@goatssportsapp.com
            </a>
            <span className="mx-2">·</span>
            <a href="tel:8457467745" className="transition-colors hover:text-teal">
              (845) 746-7745
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-text-primary/5 text-center text-xs text-text-muted/50">
          &copy; {new Date().getFullYear()} G.O.A.T.S. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
