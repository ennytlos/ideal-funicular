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

    // Redirect directly to the public URL (bypassing Vercel streaming/bandwidth)
    return NextResponse.redirect(new URL(destination, request.url));
  } catch (error) {
    // Fallback: Redirect to placeholder if exception occurs
    return NextResponse.redirect(new URL('https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400', request.url));
  }
}
