import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { editions } from '../data/edition.js';
dotenv.config({ path: process.env.CONFIG_PATH || path.join(process.cwd(), 'config.env') });


const DATA_VERSE_DIR = path.join(process.cwd(), 'data', 'verses');
const DATA_SURAH_DIR = path.join(process.cwd(), 'data', 'surah');
const DATA_SURAH_INDEX = path.join(process.cwd(), 'data', 'surah.json');
const VALID_AUDIO_BITRATES = ['192','128','64','48','40','32'];
let AUDIO_BITRATE = (process.env.AUDIO_BITRATE || '128').toString();
const _m = AUDIO_BITRATE.match(/(\d+)/);
if (_m) AUDIO_BITRATE = _m[1];
if (!VALID_AUDIO_BITRATES.includes(AUDIO_BITRATE)) {
  console.warn(`AUDIO_BITRATE '${process.env.AUDIO_BITRATE}' is invalid — falling back to '128' (valid: ${VALID_AUDIO_BITRATES.join(',')})`);
  AUDIO_BITRATE = '128';
}

async function ensureDir(dir) { try { await fs.mkdir(dir, { recursive: true }); } catch (e) {} }

async function readJson(file) { try { const t = await fs.readFile(file, 'utf8'); return JSON.parse(t); } catch (e) { return null; } }
async function writeJson(file, obj) { await ensureDir(path.dirname(file)); await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf8'); }

// small delay between surah upserts to avoid DB write bursts (ms)
const SURAH_DELAY_MS = parseInt(process.env.SURAH_DELAY_MS || '100', 10);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  await ensureDir(DATA_SURAH_DIR);
  console.log('Building per-edition surah files and writing to', DATA_SURAH_DIR);

  for (const editionMeta of editions) {
    const editionId = editionMeta.identifier;
    console.log(`Processing edition ${editionId} -> building surah file...`);
    const verseFile = path.join(DATA_VERSE_DIR, `${editionId}.json`);
    const editionAyahs = await readJson(verseFile) || [];
    if (!editionAyahs || editionAyahs.length === 0) {
      console.warn(`  No verses found for edition ${editionId} in ${verseFile}. Run import-verse first or provide edition list.`);
      continue;
    }

    // if surah index already lists this edition as complete (114 surahs), skip
    const surahIndex = (await readJson(DATA_SURAH_INDEX)) || [];
    const existingIndex = surahIndex.find(i => i.identifier === editionId);
    if (existingIndex && existingIndex.surahCount >= 114) {
      console.log(`  Skipping edition ${editionId} — surah file already exists with ${existingIndex.surahCount} surahs`);
      continue;
    }

    // group by surah number
    const surahMap = new Map();
    for (const a of editionAyahs) {
      const sn = a.surah.number;
      if (!surahMap.has(sn)) surahMap.set(sn, { number: sn, name: a.surah.name, englishName: a.surah.englishName, englishNameTranslation: a.surah.englishNameTranslation, numberOfAyahs: a.surah.numberOfAyahs || 0, revelationType: a.surah.revelationType, ayahs: [] });
      const cur = surahMap.get(sn);
      // avoid duplicate ayahs with same number
      if (!cur.ayahs.some(x => x.number === a.number)) {
        cur.ayahs.push({ number: a.number, numberInSurah: a.numberInSurah, text: a.text, audio: a.audio, audioSecondary: a.audioSecondary || [], sajda: a.sajda, verseImage: a.verseImage });
      }
    }

    const surahArr = Array.from(surahMap.keys()).sort((x,y)=>x-y).map(k=>{
      const s = surahMap.get(k);
      // add surah-level audio for this edition
      s.surahAudioUrl = `https://cdn.islamic.network/quran/audio-surah/${AUDIO_BITRATE}/${editionId}/${s.number}.mp3`;
      return s;
    });

    // write per-edition surah file
    const outFile = path.join(DATA_SURAH_DIR, `${editionId}.json`);
    try {
      await writeJson(outFile, surahArr);
      console.log(`  Wrote ${surahArr.length} surahs for edition ${editionId} to ${outFile}`);
    } catch (err) {
      console.error(`  Failed to write surah file for ${editionId}:`, err.message);
    }

  // update surah index (re-read to avoid races)
  const updatedSurahIndex = (await readJson(DATA_SURAH_INDEX)) || [];
  const existing = updatedSurahIndex.find(i => i.identifier === editionId);
  if (existing) { existing.path = `data/surah/${editionId}.json`; existing.surahCount = surahArr.length; }
  else updatedSurahIndex.push({ identifier: editionId, path: `data/surah/${editionId}.json`, surahCount: surahArr.length });
  try { await writeJson(DATA_SURAH_INDEX, updatedSurahIndex); } catch (err) { console.error('  Failed to update surah index:', err.message); }

    await sleep(SURAH_DELAY_MS);
  }

  console.log('Done');
  process.exit(0);
}

main().catch(err=>{ console.error(err); process.exit(1); });
