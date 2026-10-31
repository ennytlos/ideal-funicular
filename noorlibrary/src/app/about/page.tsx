import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'About Us | Noor Library',
  description:
    'Noor Library is a digital Islamic sanctuary dedicated to preserving and disseminating authentic Islamic knowledge—bridging timeless scholarship with modern design to nurture daily worship, the Noble Quran, authentic Hadith, Adhkar, prayer times, and lifelong learning.',
};

export default function AboutPage() {
  const ecosystemFeatures = [
    {
      icon: '📖',
      title: 'Authentic Books & Thematic Series',
      description:
        'A reading sanctuary housing classical texts and contemporary research, complete with interactive readers and multi-part series.',
      link: '/books',
      linkText: 'Browse Books',
    },
    {
      icon: '🕋',
      title: 'The Glorious Quran',
      description:
        'Connect with the divine revelation through word-level clarity, verse-by-verse recitations, translations, and personal reflection tools.',
      link: '/quran',
      linkText: 'Open Quran',
    },
    {
      icon: '🤲',
      title: 'Daily Adhkaar & Supplications',
      description:
        'Anchor your soul with authentic morning, evening, post-solat, and Hisn al-Muslim supplications featuring tactile counters and audio guides.',
      link: '/adhkaar',
      linkText: 'Read Adhkaar',
    },
    {
      icon: '🕌',
      title: 'Solat & Night Qiyam Portal',
      description:
        'Accurate geolocation prayer schedules, Islamic midnight, and last-third night calculations to cultivate devotion in sacred hours.',
      link: '/solat',
      linkText: 'View Prayer Times',
    },
    {
      icon: '🎓',
      title: 'Structured Islamic Courses',
      description:
        'Progressive, modular curricula covering foundational and specialized Islamic sciences designed for students and busy seekers alike.',
      link: '/courses',
      linkText: 'Explore Courses',
    },
    {
      icon: '💡',
      title: 'Daily Reminders & Media Outreach',
      description:
        'Nuggets of authentic Quranic and prophetic wisdom designed to inspire faith, elevate mindfulness, and cut through modern digital noise.',
      link: '/reminder',
      linkText: 'View Reminders',
    },
    {
      icon: '🚀',
      title: 'More In Active Development',
      description:
        'Our roadmap is continuously expanding with new spiritual utilities, multimedia learning features, and community services coming soon.',
      link: '/tip',
      linkText: 'Support Future Tools',
      badge: 'Coming Soon',
    },
  ];

  const values = [
    {
      title: 'Authenticity First',
      description:
        'Every text, supplication, and curriculum is strictly rooted in the Noble Quran and authentic Sunnah as understood by mainstream scholarship.',
    },
    {
      title: 'Excellence in Craft (Ihsan)',
      description:
        'We strive for the highest standard of presentation, typography, and intuitive design, treating sacred learning with the reverence and quality it deserves.',
    },
    {
      title: 'Accessible Everywhere',
      description:
        'Engineered for modern life across both web and native mobile platforms, ensuring light (Noor) is always within reach wherever you are.',
    },
  ];

  return (
    <div
      className="container"
      style={{
        paddingTop: '7.5rem',
        paddingBottom: '6rem',
        flex: 1,
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '4.5rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 1rem',
            borderRadius: '9999px',
            background: 'rgba(212, 175, 55, 0.12)',
            border: '1px solid rgba(212, 175, 55, 0.25)',
            color: 'var(--accent-gold)',
            fontSize: '0.85rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '1.25rem',
          }}
        >
          <span>✨</span>
          <span>Our Sacred Purpose</span>
        </div>

        <h1
          style={{
            fontFamily: 'Outfit',
            fontSize: 'clamp(2.4rem, 5vw, 3.5rem)',
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: '1.25rem',
            color: 'var(--text-primary)',
          }}
        >
          More Than a Library:{' '}
          <span
            style={{
              background: 'var(--accent-red-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            A Digital Islamic Sanctuary
          </span>
        </h1>

        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
            maxWidth: '780px',
            margin: '0 auto',
            lineHeight: 1.7,
          }}
        >
          Noor Library is a digital Islamic sanctuary dedicated to preserving and
          disseminating authentic Islamic knowledge—bridging timeless scholarship with
          intuitive modern design to nurture daily worship, the Noble Quran, authentic
          Hadith, daily Adhkar, verified prayer times, and lifelong learning for the
          modern seeker.
        </p>
      </div>

      {/* Vision Story Card */}
      <div
        className="glass-card"
        style={{
          padding: '2.75rem',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '4rem',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)',
        }}
      >
        <h2
          style={{
            fontFamily: 'Outfit',
            fontSize: '1.85rem',
            fontWeight: 700,
            marginBottom: '1rem',
            color: 'var(--text-primary)',
          }}
        >
          The Journey Beyond Books & Series
        </h2>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            fontSize: '1.05rem',
            lineHeight: 1.8,
            color: 'var(--text-secondary)',
          }}
        >
          <p>
            When Noor Library was first envisioned, our initial mission was to create a calm, dignified
            haven for reading authentic Islamic literature. But in Islam, beneficial knowledge
            (<em>al-&apos;Ilm al-Nafi&apos;</em>) is never merely theoretical—it is the lifeblood of devotion,
            spiritual growth, and righteous action.
          </p>
          <p>
            We realized that modern Muslims do not just need books; they need a trusted, comprehensive
            daily companion. They need clarity in prayer timings, serenity in morning and evening
            remembrances, deep engagement with the Quran, and modular courses that fit demanding lives.
          </p>
          <p>
            Today, Noor Library stands as an evolving Islamic ecosystem designed to illuminate the heart
            and mind at every moment of the day.
          </p>
        </div>
      </div>

      {/* Growing Ecosystem Features */}
      <div style={{ marginBottom: '5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2
            style={{
              fontFamily: 'Outfit',
              fontSize: '2.2rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            Our Growing Ecosystem
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
            Authentic tools for worship, understanding, and daily practice—with much more currently in development.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {ecosystemFeatures.map((item, idx) => (
            <div
              key={idx}
              className="glass-card"
              style={{
                padding: '2rem',
                borderRadius: 'var(--radius-md)',
                border: item.badge
                  ? '1px dashed rgba(212, 175, 55, 0.4)'
                  : '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: item.badge
                  ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.05) 0%, rgba(220, 38, 38, 0.03) 100%)'
                  : 'var(--bg-secondary)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '2rem',
                      width: '52px',
                      height: '52px',
                      borderRadius: '12px',
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.icon}
                  </div>

                  {item.badge && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(212, 175, 55, 0.18)',
                        color: 'var(--accent-gold)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>

                <h3
                  style={{
                    fontFamily: 'Outfit',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    marginBottom: '0.75rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                    marginBottom: '1.5rem',
                  }}
                >
                  {item.description}
                </p>
              </div>

              <Link
                href={item.link}
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: item.badge ? 'var(--accent-gold)' : 'var(--accent-red)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  textDecoration: 'none',
                }}
              >
                <span>{item.linkText}</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Our Values */}
      <div style={{ marginBottom: '5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2
            style={{
              fontFamily: 'Outfit',
              fontSize: '2rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            Our Core Values
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
            The unchanging principles behind every line of code and curated text.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {values.map((v, i) => (
            <div
              key={i}
              className="glass-card"
              style={{
                padding: '2rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
              }}
            >
              <h3
                style={{
                  fontFamily: 'Outfit',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  marginBottom: '0.75rem',
                  color: 'var(--accent-gold)',
                }}
              >
                {v.title}
              </h3>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                }}
              >
                {v.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Support Our Mission Banner (Sadaqah Jariyah) */}
      <div
        className="glass-card"
        style={{
          padding: 'clamp(2rem, 5vw, 3.5rem)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(212, 175, 55, 0.35)',
          background:
            'linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(220, 38, 38, 0.06) 100%)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            maxWidth: '720px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: '2.75rem',
              marginBottom: '1rem',
            }}
          >
            🌱
          </div>

          <h2
            style={{
              fontFamily: 'Outfit',
              fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '1rem',
            }}
          >
            Partner in Spreading Authentic{' '}
            <span style={{ color: 'var(--accent-gold)' }}>Noor</span>
          </h2>

          <blockquote
            style={{
              fontSize: '1.05rem',
              lineHeight: 1.7,
              color: 'var(--text-primary)',
              fontStyle: 'italic',
              margin: '0 0 1.25rem 0',
              padding: '0 1rem',
              borderLeft: 'none',
            }}
          >
            &ldquo;When a human being dies, their deeds come to an end except for three: ongoing
            charity (<em>Sadaqah Jariyah</em>), beneficial knowledge, or a righteous child who prays
            for them.&rdquo;
            <span
              style={{
                display: 'block',
                fontSize: '0.875rem',
                marginTop: '0.5rem',
                color: 'var(--accent-gold)',
                fontStyle: 'normal',
                fontWeight: 600,
              }}
            >
              — Sahih Muslim
            </span>
          </blockquote>

          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '1.05rem',
              lineHeight: 1.7,
              marginBottom: '2rem',
            }}
          >
            Noor Library is an independent Islamic initiative dedicated to authentic learning and
            accessible resources for students of knowledge globally. Your contribution directly funds
            our cloud infrastructure, digitization of valuable literature, mobile development, and
            creation of accessible educational content.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            <Link
              href="/tip"
              style={{
                background: 'var(--accent-gold-gradient)',
                color: '#0f172a',
                padding: '0.9rem 2.5rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                fontSize: '1.05rem',
                textDecoration: 'none',
                boxShadow: '0 4px 15px rgba(212, 175, 55, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'transform 0.2s ease',
              }}
            >
              <span>Support Our Mission</span>
              <span>💖</span>
            </Link>

            <Link
              href="/books"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '0.9rem 2rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
                fontSize: '1.05rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>Explore Library</span>
              <span>📚</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
