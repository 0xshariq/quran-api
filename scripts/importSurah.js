import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: process.env.CONFIG_PATH || path.join(process.cwd(), 'config.env') });

import mongoose from 'mongoose';
import Surah from '../model/surah.js';
import Ayah from '../model/ayah.js';
import { editions } from '../data/edition.js';

// small delay between surah upserts to avoid DB write bursts (ms)
const SURAH_DELAY_MS = parseInt(process.env.SURAH_DELAY_MS || '100', 10);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const MONGO_URI = process.env.QURAN_MONGODB_URI;
if (!MONGO_URI) {
  console.error('Missing QURAN_MONGODB_URI in config.env');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const START_SURAH = 1;
  const END_SURAH = 114;

  for (let surahNumber = START_SURAH; surahNumber <= END_SURAH; surahNumber++) {
    console.log(`Building Surah ${surahNumber} from Ayah collection...`);
    const ayahs = await Ayah.find({ 'surah.number': surahNumber }).sort({ numberInSurah: 1 }).lean();
    if (!ayahs || ayahs.length === 0) {
      console.warn(`  No ayahs found in DB for surah ${surahNumber}. Skipping (run import-verse first).`);
      continue;
    }

    const sample = ayahs[0];
    const surahDoc = {
      number: surahNumber,
      name: sample?.surah?.name || null,
      englishName: sample?.surah?.englishName || null,
      englishNameTranslation: sample?.surah?.englishNameTranslation || null,
      numberOfAyahs: sample?.surah?.numberOfAyahs || ayahs.length,
      revelationType: sample?.surah?.revelationType || null,
      ayahs: ayahs.map(a => ({
        number: a.number,
        text: a.text,
        numberInSurah: a.numberInSurah,
        juz: a.juz,
        manzil: a.manzil,
        page: a.page,
        ruku: a.ruku,
        hizbQuarter: a.hizbQuarter,
  sajda: (typeof a.sajda === 'object') ? a.sajda : !!a.sajda,
        verseImage: a.verseImage || null
      })),
      // include all edition metadata from data/edition.js
      editions: editions.slice(),
    };

    // build surahAudio: aggregate for editions which have audio in ayahs (first occurrence)
    const audioMap = new Map();
    for (const a of ayahs) {
      for (const ed of (a.editions || [])) {
        if (ed && ed.identifier && ed.audio && !audioMap.has(ed.identifier)) audioMap.set(ed.identifier, ed.audio);
      }
    }
    if (audioMap.size > 0) {
      surahDoc.surahAudio = Array.from(audioMap.entries()).map(([identifier, audio]) => ({ identifier, audio }));
    } else {
      surahDoc.surahAudio = [];
    }

    // upsert surah - avoids duplicates using upsert by number
    try {
      await Surah.findOneAndUpdate({ number: surahDoc.number }, surahDoc, { upsert: true, new: true, setDefaultsOnInsert: true });
      console.log(`  Surah ${surahDoc.number} upserted with ${surahDoc.ayahs.length} ayahs`);
    } catch (err) {
      console.error(`  Failed to upsert Surah ${surahNumber}:`, err.message);
    }

    // small pause between surah operations
    await sleep(SURAH_DELAY_MS);
  }

  await mongoose.disconnect();
  console.log('Done');
  process.exit(0);
}

main().catch(err=>{ console.error(err); process.exit(1); });
