import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import localHisnData from '../../../../data/hisn-almuslim.json';

export async function GET() {
  try {
    const doc = await adminDb.collection('hisn_meta').doc('all').get();
    if (doc.exists) {
      const data = doc.data()!;
      return NextResponse.json(data.chapters || localHisnData, {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
      });
    }

    return NextResponse.json(localHisnData, {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('Error fetching Hisn al-Muslim data, falling back to local:', error);
    return NextResponse.json(localHisnData);
  }
}
