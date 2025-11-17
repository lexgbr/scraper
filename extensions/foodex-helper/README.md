### Foodex Manual Capture Extension

This Chrome/Chromium extension automates the "manual" Foodex workflow:

1. Log in to `https://foodex.london` in a normal browser tab (solve the Cloudflare check).
2. Open the extension popup, point it to your dashboard base URL (e.g. `http://localhost:3000` or production).
3. Click **Run Foodex Capture** – the extension grabs every Foodex product via `GET /api/manual/foodex`, reuses the current tab to open each product URL, reads the configured selector, and reports the results back with `POST /api/manual/foodex`.

#### Loading the extension

1. In Chrome/Edge/Arc, go to `chrome://extensions/`.
2. Enable **Developer Mode**.
3. Click **Load unpacked** and select `extensions/foodex-helper`.
4. Pin the “Foodex Manual Capture” action so it’s easy to access.

#### Usage tips

- Keep the Foodex tab active and logged in before starting a capture.
- The helper reuses the currently active tab; don’t close it while the capture is running.
- Progress updates appear in the popup. When it’s done, refresh the dashboard to see the new price timestamps.

You can tweak host permissions in `manifest.json` if your dashboard lives on a different domain. The extension uses simple DOM selectors – if a product uses a different price element, update the selector from the dashboard so the helper reads the correct field.
