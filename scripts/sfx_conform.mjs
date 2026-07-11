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
import { readdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const fix = process.argv.includes('--fix');
const root = process.cwd();
const sfxDir = path.join(root, 'public/audio/sfx');
const ffprobePath = ffprobeStatic.path;

const TARGET_BITRATE = 192;
const MIN_SOURCE_BITRATE = 112; // below this the source is too lossy to transcode — reject outright
                                // (128kbps ElevenLabs files can probe slightly low due to encoding
                                // variance, so the floor sits well below 128 to avoid false rejects)
const TARGET_SAMPLE_RATE = 44100;
const DURATION_THRESHOLD = 1.0;
const TARGET_PEAK_DBFS = -6;

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
// volumedetect writes to stderr, so we use spawnSync to capture it.
function getPeakDb(file) {
  const result = spawnSync(ffmpegPath, [
    '-hide_banner', '-i', file,
    '-af', 'volumedetect',
    '-f', 'null', '/dev/null',
  ], { encoding: 'utf8' });
  const match = (result.stderr || '').match(/max_volume:\s*([-\d.]+)\s*dB/);
  return match ? parseFloat(match[1]) : 0;
}

function conformPeak(file) {
  const peakDb = getPeakDb(file);
  const adjustment = TARGET_PEAK_DBFS - peakDb;
  const tmp = file + '.tmp.mp3';
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
}

function conformLufs(file) {
  const tmp = file + '.tmp.mp3';
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
}

const files = readdirSync(sfxDir)
  .filter(f => f.endsWith('.mp3'))
  .sort();

let issues = 0;
let fixed = 0;
let rejected = 0;

for (const name of files) {
  const file = path.join(sfxDir, name);
  const { duration, bitrate, sampleRate } = getStats(file);

  // Source quality gate: below 128kbps the file is too lossy to transcode acceptably.
  // Re-encoding low-bitrate MP3 to 192kbps does not recover lost quality — it just
  // makes a larger file that sounds the same or worse. Reject and tell the contributor
  // to re-export from their DAW at a higher bitrate.
  if (bitrate < MIN_SOURCE_BITRATE) {
    console.log(`  REJECT ${name}  [${bitrate}kbps source — minimum ${MIN_SOURCE_BITRATE}kbps required; re-export at 128kbps or higher]`);
    rejected++;
    continue;
  }

  const problems = [];
  if (bitrate < TARGET_BITRATE) problems.push(`${bitrate}kbps (want ${TARGET_BITRATE}kbps)`);
  if (sampleRate !== TARGET_SAMPLE_RATE) problems.push(`${sampleRate}Hz (want ${TARGET_SAMPLE_RATE}Hz)`);

  if (problems.length === 0) {
    console.log(`  ok   ${name}`);
    continue;
  }

  issues++;
  const short = duration < DURATION_THRESHOLD;
  const normLabel = short ? `peak ${TARGET_PEAK_DBFS}dBFS` : '-14 LUFS';

  if (fix) {
    process.stdout.write(`  fix  ${name}  [${problems.join(', ')}]  (${normLabel})… `);
    try {
      if (short) {
        conformPeak(file);
      } else {
        conformLufs(file);
      }
      console.log('done');
      fixed++;
    } catch (err) {
      console.log('FAILED');
      console.error(`       ${err.message}`);
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
if (rejected > 0 || (!fix && issues > 0)) process.exit(1);
