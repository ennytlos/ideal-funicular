'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useApp } from '../../context/AppContext';
import Navbar from '../../components/Navbar';
import { STATIC_HADITHS } from '../../lib/hadith-data';

type SearchResult = {
  id: string;
  type: 'book' | 'course' | 'series' | 'reminder' | 'hadith';
  title: string;
  subtitle: string;
  description: string;
  coverUrl?: string;
  category: string;
  link: string;
};

export default function SearchPage() {
  const { books, courses, series, shortReads } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'books' | 'courses' | 'series' | 'reminders' | 'hadiths'>('all');
  const [currentPageSize, setCurrentPageSize] = useState(6);

  // Flatten and normalize all searchable entities
  const allResults = useMemo(() => {
    const list: SearchResult[] = [];

    // 1. Books
    books.forEach(b => {
      // Show only published books
      if (b.isPublished !== false) {
        list.push({
          id: b.id,
          type: 'book',
          title: b.title,
          subtitle: `By ${b.author}`,
          description: b.description || '',
          coverUrl: b.coverUrl,
          category: b.category,
          link: `/books/${b.id}`
        });
      }
    });

    // 2. Courses
    courses.forEach(c => {
      // Show paid and published courses
      if (c.isPaid !== false && c.isPublished !== false) {
        list.push({
          id: c.id,
          type: 'course',
          title: c.title,
          subtitle: `By ${c.instructor}`,
          description: c.description || '',
          coverUrl: c.coverUrl,
          category: c.category,
          link: `/courses/${c.id}`
        });
      }
    });

    // 3. Series
    series.forEach(s => {
      if (s.isPublished !== false) {
        list.push({
          id: s.id,
          type: 'series',
          title: s.title,
          subtitle: `By ${s.author} • ${s.episodes?.length || 0} Episodes`,
          description: s.description || '',
          coverUrl: s.coverUrl,
          category: s.category,
          link: `/series/${s.id}` // Link directly to series detail page
        });
      }
    });

    // 4. Reminders
    shortReads.forEach(r => {
      if (r.isPublished !== false) {
        // Use first ~60 chars of content as the title for differentiability
        const snippetTitle = r.content
          ? r.content.replace(/\s+/g, ' ').trim().slice(0, 60) + (r.content.length > 60 ? '…' : '')
          : 'Daily Reminder';
        list.push({
          id: r.id,
          type: 'reminder',
          title: snippetTitle,
          subtitle: r.category || 'Islamic Reminder',
          description: r.content || '',
          category: r.category || 'General',
          link: `/reminder?id=${r.id}`
        });
      }
    });

    // 5. Hadiths
    STATIC_HADITHS.forEach(h => {
      list.push({
        id: h.id,
        type: 'hadith',
        title: `Hadith #${h.hadithNumber} (${h.grade})`,
        subtitle: `${h.collection.toUpperCase()} • ${h.chapterName}`,
        description: h.englishText || '',
        category: 'Hadith',
        link: `/hadith?collection=${h.collection}&q=${h.hadithNumber}`
      });
    });

    return list;
  }, [books, courses, series, shortReads]);

  // Filter based on search query and active tab
  const filteredResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    
    return allResults.filter(item => {
      // 1. Tab filter
      if (activeTab === 'books' && item.type !== 'book') return false;
      if (activeTab === 'courses' && item.type !== 'course') return false;
      if (activeTab === 'series' && item.type !== 'series') return false;
      if (activeTab === 'reminders' && item.type !== 'reminder') return false;
      if (activeTab === 'hadiths' && item.type !== 'hadith') return false;

      // 2. Query filter
      if (query) {
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesSubtitle = item.subtitle.toLowerCase().includes(query);
        const matchesDescription = item.description.toLowerCase().includes(query);
        const matchesCategory = item.category.toLowerCase().includes(query);
        
        return matchesTitle || matchesSubtitle || matchesDescription || matchesCategory;
      }

      return true;
    });
  }, [allResults, searchQuery, activeTab]);

  // Paginate results
  const paginatedResults = useMemo(() => {
    return filteredResults.slice(0, currentPageSize);
  }, [filteredResults, currentPageSize]);

  const handleLoadMore = () => {
    setCurrentPageSize(prev => prev + 6);
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setCurrentPageSize(6); // Reset pagination size on tab switch
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPageSize(6); // Reset pagination size on new query
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Navbar />
      
      <main className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
        {/* Page Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontFamily: 'Outfit', fontSize: '3rem', fontWeight: 800, marginBottom: '0.75rem', background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-gold) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Unified Search
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
            Find standalone books, complete book series, structured courses, and daily reminders across the library.
          </p>
        </div>

        {/* Search Bar Container */}
        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '50px', maxWidth: '750px', margin: '0 auto 2.5rem auto', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: '1.5rem', opacity: 0.6, marginLeft: '0.5rem' }}>🔍</span>
          <input 
            type="text" 
            aria-label="Search the library"
            placeholder="Type book title, author, course category, key phrases..." 
            value={searchQuery}
            onChange={handleSearchChange}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '1.1rem', width: '100%' }}
          />
          {searchQuery && (
            <button 
              onClick={() => { setSearchQuery(''); setCurrentPageSize(6); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer', paddingRight: '0.5rem' }}
            >
              &times;
            </button>
          )}
        </div>

        {/* Search Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          {(['all', 'books', 'courses', 'series', 'reminders', 'hadiths'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className="admin-tab-btn"
              style={{
                borderRadius: '25px',
                padding: '0.5rem 1.25rem',
                fontSize: '0.9rem',
                background: activeTab === tab ? 'var(--accent-gold)' : 'rgba(255,255,255,0.03)',
                color: activeTab === tab ? 'var(--bg-primary)' : 'var(--text-secondary)',
                border: activeTab === tab ? 'none' : '1px solid rgba(255,255,255,0.05)',
                fontWeight: activeTab === tab ? 700 : 500
              }}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Search Results count */}
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem', textAlign: 'left' }}>
          Showing {filteredResults.length} matching results
        </p>

        {/* Results Grid */}
        {paginatedResults.length === 0 ? (
          <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', borderRadius: '16px' }}>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', margin: 0 }}>
              No results found matching your search.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
            {paginatedResults.map(item => (
              <Link key={`${item.type}-${item.id}`} href={item.link} style={{ textDecoration: 'none' }}>
                <div 
                  className="glass-card" 
                  style={{ 
                    padding: '1.25rem', 
                    borderRadius: '12px', 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div>
                    {/* Cover image if available */}
                    {item.coverUrl ? (
                      <div style={{ position: 'relative', width: '100%', height: '180px', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                        <Image 
                          src={item.coverUrl} 
                          alt={item.title} 
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          style={{ objectFit: 'cover' }} 
                        />
                      </div>
                    ) : (
                      <div style={{ width: '100%', height: '100px', borderRadius: '8px', background: 'rgba(212,163,89,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', border: '1px dashed rgba(212,163,89,0.2)' }}>
                        <span style={{ fontSize: '2rem' }}>📝</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span className="badge badge-premium" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                        {item.type}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {item.category}
                      </span>
                    </div>

                    <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', lineBreak: 'anywhere' }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      {item.subtitle}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.description}
                    </p>
                  </div>
                  
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                    <span>Explore Detail</span>
                    <span>&rarr;</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {filteredResults.length > currentPageSize && (
          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <button 
              onClick={handleLoadMore} 
              className="btn btn-secondary"
              style={{ padding: '0.75rem 2rem', borderRadius: '30px' }}
            >
              Load More Results
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
