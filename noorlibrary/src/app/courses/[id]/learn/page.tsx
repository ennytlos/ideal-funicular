'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useApp, Lesson } from '../../../../context/AppContext';
import CommentsSection from '../../../../components/CommentsSection';

function compressImage(file: File, maxMb = 2, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 1600;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          if (!blob) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
}

function AssignmentSubmitter({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { mySubmissions, submitAssignment } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);

  const submission = mySubmissions.find(s => s.courseId === courseId && s.lessonId === lessonId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.type.startsWith('image/')) {
        setError('Please select an image file (PNG, JPG, etc.)');
        setFile(null);
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsCompressing(true);
    setError(null);

    try {
      const compressed = await compressImage(file, 2, 0.8);
      setIsCompressing(false);
      setIsUploading(true);

      const formData = new FormData();
      formData.append('file', compressed);
      formData.append('type', 'submission');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to upload to server');
      }

      const data = await res.json();
      if (!data.url || !data.path) {
        throw new Error('Invalid response from upload API');
      }

      await submitAssignment(courseId, lessonId, data.url, data.path);
      setFile(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setIsCompressing(false);
      setIsUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {submission ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div 
              onClick={() => setShowLightbox(true)}
              style={{ 
                position: 'relative', 
                width: '120px', 
                height: '90px', 
                borderRadius: '8px', 
                overflow: 'hidden', 
                border: '2px solid var(--accent-gold)', 
                cursor: 'pointer',
                background: '#000',
                transition: 'transform 0.2s ease'
              }}
              className="submission-thumbnail"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={submission.imageUrl} 
                alt="Your submission" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
              <div style={{ 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                background: 'rgba(0,0,0,0.6)', 
                color: '#fff', 
                fontSize: '0.7rem', 
                textAlign: 'center', 
                padding: '2px 0' 
              }}>
                Click to view
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ color: 'var(--accent-gold)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Submitted Successfully
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                On {new Date(submission.submittedAt).toLocaleString()}
              </span>
            </div>
          </div>

          <details style={{ marginTop: '0.5rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500, outline: 'none' }}>
              Resubmit Assignment
            </summary>
            <form onSubmit={handleSubmit} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                className="form-input"
                style={{ padding: '0.5rem' }} 
              />
              {file && (
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ width: 'fit-content' }}
                  disabled={isCompressing || isUploading}
                >
                  {isCompressing ? 'Compressing Image...' : isUploading ? 'Uploading...' : 'Replace Submission'}
                </button>
              )}
            </form>
          </details>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ 
            border: '2px dashed var(--border-color)', 
            borderRadius: '8px', 
            padding: '2rem', 
            textAlign: 'center',
            background: 'var(--bg-primary)',
            cursor: 'pointer',
            position: 'relative'
          }}>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange} 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                opacity: 0, 
                cursor: 'pointer' 
              }} 
            />
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ marginBottom: '0.5rem' }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
              {file ? file.name : 'Click or Drag photo here to upload'}
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Supports JPG, PNG (Max size: 2MB - compressed automatically)
            </p>
          </div>

          {file && (
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ width: 'fit-content', alignSelf: 'flex-start' }}
              disabled={isCompressing || isUploading}
            >
              {isCompressing ? 'Compressing...' : isUploading ? 'Submitting...' : 'Submit Assignment'}
            </button>
          )}
        </form>
      )}

      {error && (
        <p style={{ color: 'var(--accent-red)', margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>
          {error}
        </p>
      )}

      {showLightbox && submission && (
        <div 
          onClick={() => setShowLightbox(false)}
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
              src={submission.imageUrl} 
              alt="Submission Preview" 
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 5px 25px rgba(0,0,0,0.5)' }} 
            />
            <button 
              onClick={() => setShowLightbox(false)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '2rem',
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

export default function LearningPortalPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { courses, user, enrolledCourses, courseProgress, updateCourseProgress } = useApp();

  const courseId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const course = courses.find(c => c.id === courseId);

  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Helper to convert standard watch URLs to embed format for iFrame rendering
  const getEmbedUrl = (url: string): string => {
    if (!url) return '';
    if (url.includes('/embed/')) return url;
    
    // Regular expressions to match YouTube watch page URLs
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);

    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}`;
    }

    return url;
  };

  const getPdfSrc = (lesson: Lesson): string => {
    if (!lesson.pdfPath || !course) return '';
    if (lesson.pdfPath.startsWith('http') || lesson.pdfPath.startsWith('//')) {
      return lesson.pdfPath;
    }
    return `/api/download?type=lesson&courseId=${course.id}&lessonId=${lesson.id}&content=true`;
  };

  const getAudioSrc = (lesson: Lesson): string => {
    if (!lesson.audioUrl || !course) return '';
    if (lesson.audioUrl.startsWith('http') || lesson.audioUrl.startsWith('//')) {
      return lesson.audioUrl;
    }
    return `/api/download?type=lesson&courseId=${course.id}&lessonId=${lesson.id}&content=true`;
  };

  useEffect(() => {
    if (!course) return;
    
    // Redirect non-enrolled users
    if (!enrolledCourses.includes(course.id)) {
      alert("You must enroll in this course to access the learning portal.");
      router.push(`/courses/${course.id}`);
      return;
    }

    const lessonIdParam = searchParams?.get('lessonId');
    let lessonToLoad = course.lessons?.[0] || null;

    if (lessonIdParam) {
      const found = course.lessons?.find(l => l.id === lessonIdParam);
      if (found) lessonToLoad = found;
    } else {
      // If no param, try to load first uncompleted lesson, or just first lesson
      const completed = courseProgress[course.id] || [];
      const uncompleted = course.lessons?.slice().sort((a,b) => a.lessonNumber - b.lessonNumber).find(l => !completed.includes(l.id));
      if (uncompleted) lessonToLoad = uncompleted;
    }

    if (lessonToLoad && (!activeLesson || activeLesson.id !== lessonToLoad.id)) {
      setActiveLesson(lessonToLoad);
    }
  }, [course, searchParams, enrolledCourses, router, courseProgress, activeLesson]);

  if (!course) {
    return (
      <div className="container" style={{ paddingTop: '8rem', textAlign: 'center' }}>
        <h2>Course not found</h2>
      </div>
    );
  }

  const completedLessons = courseProgress[course.id] || [];
  const sortedLessons = [...(course.lessons || [])].sort((a,b) => a.lessonNumber - b.lessonNumber);
  const isCurrentLessonCompleted = activeLesson ? completedLessons.includes(activeLesson.id) : false;

  const handleLessonSelect = (les: Lesson) => {
    router.push(`/courses/${course.id}/learn?lessonId=${les.id}`);
    setIsMobileSidebarOpen(false); // Auto-close drawer on selection for mobile devices
  };

  const handleMarkComplete = async () => {
    if (!activeLesson) return;
    await updateCourseProgress(course.id, activeLesson.id);
    
    // Find next lesson
    const currentIndex = sortedLessons.findIndex(l => l.id === activeLesson.id);
    if (currentIndex >= 0 && currentIndex < sortedLessons.length - 1) {
      const nextLesson = sortedLessons[currentIndex + 1];
      router.push(`/courses/${course.id}/learn?lessonId=${nextLesson.id}`);
    }
  };

  const progressPercentage = sortedLessons.length > 0 
    ? Math.round((completedLessons.length / sortedLessons.length) * 100) 
    : 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', paddingTop: '80px' }}>
      <style>{`
        .syllabus-sidebar {
          width: 300px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          overflow-y: auto;
          position: fixed;
          top: 80px;
          bottom: 0;
          left: 0;
          z-index: 100;
          transition: transform 0.3s ease;
        }
        .learning-portal-main {
          flex: 1;
          margin-left: 300px;
          padding: 2rem 4rem;
          background: var(--bg-primary);
          overflow-y: auto;
        }
        .mobile-toggle-bar {
          display: none !important;
        }
        .mobile-close-btn {
          display: none !important;
        }
        
        @media (max-width: 992px) {
          .syllabus-sidebar {
            position: fixed !important;
            top: 0 !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 280px !important;
            height: 100vh !important;
            z-index: 1001 !important;
            transform: translateX(-100%);
            box-shadow: 5px 0 15px rgba(0,0,0,0.3);
          }
          .syllabus-sidebar.open {
            transform: translateX(0) !important;
          }
          .learning-portal-main {
            margin-left: 0 !important;
            padding: 1.5rem 1rem !important;
          }
          .mobile-toggle-bar {
            display: flex !important;
            align-items: center;
            padding: 1rem;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
          }
          .mobile-close-btn {
            display: block !important;
          }
        }
      `}</style>

      {/* Backdrop overlay for mobile drawer */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000
          }}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`syllabus-sidebar ${isMobileSidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <button 
              onClick={() => router.push(`/courses/${course.id}`)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
            >
              &larr; Back to Course Info
            </button>
            <button 
              className="mobile-close-btn"
              onClick={() => setIsMobileSidebarOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem', cursor: 'pointer', padding: 0 }}
            >
              &times;
            </button>
          </div>
          <h2 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', marginBottom: '0.5rem', lineHeight: 1.3 }}>{course.title}</h2>
          
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
              <span>Progress</span>
              <span>{progressPercentage}%</span>
            </div>
            <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPercentage}%`, background: 'var(--accent-gold)', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {sortedLessons.map(les => {
            const isCompleted = completedLessons.includes(les.id);
            const isActive = activeLesson?.id === les.id;
            
            return (
              <li key={les.id}>
                <button
                  onClick={() => handleLessonSelect(les)}
                  style={{
                    width: '100%',
                    padding: '1rem 1.5rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    background: isActive ? 'var(--bg-primary)' : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '4px solid var(--accent-red)' : '4px solid transparent',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ 
                    color: isCompleted ? 'var(--accent-gold)' : 'var(--text-muted)', 
                    marginTop: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {isCompleted ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Lesson {les.lessonNumber}</div>
                    <div style={{ fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {les.title}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="learning-portal-main">
        {/* Mobile Sidebar Toggle Bar */}
        <div className="mobile-toggle-bar">
          <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            Show Syllabus ({course.lessons?.length || 0} Lessons)
          </button>
        </div>

        {activeLesson ? (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
              <span className="badge badge-gold" style={{ marginBottom: '1rem' }}>Lesson {activeLesson.lessonNumber}</span>
              <h1 style={{ fontFamily: 'Outfit', fontSize: '2.5rem', marginBottom: '0.5rem', lineHeight: 1.2 }}>{activeLesson.title}</h1>
              {activeLesson.description && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.6, marginTop: '0.5rem', marginBottom: 0 }}>
                  {activeLesson.description}
                </p>
              )}
            </div>

            {/* Content Renderer */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
              {activeLesson.contentType === 'video' && activeLesson.videoUrl && (
                <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                  <iframe 
                    src={getEmbedUrl(activeLesson.videoUrl)} 
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                  />
                </div>
              )}
              
              {activeLesson.contentType === 'pdf' && activeLesson.pdfPath && (
                <div style={{ height: '800px' }}>
                  <iframe 
                    src={getPdfSrc(activeLesson)} 
                    style={{ width: '100%', height: '100%', border: 0 }}
                    title={activeLesson.title}
                  />
                </div>
              )}

              {activeLesson.contentType === 'audio' && activeLesson.audioUrl && (
                <div style={{ 
                  padding: '3rem 2rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  background: 'var(--bg-tertiary)',
                  gap: '1.5rem'
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'var(--accent-red-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(229, 9, 20, 0.3)',
                    color: 'white',
                    marginBottom: '0.5rem'
                  }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>{activeLesson.title}</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>Audio Class Player</p>
                  </div>

                  <audio 
                    controls 
                    src={getAudioSrc(activeLesson)}
                    style={{ 
                      width: '100%', 
                      maxWidth: '500px', 
                      marginTop: '0.5rem',
                      outline: 'none'
                    }} 
                    controlsList="nodownload"
                  />
                </div>
              )}

              {activeLesson.contentType === 'plaintext' && activeLesson.plainTextContent && (
                <div style={{ padding: '2rem', lineHeight: 1.8, fontSize: '1.1rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {activeLesson.plainTextContent}
                </div>
              )}
            </div>

            {/* Attachments Section */}
            {(activeLesson.attachmentPath || course.attachmentPath) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <h3 style={{ fontFamily: 'Outfit', fontSize: '1.5rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Lesson Materials & Resources</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  
                  {activeLesson.attachmentPath && (
                    <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Lesson Attachment</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        File: {activeLesson.attachmentName}
                      </span>
                      <a 
                        href={`/api/download?type=lesson&courseId=${course.id}&lessonId=${activeLesson.id}`}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem', textDecoration: 'none', width: 'fit-content' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download Resource
                      </a>
                    </div>
                  )}

                  {course.attachmentPath && (
                    <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>General Course Attachment</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        File: {course.attachmentName}
                      </span>
                      <a 
                        href={`/api/download?type=course&id=${course.id}`}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem', textDecoration: 'none', width: 'fit-content' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download Course Resource
                      </a>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
              <div>
                {isCurrentLessonCompleted ? (
                  <span style={{ color: 'var(--accent-gold)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Completed
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Mark as complete to track your progress</span>
                )}
              </div>
              <button 
                className={`btn ${isCurrentLessonCompleted ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleMarkComplete}
                disabled={isCurrentLessonCompleted}
              >
                {isCurrentLessonCompleted ? 'Lesson Completed' : 'Mark as Complete & Continue'}
              </button>
            </div>

            {/* Assignment Section */}
            {activeLesson.assignment && (
              <div style={{ marginTop: '2rem', marginBottom: '2rem', padding: '2rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  <h3 style={{ fontFamily: 'Outfit', fontSize: '1.5rem', margin: 0, color: 'var(--text-primary)' }}>Lesson Assignment</h3>
                </div>
                
                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1.5rem', fontSize: '1.05rem' }}>
                  {activeLesson.assignment.description}
                </div>

                {activeLesson.assignment.attachmentPath && (
                  <div style={{ marginBottom: '2rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activeLesson.assignment.attachmentName}
                      </span>
                    </div>
                    <a 
                      href={`/api/download?type=lesson&courseId=${course.id}&lessonId=${activeLesson.id}&assignment=true`}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download Material
                    </a>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                  <h4 style={{ fontFamily: 'Outfit', fontSize: '1.15rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Your Submission</h4>
                  
                  <AssignmentSubmitter courseId={course.id} lessonId={activeLesson.id} />
                </div>
              </div>
            )}

            {/* Comments Section */}
            <CommentsSection courseId={course.id} lessonId={activeLesson.id} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-muted)' }}>
            Select a lesson from the sidebar to begin.
          </div>
        )}
      </main>
    </div>
  );
}
