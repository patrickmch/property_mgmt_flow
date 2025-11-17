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

  // Load the saved session state (cookies + storage)
  console.log('Loading saved session state...');
  const context = await browser.newContext({
    storageState: 'auth-state.json', // Load saved authentication
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const page = await context.newPage();

  // Helper function for random delays (humanize behavior)
  const randomDelay = (min: number, max: number) =>
    new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

  // Navigate to a page that requires authentication
  console.log('Navigating to Furnished Finder (authenticated)...');
  await page.goto('https://www.furnishedfinder.com/', {
    waitUntil: 'domcontentloaded'
  });

  // Random delay to mimic human behavior
  await randomDelay(1000, 2000);

  await page.waitForLoadState('networkidle');

  console.log('✓ Page loaded with saved session!');
  console.log('You should now be logged in automatically.');
  console.log('\nYou can now:');
  console.log('  - Navigate to any page');
  console.log('  - Scrape data');
  console.log('  - Perform authenticated actions');
  console.log('\nPress Ctrl+C or close the browser when done.');

  // Keep the browser open for manual interaction
  await page.pause();

  await browser.close();
})();
