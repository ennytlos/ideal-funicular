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
  const type      = searchParams.get('type') as 'read' | 'download' | 'tip' | 'series' | null;

  if (!reference || !uid || !type) {
    return NextResponse.redirect(new URL('/payment/error?reason=error', request.url));
  }

  const getErrorRedirectUrl = (reason: 'failed' | 'error') => {
    const bookId = searchParams.get('bookId') || '';
    const seriesId = searchParams.get('seriesId') || '';
    
    if (type === 'tip') {
      // Tips redirect back to tip page for retry
      return new URL(`/tip?payment=${reason}`, request.url);
    }
    if (type === 'series') {
      // Series purchases redirect to error page
      return new URL(`/payment/error?reason=${reason}&type=${type}&seriesId=${seriesId}`, request.url);
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
  } catch {
    return NextResponse.redirect(getErrorRedirectUrl('error'));
  }
}
