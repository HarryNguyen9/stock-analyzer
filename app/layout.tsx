import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "StockVN",
    template: "%s | StockVN",
  },
  applicationName: "StockVN",
  description: "StockVN phân tích kỹ thuật cổ phiếu Việt Nam với dữ liệu thị trường, scanner, ngành và độ rộng thị trường.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "StockVN",
    description: "Phân tích kỹ thuật cổ phiếu Việt Nam với dữ liệu thị trường, scanner và tín hiệu kỹ thuật.",
    siteName: "StockVN",
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "StockVN",
    description: "Phân tích kỹ thuật cổ phiếu Việt Nam.",
  },
  appleWebApp: {
    capable: true,
    title: "StockVN",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: [
      {
        url: "/icons/logo-512.png",
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
      <body className="min-h-full overflow-x-hidden bg-background text-foreground transition-colors">
        {children}
        <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          Thông tin chỉ mang tính tham khảo, không phải khuyến nghị mua bán.
        </footer>
      </body>
    </html>
  );
}
