'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Course, useApp } from '../context/AppContext';

interface CourseCardProps {
  course: Course;
}

export default function CourseCard({ course }: CourseCardProps) {
  const { enrolledCourses } = useApp();
  const isFree = course.price === 0;
  const isEnrolled = enrolledCourses.includes(course.id);

  return (
    <div className="glass-card book-card-item">
      {/* Cover Image */}
      <div className="book-card-cover-container">
        <Image
          src={course.coverUrl && course.coverUrl.includes('b-cdn.net') ? `/api/cover/courses/${course.id}` : (course.coverUrl || '/noor_logo.png')}
          alt={course.title}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          className="book-card-cover-img"
          onError={(e) => { (e.target as HTMLImageElement).src = '/noor_logo.png'; }}
        />
        
        {/* Status Badge */}
        <div className="book-card-badge-container">
          <span className="badge badge-gold" style={{ marginBottom: '0.25rem' }}>Course</span>
          {isFree ? (
            <span className="badge badge-free">Free</span>
          ) : isEnrolled ? (
            <span className="badge badge-gold">Enrolled</span>
          ) : (
            <span className="badge badge-premium">Premium</span>
          )}
        </div>
      </div>

      {/* Course details */}
      <div className="book-card-details">
        <span className="book-card-category">{course.category}</span>
        <h3 className="book-card-title">{course.title}</h3>
        <p className="book-card-author">Instructor: {course.instructor}</p>

        <div className="book-card-meta-row">
          <span className="book-card-pages">{course.lessons?.length || 0} lessons</span>
          <span className="book-card-price">
            {isFree ? <span style={{ color: 'var(--accent-gold)' }}>Free</span> : `₦${course.price.toLocaleString()}`}
          </span>
        </div>

        {(() => {
          const handleShare = async (e: React.MouseEvent) => {
            e.preventDefault();
            const shareData = {
              title: `${course.title} by ${course.instructor}`,
              text: `Enroll in "${course.title}" by ${course.instructor} on Noor Library!`,
              url: `${window.location.origin}/courses/${course.id}`
            };

            if (navigator.share) {
              try {
                await navigator.share(shareData);
              } catch {
                // Share cancelled or failed silently
              }
            } else {
              try {
                await navigator.clipboard.writeText(shareData.url);
                alert('Course link copied to clipboard!');
              } catch {
                // Clipboard not available
              }
            }
          };

          return (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <Link href={`/courses/${course.id}`} className="btn btn-secondary book-card-btn" style={{ flex: 1, marginTop: 0 }}>
                View Course
              </Link>
              <button
                onClick={handleShare}
                className="btn btn-secondary"
                style={{ padding: '0.6rem', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Share Course"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
