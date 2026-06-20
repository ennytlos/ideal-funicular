"use client";

import React from "react";
import Link from "next/link";
import { useApp } from "../context/AppContext";
import BookCard from "../components/BookCard";
import SeriesCard from "../components/SeriesCard";

export default function Home() {
  const { books, series } = useApp();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4rem",
        paddingBottom: "4rem",
      }}
    >
      {/* Hero Section */}
      <section
        style={{
          position: "relative",
          padding: "6rem 1.5rem",
          textAlign: "center",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "70vh",
          background:
            "linear-gradient(to bottom, rgba(248, 250, 252, 0) 0%, rgba(248, 250, 252, 1) 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "60vw",
            height: "60vw",
            background:
              "radial-gradient(circle, rgba(220, 38, 38, 0.15) 0%, rgba(0, 0, 0, 0) 70%)",
            zIndex: -1,
            pointerEvents: "none",
          }}
        />

        <h1
          style={{
            fontFamily: "Outfit",
            fontSize: "clamp(1.8rem, 6vw, 4.5rem)",
            fontWeight: 700,
            marginBottom: "1.5rem",
            lineHeight: 1.1,
            paddingTop:"40px"
          }}
        >
          Illuminating Minds with <br />
          <span
            style={{
              background: "var(--accent-red-gradient)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Authentic Knowledge
          </span>
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "clamp(1rem, 2vw, 1.25rem)",
            maxWidth: "600px",
            marginBottom: "2.5rem",
            lineHeight: 1.6,
          }}
        >
          Your digital sanctuary for profound Islamic writings. Dive into
          carefully curated texts, daily reflections, and comprehensive guides
          designed to enrich your faith and intellect.
        </p>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Link
            href="/books"
            className="btn btn-primary"
            style={{ padding: "0.875rem 2rem", fontSize: "1.1rem" }}
          >
            Start Reading
          </Link>
          <Link
            href="/about"
            className="btn btn-secondary"
            style={{ padding: "0.875rem 2rem", fontSize: "1.1rem" }}
          >
            Our Mission
          </Link>
        </div>
      </section>

      {/* Core Features: Quran & Adhkar Section */}
      <section className="container">
        <div
          style={{
            textAlign: "center",
            marginBottom: "2.5rem",
          }}
        >
          <h2
            style={{
              fontFamily: "Outfit",
              fontSize: "2.25rem",
              marginBottom: "0.5rem",
            }}
          >
            Sacred Texts & Remembrances
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Connect with the core of Islamic devotions and knowledge daily.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "2.5rem",
          }}
        >
          {/* Quran Card */}
          <div
            className="glass-card"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              padding: "3rem 2.25rem",
              height: "100%",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(220, 38, 38, 0.05) 100%)",
                border: "1px solid rgba(212, 175, 55, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.8rem",
                color: "var(--accent-gold)",
              }}
            >
              📖
            </div>
            <div>
              <h3 style={{ fontFamily: "Outfit", fontSize: "1.5rem", marginBottom: "0.75rem" }}>
                The Holy Quran
              </h3>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, fontSize: "0.95rem" }}>
                Access the complete Quran with beautiful Arabic typography, English translations, and detailed chapter metadata. Designed for high legibility and searchability.
              </p>
            </div>
            <div style={{ marginTop: "auto", paddingTop: "1rem" }}>
              <Link href="/quran" className="btn btn-gold" style={{ width: "100%", padding: "0.75rem" }}>
                Read the Quran
              </Link>
            </div>
          </div>

          {/* Adhkar Card */}
          <div
            className="glass-card"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              padding: "3rem 2.25rem",
              height: "100%",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%)",
                border: "1px solid rgba(79, 70, 229, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.8rem",
              }}
            >
              🌙
            </div>
            <div>
              <h3 style={{ fontFamily: "Outfit", fontSize: "1.5rem", marginBottom: "0.75rem" }}>
                Daily Remembrances
              </h3>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, fontSize: "0.95rem" }}>
                Practice morning and evening Adhkar with auto time-of-day detection. Track your supplications with satisfying tap-to-increment counters that save your progress.
              </p>
            </div>
            <div style={{ marginTop: "auto", paddingTop: "1rem" }}>
              <Link href="/adhkaar" className="btn btn-primary" style={{ width: "100%", padding: "0.75rem" }}>
                Open Daily Adhkar
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Books Section */}
      <section className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: "2.5rem",
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "Outfit",
                fontSize: "2rem",
                marginBottom: "0.5rem",
              }}
            >
              Featured Works
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              Handpicked selections to start your journey.
            </p>
          </div>
          <Link
            href="/books"
            className="viewAllLink"
          >
            <span className="viewAllText">View All</span>
            <span className="viewAllArrow">&rarr;</span>
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "2rem",
          }}
        >
          {books.slice(0, 2).map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
          {series.slice(0, 2).map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
      </section>

      {/* Quote / Highlight Section */}
      <section className="container" style={{ marginTop: "2rem" }}>
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
            padding: "4rem 2rem",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "4px",
              height: "100%",
              background: "var(--accent-gold)",
            }}
          />
          <h3
            style={{
              fontFamily: "Outfit",
              fontSize: "1.75rem",
              marginBottom: "1.5rem",
              color: "var(--accent-gold)",
            }}
          >
            Why Noor Library?
          </h3>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "1.1rem",
              maxWidth: "800px",
              margin: "0 auto",
              lineHeight: 1.8,
            }}
          >
            &quot;We believe that authentic knowledge should be accessible,
            beautifully presented, and transformative. Noor Library is built not
            just to host books, but to cultivate a reading experience that
            honors the profound tradition of Islamic scholarship.&quot;
          </p>
        </div>
      </section>
    </div>
  );
}
