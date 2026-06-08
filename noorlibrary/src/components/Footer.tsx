"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./Footer.module.css";

const ISLAMIC_QUOTES = [
  { text: "Seek knowledge from the cradle to the grave.", source: "Prophet Muhammad ﷺ" },
  { text: "The ink of the scholar is more sacred than the blood of the martyr.", source: "Islamic Proverb" },
  { text: "Whoever follows a path in pursuit of knowledge, Allah will make a path to Paradise easy for him.", source: "Sahih Muslim" },
  { text: "Read in the name of your Lord who created.", source: "Quran 96:1" },
];

export default function Footer() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [quoteVisible, setQuoteVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteVisible(false);
      setTimeout(() => {
        setQuoteIndex((prev) => (prev + 1) % ISLAMIC_QUOTES.length);
        setQuoteVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Newsletter removed per user request

  const quote = ISLAMIC_QUOTES[quoteIndex];

  return (
    <footer className={styles.footer}>
      <div className={styles.patternOverlay} aria-hidden="true" />

      <div className={`${styles.grid} container`}>
        <div className={styles.brandCol}>
          <Link href="/" className={styles.logo}>
            <Image src="/noor_logo.png" alt="Noor Library Logo" width={36} height={36} className={styles.logoImg} style={{ objectFit: "contain" }} />
            <span>
              <span className={styles.logoAccent}>Noor</span> Library
            </span>
          </Link>

          <p className={styles.aboutText}>
            An online sanctuary dedicated to the preservation and dissemination
            of authentic Islamic knowledge. Explore classic texts, daily
            reminders, and detailed studies designed for the modern seeker.
          </p>

          <div className={styles.quoteBox}>
            <div className={`${styles.quoteInner} ${quoteVisible ? styles.quoteVisible : styles.quoteHidden}`}>
              <span className={styles.quoteIcon}>&quot;</span>
              <p className={styles.quoteText}>{quote.text}</p>
              <span className={styles.quoteSource}>— {quote.source}</span>
            </div>
          </div>

          <ul className={styles.socialList}>
            <li>
              <a href="https://www.tiktok.com/@noorlibraryofficial" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="TikTok">
                <svg width="20" height="20" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                  <path d="M216.5 62.3a59.6 59.6 0 01-36.7-11.9v78.3a57.9 57.9 0 11-61.8-58.0v29.3a28 28 0 1028 28V46.7c20.6 6.9 44 6.2 63.9-2.4v-11.9z" fill="currentColor" />
                </svg>
              </a>
            </li>
          </ul>
        </div>

        <div className={styles.navCol}>
          <h4 className={styles.colTitle}>Quick links</h4>
          <ul className={styles.linkList}>
            <li>
              <Link href="/" className={styles.link}><span className={styles.linkArrow}>›</span> Home</Link>
            </li>
            <li>
              <Link href="/books" className={styles.link}><span className={styles.linkArrow}>›</span> Explore Catalog</Link>
            </li>
            <li>
              <Link href="/tip" className={styles.link}><span className={styles.linkArrow}>›</span> Support Library</Link>
            </li>
          </ul>
        </div>

        <div className={styles.navCol}>
          <h4 className={styles.colTitle}>Resources</h4>
          <ul className={styles.linkList}>
            <li>
              <Link href="/about" className={styles.link}><span className={styles.linkArrow}>›</span> Our Journey</Link>
            </li>
            <li>
              <Link href="/dashboard" className={styles.link}><span className={styles.linkArrow}>›</span> My Dashboard</Link>
            </li>
            <li>
              <Link href="/about#privacy" className={styles.link}><span className={styles.linkArrow}>›</span> Privacy Policy</Link>
            </li>
            <li>
              <Link href="/about#terms" className={styles.link}><span className={styles.linkArrow}>›</span> Terms of Use</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className={`${styles.bottomBar} container`}>
        <p className={styles.copyright}>
          © {new Date().getFullYear()} Noor Library.
          <span className={styles.copyrightNote}>
            Made with <span className={styles.heart}>♥</span> and faith.
          </span>
        </p>
        <div className={styles.bottomBadge}>
          <span className={styles.bottomBadgeText}>مكتبة نور</span>
        </div>
        <ul className={styles.bottomLinks}>
          <li>
            <Link href="/about#privacy" className={styles.bottomLink}>Privacy Policy</Link>
          </li>
          <li>
            <Link href="/about#terms" className={styles.bottomLink}>Terms of Use</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
