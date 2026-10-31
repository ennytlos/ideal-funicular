'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface SocietyRequest {
  id: string; // userId
  societyName: string;
  email: string;
  description: string;
  leaderName: string;
  manhaj: string;
  socialProfile: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: number;
}

export default function SocietyRequestsTab() {
  const [requests, setRequests] = useState<SocietyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'society_requests'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const fetched: SocietyRequest[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<SocietyRequest, 'id'>)
      }));
      fetched.sort((a, b) => b.submittedAt - a.submittedAt);
      setRequests(fetched);
      setLoading(false);
    }, (err) => {
      console.error("Failed to fetch society requests:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (req: SocietyRequest) => {
    if (confirm(`Are you sure you want to approve "${req.societyName}" as an Islamic Society?`)) {
      try {
        // 1. Update request status to approved
        await updateDoc(doc(db, 'society_requests', req.id), {
          status: 'approved'
        });

        // 2. Update user's role to society
        await updateDoc(doc(db, 'users', req.id), {
          role: 'society'
        });

        alert("Society request approved successfully!");
      } catch (err: any) {
        alert("Error approving request: " + (err.message || String(err)));
      }
    }
  };

  const handleReject = async (req: SocietyRequest) => {
    if (confirm(`Are you sure you want to reject "${req.societyName}"'s application?`)) {
      try {
        // Update request status to rejected
        await updateDoc(doc(db, 'society_requests', req.id), {
          status: 'rejected'
        });
        
        // Reset role to user
        await updateDoc(doc(db, 'users', req.id), {
          role: 'user'
        });

        alert("Society request rejected.");
      } catch (err: any) {
        alert("Error rejecting request: " + (err.message || String(err)));
      }
    }
  };

  const filteredRequests = requests.filter(req => {
    if (statusFilter === 'all') return true;
    return req.status === statusFilter;
  });

  return (
    <div>
      <div className="admin-header-row" style={{ marginBottom: '1.5rem' }}>
        <h1 className="admin-title-no-margin">Society Applications</h1>
      </div>

      {/* Filter Bar */}
      <div className="glass-card" style={{ padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Filter Status:</span>
          <select 
            className="form-input" 
            style={{ width: '150px', padding: '0.4rem 0.8rem' }}
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Showing {filteredRequests.length} application(s)
        </span>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading applications...</p>
      ) : filteredRequests.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', margin: 0 }}>No society applications found matching filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filteredRequests.map(req => (
            <div key={req.id} className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--border-color)', position: 'relative' }}>
              
              {/* Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontFamily: 'Outfit', fontSize: '1.3rem', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>{req.societyName}</h3>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Contact Email: {req.email}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`badge ${req.status === 'approved' ? 'badge-gold' : req.status === 'rejected' ? 'badge-danger' : ''}`} style={{ textTransform: 'capitalize' }}>
                    {req.status}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(req.submittedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Grid details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <h5 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Leader / Founder</h5>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>{req.leaderName}</p>
                </div>
                <div>
                  <h5 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Manhaj</h5>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>{req.manhaj}</p>
                </div>
                <div>
                  <h5 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Website / Social</h5>
                  <a href={req.socialProfile} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.95rem', color: 'var(--accent-gold)', textDecoration: 'none', wordBreak: 'break-all' }}>
                    {req.socialProfile}
                  </a>
                </div>
              </div>

              {/* Description & bank info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}>
                <div>
                  <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Description</h5>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {req.description}
                  </p>
                </div>

                <div>
                  <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Bank Account (for programs/donations)</h5>
                  {req.bankName ? (
                    <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <p style={{ margin: '0 0 0.15rem 0', fontSize: '0.85rem' }}><strong>Bank:</strong> {req.bankName}</p>
                      <p style={{ margin: '0 0 0.15rem 0', fontSize: '0.85rem' }}><strong>Name:</strong> {req.accountName}</p>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}><strong>Number:</strong> {req.accountNumber}</p>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)' }}>No bank details provided</p>
                  )}
                </div>
              </div>

              {/* Admin Actions */}
              {req.status === 'pending' && (
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button 
                    onClick={() => handleReject(req)} 
                    className="btn btn-secondary" 
                    style={{ background: 'rgba(229, 9, 20, 0.1)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)' }}
                  >
                    Reject Application
                  </button>
                  <button 
                    onClick={() => handleApprove(req)} 
                    className="btn btn-primary"
                  >
                    Approve Society
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
