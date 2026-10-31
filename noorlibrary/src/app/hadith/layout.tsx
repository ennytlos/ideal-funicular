import type { Metadata } from 'next';
import { APP_BASE_URL } from '../../lib/links';

export const metadata: Metadata = {
  title: 'Hadith Haven | Prophetic Traditions | Noor Library',
  description:
    'Explore canonical collections of authentic Hadith including Sahih al-Bukhari, Sahih Muslim, Sunan Abi Dawud, and more with full Arabic text, gradings, and English translations.',
  alternates: {
    canonical: `${APP_BASE_URL}/hadith`,
  },
  openGraph: {
    title: 'Hadith Haven | Prophetic Traditions | Noor Library',
    description:
      'Explore canonical collections of authentic Hadith including Sahih al-Bukhari, Sahih Muslim, Sunan Abi Dawud, and more with full Arabic text, gradings, and English translations.',
    url: `${APP_BASE_URL}/hadith`,
    siteName: 'Noor Library',
    images: [
      {
        url: `${APP_BASE_URL}/noor_logo.png`,
        width: 1200,
        height: 630,
        alt: 'Hadith Haven on Noor Library',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hadith Haven | Prophetic Traditions | Noor Library',
    description:
      'Explore canonical collections of authentic Hadith including Sahih al-Bukhari, Sahih Muslim, Sunan Abi Dawud, and more.',
    images: [`${APP_BASE_URL}/noor_logo.png`],
  },
};

export default function HadithLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
