'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useApp, AssignmentSubmission } from '../../context/AppContext';
import { getPrivacySafeFullName } from './AudienceTab';

export default function ViewSubmissionsTab() {
  const { courses, user } = useApp();
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('all');
  const [nameSearch, setNameSearch] = useState<string>('');
  
  // Lightbox
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);

  // Live listen to all submissions & map user display names (privacy-safe: names only, no email)
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'submissions'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const fetched: AssignmentSubmission[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<AssignmentSubmission, 'id'>)
      }));
      // Sort newest first
      fetched.sort((a, b) => b.submittedAt - a.submittedAt);
      setSubmissions(fetched);
      setLoading(false);
    }, (err) => {
      console.error("Failed to load submissions for admin:", err);
      setLoading(false);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const map: Record<string, string> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        map[d.id] = getPrivacySafeFullName({
          displayName: data.displayName,
          name: data.name,
          email: data.email,
        });
      });
      setUserNameMap(map);
    });

    return () => {
      unsubscribe();
      unsubUsers();
    };
  }, []);

  const getLearnerName = (sub: AssignmentSubmission): string => {
    if ((sub as any).userName && !(sub as any).userName.includes('@')) {
      return (sub as any).userName;
    }
    if (sub.userId && userNameMap[sub.userId]) {
      return userNameMap[sub.userId];
    }
    return getPrivacySafeFullName({
      displayName: (sub as any).userName,
      email: sub.userEmail,
    });
  };

  // Get active lessons for the selected course filter
  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const filterLessons = selectedCourse ? [...(selectedCourse.lessons || [])].sort((a, b) => a.lessonNumber - b.lessonNumber) : [];

  // Reset lesson filter if course filter changes
  useEffect(() => {
    setSelectedLessonId('all');
  }, [selectedCourseId]);

  // Filter submissions
  const filteredSubmissions = submissions.filter(sub => {
    const course = courses.find(c => c.id === sub.courseId);
    if (!course) return false;
    
    const isCreator = course.creatorId === user?.uid || 
      (user?.role === 'admin' && (!course.creatorId || course.creatorId === 'admin' || course.creatorId === user?.uid));
      
    if (!isCreator) return false;

    if (selectedCourseId !== 'all' && sub.courseId !== selectedCourseId) return false;
    if (selectedLessonId !== 'all' && sub.lessonId !== selectedLessonId) return false;
    if (nameSearch && !getLearnerName(sub).toLowerCase().includes(nameSearch.toLowerCase())) return false;
    return true;
  });

  const handleDelete = async (sub: AssignmentSubmission) => {
    if (confirm("Are you sure you want to delete this submission? This will also remove the image file from Bunny.net.")) {
      try {
        // Delete file from Bunny
        if (sub.imagePath) {
          await fetch(`/api/upload?path=${encodeURIComponent(sub.imagePath)}`, {
            method: 'DELETE'
          });
        }
        // Delete document from Firestore
        await deleteDoc(doc(db, 'submissions', sub.id));
      } catch (err) {
        alert("Failed to delete submission: " + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  const getCourseTitle = (courseId: string) => {
    const c = courses.find(item => item.id === courseId);
    return c ? c.title : 'Unknown Course';
  };

  const getLessonTitle = (courseId: string, lessonId: string) => {
    const c = courses.find(item => item.id === courseId);
    if (!c) return 'Unknown Lesson';
    const l = c.lessons?.find(item => item.id === lessonId);
    return l ? `Lesson ${l.lessonNumber}: ${l.title}` : 'Unknown Lesson';
  };

  return (
    <div>
      <div className="admin-header-row" style={{ marginBottom: '1.5rem' }}>
        <h1 className="admin-title-no-margin">Student Submissions</h1>
      </div>

      {/* Filters Bar */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="filter-course">Filter by Course</label>
          <select 
            id="filter-course" 
            className="form-input" 
            value={selectedCourseId} 
            onChange={e => setSelectedCourseId(e.target.value)}
          >
            <option value="all">All Courses</option>
            {courses
              .filter(c => c.creatorId === user?.uid || (user?.role === 'admin' && (!c.creatorId || c.creatorId === 'admin' || c.creatorId === user?.uid)))
              .map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))
            }
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="filter-lesson">Filter by Lesson</label>
          <select 
            id="filter-lesson" 
            className="form-input" 
            value={selectedLessonId} 
            onChange={e => setSelectedLessonId(e.target.value)}
            disabled={selectedCourseId === 'all'}
          >
            <option value="all">All Lessons</option>
            {filterLessons.map(l => (
              <option key={l.id} value={l.id}>Lesson {l.lessonNumber}: {l.title}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="search-name">Search Learner Name</label>
          <input 
            id="search-name" 
            type="text" 
            className="form-input" 
            placeholder="Search by student full name..." 
            value={nameSearch} 
            onChange={e => setNameSearch(e.target.value)} 
          />
        </div>
      </div>

      {/* Submissions Table */}
      <div className="glass-card admin-table-container">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading submissions...
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No assignment submissions found.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr className="admin-table-header-bg">
                <th className="admin-table-th">Learner Name</th>
                <th className="admin-table-th">Course</th>
                <th className="admin-table-th">Lesson</th>
                <th className="admin-table-th">Date</th>
                <th className="admin-table-th">Written Answer</th>
                <th className="admin-table-th">Attached File / Image</th>
                <th className="admin-table-th" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map(sub => {
                const isDocFile = sub.imageUrl
                  ? /\.(pdf|doc|docx|txt)(\?|$)/i.test(sub.imageUrl)
                  : false;
                return (
                <tr key={sub.id} className="admin-table-row">
                  <td className="admin-table-td-bold">{getLearnerName(sub)}</td>
                  <td className="admin-table-td-muted">{getCourseTitle(sub.courseId)}</td>
                  <td className="admin-table-td-muted">{getLessonTitle(sub.courseId, sub.lessonId)}</td>
                  <td className="admin-table-td-muted" style={{ fontSize: '0.85rem' }}>
                    {new Date(sub.submittedAt).toLocaleString()}
                  </td>
                  <td className="admin-table-td" style={{ maxWidth: '280px' }}>
                    {sub.textAnswer ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: '90px', overflowY: 'auto' }}>
                        {sub.textAnswer}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="admin-table-td">
                    {sub.imageUrl ? (
                      isDocFile ? (
                        <a
                          href={sub.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
                        >
                          📄 Open Document
                        </a>
                      ) : (
                        <div 
                          onClick={() => setActiveImageUrl(sub.imageUrl || null)}
                          style={{ 
                            width: '60px', 
                            height: '45px', 
                            borderRadius: '4px', 
                            overflow: 'hidden', 
                            border: '1px solid var(--border-color)', 
                            cursor: 'pointer',
                            background: '#000'
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={sub.imageUrl} 
                            alt="Submission thumbnail" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        </div>
                      )
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No attachment</span>
                    )}
                  </td>
                  <td className="admin-table-td admin-table-actions-cell" style={{ textAlign: 'right' }}>
                    <button 
                      onClick={() => handleDelete(sub)} 
                      className="admin-action-btn-danger"
                      style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Full screen Image Lightbox */}
      {activeImageUrl && (
        <div 
          onClick={() => setActiveImageUrl(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            cursor: 'zoom-out'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={activeImageUrl} 
              alt="Submission Preview Large" 
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 5px 25px rgba(0,0,0,0.5)' }} 
            />
            <button 
              onClick={() => setActiveImageUrl(null)}
              style={{
                position: 'absolute',
                top: '-45px',
                right: '0',
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '2.5rem',
                cursor: 'pointer'
              }}
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
