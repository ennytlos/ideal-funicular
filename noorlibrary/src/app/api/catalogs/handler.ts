// src/app/api/catalogs/handler.ts
// High-performance, edge-cached catalog endpoint serving books, series, courses, short reads, and banners.
// Cached at the Vercel/Next.js Edge to reduce Firestore reads from hundreds of thousands per day down to near zero.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const [booksSnap, seriesSnap, coursesSnap, shortReadsSnap, bannersSnap, mobileHeroSnap] = await Promise.all([
      adminDb.collection('books').limit(48).get(),
      adminDb.collection('series').limit(24).get(),
      adminDb.collection('courses').limit(24).get(),
      adminDb.collection('short_reads').limit(20).get(),
      adminDb.collection('banners').limit(10).get(),
      adminDb.collection('app_config').doc('mobile_hero').get(),
    ]);

    const books = booksSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        author: data.author || '',
        description: data.description || '',
        coverUrl: data.coverUrl || '',
        pdfUrl: data.pdfUrl || '',
        pdfPath: data.pdfPath || '',
        category: data.category || '',
        language: data.language || '',
        price: Number(data.price) || 0,
        downloadPrice: Number(data.downloadPrice) || 0,
        pages: Number(data.pages) || 0,
        contentType: data.contentType || 'pdf',
        isSecure: data.isSecure !== false,
        paymentInterval: data.paymentInterval || 'once',
        createdAt: typeof data.createdAt?.toMillis === 'function'
          ? data.createdAt.toMillis()
          : (typeof data.createdAt === 'number' ? data.createdAt : 0),
      };
    });

    const series = seriesSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        author: data.author || '',
        category: data.category || '',
        description: data.description || '',
        coverUrl: data.coverUrl || '',
        price: Number(data.price) || 0,
        isPaid: data.isPaid ?? false,
        episodes: data.episodes || [],
        createdAt: typeof data.createdAt?.toMillis === 'function'
          ? data.createdAt.toMillis()
          : (typeof data.createdAt === 'number' ? data.createdAt : 0),
      };
    });

    const courses = coursesSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        instructor: data.instructor || '',
        category: data.category || '',
        description: data.description || '',
        coverUrl: data.coverUrl || '',
        price: Number(data.price) || 0,
        isPaid: data.isPaid ?? false,
        isPublished: data.isPublished !== false,
        creatorId: data.creatorId || '',
        lessons: data.lessons || [],
        createdAt: typeof data.createdAt?.toMillis === 'function'
          ? data.createdAt.toMillis()
          : (typeof data.createdAt === 'number' ? data.createdAt : 0),
      };
    });

    const shortReads = shortReadsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        content: data.content || '',
        category: data.category || '',
        isPublished: data.isPublished !== false,
        createdAt: typeof data.createdAt?.toMillis === 'function'
          ? data.createdAt.toMillis()
          : (typeof data.createdAt === 'number' ? data.createdAt : 0),
      };
    });

    const banners = bannersSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        imageUrl: data.imageUrl || '',
        targetUrl: data.targetUrl || '',
        isActive: data.isActive !== false,
        createdAt: typeof data.createdAt?.toMillis === 'function'
          ? data.createdAt.toMillis()
          : (typeof data.createdAt === 'number' ? data.createdAt : 0),
      };
    });

    const defaultMobileHero = {
      isEnabled: true,
      badge: 'FEATURED SPOTLIGHT',
      title: 'Illuminating Minds with Authentic Knowledge',
      subtitle: '',
      buttonText: 'Explore Spotlight',
      targetUrl: '/(tabs)/explore',
      imageUrl: '',
    };

    const mobileHero = mobileHeroSnap.exists
      ? { ...defaultMobileHero, ...mobileHeroSnap.data() }
      : defaultMobileHero;

    return NextResponse.json(
      { books, series, courses, shortReads, banners, mobileHero },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=600',
          'CDN-Cache-Control': 'public, s-maxage=300',
        },
      },
    );
  } catch (error: any) {
    console.error('Error fetching catalog data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch catalog: ' + (error.message || String(error)) },
      { status: 500 },
    );
  }
}
