import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Court Operator Portal",
  description:
    "Manage your basketball court on G.O.A.T.S. Track check-ins, send notifications to followers, view stats, and grow your court's community.",
  keywords: [
    "basketball court operator",
    "manage basketball court",
    "court management app",
    "basketball court notifications",
    "pickup basketball court owner",
  ],
};

export default function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
