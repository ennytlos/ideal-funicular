// src/app/api/admin/mobile-hero/handler.ts
// Admin-only API to get and update the Mobile App Hero Spotlight configuration.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, getAuthToken } from '../../../../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const DEFAULT_MOBILE_HERO = {
  isEnabled: true,
  badge: 'FEATURED SPOTLIGHT',
  title: 'Illuminating Minds with Authentic Knowledge',
  subtitle: '',
  buttonText: 'Explore Spotlight',
  targetUrl: '/(tabs)/explore',
  imageUrl: '',
};

async function verifyAdminUser(request: NextRequest): Promise<{ uid: string } | null> {
  const token = getAuthToken(request);
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return null;
    }
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminUser = await verifyAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorised: Admin access required' }, { status: 401 });
    }

    const docSnap = await adminDb.collection('app_config').doc('mobile_hero').get();
    if (!docSnap.exists) {
      return NextResponse.json({ mobileHero: DEFAULT_MOBILE_HERO });
    }

    const data = docSnap.data();
    return NextResponse.json({
      mobileHero: {
        ...DEFAULT_MOBILE_HERO,
        ...data,
      },
    });
  } catch (error: any) {
    console.error('Error fetching mobile hero config:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await verifyAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorised: Admin access required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { isEnabled, badge, title, subtitle, buttonText, targetUrl, imageUrl } = body;

    const updatedConfig = {
      isEnabled: isEnabled !== false,
      badge: typeof badge === 'string' && badge.trim() ? badge.trim() : DEFAULT_MOBILE_HERO.badge,
      title: typeof title === 'string' && title.trim() ? title.trim() : DEFAULT_MOBILE_HERO.title,
      subtitle: typeof subtitle === 'string' ? subtitle.trim() : '',
      buttonText: typeof buttonText === 'string' && buttonText.trim() ? buttonText.trim() : DEFAULT_MOBILE_HERO.buttonText,
      targetUrl: typeof targetUrl === 'string' && targetUrl.trim() ? targetUrl.trim() : DEFAULT_MOBILE_HERO.targetUrl,
      imageUrl: typeof imageUrl === 'string' ? imageUrl.trim() : '',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: adminUser.uid,
    };

    await adminDb.collection('app_config').doc('mobile_hero').set(updatedConfig, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'Mobile Hero Spotlight updated successfully',
      mobileHero: updatedConfig,
    });
  } catch (error: any) {
    console.error('Error saving mobile hero config:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
