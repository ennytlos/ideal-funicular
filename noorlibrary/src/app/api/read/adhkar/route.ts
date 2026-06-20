// src/app/api/read/adhkar/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';

export async function GET() {
  try {
    const doc = await adminDb.collection('adhkar_meta').doc('all').get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Adhkar database not found' }, { status: 404 });
    }
    const data = doc.data()!;
    return NextResponse.json(data.adhkar || []);
  } catch (error) {
    console.error('Error fetching Adhkar data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
