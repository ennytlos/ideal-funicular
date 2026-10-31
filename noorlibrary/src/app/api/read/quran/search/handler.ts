// src/app/api/read/quran/search/handler.ts
import { NextRequest, NextResponse } from 'next/server';
import searchIndex from '@/data/quran/search-index.json';
import quranMeta from '@/data/quran/index.json';

export type SearchScope = 'all' | 'arabic' | 'english' | 'transliteration';

interface RawVerseItem {
  s: number;
  v: number;
  ar: string;
  na: string;
  en: string;
  tr: string;
}

interface SurahMetaItem {
  id: number;
  name: string;
  transliteration: string;
  translation?: string;
  type?: string;
  total_verses: number;
}

const metaMap = new Map<number, SurahMetaItem>();
for (const m of quranMeta as SurahMetaItem[]) {
  metaMap.set(m.id, m);
}

function cleanArabicText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u065E/g, '\u064C')
    .replace(/([\u0628\u062A\u062B\u062C\u062D\u062E\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063A\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u064A\u0626][\u0651]?[\u064E]?)(?!\u0640)\u0670/gu, '$1\u0640\u0670')
    .replace(/([\u0628\u062A\u062B\u062C\u062D\u062E\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063A\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u064A\u0626][\u0651]?[\u064E\u064F\u0650]?)(?!\u0640)([\u0627\u0648\u064A\u0670]\u0653|\u0622)/gu, '$1\u0640$2')
    .replace(/([\u0628\u062A\u062B\u062C\u062D\u062E\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063A\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u064A\u0626]\u0653)(?!\u0640)([\u0628\u062A\u062B\u062C\u062D\u062E\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063A\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u064A\u0626])/gu, '$1\u0640$2')
    .replace(/%D9%8F/gi, '\u064F')
    .replace(/%D9%8E/gi, '\u064E')
    .replace(/%D9%90/gi, '\u0650')
    .replace(/%D9%91/gi, '\u0651')
    .replace(/%D9%8B/gi, '\u064B')
    .replace(/%D9%8C/gi, '\u064C')
    .replace(/%D9%8D/gi, '\u064D');
}

function normalizeArabicForSearch(text: string): string {
  if (!text) return '';
  return cleanArabicText(text)
    .replace(/\u0670/g, 'ا')
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ـ/g, '')
    .trim();
}

function isArabicQuery(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';
    const scope = (searchParams.get('scope') || 'all') as SearchScope;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    if (!query) {
      return NextResponse.json({ surahs: [], verses: [], total: 0 });
    }

    const rawList = searchIndex as RawVerseItem[];
    const metaList = quranMeta as SurahMetaItem[];

    const matchedSurahs = [];
    const matchedVerses = [];

    // 1. Direct Chapter:Verse reference check (e.g. "2:255" or "18:10")
    const refMatch = query.match(/^(\d{1,3})[:\s]+(\d{1,3})$/);
    if (refMatch) {
      const sId = parseInt(refMatch[1], 10);
      const vId = parseInt(refMatch[2], 10);
      if (sId >= 1 && sId <= 114) {
        const meta = metaMap.get(sId);
        if (meta && vId >= 1 && vId <= meta.total_verses) {
          const exact = rawList.find((item) => item.s === sId && item.v === vId);
          if (exact) {
            return NextResponse.json(
              {
                surahs: [meta],
                verses: [
                  {
                    surahId: sId,
                    surahName: meta.name,
                    surahTransliteration: meta.transliteration,
                    surahTranslation: meta.translation || '',
                    surahType: meta.type || 'meccan',
                    verseId: vId,
                    arabic: exact.ar,
                    translation: exact.en,
                    transliteration: exact.tr,
                    matchType: 'reference',
                  },
                ],
                total: 1,
              },
              {
                headers: {
                  'Cache-Control': 'public, max-age=86400, s-maxage=86400',
                },
              }
            );
          }
        }
      }
    }

    const isArabic = isArabicQuery(query);
    const normQ = isArabic ? normalizeArabicForSearch(query) : query.toLowerCase();
    const normQNoAlif = isArabic ? normQ.replace(/ا/g, '') : '';

    // 2. Surah title matching
    if (scope === 'all' || (!isArabic && scope !== 'arabic') || (isArabic && scope !== 'english')) {
      for (const m of metaList) {
        const matchTranslit = m.transliteration.toLowerCase().includes(query.toLowerCase());
        const matchTranslation = (m.translation || '').toLowerCase().includes(query.toLowerCase());
        const matchArabic = isArabic && normalizeArabicForSearch(m.name).includes(normQ);
        const matchNum = m.id.toString() === query;

        if (matchTranslit || matchTranslation || matchArabic || matchNum) {
          matchedSurahs.push(m);
        }
      }
    }

    // 3. Verses matching
    for (const item of rawList) {
      if (matchedVerses.length >= limit) break;

      let matched = false;
      let matchType: 'arabic' | 'english' | 'transliteration' = 'arabic';

      if (isArabic || scope === 'arabic' || scope === 'all') {
        if (item.na.includes(normQ)) {
          matched = true;
          matchType = 'arabic';
        } else if (normQNoAlif.length >= 2 && item.na.replace(/ا/g, '').includes(normQNoAlif)) {
          matched = true;
          matchType = 'arabic';
        }
      }

      if (!matched && (!isArabic || scope === 'english' || scope === 'all')) {
        if ((scope === 'all' || scope === 'english') && item.en.toLowerCase().includes(normQ)) {
          matched = true;
          matchType = 'english';
        }
      }

      if (!matched && (!isArabic || scope === 'transliteration' || scope === 'all')) {
        if ((scope === 'all' || scope === 'transliteration') && item.tr.toLowerCase().includes(normQ)) {
          matched = true;
          matchType = 'transliteration';
        }
      }

      if (matched) {
        const meta = metaMap.get(item.s);
        matchedVerses.push({
          surahId: item.s,
          surahName: meta ? meta.name : '',
          surahTransliteration: meta ? meta.transliteration : '',
          surahTranslation: meta ? (meta.translation || '') : '',
          surahType: meta ? (meta.type || 'meccan') : 'meccan',
          verseId: item.v,
          arabic: item.ar,
          translation: item.en,
          transliteration: item.tr,
          matchType,
        });
      }
    }

    return NextResponse.json(
      {
        surahs: matchedSurahs,
        verses: matchedVerses,
        total: matchedSurahs.length + matchedVerses.length,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
      }
    );
  } catch (error) {
    console.error('Quran search API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
