import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: process.env.CONFIG_PATH || path.join(process.cwd(), 'config.env') });

import mongoose from 'mongoose';
import axios from 'axios';
import Ayah from '../model/ayah.js';
import Surah from '../model/surah.js';
import { editions } from '../data/edition.js';

const MONGO_URI = process.env.QURAN_MONGODB_URI;
if (!MONGO_URI) {
  console.error('Missing QURAN_MONGODB_URI in config.env');
  process.exit(1);
}

// Controls
// AYAH_DELAY_MS: ms to wait between individual ayah requests (default 300ms)
// EDITION_DELAY_MS: ms to wait between editions for the same surah (default 1000ms)
// CLEAR_DB=true will wipe Ayah and Surah collections before starting
const SLEEP_MS = parseInt(process.env.AYAH_DELAY_MS || '300', 10);
const EDITION_DELAY_MS = parseInt(process.env.EDITION_DELAY_MS || '1000', 10);
const START_SURAH = 1; // start from first surah
const END_SURAH = 114; // end at 114
const DEFAULT_EDITIONS = ['ar.alafasy'];
const MAX_RETRIES = 4;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchSurahDetail(number) {
  const url = `http://api.alquran.cloud/v1/surah/${number}`;
  const res = await axios.get(url);
  if (res.data && res.data.code === 200) return res.data.data;
  throw new Error(`Failed to fetch surah ${number}`);
}

async function fetchAyah(surahNumber, verseNumber, translation) {
  const url = `https://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/${translation}`;
  let attempt = 0;
  let lastErr = null;
  while (attempt <= MAX_RETRIES) {
    try {
      const res = await axios.get(url);
      if (res.data && res.data.code === 200) return res.data.data;
      return null;
    } catch (err) {
      lastErr = err;
      // if rate limited, backoff
      if (err.response && err.response.status === 429) {
        const backoff = 500 * Math.pow(2, attempt); // exponential
        console.warn(`      429 received for ${surahNumber}:${verseNumber} (${translation}), backoff ${backoff}ms`);
        await sleep(backoff);
        attempt++;
        continue;
      }
      // other errors, break
      break;
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

async function upsertEditionForAyah(ayahNumber, editionEntry) {
  // editionEntry: { identifier, audio, audioSecondary, text, editionMeta }
  const existing = await Ayah.findOne({ number: ayahNumber }).lean();

  if (!existing) {
    // create base ayah doc with minimal fields plus editions array
    const base = {
      number: ayahNumber,
      audio: editionEntry.audio || null,
      audioSecondary: editionEntry.audioSecondary || [],
      text: editionEntry.text || null,
      verseImage: null,
      edition: editionEntry.editionMeta || null,
      editions: [editionEntry],
    };
    try {
      await Ayah.create(base);
      return true;
    } catch (err) {
      console.error(`    Create ayah ${ayahNumber} failed:`, err.message);
      return false;
    }
  }

  // if edition already exists, skip
  const hasEdition = (existing.editions || []).some(e => e && e.identifier === editionEntry.identifier);
  if (hasEdition) return false;

  try {
    await Ayah.updateOne({ number: ayahNumber }, { $push: { editions: editionEntry } });
    return true;
  } catch (err) {
    console.error(`    Failed to push edition for ayah ${ayahNumber}:`, err.message);
    return false;
  }
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // optional: clear previous data if requested
  if (process.env.CLEAR_DB === 'true') {
    console.log('CLEAR_DB=true: deleting Ayah and Surah collections...');
    try {
      await Ayah.deleteMany({});
      await Surah.deleteMany({});
      console.log('  Collections cleared');
    } catch (err) {
      console.error('  Failed to clear collections:', err.message);
    }
  }

  // process surahs sequentially from START_SURAH to END_SURAH
  for (let surahNumber = START_SURAH; surahNumber <= END_SURAH; surahNumber++) {
    console.log(`Processing Surah ${surahNumber}...`);
    let surahDetail;
    try {
      surahDetail = await fetchSurahDetail(surahNumber);
    } catch (err) {
      console.error(`  Failed to fetch surah ${surahNumber}:`, err.message);
      // continue to next surah
      continue;
    }

    const ayahs = surahDetail.ayahs || [];
    // select editions: if EDITION_LIST env provided, use it, else default
    const editionListEnv = process.env.EDITION_LIST || null;
    let identifiers = [];
    if (editionListEnv) identifiers = editionListEnv.split(',').map(s=>s.trim()).filter(Boolean);
    else identifiers = DEFAULT_EDITIONS.slice();

    const selected = identifiers.map(id => editions.find(e => e.identifier === id)).filter(Boolean);

    for (const editionMeta of selected) {
      console.log(`  Importing edition ${editionMeta.identifier} for surah ${surahNumber} (${ayahs.length} ayahs)`);
      for (const ay of ayahs) {
        const verse = ay.numberInSurah;
        try {
          const t = await fetchAyah(surahNumber, verse, editionMeta.identifier);
          if (!t) { console.warn(`    no data for ${editionMeta.identifier} ${surahNumber}:${verse}`); await sleep(SLEEP_MS); continue; }

          const verseImage = `https://cdn.islamic.network/quran/images/${surahNumber}_${verse}.png`;

          const editionEntry = {
            identifier: editionMeta.identifier,
            audio: t.audio || null,
            audioSecondary: t.audioSecondary || [],
            text: t.text || null,
            editionMeta: editionMeta
          };

          // create or update ayah with full fields
          const existing = await Ayah.findOne({ number: t.number }).lean();
          if (!existing) {
            const base = {
              number: t.number,
              audio: editionEntry.audio || null,
              audioSecondary: editionEntry.audioSecondary || [],
              text: editionEntry.text || null,
              verseImage,
              edition: editionEntry.editionMeta || null,
              editions: [editionEntry],
              surah: {
                number: surahDetail.number,
                name: surahDetail.name,
                englishName: surahDetail.englishName,
                englishNameTranslation: surahDetail.englishNameTranslation,
                numberOfAyahs: surahDetail.numberOfAyahs,
                revelationType: surahDetail.revelationType
              },
              numberInSurah: t.numberInSurah,
              juz: t.juz,
              manzil: t.manzil,
              page: t.page,
              ruku: t.ruku,
              hizbQuarter: t.hizbQuarter,
              sajda: t.sajda || false
            };
            try {
              await Ayah.create(base);
              console.log(`    created ayah ${t.number} (surah:${surahNumber},verse:${t.numberInSurah}) (edition ${editionMeta.identifier})`);
            } catch (err) {
              console.error(`    Create ayah ${t.number} (surah:${surahNumber},verse:${t.numberInSurah}) failed:`, err.message);
            }
          } else {
            // check if edition exists
            const hasEdition = (existing.editions || []).some(e => e && e.identifier === editionEntry.identifier);
            if (hasEdition) {
              // already have this edition for this ayah
              // ensure verseImage and main text/audio exist
              const updates = {};
              if (!existing.verseImage) updates.verseImage = verseImage;
              if (!existing.audio && editionEntry.audio) updates.audio = editionEntry.audio;
              if (!existing.text && editionEntry.text) updates.text = editionEntry.text;
              if (Object.keys(updates).length > 0) {
                try { await Ayah.updateOne({ number: t.number }, { $set: updates }); } catch (err) { console.error(`    Failed to update ayah ${t.number}:`, err.message); }
                console.log(`    updated metadata for ayah ${t.number} (surah:${surahNumber},verse:${t.numberInSurah})`);
              } else {
                console.log(`    skipped existing edition ${editionMeta.identifier} for ayah ${t.number}`);
              }
            } else {
              // push new edition
              try {
                await Ayah.updateOne({ number: t.number }, { $push: { editions: editionEntry } });
                console.log(`    pushed edition ${editionMeta.identifier} for ayah ${t.number} (surah:${surahNumber},verse:${t.numberInSurah})`);
              } catch (err) {
                console.error(`    Failed to push edition for ayah ${t.number}:`, err.message);
              }
            }
          }
        } catch (err) {
          console.error(`    Warning: failed to fetch ayah ${surahNumber}:${verse}:`, err.message);
        }
        await sleep(SLEEP_MS);
      }
      // wait a bit between editions to reduce pressure on external API
      await sleep(EDITION_DELAY_MS);
    }
    // surah finished, move to next surah
  }

  await mongoose.disconnect();
  console.log('Done');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
