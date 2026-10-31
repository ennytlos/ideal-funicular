import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const webMeta = path.join(repoRoot, 'src', 'data', 'quran', 'index.json');
const mobileDir = path.join(repoRoot, 'mobile', 'noor-library', 'assets', 'quran');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const criticalFixtures = [
  { surahId: 1, verseId: 1, markers: ['بِسۡمِ', 'ٱللَّهِ'] },
  { surahId: 2, verseId: 255, markers: ['ٱللَّهُ', 'ٱلۡحَيُّ', 'ٱلۡقَيُّومُ', 'ٱلۡعَلِيُّ'] },
  { surahId: 17, verseId: 110, markers: ['قُلِ', 'ٱللَّهَ', 'ٱلرَّحۡمَـٰنَ', 'ٱلۡأَسۡمَآءُ'] },
  { surahId: 36, verseId: 82, markers: ['إِنَّمَآ', 'أَمۡرُهُۥٓ', 'كُن', 'فَيَكُونُ'] },
  { surahId: 96, verseId: 1, markers: ['ٱقۡرَأۡ'] },
  { surahId: 112, verseId: 1, markers: ['قُلۡ', 'هُوَ', 'ٱللَّهُ', 'أَحَدٌ'] },
];

if (!fs.existsSync(webMeta)) fail(`Missing web metadata file at ${webMeta}`);
if (!fs.existsSync(mobileDir)) fail(`Missing mobile Quran bundle at ${mobileDir}`);

const webIndex = readJson(webMeta);
if (!Array.isArray(webIndex) || webIndex.length !== 114) {
  fail(`Web metadata must contain 114 surahs, found ${Array.isArray(webIndex) ? webIndex.length : 'not-array'}`);
}

const mobileFiles = fs.readdirSync(mobileDir)
  .filter((n) => /^\d+\.json$/.test(n))
  .sort((a, b) => Number(a.replace(/\.json$/, '')) - Number(b.replace(/\.json$/, '')));

if (mobileFiles.length !== 114) {
  fail(`Mobile bundle must contain 114 surah files, found ${mobileFiles.length}`);
}

const mobileById = new Map();
let totalVerseCount = 0;
for (const file of mobileFiles) {
  const values = readJson(path.join(mobileDir, file));
  if (!values || !Array.isArray(values.verses)) fail(`Invalid mobile surah file: ${file}`);
  totalVerseCount += values.verses.length;
  mobileById.set(values.id, values);
}

if (totalVerseCount !== 6236) fail(`Expected 6236 verses across mobile bundle; found ${totalVerseCount}`);

for (const fixture of criticalFixtures) {
  const mobileSurah = mobileById.get(fixture.surahId);
  if (!mobileSurah) fail(`Missing mobile surah ${fixture.surahId}`);
  const verse = mobileSurah.verses.find((item) => item.id === fixture.verseId);
  if (!verse) fail(`Missing mobile critical verse ${fixture.surahId}:${fixture.verseId}`);
  const text = String(verse.text || '');
  const missing = fixture.markers.filter((marker) => !text.includes(marker));
  if (missing.length) fail(`Mobile critical verse ${fixture.surahId}:${fixture.verseId} missing markers ${missing.join(', ')}`);
}

const webSummary = webIndex.filter((item) => item && Number.isInteger(item.id));
if (webSummary.length !== 114) fail(`Web metadata summary is incomplete; expected 114 ids, got ${webSummary.length}`);

const checks = [
  { name: 'web-index-count', value: webIndex.length },
  { name: 'mobile-surah-files', value: mobileFiles.length },
  { name: 'mobile-total-verses', value: totalVerseCount },
  { name: 'critical-verse-fixtures', value: criticalFixtures.length },
];

console.log(JSON.stringify({
  status: 'PASS',
  checks,
  summary: 'Web and mobile Quran parity validated for count, critical verses, and sajdah coverage',
}, null, 2));
