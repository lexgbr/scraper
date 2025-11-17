import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SITE_BY_ID } from '../../../../config/sites';

type Cred = { username: string; password: string; totpSecret?: string };

const CREDS_PATH = path.resolve(process.cwd(), '../../.state/creds.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const raw = await fs.readFile(CREDS_PATH, 'utf8');
      const all = JSON.parse(raw) as Record<string, Cred>;
      const redacted = Object.fromEntries(
        Object.entries(all).map(([key, value]) => [
          key,
          {
            username: value.username,
            hasPassword: Boolean(value.password),
            hasTotp: Boolean(value.totpSecret),
          },
        ]),
      );
      return res.json({ ok: true, creds: redacted });
    } catch {
      return res.json({ ok: true, creds: {} });
    }
  }

  if (req.method === 'POST') {
    const { siteId, username, password, totpSecret } = req.body || {};
    if (!siteId || typeof siteId !== 'string') {
      return res.status(400).json({ ok: false, error: 'siteId is required' });
    }
    if (!SITE_BY_ID.has(siteId as any)) {
      return res.status(400).json({ ok: false, error: `unknown siteId ${siteId}` });
    }
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'username and password are required' });
    }

    await fs.mkdir(path.dirname(CREDS_PATH), { recursive: true });
    let all: Record<string, Cred> = {};
    try {
      all = JSON.parse(await fs.readFile(CREDS_PATH, 'utf8'));
    } catch {
      // create new file
    }
    all[siteId] = { username, password, totpSecret };
    await fs.writeFile(CREDS_PATH, JSON.stringify(all, null, 2), 'utf8');
    return res.json({ ok: true });
  }

  res.status(405).end();
}

