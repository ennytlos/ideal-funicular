import { NextRequest, NextResponse } from 'next/server';

// Import handlers
import { GET as getAdminStats } from '../admin/stats/handler';
import { POST as postUpload, DELETE as deleteUpload } from '../upload/handler';
import { GET as getReminder, POST as postReminder, PUT as putReminder, DELETE as deleteReminder } from '../reminder/handler';
import { GET as getReadBook } from '../read/[bookId]/handler';
import { GET as getQuranMeta } from '../read/quran/handler';
import { GET as getQuranSurah } from '../read/quran/[surahId]/handler';
import { GET as getAdhkar } from '../read/adhkar/handler';
import { POST as postPayInitialize } from '../payment/initialize/handler';
import { GET as getPayVerify } from '../payment/verify/handler';
import { GET as getDownload } from '../download/handler';
import { GET as getCoverBook } from '../cover/[bookId]/handler';
import { GET as getCoverSeries } from '../cover/series/[seriesId]/handler';
import { GET as getCoverCourse } from '../cover/courses/[courseId]/handler';
import { GET as getBooks } from '../books/handler';
import { POST as postSession, DELETE as deleteSession } from '../auth/session/handler';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function handle(request: NextRequest, method: string, paramsPromise: Promise<{ route?: string[] }>): Promise<NextResponse> {
  const params = await paramsPromise;
  const route = params.route || [];

  if (route.length === 0) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const p0 = route[0];
  const p1 = route[1];
  const p2 = route[2];

  // Helper to ensure NextResponse
  const ensureResponse = (res: NextResponse | undefined | null) => 
    res || NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });

  // 1. /api/admin/stats
  if (p0 === 'admin' && p1 === 'stats') {
    if (method === 'GET') return ensureResponse(await getAdminStats(request));
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  // 2. /api/upload
  if (p0 === 'upload') {
    if (method === 'POST') return ensureResponse(await postUpload(request));
    if (method === 'DELETE') return ensureResponse(await deleteUpload(request));
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  // 3. /api/reminder
  if (p0 === 'reminder') {
    if (method === 'GET') return ensureResponse(await getReminder());
    if (method === 'POST') return ensureResponse(await postReminder(request));
    if (method === 'PUT') return ensureResponse(await putReminder(request));
    if (method === 'DELETE') return ensureResponse(await deleteReminder(request));
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  // 4. /api/read/...
  if (p0 === 'read') {
    // /api/read/quran/...
    if (p1 === 'quran') {
      if (p2) {
        // /api/read/quran/[surahId]
        if (method === 'GET') return ensureResponse(await getQuranSurah(request, { params: Promise.resolve({ surahId: p2 }) }));
        return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
      }
      // /api/read/quran
      if (method === 'GET') return ensureResponse(await getQuranMeta());
      return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
    }

    // /api/read/adhkar
    if (p1 === 'adhkar') {
      if (method === 'GET') return ensureResponse(await getAdhkar());
      return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
    }

    // /api/read/[bookId]
    if (p1) {
      if (method === 'GET') return ensureResponse(await getReadBook(request, { params: Promise.resolve({ bookId: p1 }) }));
      return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
    }

    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // 5. /api/payment/...
  if (p0 === 'payment') {
    if (p1 === 'initialize') {
      if (method === 'POST') return ensureResponse(await postPayInitialize(request));
      return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
    }
    if (p1 === 'verify') {
      if (method === 'GET') return ensureResponse(await getPayVerify(request));
      return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
    }
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // 6. /api/download
  if (p0 === 'download') {
    if (method === 'GET') return ensureResponse(await getDownload(request));
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  // 7. /api/cover/...
  if (p0 === 'cover') {
    if (p1 === 'series') {
      if (p2) {
        // /api/cover/series/[seriesId]
        if (method === 'GET') return ensureResponse(await getCoverSeries(request, { params: Promise.resolve({ seriesId: p2 }) }));
        return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
      }
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }
    if (p1 === 'courses') {
      if (p2) {
        // /api/cover/courses/[courseId]
        if (method === 'GET') return ensureResponse(await getCoverCourse(request, { params: Promise.resolve({ courseId: p2 }) }));
        return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
      }
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }
    if (p1) {
      // /api/cover/[bookId]
      if (method === 'GET') return ensureResponse(await getCoverBook(request, { params: Promise.resolve({ bookId: p1 }) }));
      return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
    }
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // 8. /api/books
  if (p0 === 'books') {
    if (method === 'GET') return ensureResponse(await getBooks());
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  // 9. /api/auth/session
  if (p0 === 'auth' && p1 === 'session') {
    if (method === 'POST') return ensureResponse(await postSession(request));
    if (method === 'DELETE') return ensureResponse(await deleteSession());
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ route?: string[] }> }) {
  try {
    const response = await handle(request, 'GET', params);
    // Add CORS headers to the response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ route?: string[] }> }) {
  try {
    const response = await handle(request, 'POST', params);
    // Add CORS headers to the response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ route?: string[] }> }) {
  try {
    const response = await handle(request, 'PUT', params);
    // Add CORS headers to the response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ route?: string[] }> }) {
  try {
    const response = await handle(request, 'DELETE', params);
    // Add CORS headers to the response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}
