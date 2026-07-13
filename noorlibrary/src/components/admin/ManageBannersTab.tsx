'use client';

import React, { useState } from 'react';
import { useApp, Banner } from '../../context/AppContext';

export default function ManageBannersTab() {
  const { banners, addBanner, updateBanner, deleteBanner } = useApp();
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = () => {
    setTitle('');
    setTargetUrl('');
    setImageUrl('');
    setIsActive(true);
    setImageFile(null);
    setEditingBanner(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (banner: Banner) => {
    setEditingBanner(banner);
    setTitle(banner.title);
    setTargetUrl(banner.targetUrl);
    setImageUrl(banner.imageUrl);
    setIsActive(banner.isActive);
    setImageFile(null);
    setIsAddModalOpen(true);
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'cover'); // Upload to covers bucket

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Image upload failed');
      }

      const data = await res.json();
      return data.url;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFile) {
        finalImageUrl = await handleImageUpload(imageFile);
      }

      if (!finalImageUrl) {
        alert('Please select an image file or provide an image URL');
        setIsSaving(false);
        return;
      }

      if (editingBanner) {
        await updateBanner({
          ...editingBanner,
          title,
          targetUrl,
          imageUrl: finalImageUrl,
          isActive,
        });
        alert('Banner updated successfully!');
      } else {
        await addBanner({
          title,
          targetUrl,
          imageUrl: finalImageUrl,
          isActive,
        });
        alert('Banner added successfully!');
      }
      setIsAddModalOpen(false);
    } catch (err: any) {
      alert(`Error saving banner: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      await updateBanner({
        ...banner,
        isActive: !banner.isActive,
      });
      alert(`Banner ${!banner.isActive ? 'activated' : 'deactivated'} successfully!`);
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotional banner?')) return;
    try {
      await deleteBanner(id);
      alert('Banner deleted successfully!');
    } catch (err: any) {
      alert(`Failed to delete banner: ${err.message}`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="admin-title">Manage Banners & Sponsors</h1>
          <p className="admin-subtitle" style={{ color: 'var(--text-secondary)' }}>Configure promotional banners and sliding cards that appear on the library home screen.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>Add Promotion Banner</button>
      </div>

      <div className="glass-card admin-table-container">
        <table className="admin-table">
          <thead>
            <tr className="admin-table-header">
              <th className="admin-table-th">Preview</th>
              <th className="admin-table-th">Banner Details</th>
              <th className="admin-table-th">Redirection Target</th>
              <th className="admin-table-th">Status</th>
              <th className="admin-table-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {banners.length === 0 ? (
              <tr className="admin-table-header">
                <td colSpan={5} className="admin-table-td" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  No banner promotions configured yet.
                </td>
              </tr>
            ) : (
              banners.map((banner) => (
                <tr key={banner.id} className="admin-table-row admin-table-header">
                  <td className="admin-table-td" style={{ width: '120px' }}>
                    <div style={{ width: '100px', height: '50px', position: 'relative', borderRadius: '4px', overflow: 'hidden', background: '#000', border: '1px solid var(--border-color)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={banner.imageUrl} alt={banner.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  </td>
                  <td className="admin-table-td" style={{ fontWeight: 600 }}>{banner.title}</td>
                  <td className="admin-table-td-muted" style={{ fontSize: '0.85rem' }}>
                    <a href={banner.targetUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>
                      {banner.targetUrl}
                    </a>
                  </td>
                  <td className="admin-table-td">
                    <button
                      onClick={() => handleToggleActive(banner)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.75rem',
                        borderRadius: '20px',
                        fontWeight: 600,
                        border: '1px solid transparent',
                        cursor: 'pointer',
                        background: banner.isActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.05)',
                        color: banner.isActive ? '#3b82f6' : 'var(--text-muted)',
                      }}
                    >
                      {banner.isActive ? '● Active' : '○ Inactive'}
                    </button>
                  </td>
                  <td className="admin-table-td admin-table-actions-cell">
                    <button onClick={() => openEditModal(banner)} className="admin-action-btn">Edit</button>
                    <button onClick={() => handleDelete(banner.id)} className="admin-action-btn-danger">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingBanner ? 'Edit Promotional Banner' : 'Create New Promotion'}</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="banner-title">Promotion Title</label>
                <input
                  id="banner-title"
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Ramadan Lecture Series 2026"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="banner-target">Redirection Target URL</label>
                <input
                  id="banner-target"
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. /courses/course_id or https://sponsor.site"
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Banner Image</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-input"
                    onChange={e => setImageFile(e.target.files ? e.target.files[0] : null)}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>or specify URL:</span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://images.unsplash.com/..."
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    id="banner-active"
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="banner-active" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                    Publish immediately (Show on Homepage)
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary modal-form-submit-btn"
                disabled={isUploading || isSaving}
                style={{
                  opacity: isUploading || isSaving ? 0.7 : 1,
                  cursor: isUploading || isSaving ? 'not-allowed' : 'pointer',
                  background: 'var(--accent-gold)',
                  border: 'none',
                }}
              >
                {isUploading ? 'Uploading Image...' : isSaving ? 'Saving Banner...' : editingBanner ? 'Update Banner' : 'Create Banner'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
