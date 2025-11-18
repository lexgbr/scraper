import fs from 'node:fs/promises';
import path from 'node:path';
import type { Credentials } from '../types.js';

const CREDS_PATH = path.join(process.cwd(), '.state', 'creds.json');
console.log(`[creds] CREDS_PATH initialized as: ${CREDS_PATH}`);

export async function loadCredsFor(siteId: string): Promise<Credentials> {
  const U = process.env[`${siteId.toUpperCase()}_USERNAME`];
  const P = process.env[`${siteId.toUpperCase()}_PASSWORD`];
  const T = process.env[`${siteId.toUpperCase()}_TOTP_SECRET`];
  if (U && P) return { username: U, password: P, totpSecret: T };

  try {
    console.log(`[creds] Loading for ${siteId} from ${CREDS_PATH}`);
    const raw = await fs.readFile(CREDS_PATH, 'utf8');
    const all = JSON.parse(raw) as Record<string, Credentials>;
    console.log(`[creds] Available sites:`, Object.keys(all));
    const c = all[siteId];
    console.log(`[creds] Found for ${siteId}:`, c ? 'yes' : 'no');
    if (c?.username && c?.password) return c;
  } catch (err) {
    console.error(`[creds] Error loading for ${siteId}:`, err);
  }
  throw new Error(`Missing credentials for ${siteId}`);
}

export async function saveAllCreds(all: Record<string, Credentials>) {
  await fs.mkdir(path.dirname(CREDS_PATH), { recursive: true });
  await fs.writeFile(CREDS_PATH, JSON.stringify(all, null, 2), 'utf8');
}
