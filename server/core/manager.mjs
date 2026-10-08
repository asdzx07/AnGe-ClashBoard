// Mihomo 内核版本管理。版本唯一来源：core/mihomo.version（一行）。
// 升级内核 = 改版本文件 + 跑脚本拉官方二进制 + 校验，全流程经此处。
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VERSION_FILE = path.join(ROOT, 'core', 'mihomo.version');
const BIN = path.join(ROOT, 'core', 'bin', 'mihomo');
const FETCH_SCRIPT = path.join(ROOT, 'scripts', 'fetch-mihomo.sh');

/** 读版本文件，如 v1.19.32 */
export async function getPinnedVersion() {
  return (await fs.readFile(VERSION_FILE, 'utf8')).trim();
}

/** 已安装二进制的版本；没装返回 null */
export async function getInstalledVersion() {
  try {
    const { stdout } = await execFileAsync(BIN, ['-v'], { timeout: 10000 });
    const m = stdout.match(/v\d+\.\d+\.\d+/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

/** 对比版本文件与上游最新 Release */
export async function checkForUpdate(fetchImpl = fetch) {
  const pinned = await getPinnedVersion();
  const res = await fetchImpl(
    'https://api.github.com/repos/MetaCubeX/mihomo/releases/latest',
    { headers: { 'User-Agent': 'mybox-core-manager' } },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const latest = (await res.json()).tag_name;
  return { pinned, latest, updateAvailable: latest !== pinned };
}

/**
 * 升级到指定版本（默认上游最新）。
 * 流程：拉官方二进制 → mihomo -v 验明 → 写版本文件。
 * 二进制下载失败或验明失败时抛错，版本文件不动。
 */
export async function upgradeTo(version, { arch } = {}) {
  const target = version || (await checkForUpdate()).latest;
  await execFileAsync(
    'sh',
    [FETCH_SCRIPT, ...(arch ? [arch] : [])],
    {
      timeout: 300000,
      env: { ...process.env, MIHOMO_VERSION: target },
    },
  );
  const installed = await getInstalledVersion();
  if (installed !== target) {
    throw new Error(`验明失败：期望 ${target}，实际 ${installed}`);
  }
  await fs.writeFile(VERSION_FILE, `${target}\n`);
  return { version: target };
}
