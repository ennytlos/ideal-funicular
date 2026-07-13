'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useApp, Book, Series, Course, ShortRead, Banner } from '../context/AppContext';
import BookCard from './BookCard';
import SeriesCard from './SeriesCard';
import CourseCard from './CourseCard';

interface HomeClientPageProps {
  initialBooks: Book[];
  initialSeries: Series[];
  initialCourses: Course[];
  initialShortReads: ShortRead[];
  initialBanners: Banner[];
}

export default function HomeClientPage({
  initialBooks = [],
  initialSeries = [],
  initialCourses = [],
  initialShortReads = [],
  initialBanners = []
}: HomeClientPageProps) {
  const { books: liveBooks, series: liveSeries, courses: liveCourses, shortReads: liveShortReads, banners: liveBanners } = useApp();
  const [currentSlide, setCurrentSlide] = useState(0);

  const books = useMemo(() => liveBooks.length > 0 ? liveBooks : initialBooks, [liveBooks, initialBooks]);
  const series = useMemo(() => liveSeries.length > 0 ? liveSeries : initialSeries, [liveSeries, initialSeries]);
  const courses = useMemo(() => liveCourses.length > 0 ? liveCourses : initialCourses, [liveCourses, initialCourses]);
  const shortReads = useMemo(() => liveShortReads.length > 0 ? liveShortReads : initialShortReads, [liveShortReads, initialShortReads]);
  const banners = useMemo(() => liveBanners.length > 0 ? liveBanners : initialBanners, [liveBanners, initialBanners]);

  const activeBanners = useMemo(() => {
    return (banners || []).filter(b => b.isActive);
  }, [banners]);

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % activeBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeBanners.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem', paddingBottom: '4rem' }}>
      
      {/* Hero Section */}
      <section style={{
        position: 'relative', padding: '6rem 1.5rem', textAlign: 'center', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '70vh', background: 'linear-gradient(to bottom, rgba(248, 250, 252, 0) 0%, rgba(248, 250, 252, 1) 100%)'
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(220, 38, 38, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
          zIndex: -1, pointerEvents: 'none'
        }} />

        <h1 style={{ fontFamily: 'Outfit', fontSize: 'clamp(1.8rem, 6vw, 4.5rem)', fontWeight: 700, marginBottom: '1.5rem', lineHeight: 1.1, paddingTop: '40px' }}>
          Illuminating Minds with <br />
          <span style={{ background: 'var(--accent-red-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Authentic Knowledge
          </span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(1rem, 2vw, 1.25rem)', maxWidth: '600px', marginBottom: '2.5rem', lineHeight: 1.6 }}>
          Your digital sanctuary for profound Islamic writings. Dive into carefully curated texts, daily reflections, and comprehensive guides designed to enrich your faith and intellect.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/books" className="btn btn-primary" style={{ padding: '0.875rem 2rem', fontSize: '1.1rem' }}>
            Start Reading
          </Link>
          <Link href="/about" className="btn btn-secondary" style={{ padding: '0.875rem 2rem', fontSize: '1.1rem' }}>
            Our Mission
          </Link>
        </div>
      </section>

      {/* sliding banner carousel */}
      {activeBanners.length > 0 && (
        <section className="container" style={{ marginTop: '-2rem', marginBottom: '2rem' }}>
          <div className="glass-card" style={{
            position: 'relative', height: '240px', borderRadius: '16px', overflow: 'hidden',
            border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', background: 'var(--glass-bg)'
          }}>
            {activeBanners.map((banner, idx) => (
              <div key={banner.id} style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex',
                opacity: currentSlide === idx ? 1 : 0, visibility: currentSlide === idx ? 'visible' : 'hidden',
                transition: 'opacity 0.8s ease, visibility 0.8s ease', alignItems: 'center', justifyContent: 'space-between',
                padding: '2.5rem', boxSizing: 'border-box'
              }}>
                <div style={{ flex: 1, zIndex: 2, display: 'flex', flexDirection: 'column', gap: '0.8rem', maxWidth: '60%' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-gold)' }}>Featured Spotlight</span>
                  <h2 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', margin: 0, color: 'var(--text-primary)' }}>{banner.title}</h2>
                  <Link href={banner.targetUrl} className="btn btn-primary" style={{ width: 'fit-content', background: 'var(--accent-gold)', border: 'none', padding: '0.6rem 1.5rem', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    Explore Spotlight &rarr;
                  </Link>
                </div>

                <div style={{ width: '35%', height: '80%', borderRadius: '8px', overflow: 'hidden', position: 'relative', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', zIndex: 2 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={banner.imageUrl} alt={banner.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>

                <div style={{ position: 'absolute', top: 0, right: 0, width: '60%', height: '100%', backgroundImage: `linear-gradient(to right, var(--bg-primary) 0%, transparent 100%), url(${banner.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.12, zIndex: 1, pointerEvents: 'none' }} />
              </div>
            ))}

            {activeBanners.length > 1 && (
              <div style={{ position: 'absolute', bottom: '1rem', left: '2.5rem', display: 'flex', gap: '0.5rem', zIndex: 10 }}>
                {activeBanners.map((_, idx) => (
                  <button key={idx} onClick={() => setCurrentSlide(idx)} style={{
                    width: '8px', height: '8px', borderRadius: '50%', border: 'none', padding: 0,
                    background: currentSlide === idx ? 'var(--accent-gold)' : 'var(--text-muted)', cursor: 'pointer',
                    opacity: currentSlide === idx ? 1 : 0.4, transition: 'all 0.3s ease'
                  }} aria-label={`Slide ${idx + 1}`} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Core Features: Quran & Adhkar Section */}
      <section className="container">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontFamily: 'Outfit', fontSize: '2.25rem', marginBottom: '0.5rem' }}>Sacred Texts & Remembrances</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Connect with the core of Islamic devotions and knowledge daily.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem' }}>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '3rem 2.25rem', height: '100%' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(220, 38, 38, 0.05) 100%)', border: '1px solid rgba(212, 175, 55, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: 'var(--accent-gold)' }}>📖</div>
            <div>
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.5rem', marginBottom: '0.75rem' }}>The Holy Quran</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>Access the complete Quran with beautiful Arabic typography, English translations, and detailed chapter metadata. Designed for high legibility and searchability.</p>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
              <Link href="/quran" className="btn btn-gold" style={{ width: '100%', padding: '0.75rem' }}>Read the Quran</Link>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '3rem 2.25rem', height: '100%' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%)', border: '1px solid rgba(79, 70, 229, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>🌙</div>
            <div>
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.5rem', marginBottom: '0.75rem' }}>Daily Remembrances</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>Practice morning and evening Adhkar with auto time-of-day detection. Track your supplications with satisfying tap-to-increment counters that save your progress.</p>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
              <Link href="/adhkaar" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>Open Daily Adhkar</Link>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '3rem 2.25rem', height: '100%' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%)', border: '1px solid rgba(220, 38, 38, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: 'var(--accent-red)' }}>📜</div>
            <div>
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.5rem', marginBottom: '0.75rem' }}>Hadith Haven</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>Browse and search compiled Prophetic traditions from the canonical six Hadith collections. Filter by authenticity grades (Sahih, Hasan, Da\'if) and sync favorites.</p>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
              <Link href="/hadith" className="btn btn-secondary" style={{ width: '100%', padding: '0.75rem', textAlign: 'center' }}>Browse Hadith</Link>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '3rem 2.25rem', height: '100%' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(22, 31, 48, 0.05) 100%)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: '#10b981' }}>🕌</div>
            <div>
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.5rem', marginBottom: '0.75rem' }}>Prayer & Qiyam Times</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>Get real-time location-aware prayer timings, Hijri date mappings, and calculations for the Last Third of the Night to aid your Qiyam al-Layl and Tahajjud prayers.</p>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
              <Link href="/solat" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', textAlign: 'center' }}>View Prayer Times</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Books Section */}
      <section className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
          <div>
            <h2 style={{ fontFamily: 'Outfit', fontSize: '2rem', marginBottom: '0.5rem' }}>Featured Works</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Handpicked selections to start your journey.</p>
          </div>
          <Link href="/books" className="viewAllLink">
            <span className="viewAllText">View All</span>
            <span className="viewAllArrow">&rarr;</span>
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
          {books.slice(0, 2).map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
          {series.slice(0, 2).map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
      </section>

      {/* Structured Learning Courses Section */}
      {courses && courses.length > 0 && (
        <section className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
            <div>
              <h2 style={{ fontFamily: 'Outfit', fontSize: '2rem', marginBottom: '0.5rem' }}>Structured Learning</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Deep-dive into specific Islamic sciences with our structured curriculums.</p>
            </div>
            <Link href="/courses" className="viewAllLink">
              <span className="viewAllText">View All</span>
              <span className="viewAllArrow">&rarr;</span>
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
            {courses.filter(c => c.isPaid !== false).slice(0, 3).map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      )}

      {/* Daily Reminders Section */}
      {shortReads && shortReads.length > 0 && (
        <section className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
            <div>
              <h2 style={{ fontFamily: 'Outfit', fontSize: '2rem', marginBottom: '0.5rem' }}>Daily Reminders</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Authentic quotes and reflections. Download as cards to share.</p>
            </div>
            <Link href="/reminder" className="viewAllLink">
              <span className="viewAllText">View All</span>
              <span className="viewAllArrow">&rarr;</span>
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 320px))', gap: '2.5rem', justifyContent: 'center' }}>
            {shortReads.slice(0, 3).map((reminder) => {
              const getFontSize = (text: string) => {
                const len = text.length;
                if (len < 80) return '0.9rem';
                if (len < 160) return '0.75rem';
                if (len < 300) return '0.65rem';
                return '0.55rem';
              };
              return (
                <Link key={reminder.id} href={`/reminder?id=${reminder.id}`} style={{
                  display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)', transition: 'transform 0.3s ease',
                  textDecoration: 'none', color: 'inherit'
                }}>
                  <div style={{
                    padding: '2rem 1.75rem', flex: 1, display: 'flex', flexDirection: 'column',
                    justifyContent: 'center', minHeight: '180px', position: 'relative', overflow: 'hidden',
                    background: 'radial-gradient(circle at 10% 10%, rgba(220, 38, 38, 0.03) 0%, transparent 60%)'
                  }}>
                    <p style={{
                      margin: 0, fontFamily: 'Outfit', fontWeight: 600, color: 'var(--text-primary)',
                      lineHeight: 1.5, textAlign: 'center', fontSize: getFontSize(reminder.content)
                    }}>
                      &ldquo;{reminder.content}&rdquo;
                    </p>
                  </div>
                  <div style={{
                    padding: '0.85rem 1.5rem', background: 'rgba(0, 0, 0, 0.02)', borderTop: '1px solid var(--border-color)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-gold)',
                      textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>
                      {reminder.category}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Download Card &rarr;
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
