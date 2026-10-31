'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface UserRecord {
  id: string;
  email?: string;
  displayName?: string;
  societyName?: string;
  role: 'user' | 'creator' | 'society' | 'admin';
  createdAt?: any;
  purchasedBooks?: string[];
  enrolledCourses?: string[];
}

interface ManageUsersTabProps {
  onDirectMessageUser?: (userId: string, userEmail: string) => void;
}

export default function ManageUsersTab({ onDirectMessageUser }: ManageUsersTabProps) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'creator' | 'society' | 'admin'>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const fetched: UserRecord[] = snap.docs.map((d) => ({
          id: d.id,
          role: 'user',
          ...d.data(),
        } as UserRecord));

        // Sort by role (admins first, then creators, societies, users) and then alphabetically by email
        const roleOrder: Record<string, number> = { admin: 0, creator: 1, society: 2, user: 3 };
        fetched.sort((a, b) => {
          const rDiff = (roleOrder[a.role] ?? 4) - (roleOrder[b.role] ?? 4);
          if (rDiff !== 0) return rDiff;
          return (a.email || '').localeCompare(b.email || '');
        });

        setUsers(fetched);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to stream users:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (targetUser: UserRecord, newRole: string) => {
    if (targetUser.role === newRole) return;

    const confirmMsg =
      newRole === 'admin'
        ? `⚠️ Grant FULL ADMIN PRIVILEGES to "${targetUser.email || targetUser.displayName || targetUser.id}"? They will have complete platform access.`
        : `Change role of "${targetUser.email || targetUser.displayName || targetUser.id}" from "${targetUser.role}" to "${newRole}"?`;

    if (!confirm(confirmMsg)) return;

    setUpdatingUserId(targetUser.id);
    try {
      await updateDoc(doc(db, 'users', targetUser.id), {
        role: newRole,
        updatedAt: Date.now(),
      });
    } catch (err: any) {
      console.error('Role update error:', err);
      alert(err.message || 'Failed to update user role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const copyUserId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const counts = useMemo(() => {
    return {
      all: users.length,
      users: users.filter((u) => u.role === 'user').length,
      creators: users.filter((u) => u.role === 'creator').length,
      societies: users.filter((u) => u.role === 'society').length,
      admins: users.filter((u) => u.role === 'admin').length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        (u.societyName && u.societyName.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [users, roleFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.35)',
        };
      case 'creator':
        return {
          background: 'rgba(168, 85, 247, 0.15)',
          color: '#c084fc',
          border: '1px solid rgba(168, 85, 247, 0.35)',
        };
      case 'society':
        return {
          background: 'rgba(16, 185, 129, 0.15)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.35)',
        };
      default:
        return {
          background: 'rgba(148, 163, 184, 0.12)',
          color: '#94a3b8',
          border: '1px solid rgba(148, 163, 184, 0.25)',
        };
    }
  };

  const formatDate = (val: any) => {
    if (!val) return '—';
    try {
      const d = typeof val === 'number' ? new Date(val) : val.toDate ? val.toDate() : new Date(val);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  return (
    <div style={{ color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="admin-title" style={{ margin: '0 0 0.25rem 0' }}>Manage Users & Roles</h1>
          <p className="admin-subtitle" style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Search registered users, view profile access, and assign or promote account roles.
          </p>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem', borderRadius: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Registered</p>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{counts.all}</p>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem', borderRadius: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Standard Users</p>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#94a3b8' }}>{counts.users}</p>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem', borderRadius: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verified Creators</p>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#c084fc' }}>{counts.creators}</p>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem', borderRadius: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Societies</p>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#34d399' }}>{counts.societies}</p>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem', borderRadius: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Administrators</p>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#ef4444' }}>{counts.admins}</p>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div
        className="glass-card"
        style={{
          padding: '1.25rem',
          borderRadius: '16px',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name, email, or user UID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{ width: '100%', paddingLeft: '2.5rem', borderRadius: '10px' }}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
            🔍
          </span>
        </div>

        {/* Role Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['all', 'user', 'creator', 'society', 'admin'] as const).map((r) => {
            const active = roleFilter === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRoleFilter(r);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: active ? 700 : 500,
                  border: active ? '1px solid var(--accent-red)' : '1px solid rgba(255,255,255,0.08)',
                  background: active ? 'var(--accent-red)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.15s ease',
                }}
              >
                {r === 'all' ? `All (${counts.all})` : `${r}s (${counts[r === 'user' ? 'users' : r === 'creator' ? 'creators' : r === 'society' ? 'societies' : 'admins']})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading registered users...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>No users found matching your filters.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>User</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>UID</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Assign Role</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Joined</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u) => {
                  const badgeStyle = getRoleBadgeStyle(u.role);
                  const isUpdating = updatingUserId === u.id;
                  const name = u.displayName || u.societyName || 'Anonymous User';
                  const initial = (name.charAt(0) || u.email?.charAt(0) || 'U').toUpperCase();

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Name & Email */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
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
                            {initial}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{u.email || 'No email provided'}</div>
                          </div>
                        </div>
                      </td>

                      {/* UID */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <button
                          type="button"
                          onClick={() => copyUserId(u.id)}
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: copiedId === u.id ? 'var(--accent-gold)' : 'var(--text-secondary)',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontFamily: 'monospace',
                          }}
                          title="Click to copy UID"
                        >
                          <span>{u.id.slice(0, 8)}...</span>
                          <span>{copiedId === u.id ? '✓' : '📋'}</span>
                        </button>
                      </td>

                      {/* Current Role Badge */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            ...badgeStyle,
                          }}
                        >
                          {u.role}
                        </span>
                      </td>

                      {/* Role Dropdown Selector */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <select
                          value={u.role}
                          disabled={isUpdating}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: 'var(--text-primary)',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            cursor: isUpdating ? 'wait' : 'pointer',
                            outline: 'none',
                          }}
                        >
                          <option value="user" style={{ background: '#1e293b', color: '#fff' }}>User</option>
                          <option value="creator" style={{ background: '#1e293b', color: '#fff' }}>Creator</option>
                          <option value="society" style={{ background: '#1e293b', color: '#fff' }}>Society</option>
                          <option value="admin" style={{ background: '#1e293b', color: '#fff' }}>Admin</option>
                        </select>
                      </td>

                      {/* Joined Date */}
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {formatDate(u.createdAt)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        {onDirectMessageUser && u.email && (
                          <button
                            type="button"
                            onClick={() => onDirectMessageUser(u.id, u.email || '')}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(212, 175, 55, 0.3)',
                              color: 'var(--accent-gold)',
                              padding: '5px 10px',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            ✉ Message
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.25rem',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div>
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} users
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  Previous
                </button>
                <span style={{ padding: '6px 12px', fontWeight: 600, color: 'var(--accent-gold)' }}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
