'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '../../context/AppContext';
import BookCard from '../../components/BookCard';
import SeriesCard from '../../components/SeriesCard';

export default function BooksPage() {
  const { books, series } = useApp();
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab') === 'series' ? 'series' : 'books';
  const [activeTab, setActiveTab] = useState<'books' | 'series'>(initialTab as 'books' | 'series');

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'series') setActiveTab('series');
    if (tab === 'books') setActiveTab('books');
  }, [searchParams]);

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
            onClick={() => setActiveTab('books')}
            className={`dashboard-tab-btn ${activeTab === 'books' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
          >
            Standalone Books
          </button>
          <button
            onClick={() => setActiveTab('series')}
            className={`dashboard-tab-btn ${activeTab === 'series' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
          >
            Book Series
          </button>
        </div>
      </div>

      <div className="books-catalog-grid">
        {activeTab === 'books' 
          ? books.map((book) => <BookCard key={book.id} book={book} />)
          : series.map((s) => <SeriesCard key={s.id} series={s} />)
        }
      </div>
    </div>
  );
}
