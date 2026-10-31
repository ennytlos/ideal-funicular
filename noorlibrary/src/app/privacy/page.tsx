import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy & Account Deletion — Noor Library',
  description: 'Privacy policy, data usage practices, and account deletion request instructions for Noor Library and the Noor Library mobile app.',
};

export default function PrivacyPage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 text-slate-800">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-10">
        
        {/* Header */}
        <div className="border-b border-slate-100 pb-6 mb-8">
          <Link href="/" className="text-sm font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 mb-4">
            ← Back to Noor Library
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mt-2">
            Last Updated: September 2026 • Domain: <span className="font-mono text-slate-700">noorlibrary.com.ng</span>
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-600">
          
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">1. Introduction</h2>
            <p>
              Welcome to <strong>Noor Library</strong> (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;), accessible online at{' '}
              <a href="https://noorlibrary.com.ng" className="text-rose-600 hover:underline">noorlibrary.com.ng</a> and via the Noor Library mobile application.
              We are dedicated to safeguarding the privacy of our worshippers, students, and readers while providing an authentic, beneficial Islamic learning environment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">2. Information We Collect</h2>
            <p className="mb-2">We collect only minimal information necessary to deliver and customize your experience:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account Credentials:</strong> When you register or sign in using Google or email, we receive your name, email address, and unique user identifier.</li>
              <li><strong>Devotional & Learning Progress:</strong> Bookmarks, course study checklists, and reading progress stored in your cloud profile to synchronize across devices.</li>
              <li><strong>Approximate Location (Optional):</strong> Used exclusively to calculate accurate local prayer times (Solat) and Azan notifications. Your location coordinates are processed on your device and are never shared or sold.</li>
              <li><strong>Device Push Notification Tokens:</strong> If granted permission, device push tokens are registered to deliver scheduled worship reminders (Morning/Evening Adhkar, Quran portion, and Friday Jumu&apos;ah reminders).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide seamless authentication and preserve reading state.</li>
              <li>To compute location-accurate Solat timings for your city.</li>
              <li>To deliver opt-in devotional notification reminders.</li>
              <li>To securely process payments for premium literature or contributions via Paystack.</li>
              <li>We <strong>never sell, lease, or monetize</strong> your personal data to third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">4. Third-Party Services</h2>
            <p className="mb-2">Our application utilizes reputable service providers with strict compliance standards:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Google Firebase:</strong> Cloud authentication, Firestore database persistence, and Cloud Messaging.</li>
              <li><strong>Paystack:</strong> PCI-DSS compliant secure payment gateway. We do not store sensitive credit card or banking details on our servers.</li>
              <li><strong>Bunny.net CDN:</strong> Fast, high-security content delivery for digital Islamic e-books and study resources.</li>
            </ul>
          </section>

          {/* Account Deletion Section (Mandatory for Google Play) */}
          <section className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-6">
            <h2 className="text-lg font-bold text-rose-900 mb-2 flex items-center gap-2">
              <span>🗑️</span> 5. Account &amp; Data Deletion Request (Google Play Compliant)
            </h2>
            <p className="text-slate-700 mb-4">
              We respect your right to control your personal data. You may request the deletion of your account and all associated personal data at any time through any of the following methods:
            </p>
            
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-lg border border-rose-200">
                <h3 className="font-semibold text-slate-900 mb-1">Option A: In-App Direct Deletion</h3>
                <p className="text-xs text-slate-600">
                  Open the Noor Library mobile app, navigate to <strong>Profile / Account</strong>, and tap <strong>&ldquo;Delete My Account&rdquo;</strong>. Confirming will permanently erase your user profile, bookmarks, and device push tokens immediately.
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-rose-200">
                <h3 className="font-semibold text-slate-900 mb-1">Option B: Email Deletion Request</h3>
                <p className="text-xs text-slate-600 mb-2">
                  Send an email request to our administrative team at:
                </p>
                <a
                  href="mailto:theadeptprofessionals@gmail.com?subject=Noor%20Library%20-%20Account%20Deletion%20Request&body=Hello%20Noor%20Library%20Team,%0A%0APlease%20permanently%20delete%20my%20account%20and%20all%20associated%20data%20from%20Noor%20Library.%0A%0AMy%20Registered%20Email:%20"
                  className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-2 px-4 rounded-md transition"
                >
                  Email: theadeptprofessionals@gmail.com
                </a>
                <p className="text-xs text-slate-500 mt-2">
                  Please include the email address associated with your Noor Library account. Requests are processed within 48 to 72 hours.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-4">
              <strong>Data Deleted:</strong> Your Firebase Auth record, user profile document, saved reading checklists, push tokens, and bookmarks are permanently purged. Financial records required for tax or fraud audit regulations may be retained as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">6. Children&apos;s Privacy</h2>
            <p>
              Noor Library provides wholesome Islamic educational content suitable for general audiences and families. We do not knowingly collect personal identifiable information from children under 13 without parental consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">7. Contact Us</h2>
            <p>
              For any questions, clarifications, or data rights requests concerning this policy, please reach out to our team:
            </p>
            <p className="mt-2 font-medium text-slate-800">
              Adept Technologies / Noor Library<br />
              Email:{' '}
              <a href="mailto:theadeptprofessionals@gmail.com" className="text-rose-600 hover:underline">
                theadeptprofessionals@gmail.com
              </a><br />
              Website:{' '}
              <a href="https://noorlibrary.com.ng" className="text-rose-600 hover:underline">
                https://noorlibrary.com.ng
              </a>
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-6 mt-10 text-center text-xs text-slate-400">
          &copy; {currentYear} Noor Library (noorlibrary.com.ng). All rights reserved.
        </div>

      </div>
    </div>
  );
}
