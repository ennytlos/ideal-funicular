'use client';

import React, { useState } from 'react';
import { useApp, Course, Lesson } from '../../context/AppContext';

const CATEGORIES = ['Spiritual', 'Hadith', 'Jurisprudence', 'Ethics & Morals', 'History', 'Quranic Studies', 'Other'];

function compressImage(file: File, maxMb = 1, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    if (file.size <= maxMb * 1024 * 1024) return resolve(file);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 1920;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) { height = Math.round((height * maxDimension) / width); width = maxDimension; } 
          else { width = Math.round((width * maxDimension) / height); height = maxDimension; }
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

export default function ManageCoursesTab() {
  const { courses, addCourse, updateCourse, deleteCourse, user } = useApp();

  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [newCourse, setNewCourse] = useState<Partial<Course> & { coverSize?: number; attachmentSize?: number }>({
    title: '', instructor: 'Instructor Al-Noor', description: '', coverUrl: '', category: CATEGORIES[0], price: 0, lessons: [], attachmentPath: '', attachmentName: '', paymentInterval: 'once'
  });
  const [creationPlan, setCreationPlan] = useState<'5k' | '10k'>('5k');

  const calculateTotalCourseSize = (c: any) => {
    let total = 0;
    total += Number(c.coverSize) || 0;
    total += Number(c.attachmentSize) || 0;
    
    if (Array.isArray(c.lessons)) {
      c.lessons.forEach((l: any) => {
        total += Number(l.audioSize) || 0;
        total += Number(l.pdfSize) || 0;
        total += Number(l.attachmentSize) || 0;
        total += Number(l.assignmentAttachmentSize) || 0;
      });
    }
    return total;
  };

  const handlePayCourseCreation = async (c: Course) => {
    try {
      const planSelect = confirm("Proceed to pay creation fee for 50MB content limit (₦5,000)? Click Cancel to choose 100MB content limit (₦10,000).");
      const planCost = planSelect ? 5000 : 10000;
      
      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: c.id,
          type: 'create_course',
          amount: planCost,
          email: user?.email
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      } else {
        throw new Error(data.error || 'Failed to initialize payment');
      }
    } catch (err: any) {
      alert(err.message || 'Payment initialization failed');
    }
  };
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [courseAttachmentFile, setCourseAttachmentFile] = useState<File | null>(null);
  const [imageUploadType, setImageUploadType] = useState<'file' | 'url'>('file');

  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [newLesson, setNewLesson] = useState<Partial<Lesson>>({
    title: '', lessonNumber: 1, contentType: 'video', videoUrl: '', audioUrl: '', pdfPath: '', plainTextContent: '', isSecure: true, description: '', attachmentPath: '', attachmentName: ''
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lessonAttachmentFile, setLessonAttachmentFile] = useState<File | null>(null);
  const [assignmentAttachmentFile, setAssignmentAttachmentFile] = useState<File | null>(null);
  const [hasAssignment, setHasAssignment] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // --- Course Methods ---
  const openAddCourseModal = () => {
    setEditingCourseId(null);
    setNewCourse({ title: '', instructor: 'Instructor Al-Noor', description: '', coverUrl: '', category: CATEGORIES[0], price: 0, lessons: [], attachmentPath: '', attachmentName: '', paymentInterval: 'once' });
    setSelectedCategory(CATEGORIES[0]);
    setCustomCategory('');
    setCoverFile(null);
    setCourseAttachmentFile(null);
    setImageUploadType('file');
    setIsCourseModalOpen(true);
  };

  const openEditCourseModal = (c: Course) => {
    setEditingCourseId(c.id);
    setNewCourse({ ...c });
    if (CATEGORIES.includes(c.category)) { setSelectedCategory(c.category); setCustomCategory(''); } 
    else { setSelectedCategory('Other'); setCustomCategory(c.category); }
    setImageUploadType(c.coverUrl?.startsWith('http') ? 'url' : 'file');
    setCoverFile(null);
    setCourseAttachmentFile(null);
    setIsCourseModalOpen(true);
  };

  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let finalCoverUrl = newCourse.coverUrl;
      let coverSize = newCourse.coverSize || 0;
      if (coverFile) {
        const compressed = await compressImage(coverFile, 1, 0.8);
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('type', 'cover');
        if (editingCourseId) formData.append('courseId', editingCourseId);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload cover image');
        if (data.url) {
          finalCoverUrl = data.url;
          coverSize = data.size || compressed.size;
        }
      }

      let finalAttachmentPath = newCourse.attachmentPath || '';
      let finalAttachmentName = newCourse.attachmentName || '';
      let attachmentSize = newCourse.attachmentSize || 0;
      if (courseAttachmentFile) {
        const formData = new FormData();
        formData.append('file', courseAttachmentFile);
        formData.append('type', 'attachment');
        if (editingCourseId) formData.append('courseId', editingCourseId);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload course attachment');
        if (data.path) {
          finalAttachmentPath = data.path;
          finalAttachmentName = courseAttachmentFile.name;
          attachmentSize = data.size || courseAttachmentFile.size;
        }
      }
      
      const cData: any = {
        title: newCourse.title || 'Untitled',
        instructor: newCourse.instructor || 'Instructor',
        description: newCourse.description || '',
        coverUrl: finalCoverUrl || '',
        coverSize,
        category: selectedCategory === 'Other' ? customCategory : selectedCategory,
        price: Number(newCourse.price) || 0,
        lessons: newCourse.lessons || [],
        attachmentPath: finalAttachmentPath,
        attachmentName: finalAttachmentName,
        attachmentSize,
        paymentInterval: newCourse.paymentInterval || 'once',
        creatorId: newCourse.creatorId || user?.uid || 'admin'
      };

      if (editingCourseId) {
        cData.currentContentSize = calculateTotalCourseSize({ ...newCourse, ...cData });
        await updateCourse({ id: editingCourseId, ...cData } as Course);
        setIsCourseModalOpen(false);
      } else {
        const planCost = creationPlan === '10k' ? 10000 : 5000;
        const sizeLimit = creationPlan === '10k' ? 100 * 1024 * 1024 : 50 * 1024 * 1024;
        
        cData.coverSize = coverSize;
        cData.attachmentSize = attachmentSize;
        cData.currentContentSize = calculateTotalCourseSize(cData);
        
        const newCourseId = await addCourse({
          ...cData,
          isPaid: false,
          maxContentSize: sizeLimit,
          paymentStatus: 'pending'
        });
        
        const res = await fetch('/api/payment/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: newCourseId,
            type: 'create_course',
            amount: planCost,
            email: user?.email
          })
        });
        const data = await res.json();
        if (data.url) {
          window.location.assign(data.url);
        } else {
          throw new Error(data.error || 'Failed to initialize Paystack transaction');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Lesson Methods ---
  const openManageLessons = (c: Course) => {
    setActiveCourse(c);
  };

  const openAddLessonModal = () => {
    setEditingLessonId(null);
    setNewLesson({ title: '', lessonNumber: (activeCourse?.lessons?.length || 0) + 1, contentType: 'video', videoUrl: '', audioUrl: '', pdfPath: '', plainTextContent: '', isSecure: true, description: '', attachmentPath: '', attachmentName: '' });
    setPdfFile(null);
    setAudioFile(null);
    setLessonAttachmentFile(null);
    setAssignmentAttachmentFile(null);
    setHasAssignment(false);
    setIsLessonModalOpen(true);
  };

  const openEditLessonModal = (les: Lesson) => {
    setEditingLessonId(les.id);
    setNewLesson({ ...les, isSecure: les.isSecure !== false, description: les.description || '', attachmentPath: les.attachmentPath || '', attachmentName: les.attachmentName || '', audioUrl: les.audioUrl || '' });
    setPdfFile(null);
    setAudioFile(null);
    setLessonAttachmentFile(null);
    setAssignmentAttachmentFile(null);
    setHasAssignment(!!les.assignment);
    setIsLessonModalOpen(true);
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse) return;
    setIsSaving(true);
    try {
      let finalPdfPath = newLesson.pdfPath;
      let pdfSize = newLesson.pdfSize || 0;
      let finalPlainTextContent = newLesson.plainTextContent;
      let finalVideoUrl = newLesson.videoUrl;
      
      if (newLesson.contentType === 'pdf' && pdfFile) {
        const formData = new FormData();
        formData.append('file', pdfFile);
        formData.append('type', 'pdf');
        if (activeCourse.id) formData.append('courseId', activeCourse.id);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload PDF');
        if (data.path) {
          finalPdfPath = data.path;
          pdfSize = data.size || pdfFile.size;
        }
      }

      let finalAudioUrl = newLesson.audioUrl || '';
      let audioSize = newLesson.audioSize || 0;
      if (newLesson.contentType === 'audio' && audioFile) {
        const formData = new FormData();
        formData.append('file', audioFile);
        formData.append('type', 'audio');
        if (activeCourse.id) formData.append('courseId', activeCourse.id);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload Audio');
        if (data.path) {
          finalAudioUrl = data.path;
          audioSize = data.size || audioFile.size;
        }
      }

      let finalLessonAttachmentPath = newLesson.attachmentPath || '';
      let finalLessonAttachmentName = newLesson.attachmentName || '';
      let attachmentSize = newLesson.attachmentSize || 0;
      if (lessonAttachmentFile) {
        const formData = new FormData();
        formData.append('file', lessonAttachmentFile);
        formData.append('type', 'attachment');
        if (activeCourse.id) formData.append('courseId', activeCourse.id);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload lesson attachment');
        if (data.path) {
          finalLessonAttachmentPath = data.path;
          finalLessonAttachmentName = lessonAttachmentFile.name;
          attachmentSize = data.size || lessonAttachmentFile.size;
        }
      }

      let finalAssignmentAttachmentPath = newLesson.assignment?.attachmentPath || '';
      let finalAssignmentAttachmentName = newLesson.assignment?.attachmentName || '';
      let assignmentAttachmentSize = newLesson.assignmentAttachmentSize || 0;
      if (hasAssignment && assignmentAttachmentFile) {
        const formData = new FormData();
        formData.append('file', assignmentAttachmentFile);
        formData.append('type', 'attachment');
        if (activeCourse.id) formData.append('courseId', activeCourse.id);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload assignment attachment');
        if (data.path) {
          finalAssignmentAttachmentPath = data.path;
          finalAssignmentAttachmentName = assignmentAttachmentFile.name;
          assignmentAttachmentSize = data.size || assignmentAttachmentFile.size;
        }
      }

      const assignmentData = hasAssignment ? {
        description: newLesson.assignment?.description || '',
        attachmentPath: finalAssignmentAttachmentPath,
        attachmentName: finalAssignmentAttachmentName
      } : undefined;

      const les: Lesson & { audioSize?: number; pdfSize?: number; attachmentSize?: number; assignmentAttachmentSize?: number } = {
        id: editingLessonId || Date.now().toString(),
        title: newLesson.title || `Lesson ${newLesson.lessonNumber}`,
        lessonNumber: Number(newLesson.lessonNumber) || 1,
        contentType: newLesson.contentType || 'video',
        videoUrl: finalVideoUrl || '',
        audioUrl: finalAudioUrl || '',
        audioSize,
        pdfPath: finalPdfPath || '',
        pdfSize,
        plainTextContent: finalPlainTextContent || '',
        isPublished: true,
        isSecure: newLesson.isSecure !== false,
        description: newLesson.description || '',
        attachmentPath: finalLessonAttachmentPath,
        attachmentName: finalLessonAttachmentName,
        attachmentSize,
        assignment: assignmentData,
        assignmentAttachmentSize: hasAssignment ? assignmentAttachmentSize : 0
      };

      let updatedLessons = [...(activeCourse.lessons || [])];
      if (editingLessonId) {
        updatedLessons = updatedLessons.map(l => l.id === editingLessonId ? les : l);
      } else {
        updatedLessons.push(les);
      }

      const updatedCourse: any = { ...activeCourse, lessons: updatedLessons };
      updatedCourse.currentContentSize = calculateTotalCourseSize(updatedCourse);
      
      await updateCourse(updatedCourse);
      setActiveCourse(updatedCourse);
      setIsLessonModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLesson = async (lesId: string) => {
    if (!activeCourse) return;
    if (confirm('Delete this lesson?')) {
      const updatedLessons = activeCourse.lessons.filter(l => l.id !== lesId);
      const updatedCourse = { ...activeCourse, lessons: updatedLessons };
      await updateCourse(updatedCourse);
      setActiveCourse(updatedCourse);
    }
  };

  return (
    <div>
      {/* Course List View */}
      {!activeCourse ? (
        <>
          <div className="admin-header-row">
            <h1 className="admin-title-no-margin">Manage Courses</h1>
            <button className="btn btn-primary" onClick={openAddCourseModal}>Add New Course</button>
          </div>
          <div className="glass-card admin-table-container">
            <table className="admin-table admin-table-books">
              <thead>
                <tr className="admin-table-header-bg">
                  <th className="admin-table-th">Title</th>
                  <th className="admin-table-th">Instructor</th>
                  <th className="admin-table-th">Lessons</th>
                  <th className="admin-table-th">Storage</th>
                  <th className="admin-table-th">Price</th>
                  <th className="admin-table-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(c => {
                  const isPaid = c.isPaid !== false;
                  return (
                    <tr key={c.id} className="admin-table-row admin-table-header">
                      <td className="admin-table-td-bold">
                        {c.title}
                        {!isPaid && (
                          <span className="badge badge-free" style={{ background: 'var(--accent-red)', color: 'white', marginLeft: '0.5rem', padding: '0.15rem 0.4rem', fontSize: '0.75rem', borderRadius: '4px' }}>
                            Unpaid Draft
                          </span>
                        )}
                      </td>
                      <td className="admin-table-td-muted">{c.instructor}</td>
                      <td className="admin-table-td-muted">{c.lessons?.length || 0} lessons</td>
                      <td className="admin-table-td-muted">
                        {isPaid 
                          ? `${((c.currentContentSize || 0) / (1024 * 1024)).toFixed(1)} / ${((c.maxContentSize || 52428800) / (1024 * 1024)).toFixed(0)} MB` 
                          : 'N/A'
                        }
                      </td>
                      <td className="admin-table-td">{c.price === 0 ? 'Free' : `₦${c.price.toLocaleString()}`}</td>
                      <td className="admin-table-td admin-table-actions-cell">
                        {isPaid ? (
                          <>
                            <button onClick={() => openManageLessons(c)} className="admin-action-btn">Manage Lessons</button>
                            <button onClick={() => openEditCourseModal(c)} className="admin-action-btn">Edit</button>
                          </>
                        ) : (
                          <button onClick={() => handlePayCourseCreation(c)} className="admin-action-btn" style={{ color: 'var(--accent-gold)' }}>
                            Pay Creation Fee
                          </button>
                        )}
                        <button onClick={() => { if(confirm('Delete course?')) deleteCourse(c.id) }} className="admin-action-btn-danger">Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Lesson Management View */
        <>
          <div className="admin-header-row">
            <div>
              <button className="btn btn-secondary" style={{ marginBottom: '1rem' }} onClick={() => setActiveCourse(null)}>
                &larr; Back to Courses
              </button>
              <h1 className="admin-title-no-margin">Lessons for &quot;{activeCourse.title}&quot;</h1>
            </div>
            <button className="btn btn-primary" onClick={openAddLessonModal}>Add Lesson</button>
          </div>
          <div className="glass-card admin-table-container">
            <table className="admin-table admin-table-books">
              <thead>
                <tr className="admin-table-header-bg">
                  <th className="admin-table-th">Lesson #</th>
                  <th className="admin-table-th">Title</th>
                  <th className="admin-table-th">Format</th>
                  <th className="admin-table-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(activeCourse.lessons || []).sort((a,b) => a.lessonNumber - b.lessonNumber).map(les => (
                  <tr key={les.id} className="admin-table-row admin-table-header">
                    <td className="admin-table-td-bold">{les.lessonNumber}</td>
                    <td className="admin-table-td-muted">{les.title}</td>
                    <td className="admin-table-td"><span className="badge badge-premium">{les.contentType.toUpperCase()}</span></td>
                    <td className="admin-table-td admin-table-actions-cell">
                      <button onClick={() => openEditLessonModal(les)} className="admin-action-btn">Edit</button>
                      <button onClick={() => handleDeleteLesson(les.id)} className="admin-action-btn-danger">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Course Modal */}
      {isCourseModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">{editingCourseId ? 'Edit Course' : 'Add New Course'}</h2>
              <button onClick={() => setIsCourseModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>
            <form onSubmit={handleCourseSubmit} className="modal-form">
              {!editingCourseId && (
                <div className="form-group">
                  <label className="form-label">Course Content Storage Plan</label>
                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="creation-plan" 
                        checked={creationPlan === '5k'} 
                        onChange={() => setCreationPlan('5k')} 
                      />
                      ₦5,000 Plan (Max 50MB content)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="creation-plan" 
                        checked={creationPlan === '10k'} 
                        onChange={() => setCreationPlan('10k')} 
                      />
                      ₦10,000 Plan (Max 100MB content)
                    </label>
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="course-title">Title</label>
                <input id="course-title" type="text" className="form-input" required value={newCourse.title || ''} onChange={e => setNewCourse({...newCourse, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="course-instructor">Instructor</label>
                <input id="course-instructor" type="text" className="form-input" required value={newCourse.instructor || ''} onChange={e => setNewCourse({...newCourse, instructor: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="course-description">Description</label>
                <textarea id="course-description" className="form-input" rows={3} required value={newCourse.description || ''} onChange={e => setNewCourse({...newCourse, description: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="course-price">Price (₦)</label>
                <input id="course-price" type="number" className="form-input" step="0.01" required value={newCourse.price || 0} onChange={e => setNewCourse({...newCourse, price: Number(e.target.value)})} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="course-interval">Payment Interval</label>
                <select 
                  id="course-interval" 
                  className="form-input" 
                  value={newCourse.paymentInterval || 'once'} 
                  onChange={e => setNewCourse({...newCourse, paymentInterval: e.target.value as 'once' | 'monthly' | 'yearly'})}
                >
                  <option value="once">One-Time Purchase</option>
                  <option value="monthly">Monthly Subscription</option>
                  <option value="yearly">Yearly Subscription</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="course-attachment">Course Attachment (Optional PDF/Slides/Zip)</label>
                <input key="course-attachment" id="course-attachment" type="file" className="form-input" onChange={e => e.target.files && setCourseAttachmentFile(e.target.files[0])} />
                {newCourse.attachmentPath && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Current: {newCourse.attachmentName}</span>
                    <button type="button" onClick={() => setNewCourse({...newCourse, attachmentPath: '', attachmentName: ''})} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={imageUploadType === 'file' ? 'course-cover-file' : 'course-cover-url'}>Cover Image</label>
                {imageUploadType === 'file' ? (
                  <input key="cover-file" id="course-cover-file" type="file" accept="image/*" className="form-input" onChange={e => e.target.files && setCoverFile(e.target.files[0])} />
                ) : (
                  <input key="cover-url" id="course-cover-url" type="url" className="form-input" value={newCourse.coverUrl || ''} onChange={e => setNewCourse({...newCourse, coverUrl: e.target.value})} />
                )}
                <button type="button" onClick={() => setImageUploadType(prev => prev === 'file' ? 'url' : 'file')} className="btn btn-secondary" style={{marginTop: '0.5rem'}}>
                  Toggle Upload/URL
                </button>
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Course'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Modal */}
      {isLessonModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">{editingLessonId ? 'Edit Lesson' : 'Add Lesson'}</h2>
              <button onClick={() => setIsLessonModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>
            <form onSubmit={handleLessonSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="lesson-number">Lesson Number</label>
                <input id="lesson-number" type="number" className="form-input" required value={newLesson.lessonNumber || 0} onChange={e => setNewLesson({...newLesson, lessonNumber: Number(e.target.value)})} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="lesson-title">Title</label>
                <input id="lesson-title" type="text" className="form-input" required value={newLesson.title || ''} onChange={e => setNewLesson({...newLesson, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="lesson-description">Lesson Description (Optional)</label>
                <textarea id="lesson-description" className="form-input" rows={3} placeholder="Brief summary of the lesson..." value={newLesson.description || ''} onChange={e => setNewLesson({...newLesson, description: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="lesson-format">Format</label>
                <select id="lesson-format" className="form-input" value={newLesson.contentType} onChange={e => setNewLesson({...newLesson, contentType: e.target.value as 'video'|'audio'|'pdf'|'plaintext'})}>
                  <option value="video">Video URL (YouTube/BunnyCDN)</option>
                  <option value="audio">Audio Class (Upload/URL)</option>
                  <option value="plaintext">Plain Text</option>
                  <option value="pdf">PDF Document</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Security Settings</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input id="lesson-secure" type="checkbox" checked={newLesson.isSecure !== false} onChange={e => setNewLesson({...newLesson, isSecure: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  <label htmlFor="lesson-secure" className="image-upload-type-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                    Secure Access (Requires Bunny Token Authorization for PDF)
                  </label>
                </div>
              </div>
              {newLesson.contentType === 'video' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="lesson-video">Video URL (Embed/Iframe Source)</label>
                  <input id="lesson-video" type="url" className="form-input" placeholder="https://www.youtube.com/embed/..." value={newLesson.videoUrl || ''} onChange={e => setNewLesson({...newLesson, videoUrl: e.target.value})} />
                </div>
              )}
              {newLesson.contentType === 'plaintext' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="lesson-plaintext">Lesson Content</label>
                  <textarea id="lesson-plaintext" className="form-input" rows={10} placeholder="Paste your lesson content here." value={newLesson.plainTextContent || ''} onChange={e => setNewLesson({...newLesson, plainTextContent: e.target.value})} />
                </div>
              )}
              {newLesson.contentType === 'pdf' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="lesson-pdf">Upload PDF</label>
                  <input id="lesson-pdf" type="file" accept="application/pdf" className="form-input" onChange={e => e.target.files && setPdfFile(e.target.files[0])} />
                  {newLesson.pdfPath && <p>Current: {newLesson.pdfPath}</p>}
                </div>
              )}
              {newLesson.contentType === 'audio' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="lesson-audio">Upload Audio Class File</label>
                  <input id="lesson-audio" type="file" accept="audio/*" className="form-input" onChange={e => e.target.files && setAudioFile(e.target.files[0])} />
                  
                  <div style={{ marginTop: '1rem' }}>
                    <label className="form-label" htmlFor="lesson-audio-url">Or Audio Path/URL</label>
                    <input id="lesson-audio-url" type="text" className="form-input" placeholder="e.g. audio/123.mp3 or https://example.com/audio.mp3" value={newLesson.audioUrl || ''} onChange={e => setNewLesson({...newLesson, audioUrl: e.target.value})} />
                  </div>
                  {newLesson.audioUrl && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Current Audio: {newLesson.audioUrl}</p>}
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="lesson-attachment">Lesson Attachment (Optional PDF/Slides/Zip)</label>
                <input key="lesson-attachment" id="lesson-attachment" type="file" className="form-input" onChange={e => e.target.files && setLessonAttachmentFile(e.target.files[0])} />
                {newLesson.attachmentPath && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Current: {newLesson.attachmentName}</span>
                    <button type="button" onClick={() => setNewLesson({...newLesson, attachmentPath: '', attachmentName: ''})} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Assignment Setting</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input id="lesson-has-assignment" type="checkbox" checked={hasAssignment} onChange={e => setHasAssignment(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  <label htmlFor="lesson-has-assignment" className="image-upload-type-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                    Include Assignment for this lesson
                  </label>
                </div>
              </div>

              {hasAssignment && (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="assignment-desc">Assignment Instructions</label>
                    <textarea id="assignment-desc" className="form-input" rows={4} required placeholder="Enter instructions for learners..." value={newLesson.assignment?.description || ''} onChange={e => setNewLesson({
                      ...newLesson,
                      assignment: {
                        ...(newLesson.assignment || { description: '', attachmentPath: '', attachmentName: '' }),
                        description: e.target.value
                      }
                    })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="assignment-attachment">Assignment Attachment (Optional Reference File)</label>
                    <input key="assignment-attachment" id="assignment-attachment" type="file" className="form-input" onChange={e => e.target.files && setAssignmentAttachmentFile(e.target.files[0])} />
                    {newLesson.assignment?.attachmentPath && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Current: {newLesson.assignment.attachmentName}</span>
                        <button type="button" onClick={() => setNewLesson({
                          ...newLesson,
                          assignment: {
                            ...(newLesson.assignment || { description: '', attachmentPath: '', attachmentName: '' }),
                            attachmentPath: '',
                            attachmentName: ''
                          }
                        })} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>
                          Remove File
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Uploading & Saving...' : 'Save Lesson'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
