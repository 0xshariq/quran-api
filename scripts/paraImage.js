import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: process.env.CONFIG_PATH || path.join(process.cwd(), 'config.env') });
import mongoose from 'mongoose';
import fs from 'fs/promises';
import ParaImages from '../model/para-images.js';

function usage() {
  console.log('Usage: node ./scripts/paraImage.js <paraNumber:pageNumber> OR node ./scripts/paraImage.js <paraNumber> <pageNumber>');
  process.exit(1);
}

const args = process.argv.slice(2);

let paraNumber, pageNumber;
if (args.length === 0) {
  // will process all paras 1..30
  paraNumber = null;
  pageNumber = null;
} else if (args.length === 1 && args[0].includes(':')) {
  [paraNumber, pageNumber] = args[0].split(':');
} else if (args.length >= 2) {
  paraNumber = args[0];
  pageNumber = args[1];
} else {
  usage();
}

// helper parse and validate
function validatePara(n) {
  const v = parseInt(n, 10);
  if (isNaN(v) || v < 1 || v > 30) return null;
  return v;
}

// helper: read local folder to determine page count for a given para if available
async function getLocalPageCount(pNum) {
  const localDir = path.join(process.cwd(), 'public', 'assets', 'para-images', `Para-${pNum}`);
  try {
    const files = await fs.readdir(localDir);
    return files.filter(f => /\.(png|jpg|jpeg)$/i.test(f)).length;
  } catch (err) {
    return 0;
  }
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

async function processPara(pNum, pgNum = null) {
  if (!validatePara(pNum)) {
    console.error('Invalid paraNumber. Must be between 1 and 30.');
    return;
  }

  const localCount = await getLocalPageCount(pNum);
  let pagesToProcess = [];
  if (pgNum) {
    pagesToProcess = [pgNum];
  } else if (localCount > 0) {
    // process from first to last
    for (let p = 1; p <= localCount; p++) pagesToProcess.push(p);
  } else {
    // fallback: assume default pages per para
    let maxPages = 20;
    if (pNum === 1) maxPages = 21;
    else if (pNum === 29) maxPages = 24;
    else if (pNum === 30) maxPages = 25;
    for (let p = 1; p <= maxPages; p++) pagesToProcess.push(p);
  }

  for (const p of pagesToProcess) {
    const url = `${base}/para-images/Para-${pNum}/${p}.png`;
    await ParaImages.findOneAndUpdate(
      { paraNumber: pNum, pageNumber: p },
      { paraNumber: pNum, pageNumber: p, imageUrl: url },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(JSON.stringify({ para: pNum, page: p, url }));
  }
}

async function main() {
  try {
    await mongoose.connect(MONGO_URI);

    if (paraNumber === null) {
      // process all paras sequentially from 1..30
      for (let p = 1; p <= 30; p++) {
        await processPara(p, null);
      }
    } else {
      const p = validatePara(paraNumber);
      if (!p) { console.error('Invalid paraNumber. Must be between 1 and 30.'); process.exit(4); }
      const pg = pageNumber && !isNaN(pageNumber) ? parseInt(pageNumber, 10) : null;
      await processPara(p, pg);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to save para image(s):', err.message || err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(6);
  }
}

main();
