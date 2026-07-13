import React from 'react';
import CoursesClientPage from '../../components/CoursesClientPage';
import { adminDb } from '../../lib/firebase-admin';

// Revalidate static props every 60 seconds
export const revalidate = 60;

async function getCourses() {
  const coursesSnap = await adminDb.collection('courses').get();
  
  const courses = coursesSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title || '',
      instructor: data.instructor || '',
      category: data.category || '',
      description: data.description || '',
      coverUrl: data.coverUrl || '',
      price: Number(data.price) || 0,
      isPaid: data.isPaid ?? false,
      isPublished: data.isPublished !== false,
      creatorId: data.creatorId || '',
      lessons: data.lessons || [],
      createdAt: typeof data.createdAt?.toMillis === 'function' 
        ? data.createdAt.toMillis() 
        : (typeof data.createdAt === 'number' ? data.createdAt : 0)
    };
  });

  return courses;
}

export default async function CoursesPage() {
  const courses = await getCourses();
  return <CoursesClientPage initialCourses={courses} />;
}
