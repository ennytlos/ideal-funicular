// src/app/api/payment/initialize/route.ts
// Creates a Paystack transaction for purchasing a book (read access or PDF download).

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '../../../../lib/firebase-admin';
import { adminDb } from '../../../../lib/firebase-admin';
import { initializeTransaction, generateReference } from '../../../../lib/paystack';

function calculateGrossAmount(netAmount: number, currency: string): number {
  if (currency === 'NGN') {
    // Paystack local fee: 1.5% + NGN 100
    // Waived NGN 100 flat fee for transactions under NGN 2,500
    // Capped at NGN 2,000 fee (which occurs when fee would be >= 2000, i.e. net amount >= 124,666.67)
    if (netAmount >= 124666.67) {
      return netAmount + 2000;
    }
    // Check if the transaction with the flat fee is under 2500.
    // If netAmount / 0.985 < 2500, then it is under 2500 and flat fee is waived.
    // netAmount < 2500 * 0.985 = 2462.5
    if (netAmount < 2462.5) {
      return Math.ceil((netAmount / 0.985) * 100) / 100;
    }
    // Otherwise, with flat fee of 100
    return Math.ceil(((netAmount + 100) / 0.985) * 100) / 100;
  } else {
    // International fee: 3.9% (no flat fee / cap in transaction currency)
    return Math.ceil((netAmount / 0.961) * 100) / 100;
  }
}

export async function POST(request: NextRequest) {
  // 1. Optional Auth check (allow anonymous tips)
  const token = request.cookies.get('noor_token')?.value;
  let uid = 'anonymous';
  let email = '';

  if (token) {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
      email = decoded.email ?? '';
    } catch {
      // Non-fatal — invalid token behaves as anonymous
    }
  }

  // 2. Parse request
  const body = await request.json() as { 
    bookId?: string; 
    seriesId?: string;
    courseId?: string;
    type: 'read' | 'download' | 'tip' | 'series' | 'course' | 'outreach' | 'create_course'; 
    amount?: number; 
    message?: string; 
    email?: string;
    currency?: string;
    outreachTarget?: string;
    outreachContentId?: string;
    outreachTitle?: string;
    outreachMessage?: string;
  };
  const { bookId, seriesId, courseId, type, amount, message, currency } = body;
  if (!type) return NextResponse.json({ error: 'Missing type' }, { status: 400 });

  // Require authentication for book, series, course and outreach purchases
  if (type !== 'tip' && uid === 'anonymous') {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let amountPrice = 0;
  let callbackUrl = '';
  let metadata: Record<string, unknown> = {};

  const appUrl = (() => {
    const host = request.headers.get('host') ?? 'localhost:3000';
    const proto = host.startsWith('localhost') ? 'http' : 'https';
    return `${proto}://${host}`;
  })();
  const reference = generateReference('noor');

  // Handle default currencies
  const defaultStoreCurrency = process.env.NEXT_PUBLIC_PAYSTACK_CURRENCY ?? 'NGN';
  const currencyVal = type === 'tip' ? (currency || 'NGN') : defaultStoreCurrency;

  if (type === 'tip') {
    const minAmount = currencyVal === 'NGN' ? 2000 : 5;
    if (!amount || amount < minAmount) {
      return NextResponse.json({ error: `Minimum tip amount for ${currencyVal} is ${minAmount}` }, { status: 400 });
    }
    email = email || body.email || 'anonymous@noorlibrary.com';
    amountPrice = amount;
    callbackUrl = `${appUrl}/api/payment/verify?ref=${reference}&uid=${uid}&amount=${amount}&type=tip&currency=${currencyVal}&message=${encodeURIComponent(message || '')}`;
    metadata = { uid, type: 'tip', amount, message, email };
  } else if (type === 'series') {
    if (!seriesId) return NextResponse.json({ error: 'Missing seriesId' }, { status: 400 });

    // 3. Fetch series to get price
    const seriesDoc = await adminDb.collection('series').doc(seriesId).get();
    if (!seriesDoc.exists) return NextResponse.json({ error: 'Series not found' }, { status: 404 });

    const seriesData = seriesDoc.data()!;
    amountPrice = seriesData.price || 0;

    if (amountPrice <= 0) {
      return NextResponse.json({ error: 'This series is free — no payment needed' }, { status: 400 });
    }
    callbackUrl = `${appUrl}/api/payment/verify?ref=${reference}&uid=${uid}&seriesId=${seriesId}&type=${type}`;
    metadata = { uid, seriesId, type, seriesTitle: seriesData.title };
  } else if (type === 'course') {
    if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });

    // 3. Fetch course to get price
    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const courseData = courseDoc.data()!;
    amountPrice = courseData.price || 0;

    if (amountPrice <= 0) {
      return NextResponse.json({ error: 'This course is free — no payment needed' }, { status: 400 });
    }
    callbackUrl = `${appUrl}/api/payment/verify?ref=${reference}&uid=${uid}&courseId=${courseId}&type=${type}`;
    metadata = { uid, courseId, type, courseTitle: courseData.title };
  } else if (type === 'create_course') {
    if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
    if (!amount || (amount !== 5000 && amount !== 10000)) {
      return NextResponse.json({ error: 'Invalid amount for course creation fee' }, { status: 400 });
    }
    
    // Check if course exists
    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    const courseData = courseDoc.data()!;
    if (courseData.creatorId !== uid) {
      return NextResponse.json({ error: 'Unauthorised course owner' }, { status: 403 });
    }
    if (courseData.isPaid) {
      return NextResponse.json({ error: 'Course is already paid' }, { status: 400 });
    }

    amountPrice = amount;
    email = email || body.email || 'creator@noorlibrary.com';
    callbackUrl = `${appUrl}/api/payment/verify?ref=${reference}&uid=${uid}&courseId=${courseId}&type=${type}&amount=${amount}`;
    metadata = { uid, courseId, type, amount, courseTitle: courseData.title };
  } else if (type === 'outreach') {
    if (!amount) return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
    amountPrice = amount;
    email = email || body.email || 'creator@noorlibrary.com';
    callbackUrl = `${appUrl}/api/payment/verify?ref=${reference}&uid=${uid}&type=${type}&outreachTitle=${encodeURIComponent(body.outreachTitle || '')}&outreachMessage=${encodeURIComponent(body.outreachMessage || '')}&outreachTarget=${body.outreachTarget || 'followers'}&outreachContentId=${body.outreachContentId || 'followers'}`;
    metadata = { 
      uid, 
      type, 
      outreachTitle: body.outreachTitle || '', 
      outreachMessage: body.outreachMessage || '', 
      outreachTarget: body.outreachTarget || 'followers', 
      outreachContentId: body.outreachContentId || 'followers' 
    };
  } else {
    if (!bookId) return NextResponse.json({ error: 'Missing bookId' }, { status: 400 });

    // 3. Fetch book to get price
    const bookDoc = await adminDb.collection('books').doc(bookId).get();
    if (!bookDoc.exists) return NextResponse.json({ error: 'Book not found' }, { status: 404 });

    const book = bookDoc.data()!;
    amountPrice = type === 'read' ? book.price : book.downloadPrice;

    if (amountPrice <= 0) {
      return NextResponse.json({ error: 'This book is free — no payment needed' }, { status: 400 });
    }
    callbackUrl = `${appUrl}/api/payment/verify?ref=${reference}&uid=${uid}&bookId=${bookId}&type=${type}`;
    metadata = { uid, bookId, type, bookTitle: book.title };
  }

  // Calculate gross amount where payer bears gateway charges
  const grossAmount = calculateGrossAmount(amountPrice, currencyVal);

  // Paystack amounts are in the smallest unit (kobo/cents = × 100)
  const multiplier = 100;
  const amountSmallest = Math.round(grossAmount * multiplier);

  const result = await initializeTransaction({
    email,
    amountKobo: amountSmallest,
    reference,
    callbackUrl,
    metadata,
    currency: currencyVal,
  });

  if (!result.status) {
    return NextResponse.json({ error: 'Paystack init failed' }, { status: 500 });
  }

  return NextResponse.json({ url: result.data.authorization_url, reference });
}
