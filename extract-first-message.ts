import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';

// Register the stealth plugin
chromium.use(StealthPlugin());

/**
 * Extract the first message from Furnished Finder inbox
 * Uses the auth-state.json for authentication
 */
(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const page = await context.newPage();

  const randomDelay = (min: number, max: number) =>
    new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

  try {
    console.log('Step 1: Loading homepage...');
    await page.goto('https://www.furnishedfinder.com/', { waitUntil: 'domcontentloaded' });
    await randomDelay(1000, 2000);

    // Step 2: Inject authentication from auth-state.json
    console.log('Step 2: Loading authentication...');
    await page.evaluate(() => {
      // This is the critical auth token from auth-state.json
      localStorage.setItem('authdetailnew',
        'Patrick.McHeyser--Patrick.McHeyser----PM--Registered--jwttokeniXko8u9wlQH/KBxNHRTfN8XR9cWxiVdvoVvgqChtYpaawYdEceUDgvec00reIXuI/J1FBlmCNf8xUYsIcFtiH0qUSqK1V2f32BmeM5BWhc8xkq41g33EqxoSN%2B9DnTpsJ0bgNBAdyTHyDRF/XnL8DhP2WcuJ5lFvAfHwnLAS1WvN8M0yGd7oUThft7sI0kTIIVapbGaMDxfhmSWOWhMTxFii9HXkmBzlIN6FxAOf8CbQs18fY/O2DwPyFPhZHLUMVlfaP/lykcBAV3GhzHbLUvvz9%2BzGPIu9A3niM6XKzGH1lxTO/4BGwzGqw8A0VO%2BbaaofsHmDWtcFwFXlDIyfJ7pYQuPeZhgaHYbNT9lMJziIf76VFpE2bmJ%2BEgOgFXelC33vEYYgzoODqCgSxE8Ycq6xGWmsLisLSYb9JFcaLOGkQXnlpy5QUcW2LmE15hUKbsv%2BxoLthxmHSuAM/Yyo7TF/6RzohzF4RhitfiahaPn2ZqKgZdFoXdp39WuIGsgPPNYR8hfQBa3uUBZlGZ3i29rfH9IZ/QVJalKH3k5F5dTYg7bbPEsJAROVyvZnox7cCuyepdnE8TZiNCui1xfIEXPcM1enA55mIQyfftuHujxFbfJcDQrro7Ud/segq9sY/WQm3EAIKqA5cIdEph7oppWr0TYefbYArCHtp6EOJre5uAHUpG83xuducElXg6mX0QSXIOm/sOneisi9clBRts6waXvvdU5E9R/sd5XAMxWMJqEcyjVtojnKiXpwX9J9LqoC122GuQ/PSEp3FFGu2EWcRQwmQe2ILNrP9%2BCqLsv0BCq31dcYrQBYtI36ifftB9i2mVWTDdbEVPbKGMkK4E2h5K3/9ezUlWSfApWeUNINMREWsYmPhR4njglfGR2R5dUSmNff5uABewPVNvCapRNNWOb5ij1NaErtHkg88uyA5h8saE%2BXpxquW2XOJk/89aaIkU3Gfc/Z0QkTBYh7w6Tih9BRp2PaVGtGWDvvFHrAQPlBA2husDd%2BL1p5QxnC--user_uuid_48c8ec4-4b03-af3-7f6-419c0e--impersonator_user_uuid_'
      );
    });

    // Step 3: Reload to apply authentication
    console.log('Step 3: Reloading with authentication...');
    await page.goto('https://www.furnishedfinder.com/', { waitUntil: 'domcontentloaded' });
    await randomDelay(1000, 2000);
    console.log('✓ Authenticated');

    // Step 4: Navigate to dashboard
    console.log('Step 4: Navigating to dashboard...');
    await page.goto('https://www.furnishedfinder.com/members/pm-dashboard', {
      waitUntil: 'domcontentloaded'
    });
    await randomDelay(2000, 3000);
    console.log('✓ Dashboard loaded');

    // Step 5: Click on Messages link
    console.log('Step 5: Opening Messages...');
    await page.getByRole('link', { name: /Messages/i }).click();
    await randomDelay(3000, 4000);
    console.log('✓ Messages page loaded');

    // Step 6: Wait for message list to load and click first message
    console.log('Step 6: Loading message list...');
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    await randomDelay(2000, 3000);

    // Try to find the first message using getByRole with text matching
    // Message items contain sender name like "Nancy E", "Patrick M", etc.
    try {
      // First, try to click a button that contains "Nancy E" (the first visible message)
      await page.getByRole('button', { name: /Nancy E/ }).first().click();
      console.log('✓ Clicked first message (Nancy E)');
    } catch (error) {
      // If Nancy E button not found, try a more generic approach
      // Look for buttons containing common sender patterns
      const messageButtons = await page.locator('button').all();
      let clicked = false;

      for (const button of messageButtons) {
        const text = await button.textContent();
        // Message list items have: initials, name, time, and preview text
        // They typically contain both a time (PM/AM) and substantial text (>50 chars)
        if (text && text.length > 50 && (text.includes('PM') || text.includes('AM'))) {
          await button.click();
          console.log('✓ Clicked first message');
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        throw new Error('No message buttons found on the page');
      }
    }

    // Wait for the message detail to load - URL should change to include channel parameter
    await page.waitForURL(/.*channel=.*/, { timeout: 10000 });
    await randomDelay(2000, 3000);
    console.log('✓ Message detail loaded');

    // Step 7: Extract message data
    console.log('Step 7: Extracting message data...');

    // Take a screenshot for reference
    await page.screenshot({ path: 'first-message-extraction.png', fullPage: true });
    console.log('✓ Screenshot saved');

    // Extract data from the page
    const messageData = await page.evaluate(() => {
      // Get sender name from the header
      const senderName = document.querySelector('h3')?.textContent?.trim() || '';

      // Get property details
      const propertyLink = document.querySelector('a[href*="/property/"]');
      const propertyName = propertyLink?.textContent?.trim() || '';

      // Get property price
      const priceText = propertyLink?.parentElement?.textContent || '';
      const priceMatch = priceText.match(/\$[\d,]+\/month/);
      const price = priceMatch ? priceMatch[0] : '';

      // Get message details by searching through all text content
      const bodyText = document.body.innerText;
      const messageParts: any = {};

      // Extract full name (after "My Name :")
      const nameMatch = bodyText.match(/My Name\s*:\s*([^\n]+)/i);
      if (nameMatch) {
        messageParts.fullName = nameMatch[1].trim();
      }

      // Extract email (find it after "My Email :" in the text)
      const emailMatch = bodyText.match(/My Email\s*:\s*([^\s\n]+@[^\s\n]+)/i);
      if (emailMatch) {
        messageParts.email = emailMatch[1].trim();
      } else {
        // Fallback: look for mailto link
        const emailLink = document.querySelector('a[href^="mailto:"]');
        if (emailLink) {
          messageParts.email = emailLink.textContent?.trim() || '';
        }
      }

      // Extract message content (after "My Message :")
      const messageMatch = bodyText.match(/My Message\s*:\s*([^\n][\s\S]*?)(?=\n\n|Safety Reminder|$)/i);
      if (messageMatch) {
        messageParts.message = messageMatch[1].trim();
      }

      // Get the most recent timestamp (from the conversation)
      const timeElements = Array.from(document.querySelectorAll('time'));
      const timestamp = timeElements.length > 0
        ? timeElements[timeElements.length - 1].textContent?.trim() || ''
        : '';

      return {
        sender: senderName,
        propertyName,
        price,
        ...messageParts,
        timestamp,
        pageUrl: window.location.href
      };
    });

    console.log('\n=== EXTRACTED MESSAGE DATA ===');
    console.log(JSON.stringify(messageData, null, 2));

    // Save to JSON file
    const outputData = {
      extracted_at: new Date().toISOString(),
      source: 'Furnished Finder Messages',
      ...messageData
    };

    fs.writeFileSync('first_message_data.json', JSON.stringify(outputData, null, 2));
    console.log('\n✓ Data saved to first_message_data.json');

    // Keep browser open for review
    console.log('\nPress Ctrl+C to close the browser');
    await page.pause();

  } catch (error) {
    console.error('\n❌ Error:', error);
    await page.screenshot({ path: 'error-extraction.png', fullPage: true });
    console.log('Error screenshot saved');
  } finally {
    await browser.close();
  }
})();
