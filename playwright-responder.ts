import { chromium, Browser, Page } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';

// Register stealth plugin
chromium.use(StealthPlugin());

const AUTH_STATE_PATH = process.env.FF_AUTH_STATE_PATH || 'auth-state.json';
const HEADLESS = process.env.HEADLESS !== 'false'; // Default to true for production

/**
 * Playwright-based responder for Furnished Finder
 */
export class PlaywrightResponder {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * Extract the most recent message from Furnished Finder
   */
  async extractLatestMessage(): Promise<{
    tenantName: string;
    tenantMessage: string;
    conversationUrl: string;
  }> {
    try {
      await this.launchBrowser();

      console.log('🌐 Navigating to Furnished Finder...');
      await this.page!.goto('https://www.furnishedfinder.com/', {
        waitUntil: 'domcontentloaded'
      });

      // Wait for page to load
      await this.randomDelay(1500, 2500);
      await this.page!.waitForLoadState('networkidle');

      console.log('✓ Loaded homepage');

      // Navigate to messages
      console.log('📧 Navigating to messages...');

      // Try direct URL first
      await this.page!.goto('https://www.furnishedfinder.com/members/tenant-message', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await this.randomDelay(2000, 3000);
      await this.page!.waitForLoadState('networkidle');

      // Look for the most recent conversation
      console.log('🔍 Finding most recent conversation...');

      // Find message buttons (not links - the UI uses buttons for message items)
      // Each message is a button element in the sidebar
      const messageButtons = await this.page!.locator('button').all();

      // Filter for buttons that look like message items (contain tenant names and timestamps)
      let firstMessageButton = null;
      for (const btn of messageButtons) {
        const text = await btn.textContent();
        if (text && text.length > 50) { // Message buttons have substantial text
          firstMessageButton = btn;
          break;
        }
      }

      if (!firstMessageButton) {
        throw new Error('No message conversations found');
      }

      // Click the first (most recent) message
      console.log('📬 Opening first message conversation...');
      await this.randomDelay(1000, 1500);
      await firstMessageButton.click();

      console.log('✓ Opened conversation');

      await this.randomDelay(2000, 3000);
      await this.page!.waitForLoadState('networkidle');

      // Extract conversation data
      console.log('📝 Extracting message data...');

      const conversationUrl = this.page!.url();

      // Extract tenant name from the heading in the conversation header
      let tenantName = 'Unknown Tenant';
      try {
        const nameElement = await this.page!.$('h3');
        if (nameElement) {
          tenantName = (await nameElement.textContent())?.trim() || tenantName;
        }
      } catch (e) {
        console.warn('Could not extract tenant name');
      }

      // Extract the tenant's message
      // The page structure has a list (ul or ol) with list items (li) containing messages
      // Each message is in paragraphs (p tags)
      let tenantMessage = '';
      try {
        // Find all paragraphs in the page
        const allParagraphs = await this.page!.$$('p');
        const messageParts: string[] = [];

        for (const para of allParagraphs) {
          const text = (await para.textContent())?.trim() || '';
          // Skip safety reminders and short text
          if (text && text.length > 20 && !text.includes('Safety Reminder:')) {
            messageParts.push(text);
          }
        }

        // Join all message parts
        if (messageParts.length > 0) {
          tenantMessage = messageParts.join('\n');
        }
      } catch (e) {
        console.error('Could not extract tenant message:', e);
        throw new Error('Failed to extract tenant message from page');
      }

      if (!tenantMessage) {
        throw new Error('Could not extract tenant message - page structure may have changed');
      }

      console.log('✅ Message extracted successfully');
      console.log(`   Tenant: ${tenantName}`);
      console.log(`   Message: ${tenantMessage.substring(0, 100)}...`);

      return {
        tenantName,
        tenantMessage,
        conversationUrl
      };

    } catch (error) {
      console.error('❌ Error extracting message:', error);
      throw error;
    }
  }

  /**
   * Send a response message (assumes browser is already on the conversation page)
   */
  async sendResponse(response: string): Promise<void> {
    try {
      if (!this.page) {
        throw new Error('Browser not initialized');
      }

      console.log('📤 Sending response...');

      // Find the textarea with placeholder "Type your message"
      const inputField = await this.page.$('textarea[placeholder*="message"], textarea');

      if (!inputField) {
        throw new Error('Could not find message input field');
      }

      // Clear existing content and type the response
      await inputField.click();
      await this.randomDelay(500, 1000);
      await this.page.keyboard.press('Control+A');
      await this.page.keyboard.press('Backspace');
      await this.randomDelay(500, 1000);

      // Type the response with human-like delays
      console.log('⌨️  Typing response...');
      await inputField.type(response, { delay: 50 + Math.random() * 50 });

      await this.randomDelay(1000, 2000);

      // Find the send button
      const sendButton = await this.page.$('button:has-text("Send")');

      if (!sendButton) {
        throw new Error('Could not find send button');
      }

      console.log('✉️  Clicking send button...');
      await sendButton.click();

      // Wait for message to send
      await this.randomDelay(2000, 3000);
      await this.page.waitForLoadState('networkidle');

      console.log('✅ Response sent successfully');

    } catch (error) {
      console.error('❌ Error sending response:', error);
      throw error;
    }
  }

  /**
   * Launch browser with authentication
   */
  private async launchBrowser(): Promise<void> {
    if (this.browser && this.page) {
      return; // Already launched
    }

    console.log('🚀 Launching browser...');

    // Launch browser
    this.browser = await chromium.launch({
      headless: HEADLESS,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    // Load saved auth state
    const context = await this.browser.newContext({
      storageState: AUTH_STATE_PATH,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });

    this.page = await context.newPage();

    console.log('✓ Browser launched with authentication');
  }

  /**
   * Close browser
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('✓ Browser closed');
    }
  }

  /**
   * Random delay to humanize behavior
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(filename: string): Promise<void> {
    if (this.page) {
      await this.page.screenshot({ path: filename, fullPage: true });
      console.log(`📸 Screenshot saved: ${filename}`);
    }
  }

  /**
   * Check if authentication is still valid
   */
  async checkAuth(): Promise<boolean> {
    try {
      await this.launchBrowser();
      await this.page!.goto('https://www.furnishedfinder.com/', {
        waitUntil: 'domcontentloaded'
      });

      await this.page!.waitForLoadState('networkidle');

      // Check if we're redirected to login page
      const url = this.page!.url();
      const isAuthenticated = !url.includes('login') && !url.includes('sign-in');

      await this.closeBrowser();

      return isAuthenticated;
    } catch (error) {
      console.error('Error checking auth:', error);
      return false;
    }
  }
}

// Export singleton instance
export const playwrightResponder = new PlaywrightResponder();
