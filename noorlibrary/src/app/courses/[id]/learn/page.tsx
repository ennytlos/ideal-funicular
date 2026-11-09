'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useApp, Lesson } from '../../../../context/AppContext';
import CommentsSection from '../../../../components/CommentsSection';
import { ReportContentButton } from '../../../../components/ReportContentModal';

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
  const submission = mySubmissions.find(s => s.courseId === courseId && s.lessonId === lessonId);

  const [textAnswer, setTextAnswer] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);

  useEffect(() => {
    setTextAnswer(submission?.textAnswer || '');
    setFile(null);
    setError(null);
  }, [courseId, lessonId, submission?.textAnswer]);

  const MAX_SUBMISSION_FILE_BYTES = 5 * 1024 * 1024; // 5MB cap

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const isImage = selected.type.startsWith('image/');
      const isDoc =
        selected.type === 'application/pdf' ||
        selected.type === 'text/plain' ||
        selected.type === 'application/msword' ||
        selected.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        /\.(jpg|jpeg|png|webp|gif|pdf|doc|docx|txt)$/i.test(selected.name);

      if (!isImage && !isDoc) {
        setError('Please select an image (JPG, PNG, WEBP) or document file (PDF, DOC, DOCX, TXT).');
        setFile(null);
        return;
      }
      if (selected.size > MAX_SUBMISSION_FILE_BYTES) {
        setError(`File size (${(selected.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 5MB maximum limit.`);
        setFile(null);
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !textAnswer.trim()) {
      setError('Please write your response or attach an image/file before submitting.');
      return;
    }

    setError(null);

    try {
      let uploadedUrl = submission?.imageUrl || '';
      let uploadedPath = submission?.imagePath || '';

      if (file) {
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
          setIsCompressing(true);
          fileToUpload = await compressImage(file, 2, 0.85);
          setIsCompressing(false);
        }
        if (fileToUpload.size > MAX_SUBMISSION_FILE_BYTES) {
          throw new Error('Selected file exceeds the 5MB maximum size limit.');
        }
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('type', 'submission');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to upload');
        }

        const data = await res.json();
        if (!data.url || !data.path) {
          throw new Error('Invalid response from upload API');
        }
        uploadedUrl = data.url;
        uploadedPath = data.path;
      } else {
        setIsUploading(true);
      }

      await submitAssignment(courseId, lessonId, uploadedUrl, uploadedPath, textAnswer.trim());
      setFile(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setIsCompressing(false);
      setIsUploading(false);
    }
  };

  const isSubmittedDocFile = submission?.imageUrl
    ? /\.(pdf|doc|docx|txt)(\?|$)/i.test(submission.imageUrl)
    : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {submission ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {submission.imageUrl ? (
              isSubmittedDocFile ? (
                <a
                  href={submission.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    border: '1.5px solid var(--accent-gold)',
                    color: 'var(--accent-gold)',
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  📄 View Attached Submission Document
                </a>
              ) : (
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
              )
            ) : null}
            
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

          {submission.textAnswer ? (
            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              whiteSpace: 'pre-wrap',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              color: 'var(--text-primary)'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-gold)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                Your Written Response
              </div>
              {submission.textAnswer}
            </div>
          ) : null}

          <details style={{ marginTop: '0.5rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500, outline: 'none' }}>
              Edit / Resubmit Assignment
            </summary>
            <form onSubmit={handleSubmit} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <textarea
                rows={4}
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="Write or update your assignment reflection here..."
                className="form-input"
                style={{ padding: '0.75rem', resize: 'vertical' }}
              />
              <input 
                type="file" 
                accept="image/*,.pdf,.doc,.docx,.txt" 
                onChange={handleFileChange} 
                className="form-input"
                style={{ padding: '0.5rem' }} 
              />
              {(file || textAnswer.trim() !== (submission.textAnswer || '')) && (
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ width: 'fit-content' }}
                  disabled={isCompressing || isUploading}
                >
                  {isCompressing ? 'Compressing Image...' : isUploading ? 'Uploading...' : 'Update Submission'}
                </button>
              )}
            </form>
          </details>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <textarea
            rows={4}
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder="Write your assignment answer or reflection here..."
            className="form-input"
            style={{ padding: '0.85rem', resize: 'vertical', fontSize: '0.95rem', lineHeight: 1.6 }}
          />
          <div style={{ 
            border: '2px dashed var(--border-color)', 
            borderRadius: '8px', 
            padding: '1.5rem', 
            textAlign: 'center',
            background: 'var(--bg-primary)',
            cursor: 'pointer',
            position: 'relative'
          }}>
            <input 
              type="file" 
              accept="image/*,.pdf,.doc,.docx,.txt" 
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
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ marginBottom: '0.4rem' }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              {file ? `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)` : 'Optional: Click or drag an image or document file to attach'}
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Supports JPG, PNG, PDF, DOC, DOCX, TXT (Max size: 5MB)
            </p>
          </div>

          {(file || textAnswer.trim().length > 0) && (
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ width: 'fit-content', alignSelf: 'flex-start' }}
              disabled={isCompressing || isUploading}
            >
              {isCompressing ? 'Compressing...' : isUploading ? 'Uploading...' : 'Submit Assignment'}
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
  const { courses, user, enrolledCourses, enrollCourse, courseProgress, updateCourseProgress } = useApp();

  const courseId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const course = courses.find(c => c.id === courseId);

  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const autoEnrollAttemptedRef = useRef<Set<string>>(new Set());
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMediaFullscreen, setIsMediaFullscreen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMediaFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Helper to resolve relative Bunny CDN paths or full URLs
  const resolveBunnyMediaUrl = (rawUrl?: string): string => {
    if (!rawUrl) return '';
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
      return trimmed;
    }
    return `https://noorlibrary.b-cdn.net/${trimmed.replace(/^\/+/, '')}`;
  };

  // Helper to check if a video URL is a direct video file (e.g. Bunny CDN .mp4) vs an iframe embed
  const isDirectVideoFile = (url: string): boolean => {
    const resolved = resolveBunnyMediaUrl(url);
    const clean = resolved.split('?')[0].toLowerCase();
    if (
      clean.endsWith('.mp4') ||
      clean.endsWith('.m4v') ||
      clean.endsWith('.webm') ||
      clean.endsWith('.mov') ||
      clean.endsWith('.m3u8') ||
      clean.endsWith('.ogg')
    ) {
      return true;
    }
    if (
      resolved.includes('b-cdn.net/') &&
      !resolved.includes('iframe.mediadelivery.net') &&
      !resolved.includes('/embed/')
    ) {
      return true;
    }
    return false;
  };

  // Helper to convert standard watch URLs to embed format for iFrame rendering
  const getEmbedUrl = (url: string): string => {
    const resolved = resolveBunnyMediaUrl(url);
    if (!resolved) return '';
    if (resolved.includes('/embed/')) return resolved;
    
    // Regular expressions to match YouTube watch/short/live URLs
    const regExp = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/;
    const match = resolved.match(regExp);

    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`;
    }

    return resolved;
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

    const isFree = (Number(course.price) || 0) === 0;
    const isCreatorOrAdmin =
      user?.role === 'admin' ||
      (user?.role === 'creator' && course.creatorId === user?.uid);
    const isSubActive = Boolean(
      user?.subscriptions &&
        user.subscriptions[course.id] &&
        user.subscriptions[course.id] > Date.now()
    );
    const isEnrolled = enrolledCourses.includes(course.id);

    if (isFree && user && !isEnrolled && !autoEnrollAttemptedRef.current.has(course.id)) {
      // Attempt once per course so a failed claim can never trigger a request loop
      autoEnrollAttemptedRef.current.add(course.id);
      void enrollCourse(course.id);
    }

    // Redirect non-enrolled users who do not have free/creator/subscription access
    if (!isEnrolled && !isFree && !isCreatorOrAdmin && !isSubActive) {
      alert("You must enroll in this course to access the learning portal.");
      router.push(`/courses/${course.id}`);
      return;
    }

    const lessonIdParam = searchParams?.get('lessonId') || searchParams?.get('lesson');
    if (lessonIdParam) {
      const found = course.lessons?.find(
        l => l.id === lessonIdParam || String(l.lessonNumber) === lessonIdParam
      );
      if (found && (!activeLesson || activeLesson.id !== found.id)) {
        setActiveLesson(found);
      }
    }
  }, [course, searchParams, enrolledCourses, enrollCourse, user, router, activeLesson]);

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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                <span className="badge badge-gold" style={{ margin: 0 }}>Lesson {activeLesson.lessonNumber}</span>
                <ReportContentButton
                  contentId={`${course.id}_lesson_${activeLesson.id}`}
                  contentTitle={`${course.title} - Lesson ${activeLesson.lessonNumber}: ${activeLesson.title}`}
                  contentType="course"
                  compact
                  label="Report Lesson"
                />
              </div>
              <h1 style={{ fontFamily: 'Outfit', fontSize: '2.5rem', marginBottom: '0.5rem', lineHeight: 1.2 }}>{activeLesson.title}</h1>
              {activeLesson.description && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.6, marginTop: '0.5rem', marginBottom: 0 }}>
                  {activeLesson.description}
                </p>
              )}
            </div>

            {/* Distinct Content Renderer Viewport (Full-Screenable for non-audio & non-PDF lessons) */}
            <div style={
              isMediaFullscreen && activeLesson.contentType !== 'audio' && activeLesson.contentType !== 'pdf'
                ? {
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: activeLesson.contentType === 'video' ? '#000' : 'var(--bg-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }
                : {
                    background: 'var(--bg-secondary)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1.5px solid var(--border-color)',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.14)',
                    marginBottom: '2rem',
                  }
            }>
              {/* Viewport Frame Top Header Bar */}
              <div
                onClick={() => {
                  if (activeLesson.contentType !== 'audio' && activeLesson.contentType !== 'pdf') {
                    setIsMediaFullscreen(prev => !prev);
                  }
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1.25rem',
                  background: isMediaFullscreen ? 'rgba(15, 23, 42, 0.95)' : 'var(--bg-tertiary)',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: activeLesson.contentType !== 'audio' && activeLesson.contentType !== 'pdf' ? 'pointer' : 'default',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--accent-red)',
                    display: 'inline-block',
                  }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', color: isMediaFullscreen ? '#fff' : 'var(--text-primary)' }}>
                    LESSON {activeLesson.lessonNumber} • {activeLesson.contentType.toUpperCase()}
                  </span>
                </div>

                {activeLesson.contentType !== 'audio' && activeLesson.contentType !== 'pdf' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMediaFullscreen(prev => !prev);
                    }}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.3rem 0.75rem',
                      fontSize: '0.78rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      borderRadius: '999px',
                      color: isMediaFullscreen ? '#fff' : 'var(--accent-gold)',
                      borderColor: 'var(--accent-gold)',
                      background: 'rgba(212, 175, 55, 0.12)',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      {isMediaFullscreen ? (
                        <>
                          <polyline points="4 14 10 14 10 20" />
                          <polyline points="20 10 14 10 14 4" />
                          <line x1="14" y1="10" x2="21" y2="3" />
                          <line x1="3" y1="21" x2="10" y2="14" />
                        </>
                      ) : (
                        <>
                          <polyline points="15 3 21 3 21 9" />
                          <polyline points="9 21 3 21 3 15" />
                          <line x1="21" y1="3" x2="14" y2="10" />
                          <line x1="3" y1="21" x2="10" y2="14" />
                        </>
                      )}
                    </svg>
                    {isMediaFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen'}
                  </button>
                )}
              </div>

              {activeLesson.contentType === 'video' && activeLesson.videoUrl && (
                isDirectVideoFile(activeLesson.videoUrl) ? (
                  <div style={{ background: '#000', width: '100%', flex: isMediaFullscreen ? 1 : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <video
                      key={activeLesson.videoUrl}
                      controls
                      playsInline
                      controlsList="nodownload"
                      preload="metadata"
                      src={resolveBunnyMediaUrl(activeLesson.videoUrl)}
                      style={{ width: '100%', maxHeight: isMediaFullscreen ? 'calc(100vh - 56px)' : '540px', display: 'block', background: '#000' }}
                    />
                  </div>
                ) : (
                  <div style={isMediaFullscreen ? { position: 'relative', flex: 1, width: '100%', height: 'calc(100vh - 56px)', background: '#000' } : { position: 'relative', paddingTop: '56.25%', background: '#000' }}>
                    <iframe 
                      src={getEmbedUrl(activeLesson.videoUrl)} 
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" 
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  </div>
                )
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
                <div
                  onClick={() => {
                    if (!isMediaFullscreen) setIsMediaFullscreen(true);
                  }}
                  title={isMediaFullscreen ? undefined : 'Click to expand lesson notes to Full Screen'}
                  style={{
                    padding: isMediaFullscreen ? '3rem 12%' : '2rem',
                    lineHeight: 1.85,
                    fontSize: isMediaFullscreen ? '1.2rem' : '1.1rem',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                    overflowY: isMediaFullscreen ? 'auto' : undefined,
                    flex: isMediaFullscreen ? 1 : undefined,
                    cursor: isMediaFullscreen ? 'default' : 'zoom-in',
                  }}
                >
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
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              border: '1.5px solid var(--border-color)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.14)',
              padding: '4rem 2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(229, 9, 20, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-red)'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              </div>
              <h2 style={{ fontFamily: 'Outfit', fontSize: '1.6rem', margin: 0, color: 'var(--text-primary)' }}>
                Select a Lesson to Begin Learning
              </h2>
              <p style={{ maxWidth: '480px', color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6, margin: 0 }}>
                Choose any lesson from the course syllabus to display its text notes, audio recitation, video lecture, or PDF study guide inside this viewport.
              </p>
              {sortedLessons.length > 0 && (
                <button
                  onClick={() => handleLessonSelect(sortedLessons.find(l => !completedLessons.includes(l.id)) || sortedLessons[0])}
                  className="btn btn-primary"
                  style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  {completedLessons.length > 0 ? 'Resume Next Lesson' : 'Start Lesson 1'}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
