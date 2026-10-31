import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "../context/AppContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { APP_BASE_URL } from "../lib/links";

export const metadata: Metadata = {
  metadataBase: new URL(APP_BASE_URL),
  title: "Noor Library | Authentic Islamic Knowledge",
  description:
    "A digital Islamic sanctuary dedicated to preserving and disseminating authentic Islamic knowledge—bringing the Noble Quran, authentic Hadith, daily Adhkar, verified prayer times, and classical treatises into modern daily life.",
  manifest: "/manifest.json",
  icons: {
    icon: "/noor_logo.png",
    shortcut: "/noor_logo.png",
    apple: "/noor_logo.png",
  },
  openGraph: {
    title: "Noor Library",
    description: "A digital Islamic sanctuary dedicated to preserving and disseminating authentic Islamic knowledge.",
    siteName: "Noor Library",
    type: "website",
    url: APP_BASE_URL,
    images: [
      {
        url: `${APP_BASE_URL}/noor_logo.png`,
        width: 512,
        height: 512,
        alt: "Noor Library Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Noor Library",
    description: "A digital Islamic sanctuary dedicated to preserving and disseminating authentic Islamic knowledge.",
    images: [`${APP_BASE_URL}/noor_logo.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Amiri+Quran&family=Scheherazade+New:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('theme');
                  const theme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <AppProvider>
          <Navbar />
          <main
            style={{
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {children}
          </main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
