// src/app/api/read/[bookId]/route.ts
// Returns a time-limited signed Bunny CDN URL for a purchased book's PDF.
// Only accessible to users who have the book in their purchasedBooks or downloadedBooks array.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '../../../../lib/firebase-admin';
import { adminDb } from '../../../../lib/firebase-admin';
import { getSignedUrl } from '../../../../lib/bunny';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;

  // 1. Auth check
  const token = request.cookies.get('noor_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const seriesId = searchParams.get('seriesId');

  let contentType: 'json' | 'pdf' = 'pdf';
  let filePath = '';
  let title = '';

  if (seriesId) {
    // 2a. Fetch series
    const seriesDoc = await adminDb.collection('series').doc(seriesId).get();
    if (!seriesDoc.exists) return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    
    const seriesData = seriesDoc.data()!;
    const episode = (seriesData.episodes || []).find((e: any) => e.id === bookId);
    if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 });

    const price = seriesData.price ?? 0;
    if (price > 0) {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      const userData = userDoc.data()!;
      const hasPurchased = (userData.purchasedSeries ?? []).includes(seriesId);
      if (!hasPurchased) return NextResponse.json({ error: 'Access denied — purchase this series first' }, { status: 403 });
    }

    contentType = episode.contentType || 'pdf';
    filePath = contentType === 'json' ? (episode.jsonPath ?? '') : (episode.pdfPath ?? '');
    title = episode.title;

  } else {
    // 2b. Fetch book
    const bookDoc = await adminDb.collection('books').doc(bookId).get();
    if (!bookDoc.exists) return NextResponse.json({ error: 'Book not found' }, { status: 404 });

    const bookData = bookDoc.data()!;
    contentType = bookData.contentType || 'pdf';
    filePath = contentType === 'json' ? (bookData.jsonPath ?? '') : (bookData.pdfPath ?? '');
    title = bookData.title;
    const price: number = bookData.price ?? 0;

    if (!filePath) return NextResponse.json({ error: 'No content available for this book' }, { status: 404 });

    if (price > 0) {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const userData = userDoc.data()!;
      const hasPurchased = (userData.purchasedBooks ?? []).includes(bookId);
      const hasDownload  = (userData.downloadedBooks ?? []).includes(bookId);

      if (!hasPurchased && !hasDownload) {
        return NextResponse.json({ error: 'Access denied — purchase this book first' }, { status: 403 });
      }
    }
  }

  if (!filePath) return NextResponse.json({ error: 'No content available' }, { status: 404 });

  // 5. Generate signed URL (1 hour expiry)
  const signedUrl = await getSignedUrl(filePath, 3600);

  // 6. Fetch from CDN on server-side to stream back (bypassing CORS)
  try {
    const pdfResponse = await fetch(signedUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: 'Failed to retrieve book content from CDN' }, { status: pdfResponse.status });
    }

    const isDownload = searchParams.get('download') === 'true';

    const headers = new Headers();
    if (contentType === 'json') {
      headers.set('Content-Type', 'application/json');
    } else {
      headers.set('Content-Type', 'application/pdf');
    }

    if (isDownload) {
      const safeTitle = (title ?? bookId).replace(/[^a-zA-Z0-9-_]/g, '_');
      const ext = contentType === 'json' ? 'json' : 'pdf';
      headers.set('Content-Disposition', `attachment; filename="${safeTitle}.${ext}"`);
    } else {
      headers.set('Content-Disposition', 'inline');
    }

    return new NextResponse(pdfResponse.body, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to stream book content: ' + err.message }, { status: 500 });
  }
}
