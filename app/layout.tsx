import type { Metadata } from "next";
import { vi } from "@/lib/i18n/vi";
import "./globals.css";

export const metadata: Metadata = {
  title: vi.app.metadataTitle,
  applicationName: "StockVN",
  description: vi.app.metadataDescription,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "StockVN",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: [
      {
        url: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem("stock-analyzer-theme") || "system";
                  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  var shouldDark = stored === "dark" || (stored === "system" && prefersDark);
                  document.documentElement.classList.toggle("dark", shouldDark);
                  document.documentElement.style.colorScheme = shouldDark ? "dark" : "light";
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full overflow-x-hidden bg-background text-foreground transition-colors">{children}</body>
    </html>
  );
}
