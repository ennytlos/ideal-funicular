// src/app/api/read/adhkar/handler.ts
import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import localAdhkarData from '../../../../data/adhkar.json';

export async function GET() {
  try {
    const doc = await adminDb.collection('adhkar_meta').doc('all').get();
    if (!doc.exists) {
      return NextResponse.json(localAdhkarData, {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
      });
    }
    const data = doc.data()!;
    const adhkar = Array.isArray(data.adhkar) && data.adhkar.length > 0 ? data.adhkar : localAdhkarData;
    return NextResponse.json(adhkar, {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('Error fetching Adhkar data, falling back to bundled dataset:', error);
    return NextResponse.json(localAdhkarData, {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  }
}
