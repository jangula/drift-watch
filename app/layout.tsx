import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Drift Watch",
  description: "A refunds agent that talks itself out of its own policy, and the watchdog that catches it.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
