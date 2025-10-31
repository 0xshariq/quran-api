import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import mongoose from 'mongoose';
import { surahs } from '../data/surah.js';
import SurahImages from '../model/surah-images.js';

dotenv.config({ path: process.env.CONFIG_PATH || path.join(process.cwd(), 'config.env') });

function usage() {
  console.log('Usage: node ./scripts/surahImage.js <surahNumber:pageNumber> OR node ./scripts/surahImage.js <surahNumber> <pageNumber>');
  process.exit(1);
}

const args = process.argv.slice(2);

let surahNumber, pageNumber;
if (args.length === 0) {
  surahNumber = null; // process all surahs
  pageNumber = null;
} else if (args.length === 1 && args[0].includes(':')) {
  [surahNumber, pageNumber] = args[0].split(':');
} else if (args.length >= 2) {
  surahNumber = args[0];
  pageNumber = args[1];
} else {
  usage();
}

function validateSurah(n) {
  const v = parseInt(n, 10);
  if (isNaN(v) || v < 1 || v > 114) return null;
  return v;
}

const base = process.env.IMAGEKIT_URL;
const MONGO_URI = process.env.QURAN_MONGODB_URI;
if (!base) {
  console.error('Missing IMAGEKIT_URL in config.env');
  process.exit(2);
}
if (!MONGO_URI) {
  console.error('Missing QURAN_MONGODB_URI in config.env');
  process.exit(3);
}

// processSurah will compute local folder and perform validation per-surah

async function processSurah(sNum, pgNum = null) {
  const s = validateSurah(sNum);
  if (!s) {
    console.error('Invalid surah number:', sNum);
    return;
  }
  const surahObj = surahs.find(x => x.number === s);
  const name = `${s}.${surahObj.name.replace(/\s+/g, '-').replace(/'/g, '')}`;
  const maxPagesLocal = await (async () => {
    const parentDir = path.join(process.cwd(), 'public', 'assets', 'surah-images');
    try {
      const entries = await fs.readdir(parentDir, { withFileTypes: true });
      // try to find a directory that starts with the surah number + '.' (handles punctuation differences)
      const dirNames = entries.filter(en => en.isDirectory()).map(en => en.name);
      // try several matching strategies to tolerate punctuation/apostrophes/etc.
      let candidate = null;
      const targetSanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '');

      // 1) exact startsWith like '5.' (fast and reliable)
      candidate = dirNames.find(d => d.startsWith(`${s}.`));
      if (!candidate) {
        // 2) exact case-insensitive match
        candidate = dirNames.find(d => d.toLowerCase() === name.toLowerCase());
      }
      if (!candidate) {
        // 3) normalized comparison: remove non-alphanumerics and compare
        candidate = dirNames.find(d => {
          const dn = d.toLowerCase().replace(/[^a-z0-9]/g, '');
          return dn === targetSanitized;
        });
      }
      if (!candidate) {
        // 4) fallback: directory that starts with the surah number (e.g. '5' or '5.') after normalization
        candidate = dirNames.find(d => {
          const dn = d.toLowerCase().replace(/[^a-z0-9]/g, '');
          return dn.startsWith(String(s));
        });
      }
      if (!candidate) return 0;
      const localDir = path.join(parentDir, candidate);
      const files = await fs.readdir(localDir);
      return files.filter(f => /\.(png|jpg|jpeg)$/i.test(f)).length;
    } catch (e) {
      return 0;
    }
  })();

  if (pgNum && isNaN(pgNum)) {
    console.error('Invalid pageNumber');
    return;
  }

  let pagesToProcess = [];
  if (pgNum) {
    pagesToProcess = [pgNum];
  } else {
    if (maxPagesLocal <= 0) {
      console.error(`No local pages found for surah ${name} at public/assets/surah-images/${name}`);
      return;
    }
    for (let p = 1; p <= maxPagesLocal; p++) pagesToProcess.push(p);
  }

  for (const p of pagesToProcess) {
    const url = `${base}/${'surah-images'}/${name}/${p}.png`;
    await SurahImages.findOneAndUpdate(
      { surahNumber: s, pageNumber: p },
      { surahNumber: s, pageNumber: p, imageUrl: url },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(JSON.stringify({ surah: s, page: p, url }));
  }
}

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    if (surahNumber === null) {
      for (let s = 1; s <= 114; s++) {
        await processSurah(s, null);
      }
    } else {
      const s = validateSurah(surahNumber);
      if (!s) { console.error('Invalid surah number'); process.exit(4); }
      const pg = pageNumber && !isNaN(pageNumber) ? parseInt(pageNumber, 10) : null;
      await processSurah(s, pg);
    }
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to save surah images:', err.message || err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(7);
  }
}

main();
