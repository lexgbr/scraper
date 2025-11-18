import { chromium } from "playwright";

const browser = await chromium.launch({ headless: false, slowMo: 200 });
const page = await browser.newPage();
await page.goto('https://romegafoods.co.uk/login', { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle');
await page.fill('input[name="email"]', 'katarzynacffrn@gmail.com');
await page.fill('input[name="password"]', 'Mark2019');
await page.click('button:has-text("Login")');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(4000);
await page.screenshot({ path: 'debug-login.png', fullPage: true });
await browser.close();
