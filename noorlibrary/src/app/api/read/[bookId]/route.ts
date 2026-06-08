// src/app/api/read/[bookId]/route.ts
// Returns a time-limited signed Bunny CDN URL for a purchased book's PDF.
// Only accessible to users who have the book in their purchasedBooks or downloadedBooks array.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '../../../../lib/firebase-admin';
import { adminDb } from '../../../../lib/firebase-admin';
import { getSignedUrl, getCdnUrl } from '../../../../lib/bunny';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  const { searchParams } = new URL(request.url);
  const seriesId = searchParams.get('seriesId');

  let contentType: 'json' | 'pdf' = 'pdf';
  let filePath = '';
  let title = '';
  let isSecure = true;

  // 1. Fetch metadata first to check isSecure
  if (seriesId) {
    const seriesDoc = await adminDb.collection('series').doc(seriesId).get();
    if (!seriesDoc.exists) return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    
    const seriesData = seriesDoc.data()!;
    const episode = (seriesData.episodes || []).find((e: { id?: string }) => e.id === bookId);
    if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 });

    contentType = episode.contentType || 'pdf';
    filePath = contentType === 'json' ? (episode.jsonPath ?? '') : (episode.pdfPath ?? '');
    title = episode.title;
    isSecure = episode.isSecure !== false;

    // 2a. If secure, perform auth and purchase verification
    if (isSecure) {
      const token = request.cookies.get('noor_token')?.value;
      if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

      let uid: string;
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }

      const price = seriesData.price ?? 0;
      if (price > 0) {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        const userData = userDoc.data()!;
        const hasPurchased = (userData.purchasedSeries ?? []).includes(seriesId);
        if (!hasPurchased) return NextResponse.json({ error: 'Access denied — purchase this series first' }, { status: 403 });
      }
    }

  } else {
    const bookDoc = await adminDb.collection('books').doc(bookId).get();
    if (!bookDoc.exists) return NextResponse.json({ error: 'Book not found' }, { status: 404 });

    const bookData = bookDoc.data()!;
    contentType = bookData.contentType || 'pdf';
    filePath = contentType === 'json' ? (bookData.jsonPath ?? '') : (bookData.pdfPath ?? '');
    title = bookData.title;
    isSecure = bookData.isSecure !== false;
    const price: number = bookData.price ?? 0;

    if (!filePath) return NextResponse.json({ error: 'No content available for this book' }, { status: 404 });

    // 2b. If secure, perform auth and purchase verification
    if (isSecure) {
      const token = request.cookies.get('noor_token')?.value;
      if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

      let uid: string;
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }

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
  }

  if (!filePath) return NextResponse.json({ error: 'No content available' }, { status: 404 });

  // 3. For PDF files, return direct URL (signed if secure, plain if insecure) to client.
  // This bypasses Vercel Serverless Function response size limits.
  // Requires CORS configured on the Bunny CDN Pull Zone (Access-Control-Allow-Origin: *).
  if (contentType === 'pdf') {
    const signedUrl = isSecure 
      ? await getSignedUrl(filePath, 3600)
      : getCdnUrl(filePath);
    return NextResponse.json({ url: signedUrl });
  }

  // 4. Generate signed URL (1 hour expiry) for JSON text books.
  const signedUrl = isSecure 
    ? await getSignedUrl(filePath, 3600)
    : getCdnUrl(filePath);

  // 5. Fetch from CDN on server-side to stream back
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
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to stream book content: ' + errorMessage }, { status: 500 });
  }
}
