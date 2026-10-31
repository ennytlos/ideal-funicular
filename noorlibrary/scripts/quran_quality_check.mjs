import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const webQuranMeta = path.join(repoRoot, 'src', 'data', 'quran', 'index.json');
const mobileQuranDir = path.join(repoRoot, 'mobile', 'noor-library', 'assets', 'quran');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

const validations = [];
const criticalVerseFixtures = [
  { surahId: 1, verseId: 1, description: 'Al-Fatihah opening verse', required: ['بِسۡمِ', 'ٱللَّهِ'] },
  { surahId: 2, verseId: 255, description: 'Ayat al-Kursi', required: ['ٱللَّهُ', 'ٱلۡحَيُّ', 'ٱلۡقَيُّومُ', 'ٱلۡعَلِيُّ', 'ٱلۡعَظِيمُ'] },
  { surahId: 17, verseId: 110, description: 'Allah is the Greatest call', required: ['قُلِ', 'ٱللَّهَ', 'ٱلرَّحۡمَـٰنَ', 'ٱلۡأَسۡمَآءُ'] },
  { surahId: 36, verseId: 82, description: 'Creation by command', required: ['إِنَّمَآ', 'أَمۡرُهُۥٓ', 'كُن', 'فَيَكُونُ'] },
  { surahId: 96, verseId: 1, description: 'Iqra opening', required: ['ٱقۡرَأۡ'] },
  { surahId: 112, verseId: 1, description: 'Al-Ikhlas opening', required: ['قُلۡ', 'هُوَ', 'ٱللَّهُ', 'أَحَدٌ'] },
];

const sajdahFixtures = [
  { surahId: 7, verseId: 206, description: 'Sajdah verse in Surah Al-Araaf' },
  { surahId: 13, verseId: 15, description: 'Sajdah verse in Surah Ar-Raad' },
  { surahId: 16, verseId: 50, description: 'Sajdah verse in Surah An-Nahl' },
  { surahId: 17, verseId: 109, description: 'Sajdah verse in Surah Al-Isra' },
  { surahId: 19, verseId: 58, description: 'Sajdah verse in Surah Maryam' },
  { surahId: 22, verseId: 18, description: 'Sajdah verse in Surah Al-Hajj' },
  { surahId: 32, verseId: 15, description: 'Sajdah verse in Surah As-Sajdah' },
  { surahId: 41, verseId: 38, description: 'Sajdah verse in Surah Fussilat' },
  { surahId: 53, verseId: 62, description: 'Sajdah verse in Surah An-Najm' },
  { surahId: 84, verseId: 21, description: 'Sajdah verse in Surah Al-Inshiqaq' },
  { surahId: 96, verseId: 19, description: 'Sajdah verse in Surah Al-Alaq' },
];

if (!fs.existsSync(webQuranMeta)) fail(`Missing web metadata index: ${webQuranMeta}`);
if (!fs.existsSync(mobileQuranDir)) fail(`Missing mobile Quran asset directory: ${mobileQuranDir}`);

const webIndex = readJson(webQuranMeta);
if (!Array.isArray(webIndex) || webIndex.length !== 114) {
  fail(`Web Quran index must contain 114 surahs; found ${Array.isArray(webIndex) ? webIndex.length : 'not-array'}`);
}
validations.push({ name: 'web-index-count', value: webIndex.length });

const mobileFiles = fs.readdirSync(mobileQuranDir)
  .filter((n) => /^\d+\.json$/.test(n))
  .sort((a, b) => Number(a.replace(/\.json$/, '')) - Number(b.replace(/\.json$/, '')));

if (mobileFiles.length !== 114) {
  fail(`Mobile Quran assets must contain 114 surah files; found ${mobileFiles.length}`);
}
validations.push({ name: 'mobile-surah-files', value: mobileFiles.length });

const bySurahId = new Map();
let totalVerses = 0;
for (const file of mobileFiles) {
  const surah = readJson(path.join(mobileQuranDir, file));
  if (!surah || typeof surah !== 'object') fail(`Invalid surah JSON: ${file}`);
  if (!Number.isInteger(surah.id)) fail(`Surah ${file} missing numeric id`);
  if (!Array.isArray(surah.verses) || surah.verses.length !== surah.total_verses) {
    fail(`Surah ${surah.id} verse count mismatch: expected ${surah.total_verses}, found ${Array.isArray(surah.verses) ? surah.verses.length : 'n/a'}`);
  }
  if (!surah.verses.every((v) => typeof v?.text === 'string' && v.text.trim().length > 0)) {
    fail(`Surah ${surah.id} contains empty verse text`);
  }
  totalVerses += surah.verses.length;
  bySurahId.set(surah.id, surah);
}
validations.push({ name: 'mobile-total-verses', value: totalVerses });

if (totalVerses !== 6236) {
  fail(`Expected 6236 total Quran verses; found ${totalVerses}`);
}

const mobileIndex = readJson(path.join(mobileQuranDir, 'index.json'));
if (!Array.isArray(mobileIndex) || mobileIndex.length !== 114) {
  fail(`Mobile index.json must contain 114 surahs; found ${Array.isArray(mobileIndex) ? mobileIndex.length : 'not-array'}`);
}
validations.push({ name: 'mobile-index-count', value: mobileIndex.length });

for (const fixture of criticalVerseFixtures) {
  const surah = bySurahId.get(fixture.surahId);
  if (!surah) fail(`Critical fixture missing surah ${fixture.surahId}`);
  const verse = surah.verses.find((v) => v.id === fixture.verseId);
  if (!verse) fail(`${fixture.description} (surah ${fixture.surahId}, verse ${fixture.verseId}) is missing from the bundle`);
  const text = String(verse.text || '');
  const missing = fixture.required.filter((token) => !text.includes(token));
  if (missing.length) {
    fail(`${fixture.description} is missing required Arabic markers: ${missing.join(', ')}`);
  }
  validations.push({
    name: `fixture-${fixture.surahId}-${fixture.verseId}`,
    value: { description: fixture.description, present: true }
  });
}

for (const fixture of sajdahFixtures) {
  const surah = bySurahId.get(fixture.surahId);
  if (!surah) fail(`Sajdah fixture missing surah ${fixture.surahId}`);
  const verse = surah.verses.find((v) => v.id === fixture.verseId);
  if (!verse) fail(`${fixture.description} (surah ${fixture.surahId}, verse ${fixture.verseId}) is missing from the bundle`);
  const text = String(verse.text || '');
  const hasMarker = text.includes('\u06E4') || text.includes('\u06E9');
  if (!hasMarker) {
    fail(`${fixture.description} did not contain a sajdah marker or overline symbol in the source text`);
  }
  validations.push({
    name: `sajdah-${fixture.surahId}-${fixture.verseId}`,
    value: { description: fixture.description, hasMarker: true }
  });
}

const samplePairs = [
  { surahId: 1, verseId: 1 },
  { surahId: 2, verseId: 255 },
  { surahId: 4, verseId: 1 },
  { surahId: 96, verseId: 1 },
];

for (const pair of samplePairs) {
  const verse = bySurahId.get(pair.surahId)?.verses.find((v) => v.id === pair.verseId);
  if (!verse || typeof verse.text !== 'string' || verse.text.trim().length < 12) {
    fail(`Sample verse integrity check failed for surah ${pair.surahId}, verse ${pair.verseId}`);
  }
}
validations.push({ name: 'sample-verse-integrity', value: samplePairs.length });

console.log(JSON.stringify({
  status: 'PASS',
  checks: validations,
  summary: 'Quran data integrity and critical fixture validation passed for web and mobile platforms',
}, null, 2));
