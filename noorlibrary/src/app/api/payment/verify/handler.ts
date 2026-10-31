// src/app/api/payment/verify/handler.ts
// Paystack redirects here after payment. Verifies the transaction and idempotently grants access.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import { verifyTransaction } from '../../../../lib/paystack';
import { grantAccess } from '../../../../lib/payment-grants';
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

    // 2. Execute idempotent grant and audit logging
    const grantResult = await grantAccess({
      reference,
      uid,
      type,
      paystackResult: result,
      bookId: searchParams.get('bookId'),
      seriesId: searchParams.get('seriesId'),
      courseId: searchParams.get('courseId'),
      message: searchParams.get('message'),
      currency: searchParams.get('currency'),
      outreachTitle: searchParams.get('outreachTitle'),
      outreachMessage: searchParams.get('outreachMessage'),
      outreachTarget: searchParams.get('outreachTarget'),
      outreachContentId: searchParams.get('outreachContentId'),
    });

    if (type === 'tip') {
      return NextResponse.redirect(
        new URL(`/tip?payment=success&amount=${grantResult.amountGross}&currency=${grantResult.currency}`, request.url)
      );
    } else if (type === 'series') {
      const seriesId = searchParams.get('seriesId') || grantResult.itemId;
      return NextResponse.redirect(new URL(`/payment/success?seriesId=${seriesId}&type=series`, request.url));
    } else if (type === 'course') {
      const courseId = searchParams.get('courseId') || grantResult.itemId;
      return NextResponse.redirect(new URL(`/payment/success?courseId=${courseId}&type=course`, request.url));
    } else if (type === 'create_course') {
      return NextResponse.redirect(new URL(`/admin?tab=courses&payment=success`, request.url));
    } else if (type === 'outreach') {
      return NextResponse.redirect(new URL(`/admin?tab=creator_outreach&payment=success`, request.url));
    } else {
      const bookId = searchParams.get('bookId') || grantResult.itemId;
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
