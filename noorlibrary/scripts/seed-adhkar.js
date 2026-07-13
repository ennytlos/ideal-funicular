// scripts/seed-adhkar.js
// Node.js CLI script to seed Morning/Evening Adhkar into Firestore.
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
  process.exit(1);
}

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

// 2. Fetch and seed Adhkar data
async function seedAdhkar() {
  try {
    const detailUrl = 'https://raw.githubusercontent.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB/main/result/en.json';
    console.log('Fetching Adhkar data from GitHub...');
    
    const res = await fetch(detailUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch Adhkar: ${res.statusText}`);
    }
    
    const adhkarList = await res.json();
    console.log(`Fetched ${adhkarList.length} supplications.`);

    // Save to Firestore under adhkar_meta/all
    console.log('Saving all Adhkar supplications to Firestore under adhkar_meta/all...');
    await db.collection('adhkar_meta').doc('all').set({
      adhkar: adhkarList,
      updatedAt: new Date().toISOString()
    });

    console.log('Adhkar database seeding completed successfully! ✨');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed with error:', error);
    process.exit(1);
  }
}

seedAdhkar();
