// src/app/api/upload/route.ts
// Streams file uploads from the admin panel to Bunny.net Storage.
// Handles cover images (images/), PDFs (pdfs/), attachments (attachments/), and student submissions (submissions/).

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '../../../lib/firebase-admin';
import { adminDb } from '../../../lib/firebase-admin';
import { uploadToBunny, deleteFromBunny } from '../../../lib/bunny';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  // 1. Verify token
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

  // 2. Parse multipart form
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string | null; // "cover" | "pdf" | "attachment" | "submission"
  const courseId = formData.get('courseId') as string | null;

  if (!file || !type) {
    return NextResponse.json({ error: 'Missing file or type' }, { status: 400 });
  }

  // 3. Check role. Admin or Creator is required for cover, pdf, and attachment.
  const isSubmission = type === 'submission';
  if (!isSubmission) {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const role = userDoc.data()?.role;
    if (!userDoc.exists || (role !== 'admin' && role !== 'creator')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Check content storage limit if courseId is provided
  if (courseId && !isSubmission) {
    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    if (courseDoc.exists) {
      const courseData = courseDoc.data()!;
      if (courseData.isPaid === false) {
        return NextResponse.json({ error: 'Course is unpaid. Please pay the creation fee to upload content.' }, { status: 400 });
      }
      
      const maxContentSize = courseData.maxContentSize ?? (50 * 1024 * 1024); // default 50MB
      const currentContentSize = courseData.currentContentSize ?? 0;
      if (currentContentSize + file.size > maxContentSize) {
        return NextResponse.json({ 
          error: `This file exceeds the course's remaining content storage limit. Limit: ${(maxContentSize / (1024 * 1024)).toFixed(1)}MB, Current: ${(currentContentSize / (1024 * 1024)).toFixed(1)}MB, File size: ${(file.size / (1024 * 1024)).toFixed(1)}MB.` 
        }, { status: 400 });
      }
    }
  }

  // 4. Validate file type
  const isPdf = type === 'pdf';
  const isJson = type === 'json';
  const isAttachment = type === 'attachment';
  const isAudio = type === 'audio';
  const isMedia = type === 'media';
  
  if (isMedia) {
    if (!file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'Only video files are accepted for Islamic Media clips' }, { status: 400 });
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'Vertical short video files must be under 50MB.' }, { status: 400 });
    }
  }
  if (isPdf && file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are accepted for this field' }, { status: 400 });
  }
  if (isJson && file.type !== 'application/json') {
    return NextResponse.json({ error: 'Only JSON files are accepted for this field' }, { status: 400 });
  }
  if (isAudio && !file.type.startsWith('audio/')) {
    return NextResponse.json({ error: 'Only audio files are accepted for this field' }, { status: 400 });
  }
  if (!isPdf && !isJson && !isAttachment && !isAudio && !isMedia && !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are accepted for this field' }, { status: 400 });
  }

  // 5. Build a unique path and upload
  const rawExt = file.name.includes('.') ? file.name.split('.').pop()! : '';
  const ext = rawExt || (isPdf ? 'pdf' : isJson ? 'json' : isAudio ? 'mp3' : isMedia ? 'mp4' : 'jpg');
  const folder = isPdf ? 'pdfs' : isJson ? 'json' : isAudio ? 'audio' : isMedia ? 'media' : isAttachment ? 'attachments' : isSubmission ? 'submissions' : 'covers';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const buffer = await file.arrayBuffer();
  const cdnUrl = await uploadToBunny(buffer, path);

  // 6. Increment currentContentSize on the course if this upload belongs to one
  if (courseId && !isSubmission && !isMedia) {
    try {
      await adminDb.collection('courses').doc(courseId).update({
        currentContentSize: FieldValue.increment(file.size)
      });
    } catch (err) {
      console.error('Failed to update course content size:', err);
      // Non-fatal — the file is already uploaded; don't fail the request
    }
  }

  return NextResponse.json({ url: cdnUrl, path, size: file.size });
}

export async function DELETE(request: NextRequest) {
  // 1. Verify token
  const token = request.cookies.get('noor_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let uid: string;
  let role: string = 'user';
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
    
    // Check role in Firestore
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (userDoc.exists) {
      role = userDoc.data()?.role || 'user';
    }
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  // 2. Validate permission
  if (role !== 'admin' && role !== 'creator') {
    // Non-admin/non-creator can only delete their own submissions
    if (!path.startsWith('submissions/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Check if the user has a submission pointing to this path in Firestore
    const subSnap = await adminDb.collection('submissions')
      .where('userId', '==', uid)
      .where('imagePath', '==', path)
      .get();
      
    if (subSnap.empty) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    await deleteFromBunny(path);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

