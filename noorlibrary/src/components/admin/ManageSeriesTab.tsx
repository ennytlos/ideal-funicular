'use client';

import React, { useState } from 'react';
import { useApp, Series, Episode } from '../../context/AppContext';

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

export default function ManageSeriesTab() {
  const { series, addSeries, updateSeries, deleteSeries } = useApp();

  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [newSeries, setNewSeries] = useState<Partial<Series>>({
    title: '', author: 'Author Al-Noor', description: '', coverUrl: '', category: CATEGORIES[0], price: 0, episodes: []
  });
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [imageUploadType, setImageUploadType] = useState<'file' | 'url'>('file');

  const [isEpisodeModalOpen, setIsEpisodeModalOpen] = useState(false);
  const [activeSeries, setActiveSeries] = useState<Series | null>(null);
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [newEpisode, setNewEpisode] = useState<Partial<Episode>>({
    title: '', episodeNumber: 1, contentType: 'json', pdfPath: '', jsonPath: '', isSecure: true
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // --- Series Methods ---
  const openAddSeriesModal = () => {
    setEditingSeriesId(null);
    setNewSeries({ title: '', author: 'Author Al-Noor', description: '', coverUrl: '', category: CATEGORIES[0], price: 0, episodes: [] });
    setSelectedCategory(CATEGORIES[0]);
    setCustomCategory('');
    setCoverFile(null);
    setImageUploadType('file');
    setIsSeriesModalOpen(true);
  };

  const openEditSeriesModal = (s: Series) => {
    setEditingSeriesId(s.id);
    setNewSeries({ ...s });
    if (CATEGORIES.includes(s.category)) { setSelectedCategory(s.category); setCustomCategory(''); } 
    else { setSelectedCategory('Other'); setCustomCategory(s.category); }
    setImageUploadType(s.coverUrl?.startsWith('http') ? 'url' : 'file');
    setCoverFile(null);
    setIsSeriesModalOpen(true);
  };

  const handleSeriesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let finalCoverUrl = newSeries.coverUrl;
      if (coverFile) {
        const compressed = await compressImage(coverFile, 1, 0.8);
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('type', 'cover');
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) finalCoverUrl = data.url;
      }
      
      const sData = {
        title: newSeries.title || 'Untitled',
        author: newSeries.author || 'Author',
        description: newSeries.description || '',
        coverUrl: finalCoverUrl || '',
        category: selectedCategory === 'Other' ? customCategory : selectedCategory,
        price: Number(newSeries.price) || 0,
        episodes: newSeries.episodes || []
      };

      if (editingSeriesId) await updateSeries({ id: editingSeriesId, ...sData } as Series);
      else await addSeries(sData);

      setIsSeriesModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Episode Methods ---
  const openManageEpisodes = (s: Series) => {
    setActiveSeries(s);
  };

  const openAddEpisodeModal = () => {
    setEditingEpisodeId(null);
    setNewEpisode({ title: '', episodeNumber: (activeSeries?.episodes?.length || 0) + 1, contentType: 'json', pdfPath: '', jsonPath: '', isSecure: true });
    setPdfFile(null);
    setJsonFile(null);
    setIsEpisodeModalOpen(true);
  };

  const openEditEpisodeModal = (ep: Episode) => {
    setEditingEpisodeId(ep.id);
    setNewEpisode({ ...ep, isSecure: ep.isSecure !== false });
    setPdfFile(null);
    setJsonFile(null);
    setIsEpisodeModalOpen(true);
  };

  const handleEpisodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSeries) return;
    setIsSaving(true);
    try {
      let finalPdfPath = newEpisode.pdfPath;
      let finalJsonPath = newEpisode.jsonPath;
      
      if (newEpisode.contentType === 'pdf' && pdfFile) {
        const formData = new FormData();
        formData.append('file', pdfFile);
        formData.append('type', 'pdf');
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.path) finalPdfPath = data.path;
      } else if (newEpisode.contentType === 'json' && jsonFile) {
        const formData = new FormData();
        formData.append('file', jsonFile);
        formData.append('type', 'json');
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.path) finalJsonPath = data.path;
      }

      const ep: Episode = {
        id: editingEpisodeId || Date.now().toString(),
        title: newEpisode.title || `Episode ${newEpisode.episodeNumber}`,
        episodeNumber: Number(newEpisode.episodeNumber) || 1,
        contentType: newEpisode.contentType || 'json',
        pdfPath: finalPdfPath || '',
        jsonPath: finalJsonPath || '',
        isPublished: true,
        isSecure: newEpisode.isSecure !== false,
      };

      let updatedEpisodes = [...(activeSeries.episodes || [])];
      if (editingEpisodeId) {
        updatedEpisodes = updatedEpisodes.map(e => e.id === editingEpisodeId ? ep : e);
      } else {
        updatedEpisodes.push(ep);
      }

      const updatedSeries = { ...activeSeries, episodes: updatedEpisodes };
      await updateSeries(updatedSeries);
      setActiveSeries(updatedSeries);
      setIsEpisodeModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEpisode = async (epId: string) => {
    if (!activeSeries) return;
    if (confirm('Delete this episode?')) {
      const updatedEpisodes = activeSeries.episodes.filter(e => e.id !== epId);
      const updatedSeries = { ...activeSeries, episodes: updatedEpisodes };
      await updateSeries(updatedSeries);
      setActiveSeries(updatedSeries);
    }
  };

  return (
    <div>
      {/* Series List View */}
      {!activeSeries ? (
        <>
          <div className="admin-header-row">
            <h1 className="admin-title-no-margin">Manage Series</h1>
            <button className="btn btn-primary" onClick={openAddSeriesModal}>Add New Series</button>
          </div>
          <div className="glass-card admin-table-container">
            <table className="admin-table admin-table-books">
              <thead>
                <tr className="admin-table-header-bg">
                  <th className="admin-table-th">Title</th>
                  <th className="admin-table-th">Episodes</th>
                  <th className="admin-table-th">Price</th>
                  <th className="admin-table-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {series.map(s => (
                  <tr key={s.id} className="admin-table-row admin-table-header">
                    <td className="admin-table-td-bold">{s.title}</td>
                    <td className="admin-table-td-muted">{s.episodes?.length || 0} eps</td>
                    <td className="admin-table-td">{s.price === 0 ? 'Free' : `₦${s.price.toLocaleString()}`}</td>
                    <td className="admin-table-td admin-table-actions-cell">
                      <button onClick={() => openManageEpisodes(s)} className="admin-action-btn">Manage Episodes</button>
                      <button onClick={() => openEditSeriesModal(s)} className="admin-action-btn">Edit</button>
                      <button onClick={() => { if(confirm('Delete series?')) deleteSeries(s.id) }} className="admin-action-btn-danger">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Episode Management View */
        <>
          <div className="admin-header-row">
            <div>
              <button className="btn btn-secondary" style={{ marginBottom: '1rem' }} onClick={() => setActiveSeries(null)}>
                &larr; Back to Series
              </button>
              <h1 className="admin-title-no-margin">Episodes for &quot;{activeSeries.title}&quot;</h1>
            </div>
            <button className="btn btn-primary" onClick={openAddEpisodeModal}>Add Episode</button>
          </div>
          <div className="glass-card admin-table-container">
            <table className="admin-table admin-table-books">
              <thead>
                <tr className="admin-table-header-bg">
                  <th className="admin-table-th">Ep #</th>
                  <th className="admin-table-th">Title</th>
                  <th className="admin-table-th">Format</th>
                  <th className="admin-table-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(activeSeries.episodes || []).sort((a,b) => a.episodeNumber - b.episodeNumber).map(ep => (
                  <tr key={ep.id} className="admin-table-row admin-table-header">
                    <td className="admin-table-td-bold">{ep.episodeNumber}</td>
                    <td className="admin-table-td-muted">{ep.title}</td>
                    <td className="admin-table-td"><span className="badge badge-premium">{ep.contentType.toUpperCase()}</span></td>
                    <td className="admin-table-td admin-table-actions-cell">
                      <button onClick={() => openEditEpisodeModal(ep)} className="admin-action-btn">Edit</button>
                      <button onClick={() => handleDeleteEpisode(ep.id)} className="admin-action-btn-danger">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Series Modal */}
      {isSeriesModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">{editingSeriesId ? 'Edit Series' : 'Add New Series'}</h2>
              <button onClick={() => setIsSeriesModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>
            <form onSubmit={handleSeriesSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="series-title">Title</label>
                <input id="series-title" type="text" className="form-input" required value={newSeries.title} onChange={e => setNewSeries({...newSeries, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="series-description">Description</label>
                <textarea id="series-description" className="form-input" rows={3} required value={newSeries.description} onChange={e => setNewSeries({...newSeries, description: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="series-price">Price (₦)</label>
                <input id="series-price" type="number" className="form-input" step="0.01" required value={newSeries.price} onChange={e => setNewSeries({...newSeries, price: Number(e.target.value)})} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={imageUploadType === 'file' ? 'series-cover-file' : 'series-cover-url'}>Cover Image</label>
                {imageUploadType === 'file' ? (
                  <input id="series-cover-file" type="file" accept="image/*" className="form-input" onChange={e => e.target.files && setCoverFile(e.target.files[0])} />
                ) : (
                  <input id="series-cover-url" type="url" className="form-input" value={newSeries.coverUrl || ''} onChange={e => setNewSeries({...newSeries, coverUrl: e.target.value})} />
                )}
                <button type="button" onClick={() => setImageUploadType(prev => prev === 'file' ? 'url' : 'file')} className="btn btn-secondary" style={{marginTop: '0.5rem'}}>
                  Toggle Upload/URL
                </button>
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Series'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Episode Modal */}
      {isEpisodeModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">{editingEpisodeId ? 'Edit Episode' : 'Add Episode'}</h2>
              <button onClick={() => setIsEpisodeModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>
            <form onSubmit={handleEpisodeSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="episode-number">Episode Number</label>
                <input id="episode-number" type="number" className="form-input" required value={newEpisode.episodeNumber} onChange={e => setNewEpisode({...newEpisode, episodeNumber: Number(e.target.value)})} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="episode-title">Title</label>
                <input id="episode-title" type="text" className="form-input" required value={newEpisode.title} onChange={e => setNewEpisode({...newEpisode, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="episode-format">Format</label>
                <select id="episode-format" className="form-input" value={newEpisode.contentType} onChange={e => setNewEpisode({...newEpisode, contentType: e.target.value as 'pdf'|'json'})}>
                  <option value="json">JSON Text</option>
                  <option value="pdf">PDF Document</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Security Settings</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input id="episode-secure" type="checkbox" checked={newEpisode.isSecure !== false} onChange={e => setNewEpisode({...newEpisode, isSecure: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  <label htmlFor="episode-secure" className="image-upload-type-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                    Secure Access (Requires Bunny Token Authorization)
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor={newEpisode.contentType === 'pdf' ? 'episode-pdf' : 'episode-json'}>Upload Content</label>
                {newEpisode.contentType === 'pdf' ? (
                  <input id="episode-pdf" type="file" accept="application/pdf" className="form-input" onChange={e => e.target.files && setPdfFile(e.target.files[0])} />
                ) : (
                  <input id="episode-json" type="file" accept=".json,application/json" className="form-input" onChange={e => e.target.files && setJsonFile(e.target.files[0])} />
                )}
                {newEpisode.pdfPath && newEpisode.contentType === 'pdf' && <p>Current: {newEpisode.pdfPath}</p>}
                {newEpisode.jsonPath && newEpisode.contentType === 'json' && <p>Current: {newEpisode.jsonPath}</p>}
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Uploading & Saving...' : 'Save Episode'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
