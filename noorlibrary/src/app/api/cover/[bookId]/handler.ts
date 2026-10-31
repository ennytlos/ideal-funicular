// src/app/api/cover/[bookId]/route.ts
// Proxy endpoint for book cover images.
// Fetches the cover URL from Firestore, signs it if on Bunny CDN, and streams it back.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;

  try {
    const bookDoc = await adminDb.collection('books').doc(bookId).get();
    if (!bookDoc.exists) {
      // Fallback: Redirect to placeholder if book not found
      return NextResponse.redirect(new URL('/noor_logo.png', request.url));
    }

    const data = bookDoc.data()!;
    const coverUrl = data.coverUrl as string;

    if (!coverUrl) {
      // Fallback: Redirect to placeholder if no coverUrl
      return NextResponse.redirect(new URL('/noor_logo.png', request.url));
    }

    let destination = coverUrl;
    if (!coverUrl.startsWith('http')) {
      const cdnHost = process.env.BUNNY_CDN_HOSTNAME || 'noorlibrary.b-cdn.net';
      destination = `https://${cdnHost}/${coverUrl.startsWith('/') ? coverUrl.substring(1) : coverUrl}`;
    }

    const imgRes = await fetch(destination);
    if (!imgRes.ok) {
      return NextResponse.redirect(new URL('/noor_logo.png', request.url));
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate',
      },
    });
  } catch (error) {
    // Fallback: Redirect to placeholder if exception occurs
    return NextResponse.redirect(new URL('/noor_logo.png', request.url));
  }
}
