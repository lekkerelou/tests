import type { Metadata } from "next";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Admin · TokAPI",
  description: "Claude Platform administration by TokAPI.",
  icons: {
    icon: [{ url: "/tokapi-logo-tight.png", type: "image/png" }],
    shortcut: "/tokapi-logo-tight.png",
    apple: "/tokapi-logo-tight.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-mode="dark" lang="en" style={{ colorScheme: "dark" }}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
