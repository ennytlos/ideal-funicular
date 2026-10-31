'use client';

import React, { useState, useEffect } from 'react';
import { useApp, ShortRead } from '../../context/AppContext';

const CATEGORIES = ['Reflection', 'Hadith', 'Quran', 'Spiritual', 'Other'];

export default function ManageRemindersTab() {
  const { shortReads, addShortRead, updateShortRead, deleteShortRead } = useApp();

  const [isMobile, setIsMobile] = useState(false);
  const [cardWidth, setCardWidth] = useState(240);
  const [cardHeight, setCardHeight] = useState(360);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      if (width <= 360) {
        setCardWidth(200);
        setCardHeight(300);
      } else {
        setCardWidth(240);
        setCardHeight(360);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = () => {
    setEditingReminderId(null);
    setContent('');
    setSelectedCategory(CATEGORIES[0]);
    setCustomCategory('');
    setIsModalOpen(true);
  };

  const openEditModal = (reminder: ShortRead) => {
    setEditingReminderId(reminder.id);
    setContent(reminder.content);
    if (CATEGORIES.includes(reminder.category)) {
      setSelectedCategory(reminder.category);
      setCustomCategory('');
    } else {
      setSelectedCategory('Other');
      setCustomCategory(reminder.category);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingReminderId(null);
    setContent('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      alert('Content cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      const finalCategory = selectedCategory === 'Other' ? customCategory : selectedCategory;
      const data = {
        content: content.trim(),
        category: finalCategory || 'Reflection',
      };

      if (editingReminderId) {
        await updateShortRead({ id: editingReminderId, ...data });
      } else {
        await addShortRead(data);
      }
      closeModal();
    } catch (err: any) {
      console.error('Failed to save reminder:', err);
      alert(err.message || 'Failed to save reminder');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this reminder?')) {
      try {
        await deleteShortRead(id);
      } catch (err: any) {
        console.error('Failed to delete reminder:', err);
        alert(err.message || 'Failed to delete reminder');
      }
    }
  };

  const getFontSize = (text: string) => {
    const len = text.length;
    if (len < 80) return '0.9rem';
    if (len < 160) return '0.75rem';
    if (len < 300) return '0.65rem';
    return '0.55rem';
  };

  const formatDate = (createdAt: any) => {
    if (!createdAt) return 'Just now';
    if (typeof createdAt === 'object' && 'seconds' in createdAt) {
      return new Date(createdAt.seconds * 1000).toLocaleDateString();
    }
    if (typeof createdAt === 'number') {
      return new Date(createdAt).toLocaleDateString();
    }
    return String(createdAt);
  };

  return (
    <div>
      <div className="admin-header-row">
        <h1 className="admin-title-no-margin">Manage Reminders</h1>
        <button className="btn btn-primary" onClick={openAddModal}>Add New Reminder</button>
      </div>

      {/* Table of existing reminders */}
      <div className="glass-card admin-table-container">
        <table className="admin-table">
          <thead>
            <tr className="admin-table-header-bg">
              <th className="admin-table-th" style={{ width: '15%' }}>Category</th>
              <th className="admin-table-th" style={{ width: '55%' }}>Content Preview</th>
              <th className="admin-table-th" style={{ width: '15%' }}>Date Created</th>
              <th className="admin-table-th" style={{ width: '15%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shortReads.length === 0 ? (
              <tr className="admin-table-header">
                <td colSpan={4} className="admin-table-td" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  No reminders found. Click "Add New Reminder" to get started.
                </td>
              </tr>
            ) : (
              shortReads.map((sr) => (
                <tr key={sr.id} className="admin-table-row admin-table-header">
                  <td className="admin-table-td-bold">
                    <span style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                    }}>
                      {sr.category}
                    </span>
                  </td>
                  <td className="admin-table-td-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '350px' }}>
                    {sr.content}
                  </td>
                  <td className="admin-table-td-muted">
                    {formatDate(sr.createdAt)}
                  </td>
                  <td className="admin-table-td admin-table-actions-cell">
                    <button onClick={() => openEditModal(sr)} className="admin-action-btn">Edit</button>
                    <button onClick={() => handleDelete(sr.id)} className="admin-action-btn-danger">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal with Live Preview */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog" style={{
            maxWidth: '850px',
            width: '90%',
            padding: isMobile ? '1.25rem 1rem' : '2.5rem 2rem',
          }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingReminderId ? 'Edit Reminder' : 'Add New Reminder'}</h2>
              <button onClick={closeModal} className="modal-close-btn">&times;</button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr',
              gap: '2rem',
              marginTop: '1rem',
            }}>
              
              {/* Form Column */}
              <form onSubmit={handleSubmit} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label htmlFor="reminder-category" className="form-label">Category</label>
                  <select
                    id="reminder-category"
                    className="form-input"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  {selectedCategory === 'Other' && (
                    <input
                      type="text"
                      className="form-input"
                      style={{ marginTop: '0.5rem' }}
                      placeholder="Enter custom category"
                      required
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                    />
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="reminder-content" className="form-label">Reminder Content</label>
                  <textarea
                    id="reminder-content"
                    className="form-input"
                    rows={8}
                    required
                    placeholder="Enter the quote or reminder message here. Support paragraph spacing by pressing Enter."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    style={{ fontFamily: 'Georgia, serif', lineHeight: 1.5, fontSize: '0.95rem' }}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Characters: {content.length} | Recommended limit is 350 characters for best display on card.
                  </p>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 'auto', padding: '0.8rem' }}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : (editingReminderId ? 'Save Changes' : 'Post Reminder')}
                </button>
              </form>

              {/* Live Preview Column */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderLeft: isMobile ? 'none' : '1px solid var(--border-color)',
                borderTop: isMobile ? '1px solid var(--border-color)' : 'none',
                paddingLeft: isMobile ? '0' : '2rem',
                paddingTop: isMobile ? '2rem' : '0',
              }}>
                <p style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '1rem',
                  letterSpacing: '0.05em'
                }}>
                  Live Template Preview
                </p>

                {/* Card preview representation */}
                <div style={{
                  position: 'relative',
                  width: `${cardWidth}px`,
                  height: `${cardHeight}px`,
                  borderRadius: '12px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                  backgroundImage: 'url("/images/short-read-template.jpg")',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                }}>
                  {/* Category overlay */}
                  <span style={{
                    position: 'absolute',
                    top: '0.6rem',
                    right: '0.6rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                    color: 'var(--text-primary)',
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
                  }}>
                    {selectedCategory === 'Other' ? (customCategory || 'Other') : selectedCategory}
                  </span>

                  {/* Text Overlay Section */}
                  <div style={{
                    position: 'absolute',
                    top: '38%',
                    bottom: '18%',
                    left: '8%',
                    right: '8%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}>
                    <p style={{
                      fontFamily: 'Georgia, serif',
                      fontSize: getFontSize(content),
                      lineHeight: 1.5,
                      color: '#221e1a',
                      fontWeight: 500,
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '100%',
                      overflow: 'hidden',
                      margin: 0,
                    }}>
                      {content || 'Your reminder content will display here as you type...'}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
