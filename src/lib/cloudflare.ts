import type { Page } from 'playwright';

/**
 * Waits for Cloudflare's "Checking your browser" interstitial to finish.
 * The helper simply waits until the current location is no longer pointing to
 * `/cdn-cgi/challenge-platform` or the verification banner disappears.
 */
export async function waitForCloudflare(page: Page, timeout = 20000) {
  try {
    await page.waitForFunction(
      () =>
        !window.location.pathname.includes('/cdn-cgi/challenge-platform') &&
        !/Verifying you are human/i.test(document.body?.innerText ?? ''),
      { timeout },
    );
  } catch {
    // ignore – if the challenge persists the following interactions will fail
  }
}
