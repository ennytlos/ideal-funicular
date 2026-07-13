// src/app/api/payment/verify/route.ts
// Paystack redirects here after payment. Verifies the transaction and grants access.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import { verifyTransaction } from '../../../../lib/paystack';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const reference = searchParams.get('ref');
  const uid       = searchParams.get('uid');
  const type      = searchParams.get('type') as 'read' | 'download' | 'tip' | 'series' | 'course' | 'outreach' | 'create_course' | null;

  if (!reference || !uid || !type) {
    return NextResponse.redirect(new URL('/payment/error?reason=error', request.url));
  }

  const getErrorRedirectUrl = (reason: 'failed' | 'error') => {
    const bookId = searchParams.get('bookId') || '';
    const seriesId = searchParams.get('seriesId') || '';
    const courseId = searchParams.get('courseId') || '';
    
    if (type === 'create_course') {
      return new URL(`/admin?tab=courses&payment=${reason}`, request.url);
    }
    if (type === 'tip') {
      // Tips redirect back to tip page for retry
      return new URL(`/tip?payment=${reason}`, request.url);
    }
    if (type === 'series') {
      // Series purchases redirect to error page
      return new URL(`/payment/error?reason=${reason}&type=${type}&seriesId=${seriesId}`, request.url);
    }
    if (type === 'course') {
      // Course purchases redirect to error page
      return new URL(`/payment/error?reason=${reason}&type=${type}&courseId=${courseId}`, request.url);
    }
    if (type === 'outreach') {
      // Outreach returns to admin panel
      return new URL(`/admin?payment=${reason}`, request.url);
    }
    // Book purchases redirect to error page
    return new URL(`/payment/error?reason=${reason}&type=${type}&bookId=${bookId}`, request.url);
  };

  try {
    // 1. Verify with Paystack
    const result = await verifyTransaction(reference);

    if (result.data.status !== 'success') {
      return NextResponse.redirect(getErrorRedirectUrl('failed'));
    }

    if (type === 'tip') {
      const amountStr = searchParams.get('amount') || '0';
      const message = searchParams.get('message') || '';
      const currencyStr = searchParams.get('currency') || 'NGN';

      // Get email from metadata or Firestore fallback
      let email = (result.data.metadata?.email as string) || '';
      if (!email && uid !== 'anonymous') {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        email = userDoc.exists ? userDoc.data()?.email || '' : '';
      }
      if (!email) {
        email = 'anonymous@noorlibrary.com';
      }

      // Record the tip in Firestore
      await adminDb.collection('tips').add({
        userId: uid,
        email: email,
        amount: parseFloat(amountStr),
        message: message,
        reference: reference,
        currency: currencyStr,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.redirect(new URL(`/tip?payment=success&amount=${amountStr}&currency=${currencyStr}`, request.url));
    } else if (type === 'series') {
      const seriesId = searchParams.get('seriesId');
      if (!seriesId) return NextResponse.redirect(getErrorRedirectUrl('error'));

      // 2. Grant access in Firestore
      const userRef = adminDb.collection('users').doc(uid);
      await userRef.update({
        purchasedSeries: FieldValue.arrayUnion(seriesId),
      });

      // 3. Log purchase record
      await adminDb.collection('user_series').add({
        userId: uid,
        seriesId,
        reference,
        amount: result.data.amount,
        currency: result.data.currency,
        purchasedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.redirect(new URL(`/payment/success?seriesId=${seriesId}&type=series`, request.url));
    } else if (type === 'course') {
      const courseId = searchParams.get('courseId');
      if (!courseId) return NextResponse.redirect(getErrorRedirectUrl('error'));

      // Fetch course from db to verify payment interval
      const courseDoc = await adminDb.collection('courses').doc(courseId).get();
      if (!courseDoc.exists) return NextResponse.redirect(getErrorRedirectUrl('error'));
      const courseData = courseDoc.data()!;
      const interval = courseData.paymentInterval || 'once';

      const userRef = adminDb.collection('users').doc(uid);

      if (interval === 'monthly' || interval === 'yearly') {
        const days = interval === 'monthly' ? 30 : 365;
        const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
        await userRef.set({
          subscriptions: {
            [courseId]: expiresAt
          }
        }, { merge: true });
      } else {
        await userRef.update({
          enrolledCourses: FieldValue.arrayUnion(courseId),
        });
      }

      await adminDb.collection('user_courses').add({
        userId: uid,
        courseId,
        reference,
        amount: result.data.amount,
        currency: result.data.currency,
        enrolledAt: FieldValue.serverTimestamp(),
        paymentInterval: interval
      });

      return NextResponse.redirect(new URL(`/payment/success?courseId=${courseId}&type=course`, request.url));
    } else if (type === 'create_course') {
      const courseId = searchParams.get('courseId');
      if (!courseId) return NextResponse.redirect(getErrorRedirectUrl('error'));

      // Use the VERIFIED amount from Paystack (in kobo) — never trust URL params for business logic
      // 10,000 NGN = 1,000,000 kobo → 100 MB plan; 5,000 NGN = 500,000 kobo → 50 MB plan
      const confirmedAmountKobo = result.data.amount as number; // Paystack always returns kobo
      const is100MBPlan = confirmedAmountKobo >= 1000000; // ≥ ₦10,000
      const sizeLimitBytes = is100MBPlan ? 100 * 1024 * 1024 : 50 * 1024 * 1024;

      await adminDb.collection('courses').doc(courseId).update({
        isPaid: true,
        maxContentSize: sizeLimitBytes,
        currentContentSize: 0,
        paymentStatus: 'paid'
      });

      return NextResponse.redirect(new URL(`/admin?tab=courses&payment=success`, request.url));
    } else if (type === 'outreach') {
      const metadata = result.data.metadata || {};
      const outreachTitle = metadata.outreachTitle || searchParams.get('outreachTitle') || 'Important Announcement';
      const outreachMessage = metadata.outreachMessage || searchParams.get('outreachMessage') || '';
      const outreachTarget = metadata.outreachTarget || searchParams.get('outreachTarget') || 'followers';
      const outreachContentId = metadata.outreachContentId || searchParams.get('outreachContentId') || 'followers';

      // Create notification entry
      const notifRef = adminDb.collection('notifications').doc();
      await notifRef.set({
        id: notifRef.id,
        senderId: uid,
        senderName: 'Content Creator',
        title: outreachTitle,
        message: outreachMessage,
        type: 'outreach',
        targetId: outreachTarget === 'followers' ? uid : outreachContentId,
        createdAt: Date.now()
      });

      return NextResponse.redirect(new URL(`/admin?tab=creator_outreach&payment=success`, request.url));
    } else {
      const bookId = searchParams.get('bookId');
      if (!bookId) return NextResponse.redirect(getErrorRedirectUrl('error'));

      // 2. Grant access in Firestore
      const userRef = adminDb.collection('users').doc(uid);
      const field = type === 'read' ? 'purchasedBooks' : 'downloadedBooks';

      await userRef.update({
        [field]: FieldValue.arrayUnion(bookId),
      });

      // 3. Log purchase record
      const collectionName = type === 'read' ? 'user_books' : 'user_downloads';
      await adminDb.collection(collectionName).add({
        userId: uid,
        bookId,
        reference,
        amount: result.data.amount,
        currency: result.data.currency,
        purchasedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.redirect(new URL(`/payment/success?bookId=${bookId}&type=${type}`, request.url));
    }
  } catch (err: any) {
    console.error("Payment verify handler error:", err);
    try {
      await adminDb.collection('failed_grants').add({
        reference: reference || 'unknown',
        uid: uid || 'unknown',
        type: type || 'unknown',
        error: err?.message || String(err),
        url: request.url,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (dbErr) {
      console.error("Failed to write to failed_grants collection:", dbErr);
    }
    return NextResponse.redirect(getErrorRedirectUrl('error'));
  }
}
