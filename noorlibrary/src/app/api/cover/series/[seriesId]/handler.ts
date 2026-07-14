// src/app/api/cover/series/[seriesId]/route.ts
// Proxy endpoint for series cover images.
// Fetches the cover URL from Firestore, signs it if on Bunny CDN, and streams it back.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../../lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const { seriesId } = await params;

  try {
    const seriesDoc = await adminDb.collection('series').doc(seriesId).get();
    if (!seriesDoc.exists) {
      return NextResponse.redirect(new URL('/noor_logo.png', request.url));
    }

    const data = seriesDoc.data()!;
    const coverUrl = data.coverUrl as string;

    if (!coverUrl) {
      return NextResponse.redirect(new URL('/noor_logo.png', request.url));
    }

    let destination = coverUrl;
    if (!coverUrl.startsWith('http')) {
      const cdnHost = process.env.BUNNY_CDN_HOSTNAME || 'noorlibrary.b-cdn.net';
      destination = `https://${cdnHost}/${coverUrl.startsWith('/') ? coverUrl.substring(1) : coverUrl}`;
    }

    // Redirect directly to the public URL (bypassing Vercel streaming/bandwidth)
    return NextResponse.redirect(new URL(destination, request.url));
  } catch {
    return NextResponse.redirect(new URL('/noor_logo.png', request.url));
  }
}
