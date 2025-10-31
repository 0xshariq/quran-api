#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: process.env.CONFIG_PATH || path.join(process.cwd(), 'config.env') });

import mongoose from 'mongoose';
import Ayah from '../model/ayah.js';
import Surah from '../model/surah.js';
import AllSurah from '../model/surahs.js';

const MONGO_URI = process.env.QURAN_MONGODB_URI;
if (!MONGO_URI) {
  console.error('Missing QURAN_MONGODB_URI in config.env');
  process.exit(1);
}

const valid = {
  Ayah: Ayah,
  Surah: Surah,
  AllSurah: AllSurah
};

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node ./scripts/delete.js {modelName}');
    console.error('modelName must be one of: ' + Object.keys(valid).join(', '));
    process.exit(1);
  }

  const modelName = arg.trim();
  if (!valid[modelName]) {
    console.error(`Unknown model name: "${modelName}"`);
    console.error('Valid names:', Object.keys(valid).join(', '));
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(MONGO_URI);

  const model = valid[modelName];

  // Confirm destructive action
  console.log(`About to delete all documents in collection for model: ${modelName}`);
  const prompt = process.env.NON_INTERACTIVE === 'true' ? 'y' : null;

  if (!prompt) {
    // simple interactive prompt
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ans = await new Promise(resolve => rl.question(`Type DELETE to confirm deleting all ${modelName} documents: `, a => { rl.close(); resolve(a); }));
    if (String(ans).trim() !== 'DELETE') {
      console.log('Aborted. To force non-interactive deletion set NON_INTERACTIVE=true');
      await mongoose.disconnect();
      process.exit(0);
    }
  }

  try {
    const res = await model.deleteMany({});
    console.log(`Deleted ${res.deletedCount || 0} documents from ${modelName}`);
  } catch (err) {
    console.error('Delete failed:', err.message);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
