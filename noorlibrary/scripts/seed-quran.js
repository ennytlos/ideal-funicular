// scripts/seed-quran.js
// Node.js CLI script to seed Quran chapters and verses into Firestore.
// Reads credentials from .env.local in the project root.

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// 1. Parse .env.local to get Firebase Admin credentials
function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local file not found at:', envPath);
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  const lines = envContent.split(/\r?\n/);
  for (const line of lines) {
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
  return env;
}

const env = loadEnv();
const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL;
let privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error('Error: Missing Firebase Admin environment variables in .env.local!');
  console.error('Make sure FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY are defined.');
  process.exit(1);
}

// Format private key correctly (handling literal \n string escapes)
privateKey = privateKey.replace(/\\n/g, '\n');

console.log('Initializing Firebase Admin...');
admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey,
  })
});

const db = admin.firestore();

// 2. Fetch all Surah data and seed Firestore
async function seedQuran() {
  try {
    console.log('Fetching Surah index from GitHub...');
    const indexRes = await fetch('https://raw.githubusercontent.com/risan/quran-json/master/dist/chapters/index.json');
    if (!indexRes.ok) {
      throw new Error(`Failed to fetch index: ${indexRes.status} ${indexRes.statusText}`);
    }
    const indexData = await indexRes.json();
    console.log(`Found ${indexData.length} Surahs in the index.`);

    const surahsMetaList = [];
    
    // Process surahs with a concurrency limit of 5 to avoid overwhelming the network
    const concurrencyLimit = 5;
    for (let i = 0; i < indexData.length; i += concurrencyLimit) {
      const chunk = indexData.slice(i, i + concurrencyLimit);
      
      const promises = chunk.map(async (surahMeta) => {
        const surahId = surahMeta.id;
        const detailUrl = `https://raw.githubusercontent.com/risan/quran-json/master/dist/chapters/en/${surahId}.json`;
        
        console.log(`[Fetching] Surah ${surahId} (${surahMeta.transliteration})...`);
        const res = await fetch(detailUrl);
        if (!res.ok) {
          throw new Error(`Failed to fetch Surah ${surahId}: ${res.statusText}`);
        }
        
        const surahDetails = await res.json();
        
        // Save metadata for the general index
        surahsMetaList.push({
          id: surahDetails.id,
          name: surahDetails.name,
          transliteration: surahDetails.transliteration,
          translation: surahDetails.translation,
          type: surahDetails.type,
          total_verses: surahDetails.total_verses
        });

        // Write Surah document to Firestore 'quran' collection
        // Document ID is the Surah ID as string
        console.log(`[Saving] Surah ${surahId} to Firestore...`);
        await db.collection('quran').doc(surahId.toString()).set(surahDetails);
      });

      await Promise.all(promises);
    }

    // Sort the metadata list by id to guarantee correct order
    surahsMetaList.sort((a, b) => a.id - b.id);

    // Save the metadata index document to 'quran_meta/index'
    console.log('[Saving] Surah index metadata to Firestore...');
    await db.collection('quran_meta').doc('index').set({
      surahs: surahsMetaList,
      updatedAt: new Date().toISOString()
    });

    console.log('\nQuran seeding completed successfully! ✨');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed with error:', error);
    process.exit(1);
  }
}

seedQuran();
