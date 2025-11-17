import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';

// Register the stealth plugin to avoid bot detection
chromium.use(StealthPlugin());

(async () => {
  // Launch browser in headed mode (visible)
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500, // Slow down actions for visibility
    args: [
      '--disable-blink-features=AutomationControlled',
    ]
  });

  // Load the saved session state (cookies + storage)
  console.log('Loading saved session state...');
  const context = await browser.newContext({
    storageState: 'auth-state.json',
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const page = await context.newPage();

  // Helper function for random delays (humanize behavior)
  const randomDelay = (min: number, max: number) =>
    new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

  try {
    // Step 1: Load homepage with authentication
    console.log('Step 1: Loading Furnished Finder with your saved session...');
    await page.goto('https://www.furnishedfinder.com/', {
      waitUntil: 'domcontentloaded'
    });
    await randomDelay(1500, 2500);
    await page.waitForLoadState('networkidle');
    console.log('✓ Authenticated session loaded');

    // Step 2: Click on the user menu to reveal navigation options
    console.log('\nStep 2: Opening user menu...');
    await randomDelay(1000, 1500);

    // Take screenshot of homepage
    await page.screenshot({ path: 'homepage-screenshot.png', fullPage: true });
    console.log('✓ Homepage screenshot saved');

    // Click the user menu button
    const userMenuButton = page.getByRole('button', { name: /user menu/i });
    await userMenuButton.click();
    console.log('✓ User menu clicked');

    await randomDelay(1000, 2000);
    await page.screenshot({ path: 'user-menu-screenshot.png', fullPage: true });
    console.log('✓ User menu screenshot saved');

    // Step 3: Look for Messages/Inbox link in the menu
    console.log('\nStep 3: Looking for Messages link in navigation...');

    // Try to find messages link using multiple strategies
    let messagesFound = false;

    // Strategy 1: Look for link with text containing "message" or "inbox"
    const possibleLinks = await page.getByRole('link').all();

    for (const link of possibleLinks) {
      const text = await link.textContent();
      if (text && (text.toLowerCase().includes('message') || text.toLowerCase().includes('inbox'))) {
        console.log(`✓ Found link: "${text}"`);
        await randomDelay(1000, 1500);
        await link.click();
        messagesFound = true;
        console.log('✓ Clicked Messages link');
        break;
      }
    }

    if (!messagesFound) {
      // If automated click didn't work, pause for manual navigation
      console.log('\n=======================================================');
      console.log('MANUAL STEP REQUIRED:');
      console.log('=======================================================');
      console.log('Could not find Messages link automatically.');
      console.log('1. Please navigate to your Messages/Inbox page');
      console.log('2. Click on the most recent message conversation');
      console.log('3. Once you are viewing the message conversation, press');
      console.log('   the "Resume" button in Playwright Inspector');
      console.log('=======================================================\n');
      await page.pause();
    } else {
      // If we found messages, wait for page load and take screenshot
      await randomDelay(1500, 2500);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'messages-page-screenshot.png', fullPage: true });
      console.log('✓ Messages page screenshot saved');

      // Step 4: Find and click the first/most recent message
      console.log('\nStep 4: Looking for most recent message conversation...');

      // Try multiple strategies to find message items
      let messageClicked = false;

      // Strategy 1: Look for links that might be messages
      const messageLinks = await page.getByRole('link').all();

      if (messageLinks.length > 0) {
        // Click the first visible link (usually the most recent)
        await randomDelay(1000, 1500);
        await messageLinks[0].click();
        console.log('✓ Clicked into first message conversation');
        messageClicked = true;
      }

      if (!messageClicked) {
        // Manual fallback
        console.log('\n=======================================================');
        console.log('MANUAL STEP REQUIRED:');
        console.log('=======================================================');
        console.log('Could not find message conversation automatically.');
        console.log('1. Please click on the most recent message conversation');
        console.log('2. Once you are viewing the message, press');
        console.log('   the "Resume" button in Playwright Inspector');
        console.log('=======================================================\n');
        await page.pause();
      } else {
        // Wait for conversation to load
        await randomDelay(2000, 3000);
        await page.waitForLoadState('networkidle');
      }
    }

    // Step 5: Extract data from the conversation (user is already on the page)
    console.log('\nStep 5: Extracting conversation data from current page...');
    await randomDelay(1000, 1500);

    // Take a screenshot of the conversation
    await page.screenshot({ path: 'conversation-screenshot.png', fullPage: true });
    console.log('✓ Screenshot saved to conversation-screenshot.png');

    // Extract tenant name - look in various places
    let tenantName = '';
    try {
      // Try heading with name
      const nameHeading = await page.$('h1, h2, h3, .name, [class*="tenant"], [class*="sender"]');
      if (nameHeading) {
        tenantName = (await nameHeading.textContent())?.trim() || '';
      }
    } catch (e) {
      console.log('Could not find tenant name in heading');
    }

    // Extract dates - look for date patterns
    let requestDates = '';
    try {
      // Look for date elements or text containing dates
      const dateElements = await page.$$('[class*="date"], time, [datetime]');
      const dateTexts = await Promise.all(
        dateElements.map(async el => (await el.textContent())?.trim() || '')
      );

      // Also search page content for date patterns
      const pageContent = await page.content();
      const datePattern = /(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})/gi;
      const datesFound = pageContent.match(datePattern);

      if (datesFound && datesFound.length >= 2) {
        requestDates = `${datesFound[0]} - ${datesFound[1]}`;
      } else if (dateTexts.length > 0) {
        requestDates = dateTexts.join(' - ');
      }
    } catch (e) {
      console.log('Could not extract dates');
    }

    // Extract tenant's first message
    let tenantQuestions = '';
    try {
      // Look for message content - try various selectors
      const messageSelectors = [
        '.message-content',
        '[class*="message-text"]',
        '[class*="message-body"]',
        '.msg-content',
        'p'
      ];

      for (const selector of messageSelectors) {
        const messageElements = await page.$$(selector);
        if (messageElements.length > 0) {
          // Get the first message that's not from you
          for (const msg of messageElements) {
            const text = (await msg.textContent())?.trim() || '';
            if (text.length > 20) { // Skip very short messages
              tenantQuestions = text;
              break;
            }
          }
          if (tenantQuestions) break;
        }
      }

      // If still not found, get all text content
      if (!tenantQuestions) {
        const bodyText = await page.$eval('body', el => el.innerText);
        // Get first substantial paragraph
        const paragraphs = bodyText.split('\n').filter(p => p.trim().length > 50);
        if (paragraphs.length > 0) {
          tenantQuestions = paragraphs[0].trim();
        }
      }
    } catch (e) {
      console.log('Could not extract tenant questions');
    }

    // Step 6: Create JSON object
    console.log('\nStep 6: Creating JSON object...');
    const bookingData = {
      tenant_name: tenantName || 'Not found',
      request_dates: requestDates || 'Not found',
      tenant_questions: tenantQuestions || 'Not found',
      extracted_at: new Date().toISOString(),
      conversation_url: page.url()
    };

    console.log('\n✓ Extracted data:');
    console.log(JSON.stringify(bookingData, null, 2));

    // Step 7: Save to file
    console.log('\nStep 7: Saving data to new_booking_request.json...');
    fs.writeFileSync('new_booking_request.json', JSON.stringify(bookingData, null, 2));
    console.log('✓ Data saved to new_booking_request.json');

    console.log('\n✅ Task completed! Check the JSON file and screenshots for extracted data.');
    console.log('Note: If some data shows "Not found", please check the screenshots to see the page structure.');

    // Pause so you can verify the results
    await page.pause();

  } catch (error) {
    console.error('\n❌ Error:', error);
    // Take a screenshot on error
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
    console.log('Error screenshot saved to error-screenshot.png');
  } finally {
    await browser.close();
  }
})();
