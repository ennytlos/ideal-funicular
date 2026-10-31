'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useApp } from '../../context/AppContext';

interface WeeklyProgram {
  id: string;
  societyId: string;
  societyName: string;
  title: string;
  dayOfWeek: string;
  time: string;
  description: string;
  attachedPrayers: string;
  createdAt: number;
}

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export default function ManageSocietyProgramsTab() {
  const { user } = useApp();
  const [programs, setPrograms] = useState<WeeklyProgram[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<WeeklyProgram | null>(null);
  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('Sunday');
  const [time, setTime] = useState('10:00 AM');
  const [description, setDescription] = useState('');
  const [attachedPrayers, setAttachedPrayers] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    // Filter programs by societyId unless the user is an admin
    const q = user.role === 'admin'
      ? collection(db, 'weekly_programs')
      : query(collection(db, 'weekly_programs'), where('societyId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as WeeklyProgram));
      fetched.sort((a, b) => b.createdAt - a.createdAt);
      setPrograms(fetched);
      setLoading(false);
    }, (err) => {
      console.error("Failed to load programs:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const openAddModal = () => {
    setEditingProgram(null);
    setTitle('');
    setDayOfWeek('Sunday');
    setTime('10:00 AM');
    setDescription('');
    setAttachedPrayers('');
    setIsModalOpen(true);
  };

  const openEditModal = (prog: WeeklyProgram) => {
    setEditingProgram(prog);
    setTitle(prog.title);
    setDayOfWeek(prog.dayOfWeek);
    setTime(prog.time);
    setDescription(prog.description);
    setAttachedPrayers(prog.attachedPrayers || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    const programData = {
      title,
      dayOfWeek,
      time,
      description,
      attachedPrayers,
      societyId: editingProgram ? editingProgram.societyId : user.uid,
      societyName: editingProgram ? editingProgram.societyName : (user.displayName || user.email.split('@')[0]),
      createdAt: editingProgram ? editingProgram.createdAt : Date.now()
    };

    try {
      if (editingProgram) {
        await updateDoc(doc(db, 'weekly_programs', editingProgram.id), programData);
        alert('Weekly program updated successfully!');
      } else {
        await addDoc(collection(db, 'weekly_programs'), programData);
        alert('Weekly program added successfully!');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert('Error saving program: ' + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this weekly program?')) {
      try {
        await deleteDoc(doc(db, 'weekly_programs', id));
        alert('Weekly program deleted.');
      } catch (err: any) {
        alert('Error deleting program: ' + (err.message || String(err)));
      }
    }
  };

  return (
    <div>
      <div className="admin-header-row" style={{ marginBottom: '1.5rem' }}>
        <h1 className="admin-title-no-margin">Manage Weekly Programs</h1>
        <button className="btn btn-primary" onClick={openAddModal}>Add New Program</button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading programs...</p>
      ) : programs.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', margin: 0 }}>No weekly programs found. Add a program to share with your followers.</p>
        </div>
      ) : (
        <div className="glass-card admin-table-container">
          <table className="admin-table">
            <thead>
              <tr className="admin-table-header-bg">
                <th className="admin-table-th">Program Title</th>
                {user?.role === 'admin' && <th className="admin-table-th">Society</th>}
                <th className="admin-table-th">Schedule</th>
                <th className="admin-table-th">Description</th>
                <th className="admin-table-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {programs.map(prog => (
                <tr key={prog.id} className="admin-table-row admin-table-header">
                  <td className="admin-table-td-bold">{prog.title}</td>
                  {user?.role === 'admin' && <td className="admin-table-td">{prog.societyName}</td>}
                  <td className="admin-table-td-muted">Every {prog.dayOfWeek} at {prog.time}</td>
                  <td className="admin-table-td" style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {prog.description}
                  </td>
                  <td className="admin-table-td admin-table-actions-cell" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEditModal(prog)} className="admin-action-btn">Edit</button>
                    <button onClick={() => handleDelete(prog.id)} className="admin-action-btn-danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Program Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingProgram ? 'Edit Program' : 'Add Weekly Program'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="prog-title">Program Title</label>
                <input id="prog-title" type="text" className="form-input" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Asalatu Sunday Prayer" />
              </div>

              <div className="modal-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="prog-day">Day of Week</label>
                  <select id="prog-day" className="form-input" value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}>
                    {DAYS_OF_WEEK.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="prog-time">Time</label>
                  <input id="prog-time" type="text" className="form-input" required value={time} onChange={e => setTime(e.target.value)} placeholder="e.g. 10:00 AM" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="prog-desc">Description</label>
                <textarea id="prog-desc" className="form-input" rows={3} required value={description} onChange={e => setDescription(e.target.value)} placeholder="Explain the focus of this weekly program..." />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="prog-prayers">Prayers & Adhkar to Read (Optional)</label>
                <textarea id="prog-prayers" className="form-input" rows={3} value={attachedPrayers} onChange={e => setAttachedPrayers(e.target.value)} placeholder="List specific Surahs, Duas, or count targets..." />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingProgram ? 'Update Program' : 'Create Program'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
