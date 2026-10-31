import { Metadata } from 'next';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  APP_BASE_URL,
  getBookUrl,
  getCourseUrl,
  getSeriesUrl,
  getSocietyUrl,
  getQuranUrl,
  getHadithUrl,
} from './links';
import quranChapters from '../data/quran/index.json';

interface DocMetadataOptions {
  collection: string;
  id: string;
  fallbackTitle: string;
  fallbackDescription: string;
  urlBuilder: (id: string) => string;
  creatorField?: 'author' | 'instructor';
}

/**
 * Safely fetches document data from Firestore for SSR dynamic metadata.
 * Always resolves to valid metadata even if document doesn't exist or network fails.
 */
export async function getDynamicDocMetadata({
  collection,
  id,
  fallbackTitle,
  fallbackDescription,
  urlBuilder,
  creatorField,
}: DocMetadataOptions): Promise<Metadata> {
  const canonicalUrl = urlBuilder(id);
  const fallbackImage = `${APP_BASE_URL}/noor_logo.png`;

  try {
    const docRef = doc(db, collection, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const title = data.title || data.name || fallbackTitle;
      const creator = creatorField ? data[creatorField] : data.author || data.instructor;
      const displayTitle = creator ? `${title} by ${creator} | Noor Library` : `${title} | Noor Library`;
      
      const rawDesc = data.description || data.bio || fallbackDescription;
      const description = rawDesc.length > 160 ? `${rawDesc.slice(0, 157)}...` : rawDesc;
      
      const rawImage = data.coverUrl || data.bannerUrl || data.avatarUrl || data.imageUrl;
      const imageUrl = rawImage && (rawImage.startsWith('http://') || rawImage.startsWith('https://'))
        ? rawImage
        : rawImage && rawImage.startsWith('/')
          ? `${APP_BASE_URL}${rawImage}`
          : fallbackImage;

      return {
        title: displayTitle,
        description,
        alternates: {
          canonical: canonicalUrl,
        },
        openGraph: {
          title: displayTitle,
          description,
          url: canonicalUrl,
          siteName: 'Noor Library',
          images: [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: title,
            },
          ],
          type: 'article',
        },
        twitter: {
          card: 'summary_large_image',
          title: displayTitle,
          description,
          images: [imageUrl],
        },
      };
    }
  } catch (error) {
    console.warn(`[getDynamicDocMetadata] Failed to fetch metadata for ${collection}/${id}:`, error);
  }

  // Fallback when document is not in database or query fails
  const fallbackDisplayTitle = `${fallbackTitle} | Noor Library`;
  return {
    title: fallbackDisplayTitle,
    description: fallbackDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: fallbackDisplayTitle,
      description: fallbackDescription,
      url: canonicalUrl,
      siteName: 'Noor Library',
      images: [
        {
          url: fallbackImage,
          width: 512,
          height: 512,
          alt: fallbackTitle,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fallbackDisplayTitle,
      description: fallbackDescription,
      images: [fallbackImage],
    },
  };
}

/**
 * Returns rich dynamic metadata for any Quran Surah (1 to 114).
 */
export function getQuranSurahMetadata(surahId: string | number): Metadata {
  const sId = Number(surahId);
  const chapter = Array.isArray(quranChapters)
    ? (quranChapters as any[]).find((c) => c.id === sId)
    : null;

  const canonicalUrl = getQuranUrl(sId);
  const fallbackImage = `${APP_BASE_URL}/noor_logo.png`;

  if (!chapter) {
    return {
      title: `Surah ${surahId} | The Noble Quran | Noor Library`,
      description: `Read and listen to Surah ${surahId} with verse-by-verse translation and audio recitation on Noor Library.`,
      alternates: { canonical: canonicalUrl },
    };
  }

  const title = `Surah ${chapter.transliteration} (${chapter.name}) | The Noble Quran | Noor Library`;
  const typeLabel = chapter.type === 'meccan' ? 'Meccan' : 'Medinan';
  const description = `Read and reflect upon Surah ${chapter.transliteration} (${chapter.name}) - ${typeLabel} revelation with ${chapter.total_verses} verses. Verse-by-verse recitation and translations on Noor Library.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Noor Library',
      images: [
        {
          url: fallbackImage,
          width: 1200,
          height: 630,
          alt: `Surah ${chapter.transliteration}`,
        },
      ],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [fallbackImage],
    },
  };
}
