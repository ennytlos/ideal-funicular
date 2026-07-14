// src/app/api/reminder/route.ts
// Fallback API route to manage short_reads in Firestore server-side when client permissions are locked.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '../../../lib/firebase-admin';

// Admin helper function to verify admin access
async function verifyAdmin(request: NextRequest): Promise<NextResponse | null> {
  const token = request.cookies.get('noor_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const userDoc = await adminDb.collection('users').doc(uid).get();
    
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return null;
  } catch (err) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

// GET all reminders (public)
export async function GET() {
  try {
    const snap = await adminDb.collection('short_reads').orderBy('createdAt', 'desc').get();
    const reminders = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' 
          ? data.createdAt.toDate().getTime()
          : data.createdAt
      };
    });
    return NextResponse.json(reminders, {
      headers: {
        'Cache-Control': 'public, max-age=600, s-maxage=600',
      },
    });
  } catch (error: any) {
    try {
      const snap = await adminDb.collection('short_reads').get();
      const reminders = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' 
            ? data.createdAt.toDate().getTime()
            : data.createdAt
        };
      });
      return NextResponse.json(reminders, {
        headers: {
          'Cache-Control': 'public, max-age=600, s-maxage=600',
        },
      });
    } catch (innerError: any) {
      return NextResponse.json({ error: 'Failed to fetch reminders: ' + innerError.message }, { status: 500 });
    }
  }
}

// POST create reminder (admin only)
export async function POST(request: NextRequest) {
  const authErr = await verifyAdmin(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { content, category } = body;
    
    if (!content || !category) {
      return NextResponse.json({ error: 'Missing content or category' }, { status: 400 });
    }

    const docRef = await adminDb.collection('short_reads').add({
      content,
      category,
      isPublished: true,
      createdAt: new Date(), // uses server date
    });

    return NextResponse.json({ id: docRef.id, message: 'Created successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create reminder: ' + error.message }, { status: 500 });
  }
}

// PUT update reminder (admin only)
export async function PUT(request: NextRequest) {
  const authErr = await verifyAdmin(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { id, content, category } = body;

    if (!id || !content || !category) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    await adminDb.collection('short_reads').doc(id).update({
      content,
      category,
    });

    return NextResponse.json({ message: 'Updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update reminder: ' + error.message }, { status: 500 });
  }
}

// DELETE reminder (admin only)
export async function DELETE(request: NextRequest) {
  const authErr = await verifyAdmin(request);
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    await adminDb.collection('short_reads').doc(id).delete();

    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to delete reminder: ' + error.message }, { status: 500 });
  }
}
