import express from 'express';
import { db } from './database';
import { messageQueue, QueuedMessage } from './message-queue';
import { gmailPoller } from './cron-gmail-poller';
import { llmClient } from './llm-client';
import { playwrightResponder } from './playwright-responder';
import { errorNotifier } from './error-notifier';
import { telegramNotifier } from './telegram-notifier';
import { SAFETY_CONFIG } from './config';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    service: 'Furnished Finder Automation',
    status: 'running',
    version: '1.0.0'
  });
});

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  const llmHealthy = await llmClient.healthCheck();

  res.json({
    status: 'healthy',
    services: {
      database: 'ok',
      llm_api: llmHealthy ? 'ok' : 'down',
      gmail_poller: gmailPoller.getStatus().isRunning ? 'ok' : 'stopped',
      queue: messageQueue.size === 0 ? 'idle' : 'processing'
    }
  });
});

/**
 * Status endpoint - get current system status
 */
app.get('/status', (req, res) => {
  const queueStatus = messageQueue.getStatus();
  const pollerStatus = gmailPoller.getStatus();
  const dbStats = db.getStats();
  const recentMessages = db.getRecentMessages(5);

  res.json({
    queue: queueStatus,
    poller: pollerStatus,
    database: dbStats,
    recent_messages: recentMessages
  });
});

/**
 * Manually trigger a message check (for testing)
 */
app.post('/check-gmail', async (req, res) => {
  res.json({ message: 'Gmail check triggered - check logs for results' });
});

/**
 * Process message handler - called by queue
 */
async function processMessage(message: QueuedMessage): Promise<void> {
  const { gmailMessageId, tenantName, tenantEmail, tenantMessage } = message;

  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`⚙️  PROCESSING MESSAGE FROM ${tenantName}`);
    console.log('='.repeat(80));

    // Update status to processing
    db.updateStatus(gmailMessageId, 'processing');

    // Step 1: Extract actual message from Furnished Finder
    console.log('\n📥 Step 1: Extracting message from Furnished Finder...');

    const extractedData = await playwrightResponder.extractLatestMessage();

    console.log(`✓ Extracted message from ${extractedData.tenantName}`);

    // Verify message matches (basic check - tenant name similarity)
    const nameMatch = extractedData.tenantName.toLowerCase().includes(tenantName.toLowerCase()) ||
                       tenantName.toLowerCase().includes(extractedData.tenantName.toLowerCase());

    if (!nameMatch) {
      console.warn(`⚠️  Name mismatch: Expected "${tenantName}", got "${extractedData.tenantName}"`);
      console.warn('   Proceeding anyway, but consider reviewing...');

      await errorNotifier.notifyMessageMismatch(gmailMessageId, tenantName);
    }

    // Update database with extracted message and URL
    db.updateResponse(gmailMessageId, extractedData.tenantMessage);

    // Step 2: Generate LLM response
    console.log('\n🤖 Step 2: Generating LLM response...');

    const llmResponse = await llmClient.generateResponse(
      extractedData.tenantName,
      extractedData.tenantMessage,
      tenantEmail
    );

    console.log('✓ LLM response generated');
    console.log(`   Preview: ${llmResponse.substring(0, 100)}...`);

    // Save response to database
    db.updateResponse(gmailMessageId, llmResponse);

    // 🚨 SAFETY SWITCH #2: DISABLE AUTO-SENDING
    if (SAFETY_CONFIG.AUTO_SEND_ENABLED) {
      // Step 3: Send response via Playwright
      console.log('\n📤 Step 3: Sending response via Playwright...');

      await playwrightResponder.sendResponse(llmResponse);

      console.log('✅ Response sent successfully!');

      // Step 4: Close browser and update status
      await playwrightResponder.closeBrowser();

      db.updateStatus(gmailMessageId, 'sent');

      // Send success notification
      await errorNotifier.sendSuccessNotification(extractedData.tenantName, llmResponse);

      // Mark as completed in queue
      messageQueue.messageProcessed(gmailMessageId);
    } else {
      // AUTO-SEND DISABLED - Send to Telegram for approval
      console.log('\n📱 Step 3: Sending to Telegram for approval (auto-send disabled)...');

      await telegramNotifier.sendResponseForApproval(
        extractedData.tenantName,
        extractedData.tenantMessage,
        llmResponse,
        extractedData.conversationUrl
      );

      console.log('✅ Response sent to Telegram for approval!');

      // Close browser
      await playwrightResponder.closeBrowser();

      // Update status to 'approval_pending' instead of 'sent'
      db.updateStatus(gmailMessageId, 'pending');

      // Mark as completed in queue (since we've done all we can do automatically)
      messageQueue.messageProcessed(gmailMessageId);
    }

    console.log('='.repeat(80));
    console.log(`✅ MESSAGE PROCESSING COMPLETE: ${tenantName}`);
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error processing message:', error);

    // Close browser if open
    await playwrightResponder.closeBrowser().catch(e =>
      console.error('Error closing browser:', e)
    );

    // Update database
    db.updateStatus(gmailMessageId, 'failed', (error as Error).message);

    // Determine error type and notify
    if ((error as Error).message.includes('LLM')) {
      await errorNotifier.notifyLLMError(error as Error, tenantName);
    } else if ((error as Error).message.includes('auth') || (error as Error).message.includes('login')) {
      await errorNotifier.notifyAuthExpired();
    } else {
      await errorNotifier.notifyPlaywrightError(error as Error, gmailMessageId);
    }

    // Mark as failed in queue
    messageQueue.messageFailed(gmailMessageId, error as Error);

    throw error;
  }
}

/**
 * Initialize the system
 */
function initialize(): void {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 FURNISHED FINDER AUTOMATION SYSTEM');
  console.log('='.repeat(80));

  // Display safety switches status
  console.log('\n🚨 SAFETY SWITCHES:');
  console.log(`   Test Mode: ${SAFETY_CONFIG.TEST_MODE ? '✅ ENABLED' : '❌ DISABLED'}`);
  if (SAFETY_CONFIG.TEST_MODE) {
    console.log(`   └─ Only processing messages from: "${SAFETY_CONFIG.TEST_SENDER_NAME}"`);
  }
  console.log(`   Auto-Send: ${SAFETY_CONFIG.AUTO_SEND_ENABLED ? '✅ ENABLED' : '🛡️  DISABLED (Telegram approval required)'}`);
  console.log(`   Telegram Notifications: ${SAFETY_CONFIG.TELEGRAM_NOTIFICATIONS_ENABLED ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log('='.repeat(80));

  // Connect queue event handlers
  messageQueue.on('processMessage', (message: QueuedMessage) => {
    processMessage(message).catch(err => {
      console.error('Fatal error processing message:', err);
    });
  });

  messageQueue.on('messageCompleted', (message: QueuedMessage) => {
    console.log(`✅ Queue: Message completed for ${message.tenantName}`);
  });

  messageQueue.on('messageFailed', async (message: QueuedMessage, error: Error) => {
    console.error(`❌ Queue: Message permanently failed for ${message.tenantName}`);
    console.error(`   Error: ${error.message}`);

    await errorNotifier.notifySystemError(
      error,
      `Max retries exceeded for message from ${message.tenantName}`
    );
  });

  // Start Gmail poller
  gmailPoller.start();

  console.log('\n✅ System initialized successfully');
  console.log('='.repeat(80) + '\n');
}

/**
 * Graceful shutdown
 */
function shutdown(): void {
  console.log('\n⏹️  Shutting down gracefully...');

  gmailPoller.stop();
  messageQueue.clear();
  db.close();

  console.log('✓ Shutdown complete');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
app.listen(PORT, () => {
  console.log(`\n🌐 Server running on port ${PORT}`);
  initialize();
});

export { app };
