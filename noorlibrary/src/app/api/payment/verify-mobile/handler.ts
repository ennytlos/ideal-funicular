// src/app/api/payment/verify-mobile/handler.ts
// Secure server-side verification endpoint for Noor Library mobile app purchases.
// Validates Firebase Bearer ID Token and Paystack transaction, then server-grants content access.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, getAuthToken } from '../../../../lib/firebase-admin';
import { verifyTransaction } from '../../../../lib/paystack';
import { grantAccess } from '../../../../lib/payment-grants';

export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: missing Firebase authentication token' },
        { status: 401 },
      );
    }

    let authenticatedUid: string;
    let authenticatedEmail: string | undefined;

    try {
      const decoded = await adminAuth.verifyIdToken(token);
      authenticatedUid = decoded.uid;
      authenticatedEmail = decoded.email;
    } catch (authErr: any) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid or expired session token' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { reference, purchaseType, itemId } = body;

    if (!reference) {
      return NextResponse.json(
        { error: 'Missing transaction reference' },
        { status: 400 },
      );
    }

    // 1. Verify transaction status with Paystack API
    const paystackResult = await verifyTransaction(reference);

    if (paystackResult.data.status !== 'success') {
      return NextResponse.json(
        { error: `Payment failed or not complete (status: ${paystackResult.data.status})` },
        { status: 400 },
      );
    }

    // 2. Grant access idempotently server-side via Admin SDK
    const grantResult = await grantAccess({
      reference,
      uid: authenticatedUid,
      type: purchaseType,
      paystackResult,
      bookId: purchaseType !== 'course' && purchaseType !== 'series' ? itemId : undefined,
      courseId: purchaseType === 'course' ? itemId : undefined,
      seriesId: purchaseType === 'series' ? itemId : undefined,
      email: authenticatedEmail,
    });

    return NextResponse.json({
      success: true,
      alreadyProcessed: grantResult.alreadyProcessed,
      type: grantResult.type,
      itemId: grantResult.itemId,
      amountGross: grantResult.amountGross,
      currency: grantResult.currency,
      message: 'Payment verified and access granted successfully.',
    });
  } catch (err: any) {
    console.error('Error in mobile payment verification:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while verifying mobile payment' },
      { status: 500 },
    );
  }
}
