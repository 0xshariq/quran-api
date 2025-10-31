import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: process.env.CONFIG_PATH || path.join(process.cwd(), 'config.env') });

import mongoose from 'mongoose';
import axios from 'axios';
import AllSurah from '../model/surahs.js';

const MONGO_URI = process.env.QURAN_MONGODB_URI;
if (!MONGO_URI) {
  console.error('Missing QURAN_MONGODB_URI in config.env');
  process.exit(1);
}

async function fetchAllSurahs() {
  const url = 'http://api.alquran.cloud/v1/surah';
  const res = await axios.get(url);
  if (res.data && res.data.code === 200) return res.data.data;
  throw new Error('Failed to fetch surah list');
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const surahList = await fetchAllSurahs();
  console.log(`Fetched ${surahList.length} surahs from API`);

  for (const s of surahList) {
    const doc = {
      number: s.number,
      name: s.name,
      englishName: s.englishName,
      englishNameTranslation: s.englishNameTranslation,
      numberOfAyahs: s.numberOfAyahs,
      revelationType: s.revelationType
    };
    try {
      // upsert by number to avoid duplicates
      await AllSurah.findOneAndUpdate({ number: doc.number }, doc, { upsert: true, new: true, setDefaultsOnInsert: true });
      console.log(`  Upserted surah ${s.number} - ${s.englishName}`);
    } catch (err) {
      console.error(`  Failed surah ${s.number}:`, err.message);
    }
  }

  await mongoose.disconnect();
  console.log('Done');
  process.exit(0);
}

main().catch(err=>{ console.error(err); process.exit(1); });
