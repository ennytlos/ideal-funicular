'use client';

import React, { useState, useMemo } from 'react';
import { useApp, Course } from '../context/AppContext';
import CourseCard from './CourseCard';

interface CoursesClientPageProps {
  initialCourses: Course[];
}

export default function CoursesClientPage({ initialCourses = [] }: CoursesClientPageProps) {
  const { courses: liveCourses } = useApp();
  const [pageSize, setPageSize] = useState(6);

  const courses = useMemo(() => {
    return liveCourses && liveCourses.length > 0 ? liveCourses : initialCourses;
  }, [liveCourses, initialCourses]);

  const activeCourses = useMemo(() => {
    return courses.filter((course) => course.isPaid === true && course.isPublished !== false);
  }, [courses]);

  return (
    <div className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem', flex: 1 }}>
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontFamily: 'Outfit', fontSize: '3rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
          Islamic <span style={{ color: 'var(--accent-red)' }}>Courses</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Structured learning management portal for courses and study circles. Deepen your knowledge with structured curricula.
        </p>
      </div>

      <div className="books-catalog-grid">
        {activeCourses.slice(0, pageSize).map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
        {activeCourses.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', gridColumn: '1 / -1' }}>
            No courses available at the moment.
          </p>
        )}
      </div>

      {activeCourses.length > pageSize && (
        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <button onClick={() => setPageSize(prev => prev + 6)} className="btn btn-secondary" style={{ padding: '0.75rem 2rem', borderRadius: '30px' }}>
            Load More Courses
          </button>
        </div>
      )}
    </div>
  );
}
