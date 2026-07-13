// src/app/api/download/route.ts
// Secure endpoint to download course and lesson attachments.
// Verifies user authentication and course enrollment status before redirecting to signed Bunny CDN files.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../lib/firebase-admin';
import { getSignedUrl } from '../../../lib/bunny';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // "course" | "lesson"
  const courseId = searchParams.get('courseId') || searchParams.get('id');
  const lessonId = searchParams.get('lessonId');

  if (!courseId) {
    return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
  }

  try {
    // 1. Fetch course details
    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const courseData = courseDoc.data()!;
    const price = courseData.price ?? 0;

    // 2. Perform authentication and enrollment checks
    const token = request.cookies.get('noor_token')?.value;
    let uid = '';
    let isAdminUser = false;

    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
        // Verify if user is admin
        const userDoc = await adminDb.collection('users').doc(uid).get();
        const role = userDoc.data()?.role;
        if (userDoc.exists && (role === 'admin' || role === 'creator')) {
          isAdminUser = true;
        }
      } catch {
        // Token is invalid/expired, proceed as unauthenticated
      }
    }

    // Enforce that premium/paid courses require active enrollment (or admin status)
    if (price > 0 && !isAdminUser) {
      if (!uid) {
        return NextResponse.json({ error: 'Unauthorised. Please log in first.' }, { status: 401 });
      }

      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
      }

      const enrolledCourses = userDoc.data()?.enrolledCourses || [];
      if (!enrolledCourses.includes(courseId)) {
        return NextResponse.json({ error: 'Access denied. You must enroll in this course first.' }, { status: 403 });
      }
    }

    // 3. Extract the attachment path
    let attachmentPath = '';
    let attachmentName = '';

    if (type === 'lesson') {
      if (!lessonId) {
        return NextResponse.json({ error: 'Missing lessonId' }, { status: 400 });
      }
      const lessons = courseData.lessons || [];
      const lesson = lessons.find((l: { id?: string }) => l.id === lessonId);
      if (!lesson) {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
      }
      const isAssignment = searchParams.get('assignment') === 'true';
      const isContent = searchParams.get('content') === 'true';
      
      if (isAssignment) {
        attachmentPath = lesson.assignment?.attachmentPath || '';
        attachmentName = lesson.assignment?.attachmentName || 'assignment';
      } else if (isContent) {
        if (lesson.contentType === 'pdf') {
          attachmentPath = lesson.pdfPath || '';
          attachmentName = lesson.title || 'lesson';
        } else if (lesson.contentType === 'audio') {
          attachmentPath = lesson.audioUrl || '';
          attachmentName = lesson.title || 'lesson';
        }
      } else {
        attachmentPath = lesson.attachmentPath || '';
        attachmentName = lesson.attachmentName || 'attachment';
      }
    } else {
      attachmentPath = courseData.attachmentPath || '';
      attachmentName = courseData.attachmentName || 'attachment';
    }

    if (!attachmentPath) {
      return NextResponse.json({ error: 'No attachment found' }, { status: 404 });
    }

    // 4. Generate signed CDN URL and redirect for direct download
    const signedUrl = await getSignedUrl(attachmentPath, 300); // 5 min expiry
    return NextResponse.redirect(signedUrl);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
