'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useApp } from '../../../context/AppContext';
import AuthModal from '../../../components/AuthModal';
import { db } from '../../../lib/firebase';
import { doc, onSnapshot, setDoc, deleteDoc, collection, query, where } from 'firebase/firestore';

export default function CourseDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { courses, user, enrolledCourses, enrollCourse } = useApp();

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState<'stolen' | 'abusive' | 'inaccurate' | 'other'>('stolen');
  const [reportDetails, setReportDetails] = useState('');
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [followerCount, setFollowerCount] = useState<number>(0);

  const courseId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const course = courses.find(c => c.id === courseId);

  useEffect(() => {
    if (!user || !course?.creatorId) return;
    const followDocRef = doc(db, 'follows', `${user.uid}_${course.creatorId}`);
    const unsubscribe = onSnapshot(followDocRef, (snapshot) => {
      setIsFollowing(snapshot.exists());
    });
    return unsubscribe;
  }, [user, course?.creatorId]);

  useEffect(() => {
    if (!course?.creatorId) return;
    const q = query(collection(db, 'follows'), where('creatorId', '==', course.creatorId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFollowerCount(snapshot.size);
    }, (err) => {
      console.warn("Failed to listen to followers snapshot:", err);
    });
    return unsubscribe;
  }, [course?.creatorId]);

  const handleFollowToggle = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    if (!course?.creatorId) return;
    if (user.uid === course.creatorId) {
      alert("You cannot follow yourself.");
      return;
    }
    const followDocRef = doc(db, 'follows', `${user.uid}_${course.creatorId}`);
    try {
      if (isFollowing) {
        await deleteDoc(followDocRef);
      } else {
        await setDoc(followDocRef, {
          userId: user.uid,
          creatorId: course.creatorId,
          createdAt: Date.now()
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    setIsSendingReport(true);
    try {
      const reportRef = doc(collection(db, 'reports'));
      await setDoc(reportRef, {
        id: reportRef.id,
        contentId: course.id,
        contentTitle: course.title,
        contentType: 'course',
        reporterId: user.uid,
        reporterEmail: user.email,
        reason: reportReason,
        details: reportDetails,
        createdAt: Date.now(),
        status: 'pending'
      });
      alert('Report submitted successfully.');
      setIsReportModalOpen(false);
      setReportDetails('');
    } catch (err: any) {
      alert(err.message || 'Failed to submit report');
    } finally {
      setIsSendingReport(false);
    }
  };

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    if (!course.creatorId) return;
    setIsSendingMessage(true);
    try {
      const msgRef = doc(collection(db, 'messages'));
      await setDoc(msgRef, {
        id: msgRef.id,
        senderId: user.uid,
        senderName: user.displayName || user.email.split('@')[0],
        recipientId: course.creatorId,
        messageText: messageText,
        subject: messageSubject || `Inquiry about ${course.title}`,
        createdAt: Date.now()
      });
      
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        senderId: user.uid,
        senderName: user.displayName || user.email.split('@')[0],
        title: `New Message regarding: ${course.title}`,
        message: messageText.substring(0, 100),
        type: 'direct',
        targetId: course.creatorId,
        createdAt: Date.now()
      });

      alert('Message sent successfully to the instructor!');
      setIsMessageModalOpen(false);
      setMessageText('');
      setMessageSubject('');
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const isCreatorOrAdmin = user?.role === 'admin' || (user?.role === 'creator' && course?.creatorId === user?.uid);
  const isAccessible = course && (course.isPaid !== false || isCreatorOrAdmin);

  if (!course || !isAccessible) {
    return (
      <div className="container" style={{ paddingTop: '8rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontFamily: 'Outfit, sans-serif' }}>Course not found</h1>
        <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => router.push('/courses')}>
          Back to Courses
        </button>
      </div>
    );
  }

  const isFree = course.price === 0;
  const isEnrolled = enrolledCourses.includes(course.id);

  const isSubscription = course.paymentInterval === 'monthly' || course.paymentInterval === 'yearly';
  const isSubActive = (() => {
    if (user?.role === 'admin' || (user?.role === 'creator' && course.creatorId === user?.uid)) return true;
    if (user?.subscriptions && user.subscriptions[course.id]) {
      return user.subscriptions[course.id] > Date.now();
    }
    return false;
  })();
  const hasAccess = isFree || (isSubscription ? isSubActive : isEnrolled) || user?.role === 'admin' || (user?.role === 'creator' && course.creatorId === user?.uid);

  const handleEnrollment = async () => {
    if (!user) { setIsAuthOpen(true); return; }
    setIsProcessing(true);
    try {
      if (isFree) {
        await enrollCourse(course.id);
        router.push(`/courses/${course.id}/learn`);
      } else {
        const res = await fetch('/api/payment/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId: course.id, type: 'course' }),
        });
        const data = await res.json();
        if (data.url) window.location.assign(data.url);
        else throw new Error(data.error ?? 'Payment init failed');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Enrollment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartLearning = () => {
    router.push(`/courses/${course.id}/learn`);
  };

  return (
    <>
      <div className="container" style={{ paddingTop: '8rem', paddingBottom: '6rem' }}>
        <button 
          onClick={() => router.push('/courses')}
          className="btn btn-secondary"
          style={{ marginBottom: '2rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          &larr; Back to Courses
        </button>

        <div className="responsive-book-details">
          {/* Cover Column */}
          <div>
            <div className="glass-card" style={{ padding: '0.5rem', marginBottom: '2rem' }}>
              <div style={{ width: '100%', paddingBottom: '140%', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                <Image
                  src={course.coverUrl && course.coverUrl.includes('b-cdn.net') ? `/api/cover/courses/${course.id}` : (course.coverUrl || '/noor_logo.png')}
                  alt={course.title}
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="(max-width: 768px) 100vw, 400px"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/noor_logo.png'; }}
                />
                <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 2 }}>
                  <span className="badge badge-gold">Course</span>
                </div>
              </div>
            </div>

            <div className="accent-card">
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Enrollment Details</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Format</span>
                <span style={{ fontWeight: 600 }}>Interactive LMS</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Lessons</span>
                <span style={{ fontWeight: 600 }}>{course.lessons?.length || 0}</span>
              </div>

              {hasAccess ? (
                <button
                   onClick={handleStartLearning}
                   className="btn btn-primary"
                   style={{ width: '100%', padding: '1rem' }}
                >
                   Go to Learning Portal &rarr;
                </button>
              ) : (
                <button
                   onClick={handleEnrollment}
                   className="btn btn-primary"
                   style={{ width: '100%', padding: '1rem' }}
                   disabled={isProcessing}
                >
                   {isProcessing ? 'Processing...' : (isFree ? 'Enroll for Free' : (isSubscription ? `Subscribe (${course.paymentInterval}) • ₦${course.price.toLocaleString()}` : `Enroll Now • ₦${course.price.toLocaleString()}`))}
                </button>
              )}

              {hasAccess && course.attachmentPath && (
                <div className="accent-card" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h4 style={{ fontFamily: 'Outfit', margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Course Materials</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Additional reference file for students:</p>
                  <a 
                    href={`/api/download?type=course&id=${course.id}`} 
                    className="btn btn-secondary" 
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', marginTop: '0.5rem', fontSize: '0.9rem', width: '100%', textDecoration: 'none' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download Attachment
                  </a>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    File: {course.attachmentName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Info Column */}
          <div>
            <span style={{ color: 'var(--accent-red)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.85rem' }}>{course.category}</span>
            <h1 style={{ fontFamily: 'Outfit', fontSize: '3.5rem', lineHeight: 1.1, margin: '0.5rem 0', color: 'var(--text-primary)' }}>{course.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', margin: 0 }}>Instructor: {course.instructor}</p>
              {course.creatorId && course.creatorId !== 'admin' && (
                <span 
                  style={{ 
                    padding: '0.25rem 0.75rem', 
                    fontSize: '0.8rem', 
                    borderRadius: '20px', 
                    background: 'rgba(255, 255, 255, 0.05)', 
                    border: '1px solid var(--border-color)',
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.25rem',
                    color: 'var(--text-secondary)'
                  }}
                >
                  👤 {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
                </span>
              )}
              {course.creatorId && course.creatorId !== 'admin' && course.creatorId !== user?.uid && (
                <button 
                  onClick={handleFollowToggle} 
                  className="btn btn-secondary" 
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  {isFollowing ? '✓ Following' : '+ Follow'}
                </button>
              )}
              <button 
                onClick={() => setIsReportModalOpen(true)} 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', borderRadius: '20px', color: 'var(--accent-red)', borderColor: 'rgba(220, 38, 38, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                ⚠ Report
              </button>
              {course.creatorId && course.creatorId !== user?.uid && (isEnrolled || isSubActive) && (
                <button 
                  onClick={() => setIsMessageModalOpen(true)} 
                  className="btn btn-secondary" 
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', borderRadius: '20px', color: 'var(--accent-gold)', borderColor: 'rgba(212, 163, 89, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  ✉ Message Instructor
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '2rem', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '2.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status</div>
                <div style={{ fontWeight: 600, color: 'var(--accent-red)' }}>{hasAccess ? 'Enrolled' : isFree ? 'Free' : 'Premium'}</div>
              </div>
              <div style={{ width: '1px', background: 'var(--border-color)' }} />
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Price</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{isFree ? 'Free' : `₦${course.price.toLocaleString()}${isSubscription ? ` / ${course.paymentInterval === 'monthly' ? 'mo' : 'yr'}` : ''}`}</div>
              </div>
              <div style={{ width: '1px', background: 'var(--border-color)' }} />
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Curriculum</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{course.lessons?.length || 0} lessons</div>
              </div>
            </div>

            <div style={{ marginBottom: '3rem' }}>
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.75rem', marginBottom: '1rem' }}>About this Course</h3>
              <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)', fontSize: '1.05rem' }}>{course.description || 'No description provided.'}</p>
            </div>
            
            <div>
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                Course Syllabus
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(course.lessons || []).sort((a,b) => a.lessonNumber - b.lessonNumber).map(les => (
                  <div key={les.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ background: 'var(--accent-red-gradient)', color: 'white', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontFamily: 'Outfit', flexShrink: 0 }}>
                        {les.lessonNumber}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{les.title}</h4>
                        {les.description && (
                          <p style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {les.description}
                          </p>
                        )}
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{les.contentType.toUpperCase()} Format</span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {(!course.lessons || course.lessons.length === 0) && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                    No lessons have been published for this course yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}

      {/* Content Report Modal */}
      {isReportModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog" style={{ maxWidth: '450px', padding: '2rem', borderRadius: '12px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Report Content</h2>
              <button onClick={() => setIsReportModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>
            <form onSubmit={handleReportSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="report-reason">Reason for Reporting</label>
                <select 
                  id="report-reason"
                  className="form-input"
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value as any)}
                >
                  <option value="stolen">Stolen or Plagiarized Content</option>
                  <option value="abusive">Abusive or Inappropriate Content</option>
                  <option value="inaccurate">Inaccurate Teachings or Information</option>
                  <option value="other">Other Violation</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="report-details">Provide Details</label>
                <textarea 
                  id="report-details"
                  className="form-input"
                  rows={4}
                  required
                  placeholder="Explain why this content should be reviewed..."
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary modal-form-submit-btn" disabled={isSendingReport}>
                {isSendingReport ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Message Creator Modal */}
      {isMessageModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog" style={{ maxWidth: '450px', padding: '2rem', borderRadius: '12px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Message Instructor</h2>
              <button onClick={() => setIsMessageModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>
            <form onSubmit={handleMessageSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="msg-subject">Subject</label>
                <input 
                  id="msg-subject"
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Question about syllabus"
                  value={messageSubject}
                  onChange={e => setMessageSubject(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="msg-text">Message</label>
                <textarea 
                  id="msg-text"
                  className="form-input"
                  rows={4}
                  required
                  placeholder="Write your message here..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary modal-form-submit-btn" disabled={isSendingMessage}>
                {isSendingMessage ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
