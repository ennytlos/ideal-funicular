// src/app/api/read/quran/[surahId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../../lib/firebase-admin';

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
    if (!surahDoc.exists) {
      return NextResponse.json({ error: 'Surah not found' }, { status: 404 });
    }

    return NextResponse.json(surahDoc.data());
  } catch (error) {
    console.error(`Error fetching Surah ${surahId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
