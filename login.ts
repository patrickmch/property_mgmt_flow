import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Register the stealth plugin to avoid bot detection
chromium.use(StealthPlugin());

(async () => {
  // Launch browser in headed mode (visible)
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500, // Slow down actions for visibility
    args: [
      '--disable-blink-features=AutomationControlled', // Additional anti-detection
    ]
  });

  const context = await browser.newContext({
    // Add realistic viewport and user agent
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const page = await context.newPage();

  // Helper function for random delays (humanize behavior)
  const randomDelay = (min: number, max: number) =>
    new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

  // Navigate to the login page
  console.log('Navigating to Furnished Finder login page...');
  await page.goto('https://www.furnishedfinder.com/login', {
    waitUntil: 'domcontentloaded'
  });

  // Random delay to mimic human reading the page
  await randomDelay(1000, 2000);

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  console.log('Login page loaded. You can now manually enter your credentials.');
  console.log('The browser will stay open for you to complete the login.');
  console.log('\nTip: If you want to automate the login, you can use:');
  console.log('  await page.fill("#email-input", "your@email.com", { delay: 150 });');
  console.log('  await page.fill("#password-input", "password", { delay: 150 });');

  // Pause the script to allow manual interaction
  // You can manually enter credentials and click sign in
  // Press Resume in the Playwright Inspector or close the browser when done
  await page.pause();

  // After resume - save complete session state (cookies + storage)
  console.log('Saving session state...');
  const fs = require('fs');

  // Save complete auth state (cookies + localStorage + sessionStorage)
  await context.storageState({ path: 'auth-state.json' });
  console.log('✓ Complete session state saved to auth-state.json');

  // Also save cookies separately for reference
  const cookies = await context.cookies();
  fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));
  console.log(`✓ Saved ${cookies.length} cookies to cookies.json`);

  // After resume or manual completion
  console.log('Script completed.');

  await browser.close();
})();
