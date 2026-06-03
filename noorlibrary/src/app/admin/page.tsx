'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Book, useApp } from '../../context/AppContext';
import ManageSeriesTab from '../../components/admin/ManageSeriesTab';

const CATEGORIES = ['Spiritual', 'Hadith', 'Jurisprudence', 'Ethics & Morals', 'History', 'Quranic Studies', 'Other'];
const LANGUAGES = ['English', 'Arabic', 'French', 'Urdu', 'Turkish', 'Malay', 'Other'];

function compressImage(file: File, maxMb = 1, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    if (file.size <= maxMb * 1024 * 1024) {
      return resolve(file);
    }
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
        
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
}

export default function AdminDashboard() {
  const { books, addBook, updateBook, deleteBook, user, isLoading } = useApp();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');

  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [viewingAnalytics, setViewingAnalytics] = useState<Book | null>(null);

  const [newBook, setNewBook] = useState<Partial<Book>>({
    title: '', author: 'Author Al-Noor', description: '', coverUrl: '', pdfPath: '', jsonPath: '', contentType: 'pdf'
  });
  const [newBookPrices, setNewBookPrices] = useState({ price: '0', downloadPrice: '0', pages: '0' });

  // Dropdown / Custom inputs support
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]);
  const [customLanguage, setCustomLanguage] = useState('');
  
  // Image upload support
  const [imageUploadType, setImageUploadType] = useState<'file' | 'url'>('file');

  // Loading states for uploads
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isUploadingJson, setIsUploadingJson] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Selected files for deferred uploads
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);

  // Client-side admin verification
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  // Admin stats states
  const [stats, setStats] = useState<{ totalRevenue: number; bookSales: number; totalTips: number } | null>(null);
  const [recentActivity, setRecentActivity] = useState<Array<{
    type: 'purchase' | 'download' | 'tip';
    title: string;
    amount: number;
    dateStr: string;
  }>>([]);
  const [bookStats, setBookStats] = useState<Record<string, { sales: number; downloads: number; revenue: number }>>({});
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch stats on mount / auth state change
  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const res = await fetch('/api/admin/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setRecentActivity(data.recentActivity);
          setBookStats(data.bookStats);
        }
      } catch (err) {
        console.error('Failed to fetch admin stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Cover image size must be less than 5MB');
      return;
    }

    if (newBook.coverUrl && newBook.coverUrl.startsWith('blob:')) {
      URL.revokeObjectURL(newBook.coverUrl);
    }

    setCoverFile(file);
    const localUrl = URL.createObjectURL(file);
    setNewBook(prev => ({ ...prev, coverUrl: localUrl }));
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Only PDF files are accepted.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('PDF file size must be less than 10MB');
      return;
    }

    setPdfFile(file);
    setNewBook(prev => ({ ...prev, pdfPath: file.name }));
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      alert('Only JSON files are accepted.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('JSON file size must be less than 5MB');
      return;
    }

    setJsonFile(file);
    setNewBook(prev => ({ ...prev, jsonPath: file.name }));
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBook.coverUrl) {
      alert("Please select a cover image file or provide an image URL.");
      return;
    }
    if (newBook.contentType === 'pdf' && !newBook.pdfPath) {
      alert("Please select and upload a PDF document.");
      return;
    }
    if (newBook.contentType === 'json' && !newBook.jsonPath) {
      alert("Please select and upload a JSON document.");
      return;
    }

    setIsSaving(true);
    let finalCoverUrl = newBook.coverUrl;
    let finalPdfPath = newBook.pdfPath;
    let finalJsonPath = newBook.jsonPath;

    try {
      if (coverFile) {
        setIsUploadingCover(true);
        const compressed = await compressImage(coverFile, 1, 0.8);
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('type', 'cover');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error || 'Failed to upload cover image');
        }
        finalCoverUrl = data.url;
        setIsUploadingCover(false);
      }

      if (newBook.contentType === 'pdf' && pdfFile) {
        setIsUploadingPdf(true);
        const formData = new FormData();
        formData.append('file', pdfFile);
        formData.append('type', 'pdf');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.path) {
          throw new Error(data.error || 'Failed to upload PDF');
        }
        finalPdfPath = data.path;
        setIsUploadingPdf(false);
      } else if (newBook.contentType === 'json' && jsonFile) {
        setIsUploadingJson(true);
        const formData = new FormData();
        formData.append('file', jsonFile);
        formData.append('type', 'json');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.path) {
          throw new Error(data.error || 'Failed to upload JSON');
        }
        finalJsonPath = data.path;
        setIsUploadingJson(false);
      }

      const categoryValue = selectedCategory === 'Other' ? customCategory : selectedCategory;
      const languageValue = selectedLanguage === 'Other' ? customLanguage : selectedLanguage;

      const bookData = {
        title: newBook.title || 'Untitled',
        author: newBook.author || 'Author Al-Noor',
        description: newBook.description || '',
        coverUrl: finalCoverUrl || '',
        pdfPath: finalPdfPath || '',
        contentType: newBook.contentType || 'pdf',
        jsonPath: finalJsonPath || '',
        price: parseFloat(newBookPrices.price) || 0,
        downloadPrice: parseFloat(newBookPrices.downloadPrice) || 0,
        category: categoryValue || 'Uncategorized',
        pages: parseInt(newBookPrices.pages, 10) || 0,
        language: languageValue || 'English'
      };

      if (editingBookId) {
        await updateBook({ id: editingBookId, ...bookData });
      } else {
        await addBook(bookData);
      }
      closeBookModal();
    } catch (err: any) {
      alert(err.message || 'Failed to save book catalog. Please try again.');
    } finally {
      setIsUploadingCover(false);
      setIsUploadingPdf(false);
      setIsUploadingJson(false);
      setIsSaving(false);
    }
  };

  const openAddModal = () => {
    setEditingBookId(null);
    setNewBook({ title: '', author: 'Author Al-Noor', description: '', coverUrl: '', pdfPath: '', jsonPath: '', contentType: 'pdf' });
    setNewBookPrices({ price: '0', downloadPrice: '0', pages: '0' });
    setSelectedCategory(CATEGORIES[0]);
    setCustomCategory('');
    setSelectedLanguage(LANGUAGES[0]);
    setCustomLanguage('');
    setImageUploadType('file');
    setCoverFile(null);
    setPdfFile(null);
    setJsonFile(null);
    setIsBookModalOpen(true);
  };

  const openEditModal = (book: Book) => {
    setEditingBookId(book.id);
    setNewBook({
      title: book.title, author: book.author, description: book.description, coverUrl: book.coverUrl, pdfPath: book.pdfPath, jsonPath: book.jsonPath || '', contentType: book.contentType || 'pdf'
    });
    setNewBookPrices({ price: book.price.toString(), downloadPrice: book.downloadPrice.toString(), pages: book.pages.toString() });

    if (CATEGORIES.includes(book.category)) {
      setSelectedCategory(book.category);
      setCustomCategory('');
    } else {
      setSelectedCategory('Other');
      setCustomCategory(book.category);
    }

    if (LANGUAGES.includes(book.language)) {
      setSelectedLanguage(book.language);
      setCustomLanguage('');
    } else {
      setSelectedLanguage('Other');
      setCustomLanguage(book.language);
    }

    if (book.coverUrl?.startsWith('data:image')) {
      setImageUploadType('file');
    } else {
      setImageUploadType('url');
    }

    setCoverFile(null);
    setPdfFile(null);
    setJsonFile(null);
    setIsBookModalOpen(true);
  };

  const closeBookModal = () => {
    setIsBookModalOpen(false);
    setEditingBookId(null);
    setCoverFile(null);
    setPdfFile(null);
    setJsonFile(null);
  };

  const getBookAnalytics = (bookId: string) => {
    const s = bookStats[bookId] || { sales: 0, downloads: 0, revenue: 0 };
    const seed = bookId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const simulatedViews = (s.sales + s.downloads) * 5 + (seed % 10) + 12;
    return {
      views: simulatedViews,
      sales: s.sales,
      downloads: s.downloads,
      revenue: s.revenue
    };
  };

  if (isLoading) {
    return (
      <div className="admin-layout">
        <div className="admin-sidebar">
          <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: '40px', borderRadius: '8px', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        </div>
        <div className="admin-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ height: '48px', width: '280px', borderRadius: '8px', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ height: '120px', borderRadius: '12px', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
            <div style={{ height: '300px', borderRadius: '12px', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null; // useEffect already redirects to '/'
  }

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <h2 className="admin-sidebar-header">
          Admin Panel
        </h2>
        <ul className="admin-sidebar-list">
          <li>
            <button
              onClick={() => setActiveTab('overview')}
              className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            >
              Overview
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('books')}
              className={`admin-tab-btn ${activeTab === 'books' ? 'active' : ''}`}
            >
              Manage Books
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('series')}
              className={`admin-tab-btn ${activeTab === 'series' ? 'active' : ''}`}
            >
              Manage Series
            </button>
          </li>
        </ul>
      </div>

      {/* Main Content */}
      <div className="admin-content">
        {activeTab === 'overview' && (
          <div>
            <h1 className="admin-title">Dashboard Overview</h1>
            {loadingStats ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard statistics...</p>
            ) : (
              <>
                <div className="admin-stats-grid">
                  <div className="glass-card admin-stat-card">
                    <p className="admin-card-label">Total Revenue</p>
                    <h3 className="admin-card-value">${stats?.totalRevenue.toFixed(2) || '0.00'}</h3>
                  </div>
                  <div className="glass-card admin-stat-card">
                    <p className="admin-card-label">Book Sales</p>
                    <h3 className="admin-card-value">${stats?.bookSales.toFixed(2) || '0.00'}</h3>
                  </div>
                  <div className="glass-card admin-stat-card">
                    <p className="admin-card-label">Total Tips</p>
                    <h3 className="admin-card-value">${stats?.totalTips.toFixed(2) || '0.00'}</h3>
                  </div>
                </div>
                
                <h2 className="admin-subtitle">Recent Activity</h2>
                <div className="glass-card admin-table-container">
                  <table className="admin-table admin-table-overview">
                    <thead>
                      <tr className="admin-table-header">
                        <th className="admin-table-th">Type</th>
                        <th className="admin-table-th">Amount</th>
                        <th className="admin-table-th">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentActivity.length === 0 ? (
                        <tr className="admin-table-header">
                          <td colSpan={3} className="admin-table-td" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            No recent activity found.
                          </td>
                        </tr>
                      ) : (
                        recentActivity.map((act, idx) => (
                          <tr key={idx} className="admin-table-header">
                            <td className="admin-table-td">
                              <span className={`badge ${act.type === 'tip' ? 'badge-gold' : act.type === 'download' ? 'badge-free' : 'badge-premium'}`}>
                                {act.type === 'tip' ? 'Tip' : act.type === 'download' ? 'Download' : 'Purchase'}
                              </span>{' '}
                              {act.title}
                            </td>
                            <td className="admin-table-td">${act.amount.toFixed(2)}</td>
                            <td className="admin-table-td-muted">{act.dateStr}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'books' && (
          <div>
            <div className="admin-header-row">
              <h1 className="admin-title-no-margin">Manage Books</h1>
              <button className="btn btn-primary" onClick={openAddModal}>Add New Book</button>
            </div>
            
            <div className="glass-card admin-table-container">
              <table className="admin-table admin-table-books">
                <thead>
                  <tr className="admin-table-header-bg">
                    <th className="admin-table-th">Title</th>
                    <th className="admin-table-th">Category</th>
                    <th className="admin-table-th">Price</th>
                    <th className="admin-table-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map(book => (
                    <tr 
                      key={book.id} 
                      className="admin-table-row admin-table-header"
                      onClick={() => router.push(`/books/${book.id}`)}
                    >
                      <td className="admin-table-td-bold">{book.title}</td>
                      <td className="admin-table-td-muted">{book.category}</td>
                      <td className="admin-table-td">{book.price === 0 ? 'Free' : `₦${book.price.toLocaleString()}`}</td>
                      <td className="admin-table-td admin-table-actions-cell" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setViewingAnalytics(book)} className="admin-action-btn">View Analytics</button>
                        <button onClick={() => openEditModal(book)} className="admin-action-btn">Edit</button>
                        <button onClick={() => { if(confirm('Are you sure you want to delete this book?')) deleteBook(book.id) }} className="admin-action-btn-danger">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'series' && (
          <ManageSeriesTab />
        )}
      </div>

      {/* Add / Edit Book Modal */}
      {isBookModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">{editingBookId ? 'Edit Book' : 'Add New Book'}</h2>
              <button onClick={closeBookModal} className="modal-close-btn">&times;</button>
            </div>
            
            <form onSubmit={handleBookSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="book-title" className="form-label">Title</label>
                <input id="book-title" type="text" className="form-input" required value={newBook.title} onChange={e => setNewBook({...newBook, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label htmlFor="book-author" className="form-label">Author Name</label>
                <input id="book-author" type="text" className="form-input" required value={newBook.author} onChange={e => setNewBook({...newBook, author: e.target.value})} placeholder="e.g. Imam Ghazali" />
              </div>
              <div className="modal-grid-2">
                <div className="form-group">
                  <label htmlFor="book-category-select" className="form-label">Category</label>
                  <select
                    id="book-category-select"
                    className="form-input"
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {selectedCategory === 'Other' && (
                    <input
                      type="text"
                      className="form-input custom-input-margin"
                      placeholder="Enter custom category"
                      required
                      value={customCategory}
                      onChange={e => setCustomCategory(e.target.value)}
                    />
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="book-language-select" className="form-label">Language</label>
                  <select
                    id="book-language-select"
                    className="form-input"
                    value={selectedLanguage}
                    onChange={e => setSelectedLanguage(e.target.value)}
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                  {selectedLanguage === 'Other' && (
                    <input
                      type="text"
                      className="form-input custom-input-margin"
                      placeholder="Enter custom language"
                      required
                      value={customLanguage}
                      onChange={e => setCustomLanguage(e.target.value)}
                    />
                  )}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="book-description" className="form-label">Description</label>
                <textarea id="book-description" className="form-input" rows={3} required value={newBook.description} onChange={e => setNewBook({...newBook, description: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Cover Image</label>
                <div className="image-upload-type-selector">
                  <label className="image-upload-type-label">
                    <input type="radio" checked={imageUploadType === 'file'} onChange={() => setImageUploadType('file')} />
                    Upload File
                  </label>
                  <label className="image-upload-type-label">
                    <input type="radio" checked={imageUploadType === 'url'} onChange={() => setImageUploadType('url')} />
                    Image URL
                  </label>
                </div>

                {imageUploadType === 'file' ? (
                  <div className="image-upload-dropzone">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="file-input-overlay"
                      aria-label="Upload Cover Image"
                      title="Upload Cover Image"
                    />
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" className="image-upload-icon">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    <p className="image-upload-text">
                      Click or drag cover image file to upload
                    </p>
                  </div>
                ) : (
                  <input
                    id="book-cover"
                    type="url"
                    className="form-input"
                    required={imageUploadType === 'url'}
                    value={newBook.coverUrl && !newBook.coverUrl.startsWith('data:') ? newBook.coverUrl : ''}
                    onChange={e => setNewBook({...newBook, coverUrl: e.target.value})}
                    placeholder="https://images.unsplash.com/..."
                  />
                )}

                {newBook.coverUrl && (
                  <div className="preview-container">
                    <div className="preview-thumbnail-wrapper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={newBook.coverUrl} alt="Cover Preview" className="preview-thumbnail" />
                    </div>
                    <div className="preview-info">
                      <p className="preview-title">Cover Image Selected</p>
                      <button
                        type="button"
                        onClick={() => setNewBook(prev => ({ ...prev, coverUrl: '' }))}
                        className="preview-remove-btn"
                      >
                        Remove Cover
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Book Content Type</label>
                <div className="image-upload-type-selector">
                  <label className="image-upload-type-label">
                    <input type="radio" checked={newBook.contentType === 'pdf'} onChange={() => setNewBook({...newBook, contentType: 'pdf'})} />
                    PDF Document
                  </label>
                  <label className="image-upload-type-label">
                    <input type="radio" checked={newBook.contentType === 'json'} onChange={() => setNewBook({...newBook, contentType: 'json'})} />
                    JSON Text
                  </label>
                </div>
              </div>

              {newBook.contentType === 'pdf' ? (
                <div className="form-group">
                  <label htmlFor="book-pdf" className="form-label">PDF Document</label>
                  <div className="pdf-upload-container">
                    <input
                      id="book-pdf"
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      className="form-input"
                      aria-label="Upload PDF Document"
                      title="Upload PDF Document"
                      required={!editingBookId}
                    />
                    {isUploadingPdf && <p className="upload-progress-text">Uploading PDF to Bunny Storage...</p>}
                    {newBook.pdfPath && !isUploadingPdf && (
                      <p className="upload-success-text">PDF Ready: {newBook.pdfPath}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="book-json" className="form-label">JSON Text Document</label>
                  <div className="pdf-upload-container">
                    <input
                      id="book-json"
                      type="file"
                      accept="application/json,.json"
                      onChange={handleJsonUpload}
                      className="form-input"
                      aria-label="Upload JSON Document"
                      title="Upload JSON Document"
                      required={!editingBookId}
                    />
                    {isUploadingJson && <p className="upload-progress-text">Uploading JSON to Bunny Storage...</p>}
                    {newBook.jsonPath && !isUploadingJson && (
                      <p className="upload-success-text">JSON Ready: {newBook.jsonPath}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="modal-grid-2">
                <div className="form-group">
                  <label htmlFor="book-price" className="form-label">Read Price (₦)</label>
                  <input id="book-price" type="number" className="form-input" step="0.01" required value={newBookPrices.price} onChange={e => setNewBookPrices({...newBookPrices, price: e.target.value})} />
                </div>
                <div className="form-group">
                  <label htmlFor="book-download-price" className="form-label">Download Price (₦)</label>
                  <input id="book-download-price" type="number" className="form-input" step="0.01" required value={newBookPrices.downloadPrice} onChange={e => setNewBookPrices({...newBookPrices, downloadPrice: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="book-pages" className="form-label">Number of Pages</label>
                <input id="book-pages" type="number" className="form-input" required value={newBookPrices.pages} onChange={e => setNewBookPrices({...newBookPrices, pages: e.target.value})} />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary modal-form-submit-btn"
                disabled={isSaving}
                style={{ opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
              >
                {isSaving ? 'Uploading & Saving...' : (editingBookId ? 'Save Changes' : 'Save Book to Catalog')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Book Analytics Modal */}
      {viewingAnalytics && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog modal-dialog-large">
            <div className="modal-header-start">
              <div>
                <span className="badge-premium-margin">{viewingAnalytics.category}</span>
                <h2 className="modal-title-large">{viewingAnalytics.title}</h2>
                <p className="modal-text-subtitle">Book Analytics Overview</p>
              </div>
              <button onClick={() => setViewingAnalytics(null)} className="modal-close-btn">&times;</button>
            </div>
            
            {(() => {
              const stats = getBookAnalytics(viewingAnalytics.id);
              return (
                <div className="modal-stats-grid">
                  <div className="stat-card-item">
                    <p className="stat-card-label">Total Page Views</p>
                    <p className="stat-card-value">{stats.views.toLocaleString()}</p>
                  </div>
                  <div className="stat-card-item">
                    <p className="stat-card-label">Read Purchases</p>
                    <p className="stat-card-value">{stats.sales.toLocaleString()}</p>
                  </div>
                  <div className="stat-card-item">
                    <p className="stat-card-label">PDF Downloads</p>
                    <p className="stat-card-value">{stats.downloads.toLocaleString()}</p>
                  </div>
                  <div className="stat-card-revenue">
                    <p className="stat-card-label-revenue">Total Revenue</p>
                    <p className="stat-card-value">${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
