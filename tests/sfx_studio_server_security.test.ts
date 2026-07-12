import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error untyped zero-dependency authoring tool (scripts/*.mjs convention)
import * as audioIo from '../scripts/sfx_studio/audio_io.mjs';
// @ts-expect-error untyped zero-dependency authoring tool (scripts/*.mjs convention)
import { startSfxStudio } from '../scripts/sfx_studio/server.mjs';
import { SFX_CLIPS } from '../src/game/sfx_manifest.generated';

const {
  listVersions,
  publishedStateHashForKey,
  publishedUrl,
  resolveSourcePath,
  restoreVersion,
  STUDIO_ROOT,
} = audioIo;

function getWithHost(url: string, host: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { headers: { Host: host } }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        resolve({
          status: response.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    request.once('error', reject);
    request.end();
  });
}

describe.sequential('SFX Studio server security', () => {
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));
  const sourceId = `${'f'.repeat(64)}.wav`;
  const sourceDir = join(STUDIO_ROOT, 'sources', 'foot_grass');
  const sourceLink = join(sourceDir, sourceId);
  const executableBody = '<script>window.top.location="/"</script>';
  const executableSourceId = `${createHash('sha256').update(executableBody).digest('hex')}.html`;
  const executableSource = join(sourceDir, executableSourceId);
  const escapedKey = 'combat_block';
  const escapedSourceDir = join(STUDIO_ROOT, 'sources', escapedKey);
  const externalSourceDir = mkdtempSync(join(tmpdir(), 'woc-sfx-source-'));
  const externalExportDir = mkdtempSync(join(tmpdir(), 'woc-sfx-export-'));
  const badVersionHash = 'e'.repeat(64);
  const versionDir = join(STUDIO_ROOT, 'versions', 'foot_grass');
  const versionAudio = join(versionDir, `${badVersionHash}.mp3`);
  const versionMeta = join(versionDir, `${badVersionHash}.json`);
  const playbackDraft = join(STUDIO_ROOT, 'playback_profile.json');
  const playbackDraftBackup = `${playbackDraft}.test-backup-${process.pid}-${Date.now()}`;
  let hadPlaybackDraft = false;
  let server: Awaited<ReturnType<typeof startSfxStudio>>['server'];
  let url = '';
  let token = '';

  beforeAll(async () => {
    mkdirSync(STUDIO_ROOT, { recursive: true });
    hadPlaybackDraft = existsSync(playbackDraft);
    if (hadPlaybackDraft) renameSync(playbackDraft, playbackDraftBackup);
    const running = await startSfxStudio({ port: 0 });
    server = running.server;
    url = running.url;
    token = running.token;
    mkdirSync(sourceDir, { recursive: true });
    rmSync(sourceLink, { force: true });
    symlinkSync(join(repoRoot, 'package.json'), sourceLink);
    writeFileSync(executableSource, executableBody);
    writeFileSync(join(externalSourceDir, sourceId), 'not audio');
    rmSync(escapedSourceDir, { recursive: true, force: true });
    symlinkSync(externalSourceDir, escapedSourceDir);
    mkdirSync(versionDir, { recursive: true });
    rmSync(versionAudio, { force: true });
    rmSync(versionMeta, { force: true });
    symlinkSync(join(repoRoot, 'package.json'), versionAudio);
    writeFileSync(versionMeta, JSON.stringify({ audioHash: 'f'.repeat(64), mix: null }));
  }, 30_000);

  afterAll(async () => {
    try {
      rmSync(sourceLink, { force: true });
      rmSync(executableSource, { force: true });
      rmSync(escapedSourceDir, { force: true });
      rmSync(externalSourceDir, { recursive: true, force: true });
      rmSync(externalExportDir, { recursive: true, force: true });
      rmSync(versionAudio, { force: true });
      rmSync(versionMeta, { force: true });
      if (server?.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error?: Error) => (error ? reject(error) : resolve()));
        });
      }
    } finally {
      rmSync(playbackDraft, { force: true });
      if (hadPlaybackDraft) renameSync(playbackDraftBackup, playbackDraft);
    }
  }, 30_000);

  it('binds only to IPv4 loopback', () => {
    const address = server.address();
    expect(address && typeof address !== 'string' ? address.address : null).toBe('127.0.0.1');
  });

  it('rejects a second server that shares the repository', async () => {
    await expect(startSfxStudio({ port: 0 })).rejects.toThrow(
      'another SFX Studio server is already using this repository',
    );
  });

  it('rejects DNS-rebinding Host headers before serving the token-bearing page', async () => {
    const response = await getWithHost(url, 'attacker.invalid');
    expect(response.status).toBe(421);
    expect(response.body).toBe('misdirected request');
  });

  it('uses immutable caching only for the exact published content hash', async () => {
    const current = await fetch(`${url}${publishedUrl('foot_grass')}`);
    expect(current.status).toBe(200);
    expect(current.headers.get('cache-control')).toContain('immutable');

    const stale = await fetch(`${url}/audio/foot_grass.mp3?v=000000000000`);
    expect(stale.status).toBe(200);
    expect(stale.headers.get('cache-control')).toBe('no-store');
  });

  it('requires the secret token for GET project requests that rewrite drafts', async () => {
    const catalogDenied = await fetch(`${url}/api/catalog`);
    expect(catalogDenied.status).toBe(403);
    const catalogAllowed = await fetch(`${url}/api/catalog`, {
      headers: { 'X-Woc-Sfx-Studio': token },
    });
    expect(catalogAllowed.status).toBe(200);

    const denied = await fetch(`${url}/api/project?key=foot_grass`);
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ error: 'studio token is invalid' });

    const allowed = await fetch(`${url}/api/project?key=foot_grass`, {
      headers: { 'X-Woc-Sfx-Studio': token },
    });
    const project = await allowed.json();
    expect(allowed.status, project.error).toBe(200);
    expect(project.key).toBe('foot_grass');
    expect(project.playback.category).toBe('movement');
    expect(project.playback.categoryBaselineDb).toEqual(expect.any(Number));
    expect(project.playback.keyTrimDb).toEqual(expect.any(Number));
    expect(project.playback.resolvedGainDb).toBeCloseTo(
      project.playback.categoryBaselineDb + project.playback.keyTrimDb,
    );
    expect(project.playback.gain).toBeCloseTo(10 ** (project.playback.resolvedGainDb / 20), 5);
    expect(project.playback.playbackRate).toEqual(expect.any(Number));
    expect(project.playbackProfileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(project.playbackWorkspaceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(project.audioWorkspaceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(project.playbackProfileDirty).toEqual(expect.any(Boolean));
  }, 30_000);

  it('requires both exact origin and token for mutations', async () => {
    const denied = await fetch(`${url}/api/project`, {
      method: 'POST',
      headers: {
        Origin: 'https://attacker.invalid',
        'X-Woc-Sfx-Studio': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'foot_grass', project: {} }),
    });
    expect(denied.status).toBe(403);
  });

  it('exports a token-protected production ZIP only from the applied playback state', async () => {
    const projectResponse = await fetch(`${url}/api/project?key=foot_grass`, {
      headers: { 'X-Woc-Sfx-Studio': token },
    });
    const project = await projectResponse.json();
    expect(projectResponse.status, project.error).toBe(200);

    const getResponse = await fetch(`${url}/api/export`, {
      headers: { Origin: url, 'X-Woc-Sfx-Studio': token },
    });
    expect(getResponse.status).toBe(404);

    const denied = await fetch(`${url}/api/export`, {
      method: 'POST',
      headers: {
        Origin: 'https://attacker.invalid',
        'X-Woc-Sfx-Studio': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expectedPlaybackProfileHash: project.playbackProfileHash,
        expectedPlaybackWorkspaceHash: project.playbackWorkspaceHash,
      }),
    });
    expect(denied.status).toBe(403);

    const allowed = await fetch(`${url}/api/export`, {
      method: 'POST',
      headers: {
        Origin: url,
        'X-Woc-Sfx-Studio': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expectedPlaybackProfileHash: project.playbackProfileHash,
        expectedPlaybackWorkspaceHash: project.playbackWorkspaceHash,
      }),
    });
    const body = Buffer.from(await allowed.arrayBuffer());
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('content-type')).toBe('application/zip');
    expect(allowed.headers.get('content-disposition')).toMatch(
      /^attachment; filename="world-of-claudecraft-sfx-[a-f0-9]{16}\.zip"$/,
    );
    expect(allowed.headers.get('x-woc-sfx-keys')).toBe(String(Object.keys(SFX_CLIPS).length));
    expect(allowed.headers.get('x-woc-sfx-tracks')).toBe(
      String(Object.values(SFX_CLIPS).reduce((sum, clip) => sum + clip.variants.length, 0)),
    );
    expect(allowed.headers.get('x-woc-sfx-sha256')).toBe(
      createHash('sha256').update(body).digest('hex'),
    );
    expect(body.readUInt32LE(0)).toBe(0x04034b50);
  }, 30_000);

  it('rejects an export directory symlink that leaves the Studio root', async () => {
    const projectResponse = await fetch(`${url}/api/project?key=foot_grass`, {
      headers: { 'X-Woc-Sfx-Studio': token },
    });
    const project = await projectResponse.json();
    expect(projectResponse.status, project.error).toBe(200);
    const exportRoot = join(STUDIO_ROOT, 'exports');
    rmSync(exportRoot, { recursive: true, force: true });
    symlinkSync(externalExportDir, exportRoot);
    try {
      const response = await fetch(`${url}/api/export`, {
        method: 'POST',
        headers: {
          Origin: url,
          'X-Woc-Sfx-Studio': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expectedPlaybackProfileHash: project.playbackProfileHash,
          expectedPlaybackWorkspaceHash: project.playbackWorkspaceHash,
        }),
      });
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error).toContain('not a plain directory');
      expect(readdirSync(externalExportDir)).toEqual([]);
    } finally {
      rmSync(exportRoot, { force: true });
      mkdirSync(exportRoot);
    }
  });

  it('does not save the project half of a stale combined draft', async () => {
    const initialResponse = await fetch(`${url}/api/project?key=foot_grass`, {
      headers: { 'X-Woc-Sfx-Studio': token },
    });
    const initial = await initialResponse.json();
    expect(initialResponse.status, initial.error).toBe(200);
    const headers = {
      Origin: url,
      'X-Woc-Sfx-Studio': token,
      'Content-Type': 'application/json',
    };
    const nextRate = initial.playback.playbackRate === 1 ? 1.1 : 1;
    const first = await fetch(`${url}/api/project`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        key: 'foot_grass',
        project: initial.project,
        playback: {
          categoryBaselineDb: initial.playback.categoryBaselineDb,
          keyTrimDb: initial.playback.keyTrimDb,
          playbackRate: nextRate,
        },
        expectedPlaybackWorkspaceHash: initial.playbackWorkspaceHash,
        expectedAudioWorkspaceHash: initial.audioWorkspaceHash,
      }),
    });
    expect(first.status).toBe(200);

    const staleSyncOffsetMs = (initial.project.syncOffsetMs ?? 0) + 321;
    const stale = await fetch(`${url}/api/project`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        key: 'foot_grass',
        project: { ...initial.project, syncOffsetMs: staleSyncOffsetMs },
        playback: {
          categoryBaselineDb: initial.playback.categoryBaselineDb,
          keyTrimDb: initial.playback.keyTrimDb,
          playbackRate: initial.playback.playbackRate,
        },
        expectedPlaybackWorkspaceHash: initial.playbackWorkspaceHash,
        expectedAudioWorkspaceHash: initial.audioWorkspaceHash,
      }),
    });
    expect(stale.status).toBe(400);
    expect((await stale.json()).error).toContain('changed in another Studio tab');

    const currentResponse = await fetch(`${url}/api/project?key=foot_grass`, {
      headers: { 'X-Woc-Sfx-Studio': token },
    });
    const current = await currentResponse.json();
    expect(currentResponse.status, current.error).toBe(200);
    expect(current.project.syncOffsetMs).toBe(initial.project.syncOffsetMs);
    expect(current.playback.playbackRate).toBe(nextRate);
  });

  it('rejects source symlinks that leave the cue source directory', async () => {
    const response = await fetch(`${url}/source/foot_grass/${sourceId}`);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('regular file');
  });

  it('rejects an entire cue source directory symlinked outside the studio', async () => {
    const response = await fetch(`${url}/source/${escapedKey}/${sourceId}`);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('plain directory');
  });

  it('rejects hash-correct executable source extensions', async () => {
    expect(() => resolveSourcePath('foot_grass', executableSourceId)).toThrow(
      'source file type is not allowed',
    );
    const response = await fetch(`${url}/source/foot_grass/${executableSourceId}`);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('source file type is not allowed');
  });

  it('hides and rejects symlinked version archives', async () => {
    expect(
      listVersions('foot_grass').some(
        (version: { hash: string }) => version.hash === badVersionHash,
      ),
    ).toBe(false);
    const expectedHash = publishedStateHashForKey('foot_grass');
    await expect(restoreVersion('foot_grass', badVersionHash, expectedHash)).rejects.toThrow(
      'regular file',
    );
  });
});
