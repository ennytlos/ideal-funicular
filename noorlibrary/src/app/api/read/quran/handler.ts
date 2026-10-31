// src/app/api/read/quran/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import fallbackMeta from '@/data/quran/index.json';

export async function GET() {
  try {
    const metaDoc = await adminDb.collection('quran_meta').doc('index').get();
    if (metaDoc.exists) {
      const data = metaDoc.data() as { surahs?: unknown[] } | undefined;
      const surahs = Array.isArray(data?.surahs) ? data.surahs : [];
      if (surahs.length > 0) {
        return NextResponse.json(surahs, {
          headers: {
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          },
        });
      }
    }
  } catch (error) {
    console.warn('Falling back to bundled Quran metadata because Firestore lookup failed:', error);
  }

  const fallbackList = Array.isArray(fallbackMeta) ? fallbackMeta : [];
  return NextResponse.json(fallbackList, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
