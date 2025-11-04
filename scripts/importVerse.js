import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: process.env.CONFIG_PATH || path.join(process.cwd(), 'config.env') });

import axios from 'axios';
// set a reasonable default timeout for network requests (ms)
axios.defaults.timeout = parseInt(process.env.AXIOS_TIMEOUT || '15000', 10);
import fs from 'fs/promises';
import { editions } from '../data/edition.js';

// data paths
const DATA_AYAH_DIR = path.join(process.cwd(), 'data', 'verses');
const DATA_VERSE_INDEX = path.join(process.cwd(), 'data', 'verse.json');

async function ensureDir(dir) { try { await fs.mkdir(dir, { recursive: true }); } catch (e) { } }
async function writeJson(file, obj) { await ensureDir(path.dirname(file)); await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf8'); }
async function readJson(file) { try { const t = await fs.readFile(file, 'utf8'); return JSON.parse(t); } catch (e) { return null; } }

// Controls
// AYAH_DELAY_MS: ms to wait between individual ayah requests (default 300ms)
// EDITION_DELAY_MS: ms to wait between editions for the same surah (default 1000ms)
// CLEAR_DB=true will wipe Ayah and Surah collections before starting
const SLEEP_MS = parseInt(process.env.AYAH_DELAY_MS || '300', 10);
const EDITION_DELAY_MS = parseInt(process.env.EDITION_DELAY_MS || '1000', 10);
const START_SURAH = 1; // start from first surah
const END_SURAH = 114; // end at 114
const MAX_RETRIES = 4;
const CHECKPOINT_INTERVAL = parseInt(process.env.CHECKPOINT_INTERVAL || '1', 10); // Save after every surah by default
const VALID_AUDIO_BITRATES = ['192', '128', '64', '48', '40', '32'];
// flexible parsing: accept '128', 128, or '128kbps'
let AUDIO_BITRATE = (process.env.AUDIO_BITRATE || '128').toString();
const matchDigits = AUDIO_BITRATE.match(/(\d+)/);
if (matchDigits) AUDIO_BITRATE = matchDigits[1];
if (!VALID_AUDIO_BITRATES.includes(AUDIO_BITRATE)) {
  console.warn(`AUDIO_BITRATE '${process.env.AUDIO_BITRATE}' is invalid — falling back to '128' (valid: ${VALID_AUDIO_BITRATES.join(',')})`);
  AUDIO_BITRATE = '128';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchSurahDetail(number) {
  const url = `http://api.alquran.cloud/v1/surah/${number}`;
  const res = await axios.get(url);
  if (res.data && res.data.code === 200) return res.data.data;
  throw new Error(`Failed to fetch surah ${number}`);
}

async function fetchAllSurahMeta() {
  const url = `http://api.alquran.cloud/v1/surah`;
  const res = await axios.get(url);
  if (res.data && res.data.code === 200) return res.data.data;
  throw new Error('Failed to fetch surah list');
}

async function fetchAyah(surahNumber, verseNumber, translation) {
  const url = `https://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/${translation}`;
  let attempt = 0;
  let lastErr = null;
  while (attempt <= MAX_RETRIES) {
    try {
      const res = await axios.get(url);
      if (res.data && res.data.code === 200) return res.data.data;
      // if API responds but not 200, treat as no-data
      return null;
    } catch (err) {
      lastErr = err;
      const status = err.response && err.response.status;
      // if rate limited, backoff
      if (status === 429) {
        const backoff = 500 * Math.pow(2, attempt); // exponential
        console.warn(`      429 received for ${surahNumber}:${verseNumber} (${translation}), backoff ${backoff}ms`);
        await sleep(backoff);
        attempt++;
        continue;
      }

      // if transient network error or 5xx, retry with backoff
      const transient = !err.response || (status >= 500 && status < 600) || err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.code === 'EAI_AGAIN';
      if (transient && attempt < MAX_RETRIES) {
        const backoff = 300 * Math.pow(2, attempt);
        console.warn(`      transient error for ${surahNumber}:${verseNumber} (${translation}): ${err.message}, retrying in ${backoff}ms`);
        await sleep(backoff);
        attempt++;
        continue;
      }

      // not recoverable or max attempts reached
      break;
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

// legacy helper removed - storing directly to JSON files instead of DB

async function main() {
  // ensure data folders exist
  await ensureDir(DATA_AYAH_DIR);
  console.log('Storing per-edition verse files under', DATA_AYAH_DIR);

  // process editions one-by-one: fetch all verses for an edition, write file, then move to next
  const editionListEnv = process.env.EDITION_LIST || null;
  let selectedEditions = [];
  if (editionListEnv) {
    const identifiers = editionListEnv.split(',').map(s => s.trim()).filter(Boolean);
    selectedEditions = identifiers.map(id => editions.find(e => e.identifier === id)).filter(Boolean);
  } else {
    selectedEditions = editions.slice();
  }

  // fetch surah metadata once
  const surahMeta = await fetchAllSurahMeta().catch(() => null) || [];
  const TOTAL_AYAHS = surahMeta.length ? surahMeta.reduce((s, x) => s + (x.numberOfAyahs || 0), 0) : null;

  // Setup signal handlers once for all editions (not per-edition)
  let currentEditionState = null;
  const saveAndExit = async () => {
    try {
      if (currentEditionState) {
        await writeJson(currentEditionState.bufferFile, currentEditionState.buffer);
        console.log(`\nSaved progress for ${currentEditionState.editionId}: ${currentEditionState.buffer.length} verses to ${currentEditionState.bufferFile}`);
      }
    } catch (e) { console.error('Failed to save progress on exit:', e.message); }
    process.exit(0);
  };
  process.once('SIGINT', saveAndExit);
  process.once('SIGTERM', saveAndExit);

  // Helper function to fetch verses for an edition (supports resume)
  async function continueEditionFetch(editionId, editionMeta, buffer, seen, bufferFile, surahMeta) {
    for (let surahNumber = START_SURAH; surahNumber <= END_SURAH; surahNumber++) {
      const meta = surahMeta.find(s => s.number === surahNumber);
      let numAyahs = meta ? meta.numberOfAyahs : null;
      if (!numAyahs) {
        try { const sd = await fetchSurahDetail(surahNumber); numAyahs = sd.ayahs.length; } catch (e) { console.warn(`  Could not get ayah count for surah ${surahNumber}:`, e.message); continue; }
      }
      
      // Check if we already have all verses for this surah
      const surahVerses = buffer.filter(v => v.surah.number === surahNumber);
      if (surahVerses.length >= numAyahs) {
        console.log(`  Surah ${surahNumber} already complete (${surahVerses.length}/${numAyahs} ayahs). Skipping.`);
        continue;
      }

      console.log(`  Fetching Surah ${surahNumber} (${numAyahs} ayahs)`);
      for (let verse = 1; verse <= numAyahs; verse++) {
        try {
          const t = await fetchAyah(surahNumber, verse, editionId);
          if (!t) { console.warn(`    no data for ${editionId} ${surahNumber}:${verse}`); await sleep(SLEEP_MS); continue; }
          if (seen.has(t.number)) { /* already have this ayah */ await sleep(SLEEP_MS); continue; }
          const verseImage = `https://cdn.islamic.network/quran/images/${surahNumber}_${verse}.png`;
          const ayahObj = {
            number: t.number,
            numberInSurah: t.numberInSurah,
            juz: t.juz,
            manzil: t.manzil,
            page: t.page,
            ruku: t.ruku,
            hizbQuarter: t.hizbQuarter,
            sajda: (t && typeof t.sajda === 'object') ? t.sajda : !!t.sajda,
            text: t.text || null,
            audio: t.audio || null,
            audioSecondary: t.audioSecondary || [],
            verseImage,
            surah: {
              number: surahNumber,
              name: meta?.name || null,
              englishName: meta?.englishName || null,
              englishNameTranslation: meta?.englishNameTranslation || null,
              numberOfAyahs: meta?.numberOfAyahs || numAyahs,
              revelationType: meta?.revelationType || null
            },
            edition: editionMeta.identifier,
            editionMeta: editionMeta,
            verseAudioUrl: `https://cdn.islamic.network/quran/audio/${AUDIO_BITRATE}/${editionMeta.identifier}/${t.number}.mp3`
          };
          buffer.push(ayahObj);
          seen.add(t.number);
          // Update progress on same line
          process.stdout.write(`\r    Progress: ${verse}/${numAyahs} ayahs`);
        } catch (err) {
          console.error(`    Warning: failed to fetch ayah ${surahNumber}:${verse} for ${editionId}:`, err.message);
        }
        await sleep(SLEEP_MS);
      }
      console.log(''); // New line after progress completes
      
      // Checkpoint: Save progress every N surahs to prevent data loss on errors
      if (surahNumber % CHECKPOINT_INTERVAL === 0 || surahNumber === END_SURAH) {
        try {
          await writeJson(bufferFile, buffer);
          console.log(`  ✓ Checkpoint: Saved ${buffer.length} verses after Surah ${surahNumber}`);
        } catch (e) {
          console.error(`  ✗ Checkpoint failed for Surah ${surahNumber}:`, e.message);
        }
      }
    }
    
    // Final write and update index
    try {
      await writeJson(bufferFile, buffer);
      console.log(`Wrote ${buffer.length} verses to ${bufferFile}`);
      const verseIndex = await readJson(DATA_VERSE_INDEX) || {};
      verseIndex[editionId] = { count: buffer.length, file: path.basename(bufferFile), editionMeta };
      await writeJson(DATA_VERSE_INDEX, verseIndex);
      console.log(`Updated verse index for ${editionId}`);
      return true;
    } catch (err) {
      console.error(`Failed to finalize edition ${editionId}:`, err.message);
      return false;
    }
  }

  const FORCE_REPROCESS = process.env.FORCE_REPROCESS === 'true';
  
  for (const editionMeta of selectedEditions) {
    const editionId = editionMeta.identifier;
    console.log(`Starting edition ${editionId} — will fetch all verses then write ${editionId}.json`);
    // load previous buffer to resume if exists
    const bufferFile = path.join(DATA_AYAH_DIR, `${editionId}.json`);
    const existingData = await readJson(bufferFile);
    
    // if we have existing data, validate it first
    if (existingData && Array.isArray(existingData)) {
      console.log(`  Found existing file with ${existingData.length} verses`);
      // if already complete, skip entirely
      if (TOTAL_AYAHS && existingData.length >= TOTAL_AYAHS) {
        console.log(`  Edition ${editionId} is complete (${existingData.length} ayahs). Skipping.`);
        currentEditionState = null;
        continue;
      }
      // If partial and FORCE_REPROCESS not set, resume from existing data
      if (existingData.length > 0 && !FORCE_REPROCESS) {
        console.log(`  Edition ${editionId} has partial data (${existingData.length} verses). Resuming...`);
        // Load existing data to resume
        const buffer = existingData;
        const seen = new Set(buffer.map(b => b.number));
        currentEditionState = { editionId, bufferFile, buffer };
        
        // Continue fetching from where we left off
        let resumeSuccess = false;
        try {
          resumeSuccess = await continueEditionFetch(editionId, editionMeta, buffer, seen, bufferFile, surahMeta);
        } catch (err) {
          console.error(`  Resume failed for ${editionId}:`, err.message);
        }
        
        if (resumeSuccess) {
          currentEditionState = null;
          await sleep(EDITION_DELAY_MS);
          continue;
        }
        // If resume failed, fall through to fresh start
      }
    }
    
    // Start fresh - don't load existing data to avoid append bugs
    const buffer = [];
    const seen = new Set();
    // expose current edition state to signal handler
    currentEditionState = { editionId, bufferFile, buffer };

    // Use the shared fetch function
    let success = false;
    try {
      success = await continueEditionFetch(editionId, editionMeta, buffer, seen, bufferFile, surahMeta);
    } catch (err) {
      console.error(`  Fetch failed for ${editionId}:`, err.message);
    }

    // clear state after edition is done (success or fail)
    currentEditionState = null;
    await sleep(EDITION_DELAY_MS);
  }

  // clear signal handler reference after all editions complete
  currentEditionState = null;
  console.log('Done - all editions processed');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
