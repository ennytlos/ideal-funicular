import React from 'react';

export default function AboutPage() {
  return (
    <div className="container" style={{ paddingTop: '8rem', paddingBottom: '6rem', flex: 1 }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h1 style={{ fontFamily: 'Outfit', fontSize: '3rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Our <span style={{ color: 'var(--accent-red)' }}>Journey</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
            The story and philosophy behind Noor Library.
          </p>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '3rem' }}>
          <div>
            <h2 style={{ fontFamily: 'Outfit', fontSize: '1.75rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              The Vision
            </h2>
            <p style={{ fontSize: '1.1rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
              Noor Library was born out of a profound desire to make authentic Islamic knowledge accessible, beautifully presented, and intellectually enriching. In an era where digital distractions are everywhere, we wanted to build a sanctuary—a quiet corner of the internet where seekers of knowledge could dive deep into curated texts.
            </p>
          </div>

          <div>
            <h2 style={{ fontFamily: 'Outfit', fontSize: '1.75rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Our Philosophy
            </h2>
            <p style={{ fontSize: '1.1rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
              We believe that knowledge is not just information; it is light (Noor) that illuminates the heart and mind. Our design philosophy reflects this—clean, uncluttered, and focused entirely on the reading experience. We aim to honor the rich tradition of Islamic scholarship by marrying it with modern, elegant technology.
            </p>
          </div>

          <div>
            <h2 style={{ fontFamily: 'Outfit', fontSize: '1.75rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              The Future
            </h2>
            <p style={{ fontSize: '1.1rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
              Currently featuring the personal works of Author Al-Noor, the platform is built to eventually host a diverse array of global voices. We are continuously working on improving the reading experience, adding community features, and ensuring that the legacy of profound Islamic thought continues to thrive in the digital age.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
