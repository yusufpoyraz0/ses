import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ses.net.tr — AI Video Dublaj",
  description: "Eğitim videolarını anında Türkçe'ye çevir ve seslendir. YouTube URL veya video dosyası yükle, yapay zeka ile Türkçe dublaj al.",
  keywords: ["video dublaj", "türkçe çeviri", "ai dublaj", "eğitim videosu", "ses"],
  authors: [{ name: "ses.net.tr" }],
  openGraph: {
    title: "ses.net.tr — AI Video Dublaj",
    description: "Eğitim videolarını anında Türkçe'ye çevir",
    url: "https://ses.net.tr",
    siteName: "ses.net.tr",
    locale: "tr_TR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Arka plan doku */}
        <div className="fixed inset-0 -z-10 pointer-events-none">
          {/* Grid desen */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)`,
              backgroundSize: "64px 64px",
            }}
          />
          {/* Üst merkez glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-10"
            style={{
              background: "radial-gradient(ellipse at center, #6366f1 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
