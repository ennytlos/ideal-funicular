// src/app/api/creator/students/handler.ts
// Secure endpoint allowing Course Creators (and Admins) to view enrolled students,
// their email addresses, and progress tracking for issuing certificates and course communications.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, getAuthToken } from '../../../../lib/firebase-admin';

export interface EnrolledStudentItem {
  uid: string;
  displayName: string;
  email: string;
  courseId: string;
  courseTitle: string;
  completedLessons: number;
  totalLessons: number;
  progressPct: number;
  isCompleted: boolean;
  enrolledAt?: any;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate caller
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorised: Missing authentication token' }, { status: 401 });
    }

    let callerUid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      callerUid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Unauthorised: Invalid or expired token' }, { status: 401 });
    }

    // 2. Verify caller role (Creator or Admin)
    const callerDoc = await adminDb.collection('users').doc(callerUid).get();
    if (!callerDoc.exists) {
      return NextResponse.json({ error: 'User record not found' }, { status: 404 });
    }

    const callerData = callerDoc.data() || {};
    const role = callerData.role;
    const isAdmin = role === 'admin';
    const isCreator = role === 'creator';

    if (!isAdmin && !isCreator) {
      return NextResponse.json({ error: 'Forbidden: Creator or Admin access required' }, { status: 403 });
    }

    // 3. Resolve target courses
    const { searchParams } = new URL(request.url);
    const specificCourseId = searchParams.get('courseId');

    interface CourseMeta {
      id: string;
      title: string;
      creatorId: string;
      lessons: any[];
    }

    let targetCourses: CourseMeta[] = [];

    if (specificCourseId) {
      const courseDoc = await adminDb.collection('courses').doc(specificCourseId).get();
      if (!courseDoc.exists) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      }
      const data = courseDoc.data() || {};
      if (!isAdmin && data.creatorId !== callerUid) {
        return NextResponse.json({ error: 'Forbidden: You do not own this course' }, { status: 403 });
      }
      targetCourses = [{
        id: courseDoc.id,
        title: data.title || 'Untitled Course',
        creatorId: data.creatorId || '',
        lessons: Array.isArray(data.lessons) ? data.lessons : [],
      }];
    } else {
      let queryRef: FirebaseFirestore.Query = adminDb.collection('courses');
      if (!isAdmin) {
        queryRef = queryRef.where('creatorId', '==', callerUid);
      }
      const coursesSnap = await queryRef.get();
      targetCourses = coursesSnap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          title: data.title || 'Untitled Course',
          creatorId: data.creatorId || '',
          lessons: Array.isArray(data.lessons) ? data.lessons : [],
        };
      });
    }

    if (targetCourses.length === 0) {
      return NextResponse.json({
        students: [],
        totalStudents: 0,
        completedCount: 0,
      });
    }

    // 4. Fetch enrolled students for each course in parallel
    const allStudents: EnrolledStudentItem[] = [];

    await Promise.all(
      targetCourses.map(async (course) => {
        const usersSnap = await adminDb
          .collection('users')
          .where('enrolledCourses', 'array-contains', course.id)
          .get();

        usersSnap.docs.forEach((uDoc) => {
          const uData = uDoc.data() || {};
          const totalLessons = course.lessons.length;
          const completedIds: string[] = uData.courseProgress?.[course.id] || [];
          const validCompleted = course.lessons.length > 0
            ? course.lessons.filter((l) => completedIds.includes(l.id)).length
            : completedIds.length;
          const progressPct = totalLessons > 0
            ? Math.min(100, Math.round((validCompleted / totalLessons) * 100))
            : 0;
          const isCompleted = progressPct === 100 && totalLessons > 0;

          // Format clean display name
          const rawName = uData.displayName || uData.name || '';
          const emailPrefix = (uData.email || '').split('@')[0] || '';
          const displayName = rawName.trim()
            ? rawName.trim()
            : emailPrefix
            ? emailPrefix
                .replace(/[._-]+/g, ' ')
                .replace(/\b\w/g, (c: string) => c.toUpperCase())
            : 'Enrolled Learner';

          allStudents.push({
            uid: uDoc.id,
            displayName,
            email: uData.email || '',
            courseId: course.id,
            courseTitle: course.title,
            completedLessons: validCompleted,
            totalLessons,
            progressPct,
            isCompleted,
            enrolledAt: uData.createdAt || null,
          });
        });
      })
    );

    // Sort by completion % descending, then by display name
    allStudents.sort((a, b) => {
      if (b.progressPct !== a.progressPct) {
        return b.progressPct - a.progressPct;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    const completedCount = allStudents.filter((s) => s.isCompleted).length;

    return NextResponse.json({
      students: allStudents,
      totalStudents: allStudents.length,
      completedCount,
    });
  } catch (error: any) {
    console.error('Error fetching creator course students:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
