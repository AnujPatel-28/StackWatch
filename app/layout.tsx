import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StackWatch | Documentation intelligence for your code",
  description: "Track documentation changes and understand what they mean for your code.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
