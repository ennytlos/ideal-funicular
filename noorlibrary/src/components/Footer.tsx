'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: 'auto',
        backgroundColor: 'var(--bg-primary)',
        borderTop: '1px solid var(--border-color)',
        padding: '3rem 0 2rem 0',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2.5rem', marginBottom: '2.5rem' }}>
        <div>
          <h3 style={{ fontFamily: 'Outfit', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Image
              src="/noor_logo.png"
              alt="Noor Library Logo"
              width={28}
              height={28}
              style={{ objectFit: 'contain', filter: 'drop-shadow(0 0 3px rgba(220, 38, 38, 0.2))' }}
            />
            <span>
              <span style={{ color: 'var(--accent-red)' }}>Noor</span> Library
            </span>
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.25rem' }}>
            An online sanctuary dedicated to the dissemination of authentic Islamic knowledge, starting with personal works and growing to feature global voices.
          </p>
        </div>
        
        <div>
          <h4 style={{ fontFamily: 'Outfit', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Quick Navigation
          </h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
            <li>
              <Link href="/" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-red)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
                Home Dashboard
              </Link>
            </li>
            <li>
              <Link href="/books" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-red)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
                Explore Catalog
              </Link>
            </li>
            <li>
              <Link href="/tip" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-red)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
                Support Library
              </Link>
            </li>
            <li>
              <Link href="/about" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-red)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
                Our Journey
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 style={{ fontFamily: 'Outfit', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Quote of the Day
          </h4>
          <p style={{ color: 'var(--accent-gold)', fontStyle: 'italic', fontSize: '0.875rem', lineHeight: '1.6', borderLeft: '2px solid var(--accent-red)', paddingLeft: '1rem' }}>
            &quot;Read! In the name of your Lord who created...&quot;
            <br />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>— Surah Al-Alaq, Verse 1</span>
          </p>
        </div>
      </div>

      <div className="container" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <p>&copy; {new Date().getFullYear()} Noor Library. All rights reserved.</p>
        <p style={{ display: 'flex', gap: '1rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Made with dedication and faith</span>
        </p>
      </div>
    </footer>
  );
}
