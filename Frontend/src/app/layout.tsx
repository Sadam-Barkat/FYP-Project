import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Real Time Intelligent Dashboard in Health Care",
  description: "Hospital analytics dashboard with role-based views",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Prevent theme flash: apply stored theme before React hydrates. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var t = localStorage.getItem("theme");
                  var isDark = (t !== "light");
                  document.documentElement.classList.toggle("dark", isDark);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.className} bg-gray-50 text-gray-900 dark:bg-base-bg dark:text-text-primary font-sans`}
        suppressHydrationWarning
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
