'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp, Book, Series } from '../context/AppContext';
import BookCard from './BookCard';
import SeriesCard from './SeriesCard';

interface BooksClientPageProps {
  initialBooks: Book[];
  initialSeries: Series[];
}

export default function BooksClientPage({ initialBooks = [], initialSeries = [] }: BooksClientPageProps) {
  const { books: liveBooks, series: liveSeries } = useApp();
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab') === 'series' ? 'series' : 'books';
  const [activeTab, setActiveTab] = useState<'books' | 'series'>(initialTab as 'books' | 'series');

  const [booksPageSize, setBooksPageSize] = useState(6);
  const [seriesPageSize, setSeriesPageSize] = useState(6);

  // Sync active tab with search parameter
  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'series') setActiveTab('series');
    if (tab === 'books') setActiveTab('books');
  }, [searchParams]);

  // Merge server-side data with real-time updates on client side
  const books = useMemo(() => {
    return liveBooks && liveBooks.length > 0 ? liveBooks : initialBooks;
  }, [liveBooks, initialBooks]);

  const series = useMemo(() => {
    return liveSeries && liveSeries.length > 0 ? liveSeries : initialSeries;
  }, [liveSeries, initialSeries]);

  return (
    <div className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem', flex: 1 }}>
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: '3rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
          Our <span style={{ color: 'var(--accent-red)' }}>Collection</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Explore the full library of curated Islamic texts, designed to nurture your soul and expand your understanding.
        </p>

        <div className="dashboard-tab-bar" style={{ justifyContent: 'center', marginTop: '2rem' }}>
          <button
            onClick={() => { setActiveTab('books'); setBooksPageSize(6); }}
            className={`dashboard-tab-btn ${activeTab === 'books' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
          >
            Standalone Books
          </button>
          <button
            onClick={() => { setActiveTab('series'); setSeriesPageSize(6); }}
            className={`dashboard-tab-btn ${activeTab === 'series' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
          >
            Book Series
          </button>
        </div>
      </div>

      <div className="books-catalog-grid">
        {activeTab === 'books' 
          ? books.slice(0, booksPageSize).map((book) => <BookCard key={book.id} book={book} />)
          : series.slice(0, seriesPageSize).map((s) => <SeriesCard key={s.id} series={s} />)
        }
      </div>

      {activeTab === 'books' && books.length > booksPageSize && (
        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <button onClick={() => setBooksPageSize(prev => prev + 6)} className="btn btn-secondary" style={{ padding: '0.75rem 2rem', borderRadius: '30px' }}>
            Load More Standalone Books
          </button>
        </div>
      )}

      {activeTab === 'series' && series.length > seriesPageSize && (
        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <button onClick={() => setSeriesPageSize(prev => prev + 6)} className="btn btn-secondary" style={{ padding: '0.75rem 2rem', borderRadius: '30px' }}>
            Load More Book Series
          </button>
        </div>
      )}
    </div>
  );
}
