import { NextResponse } from 'next/server';

export async function GET() {
  const fingerprints = process.env.ANDROID_SHA256_FINGERPRINTS
    ? process.env.ANDROID_SHA256_FINGERPRINTS.split(',').map((s) => s.trim()).filter(Boolean)
    : [
        // Replace with real SHA-256 fingerprint from Google Play Console (Setup > App Signing)
        'EB:51:F1:93:FA:1C:93:BD:FC:37:1F:2E:1F:69:EB:A6:79:EA:22:6A:00:00:00:00:00:00:00:00:00:00:00:00',
      ];

  const assetLinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.adepttechnologies.noorlibrary',
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return NextResponse.json(assetLinks, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
