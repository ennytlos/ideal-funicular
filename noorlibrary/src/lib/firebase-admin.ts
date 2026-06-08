// src/lib/firebase-admin.ts
// Firebase ADMIN SDK — server-side only. Never import in client components.

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }
  
  // Use real keys if present, otherwise use dummies to allow building successfully
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'dummy-project-id';
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || 'dummy-email@dummy.com';
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  
  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  } else {
    // Dummy private key for building
    privateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC3\n-----END PRIVATE KEY-----\n";
  }

  adminApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  return adminApp;
}

export const adminAuth = {
  verifyIdToken: (token: string) => getAuth(getAdminApp()).verifyIdToken(token)
};

export const adminDb = {
  collection: (name: string) => getFirestore(getAdminApp()).collection(name)
};
