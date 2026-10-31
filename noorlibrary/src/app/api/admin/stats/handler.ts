// src/app/api/admin/stats/route.ts
// Secure admin-only API to fetch real stats and activities from Firestore.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

export async function GET(request: NextRequest) {
  // 1. Authenticate check via cookie
  const token = request.cookies.get('noor_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // 2. Authorize role check (must be admin)
  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // 3. Fetch books to map price details
    const booksSnap = await adminDb.collection('books').get();
    const booksMap: Record<string, { title: string; price: number; downloadPrice: number }> = {};
    const bookStats: Record<string, { sales: number; downloads: number; revenue: number }> = {};

    booksSnap.docs.forEach((doc) => {
      const data = doc.data();
      const price = data.price ?? 0;
      const downloadPrice = data.downloadPrice ?? 0;
      
      booksMap[doc.id] = {
        title: data.title ?? 'Unknown Book',
        price,
        downloadPrice,
      };

      bookStats[doc.id] = {
        sales: 0,
        downloads: 0,
        revenue: 0,
      };
    });

    // 4. Fetch sales, downloads, and tips
    const userBooksSnap = await adminDb.collection('user_books').get();
    const userDownloadsSnap = await adminDb.collection('user_downloads').get();
    const tipsSnap = await adminDb.collection('tips').get();

    // 5. Calculate stats and book-by-book analytics
    let totalSalesRevenue = 0;
    let totalDownloadsRevenue = 0;
    let totalTipsRevenue = 0;

    const activities: Array<{
      type: 'purchase' | 'download' | 'tip';
      title: string;
      amount: number;
      timestamp: number;
      dateStr: string;
    }> = [];

    // Parse user_books
    userBooksSnap.docs.forEach((doc) => {
      const data = doc.data();
      const bookId = data.bookId;
      const purchasedAt = data.purchasedAt?.toDate() || new Date();
      
      if (booksMap[bookId]) {
        const book = booksMap[bookId];
        totalSalesRevenue += book.price;
        
        if (bookStats[bookId]) {
          bookStats[bookId].sales += 1;
          bookStats[bookId].revenue += book.price;
        }

        activities.push({
          type: 'purchase',
          title: `Purchase: ${book.title}`,
          amount: book.price,
          timestamp: purchasedAt.getTime(),
          dateStr: purchasedAt.toLocaleString(),
        });
      }
    });

    // Parse user_downloads
    userDownloadsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const bookId = data.bookId;
      const purchasedAt = data.purchasedAt?.toDate() || new Date();

      if (booksMap[bookId]) {
        const book = booksMap[bookId];
        totalDownloadsRevenue += book.downloadPrice;

        if (bookStats[bookId]) {
          bookStats[bookId].downloads += 1;
          bookStats[bookId].revenue += book.downloadPrice;
        }

        activities.push({
          type: 'download',
          title: `Download Purchase: ${book.title}`,
          amount: book.downloadPrice,
          timestamp: purchasedAt.getTime(),
          dateStr: purchasedAt.toLocaleString(),
        });
      }
    });

    // Parse tips
    tipsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const amount = data.amount ?? 0;
      const createdAt = data.createdAt?.toDate() || new Date();
      const message = data.message || 'Support Noor Library';

      totalTipsRevenue += amount;

      activities.push({
        type: 'tip',
        title: `Tip: "${message}"`,
        amount,
        timestamp: createdAt.getTime(),
        dateStr: createdAt.toLocaleString(),
      });
    });

    // Sort activities by timestamp descending (newest first)
    activities.sort((a, b) => b.timestamp - a.timestamp);

    // Limit to 20 recent activities
    const recentActivity = activities.slice(0, 20);

    return NextResponse.json({
      stats: {
        totalRevenue: totalSalesRevenue + totalDownloadsRevenue + totalTipsRevenue,
        bookSales: totalSalesRevenue + totalDownloadsRevenue,
        totalTips: totalTipsRevenue,
      },
      recentActivity,
      bookStats,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to compile stats: ' + errorMessage }, { status: 500 });
  }
}
