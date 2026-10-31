// scripts/seed-hisn-almuslim.js
// Node.js script to fetch Hisn al-Muslim (132 chapters), format it,
// generate local data files for web and mobile, and optionally seed Firestore under hisn_meta/all.

const fs = require('fs');
const path = require('path');

function getCategory(title) {
  const t = title.toLowerCase();
  const rules = [
    { pattern: /\b(?:thunder|rain|wind|storm|cloud|sky|weather|crescent|moon|sun|eclipse|star|nature)\b/i, category: 'Weather & Nature' },
    { pattern: /\b(?:sleep|waking|wake|night|dream|bed|rest)\b/i, category: 'Sleep & Waking' },
    { pattern: /\b(?:restroom|toilet|bath|wash|garment|cloth|mirror|dress|clothes|home|house)\b/i, category: 'Daily Routine' },
    { pattern: /\b(?:prayer|mosque|wudoo|ablution|athan|tashahhud|prostrat|prostration|ruku|rukoo|salah|istikharah|namaz)\b/i, category: 'Prayer & Mosque' },
    { pattern: /\b(?:eat|food|drink|fast|fasting|guest|iftar|breakfast|meal)\b/i, category: 'Food & Fasting' },
    { pattern: /\b(?:distress|anxiety|sorrow|grief|anger|debt|whisper|enemy|doubt|affliction|evil|fear|oppression|hardship)\b/i, category: 'Emotions & Hardship' },
    { pattern: /\b(?:sick|illness|pain|funeral|death|grave|burial|condolence|plague|bereaved|loss)\b/i, category: 'Health & Loss' },
    { pattern: /\b(?:travel|journey|vehicle|market|town|riding|safe|road|trip|hajj|umrah|pilgrimage)\b/i, category: 'Travel & Journey' },
    { pattern: /\b(?:family|marriage|wife|husband|child|home|kids|parent|parents)\b/i, category: 'Family & Marriage' },
    { pattern: /\b(?:hajj|umrah|pilgrimage|pilgrim|makkah|madinah)\b/i, category: 'Hajj & Umrah' },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(t)) return rule.category;
  }

  return 'Praise & Remembrance';
}

async function main() {
  console.log('Fetching Hisn al-Muslim dataset from GitHub...');
  const res = await fetch('https://raw.githubusercontent.com/wafaaelmaandy/Hisn-Muslim-Json/master/husn_en.json');
  if (!res.ok) {
    throw new Error(`Failed to fetch dataset: ${res.status} ${res.statusText}`);
  }

  const rawData = await res.json();
  const rawChapters = rawData[Object.keys(rawData)[0]];

  console.log(`Fetched ${rawChapters.length} raw chapters. Processing and standardizing...`);

  const chapters = rawChapters
    .map(ch => ({
      id: ch.ID,
      title: ch.TITLE.trim(),
      category: getCategory(ch.TITLE),
      audioUrl: ch.AUDIO_URL ? ch.AUDIO_URL.replace(/^http:\/\//, 'https://') : '',
      items: (ch.TEXT || [])
        .map(item => ({
          id: item.ID,
          arabic: item.ARABIC_TEXT || item.Text || '',
          transliteration: item.LANGUAGE_ARABIC_TRANSLATED_TEXT ? item.LANGUAGE_ARABIC_TRANSLATED_TEXT.trim() : '',
          translation: item.TRANSLATED_TEXT ? item.TRANSLATED_TEXT.trim() : '',
          count: item.REPEAT || 1,
          audio: item.AUDIO ? item.AUDIO.replace(/^http:\/\//, 'https://') : ''
        }))
        .filter(item => item.arabic || item.transliteration || item.translation)
    }))
    .filter(ch => ch.title && ch.items.length > 0);

  const jsonStr = JSON.stringify(chapters, null, 2);

  // 1. Write to web app data directory
  const webDataDir = path.join(__dirname, '../src/data');
  if (!fs.existsSync(webDataDir)) fs.mkdirSync(webDataDir, { recursive: true });
  const webFilePath = path.join(webDataDir, 'hisn-almuslim.json');
  fs.writeFileSync(webFilePath, jsonStr, 'utf8');
  console.log(`Saved web dataset to: ${webFilePath}`);

  // 2. Write to mobile app data directory
  const mobileDataDir = path.join(__dirname, '../mobile/noor-library/src/data');
  if (!fs.existsSync(mobileDataDir)) fs.mkdirSync(mobileDataDir, { recursive: true });
  const mobileFilePath = path.join(mobileDataDir, 'hisn-almuslim.json');
  fs.writeFileSync(mobileFilePath, jsonStr, 'utf8');
  console.log(`Saved mobile dataset to: ${mobileFilePath}`);

  // 3. Optionally seed to Firestore if .env.local exists
  const envPath = path.join(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    try {
      const admin = require('firebase-admin');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const env = {};
      for (const line of envContent.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }

      if (env.FIREBASE_ADMIN_PROJECT_ID && env.FIREBASE_ADMIN_CLIENT_EMAIL && env.FIREBASE_ADMIN_PRIVATE_KEY) {
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: env.FIREBASE_ADMIN_PROJECT_ID,
              clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
              privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
          });
        }
        const db = admin.firestore();
        console.log('Seeding hisn_meta/all to Firestore...');
        await db.collection('hisn_meta').doc('all').set({
          chapters,
          updatedAt: new Date().toISOString(),
          count: chapters.length
        });
        console.log('Successfully seeded hisn_meta/all in Firestore! ✨');
      }
    } catch (e) {
      console.warn('Firestore seeding skipped or failed (local bundle will be used):', e.message);
    }
  }

  console.log(`\nCompleted! Total chapters: ${chapters.length}`);
}

main().catch(err => {
  console.error('Error during execution:', err);
  process.exit(1);
});
