import { NextResponse } from 'next/server';

export async function GET() {
  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          appID: 'TEAM_ID.com.adepttechnologies.noorlibrary',
          paths: [
            '/books/*',
            '/book/*',
            '/series/*',
            '/courses/*',
            '/course/*',
            '/quran/*',
            '/hadith/*',
            '/societies/*',
            '/society/*',
            '/adhkaar/*',
            '/reminder*',
            '/support',
          ],
        },
      ],
    },
    webcredentials: {
      apps: ['TEAM_ID.com.adepttechnologies.noorlibrary'],
    },
  };

  return NextResponse.json(aasa, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
