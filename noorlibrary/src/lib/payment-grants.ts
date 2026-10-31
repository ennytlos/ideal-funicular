// src/lib/payment-grants.ts
// Unified, idempotent access granting and payment ledger logging for Web and Mobile.

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { PaystackVerifyResponse } from './paystack';

export interface GrantAccessOptions {
  reference: string;
  uid: string;
  type?: string | null;
  paystackResult: PaystackVerifyResponse;
  bookId?: string | null;
  seriesId?: string | null;
  courseId?: string | null;
  creatorId?: string | null;
  message?: string | null;
  email?: string | null;
  currency?: string | null;
  outreachTitle?: string | null;
  outreachMessage?: string | null;
  outreachTarget?: string | null;
  outreachContentId?: string | null;
}

export interface GrantAccessResult {
  success: boolean;
  alreadyProcessed: boolean;
  type: string;
  amountGross: number;
  amountNet: number;
  currency: string;
  itemId?: string | null;
}

/**
 * Validates transaction data and idempotently grants digital content access.
 * Uses reference as the document ID across audit collections to prevent duplicate grants on refresh.
 */
export async function grantAccess(options: GrantAccessOptions): Promise<GrantAccessResult> {
  const { reference, uid, paystackResult } = options;

  if (paystackResult.data.status !== 'success') {
    throw new Error(`Transaction ${reference} is not successful (status: ${paystackResult.data.status})`);
  }

  const metadata = (paystackResult.data.metadata || {}) as Record<string, any>;

  // C2: Prevent reference replay across different users
  if (metadata.uid && uid !== 'anonymous' && metadata.uid !== uid) {
    throw new Error(`Security validation failed: reference ${reference} was initialized for a different user.`);
  }

  // C2: Trust Paystack for gross amount (converted from kobo)
  const amountKobo = typeof paystackResult.data.amount === 'number' ? paystackResult.data.amount : 0;
  const amountGross = amountKobo / 100;
  const amountNet = typeof metadata.amount === 'number' ? metadata.amount : amountGross;
  const currency = paystackResult.data.currency || options.currency || 'NGN';

  const resolvedType = (options.type || metadata.type || 'read') as string;
  let resolvedItemId: string | null = null;
  let resolvedCreatorId: string = (metadata.creatorId || options.creatorId || '') as string;
  let alreadyProcessed = false;

  if (resolvedType === 'tip') {
    const tipRef = adminDb.collection('tips').doc(reference);
    const tipSnap = await tipRef.get();

    if (tipSnap.exists) {
      alreadyProcessed = true;
    } else {
      let email = (metadata.email as string) || options.email || '';
      if (!email && uid !== 'anonymous') {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        email = userDoc.exists ? userDoc.data()?.email || '' : '';
      }
      if (!email) {
        email = 'anonymous@noorlibrary.com.ng';
      }

      await tipRef.set({
        reference,
        userId: uid,
        email,
        amount: amountGross,
        amountGross,
        amountNet,
        message: options.message || metadata.message || '',
        currency,
        status: 'success',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  } else if (resolvedType === 'series') {
    const seriesId = options.seriesId || metadata.seriesId || metadata.itemId;
    if (!seriesId) throw new Error('Missing seriesId for series grant');
    resolvedItemId = seriesId;

    const recordRef = adminDb.collection('user_series').doc(reference);
    const snap = await recordRef.get();

    const seriesDoc = await adminDb.collection('series').doc(seriesId).get();
    const seriesCreatorId = seriesDoc.exists ? seriesDoc.data()?.creatorId || '' : '';
    if (!resolvedCreatorId) resolvedCreatorId = seriesCreatorId;

    if (snap.exists) {
      alreadyProcessed = true;
    } else {
      await adminDb.collection('users').doc(uid).set({
        purchasedSeries: FieldValue.arrayUnion(seriesId),
      }, { merge: true });

      await recordRef.set({
        reference,
        userId: uid,
        seriesId,
        creatorId: seriesCreatorId,
        amount: amountGross,
        amountGross,
        amountNet,
        currency,
        purchasedAt: FieldValue.serverTimestamp(),
      });
    }
  } else if (resolvedType === 'course') {
    const courseId = options.courseId || metadata.courseId || metadata.itemId;
    if (!courseId) throw new Error('Missing courseId for course grant');
    resolvedItemId = courseId;

    const recordRef = adminDb.collection('user_courses').doc(reference);
    const snap = await recordRef.get();

    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    const courseData = courseDoc.exists ? courseDoc.data() : null;
    const courseCreatorId = courseData?.creatorId || '';
    if (!resolvedCreatorId) resolvedCreatorId = courseCreatorId;

    if (snap.exists) {
      alreadyProcessed = true;
    } else {
      const interval = courseData?.paymentInterval || 'once';

      const userRef = adminDb.collection('users').doc(uid);
      if (interval === 'monthly' || interval === 'yearly') {
        const days = interval === 'monthly' ? 30 : 365;
        const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
        await userRef.set(
          {
            subscriptions: {
              [courseId]: expiresAt,
            },
          },
          { merge: true },
        );
      } else {
        await userRef.set({
          enrolledCourses: FieldValue.arrayUnion(courseId),
        }, { merge: true });
      }

      await recordRef.set({
        reference,
        userId: uid,
        courseId,
        creatorId: courseCreatorId,
        amount: amountGross,
        amountGross,
        amountNet,
        currency,
        paymentInterval: interval,
        enrolledAt: FieldValue.serverTimestamp(),
      });
    }
  } else if (resolvedType === 'create_course') {
    const courseId = options.courseId || metadata.courseId;
    if (!courseId) throw new Error('Missing courseId for create_course payment');
    resolvedItemId = courseId;
    if (!resolvedCreatorId) resolvedCreatorId = uid;

    // ₦3,000 per +100MB storage boost (also backwards compatible with legacy 5k/10k plans)
    const boostMB = (amountGross >= 10000 && amountGross < 12000) 
      ? 100 
      : (amountGross >= 5000 && amountGross < 6000) 
        ? 50 
        : Math.max(100, Math.round((amountGross / 3000) * 100));
    const extraBytes = boostMB * 1024 * 1024;

    const courseRef = adminDb.collection('courses').doc(courseId);
    const courseSnap = await courseRef.get();
    const currentMax = (courseSnap.exists ? courseSnap.data()?.maxContentSize : undefined) || (50 * 1024 * 1024);
    const newMax = currentMax + extraBytes;

    await courseRef.update({
      isPaid: true,
      maxContentSize: newMax,
      paymentStatus: 'paid',
    });
  } else if (resolvedType === 'outreach') {
    const notifRef = adminDb.collection('notifications').doc(reference);
    const notifSnap = await notifRef.get();

    if (notifSnap.exists) {
      alreadyProcessed = true;
    } else {
      const outreachTitle = metadata.outreachTitle || options.outreachTitle || 'Important Announcement';
      const outreachMessage = metadata.outreachMessage || options.outreachMessage || '';
      const outreachTarget = metadata.outreachTarget || options.outreachTarget || 'followers';
      const outreachContentId = metadata.outreachContentId || options.outreachContentId || 'followers';

      await notifRef.set({
        id: reference,
        senderId: uid,
        senderName: 'Content Creator',
        title: outreachTitle,
        message: outreachMessage,
        type: 'outreach',
        targetId: outreachTarget === 'followers' ? uid : outreachContentId,
        createdAt: Date.now(),
      });
    }
  } else {
    // Default to book read or download
    const bookId = options.bookId || metadata.bookId || metadata.itemId;
    if (!bookId) throw new Error('Missing bookId for book grant');
    resolvedItemId = bookId;

    const isDownload = resolvedType === 'download';
    const collectionName = isDownload ? 'user_downloads' : 'user_books';
    const recordRef = adminDb.collection(collectionName).doc(reference);
    const snap = await recordRef.get();

    const bookDoc = await adminDb.collection('books').doc(bookId).get();
    const bookCreatorId = bookDoc.exists ? bookDoc.data()?.creatorId || '' : '';
    if (!resolvedCreatorId) resolvedCreatorId = bookCreatorId;

    if (snap.exists) {
      alreadyProcessed = true;
    } else {
      const userRef = adminDb.collection('users').doc(uid);
      const field = isDownload ? 'downloadedBooks' : 'purchasedBooks';

      await userRef.set({
        [field]: FieldValue.arrayUnion(bookId),
      }, { merge: true });

      await recordRef.set({
        reference,
        userId: uid,
        bookId,
        creatorId: bookCreatorId,
        amount: amountGross,
        amountGross,
        amountNet,
        currency,
        purchasedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  // Idempotently record in the central 'transactions' collection
  try {
    const txRef = adminDb.collection('transactions').doc(reference);
    const txSnap = await txRef.get();
    if (!txSnap.exists) {
      await txRef.set({
        reference,
        amount: amountGross,
        amountGross,
        amountNet,
        currency,
        email: metadata.email || options.email || '',
        userId: uid,
        creatorId: resolvedCreatorId,
        type: resolvedType,
        itemId: resolvedItemId,
        itemTitle: metadata.itemTitle || metadata.title || '',
        status: 'success',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  } catch (txErr) {
    console.warn(`Non-fatal: failed to record transactions doc for ${reference}:`, txErr);
  }

  return {
    success: true,
    alreadyProcessed,
    type: resolvedType,
    amountGross,
    amountNet,
    currency,
    itemId: resolvedItemId,
  };
}
