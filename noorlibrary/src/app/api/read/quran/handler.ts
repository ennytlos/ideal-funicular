// src/app/api/read/quran/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';

export async function GET() {
  try {
    const metaDoc = await adminDb.collection('quran_meta').doc('index').get();
    if (!metaDoc.exists) {
      return NextResponse.json({ error: 'Quran metadata index not found' }, { status: 404 });
    }
    const data = metaDoc.data()!;
    return NextResponse.json(data.surahs || [], {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('Error fetching Quran metadata:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
