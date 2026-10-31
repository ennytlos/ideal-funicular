// src/app/api/admin/donations/handler.ts
// Secure Admin API to fetch, audit, and verify Paystack donations and transaction ledger records.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../../lib/firebase-admin';
import { verifyTransaction } from '../../../../lib/paystack';
import type { AuditTransaction, LedgerStats } from '../../../../types/ledger';

export type { AuditTransaction, LedgerStats };

function resolveIsoDate(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (typeof val === 'number') return new Date(val).toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export async function GET(request: NextRequest) {
  // 1. Authenticate check via cookie or Authorization header
  let token = request.cookies.get('noor_token')?.value;
  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1];
    }
  }

  if (!token) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
  }

  // 2. Authorize role check (must be admin)
  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    // 3. Pre-fetch Books and Users maps to enrich transaction records
    const [booksSnap, usersSnap] = await Promise.all([
      adminDb.collection('books').get().catch(() => null),
      adminDb.collection('users').get().catch(() => null),
    ]);

    const booksMap: Record<string, { title: string; price: number; downloadPrice: number }> = {};
    if (booksSnap) {
      booksSnap.docs.forEach((doc) => {
        const d = doc.data();
        booksMap[doc.id] = {
          title: d.title || 'Untitled Book',
          price: d.price ?? 0,
          downloadPrice: d.downloadPrice ?? 0,
        };
      });
    }

    const usersMap: Record<string, { email: string; displayName: string }> = {};
    if (usersSnap) {
      usersSnap.docs.forEach((doc) => {
        const d = doc.data();
        usersMap[doc.id] = {
          email: d.email || '',
          displayName: d.displayName || d.societyName || '',
        };
      });
    }

    // 4. Fetch all payment-related collections including transactions (D1 fix)
    const [
      tipsSnap,
      transactionsSnap,
      userBooksSnap,
      userDownloadsSnap,
      userSeriesSnap,
      userCoursesSnap,
      failedGrantsSnap,
    ] = await Promise.all([
      adminDb.collection('tips').get().catch(() => null),
      adminDb.collection('transactions').get().catch(() => null),
      adminDb.collection('user_books').get().catch(() => null),
      adminDb.collection('user_downloads').get().catch(() => null),
      adminDb.collection('user_series').get().catch(() => null),
      adminDb.collection('user_courses').get().catch(() => null),
      adminDb.collection('failed_grants').get().catch(() => null),
    ]);

    const seenRefs = new Set<string>();
    const donations: AuditTransaction[] = [];
    const otherTransactions: AuditTransaction[] = [];

    // Helper: Parse gross and net amount accurately without guessing (D2 + D3 fix)
    const resolveAmounts = (d: any, defaultNetIfGrossOnly = false): { gross: number; net: number } => {
      let gross = 0;
      let net = 0;

      if (typeof d.amountGross === 'number') {
        gross = d.amountGross;
        net = typeof d.amountNet === 'number' ? d.amountNet : gross;
      } else if (typeof d.amountKobo === 'number') {
        gross = d.amountKobo / 100;
        net = typeof d.amountNet === 'number' ? d.amountNet : gross;
      } else if (typeof d.amount === 'number') {
        // Tips legacy stored standard amount (naira). Legacy user_* stored Paystack amount in kobo.
        gross = d.amount;
        net = d.amount;
      }

      return {
        gross: Math.max(0, gross),
        net: Math.max(0, net),
      };
    };

    // 4.1 Process Tips (Donations)
    if (tipsSnap) {
      tipsSnap.docs.forEach((doc) => {
        const data = doc.data();
        const ref = data.reference || doc.id;
        if (ref && ref !== 'N/A') seenRefs.add(ref);

        const amounts = resolveAmounts(data);
        let email = data.email;
        if (!email && data.userId && usersMap[data.userId]?.email) {
          email = usersMap[data.userId].email;
        }

        donations.push({
          id: doc.id,
          type: 'donation',
          donorEmail: email || 'anonymous@noorlibrary.com.ng',
          userId: data.userId || 'anonymous',
          amount: amounts.gross,
          amountGross: amounts.gross,
          amountNet: amounts.net,
          currency: data.currency || 'NGN',
          reference: ref,
          description: 'Support & Donation to Noor Library',
          message: data.message || 'Support Noor Library',
          createdAt: resolveIsoDate(data.createdAt),
          status: 'success',
          channel: 'Paystack',
        });
      });
    }

    // 4.2 Process Central Transactions (Mobile & Web verified transactions - D1 fix)
    if (transactionsSnap) {
      transactionsSnap.docs.forEach((doc) => {
        const d = doc.data();
        const ref = d.reference || doc.id;

        // Skip if already recorded from tips
        if (ref && seenRefs.has(ref)) return;
        if (ref && ref !== 'N/A') seenRefs.add(ref);

        const amounts = resolveAmounts(d);
        const rawType = (d.type || 'purchase').toLowerCase();
        let normalizedType: AuditTransaction['type'] = 'book_purchase';

        if (rawType === 'tip' || rawType === 'donation') {
          normalizedType = 'donation';
        } else if (rawType === 'course') {
          normalizedType = 'course_enrollment';
        } else if (rawType === 'series') {
          normalizedType = 'series_purchase';
        } else if (rawType === 'download') {
          normalizedType = 'download_purchase';
        }

        const email = d.email || usersMap[d.userId]?.email || 'user@noorlibrary.com.ng';
        const title = d.itemTitle || booksMap[d.itemId]?.title || d.itemId || 'Platform Purchase';

        const record: AuditTransaction = {
          id: doc.id,
          type: normalizedType,
          donorEmail: email,
          userId: d.userId || '',
          amount: amounts.gross,
          amountGross: amounts.gross,
          amountNet: amounts.net,
          currency: d.currency || 'NGN',
          reference: ref,
          description: d.description || `${normalizedType.replace('_', ' ').toUpperCase()}: ${title}`,
          createdAt: resolveIsoDate(d.createdAt),
          status: d.status === 'failed' ? 'failed' : 'success',
          channel: 'Paystack (Mobile/App)',
        };

        if (normalizedType === 'donation') {
          donations.push(record);
        } else {
          otherTransactions.push(record);
        }
      });
    }

    // 4.3 Process Legacy user_books (if not already recorded via transactions)
    if (userBooksSnap) {
      userBooksSnap.docs.forEach((doc) => {
        const d = doc.data();
        const ref = d.reference || doc.id;
        if (ref && seenRefs.has(ref)) return;
        if (ref && ref !== 'N/A') seenRefs.add(ref);

        const bookInfo = booksMap[d.bookId];
        const email = usersMap[d.userId]?.email || 'user@noorlibrary.com.ng';
        let amounts = resolveAmounts(d);
        if (amounts.gross === 0 && bookInfo?.price) {
          amounts = { gross: bookInfo.price, net: bookInfo.price };
        } else if (amounts.gross >= 10000 && !d.amountGross) {
          // Legacy Paystack kobo
          amounts = { gross: amounts.gross / 100, net: amounts.net / 100 };
        }

        otherTransactions.push({
          id: doc.id,
          type: 'book_purchase',
          donorEmail: email,
          userId: d.userId || '',
          amount: amounts.gross,
          amountGross: amounts.gross,
          amountNet: amounts.net,
          currency: d.currency || 'NGN',
          reference: ref,
          description: `Book Purchase: ${bookInfo?.title || d.bookId || 'Islamic Book'}`,
          createdAt: resolveIsoDate(d.purchasedAt),
          status: 'success',
          channel: 'Paystack',
        });
      });
    }

    // 4.4 Process Legacy user_downloads
    if (userDownloadsSnap) {
      userDownloadsSnap.docs.forEach((doc) => {
        const d = doc.data();
        const ref = d.reference || doc.id;
        if (ref && seenRefs.has(ref)) return;
        if (ref && ref !== 'N/A') seenRefs.add(ref);

        const bookInfo = booksMap[d.bookId];
        const email = usersMap[d.userId]?.email || 'user@noorlibrary.com.ng';
        let amounts = resolveAmounts(d);
        if (amounts.gross === 0 && bookInfo?.downloadPrice) {
          amounts = { gross: bookInfo.downloadPrice, net: bookInfo.downloadPrice };
        } else if (amounts.gross >= 10000 && !d.amountGross) {
          amounts = { gross: amounts.gross / 100, net: amounts.net / 100 };
        }

        otherTransactions.push({
          id: doc.id,
          type: 'download_purchase',
          donorEmail: email,
          userId: d.userId || '',
          amount: amounts.gross,
          amountGross: amounts.gross,
          amountNet: amounts.net,
          currency: d.currency || 'NGN',
          reference: ref,
          description: `PDF Download Access: ${bookInfo?.title || d.bookId || 'Islamic Book'}`,
          createdAt: resolveIsoDate(d.purchasedAt),
          status: 'success',
          channel: 'Paystack',
        });
      });
    }

    // 4.5 Process Legacy user_series
    if (userSeriesSnap) {
      userSeriesSnap.docs.forEach((doc) => {
        const d = doc.data();
        const ref = d.reference || doc.id;
        if (ref && seenRefs.has(ref)) return;
        if (ref && ref !== 'N/A') seenRefs.add(ref);

        const email = usersMap[d.userId]?.email || 'user@noorlibrary.com.ng';
        let amounts = resolveAmounts(d);
        if (amounts.gross >= 10000 && !d.amountGross) {
          amounts = { gross: amounts.gross / 100, net: amounts.net / 100 };
        }

        otherTransactions.push({
          id: doc.id,
          type: 'series_purchase',
          donorEmail: email,
          userId: d.userId || '',
          amount: amounts.gross,
          amountGross: amounts.gross,
          amountNet: amounts.net,
          currency: d.currency || 'NGN',
          reference: ref,
          description: `Series Purchase: ${d.seriesId || 'Islamic Series'}`,
          createdAt: resolveIsoDate(d.purchasedAt),
          status: 'success',
          channel: 'Paystack',
        });
      });
    }

    // 4.6 Process Legacy user_courses
    if (userCoursesSnap) {
      userCoursesSnap.docs.forEach((doc) => {
        const d = doc.data();
        const ref = d.reference || doc.id;
        if (ref && seenRefs.has(ref)) return;
        if (ref && ref !== 'N/A') seenRefs.add(ref);

        const email = usersMap[d.userId]?.email || 'user@noorlibrary.com.ng';
        let amounts = resolveAmounts(d);
        if (amounts.gross >= 10000 && !d.amountGross) {
          amounts = { gross: amounts.gross / 100, net: amounts.net / 100 };
        }

        otherTransactions.push({
          id: doc.id,
          type: 'course_enrollment',
          donorEmail: email,
          userId: d.userId || '',
          amount: amounts.gross,
          amountGross: amounts.gross,
          amountNet: amounts.net,
          currency: d.currency || 'NGN',
          reference: ref,
          description: `Course Enrollment: ${d.courseId || 'Islamic Course'} (${d.paymentInterval || 'once'})`,
          createdAt: resolveIsoDate(d.enrolledAt),
          status: 'success',
          channel: 'Paystack',
        });
      });
    }

    // 4.7 Process failed grants
    if (failedGrantsSnap) {
      failedGrantsSnap.docs.forEach((doc) => {
        const d = doc.data();
        otherTransactions.push({
          id: doc.id,
          type: 'failed_grant',
          donorEmail: usersMap[d.uid]?.email || 'unknown@user.com',
          userId: d.uid || 'unknown',
          amount: 0,
          amountGross: 0,
          amountNet: 0,
          currency: 'NGN',
          reference: d.reference || 'N/A',
          description: `Failed Payment Grant: ${d.error || 'Verification issue'} (${d.type || 'unknown'})`,
          createdAt: resolveIsoDate(d.createdAt),
          status: 'failed',
          channel: 'Paystack',
        });
      });
    }

    // 5. Sort descending by date
    donations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const allTransactions = [...donations, ...otherTransactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // 6. Compute accurate ledger statistics (D4 fix: real counts, no hard-coded 100%)
    const totalDonationsRevenue = donations.reduce((sum, item) => sum + (item.amountGross ?? item.amount ?? 0), 0);
    const totalDonationsNet = donations.reduce((sum, item) => sum + (item.amountNet ?? item.amountGross ?? item.amount ?? 0), 0);
    const uniqueDonors = new Set(donations.map((item) => item.donorEmail.toLowerCase())).size;
    const avgDonation = donations.length > 0 ? Math.round(totalDonationsRevenue / donations.length) : 0;

    const successfulTransactions = allTransactions.filter((t) => t.status === 'success');
    const totalOverallRevenue = successfulTransactions.reduce((sum, item) => sum + (item.amountGross ?? item.amount ?? 0), 0);
    const totalOverallNet = successfulTransactions.reduce((sum, item) => sum + (item.amountNet ?? item.amountGross ?? item.amount ?? 0), 0);

    const successCount = successfulTransactions.length;
    const failedCount = allTransactions.filter((t) => t.status === 'failed').length;
    const totalVerifiable = successCount + failedCount;
    const successRate = totalVerifiable > 0 ? Math.round((successCount / totalVerifiable) * 100) : 100;

    const stats: LedgerStats = {
      totalDonationsRevenue,
      totalDonationsNet,
      donationsCount: donations.length,
      uniqueDonors,
      avgDonation,
      totalOverallRevenue,
      totalOverallNet,
      totalTransactionsCount: allTransactions.length,
      successCount,
      failedCount,
      successRate,
    };

    return NextResponse.json({
      donations,
      allTransactions,
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching admin donations ledger:', error);
    return NextResponse.json({ error: 'Failed to compile donations ledger: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Live audit & verify a specific Paystack reference code
  let token = request.cookies.get('noor_token')?.value;
  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1];
    }
  }

  if (!token) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const reference = body?.reference;
    if (!reference) {
      return NextResponse.json({ error: 'Missing Paystack reference to verify' }, { status: 400 });
    }

    const paystackResult = await verifyTransaction(reference);
    return NextResponse.json({
      success: true,
      data: paystackResult,
    });
  } catch (err: any) {
    console.error('Error verifying Paystack reference:', err);
    return NextResponse.json({ error: err.message || 'Failed to verify transaction with Paystack' }, { status: 500 });
  }
}
