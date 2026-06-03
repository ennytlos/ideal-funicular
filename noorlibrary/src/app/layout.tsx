import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "../context/AppContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Noor Library | Authentic Islamic Knowledge",
  description: "A digital sanctuary for profound Islamic writings, daily reflections, and comprehensive guides designed to enrich your faith and intellect.",
  icons: {
    icon: "/noor_logo.png",
    shortcut: "/noor_logo.png",
    apple: "/noor_logo.png",
  },
  openGraph: {
    title: "Noor Library",
    description: "Authentic Islamic Knowledge and curated texts.",
    siteName: "Noor Library",
    type: "website",
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/noor_logo.png`,
        width: 512,
        height: 512,
        alt: "Noor Library Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Noor Library",
    description: "Authentic Islamic Knowledge and curated texts.",
    images: [`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/noor_logo.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AppProvider>
          <Navbar />
          <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {children}
          </main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
