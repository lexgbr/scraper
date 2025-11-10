import fs from 'node:fs/promises';
import path from 'node:path';
const STATE_DIR = path.join(process.cwd(), '.state');

export async function loadStatePath(siteId: string) {
  await fs.mkdir(STATE_DIR, { recursive: true });
  return path.join(STATE_DIR, `${siteId}.json`);
}
export async function readStorageState(siteId: string) {
  const p = await loadStatePath(siteId);
  try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return undefined; }
}
export async function writeStorageState(siteId: string, state: any) {
  const p = await loadStatePath(siteId);
  await fs.writeFile(p, JSON.stringify(state), 'utf8');
}
