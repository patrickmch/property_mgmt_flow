/**
 * =============================================================================
 * 🚨 SAFETY SWITCHES - MODIFY THESE CAREFULLY 🚨
 * =============================================================================
 */

export const SAFETY_CONFIG = {
  /**
   * TEST_MODE: When true, ONLY processes inquiries from sender names matching TEST_SENDER_NAME
   * Set to false for production to process all inquiries
   */
  TEST_MODE: true,
  TEST_SENDER_NAME: 'Patrick M',

  /**
   * AUTO_SEND_ENABLED: When false, responses are NEVER sent automatically to Furnished Finder
   * Responses will only be sent via Telegram for manual approval
   * Set to true for production (but only after thorough testing!)
   */
  AUTO_SEND_ENABLED: false,

  /**
   * TELEGRAM_NOTIFICATIONS_ENABLED: When true, sends generated responses to Telegram for approval
   * Requires Telegram bot token and chat ID to be configured
   */
  TELEGRAM_NOTIFICATIONS_ENABLED: true,
};

/**
 * =============================================================================
 * SYSTEM CONFIGURATION
 * =============================================================================
 */

export const SYSTEM_CONFIG = {
  // Gmail polling interval (default: every 1 minute)
  GMAIL_CHECK_INTERVAL: process.env.GMAIL_CHECK_INTERVAL || '*/1 * * * *',

  // Gmail filter for Furnished Finder emails
  GMAIL_FILTER: process.env.GMAIL_FILTER || 'from:furnishedfinder.com',

  // Error notification email
  ERROR_NOTIFICATION_EMAIL: process.env.ERROR_NOTIFICATION_EMAIL || '',

  // LLM API endpoint
  LLM_API_URL: process.env.LLM_API_URL || 'https://llmrouter-production.up.railway.app',

  // Playwright headless mode
  HEADLESS: process.env.HEADLESS !== 'false',

  // Database path
  DB_PATH: process.env.DB_PATH || 'messages.db',

  // Auth state path for Furnished Finder
  FF_AUTH_STATE_PATH: process.env.FF_AUTH_STATE_PATH || 'auth-state.json',
};

/**
 * =============================================================================
 * TELEGRAM CONFIGURATION (for response approval)
 * =============================================================================
 */

export const TELEGRAM_CONFIG = {
  // Telegram bot token (get from @BotFather)
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',

  // Your Telegram chat ID (get from @userinfobot)
  CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
};
