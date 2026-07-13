'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Book, useApp } from '../../context/AppContext';
import ManageSeriesTab from '../../components/admin/ManageSeriesTab';
import ManageCoursesTab from '../../components/admin/ManageCoursesTab';
import ManageRemindersTab from '../../components/admin/ManageRemindersTab';
import ViewSubmissionsTab from '../../components/admin/ViewSubmissionsTab';
import CreatorRequestsTab from '../../components/admin/CreatorRequestsTab';
import AnalyticsCharts from '../../components/admin/AnalyticsCharts';
import ManageBannersTab from '../../components/admin/ManageBannersTab';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, setDoc, deleteDoc, collection, query, where } from 'firebase/firestore';

const CATEGORIES = ['Spiritual', 'Hadith', 'Jurisprudence', 'Ethics & Morals', 'History', 'Quranic Studies', 'Other'];
const LANGUAGES = ['English', 'Arabic', 'French', 'Urdu', 'Turkish', 'Malay', 'Other'];

function compressImage(file: File, maxMb = 1, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    if (file.size <= maxMb * 1024 * 1024) {
      return resolve(file);
    }
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
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
}

export default function AdminDashboard() {
  const { books, courses, addBook, updateBook, deleteBook, user, isLoading } = useApp();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');

  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [viewingAnalytics, setViewingAnalytics] = useState<Book | null>(null);

  const [newBook, setNewBook] = useState<Partial<Book>>({
    title: '', author: 'Author Al-Noor', description: '', coverUrl: '', pdfPath: '', jsonPath: '', contentType: 'pdf', isSecure: true, paymentInterval: 'once'
  });
  const [newBookPrices, setNewBookPrices] = useState({ price: '0', downloadPrice: '0', pages: '0' });

  // Dropdown / Custom inputs support
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]);
  const [customLanguage, setCustomLanguage] = useState('');

  // Image upload support
  const [imageUploadType, setImageUploadType] = useState<'file' | 'url'>('file');

  // Loading states for uploads
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isUploadingJson, setIsUploadingJson] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Selected files for deferred uploads
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);

  // Client-side admin/creator verification
  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'admin' && user.role !== 'creator'))) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  // Broadcast, Reports, Messaging, Follower Outreach, and Payout state variables
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const [creatorReplyText, setCreatorReplyText] = useState<Record<string, string>>({});
  const [adminActiveThreadId, setAdminActiveThreadId] = useState<string | null>(null);
  const [adminThreadReplyText, setAdminThreadReplyText] = useState('');

  // Admin Compose state variables
  const [adminComposeSubject, setAdminComposeSubject] = useState('');
  const [adminComposeMessageText, setAdminComposeMessageText] = useState('');
  const [adminComposeRecipientType, setAdminComposeRecipientType] = useState<'all_users' | 'all_creators' | 'specific'>('specific');
  const [adminComposeRecipientId, setAdminComposeRecipientId] = useState('');
  const [allUsersList, setAllUsersList] = useState<any[]>([]);

  // Media states
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaDescription, setMediaDescription] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const [outreachTitle, setOutreachTitle] = useState('');
  const [outreachMessage, setOutreachMessage] = useState('');
  const [outreachTargetType, setOutreachTargetType] = useState<'followers' | 'content_buyers'>('followers');
  const [outreachContentId, setOutreachContentId] = useState('');
  const [isSendingOutreach, setIsSendingOutreach] = useState(false);

  const [calcPrice, setCalcPrice] = useState('1000');

  // Handle active tab from query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) {
        setActiveTab(tab);
      }
    }
  }, []);

  // Fetch list of all registered users (admin only)
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      fetched.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
      setAllUsersList(fetched);
    });
    return () => unsubscribe();
  }, [user]);

  // Listen to content reports (admin only)
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    const q = query(collection(db, 'reports'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingReports(false);
    }, (err) => {
      console.error("Reports query failed:", err);
      setLoadingReports(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Listen to inbox messages (admin and creator) — flat pair avoids nested onSnapshot leak
  const [inboxMessages, setInboxMessages] = useState<any[]>([]);
  const [adminSentMessages, setAdminSentMessages] = useState<any[]>([]);
  const [adminReceivedMessages, setAdminReceivedMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!user || (user.role !== 'creator' && user.role !== 'admin')) return;
    const q = query(collection(db, 'messages'), where('senderId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      setAdminSentMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (err) => console.error('Admin sent messages error:', err));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || (user.role !== 'creator' && user.role !== 'admin')) return;
    const recipientIds = [user.uid];
    if (user.role === 'creator') recipientIds.push('all_creators');
    if (user.role === 'admin') recipientIds.push('admin');
    const q = query(collection(db, 'messages'), where('recipientId', 'in', recipientIds));
    const unsubscribe = onSnapshot(q, (snap) => {
      setAdminReceivedMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (err) => console.error('Admin received messages error:', err));
    return () => unsubscribe();
  }, [user]);

  // Merge + deduplicate
  const adminMergedMessages = useMemo(() => {
    const merged = [...adminSentMessages, ...adminReceivedMessages];
    const unique = merged.filter((item, idx, self) => self.findIndex(t => t.id === item.id) === idx);
    unique.sort((a, b) => b.createdAt - a.createdAt);
    return unique;
  }, [adminSentMessages, adminReceivedMessages]);

  // Keep inboxMessages in sync with merged result
  useEffect(() => {
    setInboxMessages(adminMergedMessages);
  }, [adminMergedMessages]);

  const adminThreads = useMemo(() => {
    if (!user) return [];

    const normalizeSubject = (subj: string) => {
      return subj.replace(/^(re|reply|fwd|fw)\s*:\s*/i, '').trim();
    };

    const grouped: Record<string, any[]> = {};

    inboxMessages.forEach((msg) => {
      const partnerId = msg.senderId === user.uid ? msg.recipientId : msg.senderId;
      const partnerName = msg.senderId === user.uid
        ? (msg.recipientId === 'admin' ? 'Admin' : msg.recipientId === 'all_users' ? 'All Users' : msg.recipientId === 'all_creators' ? 'All Creators' : 'User')
        : msg.senderName;
      const normSubject = normalizeSubject(msg.subject || 'Inquiry');
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
  }, [inboxMessages, user]);

  // Listen to media (admin or creator scope)
  useEffect(() => {
    if (!user || (user.role !== 'creator' && user.role !== 'admin')) return;
    const q = query(collection(db, 'media'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      docs.sort((a, b) => b.createdAt - a.createdAt);

      const filtered = user.role === 'admin' ? docs : docs.filter(d => d.creatorId === user.uid);
      setMediaList(filtered);
    });
    return () => unsubscribe();
  }, [user]);

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== 'admin') return;
    setIsBroadcasting(true);
    try {
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        senderId: 'admin',
        senderName: 'Noor Admin',
        title: broadcastTitle,
        message: broadcastMessage,
        type: 'global',
        createdAt: Date.now()
      });
      alert('Broadcast notification sent successfully to all users!');
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (err: any) {
      alert(err.message || 'Failed to send broadcast');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleResolveReport = async (reportId: string) => {
    if (!user || user.role !== 'admin') return;
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      alert('Report marked as resolved.');
    } catch (err: any) {
      alert(err.message || 'Failed to resolve report');
    }
  };

  const handleInboxReply = async (parentMsg: any) => {
    if (!user) return;
    const replyText = creatorReplyText[parentMsg.id];
    if (!replyText || !replyText.trim()) return;

    try {
      const msgRef = doc(collection(db, 'messages'));
      const isSenderAdmin = user.role === 'admin';
      const senderName = isSenderAdmin ? 'Noor Admin' : (user.displayName || 'Content Creator');
      const replyRecipientId = parentMsg.senderId === user.uid ? parentMsg.recipientId : parentMsg.senderId;

      await setDoc(msgRef, {
        id: msgRef.id,
        senderId: user.uid,
        senderName,
        recipientId: replyRecipientId,
        messageText: replyText,
        subject: `Re: ${parentMsg.subject || 'Inquiry'}`,
        createdAt: Date.now()
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        senderId: user.uid,
        senderName,
        title: `Reply: ${parentMsg.subject || 'Inquiry'}`,
        message: replyText.substring(0, 100),
        type: 'direct',
        targetId: replyRecipientId,
        createdAt: Date.now()
      });

      setCreatorReplyText(prev => ({ ...prev, [parentMsg.id]: '' }));
      alert('Reply sent successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to send reply');
    }
  };

  const handleReplyToAdminThread = async (thread: any) => {
    if (!user) return;
    if (!adminThreadReplyText.trim()) return;

    try {
      const msgRef = doc(collection(db, 'messages'));
      const isSenderAdmin = user.role === 'admin';
      const senderName = isSenderAdmin ? 'Noor Admin' : (user.displayName || 'Content Creator');

      await setDoc(msgRef, {
        id: msgRef.id,
        senderId: user.uid,
        senderName,
        recipientId: thread.partnerId,
        messageText: adminThreadReplyText,
        subject: `Re: ${thread.subject}`,
        createdAt: Date.now()
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        senderId: user.uid,
        senderName,
        title: `Reply: Re: ${thread.subject}`,
        message: adminThreadReplyText.substring(0, 100),
        type: 'direct',
        targetId: thread.partnerId,
        createdAt: Date.now()
      });

      setAdminThreadReplyText('');
      alert('Reply sent successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to send reply');
    }
  };

  const handleAdminComposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== 'admin') return;
    if (adminComposeRecipientType === 'specific' && !adminComposeRecipientId) {
      alert('Please select a specific recipient');
      return;
    }

    try {
      const msgRef = doc(collection(db, 'messages'));
      const targetRecipientId = adminComposeRecipientType === 'all_users'
        ? 'all_users'
        : adminComposeRecipientType === 'all_creators'
          ? 'all_creators'
          : adminComposeRecipientId;

      await setDoc(msgRef, {
        id: msgRef.id,
        senderId: user.uid,
        senderName: 'Noor Admin',
        recipientId: targetRecipientId,
        messageText: adminComposeMessageText,
        subject: adminComposeSubject || 'Admin Announcement',
        createdAt: Date.now()
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        senderId: user.uid,
        senderName: 'Noor Admin',
        title: `Message from Admin: ${adminComposeSubject || 'Announcement'}`,
        message: adminComposeMessageText.substring(0, 100),
        type: targetRecipientId === 'all_users' ? 'global' : 'direct',
        targetId: targetRecipientId,
        createdAt: Date.now()
      });

      alert('Message composed and sent successfully!');
      setAdminComposeSubject('');
      setAdminComposeMessageText('');
      setAdminComposeRecipientId('');
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    }
  };

  const checkVideoDimensions = (file: File): Promise<{ isVertical: boolean }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        const isVertical = video.videoHeight > video.videoWidth;
        resolve({ isVertical });
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve({ isVertical: true });
      };
    });
  };

  const handleMediaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!mediaFile) {
      alert('Please select a short video clip file');
      return;
    }
    if (mediaFile.size > 50 * 1024 * 1024) {
      alert('Video file size exceeds the 50MB limit.');
      return;
    }

    setIsUploadingMedia(true);
    try {
      const { isVertical } = await checkVideoDimensions(mediaFile);
      if (!isVertical) {
        const proceed = confirm('Warning: This video is not in vertical (9:16) format. Short Clips look best when vertical. Do you want to publish it anyway?');
        if (!proceed) {
          setIsUploadingMedia(false);
          return;
        }
      }
      const formData = new FormData();
      formData.append('file', mediaFile);
      formData.append('type', 'media');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload video');
      }

      const mediaRef = doc(collection(db, 'media'));
      await setDoc(mediaRef, {
        id: mediaRef.id,
        title: mediaTitle || 'Islamic Clip',
        description: mediaDescription || '',
        videoUrl: data.url,
        videoPath: data.path,
        videoSize: data.size || mediaFile.size,
        creatorId: user.uid,
        creatorName: user.displayName || user.email.split('@')[0],
        reactions: {},
        sharesCount: 0,
        bookmarks: {},
        createdAt: Date.now()
      });

      alert('Short video clip published successfully!');
      setMediaTitle('');
      setMediaDescription('');
      setMediaFile(null);
      const fileInput = document.getElementById('media-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err: any) {
      alert(err.message || 'Failed to publish media clip');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!confirm('Are you sure you want to delete this video clip?')) return;
    try {
      await deleteDoc(doc(db, 'media', mediaId));
      alert('Short video clip deleted successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to delete clip');
    }
  };

  const handleCreatorOutreachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSendingOutreach(true);
    try {
      const isTargetFollowers = outreachTargetType === 'followers';
      const targetId = isTargetFollowers ? 'followers' : outreachContentId;
      if (!isTargetFollowers && !targetId) {
        alert('Please select a course or book to target.');
        setIsSendingOutreach(false);
        return;
      }
      const cost = isTargetFollowers ? 3000 : 1000;

      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'outreach',
          amount: cost,
          email: user.email,
          message: `Outreach to ${isTargetFollowers ? 'Followers' : 'Content Buyers'}`,
          outreachTarget: outreachTargetType,
          outreachContentId: targetId,
          outreachTitle: outreachTitle,
          outreachMessage: outreachMessage
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      } else {
        throw new Error(data.error || 'Failed to initialize Paystack outreach transaction');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to initialize outreach payment');
      setIsSendingOutreach(false);
    }
  };

  // Admin stats states
  const [stats, setStats] = useState<{ totalRevenue: number; bookSales: number; totalTips: number } | null>(null);
  const [recentActivity, setRecentActivity] = useState<Array<{
    type: 'purchase' | 'download' | 'tip';
    title: string;
    amount: number;
    dateStr: string;
  }>>([]);
  const [bookStats, setBookStats] = useState<Record<string, { sales: number; downloads: number; revenue: number }>>({});
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch stats on mount / auth state change
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin') {
      setLoadingStats(false);
      return;
    }

    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const res = await fetch('/api/admin/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setRecentActivity(data.recentActivity);
          setBookStats(data.bookStats);
        }
      } catch (err) {
        console.error('Failed to fetch admin stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Cover image size must be less than 5MB');
      return;
    }

    if (newBook.coverUrl && newBook.coverUrl.startsWith('blob:')) {
      URL.revokeObjectURL(newBook.coverUrl);
    }

    setCoverFile(file);
    const localUrl = URL.createObjectURL(file);
    setNewBook(prev => ({ ...prev, coverUrl: localUrl }));
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Only PDF files are accepted.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('PDF file size must be less than 10MB');
      return;
    }

    setPdfFile(file);
    setNewBook(prev => ({ ...prev, pdfPath: file.name }));
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      alert('Only JSON files are accepted.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('JSON file size must be less than 5MB');
      return;
    }

    setJsonFile(file);
    setNewBook(prev => ({ ...prev, jsonPath: file.name }));
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBook.coverUrl) {
      alert("Please select a cover image file or provide an image URL.");
      return;
    }
    if (newBook.contentType === 'pdf' && !newBook.pdfPath) {
      alert("Please select and upload a PDF document.");
      return;
    }
    if (newBook.contentType === 'json' && !newBook.jsonPath) {
      alert("Please select and upload a JSON document.");
      return;
    }

    setIsSaving(true);
    let finalCoverUrl = newBook.coverUrl;
    let finalPdfPath = newBook.pdfPath;
    let finalJsonPath = newBook.jsonPath;

    try {
      if (coverFile) {
        setIsUploadingCover(true);
        const compressed = await compressImage(coverFile, 1, 0.8);
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('type', 'cover');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error || 'Failed to upload cover image');
        }
        finalCoverUrl = data.url;
        setIsUploadingCover(false);
      }

      if (newBook.contentType === 'pdf' && pdfFile) {
        setIsUploadingPdf(true);
        const formData = new FormData();
        formData.append('file', pdfFile);
        formData.append('type', 'pdf');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.path) {
          throw new Error(data.error || 'Failed to upload PDF');
        }
        finalPdfPath = data.path;
        setIsUploadingPdf(false);
      } else if (newBook.contentType === 'json' && jsonFile) {
        setIsUploadingJson(true);
        const formData = new FormData();
        formData.append('file', jsonFile);
        formData.append('type', 'json');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.path) {
          throw new Error(data.error || 'Failed to upload JSON');
        }
        finalJsonPath = data.path;
        setIsUploadingJson(false);
      }

      const categoryValue = selectedCategory === 'Other' ? customCategory : selectedCategory;
      const languageValue = selectedLanguage === 'Other' ? customLanguage : selectedLanguage;

      const bookData = {
        title: newBook.title || 'Untitled',
        author: newBook.author || 'Author Al-Noor',
        description: newBook.description || '',
        coverUrl: finalCoverUrl || '',
        pdfPath: finalPdfPath || '',
        contentType: newBook.contentType || 'pdf',
        jsonPath: finalJsonPath || '',
        price: parseFloat(newBookPrices.price) || 0,
        downloadPrice: parseFloat(newBookPrices.downloadPrice) || 0,
        category: categoryValue || 'Uncategorized',
        pages: parseInt(newBookPrices.pages, 10) || 0,
        language: languageValue || 'English',
        isSecure: newBook.isSecure !== false,
        paymentInterval: newBook.paymentInterval || 'once',
        creatorId: newBook.creatorId || user?.uid || 'admin'
      };

      if (editingBookId) {
        await updateBook({ id: editingBookId, ...bookData });
      } else {
        await addBook(bookData);
      }
      closeBookModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Failed to save book catalog. Please try again.');
    } finally {
      setIsUploadingCover(false);
      setIsUploadingPdf(false);
      setIsUploadingJson(false);
      setIsSaving(false);
    }
  };

  const openAddModal = () => {
    setEditingBookId(null);
    setNewBook({ title: '', author: 'Author Al-Noor', description: '', coverUrl: '', pdfPath: '', jsonPath: '', contentType: 'pdf', isSecure: true, paymentInterval: 'once' });
    setNewBookPrices({ price: '0', downloadPrice: '0', pages: '0' });
    setSelectedCategory(CATEGORIES[0]);
    setCustomCategory('');
    setSelectedLanguage(LANGUAGES[0]);
    setCustomLanguage('');
    setImageUploadType('file');
    setCoverFile(null);
    setPdfFile(null);
    setJsonFile(null);
    setIsBookModalOpen(true);
  };

  const openEditModal = (book: Book) => {
    setEditingBookId(book.id);
    setNewBook({
      title: book.title, author: book.author, description: book.description, coverUrl: book.coverUrl, pdfPath: book.pdfPath, jsonPath: book.jsonPath || '', contentType: book.contentType || 'pdf', isSecure: book.isSecure !== false, paymentInterval: book.paymentInterval || 'once', creatorId: book.creatorId || 'admin'
    });
    setNewBookPrices({ price: book.price.toString(), downloadPrice: book.downloadPrice.toString(), pages: book.pages.toString() });

    if (CATEGORIES.includes(book.category)) {
      setSelectedCategory(book.category);
      setCustomCategory('');
    } else {
      setSelectedCategory('Other');
      setCustomCategory(book.category);
    }

    if (LANGUAGES.includes(book.language)) {
      setSelectedLanguage(book.language);
      setCustomLanguage('');
    } else {
      setSelectedLanguage('Other');
      setCustomLanguage(book.language);
    }

    if (book.coverUrl?.startsWith('data:image')) {
      setImageUploadType('file');
    } else {
      setImageUploadType('url');
    }

    setCoverFile(null);
    setPdfFile(null);
    setJsonFile(null);
    setIsBookModalOpen(true);
  };

  const closeBookModal = () => {
    setIsBookModalOpen(false);
    setEditingBookId(null);
    setCoverFile(null);
    setPdfFile(null);
    setJsonFile(null);
  };

  const getBookAnalytics = (bookId: string) => {
    const s = bookStats[bookId] || { sales: 0, downloads: 0, revenue: 0 };
    const seed = bookId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const simulatedViews = (s.sales + s.downloads) * 5 + (seed % 10) + 12;
    return {
      views: simulatedViews,
      sales: s.sales,
      downloads: s.downloads,
      revenue: s.revenue
    };
  };

  if (isLoading) {
    return (
      <div className="admin-layout">
        <div className="admin-sidebar">
          <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: '40px', borderRadius: '8px', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        </div>
        <div className="admin-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ height: '48px', width: '280px', borderRadius: '8px', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: '120px', borderRadius: '12px', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
            <div style={{ height: '300px', borderRadius: '12px', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'creator')) {
    return null; // useEffect already redirects to '/'
  }

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <h2 className="admin-sidebar-header">
          Admin Panel
        </h2>
        <ul className="admin-sidebar-list">
          <li>
            <button
              onClick={() => setActiveTab('overview')}
              className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            >
              Overview
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('books')}
              className={`admin-tab-btn ${activeTab === 'books' ? 'active' : ''}`}
            >
              Manage Books
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('series')}
              className={`admin-tab-btn ${activeTab === 'series' ? 'active' : ''}`}
            >
              Manage Series
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('courses')}
              className={`admin-tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
            >
              Manage Courses
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('reminders')}
              className={`admin-tab-btn ${activeTab === 'reminders' ? 'active' : ''}`}
            >
              Manage Reminders
            </button>
          </li>
          {(user?.role === 'admin' || user?.role === 'creator') && (
            <>
              <li>
                <button
                  onClick={() => setActiveTab('inbox')}
                  className={`admin-tab-btn ${activeTab === 'inbox' ? 'active' : ''}`}
                >
                  Direct Messages
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('submissions')}
                  className={`admin-tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
                >
                  Student Submissions
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('media')}
                  className={`admin-tab-btn ${activeTab === 'media' ? 'active' : ''}`}
                >
                  Short Media Clips
                </button>
              </li>
            </>
          )}
          {user?.role === 'admin' && (
            <>
              <li>
                <button
                  onClick={() => setActiveTab('creator_requests')}
                  className={`admin-tab-btn ${activeTab === 'creator_requests' ? 'active' : ''}`}
                >
                  Creator Requests
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('broadcast')}
                  className={`admin-tab-btn ${activeTab === 'broadcast' ? 'active' : ''}`}
                >
                  Broadcast Message
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`admin-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
                >
                  Content Reports
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('banners')}
                  className={`admin-tab-btn ${activeTab === 'banners' ? 'active' : ''}`}
                >
                  Promotional Banners
                </button>
              </li>
            </>
          )}
          {user?.role === 'creator' && (
            <>
              <li>
                <button
                  onClick={() => setActiveTab('creator_outreach')}
                  className={`admin-tab-btn ${activeTab === 'creator_outreach' ? 'active' : ''}`}
                >
                  Follower Outreach
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('payouts')}
                  className={`admin-tab-btn ${activeTab === 'payouts' ? 'active' : ''}`}
                >
                  Earnings & Payouts
                </button>
              </li>
            </>
          )}
        </ul>
      </div>

      {/* Main Content */}
      <div className="admin-content">
        {activeTab === 'overview' && (
          user?.role === 'creator' ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(212, 175, 55, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-gold)',
                margin: '0 auto 1.5rem auto',
                boxShadow: '0 8px 24px rgba(212, 175, 55, 0.15)',
                border: '1px solid var(--accent-gold)'
              }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </div>
              <h1 style={{ fontFamily: 'Outfit', fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Welcome to the Creator Dashboard</h1>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2rem auto', lineHeight: 1.6 }}>
                As an approved creator, you have full access to publish and manage courses, books, multi-part series, and reminders. Use the tabs in the sidebar to start publishing contents for the community.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab('books')} className="btn btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>Manage Books</button>
                <button onClick={() => setActiveTab('courses')} className="btn btn-secondary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>Manage Courses</button>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="admin-title">Dashboard Overview</h1>
              {loadingStats ? (
                <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard statistics...</p>
              ) : (
                <>
                  <div className="admin-stats-grid">
                    <div className="glass-card admin-stat-card">
                      <p className="admin-card-label">Total Revenue</p>
                      <h3 className="admin-card-value">₦{stats?.totalRevenue.toFixed(2) || '0.00'}</h3>
                    </div>
                    <div className="glass-card admin-stat-card">
                      <p className="admin-card-label">Book Sales</p>
                      <h3 className="admin-card-value">₦{stats?.bookSales.toFixed(2) || '0.00'}</h3>
                    </div>
                    <div className="glass-card admin-stat-card">
                      <p className="admin-card-label">Total Tips</p>
                      <h3 className="admin-card-value">₦{stats?.totalTips.toFixed(2) || '0.00'}</h3>
                    </div>
                  </div>

                  <AnalyticsCharts recentActivity={recentActivity} />

                  <h2 className="admin-subtitle">Recent Activity</h2>
                  <div className="glass-card admin-table-container">
                    <table className="admin-table admin-table-overview">
                      <thead>
                        <tr className="admin-table-header">
                          <th className="admin-table-th">Type</th>
                          <th className="admin-table-th">Amount</th>
                          <th className="admin-table-th">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentActivity.length === 0 ? (
                          <tr className="admin-table-header">
                            <td colSpan={3} className="admin-table-td" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              No recent activity found.
                            </td>
                          </tr>
                        ) : (
                          recentActivity.map((act, idx) => (
                            <tr key={idx} className="admin-table-header">
                              <td className="admin-table-td">
                                <span className={`badge ${act.type === 'tip' ? 'badge-gold' : act.type === 'download' ? 'badge-free' : 'badge-premium'}`}>
                                  {act.type === 'tip' ? 'Tip' : act.type === 'download' ? 'Download' : 'Purchase'}
                                </span>{' '}
                                {act.title}
                              </td>
                              <td className="admin-table-td">₦{act.amount.toFixed(2)}</td>
                              <td className="admin-table-td-muted">{act.dateStr}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )
        )}

        {activeTab === 'books' && (
          <div>
            <div className="admin-header-row">
              <h1 className="admin-title-no-margin">Manage Books</h1>
              <button className="btn btn-primary" onClick={openAddModal}>Add New Book</button>
            </div>

            <div className="glass-card admin-table-container">
              <table className="admin-table admin-table-books">
                <thead>
                  <tr className="admin-table-header-bg">
                    <th className="admin-table-th">Title</th>
                    <th className="admin-table-th">Category</th>
                    <th className="admin-table-th">Price</th>
                    <th className="admin-table-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map(book => (
                    <tr
                      key={book.id}
                      className="admin-table-row admin-table-header"
                      onClick={() => router.push(`/books/${book.id}`)}
                    >
                      <td className="admin-table-td-bold">{book.title}</td>
                      <td className="admin-table-td-muted">{book.category}</td>
                      <td className="admin-table-td">{book.price === 0 ? 'Free' : `₦${book.price.toLocaleString()}`}</td>
                      <td className="admin-table-td admin-table-actions-cell" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setViewingAnalytics(book)} className="admin-action-btn">View Analytics</button>
                        <button onClick={() => openEditModal(book)} className="admin-action-btn">Edit</button>
                        <button onClick={() => { if (confirm('Are you sure you want to delete this book?')) deleteBook(book.id) }} className="admin-action-btn-danger">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'series' && (
          <ManageSeriesTab />
        )}

        {activeTab === 'courses' && (
          <ManageCoursesTab />
        )}

        {activeTab === 'reminders' && (
          <ManageRemindersTab />
        )}

        {activeTab === 'banners' && (
          <ManageBannersTab />
        )}

        {activeTab === 'submissions' && (
          <ViewSubmissionsTab />
        )}

        {activeTab === 'creator_requests' && (
          <CreatorRequestsTab />
        )}

        {activeTab === 'broadcast' && (
          <div>
            <h1 className="admin-title">Broadcast Message</h1>
            <p className="admin-subtitle" style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Send a system-wide broadcast notification to all library users.</p>
            <div className="glass-card" style={{ padding: '2rem', borderRadius: '12px', maxWidth: '600px' }}>
              <form onSubmit={handleBroadcastSubmit} className="modal-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="broadcast-title">Notification Title</label>
                  <input
                    id="broadcast-title"
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Scheduled Maintenance"
                    value={broadcastTitle}
                    onChange={e => setBroadcastTitle(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="broadcast-message">Notification Message</label>
                  <textarea
                    id="broadcast-message"
                    className="form-input"
                    rows={5}
                    required
                    placeholder="Type the message for the users..."
                    value={broadcastMessage}
                    onChange={e => setBroadcastMessage(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isBroadcasting}>
                  {isBroadcasting ? 'Broadcasting...' : 'Broadcast to All Users'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div>
            <h1 className="admin-title">Content Reports</h1>
            <p className="admin-subtitle" style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Review reports submitted by users regarding catalog listings.</p>
            {loadingReports ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading content reports...</p>
            ) : reports.length === 0 ? (
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No active content reports.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {reports.map(rep => (
                  <div key={rep.id} className="glass-card" style={{ padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--accent-red)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {rep.contentTitle} ({rep.contentType.toUpperCase()})
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(rep.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                      <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>Reason: </span>
                      <span style={{ color: 'var(--text-primary)' }}>{rep.reason.toUpperCase()}</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0 0 1rem 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {rep.details}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Reported by: {rep.reporterEmail}</span>
                      <button onClick={() => handleResolveReport(rep.id)} className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>
                        Mark Resolved (Delete Report)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'inbox' && (
          <div>
            <h1 className="admin-title">Direct Messages & Inquiries</h1>
            <p className="admin-subtitle" style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Review and manage direct conversation threads with users and creators.</p>

            {/* Compose Message Form for Admin only */}
            {user.role === 'admin' && (
              <div className="glass-card" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '2.5rem' }}>
                <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Compose Direct Message</h3>
                <form onSubmit={handleAdminComposeSubmit} className="modal-form">
                  <div className="form-group">
                    <label className="form-label">Recipient Target</label>
                    <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="admin-recipient-type"
                          checked={adminComposeRecipientType === 'specific'}
                          onChange={() => setAdminComposeRecipientType('specific')}
                        />
                        Specific User / Creator
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="admin-recipient-type"
                          checked={adminComposeRecipientType === 'all_users'}
                          onChange={() => setAdminComposeRecipientType('all_users')}
                        />
                        All Users
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="admin-recipient-type"
                          checked={adminComposeRecipientType === 'all_creators'}
                          onChange={() => setAdminComposeRecipientType('all_creators')}
                        />
                        All Creators
                      </label>
                    </div>
                  </div>

                  {adminComposeRecipientType === 'specific' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="admin-select-recipient">Select Recipient</label>
                      <select
                        id="admin-select-recipient"
                        className="form-input"
                        value={adminComposeRecipientId}
                        onChange={e => setAdminComposeRecipientId(e.target.value)}
                        required={adminComposeRecipientType === 'specific'}
                      >
                        <option value="">-- Choose User / Creator --</option>
                        {allUsersList.filter(u => u.id !== user.uid).map(u => (
                          <option key={u.id} value={u.id}>
                            {u.displayName || u.email.split('@')[0]} ({u.role.toUpperCase()}) - {u.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label" htmlFor="admin-compose-subject">Subject</label>
                    <input
                      id="admin-compose-subject"
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g. Verification support or important update"
                      value={adminComposeSubject}
                      onChange={e => setAdminComposeSubject(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="admin-compose-message">Message Details</label>
                    <textarea
                      id="admin-compose-message"
                      className="form-input"
                      rows={4}
                      required
                      placeholder="Type your message details here..."
                      value={adminComposeMessageText}
                      onChange={e => setAdminComposeMessageText(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Send Message
                  </button>
                </form>
              </div>
            )}

            {/* Conversation Threads list */}
            <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Active Message Threads</h3>
            {adminThreads.length === 0 ? (
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No active message threads found.</p>
              </div>
            ) : adminActiveThreadId ? (() => {
              const activeThread = adminThreads.find(t => t.id === adminActiveThreadId);
              if (!activeThread) return null;
              return (
                <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    <div>
                      <button
                        onClick={() => { setAdminActiveThreadId(null); setAdminThreadReplyText(''); }}
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
                  <form onSubmit={(e) => { e.preventDefault(); handleReplyToAdminThread(activeThread); }} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <textarea
                        className="form-input"
                        style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', minHeight: '44px', height: '44px', resize: 'none' }}
                        placeholder="Write a response..."
                        value={adminThreadReplyText}
                        onChange={e => setAdminThreadReplyText(e.target.value)}
                        required
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ padding: '0 1.25rem', height: '44px' }}
                      >
                        Reply
                      </button>
                    </div>
                  </form>
                </div>
              );
            })() : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {adminThreads.map(thread => {
                  const isLastMsgMe = thread.lastMessageSenderId === user.uid;
                  return (
                    <div
                      key={thread.id}
                      onClick={() => setAdminActiveThreadId(thread.id)}
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
        )}

        {activeTab === 'media' && (
          <div>
            <h1 className="admin-title">Manage Short Media Clips</h1>
            <p className="admin-subtitle" style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
              Publish TikTok-style short videos, recitations, or reminders. Every clip must be under **10MB** in size.
            </p>

            <div className="glass-card" style={{ padding: '2rem', borderRadius: '12px', marginBottom: '2.5rem' }}>
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Publish New Clip</h3>
              <form onSubmit={handleMediaSubmit} className="modal-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="media-title">Clip Title</label>
                  <input
                    id="media-title"
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Beautiful Recitation of Surah Al-Mulk"
                    value={mediaTitle}
                    onChange={e => setMediaTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="media-description">Description</label>
                  <textarea
                    id="media-description"
                    className="form-input"
                    rows={2}
                    required
                    placeholder="Short summary of this clip..."
                    value={mediaDescription}
                    onChange={e => setMediaDescription(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="media-file-input">Select Video File (Max 50MB)</label>
                  <input
                    id="media-file-input"
                    type="file"
                    className="form-input"
                    accept="video/*"
                    required
                    onChange={e => setMediaFile(e.target.files ? e.target.files[0] : null)}
                  />
                  {mediaFile && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Size: {(mediaFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  )}
                </div>

                <button type="submit" disabled={isUploadingMedia} className="btn btn-primary" style={{ width: '100%' }}>
                  {isUploadingMedia ? 'Uploading video & publishing...' : 'Publish Media Clip'}
                </button>
              </form>
            </div>

            <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Your Published Clips</h3>
            {mediaList.length === 0 ? (
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No short clips published yet.</p>
              </div>
            ) : (
              <div className="glass-card admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr className="admin-table-header-bg">
                      <th className="admin-table-th">Title</th>
                      <th className="admin-table-th">Author</th>
                      <th className="admin-table-th">Size</th>
                      <th className="admin-table-th">Reactions</th>
                      <th className="admin-table-th">Bookmarks</th>
                      <th className="admin-table-th">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mediaList.map(item => (
                      <tr key={item.id} className="admin-table-row">
                        <td className="admin-table-td-bold">{item.title}</td>
                        <td className="admin-table-td-muted">{item.creatorName}</td>
                        <td className="admin-table-td-muted">
                          {((item.videoSize || 0) / (1024 * 1024)).toFixed(2)} MB
                        </td>
                        <td className="admin-table-td-muted">
                          {Object.keys(item.reactions || {}).length} likes
                        </td>
                        <td className="admin-table-td-muted">
                          {Object.keys(item.bookmarks || {}).length} bookmarks
                        </td>
                        <td className="admin-table-td admin-table-actions-cell">
                          <button
                            type="button"
                            onClick={() => handleDeleteMedia(item.id)}
                            className="admin-action-btn-danger"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'creator_outreach' && (
          <div>
            <h1 className="admin-title">Follower Outreach</h1>
            <p className="admin-subtitle" style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Send targeted notifications directly to your followers or course students.</p>
            <div className="glass-card" style={{ padding: '2rem', borderRadius: '12px', maxWidth: '600px' }}>
              <form onSubmit={handleCreatorOutreachSubmit} className="modal-form">
                <div className="form-group">
                  <label className="form-label">Outreach Channel Target</label>
                  <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="outreach-target"
                        checked={outreachTargetType === 'followers'}
                        onChange={() => setOutreachTargetType('followers')}
                      />
                      All My Followers (₦3,000)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="outreach-target"
                        checked={outreachTargetType === 'content_buyers'}
                        onChange={() => setOutreachTargetType('content_buyers')}
                      />
                      Content Students (₦1,000)
                    </label>
                  </div>
                </div>

                {outreachTargetType === 'content_buyers' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="outreach-content">Select Target Content</label>
                    <select
                      id="outreach-content"
                      className="form-input"
                      value={outreachContentId}
                      onChange={e => setOutreachContentId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Course or Book --</option>
                      <optgroup label="Courses">
                        {courses.filter(c => c.creatorId === user?.uid).map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Books">
                        {books.filter(b => b.creatorId === user?.uid).map(b => (
                          <option key={b.id} value={b.id}>{b.title}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="outreach-title">Outreach Title</label>
                  <input
                    id="outreach-title"
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Special Announcement: Live Session Tomorrow"
                    value={outreachTitle}
                    onChange={e => setOutreachTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="outreach-message">Message Content</label>
                  <textarea
                    id="outreach-message"
                    className="form-input"
                    rows={5}
                    required
                    placeholder="Type the message to send..."
                    value={outreachMessage}
                    onChange={e => setOutreachMessage(e.target.value)}
                  />
                </div>

                <div className="accent-card" style={{ marginBottom: '1.5rem', background: 'rgba(212,163,89,0.05)', borderColor: 'rgba(212,163,89,0.1)' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    All notifications are verified via Paystack. You will be redirected to complete payment of <strong>₦{outreachTargetType === 'followers' ? '3,000' : '1,000'}</strong> before the broadcast triggers.
                  </p>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSendingOutreach}>
                  {isSendingOutreach ? 'Redirecting...' : 'Proceed to Payment'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'payouts' && (
          <div>
            <h1 className="admin-title">My Earnings & Payout Breakdown</h1>
            <p className="admin-subtitle" style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Review revenue projections and see payout structures for content pricing.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
              {/* Fee Structure Alert */}
              <div className="glass-card" style={{ padding: '2rem', borderRadius: '12px' }}>
                <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Fee Structure Policy</h3>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.95rem', paddingLeft: '1.2rem' }}>
                  <li><strong>Admin Cut</strong>: 5% of the original content listing price.</li>
                  <li><strong>Paystack Processing Fee</strong>: 1.5% + ₦100 flat fee, capped at a maximum of ₦2,000.</li>
                  <li><strong>Payout Transfer Fee</strong>: 1% + ₦35 flat fee (calculated based on the net remaining amount after Admin and Paystack deductions).</li>
                  <li><strong>Payout Schedule</strong>: Proceeds are paid out directly to your registered bank account every Thursday.</li>
                </ul>
              </div>

              {/* Earnings Calculator */}
              <div className="glass-card" style={{ padding: '2rem', borderRadius: '12px', maxWidth: '500px' }}>
                <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Interactive Calculator</h3>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" htmlFor="calc-price-input">Set Original Content Price (₦)</label>
                  <input
                    id="calc-price-input"
                    type="number"
                    className="form-input"
                    value={calcPrice}
                    onChange={e => setCalcPrice(e.target.value)}
                    placeholder="e.g. 5000"
                  />
                </div>

                {(() => {
                  const price = parseFloat(calcPrice) || 0;
                  const adminCut = price * 0.05;
                  const paystackFee = Math.min(2000, price * 0.015 + 100);
                  const afterDeductions = Math.max(0, price - (adminCut + paystackFee));
                  const payoutFee = afterDeductions > 0 ? (afterDeductions * 0.01 + 35) : 0;
                  const creatorNet = Math.max(0, afterDeductions - payoutFee);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Original Price:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₦{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Admin Commission (5%):</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>- ₦{adminCut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Paystack Processing Fee:</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>- ₦{paystackFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ width: '100%', height: '1px', background: 'var(--border-color)', margin: '0.25rem 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Payout Fee (1% + ₦35):</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>- ₦{payoutFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ width: '100%', height: '1.5px', background: 'var(--accent-gold)', margin: '0.25rem 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem' }}>
                        <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>Your Net Payout:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₦{creatorNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Book Modal */}
      {isBookModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">{editingBookId ? 'Edit Book' : 'Add New Book'}</h2>
              <button onClick={closeBookModal} className="modal-close-btn">&times;</button>
            </div>

            <form onSubmit={handleBookSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="book-title" className="form-label">Title</label>
                <input id="book-title" type="text" className="form-input" required value={newBook.title} onChange={e => setNewBook({ ...newBook, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor="book-author" className="form-label">Author Name</label>
                <input id="book-author" type="text" className="form-input" required value={newBook.author} onChange={e => setNewBook({ ...newBook, author: e.target.value })} placeholder="e.g. Imam Ghazali" />
              </div>
              <div className="modal-grid-2">
                <div className="form-group">
                  <label htmlFor="book-category-select" className="form-label">Category</label>
                  <select
                    id="book-category-select"
                    className="form-input"
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {selectedCategory === 'Other' && (
                    <input
                      type="text"
                      className="form-input custom-input-margin"
                      placeholder="Enter custom category"
                      required
                      value={customCategory}
                      onChange={e => setCustomCategory(e.target.value)}
                    />
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="book-language-select" className="form-label">Language</label>
                  <select
                    id="book-language-select"
                    className="form-input"
                    value={selectedLanguage}
                    onChange={e => setSelectedLanguage(e.target.value)}
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                  {selectedLanguage === 'Other' && (
                    <input
                      type="text"
                      className="form-input custom-input-margin"
                      placeholder="Enter custom language"
                      required
                      value={customLanguage}
                      onChange={e => setCustomLanguage(e.target.value)}
                    />
                  )}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="book-description" className="form-label">Description</label>
                <textarea id="book-description" className="form-input" rows={3} required value={newBook.description} onChange={e => setNewBook({ ...newBook, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Cover Image</label>
                <div className="image-upload-type-selector">
                  <label className="image-upload-type-label">
                    <input type="radio" checked={imageUploadType === 'file'} onChange={() => setImageUploadType('file')} />
                    Upload File
                  </label>
                  <label className="image-upload-type-label">
                    <input type="radio" checked={imageUploadType === 'url'} onChange={() => setImageUploadType('url')} />
                    Image URL
                  </label>
                </div>

                {imageUploadType === 'file' ? (
                  <div className="image-upload-dropzone">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="file-input-overlay"
                      aria-label="Upload Cover Image"
                      title="Upload Cover Image"
                    />
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" className="image-upload-icon">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                    <p className="image-upload-text">
                      Click or drag cover image file to upload
                    </p>
                  </div>
                ) : (
                  <input
                    id="book-cover"
                    type="url"
                    className="form-input"
                    required={imageUploadType === 'url'}
                    value={newBook.coverUrl && !newBook.coverUrl.startsWith('data:') ? newBook.coverUrl : ''}
                    onChange={e => setNewBook({ ...newBook, coverUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                  />
                )}

                {newBook.coverUrl && (
                  <div className="preview-container">
                    <div className="preview-thumbnail-wrapper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={newBook.coverUrl} alt="Cover Preview" className="preview-thumbnail" />
                    </div>
                    <div className="preview-info">
                      <p className="preview-title">Cover Image Selected</p>
                      <button
                        type="button"
                        onClick={() => setNewBook(prev => ({ ...prev, coverUrl: '' }))}
                        className="preview-remove-btn"
                      >
                        Remove Cover
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Book Content Type</label>
                <div className="image-upload-type-selector">
                  <label className="image-upload-type-label">
                    <input type="radio" checked={newBook.contentType === 'pdf'} onChange={() => setNewBook({ ...newBook, contentType: 'pdf' })} />
                    PDF Document
                  </label>
                  <label className="image-upload-type-label">
                    <input type="radio" checked={newBook.contentType === 'json'} onChange={() => setNewBook({ ...newBook, contentType: 'json' })} />
                    JSON Text
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Security Settings</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <label className="image-upload-type-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                    <input type="checkbox" checked={newBook.isSecure !== false} onChange={e => setNewBook({ ...newBook, isSecure: e.target.checked })} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    Secure Access (Requires Bunny Token Authorization)
                  </label>
                </div>
              </div>

              {newBook.contentType === 'pdf' ? (
                <div className="form-group">
                  <label htmlFor="book-pdf" className="form-label">PDF Document</label>
                  <div className="pdf-upload-container">
                    <input
                      id="book-pdf"
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      className="form-input"
                      aria-label="Upload PDF Document"
                      title="Upload PDF Document"
                      required={!editingBookId}
                    />
                    {isUploadingPdf && <p className="upload-progress-text">Uploading PDF to Bunny Storage...</p>}
                    {newBook.pdfPath && !isUploadingPdf && (
                      <p className="upload-success-text">PDF Ready: {newBook.pdfPath}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="book-json" className="form-label">JSON Text Document</label>
                  <div className="pdf-upload-container">
                    <input
                      id="book-json"
                      type="file"
                      accept="application/json,.json"
                      onChange={handleJsonUpload}
                      className="form-input"
                      aria-label="Upload JSON Document"
                      title="Upload JSON Document"
                      required={!editingBookId}
                    />
                    {isUploadingJson && <p className="upload-progress-text">Uploading JSON to Bunny Storage...</p>}
                    {newBook.jsonPath && !isUploadingJson && (
                      <p className="upload-success-text">JSON Ready: {newBook.jsonPath}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="modal-grid-2">
                <div className="form-group">
                  <label htmlFor="book-price" className="form-label">Read Price (₦)</label>
                  <input id="book-price" type="number" className="form-input" step="0.01" required value={newBookPrices.price} onChange={e => setNewBookPrices({ ...newBookPrices, price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="book-download-price" className="form-label">Download Price (₦)</label>
                  <input id="book-download-price" type="number" className="form-input" step="0.01" required value={newBookPrices.downloadPrice} onChange={e => setNewBookPrices({ ...newBookPrices, downloadPrice: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="book-interval" className="form-label">Payment Interval</label>
                <select
                  id="book-interval"
                  className="form-input"
                  value={newBook.paymentInterval || 'once'}
                  onChange={e => setNewBook({ ...newBook, paymentInterval: e.target.value as 'once' | 'monthly' | 'yearly' })}
                >
                  <option value="once">One-Time Purchase</option>
                  <option value="monthly">Monthly Subscription</option>
                  <option value="yearly">Yearly Subscription</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="book-pages" className="form-label">Number of Pages</label>
                <input id="book-pages" type="number" className="form-input" required value={newBookPrices.pages} onChange={e => setNewBookPrices({ ...newBookPrices, pages: e.target.value })} />
              </div>
              <button
                type="submit"
                className="btn btn-primary modal-form-submit-btn"
                disabled={isSaving}
                style={{ opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
              >
                {isSaving ? 'Uploading & Saving...' : (editingBookId ? 'Save Changes' : 'Save Book to Catalog')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Book Analytics Modal */}
      {viewingAnalytics && (
        <div className="modal-backdrop">
          <div className="glass-card modal-dialog modal-dialog-large">
            <div className="modal-header-start">
              <div>
                <span className="badge-premium-margin">{viewingAnalytics.category}</span>
                <h2 className="modal-title-large">{viewingAnalytics.title}</h2>
                <p className="modal-text-subtitle">Book Analytics Overview</p>
              </div>
              <button onClick={() => setViewingAnalytics(null)} className="modal-close-btn">&times;</button>
            </div>

            {(() => {
              const stats = getBookAnalytics(viewingAnalytics.id);
              return (
                <div className="modal-stats-grid">
                  <div className="stat-card-item">
                    <p className="stat-card-label">Total Page Views</p>
                    <p className="stat-card-value">{stats.views.toLocaleString()}</p>
                  </div>
                  <div className="stat-card-item">
                    <p className="stat-card-label">Read Purchases</p>
                    <p className="stat-card-value">{stats.sales.toLocaleString()}</p>
                  </div>
                  <div className="stat-card-item">
                    <p className="stat-card-label">PDF Downloads</p>
                    <p className="stat-card-value">{stats.downloads.toLocaleString()}</p>
                  </div>
                  <div className="stat-card-revenue">
                    <p className="stat-card-label-revenue">Total Revenue</p>
                    <p className="stat-card-value">₦{stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
