// Inspect and optionally conform all MP3s in public/audio/sfx/ to the project standard:
//   Format:      MP3
//   Bitrate:     192 kbps
//   Sample rate: 44.1 kHz
//   Normalization:
//     < 1 s  -> -6 dBFS peak
//     >= 1 s -> -14 LUFS  (loudnorm=I=-14:LRA=7:TP=-1)
//
// Usage:
//   node scripts/sfx_conform.mjs            # check only, exit 1 if anything is out of spec
//   node scripts/sfx_conform.mjs --fix      # check and fix non-conforming files in place

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import {
  classify,
  MIN_SOURCE_BITRATE,
  TARGET_BITRATE,
  TARGET_SAMPLE_RATE,
  TARGET_PEAK_DBFS,
  TARGET_LUFS,
  DURATION_THRESHOLD,
} from './sfx/sfx_conform_rules.mjs';

const fix = process.argv.includes('--fix');
const root = process.cwd();
const sfxDir = path.join(root, 'public/audio/sfx');
const ffprobePath = ffprobeStatic.path;

function ffprobe(file) {
  const out = execFileSync(ffprobePath, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file,
  ]);
  return JSON.parse(out.toString());
}

function getStats(file) {
  const info = ffprobe(file);
  const stream = info.streams.find(s => s.codec_type === 'audio');
  const duration = parseFloat(info.format.duration ?? '0');
  const bitrate = Math.round(parseInt(info.format.bit_rate ?? '0') / 1000);
  const sampleRate = parseInt(stream?.sample_rate ?? '0');
  return { duration, bitrate, sampleRate };
}

// Returns the peak dBFS of a file using ffmpeg volumedetect.
// Throws if the output cannot be parsed rather than silently returning 0.
function getPeakDb(file) {
  const result = spawnSync(ffmpegPath, [
    '-hide_banner', '-i', file,
    '-af', 'volumedetect',
    '-f', 'null', '-',
  ], { encoding: 'utf8' });
  const match = (result.stderr || '').match(/max_volume:\s*([-\d.]+)\s*dB/);
  if (!match) throw new Error(`volumedetect parse failed for ${path.basename(file)}`);
  return parseFloat(match[1]);
}

// Returns the integrated loudness in LUFS using ffmpeg ebur128.
// Throws if the output cannot be parsed.
function getLufs(file) {
  const result = spawnSync(ffmpegPath, [
    '-hide_banner', '-i', file,
    '-af', 'ebur128=peak=true',
    '-f', 'null', '-',
  ], { encoding: 'utf8' });
  const match = (result.stderr || '').match(/I:\s*([-\d.]+)\s*LUFS/);
  if (!match) throw new Error(`ebur128 parse failed for ${path.basename(file)}`);
  return parseFloat(match[1]);
}

// Temp files go to the system temp directory so a crashed run cannot leave
// an orphan .tmp.mp3 inside the scanned sfxDir on the next run.
function conformPeak(file, peakDb) {
  const adjustment = TARGET_PEAK_DBFS - peakDb;
  const tmp = path.join(tmpdir(), `sfx_conform_${path.basename(file)}`);
  try {
    execFileSync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error',
      '-y', '-i', file,
      '-af', `volume=${adjustment}dB,aformat=sample_rates=${TARGET_SAMPLE_RATE}`,
      '-ar', String(TARGET_SAMPLE_RATE),
      '-b:a', `${TARGET_BITRATE}k`,
      '-codec:a', 'libmp3lame',
      tmp,
    ]);
    renameSync(tmp, file);
  } finally {
    try { unlinkSync(tmp); } catch { /* already renamed or never created */ }
  }
}

function conformLufs(file) {
  const tmp = path.join(tmpdir(), `sfx_conform_${path.basename(file)}`);
  try {
    execFileSync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error',
      '-y', '-i', file,
      '-af', `loudnorm=I=-14:LRA=7:TP=-1,aformat=sample_rates=${TARGET_SAMPLE_RATE}`,
      '-ar', String(TARGET_SAMPLE_RATE),
      '-b:a', `${TARGET_BITRATE}k`,
      '-codec:a', 'libmp3lame',
      tmp,
    ]);
    renameSync(tmp, file);
  } finally {
    try { unlinkSync(tmp); } catch { /* already renamed or never created */ }
  }
}

const files = existsSync(sfxDir)
  ? readdirSync(sfxDir).filter(f => f.endsWith('.mp3')).sort()
  : [];

let issues = 0;
let fixed = 0;
let failures = 0;
let rejected = 0;

for (const name of files) {
  const file = path.join(sfxDir, name);
  const { duration, bitrate, sampleRate } = getStats(file);

  // Source quality gate: re-encoding a low-bitrate MP3 to 192kbps does not recover
  // lost quality; it produces a larger file that sounds the same or worse. The floor
  // is 112kbps (not 128kbps) because ElevenLabs 128kbps exports can probe slightly
  // low due to encoding variance, and we must not false-reject legitimate assets.
  const preliminary = classify({ duration, bitrate, sampleRate });
  if (preliminary.reject) {
    console.log(`  REJECT ${name}  [${bitrate}kbps source, minimum ${MIN_SOURCE_BITRATE}kbps; re-export at 128kbps or higher]`);
    rejected++;
    continue;
  }

  // Measure actual loudness so check mode catches loudness drift, not just bitrate/rate.
  let peakDb = null;
  let lufs = null;
  if (preliminary.normBranch === 'peak') {
    peakDb = getPeakDb(file);
  } else {
    lufs = getLufs(file);
  }

  const { problems, normBranch } = classify({ duration, bitrate, sampleRate, peakDb, lufs });

  if (problems.length === 0) {
    console.log(`  ok   ${name}`);
    continue;
  }

  issues++;
  const normLabel = normBranch === 'peak' ? `peak ${TARGET_PEAK_DBFS}dBFS` : '-14 LUFS';

  if (fix) {
    process.stdout.write(`  fix  ${name}  [${problems.join(', ')}]  (${normLabel})... `);
    try {
      if (normBranch === 'peak') {
        conformPeak(file, peakDb);
      } else {
        conformLufs(file);
      }
      console.log('done');
      fixed++;
    } catch (err) {
      console.log('FAILED');
      console.error(`       ${err.message}`);
      failures++;
    }
  } else {
    console.log(`  FAIL ${name}  [${problems.join(', ')}]  (would apply ${normLabel})`);
  }
}

console.log('');
if (rejected > 0) {
  console.log(`${rejected} file(s) rejected: source bitrate below ${MIN_SOURCE_BITRATE}kbps. Re-export from your DAW and resubmit.`);
}
if (fix) {
  console.log(`${fixed}/${issues} files conformed. ${files.length - issues - rejected} already at spec.`);
} else if (issues > 0) {
  console.log(`${issues} file(s) out of spec. Run with --fix to conform them.`);
}
if (failures > 0 || rejected > 0 || (!fix && issues > 0)) process.exit(1);
