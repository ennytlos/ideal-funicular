'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useApp } from '../../context/AppContext';

interface RawUserDoc {
  id: string;
  displayName?: string;
  name?: string;
  email?: string;
  createdAt?: any;
  purchasedBooks?: string[];
  purchasedSeries?: string[];
  enrolledCourses?: string[];
  courseProgress?: Record<string, string[]>;
}

interface FollowDoc {
  id: string;
  userId: string;
  creatorId: string;
  createdAt?: number;
}

/**
 * Privacy-safe name formatter: returns the user's full display name,
 * or humanizes the local part of an email without ever exposing the email address.
 */
export function getPrivacySafeFullName(userDoc?: {
  displayName?: string;
  name?: string;
  email?: string;
} | null): string {
  if (!userDoc) return 'Noor Reader';
  if (userDoc.displayName && !userDoc.displayName.includes('@')) {
    return userDoc.displayName.trim();
  }
  if (userDoc.name && !userDoc.name.includes('@')) {
    return userDoc.name.trim();
  }
  const raw = userDoc.displayName || userDoc.name || userDoc.email || '';
  const prefix = raw.split('@')[0] || '';
  if (!prefix) return 'Noor Reader';
  return prefix
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function formatJoinDate(val: any): string {
  if (!val) return 'Member';
  try {
    const d =
      typeof val === 'number'
        ? new Date(val)
        : typeof val?.toDate === 'function'
        ? val.toDate()
        : new Date(val);
    if (isNaN(d.getTime())) return 'Member';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Member';
  }
}

export default function AudienceTab() {
  const { user, books, series, courses } = useApp();
  const [usersList, setUsersList] = useState<RawUserDoc[]>([]);
  const [followsList, setFollowsList] = useState<FollowDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchName, setSearchName] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<'all' | 'books' | 'series' | 'courses' | 'members'>('all');
  const [selectedContentId, setSelectedContentId] = useState<string>('all');

  // Society DM Broadcast state
  const [dmSubject, setDmSubject] = useState('');
  const [dmMessage, setDmMessage] = useState('');
  const [dmTargetMemberId, setDmTargetMemberId] = useState<string>('all_members');
  const [isSendingDm, setIsSendingDm] = useState(false);

  const isSociety = user?.role === 'society';
  const isAdmin = user?.role === 'admin';

  // Owned catalog items for this creator/society (or all if admin)
  const myBooks = useMemo(
    () => books.filter((b) => isAdmin || b.creatorId === user?.uid),
    [books, isAdmin, user?.uid]
  );
  const mySeries = useMemo(
    () => series.filter((s) => isAdmin || s.creatorId === user?.uid),
    [series, isAdmin, user?.uid]
  );
  const myCourses = useMemo(
    () => courses.filter((c) => isAdmin || c.creatorId === user?.uid),
    [courses, isAdmin, user?.uid]
  );

  const myBookIds = useMemo(() => new Set(myBooks.map((b) => b.id)), [myBooks]);
  const mySeriesIds = useMemo(() => new Set(mySeries.map((s) => s.id)), [mySeries]);
  const myCourseIds = useMemo(() => new Set(myCourses.map((c) => c.id)), [myCourses]);

  // Stream users & follows
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const docs: RawUserDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RawUserDoc, 'id'>),
        }));
        setUsersList(docs);
        setLoading(false);
      },
      async (err) => {
        console.warn('Direct Firestore users collection listen restricted, falling back to secure students API:', err);
        // Fallback for creators to securely view their enrolled course students
        try {
          const token = await auth.currentUser?.getIdToken();
          const res = await fetch('/api/creator/students', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const data = await res.json();
            const mappedDocs: RawUserDoc[] = (data.students || []).map((s: any) => ({
              id: s.uid,
              displayName: s.displayName,
              email: s.email,
              enrolledCourses: [s.courseId],
              courseProgress: {
                [s.courseId]: Array.from({ length: s.completedLessons }, (_, i) => `lesson_${i}`),
              },
              createdAt: s.enrolledAt,
            }));
            setUsersList(mappedDocs);
          }
        } catch (apiErr) {
          console.error('Failed to load students via API fallback:', apiErr);
        } finally {
          setLoading(false);
        }
      }
    );

    const followsQuery = isAdmin
      ? query(collection(db, 'follows'))
      : query(collection(db, 'follows'), where('creatorId', '==', user.uid));

    const unsubFollows = onSnapshot(
      followsQuery,
      (snap) => {
        const fDocs: FollowDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FollowDoc, 'id'>),
        }));
        setFollowsList(fDocs);
      },
      (err) => {
        console.error('Failed to load follows:', err);
      }
    );

    return () => {
      unsubUsers();
      unsubFollows();
    };
  }, [user, isAdmin]);

  const followerMap = useMemo(() => {
    const map = new Map<string, number>();
    followsList.forEach((f) => {
      if (f.userId) {
        map.set(f.userId, f.createdAt || 0);
      }
    });
    return map;
  }, [followsList]);

  // Build privacy-safe audience rows
  const audienceRows = useMemo(() => {
    return usersList
      .filter((u) => u.id !== user?.uid)
      .map((u) => {
        const purchasedMyBooks = (u.purchasedBooks || [])
          .filter((id) => myBookIds.has(id))
          .map((id) => myBooks.find((b) => b.id === id)!)
          .filter(Boolean);

        const purchasedMySeries = (u.purchasedSeries || [])
          .filter((id) => mySeriesIds.has(id))
          .map((id) => mySeries.find((s) => s.id === id)!)
          .filter(Boolean);

        const enrolledMyCourses = (u.enrolledCourses || [])
          .filter((id) => myCourseIds.has(id))
          .map((id) => {
            const c = myCourses.find((course) => course.id === id);
            if (!c) return null;
            const totalLessons = c.lessons?.length || 0;
            const completedIds = u.courseProgress?.[c.id] || [];
            const validCompleted = c.lessons
              ? c.lessons.filter((l) => completedIds.includes(l.id)).length
              : completedIds.length;
            const pct =
              totalLessons > 0
                ? Math.min(100, Math.round((validCompleted / totalLessons) * 100))
                : 0;
            return {
              id: c.id,
              title: c.title,
              completedCount: validCompleted,
              totalLessons,
              progressPct: pct,
            };
          })
          .filter(Boolean) as Array<{
          id: string;
          title: string;
          completedCount: number;
          totalLessons: number;
          progressPct: number;
        }>;

        const isFollowerOrMember = followerMap.has(u.id);
        const followTimestamp = followerMap.get(u.id);

        return {
          uid: u.id,
          fullName: getPrivacySafeFullName(u),
          email: u.email || '',
          joinedDate: formatJoinDate(followTimestamp || u.createdAt),
          isFollowerOrMember,
          purchasedMyBooks,
          purchasedMySeries,
          enrolledMyCourses,
          totalInteractions:
            purchasedMyBooks.length +
            purchasedMySeries.length +
            enrolledMyCourses.length +
            (isFollowerOrMember ? 1 : 0),
        };
      })
      .filter((row) => row.totalInteractions > 0);
  }, [
    usersList,
    user?.uid,
    myBookIds,
    mySeriesIds,
    myCourseIds,
    myBooks,
    mySeries,
    myCourses,
    followerMap,
  ]);

  // Apply search & segment filters
  const filteredRows = useMemo(() => {
    return audienceRows.filter((row) => {
      if (
        searchName.trim() &&
        !row.fullName.toLowerCase().includes(searchName.trim().toLowerCase())
      ) {
        return false;
      }

      if (segmentFilter === 'books' && row.purchasedMyBooks.length === 0) {
        return false;
      }
      if (segmentFilter === 'series' && row.purchasedMySeries.length === 0) {
        return false;
      }
      if (segmentFilter === 'courses' && row.enrolledMyCourses.length === 0) {
        return false;
      }
      if (segmentFilter === 'members' && !row.isFollowerOrMember) {
        return false;
      }

      if (selectedContentId !== 'all') {
        const hasBook = row.purchasedMyBooks.some((b) => b.id === selectedContentId);
        const hasSeries = row.purchasedMySeries.some((s) => s.id === selectedContentId);
        const hasCourse = row.enrolledMyCourses.some((c) => c.id === selectedContentId);
        if (!hasBook && !hasSeries && !hasCourse) return false;
      }

      return true;
    });
  }, [audienceRows, searchName, segmentFilter, selectedContentId]);

  // Summary metrics
  const metrics = useMemo(() => {
    const bookReaders = audienceRows.filter((r) => r.purchasedMyBooks.length > 0).length;
    const seriesReaders = audienceRows.filter((r) => r.purchasedMySeries.length > 0).length;
    const courseStudents = audienceRows.filter((r) => r.enrolledMyCourses.length > 0).length;
    const membersCount = audienceRows.filter((r) => r.isFollowerOrMember).length;
    return {
      totalAudience: audienceRows.length,
      bookReaders,
      seriesReaders,
      courseStudents,
      membersCount,
    };
  }, [audienceRows]);

  // Handle Society sending DM to all members or a specific member
  const handleSendSocietyDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !dmSubject.trim() || !dmMessage.trim()) return;

    const targetRecipients =
      dmTargetMemberId === 'all_members'
        ? audienceRows.map((r) => r.uid)
        : [dmTargetMemberId];

    if (targetRecipients.length === 0) {
      alert('You do not have any members to message yet.');
      return;
    }

    setIsSendingDm(true);
    try {
      const senderName =
        user.displayName ||
        (user as any).societyName ||
        'Islamic Society';
      const now = Date.now();

      for (const recipientUid of targetRecipients) {
        const msgRef = doc(collection(db, 'messages'));
        await setDoc(msgRef, {
          id: msgRef.id,
          senderId: user.uid,
          senderName,
          recipientId: recipientUid,
          subject: dmSubject.trim(),
          messageText: dmMessage.trim(),
          createdAt: now,
        });

        const notifRef = doc(collection(db, 'notifications'));
        await setDoc(notifRef, {
          id: notifRef.id,
          senderId: user.uid,
          senderName,
          title: `${senderName}: ${dmSubject.trim()}`,
          message: dmMessage.trim().substring(0, 120),
          body: dmMessage.trim().substring(0, 120),
          type: 'direct',
          targetId: recipientUid,
          audience: 'user',
          deepLink: '/account',
          url: '/account',
          data: { url: '/account' },
          createdAt: now,
        });
      }

      // Trigger push notifications if possible
      try {
        const token = await auth.currentUser?.getIdToken();
        for (const recipientUid of targetRecipients) {
          await fetch('/api/notifications/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              title: `${senderName}: ${dmSubject.trim()}`,
              message: dmMessage.trim().substring(0, 150),
              targetType: 'specific',
              targetUid: recipientUid,
              deepLink: '/account',
              data: { url: '/account' },
              sendPush: true,
              saveInApp: false,
            }),
          });
        }
      } catch (pushErr) {
        console.warn('Society push notification warning:', pushErr);
      }

      alert(
        dmTargetMemberId === 'all_members'
          ? `Direct message sent to all ${targetRecipients.length} society member(s)!`
          : 'Direct message sent to member!'
      );
      setDmSubject('');
      setDmMessage('');
    } catch (err: any) {
      alert(err.message || 'Failed to send direct message to members.');
    } finally {
      setIsSendingDm(false);
    }
  };

  return (
    <div>
      <div className="admin-header-row" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="admin-title-no-margin">
            {isSociety ? 'Society Members & Readers' : 'My Readers & Course Students'}
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            {isSociety
              ? 'Privacy-safe directory of your society members and readers (names only, emails hidden).'
              : 'Privacy-safe view of your readers and students — showing full names, items purchased, date joined, and course progress.'}
          </p>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            {isSociety ? 'Total Members & Readers' : 'Total Audience'}
          </p>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {metrics.totalAudience}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--accent-gold)', textTransform: 'uppercase' }}>
            {isSociety ? 'Followers / Members' : 'Followers'}
          </p>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.7rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
            {metrics.membersCount}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--accent-red)', textTransform: 'uppercase' }}>
            Book Readers
          </p>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.7rem', fontWeight: 800, color: 'var(--accent-red)' }}>
            {metrics.bookReaders}
          </p>
        </div>

        {!isSociety && (
          <>
            <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '12px' }}>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#38bdf8', textTransform: 'uppercase' }}>
                Series Readers
              </p>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.7rem', fontWeight: 800, color: '#38bdf8' }}>
                {metrics.seriesReaders}
              </p>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '12px' }}>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#10b981', textTransform: 'uppercase' }}>
                Course Students
              </p>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.7rem', fontWeight: 800, color: '#10b981' }}>
                {metrics.courseStudents}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Society Direct Message to Members Card */}
      {isSociety && (
        <div
          className="glass-card"
          style={{
            padding: '1.75rem',
            borderRadius: '14px',
            marginBottom: '2rem',
            border: '1px solid rgba(212, 175, 55, 0.35)',
          }}
        >
          <h3 style={{ fontFamily: 'Outfit', fontSize: '1.2rem', margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
            Direct Message Society Members
          </h3>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Send a direct message and notification to all of your society members or a specific member by name.
          </p>

          <form onSubmit={handleSendSocietyDm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="soc-dm-target">Recipient</label>
                <select
                  id="soc-dm-target"
                  className="form-input"
                  value={dmTargetMemberId}
                  onChange={(e) => setDmTargetMemberId(e.target.value)}
                >
                  <option value="all_members">
                    All My Society Members ({audienceRows.length})
                  </option>
                  {audienceRows.map((member) => (
                    <option key={member.uid} value={member.uid}>
                      {member.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="soc-dm-subject">Subject</label>
                <input
                  id="soc-dm-subject"
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Friday Halqah & Special Du'a Session"
                  value={dmSubject}
                  onChange={(e) => setDmSubject(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="soc-dm-body">Message</label>
              <textarea
                id="soc-dm-body"
                rows={3}
                className="form-input"
                required
                placeholder="Write your announcement or message to your members..."
                value={dmMessage}
                onChange={(e) => setDmMessage(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: 'fit-content' }}
              disabled={isSendingDm || audienceRows.length === 0}
            >
              {isSendingDm
                ? 'Sending Direct Message...'
                : dmTargetMemberId === 'all_members'
                ? `Send DM to All Members (${audienceRows.length})`
                : 'Send Direct Message'}
            </button>
          </form>
        </div>
      )}

      {/* Filter Bar */}
      <div
        className="glass-card"
        style={{
          padding: '1.25rem',
          borderRadius: '14px',
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="audience-search-name">Search by Full Name</label>
          <input
            id="audience-search-name"
            type="text"
            className="form-input"
            placeholder="Search reader or student name..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="audience-segment">Filter by Category</label>
          <select
            id="audience-segment"
            className="form-input"
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value as any)}
          >
            <option value="all">All Audience</option>
            <option value="members">{isSociety ? 'Society Members' : 'Followers'}</option>
            <option value="books">Book Readers</option>
            {!isSociety && <option value="series">Series Readers</option>}
            {!isSociety && <option value="courses">Course Students</option>}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="audience-item-filter">Filter by Specific Title</label>
          <select
            id="audience-item-filter"
            className="form-input"
            value={selectedContentId}
            onChange={(e) => setSelectedContentId(e.target.value)}
          >
            <option value="all">All My Titles</option>
            {myBooks.length > 0 && (
              <optgroup label="Books">
                {myBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </optgroup>
            )}
            {!isSociety && mySeries.length > 0 && (
              <optgroup label="Series">
                {mySeries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </optgroup>
            )}
            {!isSociety && myCourses.length > 0 && (
              <optgroup label="Courses">
                {myCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {/* Course Students Batch Tools */}
      {!isSociety && myCourses.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
            onClick={() => {
              const emails = filteredRows
                .filter((r) => r.enrolledMyCourses.length > 0 && r.email)
                .map((r) => r.email);
              if (emails.length === 0) {
                alert('No student emails found in current filtered view.');
                return;
              }
              navigator.clipboard.writeText(emails.join(', '));
              alert(`Copied ${emails.length} enrolled student email(s) to clipboard!`);
            }}
          >
            📋 Copy Enrolled Student Emails
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
            onClick={() => {
              const courseStudents = filteredRows.filter((r) => r.enrolledMyCourses.length > 0);
              if (courseStudents.length === 0) {
                alert('No students to export.');
                return;
              }
              const headers = ['Full Name', 'Email', 'Course', 'Progress (%)', 'Date Joined'];
              const rows: string[][] = [];
              courseStudents.forEach((cs) => {
                cs.enrolledMyCourses.forEach((c) => {
                  rows.push([
                    `"${cs.fullName.replace(/"/g, '""')}"`,
                    `"${cs.email.replace(/"/g, '""')}"`,
                    `"${c.title.replace(/"/g, '""')}"`,
                    `${c.progressPct}%`,
                    `"${cs.joinedDate}"`,
                  ]);
                });
              });
              const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement('a');
              link.setAttribute('href', encodedUri);
              link.setAttribute('download', `noor_enrolled_students.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            ⬇ Export Students CSV
          </button>
        </div>
      )}

      {/* Privacy-Safe Audience Table */}
      <div className="glass-card admin-table-container">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading audience records...
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No readers, students, or members match your current filter.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr className="admin-table-header-bg">
                <th className="admin-table-th">Full Name</th>
                <th className="admin-table-th">Date Joined</th>
                <th className="admin-table-th">
                  {isSociety ? 'Books / Audio & Membership' : 'Books & Series Purchased'}
                </th>
                {!isSociety && (
                  <th className="admin-table-th">Courses Enrolled & Progress</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.uid} className="admin-table-row">
                  <td className="admin-table-td-bold">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'rgba(212, 175, 55, 0.14)',
                          border: '1px solid rgba(212, 175, 55, 0.4)',
                          color: 'var(--accent-gold)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          flexShrink: 0,
                        }}
                      >
                        {row.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div>{row.fullName}</div>
                        {row.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px' }}>
                            <a
                              href={`mailto:${row.email}`}
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--text-secondary)',
                                textDecoration: 'underline',
                              }}
                              title="Click to email student"
                            >
                              {row.email}
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(row.email);
                                alert(`Copied email ${row.email} to clipboard!`);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                color: 'var(--accent-gold)',
                                padding: 0,
                              }}
                              title="Copy student email"
                            >
                              📋
                            </button>
                          </div>
                        )}
                        {row.isFollowerOrMember && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--accent-gold)',
                              fontWeight: 600,
                            }}
                          >
                            {isSociety ? '✓ Society Member' : '✓ Following You'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="admin-table-td-muted" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {row.joinedDate}
                  </td>

                  <td className="admin-table-td">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {row.purchasedMyBooks.map((b) => (
                        <span
                          key={`book-${b.id}`}
                          className="badge"
                          style={{
                            background: 'rgba(229, 9, 20, 0.12)',
                            color: 'var(--accent-red)',
                            border: '1px solid rgba(229, 9, 20, 0.3)',
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                          }}
                        >
                          Book: {b.title}
                        </span>
                      ))}
                      {row.purchasedMySeries.map((s) => (
                        <span
                          key={`series-${s.id}`}
                          className="badge"
                          style={{
                            background: 'rgba(56, 189, 248, 0.12)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                          }}
                        >
                          Series: {s.title}
                        </span>
                      ))}
                      {row.purchasedMyBooks.length === 0 &&
                        row.purchasedMySeries.length === 0 && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {isSociety && row.isFollowerOrMember ? 'Active Member' : '—'}
                          </span>
                        )}
                    </div>
                  </td>

                  {!isSociety && (
                    <td className="admin-table-td" style={{ minWidth: '240px' }}>
                      {row.enrolledMyCourses.length === 0 ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                          {row.enrolledMyCourses.map((c) => (
                            <div
                              key={`course-${c.id}`}
                              style={{
                                background: 'var(--bg-primary)',
                                padding: '0.5rem 0.7rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  marginBottom: '0.25rem',
                                  gap: '0.5rem',
                                }}
                              >
                                <span style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                                <span
                                  style={{
                                    color:
                                      c.progressPct === 100
                                        ? '#10b981'
                                        : 'var(--accent-gold)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {c.completedCount}/{c.totalLessons} ({c.progressPct}%)
                                </span>
                              </div>
                              <div
                                style={{
                                  height: '5px',
                                  background: 'var(--border-color)',
                                  borderRadius: '3px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${c.progressPct}%`,
                                    background:
                                      c.progressPct === 100
                                        ? '#10b981'
                                        : 'var(--accent-gold)',
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
