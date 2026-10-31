'use client';

import React, { useState, useMemo } from 'react';
import { useApp, Course, Lesson } from '../../context/AppContext';
import { auth } from '../../lib/firebase';

interface EnrolledStudentItem {
  uid: string;
  displayName: string;
  email: string;
  courseId: string;
  courseTitle: string;
  completedLessons: number;
  totalLessons: number;
  progressPct: number;
  isCompleted: boolean;
  enrolledAt?: any;
}

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

  const handlePayCourseStorageBoost = async (c: Course) => {
    try {
      const currentMB = Math.round((c.maxContentSize || 52428800) / (1024 * 1024));
      const newMB = currentMB + 100;
      const proceed = confirm(
        `Boost storage limit for "${c.title}" by +100MB for ₦3,000?\n\nCurrent Storage Limit: ${currentMB}MB\nNew Storage Limit: ${newMB}MB`
      );
      if (!proceed) return;

      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: c.id,
          type: 'create_course',
          amount: 3000,
          email: user?.email
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      } else {
        throw new Error(data.error || 'Failed to initialize storage boost payment');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Storage boost initialization failed');
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

  // --- Enrolled Students & Certificates State ---
  const [isStudentsModalOpen, setIsStudentsModalOpen] = useState(false);
  const [selectedCourseForStudents, setSelectedCourseForStudents] = useState<Course | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudentItem[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const openStudentsModal = async (course: Course) => {
    setSelectedCourseForStudents(course);
    setIsStudentsModalOpen(true);
    setIsLoadingStudents(true);
    setStudentSearch('');
    setStudentFilter('all');
    setCopyFeedback(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/creator/students?courseId=${course.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error('Failed to load students');
      }
      const data = await res.json();
      setEnrolledStudents(data.students || []);
    } catch (err: any) {
      console.error('Error fetching course students:', err);
      alert(err.message || 'Could not load enrolled students');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleCopyEmails = (onlyCompleted = false) => {
    const target = onlyCompleted
      ? enrolledStudents.filter((s) => s.isCompleted)
      : enrolledStudents;
    const emails = target
      .map((s) => s.email)
      .filter((e) => Boolean(e && e.includes('@')));

    if (emails.length === 0) {
      alert('No email addresses found to copy.');
      return;
    }

    navigator.clipboard.writeText(emails.join(', '));
    const label = onlyCompleted
      ? `Copied ${emails.length} completed student email(s)!`
      : `Copied all ${emails.length} student email(s)!`;
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  const handleCopySingleEmail = (email: string) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopyFeedback(`Copied ${email}!`);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  const handleExportCsv = () => {
    if (!selectedCourseForStudents || enrolledStudents.length === 0) {
      alert('No students to export.');
      return;
    }

    const headers = ['Full Name', 'Email Address', 'Course Title', 'Completed Lessons', 'Total Lessons', 'Progress (%)', 'Status'];
    const rows = enrolledStudents.map((s) => [
      `"${s.displayName.replace(/"/g, '""')}"`,
      `"${s.email.replace(/"/g, '""')}"`,
      `"${s.courseTitle.replace(/"/g, '""')}"`,
      s.completedLessons,
      s.totalLessons,
      `${s.progressPct}%`,
      s.isCompleted ? 'Completed' : 'In Progress',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const safeTitle = selectedCourseForStudents.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `${safeTitle}_enrolled_students.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = useMemo(() => {
    return enrolledStudents.filter((s) => {
      if (studentFilter === 'completed' && !s.isCompleted) return false;
      if (studentFilter === 'in_progress' && s.isCompleted) return false;
      if (studentSearch.trim()) {
        const q = studentSearch.trim().toLowerCase();
        const matchName = s.displayName.toLowerCase().includes(q);
        const matchEmail = s.email.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      return true;
    });
  }, [enrolledStudents, studentFilter, studentSearch]);

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
        const maxAllowed = newCourse.maxContentSize || (50 * 1024 * 1024);
        if (cData.currentContentSize > maxAllowed) {
          throw new Error(`Course content (${(cData.currentContentSize / (1024 * 1024)).toFixed(1)}MB) exceeds current storage limit (${(maxAllowed / (1024 * 1024)).toFixed(0)}MB). Please boost storage (+100MB for ₦3,000).`);
        }
        await updateCourse({ id: editingCourseId, ...cData } as Course);
        setIsCourseModalOpen(false);
      } else {
        const sizeLimit = 50 * 1024 * 1024; // 50MB free storage included
        
        cData.coverSize = coverSize;
        cData.attachmentSize = attachmentSize;
        cData.currentContentSize = calculateTotalCourseSize(cData);

        if (cData.currentContentSize > sizeLimit) {
          throw new Error(`Initial course files (${(cData.currentContentSize / (1024 * 1024)).toFixed(1)}MB) exceed the 50MB free limit. Please reduce attachment/cover size.`);
        }
        
        await addCourse({
          ...cData,
          isPaid: true,
          isPublished: true,
          maxContentSize: sizeLimit,
          paymentStatus: 'free'
        });
        
        setIsCourseModalOpen(false);
        alert('Course created successfully! 50MB free storage has been allocated.');
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
      const prospectiveSize = calculateTotalCourseSize(updatedCourse);
      const maxAllowed = activeCourse.maxContentSize || (50 * 1024 * 1024);

      if (prospectiveSize > maxAllowed) {
        throw new Error(
          `Storage limit reached for "${activeCourse.title}"!\n\nCurrent limit: ${(maxAllowed / (1024 * 1024)).toFixed(0)}MB\nRequired size: ${(prospectiveSize / (1024 * 1024)).toFixed(1)}MB\n\nPlease boost your course storage (+100MB for ₦3,000) using the "+100MB Boost" button in the course list.`
        );
      }
      updatedCourse.currentContentSize = prospectiveSize;
      
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
                        <div>
                          <span>
                            {`${((c.currentContentSize || 0) / (1024 * 1024)).toFixed(1)} / ${((c.maxContentSize || 52428800) / (1024 * 1024)).toFixed(0)} MB`}
                          </span>
                          {((c.currentContentSize || 0) >= (c.maxContentSize || 52428800)) && (
                            <span style={{ color: '#ef4444', fontSize: '0.72rem', display: 'block', fontWeight: 600 }}>
                              Full
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="admin-table-td">{c.price === 0 ? 'Free' : `₦${c.price.toLocaleString()}`}</td>
                      <td className="admin-table-td admin-table-actions-cell">
                        <button
                          type="button"
                          onClick={() => openStudentsModal(c)}
                          className="admin-action-btn"
                          style={{ color: 'var(--accent-gold)', fontWeight: 600 }}
                          title="View enrolled students & copy emails for certificates"
                        >
                          🎓 Students
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePayCourseStorageBoost(c)}
                          className="admin-action-btn"
                          style={{ color: '#10b981', fontWeight: 600 }}
                          title="Boost course storage by +100MB for ₦3,000"
                        >
                          ⚡ +100MB Boost (₦3k)
                        </button>
                        <button onClick={() => openManageLessons(c)} className="admin-action-btn">Manage Lessons</button>
                        <button onClick={() => openEditCourseModal(c)} className="admin-action-btn">Edit</button>
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
                <div style={{
                  background: 'rgba(217, 119, 6, 0.08)',
                  border: '1px solid rgba(217, 119, 6, 0.25)',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--accent-gold)' }}>
                    <span>✨ Free Course Creation &bull; 50MB Storage Included</span>
                  </div>
                  <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Publishing courses is free with 50MB content storage included. If your course materials exceed 50MB, you can easily boost storage (+100MB for ₦3,000) anytime.
                  </p>
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

      {/* Enrolled Students & Certificates Modal */}
      {isStudentsModalOpen && selectedCourseForStudents && (
        <div className="modal-overlay" onClick={() => setIsStudentsModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '820px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header" style={{ alignItems: 'flex-start' }}>
              <div>
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🎓</span>
                  <span>Enrolled Students & Certificates</span>
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Course: <strong style={{ color: 'var(--text-primary)' }}>{selectedCourseForStudents.title}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStudentsModalOpen(false)}
                className="modal-close-btn"
              >
                &times;
              </button>
            </div>

            {/* Quick Stats Banner */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '1rem',
                margin: '1.25rem 0',
              }}
            >
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '1rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Total Enrolled
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {enrolledStudents.length}
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '10px',
                  padding: '1rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#86efac', marginBottom: '4px' }}>
                  🎓 Ready for Certificate (100%)
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#22c55e' }}>
                  {enrolledStudents.filter((s) => s.isCompleted).length}
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '10px',
                  padding: '1rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#93c5fd', marginBottom: '4px' }}>
                  In Progress
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#3b82f6' }}>
                  {enrolledStudents.filter((s) => !s.isCompleted).length}
                </div>
              </div>
            </div>

            {/* Copy Feedback Toast */}
            {copyFeedback && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid #22c55e',
                  color: '#86efac',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>✓</span>
                <span>{copyFeedback}</span>
              </div>
            )}

            {/* Actions Bar */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              {/* Search & Filter */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', flex: 1, minWidth: '280px' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1, minWidth: '180px', padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
                  placeholder="Search student by name or email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                <select
                  className="form-input"
                  style={{ width: 'auto', padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
                  value={studentFilter}
                  onChange={(e) => setStudentFilter(e.target.value as any)}
                >
                  <option value="all">All Students ({enrolledStudents.length})</option>
                  <option value="completed">
                    Completed Only ({enrolledStudents.filter((s) => s.isCompleted).length})
                  </option>
                  <option value="in_progress">
                    In Progress ({enrolledStudents.filter((s) => !s.isCompleted).length})
                  </option>
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleCopyEmails(false)}
                  className="btn btn-secondary"
                  disabled={enrolledStudents.length === 0}
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                  title="Copies a comma-separated list of all student emails to paste into your email client"
                >
                  📋 Copy All Emails
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyEmails(true)}
                  className="btn btn-secondary"
                  disabled={enrolledStudents.filter((s) => s.isCompleted).length === 0}
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem', color: 'var(--accent-gold)' }}
                  title="Copies only emails of students who completed 100% of the lessons"
                >
                  🎓 Copy Completed
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="btn btn-primary"
                  disabled={enrolledStudents.length === 0}
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                  title="Download a spreadsheet of all students with emails and progress"
                >
                  ⬇ Export CSV
                </button>
              </div>
            </div>

            {/* Students Table */}
            {isLoadingStudents ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading enrolled students...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                {enrolledStudents.length === 0
                  ? 'No students have enrolled in this course yet.'
                  : 'No students match your search or filter criteria.'}
              </div>
            ) : (
              <div className="admin-table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr className="admin-table-header-bg">
                      <th className="admin-table-th">Student</th>
                      <th className="admin-table-th">Email Address</th>
                      <th className="admin-table-th">Progress</th>
                      <th className="admin-table-th">Status</th>
                      <th className="admin-table-th" style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => (
                      <tr key={s.uid} className="admin-table-row">
                        {/* Student Name */}
                        <td className="admin-table-td-bold">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'rgba(212, 175, 55, 0.15)',
                                color: 'var(--accent-gold)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                flexShrink: 0,
                              }}
                            >
                              {s.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div>{s.displayName}</div>
                              {s.enrolledAt && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  Joined {new Date(typeof s.enrolledAt === 'number' ? s.enrolledAt : s.enrolledAt?.toDate?.() || Date.now()).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Student Email */}
                        <td className="admin-table-td">
                          {s.email ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <a
                                href={`mailto:${s.email}`}
                                style={{
                                  color: 'var(--text-primary)',
                                  textDecoration: 'underline',
                                  fontSize: '0.85rem',
                                }}
                                title="Click to send an email"
                              >
                                {s.email}
                              </a>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No email provided</span>
                          )}
                        </td>

                        {/* Progress */}
                        <td className="admin-table-td" style={{ minWidth: '150px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                            <div
                              style={{
                                flex: 1,
                                height: '6px',
                                borderRadius: '3px',
                                background: 'rgba(255,255,255,0.08)',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${s.progressPct}%`,
                                  height: '100%',
                                  background: s.isCompleted ? '#22c55e' : 'var(--accent-gold)',
                                  borderRadius: '3px',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                              {s.progressPct}%
                            </span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {s.completedLessons} of {s.totalLessons} lessons completed
                          </div>
                        </td>

                        {/* Status */}
                        <td className="admin-table-td">
                          {s.isCompleted ? (
                            <span
                              style={{
                                background: 'rgba(34, 197, 94, 0.15)',
                                color: '#22c55e',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '12px',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              🎓 Completed
                            </span>
                          ) : (
                            <span
                              style={{
                                background: 'rgba(59, 130, 246, 0.12)',
                                color: '#60a5fa',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '12px',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              In Progress
                            </span>
                          )}
                        </td>

                        {/* Copy Email Button */}
                        <td className="admin-table-td" style={{ textAlign: 'right' }}>
                          {s.email && (
                            <button
                              type="button"
                              onClick={() => handleCopySingleEmail(s.email)}
                              className="admin-action-btn"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                              title="Copy email to clipboard"
                            >
                              📋 Copy Email
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
