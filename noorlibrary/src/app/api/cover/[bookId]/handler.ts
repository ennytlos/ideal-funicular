// src/app/api/cover/[bookId]/route.ts
// Proxy endpoint for book cover images.
// Fetches the cover URL from Firestore, signs it if on Bunny CDN, and streams it back.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import { getSignedUrl } from '../../../../lib/bunny';

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

    // Check if it is a Bunny CDN URL (our custom pull zone or default pull zone)
    if (coverUrl.includes('b-cdn.net') || coverUrl.includes('bunnycdn.com') || !coverUrl.startsWith('http')) {
      let path = coverUrl;
      if (coverUrl.startsWith('http')) {
        const urlObj = new URL(coverUrl);
        path = urlObj.pathname.substring(1); // remove leading slash
      }

      // Generate a signed URL for Bunny CDN (1 hour validity)
      const signedUrl = await getSignedUrl(path, 3600);
      const res = await fetch(signedUrl);
      
      if (!res.ok) {
        // Fallback: Redirect to placeholder if CDN fetch fails
        return NextResponse.redirect(new URL('/noor_logo.png', request.url));
      }

      const headers = new Headers();
      headers.set('Content-Type', res.headers.get('Content-Type') || 'image/jpeg');
      headers.set('Cache-Control', 'public, max-age=86400'); // Cache cover images for 24h
      return new NextResponse(res.body, { headers });
    }

    // If it's a standard external URL (e.g. Unsplash), redirect directly
    return NextResponse.redirect(new URL(coverUrl, request.url));
  } catch (error) {
    // Fallback: Redirect to placeholder if exception occurs
    return NextResponse.redirect(new URL('https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400', request.url));
  }
}
