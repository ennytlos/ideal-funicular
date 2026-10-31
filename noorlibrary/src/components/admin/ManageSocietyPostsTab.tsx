'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useApp } from '../../context/AppContext';

interface SocietyPost {
  id: string;
  societyId: string;
  societyName: string;
  title: string;
  content: string;
  createdAt: number;
}

export default function ManageSocietyPostsTab() {
  const { user } = useApp();
  const [posts, setPosts] = useState<SocietyPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    // Filter posts by societyId unless user is admin
    const q = user.role === 'admin'
      ? collection(db, 'society_posts')
      : query(collection(db, 'society_posts'), where('societyId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SocietyPost));
      fetched.sort((a, b) => b.createdAt - a.createdAt);
      setPosts(fetched);
      setLoading(false);
    }, (err) => {
      console.error("Failed to load posts:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const openAddModal = () => {
    setTitle('');
    setContent('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    const postData = {
      title,
      content,
      societyId: user.uid,
      societyName: user.displayName || user.email.split('@')[0],
      createdAt: Date.now()
    };

    try {
      await addDoc(collection(db, 'society_posts'), postData);
      alert('Update posted successfully!');
      setIsModalOpen(false);
    } catch (err: any) {
      alert('Error saving post: ' + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this post?')) {
      try {
        await deleteDoc(doc(db, 'society_posts', id));
        alert('Post deleted.');
      } catch (err: any) {
        alert('Error deleting post: ' + (err.message || String(err)));
      }
    }
  };

  return (
    <div>
      <div className="admin-header-row" style={{ marginBottom: '1.5rem' }}>
        <h1 className="admin-title-no-margin">Manage Society Updates</h1>
        <button className="btn btn-primary" onClick={openAddModal}>Create New Update</button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading updates...</p>
      ) : posts.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', margin: 0 }}>No updates posted yet. Write an update to share text posts or announcements with your followers.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {posts.map(post => (
            <div key={post.id} className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--border-color)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>{post.title}</h3>
                  {user?.role === 'admin' && <span style={{ fontSize: '0.85rem', color: 'var(--accent-gold)' }}>By: {post.societyName}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(post.createdAt).toLocaleDateString()} {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button onClick={() => handleDelete(post.id)} className="admin-action-btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>Delete</button>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                {post.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add Post Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Create Society Update</h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="post-title">Update Title</label>
                <input id="post-title" type="text" className="form-input" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weekly Asalatu Reminder" />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="post-content">Message Content</label>
                <textarea id="post-content" className="form-input" rows={6} required value={content} onChange={e => setContent(e.target.value)} placeholder="Write your message or announcement here..." />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={isSubmitting}>
                {isSubmitting ? 'Posting...' : 'Publish Update'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
