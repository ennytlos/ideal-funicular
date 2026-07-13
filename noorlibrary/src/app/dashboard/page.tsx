'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  const { user, books, series, courses, enrolledCourses, purchasedBooks, purchasedSeries, downloadedBooks, removePurchasedBook, removePurchasedSeries, removeEnrolledCourse, removeDownloadedBook, isLoading } = useApp();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'library' | 'downloads' | 'series' | 'courses' | 'notifications' | 'messages'>('library');
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

  // Live listen to creator requests status
  useEffect(() => {
    if (!user) return;
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
  }, [user]);

  // Listen to followed creators
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'follows'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.data().creatorId);
      setFollowedCreatorIds(ids);
    }, (err) => console.error("Follow listen error:", err));
    return () => unsubscribe();
  }, [user]);

  // Listen to readNotifications list from subcollection
  useEffect(() => {
    if (!user) return;
    const readRef = collection(db, 'notifications', user.uid, 'read');
    const unsubscribe = onSnapshot(readRef, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.id);
      setReadNotifications(ids);
    }, (err) => console.error("Read notifications subcollection listen error:", err));
    return () => unsubscribe();
  }, [user]);

  // Listen to notifications — scoped to this user's relevant targetIds only
  useEffect(() => {
    if (!user) return;

    // Build the list of targetIds this user cares about
    const myTargetIds = [user.uid, 'all_users'];
    if (user.role === 'creator') myTargetIds.push('all_creators');

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
  }, [user]);

  // Mark notifications read on tab enter
  useEffect(() => {
    if (activeTab === 'notifications' && user && notifications.length > 0) {
      const unreadIds = notifications.map(n => n.id).filter(id => !readNotifications.includes(id));
      unreadIds.forEach((id) => {
        const docRef = doc(db, 'notifications', user.uid, 'read', id);
        setDoc(docRef, { readAt: Date.now() }, { merge: true }).catch(console.error);
      });
    }
  }, [activeTab, user, notifications, readNotifications]);

  // Listen to inbox messages — two flat listeners merged via state (avoids nested onSnapshot leak)
  const [sentMessages, setSentMessages] = useState<any[]>([]);
  const [receivedMessages, setReceivedMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'messages'), where('senderId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      setSentMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (err) => console.error('Sent messages error:', err));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const recipientIds = [user.uid, 'all_users'];
    if (user.role === 'creator') recipientIds.push('all_creators');
    if (user.role === 'admin') recipientIds.push('admin');
    const q = query(collection(db, 'messages'), where('recipientId', 'in', recipientIds));
    const unsubscribe = onSnapshot(q, (snap) => {
      setReceivedMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (err) => console.error('Received messages error:', err));
    return () => unsubscribe();
  }, [user]);

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
      <div className="loading-container">
        <p className="loading-text">Loading your dashboard...</p>
      </div>
    );
  }

  const myLibrary = books.filter(b => purchasedBooks.includes(b.id));
  const myDownloads = books.filter(b => downloadedBooks.includes(b.id));
  const mySeriesList = series.filter(s => purchasedSeries.includes(s.id));
  const myCoursesList = courses.filter(c => enrolledCourses.includes(c.id));

  return (
    <div className="container dashboard-container">
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
        <div>
          <h1 className="dashboard-welcome-h1" style={{ margin: 0 }}>
            Welcome back, <span>{formatDisplayName(user)}</span>
          </h1>
          <p className="dashboard-welcome-p" style={{ margin: '0.5rem 0 0 0' }}>
            Manage your personal library and downloads below.
          </p>
        </div>
        
        {/* Creator Request Badge / Button */}
        <div>
          {user.role === 'creator' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-gold)', border: '1px solid var(--accent-gold)', padding: '0.6rem 1.2rem', borderRadius: '20px', fontWeight: 600, fontSize: '0.9rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Creator Account Approved ✓
            </div>
          ) : user.role === 'admin' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(229, 9, 20, 0.1)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', padding: '0.6rem 1.2rem', borderRadius: '20px', fontWeight: 600, fontSize: '0.9rem' }}>
              Admin Account
            </div>
          ) : loadingRequest ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Checking creator status...</span>
          ) : creatorRequest?.status === 'pending' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '0.6rem 1.2rem', borderRadius: '20px', fontWeight: 600, fontSize: '0.9rem' }}>
              Creator Request Pending ⏳
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
              <button 
                onClick={() => {
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
                }} 
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
              >
                Become a Creator
              </button>
              {creatorRequest?.status === 'rejected' && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', fontWeight: 500 }}>
                  Previous application was rejected. You may re-apply.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-tab-bar">
        <button
          onClick={() => setActiveTab('library')}
          className={`dashboard-tab-btn ${activeTab === 'library' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
        >
          My Online Library ({myLibrary.length})
        </button>
        <button
          onClick={() => setActiveTab('series')}
          className={`dashboard-tab-btn ${activeTab === 'series' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
        >
          My Series ({mySeriesList.length})
        </button>
        <button
          onClick={() => setActiveTab('courses')}
          className={`dashboard-tab-btn ${activeTab === 'courses' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
        >
          My Courses ({myCoursesList.length})
        </button>
        <button
          onClick={() => setActiveTab('downloads')}
          className={`dashboard-tab-btn ${activeTab === 'downloads' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
        >
          My Downloads ({myDownloads.length})
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`dashboard-tab-btn ${activeTab === 'notifications' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
        >
          Notifications {(() => {
            const count = notifications.filter(n => !readNotifications.includes(n.id)).length;
            return count > 0 ? <span style={{ background: 'var(--accent-red)', color: 'white', padding: '0.15rem 0.4rem', borderRadius: '50%', marginLeft: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold' }}>{count}</span> : null;
          })()}
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`dashboard-tab-btn ${activeTab === 'messages' ? 'dashboard-tab-btn-active' : 'dashboard-tab-btn-inactive'}`}
        >
          Inbox & Messages
        </button>
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
                      src={book.coverUrl.startsWith('http') && !book.coverUrl.includes('noorlibrary.b-cdn.net') ? book.coverUrl : `/api/cover/${book.id}`}
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
                      src={s.coverUrl && s.coverUrl.includes('b-cdn.net') ? `/api/cover/series/${s.id}` : (s.coverUrl || '/noor_logo.png')}
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
                      src={c.coverUrl && c.coverUrl.includes('b-cdn.net') ? `/api/cover/courses/${c.id}` : (c.coverUrl || '/noor_logo.png')}
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
          <h2 style={{ fontFamily: 'Outfit', fontSize: '1.75rem', marginBottom: '0.5rem' }}>Notifications</h2>
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
            <h2 style={{ fontFamily: 'Outfit', fontSize: '1.75rem', marginBottom: '1.5rem' }}>Direct Messages</h2>
            
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

      {selectedBookToRead && (
        <ReaderModal book={selectedBookToRead} onClose={() => setSelectedBookToRead(null)} />
      )}

      {/* Become a Creator Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">Creator Application</h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>
            
            <form onSubmit={handleRequestSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="creator-name">Full Name</label>
                <input id="creator-name" type="text" className="form-input" required value={formName} onChange={e => setFormName(e.target.value)} placeholder="Enter your full name" />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="creator-email">Email Address</label>
                <input id="creator-email" type="email" className="form-input" readOnly value={user.email} style={{ background: 'var(--bg-tertiary)', opacity: 0.8 }} />
              </div>

              <div className="modal-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="creator-dob">Date of Birth</label>
                  <input id="creator-dob" type="date" className="form-input" required value={formDob} onChange={e => setFormDob(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="creator-manhaj">Manhaj / School of Thought</label>
                  <input id="creator-manhaj" type="text" className="form-input" required value={formManhaj} onChange={e => setFormManhaj(e.target.value)} placeholder="e.g. Salafiyyah" />
                </div>
              </div>

              <div className="modal-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="creator-social">Social Profile URL</label>
                  <input id="creator-social" type="url" className="form-input" required value={formSocial} onChange={e => setFormSocial(e.target.value)} placeholder="https://twitter.com/username" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="creator-edu">Level of Education</label>
                  <input id="creator-edu" type="text" className="form-input" required value={formEducation} onChange={e => setFormEducation(e.target.value)} placeholder="e.g. Bachelor's in Islamic Studies" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="creator-scholar">Preferred Nigerian Scholar</label>
                <input id="creator-scholar" type="text" className="form-input" required value={formPreferredScholar} onChange={e => setFormPreferredScholar(e.target.value)} placeholder="Enter the name of a scholar you refer to" />
              </div>

              <div className="form-group">
                <label className="form-label">What content will you be creating? (Select all that apply)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {['Course', 'Book', 'Series', 'Media', 'Reminders'].map(type => (
                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input 
                        type="checkbox" 
                        checked={formContentTypes.includes(type.toLowerCase())} 
                        onChange={() => handleContentTypeChange(type.toLowerCase())} 
                        style={{ width: '16px', height: '16px' }}
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Do you wish to monetize your content?</label>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="radio" checked={formMonetize} onChange={() => setFormMonetize(true)} style={{ width: '16px', height: '16px' }} />
                    Yes, I wish to monetize
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="radio" checked={!formMonetize} onChange={() => setFormMonetize(false)} style={{ width: '16px', height: '16px' }} />
                    No, strictly free content
                  </label>
                </div>
              </div>

              {formMonetize && (
                <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontFamily: 'Outfit', margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--text-primary)' }}>Nigerian Bank Details</h4>
                  
                  <div className="form-group">
                    <label className="form-label" htmlFor="bank-name">Bank Name</label>
                    <input id="bank-name" type="text" className="form-input" required={formMonetize} value={formBankName} onChange={e => setFormBankName(e.target.value)} placeholder="e.g. GTBank" />
                  </div>

                  <div className="modal-grid-2" style={{ marginTop: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="account-name">Account Name</label>
                      <input id="account-name" type="text" className="form-input" required={formMonetize} value={formAccountName} onChange={e => setFormAccountName(e.target.value)} placeholder="e.g. John Doe" />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="account-number">Account Number</label>
                      <input id="account-number" type="text" maxLength={10} className="form-input" required={formMonetize} value={formAccountNumber} onChange={e => setFormAccountNumber(e.target.value.replace(/\D/g, ''))} placeholder="10-digit Nuban" />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="creator-audience">Target Audience Definition</label>
                <textarea id="creator-audience" className="form-input" rows={3} required value={formTargetAudience} onChange={e => setFormTargetAudience(e.target.value)} placeholder="Describe who your content is primarily intended for..." />
              </div>

              <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: 'var(--text-primary)' }}> इस्लामिक समझौता और नियम (Creator Agreement):</p>
                All published content must be within the teachings of good behaviour and Islamic contents at all times, must not go against the will of Islam, and must not abuse the community. The administration reserves the right to research applicants based on their submitted profiles. If monetization is enabled, payout proceeds are processed and paid out strictly every Thursday.
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <input id="creator-agree" type="checkbox" checked={formAgree} onChange={e => setFormAgree(e.target.checked)} required style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }} />
                <label htmlFor="creator-agree" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}>
                  I agree to the terms and conditions outlined in the agreement above.
                </label>
              </div>

              {submitError && (
                <p style={{ color: 'var(--accent-red)', margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>{submitError}</p>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem' }} disabled={isSubmitting || !formAgree}>
                {isSubmitting ? 'Submitting Application...' : 'Submit Creator Application'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
