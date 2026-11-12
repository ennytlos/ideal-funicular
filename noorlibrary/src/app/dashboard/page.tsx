'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useApp, formatDisplayName, Book } from '../../context/AppContext';
import { doc, onSnapshot, setDoc, query, collection, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import dynamic from 'next/dynamic';

type JsonChapter = { title?: string; pages?: string[] };

const ReaderModal = dynamic(() => import('../../components/ReaderModal'), {
  ssr: false,
});

export default function UserDashboard() {
  const { user, logout, books, series, courses, enrolledCourses, purchasedBooks, purchasedSeries, downloadedBooks, removePurchasedBook, removePurchasedSeries, removeEnrolledCourse, removeDownloadedBook, isLoading } = useApp();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'library' | 'downloads' | 'series' | 'courses' | 'notifications' | 'messages' | 'role_status'>('library');
  const [selectedBookToRead, setSelectedBookToRead] = useState<Book | null>(null);

  // Community and relationship states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [followedCreatorIds, setFollowedCreatorIds] = useState<string[]>([]);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  // messages is derived via useMemo from sentMessages + receivedMessages below
  const [composedMessageText, setComposedMessageText] = useState('');
  const [composedSubject, setComposedSubject] = useState('');
  const [messageRecipientType, setMessageRecipientType] = useState<'admin' | 'creator'>('admin');
  const [selectedCreatorId, setSelectedCreatorId] = useState('');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadReplyText, setThreadReplyText] = useState('');

  // Creator Request form states
  const [creatorRequest, setCreatorRequest] = useState<any>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDob, setFormDob] = useState('');
  const [formManhaj, setFormManhaj] = useState('');
  const [formSocial, setFormSocial] = useState('');
  const [formEducation, setFormEducation] = useState('');
  const [formPreferredScholar, setFormPreferredScholar] = useState('');
  const [formContentTypes, setFormContentTypes] = useState<string[]>([]);
  const [formMonetize, setFormMonetize] = useState(false);
  const [formAccountName, setFormAccountName] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formTargetAudience, setFormTargetAudience] = useState('');
  const [formAgree, setFormAgree] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Society Request form states
  const [societyRequest, setSocietyRequest] = useState<any>(null);
  const [loadingSocietyRequest, setLoadingSocietyRequest] = useState(true);
  const [isSocietyModalOpen, setIsSocietyModalOpen] = useState(false);
  const [socName, setSocName] = useState('');
  const [socDesc, setSocDesc] = useState('');
  const [socLeader, setSocLeader] = useState('');
  const [socManhaj, setSocManhaj] = useState('');
  const [socSocial, setSocSocial] = useState('');
  const [socBankName, setSocBankName] = useState('');
  const [socAccountName, setSocAccountName] = useState('');
  const [socAccountNumber, setSocAccountNumber] = useState('');
  const [socAgree, setSocAgree] = useState(false);

  // Live listen to creator requests status
  useEffect(() => {
    if (!user?.uid) return;
    const requestRef = doc(db, 'creator_requests', user.uid);
    const unsubscribe = onSnapshot(requestRef, (snap) => {
      if (snap.exists()) {
        setCreatorRequest(snap.data());
      } else {
        setCreatorRequest(null);
      }
      setLoadingRequest(false);
    }, (err) => {
      console.error("Failed to load creator request:", err);
      setLoadingRequest(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Live listen to society requests status
  useEffect(() => {
    if (!user?.uid) return;
    const requestRef = doc(db, 'society_requests', user.uid);
    const unsubscribe = onSnapshot(requestRef, (snap) => {
      if (snap.exists()) {
        setSocietyRequest(snap.data());
      } else {
        setSocietyRequest(null);
      }
      setLoadingSocietyRequest(false);
    }, (err) => {
      console.error("Failed to load society request:", err);
      setLoadingSocietyRequest(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Listen to followed creators
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'follows'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.data().creatorId);
      setFollowedCreatorIds(ids);
    }, (err) => console.error("Follow listen error:", err));
    return () => unsubscribe();
  }, [user?.uid]);

  // Listen to readNotifications list from subcollection
  useEffect(() => {
    if (!user?.uid) return;
    const readRef = collection(db, 'notifications', user.uid, 'read');
    const unsubscribe = onSnapshot(readRef, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.id);
      setReadNotifications(ids);
    }, (err) => console.error("Read notifications subcollection listen error:", err));
    return () => unsubscribe();
  }, [user?.uid]);

  // Listen to notifications — scoped to this user's relevant targetIds only
  useEffect(() => {
    if (!user?.uid) return;

    // Build the list of targetIds this user cares about
    const myTargetIds = [user.uid, 'all_users', 'global', 'all'];
    if (user.role === 'creator') myTargetIds.push('all_creators');
    if (user.role === 'society') myTargetIds.push('all_societies');

    const q = query(
      collection(db, 'notifications'),
      where('targetId', 'in', myTargetIds)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allNotifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      allNotifs.sort((a, b) => b.createdAt - a.createdAt);
      setNotifications(allNotifs);
    }, (err) => console.error('Notifications query error:', err));

    return () => unsubscribe();
  }, [user?.uid, user?.role]);

  // Mark notifications read on tab enter
  useEffect(() => {
    if (activeTab === 'notifications' && user?.uid && notifications.length > 0) {
      const unreadIds = notifications.map(n => n.id).filter(id => !readNotifications.includes(id));
      unreadIds.forEach((id) => {
        const docRef = doc(db, 'notifications', user.uid, 'read', id);
        setDoc(docRef, { readAt: Date.now() }, { merge: true }).catch(console.error);
      });
    }
  }, [activeTab, user?.uid, notifications, readNotifications]);

  // Listen to inbox messages — two flat listeners merged via state (avoids nested onSnapshot leak)
  const [sentMessages, setSentMessages] = useState<any[]>([]);
  const [receivedMessages, setReceivedMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'messages'), where('senderId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      setSentMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (err) => console.error('Sent messages error:', err));
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const recipientIds = [user.uid, 'all_users'];
    if (user.role === 'creator') recipientIds.push('all_creators');
    if (user.role === 'admin') recipientIds.push('admin');
    const q = query(collection(db, 'messages'), where('recipientId', 'in', recipientIds));
    const unsubscribe = onSnapshot(q, (snap) => {
      setReceivedMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (err) => console.error('Received messages error:', err));
    return () => unsubscribe();
  }, [user?.uid, user?.role]);

  // Merge + deduplicate sent and received messages
  const messages = useMemo(() => {
    const merged = [...sentMessages, ...receivedMessages];
    const unique = merged.filter((item, idx, self) => self.findIndex(t => t.id === item.id) === idx);
    unique.sort((a, b) => b.createdAt - a.createdAt);
    return unique;
  }, [sentMessages, receivedMessages]);

  const threads = useMemo(() => {
    if (!user) return [];
    
    const normalizeSubject = (subj: string) => {
      return subj.replace(/^(re|reply|fwd|fw)\s*:\s*/i, '').trim();
    };

    const grouped: Record<string, any[]> = {};

    messages.forEach((msg) => {
      const partnerId = msg.senderId === user.uid ? msg.recipientId : msg.senderId;
      const partnerName = msg.senderId === user.uid ? (msg.recipientId === 'admin' ? 'Admin' : 'Creator') : msg.senderName;
      const normSubject = normalizeSubject(msg.subject || 'Support Ticket');
      const threadKey = `${partnerId}_${normSubject}`;

      if (!grouped[threadKey]) {
        grouped[threadKey] = [];
      }
      grouped[threadKey].push({
        ...msg,
        partnerId,
        partnerName,
        normSubject,
      });
    });

    const threadList = Object.keys(grouped).map((key) => {
      const msgs = grouped[key];
      msgs.sort((a, b) => a.createdAt - b.createdAt);
      
      const lastMsg = msgs[msgs.length - 1];
      const partnerId = msgs[0].partnerId;
      const partnerName = msgs[0].partnerName;
      const normSubject = msgs[0].normSubject;

      return {
        id: key,
        partnerId,
        partnerName,
        subject: normSubject,
        messages: msgs,
        lastMessageAt: lastMsg.createdAt,
        lastMessageText: lastMsg.messageText,
        lastMessageSenderId: lastMsg.senderId,
      };
    });

    threadList.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return threadList;
  }, [messages, user]);

  const handleNewInboxMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (messageRecipientType === 'creator' && !selectedCreatorId) {
      alert('Please select a creator to message');
      return;
    }
    if (messageRecipientType === 'creator') {
      const isEnrolledCreator = courses.some(c => c.creatorId === selectedCreatorId && enrolledCourses.includes(c.id));
      if (!isEnrolledCreator) {
        alert('You can only message creators of courses you are enrolled in.');
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const msgRef = doc(collection(db, 'messages'));
      const targetRecipientId = messageRecipientType === 'admin' ? 'admin' : selectedCreatorId;

      await setDoc(msgRef, {
        id: msgRef.id,
        senderId: user.uid,
        senderName: user.displayName || user.email.split('@')[0],
        recipientId: targetRecipientId,
        messageText: composedMessageText,
        subject: composedSubject || 'Support Inquiry',
        createdAt: Date.now()
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        senderId: user.uid,
        senderName: user.displayName || user.email.split('@')[0],
        title: `New Message: ${composedSubject || 'Support Inquiry'}`,
        message: composedMessageText.substring(0, 100),
        type: 'direct',
        targetId: targetRecipientId,
        createdAt: Date.now()
      });

      alert('Message sent successfully!');
      setComposedMessageText('');
      setComposedSubject('');
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplyMessage = async (parentMsg: any) => {
    if (!user) return;
    const replyText = replyTextMap[parentMsg.id];
    if (!replyText || !replyText.trim()) return;

    try {
      const replyRecipientId = parentMsg.senderId === user.uid ? parentMsg.recipientId : parentMsg.senderId;
      const msgRef = doc(collection(db, 'messages'));
      await setDoc(msgRef, {
        id: msgRef.id,
        senderId: user.uid,
        senderName: user.displayName || user.email.split('@')[0],
        recipientId: replyRecipientId,
        messageText: replyText,
        subject: `Re: ${parentMsg.subject || 'Support Inquiry'}`,
        createdAt: Date.now()
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        senderId: user.uid,
        senderName: user.displayName || user.email.split('@')[0],
        title: `Reply: ${parentMsg.subject || 'Support Inquiry'}`,
        message: replyText.substring(0, 100),
        type: 'direct',
        targetId: replyRecipientId,
        createdAt: Date.now()
      });

      setReplyTextMap(prev => ({ ...prev, [parentMsg.id]: '' }));
      alert('Reply sent successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to send reply');
    }
  };

  const handleReplyToThread = async (thread: any) => {
    if (!user) return;
    if (!threadReplyText.trim()) return;

    setIsSubmitting(true);
    try {
      const msgRef = doc(collection(db, 'messages'));
      await setDoc(msgRef, {
        id: msgRef.id,
        senderId: user.uid,
        senderName: user.displayName || user.email.split('@')[0],
        recipientId: thread.partnerId,
        messageText: threadReplyText,
        subject: `Re: ${thread.subject}`,
        createdAt: Date.now()
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        senderId: user.uid,
        senderName: user.displayName || user.email.split('@')[0],
        title: `Reply: Re: ${thread.subject}`,
        message: threadReplyText.substring(0, 100),
        type: 'direct',
        targetId: thread.partnerId,
        createdAt: Date.now()
      });

      setThreadReplyText('');
      alert('Reply sent successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to send reply');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContentTypeChange = (type: string) => {
    if (formContentTypes.includes(type)) {
      setFormContentTypes(formContentTypes.filter(t => t !== type));
    } else {
      setFormContentTypes([...formContentTypes, type]);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (formContentTypes.length === 0) {
      setSubmitError('Please select at least one type of content you will be creating.');
      return;
    }
    if (formMonetize) {
      if (!formAccountName.trim() || !formBankName.trim() || !formAccountNumber.trim()) {
        setSubmitError('All bank details are compulsory if you wish to monetize your content.');
        return;
      }
      if (!/^\d{10}$/.test(formAccountNumber)) {
        setSubmitError('Nigerian account number must be exactly 10 digits.');
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const requestRef = doc(db, 'creator_requests', user.uid);
      await setDoc(requestRef, {
        id: user.uid,
        fullName: formName,
        email: user.email,
        dob: formDob,
        manhaj: formManhaj,
        socialProfile: formSocial,
        education: formEducation,
        preferredScholar: formPreferredScholar,
        contentTypes: formContentTypes,
        monetize: formMonetize,
        accountName: formMonetize ? formAccountName : '',
        bankName: formMonetize ? formBankName : '',
        accountNumber: formMonetize ? formAccountNumber : '',
        targetAudience: formTargetAudience,
        status: 'pending',
        submittedAt: Date.now()
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocietyRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (socAccountNumber && !/^\d{10}$/.test(socAccountNumber)) {
      setSubmitError('Nigerian account number must be exactly 10 digits.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const requestRef = doc(db, 'society_requests', user.uid);
      await setDoc(requestRef, {
        id: user.uid,
        societyName: socName,
        email: user.email,
        description: socDesc,
        leaderName: socLeader,
        manhaj: socManhaj,
        socialProfile: socSocial,
        bankName: socBankName,
        accountName: socAccountName,
        accountNumber: socAccountNumber,
        status: 'pending',
        submittedAt: Date.now()
      });
      setIsSocietyModalOpen(false);
      alert('Society registration request submitted successfully!');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async (id: string, title: string, author: string) => {
    const shareData = {
      title: `${title} by ${author}`,
      text: `Read "${title}" by ${author} on Noor Library!`,
      url: `${window.location.origin}/books/${id}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // Share cancelled or failed silently
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
        alert('Book link copied to clipboard!');
      } catch {
        // Clipboard not available
      }
    }
  };

  const handleDownload = async (bookId: string) => {
    try {
      const book = books.find(b => b.id === bookId);
      const res = await fetch(`/api/read/${bookId}`);
      if (!res.ok) {
        let errMsg = 'Download failed. Please try again.';
        try {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } catch {}
        alert(errMsg);
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      let downloadBlob: Blob;
      let extension = book?.contentType === 'json' ? 'txt' : 'pdf';

      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.url) {
          // Fetch from CDN directly (CORS must be enabled on Bunny CDN Pull Zone)
          const fileRes = await fetch(data.url);
          downloadBlob = await fileRes.blob();
        } else {
          // JSON text book chapters
          let plainText = `${book?.title || 'Book'}\nBy ${book?.author || 'Author'}\n\n`;
          const chapters = Array.isArray(data) ? data as JsonChapter[] : (data.chapters as JsonChapter[]) || [];
          chapters.forEach((chapter) => {
            plainText += `\n--- ${chapter.title || 'Chapter'} ---\n\n`;
            if (Array.isArray(chapter.pages)) {
              chapter.pages.forEach((page: string) => {
                plainText += `${page}\n\n`;
              });
            }
          });
          downloadBlob = new Blob([plainText], { type: 'text/plain' });
          extension = 'txt';
        }
      } else {
        const blob = await res.blob();
        downloadBlob = blob;
        if (book?.contentType === 'json') {
          try {
            const textData = await blob.text();
            const parsed = JSON.parse(textData);
            const chapters = Array.isArray(parsed) ? parsed as JsonChapter[] : (parsed.chapters as JsonChapter[]) || [];
            
            let plainText = `${book.title}\nBy ${book.author}\n\n`;
            chapters.forEach((chapter) => {
              plainText += `\n--- ${chapter.title || 'Chapter'} ---\n\n`;
              if (Array.isArray(chapter.pages)) {
                chapter.pages.forEach((page: string) => {
                  plainText += `${page}\n\n`;
                });
              }
            });
            downloadBlob = new Blob([plainText], { type: 'text/plain' });
            extension = 'txt';
          } catch (e) {
            console.error("Failed to parse JSON for text conversion", e);
          }
        }
      }

      const url = window.URL.createObjectURL(downloadBlob);
      const a = document.createElement('a');
      a.href = url;
      const filename = book ? `${book.title.replace(/[^a-zA-Z0-9-_]/g, '_')}.${extension}` : `${bookId}.${extension}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. Please try again.');
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="admin-layout">
        <div className="admin-sidebar">
          <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ height: '40px', borderRadius: '8px', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        </div>
        <div className="admin-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ height: '48px', width: '280px', borderRadius: '8px', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: '220px', borderRadius: '12px', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const openCreatorModal = () => {
    setFormName(user.displayName || '');
    setFormDob('');
    setFormManhaj('');
    setFormSocial('');
    setFormEducation('');
    setFormPreferredScholar('');
    setFormContentTypes([]);
    setFormMonetize(false);
    setFormAccountName('');
    setFormBankName('');
    setFormAccountNumber('');
    setFormTargetAudience('');
    setFormAgree(false);
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const openSocietyModal = () => {
    setSocName('');
    setSocDesc('');
    setSocLeader('');
    setSocManhaj('');
    setSocSocial('');
    setSocBankName('');
    setSocAccountName('');
    setSocAccountNumber('');
    setSocAgree(false);
    setSubmitError(null);
    setIsSocietyModalOpen(true);
  };

  const isOwnContent = (creatorId?: string) =>
    Boolean(
      user?.uid &&
        creatorId &&
        (creatorId === user.uid ||
          (user.role === 'admin' && creatorId === 'admin'))
    );
  const myLibrary = books.filter(
    b => purchasedBooks.includes(b.id) || isOwnContent(b.creatorId)
  );
  const myDownloads = books.filter(b => downloadedBooks.includes(b.id));
  const mySeriesList = series.filter(
    s => purchasedSeries.includes(s.id) || isOwnContent(s.creatorId)
  );
  const myCoursesList = courses.filter(
    c => enrolledCourses.includes(c.id) || isOwnContent(c.creatorId)
  );
  const unreadNotificationsCount = notifications.filter(n => !readNotifications.includes(n.id)).length;

  return (
    <div className="admin-layout">
      {/* Sidebar with Tabs */}
      <div className="admin-sidebar">
        <div className="admin-sidebar-header">
          <span>User Dashboard</span>
          <span className={`sidebar-user-badge ${user.role || 'reader'}`}>
            {user.role === 'admin' ? 'Admin' : user.role === 'creator' ? 'Creator' : user.role === 'society' ? 'Society' : 'Reader'}
          </span>
        </div>

        <div className="sidebar-user-card">
          <div className={`sidebar-user-avatar ${user.role === 'creator' || user.role === 'society' ? 'gold' : ''}`}>
            {formatDisplayName(user)[0]?.toUpperCase() || 'U'}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{formatDisplayName(user)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {user.email || 'Reader Account'}
            </div>
          </div>
        </div>

        <ul className="admin-sidebar-list">
          <li>
            <button
              onClick={() => setActiveTab('library')}
              className={`admin-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
            >
              <span className="admin-tab-btn-inner">
                <span>📚</span>
                <span>My Library</span>
              </span>
              <span className="admin-tab-count">{myLibrary.length}</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('series')}
              className={`admin-tab-btn ${activeTab === 'series' ? 'active' : ''}`}
            >
              <span className="admin-tab-btn-inner">
                <span>📦</span>
                <span>My Series</span>
              </span>
              <span className="admin-tab-count">{mySeriesList.length}</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('courses')}
              className={`admin-tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
            >
              <span className="admin-tab-btn-inner">
                <span>🎓</span>
                <span>My Courses</span>
              </span>
              <span className="admin-tab-count">{myCoursesList.length}</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('downloads')}
              className={`admin-tab-btn ${activeTab === 'downloads' ? 'active' : ''}`}
            >
              <span className="admin-tab-btn-inner">
                <span>📥</span>
                <span>Downloads</span>
              </span>
              <span className="admin-tab-count">{myDownloads.length}</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`admin-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            >
              <span className="admin-tab-btn-inner">
                <span>🔔</span>
                <span>Notifications</span>
              </span>
              {unreadNotificationsCount > 0 ? (
                <span className="admin-tab-count unread">{unreadNotificationsCount}</span>
              ) : (
                <span className="admin-tab-count">{notifications.length}</span>
              )}
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('messages')}
              className={`admin-tab-btn ${activeTab === 'messages' ? 'active' : ''}`}
            >
              <span className="admin-tab-btn-inner">
                <span>💬</span>
                <span>Inbox & Messages</span>
              </span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('role_status')}
              className={`admin-tab-btn ${activeTab === 'role_status' ? 'active gold-theme' : ''}`}
            >
              <span className="admin-tab-btn-inner">
                <span>🌟</span>
                <span>Creator & Society Hub</span>
              </span>
              {creatorRequest?.status === 'pending' || societyRequest?.status === 'pending' ? (
                <span className="admin-tab-count" style={{ background: 'var(--accent-gold)', color: '#000' }}>⏳</span>
              ) : null}
            </button>
          </li>
        </ul>

        {/* Sidebar Footer: Role Portal Shortcut + Sign Out */}
        <div className="admin-sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {(user.role === 'creator' || user.role === 'society' || user.role === 'admin') && (
            <Link
              href="/admin"
              className="admin-tab-btn"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: user.role === 'admin' ? 'rgba(220, 38, 38, 0.08)' : 'rgba(212, 175, 55, 0.12)',
                border: user.role === 'admin' ? '1px solid rgba(220, 38, 38, 0.3)' : '1px solid rgba(212, 175, 55, 0.35)',
                color: user.role === 'admin' ? 'var(--accent-red)' : 'var(--accent-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textDecoration: 'none',
                fontSize: '0.88rem',
                fontWeight: 700
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{user.role === 'admin' ? '🛡️' : user.role === 'creator' ? '⚡' : '🏛️'}</span>
                <span>
                  {user.role === 'admin' ? 'Admin Panel' : user.role === 'creator' ? 'Creator Studio' : 'Society Portal'}
                </span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          )}

          <button
            type="button"
            onClick={async () => {
              await logout();
              router.push('/');
            }}
            className="admin-tab-btn"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: 'var(--accent-red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="admin-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontFamily: 'Outfit', fontSize: '1.85rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
              {activeTab === 'library' && 'My Online Library'}
              {activeTab === 'series' && 'My Acquired Series'}
              {activeTab === 'courses' && 'My Enrolled Courses'}
              {activeTab === 'downloads' && 'My Offline Downloads'}
              {activeTab === 'notifications' && 'Notifications & Broadcasts'}
              {activeTab === 'messages' && 'Direct Messages & Inquiries'}
              {activeTab === 'role_status' && 'Creator & Society Publishing Hub'}
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              {activeTab === 'library' && 'Access and read books added to your personal Noor Library collection.'}
              {activeTab === 'series' && 'Read episodic serialized publications, journals, and multi-part lessons.'}
              {activeTab === 'courses' && 'Track progress through your enrolled courses, lessons, and assignments.'}
              {activeTab === 'downloads' && 'Downloadable offline books and PDFs for reading anywhere.'}
              {activeTab === 'notifications' && 'Stay updated with global announcements and creator broadcasts.'}
              {activeTab === 'messages' && 'Direct messaging with instructors, authors, and platform administrators.'}
              {activeTab === 'role_status' && 'Apply for verified publisher status, manage creator privileges, or register an Islamic society.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {activeTab === 'library' && (
              <button className="btn btn-primary" onClick={() => router.push('/books')}>+ Browse Catalog</button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await logout();
                router.push('/');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                borderColor: 'rgba(239, 68, 68, 0.35)',
                color: 'var(--accent-red)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
            {activeTab === 'series' && (
              <button className="btn btn-primary" onClick={() => router.push('/books')}>+ Explore Series</button>
            )}
            {activeTab === 'courses' && (
              <button className="btn btn-primary" onClick={() => router.push('/courses')}>+ Browse Courses</button>
            )}
            {activeTab === 'downloads' && (
              <button className="btn btn-primary" onClick={() => router.push('/books')}>+ Get Downloads</button>
            )}
            {(user.role === 'creator' || user.role === 'society' || user.role === 'admin') && (
              <Link
                href="/admin"
                className="btn btn-secondary"
                style={{
                  borderColor: user.role === 'admin' ? 'var(--accent-red)' : 'var(--accent-gold)',
                  color: user.role === 'admin' ? 'var(--accent-red)' : 'var(--accent-gold)',
                  fontWeight: 600,
                  fontSize: '0.88rem'
                }}
              >
                {user.role === 'admin' ? 'Open Admin Panel 🛡️' : user.role === 'creator' ? 'Open Creator Studio ⚡' : 'Open Society Portal 🏛️'}
              </Link>
            )}
          </div>
        </div>

      {activeTab === 'library' && (
        <div>
          {myLibrary.length === 0 ? (
            <div className="glass-card dashboard-empty-card">
              <h3 className="dashboard-empty-h3">Your library is empty</h3>
              <p className="dashboard-empty-p">You haven&apos;t added any books to your online library yet.</p>
              <button className="btn btn-primary" onClick={() => router.push('/books')}>Browse Catalog</button>
            </div>
          ) : (
            <div className="dashboard-grid">
              {myLibrary.map(book => (
                <div key={book.id} className="glass-card dashboard-book-card">
                  {/* Cover Image */}
                  <div className="dashboard-book-cover-container">
                    <Image
                      src={book.coverUrl || '/noor_logo.png'}
                      alt={book.title}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="dashboard-book-cover-image"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/noor_logo.png'; }}
                    />
                  </div>

                  <div className="dashboard-book-info">
                    <span className="dashboard-book-category">
                      {book.category}
                    </span>
                    <h3 className="dashboard-book-title">
                      {book.title}
                    </h3>
                    <p className="dashboard-book-author">
                      By {book.author}
                    </p>

                    <div className="dashboard-actions-column">
                      <div className="dashboard-actions-row">
                        <button
                          onClick={() => setSelectedBookToRead(book)}
                          className="btn btn-primary dashboard-action-btn-read"
                        >
                          Read Now
                        </button>
                        <button
                          onClick={() => router.push(`/books/${book.id}`)}
                          className="btn btn-secondary dashboard-action-btn-details"
                          title="View Details"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleShare(book.id, book.title, book.author)}
                          className="btn btn-secondary dashboard-action-btn-share"
                          title="Share Book"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="18" cy="5" r="3" />
                            <circle cx="6" cy="12" r="3" />
                            <circle cx="18" cy="19" r="3" />
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                          </svg>
                        </button>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to remove "${book.title}" from your online library?`)) {
                            await removePurchasedBook(book.id);
                          }
                        }}
                        className="btn btn-secondary dashboard-action-btn-remove"
                      >
                        Remove from Library
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'downloads' && (
        <div>
          {myDownloads.length === 0 ? (
            <div className="glass-card dashboard-empty-card">
              <h3 className="dashboard-empty-h3">No downloads yet</h3>
              <p className="dashboard-empty-p">Purchase PDF downloads from the catalog to see them here.</p>
              <button className="btn btn-primary" onClick={() => router.push('/books')}>Browse Catalog</button>
            </div>
          ) : (
            <div className="dashboard-grid">
              {myDownloads.map(book => (
                <div key={book.id} className="glass-card dashboard-book-card-downloads">
                  <h3 className="dashboard-book-title-downloads">{book.title}</h3>
                  <p className="dashboard-book-category-downloads">{book.category}</p>
                  <div className="dashboard-actions-column">
                    <div className="dashboard-actions-row">
                      <button className="btn btn-secondary download-card-actions" onClick={() => handleDownload(book.id)}>
                        Download {book.contentType === 'json' ? 'Text File' : 'PDF'}
                      </button>
                      <button
                        onClick={() => handleShare(book.id, book.title, book.author)}
                        className="btn btn-secondary dashboard-action-btn-share"
                        title="Share Book"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                      </button>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm(`Are you sure you want to remove "${book.title}" from your downloads?`)) {
                          await removeDownloadedBook(book.id);
                        }
                      }}
                      className="btn btn-secondary dashboard-action-btn-remove"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'series' && (
        <div>
          {mySeriesList.length === 0 ? (
            <div className="glass-card dashboard-empty-card">
              <h3 className="dashboard-empty-h3">No Series yet</h3>
              <p className="dashboard-empty-p">Purchase series access from the catalog to see them here.</p>
              <button className="btn btn-primary" onClick={() => router.push('/books')}>Browse Catalog</button>
            </div>
          ) : (
            <div className="dashboard-grid">
              {mySeriesList.map(s => (
                <div key={s.id} className="glass-card dashboard-book-card">
                  {/* Cover Image */}
                  <div className="dashboard-book-cover-container">
                    <Image
                      src={s.coverUrl || '/noor_logo.png'}
                      alt={s.title}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="dashboard-book-cover-image"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/noor_logo.png'; }}
                    />
                  </div>

                  <div className="dashboard-book-info">
                    <span className="dashboard-book-category">{s.category}</span>
                    <h3 className="dashboard-book-title">{s.title}</h3>
                    <p className="dashboard-book-author">By {s.author}</p>

                    <div className="dashboard-actions-column">
                      <div className="dashboard-actions-row">
                        <button
                          onClick={() => router.push(`/series/${s.id}`)}
                          className="btn btn-primary dashboard-action-btn-read"
                        >
                          Read Episodes
                        </button>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to remove "${s.title}" from your series collection?`)) {
                            await removePurchasedSeries(s.id);
                          }
                        }}
                        className="btn btn-secondary dashboard-action-btn-remove"
                      >
                        Remove from Library
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'courses' && (
        <div>
          {myCoursesList.length === 0 ? (
            <div className="glass-card dashboard-empty-card">
              <h3 className="dashboard-empty-h3">No Courses yet</h3>
              <p className="dashboard-empty-p">Enroll in courses from the catalog to start learning.</p>
              <button className="btn btn-primary" onClick={() => router.push('/courses')}>Browse Courses</button>
            </div>
          ) : (
            <div className="dashboard-grid">
              {myCoursesList.map(c => (
                <div key={c.id} className="glass-card dashboard-book-card">
                  {/* Cover Image */}
                  <div className="dashboard-book-cover-container">
                    <Image
                      src={c.coverUrl || '/noor_logo.png'}
                      alt={c.title}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="dashboard-book-cover-image"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/noor_logo.png'; }}
                    />
                  </div>

                  <div className="dashboard-book-info">
                    <span className="dashboard-book-category">{c.category}</span>
                    <h3 className="dashboard-book-title">{c.title}</h3>
                    <p className="dashboard-book-author">Instructor: {c.instructor}</p>

                    <div className="dashboard-actions-column">
                      <div className="dashboard-actions-row">
                        <button
                          onClick={() => router.push(`/courses/${c.id}/learn`)}
                          className="btn btn-primary dashboard-action-btn-read"
                        >
                          Continue Learning
                        </button>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to unenroll from "${c.title}"?`)) {
                            await removeEnrolledCourse(c.id);
                          }
                        }}
                        className="btn btn-secondary dashboard-action-btn-remove"
                      >
                        Unenroll
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {notifications.length === 0 ? (
            <div className="glass-card dashboard-empty-card">
              <h3 className="dashboard-empty-h3">No notifications</h3>
              <p className="dashboard-empty-p">You are all caught up!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {notifications.map(notif => {
                const isUnread = !readNotifications.includes(notif.id);
                return (
                  <div 
                    key={notif.id} 
                    className="glass-card" 
                    style={{ 
                      padding: '1.5rem', 
                      borderRadius: '12px', 
                      borderLeft: isUnread ? '4px solid var(--accent-red)' : '1px solid var(--border-color)',
                      background: isUnread ? 'rgba(220, 38, 38, 0.03)' : 'var(--glass-bg)',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                        {notif.title}
                      </h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(notif.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
                      {notif.message}
                    </p>
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>
                        {notif.type === 'global' ? 'Broadcast' : notif.type === 'outreach' ? 'Creator Outreach' : 'Direct Message'}
                      </span>
                      {notif.senderName && <span style={{ color: 'var(--text-muted)' }}>• Sent by {notif.senderName}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <div style={{ gridTemplateColumns: '1fr', gap: '2rem' }}>
          <div>
            {/* Compose Message Form */}
            <div className="glass-card" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '2.5rem' }}>
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', marginBottom: '1rem' }}>Send Message to Admin or Creator</h3>
              <form onSubmit={handleNewInboxMessage} className="modal-form">
                <div className="form-group">
                  <label className="form-label">Recipient</label>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="recipient-type" 
                        checked={messageRecipientType === 'admin'} 
                        onChange={() => setMessageRecipientType('admin')} 
                      />
                      Admin
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="recipient-type" 
                        checked={messageRecipientType === 'creator'} 
                        onChange={() => setMessageRecipientType('creator')} 
                      />
                      Creator / Author
                    </label>
                  </div>
                </div>

                {messageRecipientType === 'creator' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="select-creator">Select Creator</label>
                    <select
                      id="select-creator"
                      className="form-input"
                      value={selectedCreatorId}
                      onChange={e => setSelectedCreatorId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose a Creator --</option>
                      {(() => {
                        const enrolledCreators = Array.from(new Set(
                          courses
                            .filter(c => enrolledCourses.includes(c.id))
                            .map(c => c.creatorId)
                            .filter(id => id && id !== 'admin' && id !== user?.uid)
                        ));

                        return enrolledCreators.map(cid => {
                          const courseObj = courses.find(c => c.creatorId === cid);
                          const bookObj = books.find(b => b.creatorId === cid);
                          const creatorName = courseObj?.instructor || bookObj?.author || `Creator ID: ${cid?.substring(0,6)}`;
                          return <option key={cid} value={cid}>{creatorName}</option>;
                        });
                      })()}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="inbox-subject">Subject</label>
                  <input 
                    id="inbox-subject"
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Question about payment or content"
                    value={composedSubject}
                    onChange={e => setComposedSubject(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="inbox-text">Message Details</label>
                  <textarea 
                    id="inbox-text"
                    className="form-input"
                    rows={4}
                    required
                    placeholder="Provide details about your query..."
                    value={composedMessageText}
                    onChange={e => setComposedMessageText(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>

            {/* Conversation Threads */}
            <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', marginBottom: '1rem' }}>Inquiries & Threads</h3>
            {threads.length === 0 ? (
              <div className="glass-card dashboard-empty-card">
                <h4 className="dashboard-empty-h3">No message threads found</h4>
                <p className="dashboard-empty-p">Compose a message above to start a conversation.</p>
              </div>
            ) : activeThreadId ? (() => {
              const activeThread = threads.find(t => t.id === activeThreadId);
              if (!activeThread) return null;
              return (
                <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    <div>
                      <button 
                        onClick={() => { setActiveThreadId(null); setThreadReplyText(''); }} 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem', marginBottom: '0.5rem' }}
                      >
                        &larr; Back to Threads
                      </button>
                      <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                        {activeThread.subject}
                      </h4>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Conversation with {activeThread.partnerName}
                      </span>
                    </div>
                  </div>

                  {/* Scrollable messages log */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto', padding: '0.5rem', marginBottom: '1.5rem' }}>
                    {activeThread.messages.map((m: any) => {
                      const isMe = m.senderId === user.uid;
                      return (
                        <div 
                          key={m.id} 
                          style={{ 
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '75%',
                            background: isMe ? 'rgba(220, 38, 38, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                            border: isMe ? '1px solid rgba(220, 38, 38, 0.25)' : '1px solid var(--border-color)',
                            padding: '0.75rem 1rem',
                            borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0',
                            boxShadow: isMe ? '0 4px 12px rgba(220, 38, 38, 0.05)' : '0 4px 12px rgba(0, 0, 0, 0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 600, color: isMe ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                              {isMe ? 'You' : m.senderName}
                            </span>
                            <span>
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                            {m.messageText}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reply form */}
                  <form onSubmit={(e) => { e.preventDefault(); handleReplyToThread(activeThread); }} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <textarea 
                        className="form-input" 
                        style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', minHeight: '44px', height: '44px', resize: 'none' }} 
                        placeholder="Write a reply..."
                        value={threadReplyText}
                        onChange={e => setThreadReplyText(e.target.value)}
                        required
                      />
                      <button 
                        type="submit" 
                        className="btn btn-primary" 
                        style={{ padding: '0 1.25rem', height: '44px' }}
                        disabled={isSubmitting}
                      >
                        Reply
                      </button>
                    </div>
                  </form>
                </div>
              );
            })() : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {threads.map(thread => {
                  const isLastMsgMe = thread.lastMessageSenderId === user.uid;
                  return (
                    <div 
                      key={thread.id} 
                      onClick={() => setActiveThreadId(thread.id)}
                      className="glass-card" 
                      style={{ 
                        padding: '1.25rem 1.5rem', 
                        borderRadius: '12px', 
                        border: '1px solid var(--border-color)',
                        background: 'var(--glass-bg)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.05)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.02)'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                          {thread.subject}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(thread.lastMessageAt).toLocaleDateString()} {new Date(thread.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.25rem 0 0.75rem 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{isLastMsgMe ? 'You: ' : `${thread.partnerName}: `}</span>
                        {thread.lastMessageText}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Conversation with <span style={{ fontWeight: 600, color: 'var(--accent-gold)' }}>{thread.partnerName}</span>
                        </span>
                        {!isLastMsgMe && (
                          <span style={{ color: 'var(--accent-red)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            ● Unread Reply
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'role_status' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
            {/* Creator Program Card */}
            <div className="glass-card" style={{ padding: '2rem', borderRadius: '14px', border: '1px solid rgba(212, 175, 55, 0.3)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.12)', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                    ✍️
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontFamily: 'Outfit', fontSize: '1.25rem', color: 'var(--text-primary)' }}>Creator Publishing</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Authors, scholars, and content creators</span>
                  </div>
                </div>
                <div>
                  {(user.role === 'creator' || creatorRequest?.status === 'approved') ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(212, 175, 55, 0.15)', color: 'var(--accent-gold)', border: '1px solid var(--accent-gold)', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                      ✓ Approved Creator
                    </span>
                  ) : creatorRequest?.status === 'pending' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                      ⏳ Application Pending
                    </span>
                  ) : creatorRequest?.status === 'rejected' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(220, 38, 38, 0.1)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                      Rejected
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem' }}>
                      Not Enrolled
                    </span>
                  )}
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Join our verified network of writers, teachers, and publishers. Publish books, upload series, launch structured courses, and record audio reminders for millions of learners worldwide.
              </p>

              <div style={{ background: 'var(--bg-secondary)', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--accent-gold)' }}>✓</span> Publish Books, Epistles & Chapters
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--accent-gold)' }}>✓</span> Design Interactive Student Courses & Modules
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--accent-gold)' }}>✓</span> Audio Reminders & Video Media Sharing
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--accent-gold)' }}>✓</span> Automated Thursday Nigerian Bank Payouts
                </div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                {(user.role === 'creator' || creatorRequest?.status === 'approved') ? (
                  <Link href="/admin" className="btn btn-primary" style={{ width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none' }}>
                    Open Creator Studio ⚡
                  </Link>
                ) : (user.role === 'admin' || user.role === 'society') ? (
                  <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    Creator applications are not available for {user.role === 'admin' ? 'admin' : user.role} accounts.
                  </div>
                ) : creatorRequest?.status === 'pending' ? (
                  <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    Your application was submitted and is undergoing review by the Noor Library editorial council. You will receive a notification once verified.
                  </div>
                ) : (
                  <div>
                    <button onClick={openCreatorModal} className="btn btn-primary" style={{ width: '100%' }}>
                      {creatorRequest?.status === 'rejected' ? 'Re-Apply to Become a Creator' : 'Apply to Become a Creator'}
                    </button>
                    {creatorRequest?.status === 'rejected' && (
                      <p style={{ margin: '0.5rem 0 0 0', textAlign: 'center', fontSize: '0.78rem', color: 'var(--accent-red)' }}>
                        Previous application was not approved. Please review your details and re-apply.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Society Registration Card */}
            <div className="glass-card" style={{ padding: '2rem', borderRadius: '14px', border: '1px solid rgba(212, 175, 55, 0.3)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.12)', border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                    🏛️
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontFamily: 'Outfit', fontSize: '1.25rem', color: 'var(--text-primary)' }}>Society Portal</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Masajid, Islamic societies & bodies</span>
                  </div>
                </div>
                <div>
                  {user.role === 'society' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(212, 175, 55, 0.15)', color: 'var(--accent-gold)', border: '1px solid var(--accent-gold)', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                      ✓ Verified Society
                    </span>
                  ) : societyRequest?.status === 'pending' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                      ⏳ Request Pending
                    </span>
                  ) : societyRequest?.status === 'rejected' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(220, 38, 38, 0.1)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                      Rejected
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem' }}>
                      Not Registered
                    </span>
                  )}
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Establish your Islamic organization or community center on Noor Library. Share your weekly halaqah schedules, upload recorded lectures, post announcements, and connect with congregants.
              </p>

              <div style={{ background: 'var(--bg-secondary)', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--accent-gold)' }}>✓</span> Dedicated Verified Society Profile Page
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--accent-gold)' }}>✓</span> Weekly Halaqah & Programs Schedule Board
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--accent-gold)' }}>✓</span> Audio Lectures & Society Books Repository
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--accent-gold)' }}>✓</span> Direct Community Donations & Fundraising Support
                </div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                {user.role === 'society' ? (
                  <Link href="/admin" className="btn btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none', borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)' }}>
                    Open Society Portal 🏛️
                  </Link>
                ) : (user.role === 'admin' || user.role === 'creator') ? (
                  <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    Society registration is not available for {user.role === 'admin' ? 'admin' : user.role} accounts.
                  </div>
                ) : societyRequest?.status === 'pending' ? (
                  <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    Your society registration application is under verification. You will be notified once verified.
                  </div>
                ) : (
                  <div>
                    <button disabled onClick={openSocietyModal} className="btn btn-secondary" style={{ width: '100%', borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)', opacity: 0.5, cursor: 'not-allowed' }}>
                      {societyRequest?.status === 'rejected' ? 'Re-Apply for Society Registration' : 'Register an Islamic Society'}
                    </button>
                    {societyRequest?.status === 'rejected' && (
                      <p style={{ margin: '0.5rem 0 0 0', textAlign: 'center', fontSize: '0.78rem', color: 'var(--accent-red)' }}>
                        Previous application was not approved. Please re-apply with corrected information.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {selectedBookToRead && (
        <ReaderModal book={selectedBookToRead} onClose={() => setSelectedBookToRead(null)} />
      )}

      {/* Become a Creator Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div
            className="glass-card modal-dialog modal-dialog-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'rgba(212, 175, 55, 0.16)',
                    border: '1px solid rgba(212, 175, 55, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.35rem',
                    flexShrink: 0,
                  }}
                >
                  🎓
                </div>
                <div>
                  <h2 className="modal-title">
                    {creatorRequest ? 'Creator Profile & Application' : 'Apply as Verified Creator'}
                  </h2>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Publish verified Islamic books, series, audio lectures, and structured courses.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="modal-close-btn">
                &times;
              </button>
            </div>

            <form onSubmit={handleRequestSubmit} className="modal-form">
              {/* Section 1: Scholarly Identity */}
              <div className="modal-section-card">
                <h4 className="modal-section-title" style={{ color: 'var(--accent-gold)' }}>
                  <span>1.</span> Personal & Scholarly Identity
                </h4>

                <div className="modal-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="creator-name">Full Scholarly / Author Name *</label>
                    <input id="creator-name" type="text" className="form-input" required value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Ustadh Abdullah Al-Ilori" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="creator-email">Account Email</label>
                    <input id="creator-email" type="email" className="form-input" readOnly value={user.email} style={{ background: 'var(--bg-tertiary)', opacity: 0.8 }} />
                  </div>
                </div>

                <div className="modal-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="creator-dob">Date of Birth *</label>
                    <input id="creator-dob" type="date" className="form-input" required value={formDob} onChange={e => setFormDob(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="creator-manhaj">Manhaj / School of Thought *</label>
                    <input id="creator-manhaj" type="text" className="form-input" required value={formManhaj} onChange={e => setFormManhaj(e.target.value)} placeholder="e.g. Sunni (Ahlus-Sunnah), Salafiyyah" />
                  </div>
                </div>

                <div className="modal-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="creator-edu">Islamic Education & Qualifications *</label>
                    <input id="creator-edu" type="text" className="form-input" required value={formEducation} onChange={e => setFormEducation(e.target.value)} placeholder="e.g. B.A. Shariah, Markaz, Ijazah" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="creator-scholar">Preferred Scholar / Reference *</label>
                    <input id="creator-scholar" type="text" className="form-input" required value={formPreferredScholar} onChange={e => setFormPreferredScholar(e.target.value)} placeholder="e.g. Shaykh Ibn Uthaymeen, Imam Nawawi" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="creator-social">Social Profile or Website URL (For Verification) *</label>
                  <input id="creator-social" type="url" className="form-input" required value={formSocial} onChange={e => setFormSocial(e.target.value)} placeholder="https://youtube.com/@channel or https://x.com/username" />
                </div>
              </div>

              {/* Section 2: Publishing Scope & Audience */}
              <div className="modal-section-card">
                <h4 className="modal-section-title" style={{ color: 'var(--accent-gold)' }}>
                  <span>2.</span> Publishing Scope & Target Audience
                </h4>

                <div className="form-group">
                  <label className="form-label">Select Content Types You Will Publish *</label>
                  <div className="modal-chip-grid" style={{ marginTop: '0.35rem' }}>
                    {['Course', 'Book', 'Series', 'Media', 'Reminders'].map(type => {
                      const active = formContentTypes.includes(type.toLowerCase());
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleContentTypeChange(type.toLowerCase())}
                          className={`modal-chip-btn ${active ? 'active-gold' : ''}`}
                        >
                          <span>{active ? '✓' : '+'}</span>
                          <span>{type}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="creator-audience">Target Audience & Educational Focus *</label>
                  <textarea id="creator-audience" className="form-input" rows={2} required value={formTargetAudience} onChange={e => setFormTargetAudience(e.target.value)} placeholder="Describe who your books, series, or courses are designed for..." />
                </div>
              </div>

              {/* Section 3: Monetization & Bank Details */}
              <div className="modal-section-card">
                <h4 className="modal-section-title" style={{ color: 'var(--accent-gold)' }}>
                  <span>3.</span> Monetization & Royalty Payouts
                </h4>

                <div className="modal-grid-2">
                  <button
                    type="button"
                    onClick={() => setFormMonetize(true)}
                    className={`modal-chip-btn ${formMonetize ? 'active-gold' : ''}`}
                    style={{ justifyContent: 'flex-start', padding: '0.8rem 1rem' }}
                  >
                    <span>{formMonetize ? '●' : '○'}</span>
                    <span>Yes, Monetize & Accept Support</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMonetize(false)}
                    className={`modal-chip-btn ${!formMonetize ? 'active-emerald' : ''}`}
                    style={{ justifyContent: 'flex-start', padding: '0.8rem 1rem' }}
                  >
                    <span>{!formMonetize ? '●' : '○'}</span>
                    <span>No, 100% Free Fi-Sabilillah</span>
                  </button>
                </div>

                {formMonetize && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="bank-name">Bank Name *</label>
                      <input id="bank-name" type="text" className="form-input" required={formMonetize} value={formBankName} onChange={e => setFormBankName(e.target.value)} placeholder="e.g. Jaiz Bank, GTBank, Access Bank" />
                    </div>

                    <div className="modal-grid-2">
                      <div className="form-group">
                        <label className="form-label" htmlFor="account-name">Account Holder Name *</label>
                        <input id="account-name" type="text" className="form-input" required={formMonetize} value={formAccountName} onChange={e => setFormAccountName(e.target.value)} placeholder="Exact name on bank account" />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="account-number">10-Digit Account Number (NUBAN) *</label>
                        <input id="account-number" type="text" maxLength={10} className="form-input" required={formMonetize} value={formAccountNumber} onChange={e => setFormAccountNumber(e.target.value.replace(/\D/g, ''))} placeholder="0123456789" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Code of Conduct & Agreement */}
              <div
                style={{
                  background: formAgree ? 'rgba(212, 175, 55, 0.08)' : 'var(--bg-primary)',
                  padding: '1.1rem 1.25rem',
                  borderRadius: '14px',
                  border: formAgree ? '1px solid rgba(212, 175, 55, 0.45)' : '1px solid var(--border-color)',
                  fontSize: '0.86rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.55,
                }}
              >
                <p style={{ margin: '0 0 0.4rem 0', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                  Creator Agreement & Code of Conduct
                </p>
                <p style={{ margin: '0 0 0.85rem 0' }}>
                  All published content must adhere to authentic Islamic scholarship and good character, respect intellectual property, and never harm the community. If monetization is enabled, royalties (80% Creator / 20% Platform maintenance) are disbursed every Thursday.
                </p>
                <label
                  htmlFor="creator-agree"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  <input
                    id="creator-agree"
                    type="checkbox"
                    checked={formAgree}
                    onChange={e => setFormAgree(e.target.checked)}
                    required
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
                  />
                  <span>I agree to the Noor Library Creator Code of Conduct and Terms.</span>
                </label>
              </div>

              {submitError && (
                <p style={{ color: 'var(--accent-red)', margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{submitError}</p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold" style={{ minWidth: '210px' }} disabled={isSubmitting || !formAgree}>
                  {isSubmitting ? 'Saving Application...' : creatorRequest ? 'Save Creator Details' : 'Submit Creator Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register a Society Modal */}
      {isSocietyModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsSocietyModalOpen(false)}>
          <div
            className="glass-card modal-dialog modal-dialog-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.35rem',
                    flexShrink: 0,
                  }}
                >
                  🏛️
                </div>
                <div>
                  <h2 className="modal-title">
                    {societyRequest ? 'Update Islamic Society' : 'Register Islamic Society'}
                  </h2>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Connect your Mosque, MSSN, or Islamic Foundation with the Noor community.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setIsSocietyModalOpen(false)} className="modal-close-btn">
                &times;
              </button>
            </div>

            <form onSubmit={handleSocietyRequestSubmit} className="modal-form">
              {/* Section 1: Organization Identity */}
              <div className="modal-section-card">
                <h4 className="modal-section-title" style={{ color: '#10b981' }}>
                  <span>1.</span> Organization Identity & Leadership
                </h4>

                <div className="form-group">
                  <label className="form-label" htmlFor="society-name">Society / Mosque Full Name *</label>
                  <input id="society-name" type="text" className="form-input" required value={socName} onChange={e => setSocName(e.target.value)} placeholder="e.g. NASFAT, MSSN Unilag, Al-Huda Islamic Foundation" />
                </div>

                <div className="modal-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="society-leader">President / Ameer / Imam Name *</label>
                    <input id="society-leader" type="text" className="form-input" required value={socLeader} onChange={e => setSocLeader(e.target.value)} placeholder="Official representative's full name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="society-manhaj">Manhaj / Methodology *</label>
                    <input id="society-manhaj" type="text" className="form-input" required value={socManhaj} onChange={e => setSocManhaj(e.target.value)} placeholder="e.g. Sunni (Ahlus-Sunnah)" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="society-social">Official Website or Social Media URL *</label>
                  <input id="society-social" type="url" className="form-input" required value={socSocial} onChange={e => setSocSocial(e.target.value)} placeholder="https://..." />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="society-desc">Society Mission, Weekly Halaqahs & Overview *</label>
                  <textarea id="society-desc" className="form-input" rows={3} required value={socDesc} onChange={e => setSocDesc(e.target.value)} placeholder="Describe your regular Asalatu, Tafsir classes, charity outreach, and community programs..." />
                </div>
              </div>

              {/* Section 2: Official Bank Details */}
              <div className="modal-section-card">
                <div>
                  <h4 className="modal-section-title" style={{ color: '#10b981' }}>
                    <span>2.</span> Official Bank Account (Charity & Sadaqah)
                  </h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Used for disbursing member donations and Sadaqah contributions (80% Society / 20% Platform maintenance).
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="soc-bank-name">Bank Name</label>
                  <input id="soc-bank-name" type="text" className="form-input" value={socBankName} onChange={e => setSocBankName(e.target.value)} placeholder="e.g. Jaiz Bank, Lotus Bank, Stanbic IBTC" />
                </div>

                <div className="modal-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="soc-account-name">Official Account Name</label>
                    <input id="soc-account-name" type="text" className="form-input" value={socBankName ? socAccountName : ''} onChange={e => setSocAccountName(e.target.value)} placeholder="Registered society account name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="soc-account-number">10-Digit Account Number (NUBAN)</label>
                    <input id="soc-account-number" type="text" maxLength={10} className="form-input" value={socBankName ? socAccountNumber : ''} onChange={e => setSocAccountNumber(e.target.value.replace(/\D/g, ''))} placeholder="0123456789" />
                  </div>
                </div>
              </div>

              {/* Section 3: Society Agreement */}
              <div
                style={{
                  background: socAgree ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-primary)',
                  padding: '1.1rem 1.25rem',
                  borderRadius: '14px',
                  border: socAgree ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid var(--border-color)',
                  fontSize: '0.86rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.55,
                }}
              >
                <p style={{ margin: '0 0 0.4rem 0', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                  Society Verification & Community Guidelines
                </p>
                <p style={{ margin: '0 0 0.85rem 0' }}>
                  By registering this Islamic society, you certify that you are an authorized representative and that all scheduled halaqahs, announcements, and community posts will adhere to authentic Islamic values.
                </p>
                <label
                  htmlFor="society-agree"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  <input
                    id="society-agree"
                    type="checkbox"
                    checked={socAgree}
                    onChange={e => setSocAgree(e.target.checked)}
                    required
                    style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                  />
                  <span>I confirm that I am authorized to register this society and agree to the terms above.</span>
                </label>
              </div>

              {submitError && (
                <p style={{ color: 'var(--accent-red)', margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{submitError}</p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsSocietyModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    minWidth: '210px',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                  }}
                  disabled={isSubmitting || !socAgree}
                >
                  {isSubmitting ? 'Saving Registration...' : societyRequest ? 'Save Society Details' : 'Submit Society Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
