import React from 'react';
import BooksClientPage from '../../components/BooksClientPage';
import { adminDb } from '../../lib/firebase-admin';

// Revalidate static props every 60 seconds
export const revalidate = 60;

async function getBooksAndSeries() {
  const booksSnap = await adminDb.collection('books').get();
  const seriesSnap = await adminDb.collection('series').get();

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
      createdAt: typeof data.createdAt?.toMillis === 'function' 
        ? data.createdAt.toMillis() 
        : (typeof data.createdAt === 'number' ? data.createdAt : 0)
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
      createdAt: typeof data.createdAt?.toMillis === 'function' 
        ? data.createdAt.toMillis() 
        : (typeof data.createdAt === 'number' ? data.createdAt : 0)
    };
  });

  return { books, series };
}

export default async function BooksPage() {
  const { books, series } = await getBooksAndSeries();
  return <BooksClientPage initialBooks={books} initialSeries={series} />;
}
