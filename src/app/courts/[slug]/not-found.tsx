import Link from "next/link";

export default function CourtNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-text-muted">Court not found.</p>
      <Link href="/courts" className="text-teal hover:text-teal-dark">
        &larr; Back to courts
      </Link>
    </main>
  );
}
