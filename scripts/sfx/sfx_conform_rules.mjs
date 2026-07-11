// Pure classification logic for sfx_conform.mjs. No I/O, no side effects.

export const TARGET_BITRATE = 192;
export const MIN_SOURCE_BITRATE = 112;
export const TARGET_SAMPLE_RATE = 44100;
export const DURATION_THRESHOLD = 1.0; // clips below this use peak norm; at/above use LUFS
export const TARGET_PEAK_DBFS = -6;
export const TARGET_LUFS = -14;
export const NORM_TOLERANCE = 0.5; // dB/LU tolerance window for loudness checks

/**
 * Classify a file's measured stats and return what problems need fixing.
 *
 * @param {{ duration: number, bitrate: number, sampleRate: number, peakDb?: number|null, lufs?: number|null }} stats
 * @returns {{ reject: boolean, problems: string[], normBranch: 'peak'|'lufs'|null }}
 */
export function classify({ duration, bitrate, sampleRate, peakDb = null, lufs = null }) {
  if (bitrate < MIN_SOURCE_BITRATE) {
    return { reject: true, problems: [], normBranch: null };
  }

  const problems = [];

  if (bitrate < TARGET_BITRATE) {
    problems.push(`${bitrate}kbps (want ${TARGET_BITRATE}kbps)`);
  } else if (bitrate > TARGET_BITRATE + 8) {
    problems.push(`${bitrate}kbps (want ${TARGET_BITRATE}kbps)`);
  }

  if (sampleRate !== TARGET_SAMPLE_RATE) {
    problems.push(`${sampleRate}Hz (want ${TARGET_SAMPLE_RATE}Hz)`);
  }

  const normBranch = duration < DURATION_THRESHOLD ? 'peak' : 'lufs';

  if (normBranch === 'peak' && peakDb !== null) {
    if (Math.abs(peakDb - TARGET_PEAK_DBFS) > NORM_TOLERANCE) {
      problems.push(`peak ${peakDb.toFixed(1)}dBFS (want ${TARGET_PEAK_DBFS}dBFS)`);
    }
  }
  if (normBranch === 'lufs' && lufs !== null) {
    if (Math.abs(lufs - TARGET_LUFS) > NORM_TOLERANCE) {
      problems.push(`${lufs.toFixed(1)} LUFS (want ${TARGET_LUFS} LUFS)`);
    }
  }

  return { reject: false, problems, normBranch };
}
