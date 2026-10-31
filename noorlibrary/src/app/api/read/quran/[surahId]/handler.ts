// src/app/api/read/quran/[surahId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../../lib/firebase-admin';
import fallbackMeta from '@/data/quran/index.json';

interface SurahMetaItem {
  id: number;
  name: string;
  transliteration: string;
  translation?: string;
  type?: string;
  total_verses: number;
  link?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ surahId: string }> }
) {
  const { surahId } = await params;
  try {
    const idNum = parseInt(surahId, 10);

    if (isNaN(idNum) || idNum < 1 || idNum > 114) {
      return NextResponse.json({ error: 'Invalid Surah ID' }, { status: 400 });
    }

    const surahDoc = await adminDb.collection('quran').doc(surahId).get();
    if (surahDoc.exists) {
      return NextResponse.json(surahDoc.data(), {
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  } catch (error) {
    console.warn(`Firestore lookup failed for Surah ${surahId}; trying bundled fallback:`, error);
  }

  const fallbackItem = (fallbackMeta as SurahMetaItem[]).find((item) => item.id === parseInt(surahId, 10));
  if (!fallbackItem?.link) {
    return NextResponse.json({ error: 'Surah not found' }, { status: 404 });
  }

  try {
    const fallbackRes = await fetch(fallbackItem.link, { cache: 'force-cache' });
    if (!fallbackRes.ok) {
      return NextResponse.json({ error: 'Surah not found' }, { status: 404 });
    }

    const fallbackData = await fallbackRes.json();
    return NextResponse.json(fallbackData, {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error(`Fallback fetch failed for Surah ${surahId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
