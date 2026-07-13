import React from 'react';
import HomeClientPage from '../components/HomeClientPage';
import { adminDb } from '../lib/firebase-admin';

// Static/Server page revalidation timing (in seconds)
export const revalidate = 60;

async function getHomeData() {
  const [booksSnap, seriesSnap, coursesSnap, shortReadsSnap, bannersSnap] = await Promise.all([
    adminDb.collection('books').get(),
    adminDb.collection('series').get(),
    adminDb.collection('courses').get(),
    adminDb.collection('short_reads').get(),
    adminDb.collection('banners').get()
  ]);

  const books = booksSnap.docs.map(doc => {
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
      createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0
    };
  });

  const series = seriesSnap.docs.map(doc => {
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
      createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0
    };
  });

  const courses = coursesSnap.docs.map(doc => {
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
      createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0
    };
  });

  const shortReads = shortReadsSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      content: data.content || '',
      category: data.category || '',
      isPublished: data.isPublished !== false,
      createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0
    };
  });

  const banners = bannersSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title || '',
      imageUrl: data.imageUrl || '',
      targetUrl: data.targetUrl || '',
      isActive: data.isActive !== false,
      createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0
    };
  });

  return { books, series, courses, shortReads, banners };
}

export default async function Home() {
  const { books, series, courses, shortReads, banners } = await getHomeData();
  
  return (
    <HomeClientPage
      initialBooks={books}
      initialSeries={series}
      initialCourses={courses}
      initialShortReads={shortReads}
      initialBanners={banners}
    />
  );
}
