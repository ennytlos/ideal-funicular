import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy & Account Deletion — Noor Library',
  description:
    'Privacy policy, data usage practices, and account deletion request instructions for Noor Library and the Noor Library mobile app.',
};

export default function PrivacyPage() {
  const currentYear = new Date().getFullYear();

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        padding: '3rem 1rem',
      }}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '860px',
          margin: '0 auto',
          padding: '2.5rem',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
        }}
      >
        {/* Navigation & Header */}
        <div
          style={{
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--accent-red)',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              marginBottom: '1rem',
              transition: 'var(--transition-fast)',
            }}
          >
            ← Back to Noor Library
          </Link>

          {/* <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(212, 175, 55, 0.1)',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              color: 'var(--accent-gold)',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '0.75rem',
            }}
          >
            <span>📜</span>
            <span>Legal &amp; Data Protection</span>
          </div> */}

          <h1
            style={{
              fontFamily: 'Outfit, sans-serif',
              fontSize: 'clamp(1.85rem, 4vw, 2.5rem)',
              fontWeight: 800,
              lineHeight: 1.2,
              color: 'var(--text-primary)',
              margin: '0 0 0.5rem 0',
            }}
          >
            Privacy Policy
          </h1>

          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              margin: 0,
            }}
          >
            Last Updated: November 2026 &bull; Domain:{' '}
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}
            >
              noorlibrary.com.ng
            </span>
          </p>
        </div>

        {/* Content Body */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem',
            fontSize: '0.95rem',
            lineHeight: 1.75,
            color: 'var(--text-secondary)',
          }}
        >
          {/* Section 1 */}
          <section>
            <h2
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.65rem',
              }}
            >
              1. Introduction
            </h2>
            <p style={{ margin: 0 }}>
              Welcome to <strong>Noor Library</strong> (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;),
              accessible online at{' '}
              <a
                href="https://noorlibrary.com.ng"
                style={{ color: 'var(--accent-red)', textDecoration: 'underline' }}
              >
                noorlibrary.com.ng
              </a>{' '}
              and through our official mobile applications. We are committed to safeguarding the privacy and digital
              well-being of our worshippers, students, and readers while maintaining an authentic, distraction-free
              Islamic learning environment.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.65rem',
              }}
            >
              2. Information We Collect
            </h2>
            <p style={{ marginBottom: '0.75rem' }}>
              We collect only the minimal data strictly necessary to deliver, personalize, and synchronize your devotional
              experience:
            </p>
            <ul
              style={{
                paddingLeft: '1.25rem',
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Account Credentials:</strong> When you register or
                authenticate using Google or email, we receive your name, email address, and unique user identifier (UID)
                managed via Firebase Authentication.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Devotional &amp; Learning Progress:</strong> Bookmarks,
                completed lessons, personal reflections, and study checklists stored securely in your cloud profile to
                synchronize seamlessly between mobile and web.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Approximate Location (Optional):</strong> Used
                strictly on-device to calculate precise local prayer times (Solat) and astronomical sun positions. Your
                geographic coordinates are processed locally and are <strong>never</strong> transmitted, logged, or shared
                with third-party advertisers.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Push Notification Tokens:</strong> If permission is
                granted, hardware push notification tokens are registered to deliver scheduled worship reminders (Morning
                and Evening Adhkar, prayer countdowns, and Friday Jumu&apos;ah alerts).
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.65rem',
              }}
            >
              3. How We Use Your Data
            </h2>
            <ul
              style={{
                paddingLeft: '1.25rem',
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              <li>To provide seamless authentication and preserve reading spot continuity across devices.</li>
              <li>To calculate astronomical solar prayer angles for your exact city or coordinates.</li>
              <li>To deliver voluntary, user-scheduled spiritual reminders.</li>
              <li>To securely process digital book purchases and voluntary creator support contributions via Paystack.</li>
              <li>
                We <strong style={{ color: 'var(--accent-red)' }}>never sell, rent, lease, or monetize</strong> your
                personal data or reading history to any third parties.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.65rem',
              }}
            >
              4. Third-Party Infrastructure &amp; Security Standards
            </h2>
            <p style={{ marginBottom: '0.75rem' }}>
              We partner only with industry-leading cloud infrastructure providers adhering to strict international
              privacy and encryption standards:
            </p>
            <ul
              style={{
                paddingLeft: '1.25rem',
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Google Firebase / Google Cloud:</strong> Encrypted
                cloud authentication, Firestore database synchronization, and push notifications (all traffic secured via
                TLS 1.3).
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Paystack:</strong> PCI-DSS Level 1 certified payment
                processor. Noor Library servers never see or store your payment card numbers or bank credentials.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Bunny.net CDN:</strong> High-security edge caching
                and content distribution for verified digital books and course video streaming.
              </li>
            </ul>
          </section>

          {/* Section 5: Account Deletion (Google Play Mandatory) */}
          <section
            id="account-deletion"
            style={{
              padding: '1.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              backgroundColor: 'rgba(220, 38, 38, 0.04)',
            }}
          >
            <h2
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '1.35rem',
                fontWeight: 700,
                color: 'var(--accent-red)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
              }}
            >
              <span>🗑️</span>
              <span>5. Account &amp; Data Deletion (Google Play Compliant)</span>
            </h2>

            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.7 }}>
              You maintain full sovereignty over your personal data. You can request the permanent deletion of your
              account and all associated data at any time through either of the following self-service or direct methods:
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              {/* Option A */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1.25rem',
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  📱 Option A: In-App Direct Deletion
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  Open the Noor Library mobile app, navigate to <strong>Profile / Account</strong>, and tap{' '}
                  <strong style={{ color: 'var(--accent-red)' }}>&ldquo;Delete My Account&rdquo;</strong>. Confirming
                  will permanently delete your account, saved reflections, and device tokens immediately.
                </p>
              </div>

              {/* Option B */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontSize: '1rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    ✉️ Option B: Email Deletion Request
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0', lineHeight: 1.6 }}>
                    Send an account deletion request to our administrative team from your registered email address.
                  </p>
                </div>

                <a
                  href="mailto:theadeptprofessionals@gmail.com?subject=Noor%20Library%20-%20Account%20Deletion%20Request&body=Hello%20Noor%20Library%20Team,%0A%0APlease%20permanently%20delete%20my%20account%20and%20all%20associated%20data%20from%20Noor%20Library.%0A%0AMy%20Registered%20Email:%20"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    backgroundColor: 'var(--accent-red)',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    padding: '0.65rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    textDecoration: 'none',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  Request Deletion via Email
                </a>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(212, 175, 55, 0.08)',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.85rem 1rem',
                fontSize: '0.825rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: 'var(--accent-gold)' }}>What Data is Erased:</strong> Your Firebase Auth record,
              cloud profile document, personal reflections, study progress, and push notification tokens are permanently
              purged. Financial transaction logs required for tax, legal, or banking audit compliance are retained in
              accordance with applicable statutory regulations.
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.65rem',
              }}
            >
              6. Children&apos;s Privacy
            </h2>
            <p style={{ margin: 0 }}>
              Noor Library provides family-friendly, wholesome Islamic educational resources. We do not knowingly collect
              personally identifiable information from children under 13 without verified parental consent. If you believe
              a minor has provided personal details without consent, please contact us immediately to have the data removed.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.65rem',
              }}
            >
              7. Contact Us &amp; Data Officer
            </h2>
            <p style={{ marginBottom: '0.75rem' }}>
              For questions, clarifications, or data rights requests concerning this policy, please reach out to our team:
            </p>

            <div
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                padding: '1rem 1.25rem',
                fontSize: '0.9rem',
                lineHeight: 1.7,
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                Adept Technologies &bull; Noor Library Team
              </div>
              <div>
                Email:{' '}
                <a
                  href="mailto:theadeptprofessionals@gmail.com"
                  style={{ color: 'var(--accent-red)', textDecoration: 'none', fontWeight: 600 }}
                >
                  theadeptprofessionals@gmail.com
                </a>
              </div>
              <div>
                Official Web Portal:{' '}
                <a
                  href="https://noorlibrary.com.ng"
                  style={{ color: 'var(--accent-red)', textDecoration: 'none', fontWeight: 600 }}
                >
                  https://noorlibrary.com.ng
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '1.5rem',
            marginTop: '2.5rem',
            textAlign: 'center',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
          }}
        >
          &copy; {currentYear} Noor Library (noorlibrary.com.ng). All rights reserved.
        </div>
      </div>
    </div>
  );
}
