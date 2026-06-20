// src/app/api/upload/route.ts
// Streams file uploads from the admin panel to Bunny.net Storage.
// Handles both cover images (images/) and PDFs (pdfs/).

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '../../../lib/firebase-admin';
import { adminDb } from '../../../lib/firebase-admin';
import { uploadToBunny } from '../../../lib/bunny';

export async function POST(request: NextRequest) {
  // 1. Verify admin token
  const token = request.cookies.get('noor_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // 2. Check admin role in Firestore
  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Parse multipart form
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string | null; // "cover" | "pdf"

  if (!file || !type) {
    return NextResponse.json({ error: 'Missing file or type' }, { status: 400 });
  }

  // 4. Validate file type
  const isPdf = type === 'pdf';
  const isJson = type === 'json';
  if (isPdf && file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are accepted for this field' }, { status: 400 });
  }
  if (isJson && file.type !== 'application/json') {
    return NextResponse.json({ error: 'Only JSON files are accepted for this field' }, { status: 400 });
  }
  if (!isPdf && !isJson && !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are accepted for this field' }, { status: 400 });
  }

  // 5. Build a unique path and upload
  const ext = file.name.split('.').pop() ?? (isPdf ? 'pdf' : isJson ? 'json' : 'jpg');
  const folder = isPdf ? 'pdfs' : isJson ? 'json' : 'covers';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const buffer = await file.arrayBuffer();
  const cdnUrl = await uploadToBunny(buffer, path);

  return NextResponse.json({ url: cdnUrl, path });
}
