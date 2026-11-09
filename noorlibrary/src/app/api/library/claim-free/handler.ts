// src/app/api/library/claim-free/handler.ts
// Secure endpoint to claim free books, series, or courses into a user's cloud account.
// Verifies that the requested item is genuinely free (price === 0) before granting access via Admin SDK.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, getAuthToken } from '../../../../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: missing authentication token' },
        { status: 401 },
      );
    }

    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized: invalid or expired session token' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { type, itemId } = body;

    if (!itemId || !type) {
      return NextResponse.json(
        { error: 'Missing type or itemId' },
        { status: 400 },
      );
    }

    const userRef = adminDb.collection('users').doc(uid);

    if (type === 'book' || type === 'read') {
      const bookDoc = await adminDb.collection('books').doc(itemId).get();
      if (!bookDoc.exists) {
        return NextResponse.json({ error: 'Book not found' }, { status: 404 });
      }
      const bookData = bookDoc.data()!;
      const price = Number(bookData.price) || 0;
      if (price > 0) {
        return NextResponse.json(
          { error: 'Cannot claim paid book without purchase' },
          { status: 403 },
        );
      }

      await Promise.all([
        userRef.set(
          { purchasedBooks: FieldValue.arrayUnion(itemId) },
          { merge: true },
        ),
        adminDb.collection('user_books').doc(`${uid}_${itemId}`).set(
          {
            userId: uid,
            bookId: itemId,
            creatorId: bookData.creatorId || '',
            claimedFree: true,
            purchasedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Free book added to your cloud library',
        type: 'book',
        itemId,
      });
    }

    if (type === 'download') {
      const bookDoc = await adminDb.collection('books').doc(itemId).get();
      if (!bookDoc.exists) {
        return NextResponse.json({ error: 'Book not found' }, { status: 404 });
      }
      const bookData = bookDoc.data()!;
      const downloadPrice = Number(bookData.downloadPrice) || 0;
      if (downloadPrice > 0) {
        return NextResponse.json(
          { error: 'Cannot claim paid download without purchase' },
          { status: 403 },
        );
      }

      await Promise.all([
        userRef.set(
          { downloadedBooks: FieldValue.arrayUnion(itemId) },
          { merge: true },
        ),
        adminDb.collection('user_downloads').doc(`${uid}_${itemId}`).set(
          {
            userId: uid,
            bookId: itemId,
            creatorId: bookData.creatorId || '',
            claimedFree: true,
            downloadedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Free download added to your cloud library',
        type: 'download',
        itemId,
      });
    }

    if (type === 'series') {
      const seriesDoc = await adminDb.collection('series').doc(itemId).get();
      if (!seriesDoc.exists) {
        return NextResponse.json({ error: 'Series not found' }, { status: 404 });
      }
      const seriesData = seriesDoc.data()!;
      const price = Number(seriesData.price) || 0;
      if (price > 0) {
        return NextResponse.json(
          { error: 'Cannot claim paid series without purchase' },
          { status: 403 },
        );
      }

      await Promise.all([
        userRef.set(
          { purchasedSeries: FieldValue.arrayUnion(itemId) },
          { merge: true },
        ),
        adminDb.collection('user_series').doc(`${uid}_${itemId}`).set(
          {
            userId: uid,
            seriesId: itemId,
            creatorId: seriesData.creatorId || '',
            claimedFree: true,
            purchasedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Free series added to your cloud library',
        type: 'series',
        itemId,
      });
    }

    if (type === 'course') {
      const courseDoc = await adminDb.collection('courses').doc(itemId).get();
      if (!courseDoc.exists) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      }
      const courseData = courseDoc.data()!;
      const price = Number(courseData.price) || 0;
      // Note: courseData.isPaid indicates the creator's course slot is active/published, NOT that the course costs money!
      if (price > 0) {
        return NextResponse.json(
          { error: 'Cannot enroll in paid course without purchase' },
          { status: 403 },
        );
      }

      await Promise.all([
        userRef.set(
          { enrolledCourses: FieldValue.arrayUnion(itemId) },
          { merge: true },
        ),
        adminDb.collection('user_courses').doc(`${uid}_${itemId}`).set(
          {
            userId: uid,
            courseId: itemId,
            creatorId: courseData.creatorId || '',
            claimedFree: true,
            enrolledAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Free course enrolled successfully',
        type: 'course',
        itemId,
      });
    }

    return NextResponse.json({ error: 'Unknown item type' }, { status: 400 });
  } catch (error: any) {
    console.error('Error claiming free content:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error while claiming free content' },
      { status: 500 },
    );
  }
}
