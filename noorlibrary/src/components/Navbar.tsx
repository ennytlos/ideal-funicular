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
  const { user, logout } = useApp();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
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
    return pathname === path ? styles.navLinkActive : '';
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
              <li>
                <Link href="/books" className={`${styles.navLink} ${isActive('/books')}`}>
                  Books
                </Link>
              </li>
              <li>
                <Link href="/books?tab=series" className={`${styles.navLink} ${isActive('/books')}`}>
                  Series
                </Link>
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
                    {user.role === 'admin' && (
                      <Link href="/admin" className={styles.dropdownLink} onClick={() => setIsDropdownOpen(false)} style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>
                        Admin Panel
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
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <Link
            href="/"
            onClick={() => setIsMobileOpen(false)}
            style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 600 }}
          >
            Home
          </Link>
          <Link
            href="/books"
            onClick={() => setIsMobileOpen(false)}
            style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 600 }}
          >
            Books
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
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  onClick={() => setIsMobileOpen(false)}
                  style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 600, color: 'var(--accent-gold)' }}
                >
                  Admin Panel
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
    </>
  );
}
