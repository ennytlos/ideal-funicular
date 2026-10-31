// src/app/api/books/route.ts
// Public API route to fetch the books collection from Firestore.
// Used as a fallback when client-side Firestore reads fail due to permission settings.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebase-admin';

export async function GET() {
  try {
    const snap = await adminDb.collection('books').orderBy('createdAt', 'desc').get();
    const books = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json(books);
  } catch (error: unknown) {
    // If orderBy fails (e.g. missing Firestore index), query unordered
    try {
      const snap = await adminDb.collection('books').get();
      const books = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      return NextResponse.json(books);
    } catch (innerError: unknown) {
      const errorMessage = innerError instanceof Error ? innerError.message : String(innerError);
      return NextResponse.json({ error: 'Failed to fetch books catalog: ' + errorMessage }, { status: 500 });
    }
  }
}
