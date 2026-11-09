// src/app/api/catalogs/handler.ts
// High-performance, edge-cached catalog endpoint serving books, series, courses, short reads, and banners.
// Cached at the Vercel/Next.js Edge to reduce Firestore reads from hundreds of thousands per day down to near zero.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const isFresh = request.nextUrl.searchParams.get('fresh') === '1';
    const [booksSnap, seriesSnap, coursesSnap, shortReadsSnap, bannersSnap, mobileHeroSnap] = await Promise.all([
      adminDb.collection('books').limit(200).get(),
      adminDb.collection('series').limit(200).get(),
      adminDb.collection('courses').limit(200).get(),
      adminDb.collection('short_reads').limit(50).get(),
      adminDb.collection('banners').limit(20).get(),
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
        jsonPath: data.jsonPath || '',
        category: data.category || '',
        language: data.language || '',
        price: Number(data.price) || 0,
        downloadPrice: Number(data.downloadPrice) || 0,
        pages: Number(data.pages) || 0,
        contentType: data.contentType || 'pdf',
        isPublished: data.isPublished !== false,
        isSecure: data.isSecure !== false,
        paymentInterval: data.paymentInterval || 'once',
        creatorId: data.creatorId || data.authorId || '',
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
        isPublished: data.isPublished !== false,
        creatorId: data.creatorId || data.authorId || '',
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
        creatorId: data.creatorId || data.authorId || data.instructorId || '',
        lessons: data.lessons || [],
        attachmentPath: data.attachmentPath || '',
        attachmentName: data.attachmentName || '',
        paymentInterval: data.paymentInterval || 'once',
        paymentStatus: data.paymentStatus || 'paid',
        maxContentSize: Number(data.maxContentSize) || 52428800,
        currentContentSize: Number(data.currentContentSize) || 0,
        coverSize: Number(data.coverSize) || 0,
        attachmentSize: Number(data.attachmentSize) || 0,
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
        headers: isFresh
          ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
          : {
              'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
              'CDN-Cache-Control': 'public, s-maxage=15',
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
