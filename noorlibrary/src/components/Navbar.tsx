'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useApp, formatDisplayName } from '../context/AppContext';
import styles from './Navbar.module.css';
import AuthModal from './AuthModal';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout, toasts, removeToast } = useApp();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobileExploreOpen, setIsMobileExploreOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const activeTheme = (document.documentElement.getAttribute('data-theme') || 'light') as 'light' | 'dark';
    const timer = setTimeout(() => {
      setTheme(activeTheme);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleOutsideClick = () => setIsDropdownOpen(false);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isDropdownOpen]);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/' ? styles.navLinkActive : '';
    return pathname.startsWith(path) ? styles.navLinkActive : '';
  };

  const isExploreActive = () => {
    return pathname.startsWith('/books') || 
           pathname.startsWith('/courses') || 
           pathname.startsWith('/quran') || 
           pathname.startsWith('/hadith') || 
           pathname.startsWith('/adhkaar') || 
           pathname.startsWith('/solat') || 
           pathname.startsWith('/reminder')
      ? styles.navLinkActive
      : '';
  };

  return (
    <>
      <header className={styles.header}>
        <div className={`${styles.navContainer} container`}>
          {/* Logo */}
          <Link href="/" className={styles.logo}>
            <Image
              src="/noor_logo.png"
              alt="Noor Library Logo"
              width={32}
              height={32}
              className={styles.logoImage}
              style={{ objectFit: 'contain' }}
            />
            <span>
              <span style={{ color: 'var(--accent-red)' }}>Noor</span> Library
            </span>
          </Link>

          {/* Desktop Links */}
          <nav>
            <ul className={styles.navLinks}>
              <li>
                <Link href="/" className={`${styles.navLink} ${isActive('/')}`}>
                  Home
                </Link>
              </li>
              <li className={styles.dropdownContainer}>
                <span className={`${styles.navLink} ${isExploreActive()}`} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Explore Library <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>▼</span>
                </span>
                <div className={styles.dropdownExplore}>
                  <Link href="/books" className={styles.dropdownExploreLink}>
                    Standalone Books
                  </Link>
                  <Link href="/books?tab=series" className={styles.dropdownExploreLink}>
                    Book Series
                  </Link>
                  <Link href="/courses" className={styles.dropdownExploreLink}>
                    Courses
                  </Link>
                  <Link href="/quran" className={styles.dropdownExploreLink}>
                    Quran
                  </Link>
                  <Link href="/hadith" className={styles.dropdownExploreLink}>
                    Hadith Haven
                  </Link>
                  <Link href="/adhkaar" className={styles.dropdownExploreLink}>
                    Adhkar
                  </Link>
                  <Link href="/solat" className={styles.dropdownExploreLink}>
                    Prayer & Qiyam
                  </Link>
                  <Link href="/reminder" className={styles.dropdownExploreLink}>
                    Reminders
                  </Link>
                  <Link href="/zakat" className={styles.dropdownExploreLink}>
                    Zakat Calculator
                  </Link>
                  <Link href="/ruqyah" className={styles.dropdownExploreLink}>
                    Ruqyah Read
                  </Link>
                </div>
              </li>
              <li>
                <Link href="/tip" className={`${styles.navLink} ${isActive('/tip')}`}>
                  Support Library
                </Link>
              </li>
              <li>
                <Link href="/about" className={`${styles.navLink} ${isActive('/about')}`}>
                  About
                </Link>
              </li>
              <li>
                <Link href="/media" className={`${styles.navLink} ${isActive('/media')}`}>
                  Short Clips
                </Link>
              </li>
              {user && (
                <li>
                  <Link href="/dashboard" className={`${styles.navLink} ${isActive('/dashboard')}`} style={{ color: 'var(--accent-red)' }}>
                    My Dashboard
                  </Link>
                </li>
              )}
            </ul>
          </nav>

          {/* Actions */}
          <div className={styles.actions}>
            {/* Search Action Link */}
            <Link 
              href="/search" 
              className={styles.themeToggleBtn}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '0.25rem', textDecoration: 'none', fontSize: '1.15rem' }}
              aria-label="Search"
            >
              🔍
            </Link>
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={styles.themeToggleBtn}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: 'rotateIn 0.3s ease' }}
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: 'rotateIn 0.3s ease' }}
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              )}
            </button>
            {user ? (
              <div className={styles.userProfileContainer}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(!isDropdownOpen);
                  }}
                  className={styles.avatarBtn}
                  aria-label="User menu"
                >
                  {formatDisplayName(user)[0].toUpperCase()}
                </button>
                {isDropdownOpen && (
                  <div className={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
                    <p className={styles.dropdownHeader}>
                      Welcome, <span className={styles.dropdownName}>{formatDisplayName(user)}</span>
                    </p>
                    <Link href="/dashboard" className={styles.dropdownLink} onClick={() => setIsDropdownOpen(false)}>
                      My Dashboard
                    </Link>
                     {(user.role === 'admin' || user.role === 'creator') && (
                       <Link href="/admin" className={styles.dropdownLink} onClick={() => setIsDropdownOpen(false)} style={{ color: user.role === 'admin' ? 'var(--accent-red)' : 'var(--accent-gold)', fontWeight: 'bold' }}>
                         {user.role === 'admin' ? 'Admin Panel' : 'Creator Panel'}
                       </Link>
                     )}
                    <button
                      onClick={() => {
                        logout();
                        setIsDropdownOpen(false);
                      }}
                      className={styles.dropdownLogoutBtn}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setIsAuthOpen(true)} className={styles.loginBtn}>
                <span className={styles.loginTextDesktop}>Register / Login</span>
                <span className={styles.loginTextMobile}>Login</span>
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              className={styles.mobileMenuToggle}
              aria-label="Toggle menu"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isMobileOpen ? (
                  <path d="M18 6 6 18M6 6l12 12" />
                ) : (
                  <path d="M4 12h16M4 6h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--bg-secondary)',
            backdropFilter: 'blur(20px)',
            zIndex: 99,
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem',
            gap: '1.5rem',
            borderTop: '1px solid var(--border-color)',
            animation: 'fadeIn 0.2s ease',
            overflowY: 'auto'
          }}
        >
          <Link
            href="/"
            onClick={() => setIsMobileOpen(false)}
            style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 600 }}
          >
            Home
          </Link>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button
              onClick={() => setIsMobileExploreOpen(!isMobileExploreOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'Outfit',
                fontSize: '1.25rem',
                fontWeight: 600,
                textAlign: 'left',
                padding: '0.5rem 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              <span>Explore Library</span>
              <span style={{ fontSize: '0.8rem' }}>{isMobileExploreOpen ? '▲' : '▼'}</span>
            </button>
            
            {isMobileExploreOpen && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                paddingLeft: '1rem',
                marginTop: '0.75rem',
                borderLeft: '2px solid var(--accent-gold)'
              }}>
                <Link href="/books" onClick={() => setIsMobileOpen(false)} style={{ fontSize: '1.1rem', opacity: 0.85, textDecoration: 'none' }}>
                  Standalone Books
                </Link>
                <Link href="/books?tab=series" onClick={() => setIsMobileOpen(false)} style={{ fontSize: '1.1rem', opacity: 0.85, textDecoration: 'none' }}>
                  Book Series
                </Link>
                <Link href="/courses" onClick={() => setIsMobileOpen(false)} style={{ fontSize: '1.1rem', opacity: 0.85, textDecoration: 'none' }}>
                  Courses
                </Link>
                <Link href="/quran" onClick={() => setIsMobileOpen(false)} style={{ fontSize: '1.1rem', opacity: 0.85, textDecoration: 'none' }}>
                  Quran
                </Link>
                <Link href="/hadith" onClick={() => setIsMobileOpen(false)} style={{ fontSize: '1.1rem', opacity: 0.85, textDecoration: 'none' }}>
                  Hadith Haven
                </Link>
                <Link href="/adhkaar" onClick={() => setIsMobileOpen(false)} style={{ fontSize: '1.1rem', opacity: 0.85, textDecoration: 'none' }}>
                  Adhkar
                </Link>
                <Link href="/solat" onClick={() => setIsMobileOpen(false)} style={{ fontSize: '1.1rem', opacity: 0.85, textDecoration: 'none' }}>
                  Prayer & Qiyam
                </Link>
                <Link href="/reminder" onClick={() => setIsMobileOpen(false)} style={{ fontSize: '1.1rem', opacity: 0.85, textDecoration: 'none' }}>
                  Reminders
                </Link>
                <Link href="/zakat" onClick={() => setIsMobileOpen(false)} style={{ fontSize: '1.1rem', opacity: 0.85, textDecoration: 'none' }}>
                  Zakat Calculator
                </Link>
                <Link href="/ruqyah" onClick={() => setIsMobileOpen(false)} style={{ fontSize: '1.1rem', opacity: 0.85, textDecoration: 'none' }}>
                  Ruqyah Read
                </Link>
              </div>
            )}
          </div>
          <Link
            href="/media"
            onClick={() => setIsMobileOpen(false)}
            style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 600, color: 'var(--accent-gold)' }}
          >
            🎬 Short Clips
          </Link>
          <Link
            href="/search"
            onClick={() => setIsMobileOpen(false)}
            style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 600 }}
          >
            🔍 Search
          </Link>
          <Link
            href="/tip"
            onClick={() => setIsMobileOpen(false)}
            style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 600 }}
          >
            Support Library
          </Link>
          <Link
            href="/about"
            onClick={() => setIsMobileOpen(false)}
            style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 600 }}
          >
            About
          </Link>
          {user && (
            <>
              {(user.role === 'admin' || user.role === 'creator') && (
                <Link
                  href="/admin"
                  onClick={() => setIsMobileOpen(false)}
                  style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 600, color: 'var(--accent-gold)' }}
                >
                  {user.role === 'admin' ? 'Admin Panel' : 'Creator Panel'}
                </Link>
              )}
              <Link
                href="/dashboard"
                onClick={() => setIsMobileOpen(false)}
                style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 600, color: 'var(--accent-red)' }}
              >
                My Dashboard
              </Link>
              <button
                onClick={() => {
                  logout();
                  setIsMobileOpen(false);
                }}
                style={{
                  fontSize: '1.25rem',
                  fontFamily: 'Outfit',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textAlign: 'left',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Logout
              </button>
            </>
          )}
        </div>
      )}

      {/* Auth Modal */}
      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}

      {/* Toast Notifications */}
      {toasts && toasts.length > 0 && (
        <div className={styles.toastContainer}>
          {toasts.map((toast) => {
            let toastClass = styles.toastInfo;
            let icon = 'ℹ️';
            if (toast.type === 'success') {
              toastClass = styles.toastSuccess;
              icon = '✅';
            } else if (toast.type === 'error') {
              toastClass = styles.toastError;
              icon = '❌';
            } else if (toast.type === 'warning') {
              toastClass = styles.toastWarning;
              icon = '⚠️';
            }
            return (
              <div key={toast.id} className={`${styles.toast} ${toastClass}`}>
                <span className={styles.toastIcon}>{icon}</span>
                <div className={styles.toastContent}>{toast.message}</div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className={styles.toastCloseBtn}
                  aria-label="Close notification"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
