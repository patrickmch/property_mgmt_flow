import * as cron from 'node-cron';
import { google } from 'googleapis';
import * as fs from 'fs';
import { db } from './database';
import { messageQueue } from './message-queue';
import { errorNotifier } from './error-notifier';
import { SAFETY_CONFIG, SYSTEM_CONFIG } from './config';

const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS_PATH || 'google_credentials.json';
const TOKEN_PATH = process.env.GMAIL_TOKEN_PATH || 'token.json';
const GMAIL_CHECK_INTERVAL = SYSTEM_CONFIG.GMAIL_CHECK_INTERVAL;
const EMAIL_FILTER = SYSTEM_CONFIG.GMAIL_FILTER;

/**
 * Gmail Poller using node-cron
 */
export class GmailPoller {
  private auth: any;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.initializeAuth();
  }

  /**
   * Initialize Gmail OAuth2 authentication
   */
  private initializeAuth(): void {
    try {
      // Check if credentials file exists
      if (!fs.existsSync(CREDENTIALS_PATH)) {
        console.warn('⚠️  Gmail credentials not found - email polling disabled');
        console.warn(`   Missing file: ${CREDENTIALS_PATH}`);
        this.auth = null;
        return;
      }

      // Check if token file exists
      if (!fs.existsSync(TOKEN_PATH)) {
        console.warn('⚠️  Gmail token not found - email polling disabled');
        console.warn(`   Missing file: ${TOKEN_PATH}`);
        console.warn('   Run: npm run authorize-gmail');
        this.auth = null;
        return;
      }

      const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
      const { client_secret, client_id, redirect_uris } = credentials.installed;

      const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oAuth2Client.setCredentials(token);

      this.auth = oAuth2Client;
      console.log('✓ Gmail authentication initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Gmail auth:', error);
      console.error('   Email polling will be disabled');
      this.auth = null;
    }
  }

  /**
   * Start the cron job
   */
  start(): void {
    if (!this.auth) {
      console.warn('⚠️  Gmail poller cannot start - authentication not configured');
      console.warn('   System will continue without email polling');
      return;
    }

    if (this.isRunning) {
      console.log('⚠️  Gmail poller is already running');
      return;
    }

    console.log('🚀 Starting Gmail poller');
    console.log(`📧 Filter: ${EMAIL_FILTER}`);
    console.log(`⏱️  Interval: ${GMAIL_CHECK_INTERVAL}`);

    // Run immediately on start
    this.checkGmail();

    // Then run on schedule
    this.cronJob = cron.schedule(GMAIL_CHECK_INTERVAL, () => {
      this.checkGmail();
    });

    this.isRunning = true;
    console.log('✓ Gmail poller started successfully');
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.isRunning = false;
      console.log('⏹️  Gmail poller stopped');
    }
  }

  /**
   * Check Gmail for new messages
   */
  private async checkGmail(): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] 🔍 Checking Gmail for new messages...`);

    try {
      const gmail = google.gmail({ version: 'v1', auth: this.auth });

      // Search for messages from Furnished Finder
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: EMAIL_FILTER,
        maxResults: 10
      });

      const messages = response.data.messages || [];

      if (messages.length === 0) {
        console.log('   📭 No messages found');
        return;
      }

      console.log(`   📬 Found ${messages.length} total messages from filter`);

      let newCount = 0;

      // Process each message
      for (const message of messages) {
        const gmailMessageId = message.id!;

        // Skip if already in database
        if (db.messageExists(gmailMessageId)) {
          continue;
        }

        // Skip if already in queue
        if (messageQueue.isInQueue(gmailMessageId)) {
          continue;
        }

        newCount++;

        // Get full message details
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: gmailMessageId
        });

        // Extract headers
        const headers = msg.data.payload?.headers || [];
        const subjectHeader = headers.find(h => h.name === 'Subject');
        const fromHeader = headers.find(h => h.name === 'From');
        const dateHeader = headers.find(h => h.name === 'Date');

        const subject = subjectHeader?.value || '(no subject)';
        const from = fromHeader?.value || '(unknown sender)';
        const date = dateHeader?.value || '(unknown date)';

        // Categorize the email
        const { type, tenantName, tenantEmail } = this.categorizeEmail(subject, from);

        // Only process new inquiries (not replies)
        if (type !== 'NEW_INQUIRY') {
          console.log(`   ⏭️  Skipping ${type}: ${subject}`);
          continue;
        }

        // 🚨 SAFETY SWITCH #1: TEST MODE FILTER
        if (SAFETY_CONFIG.TEST_MODE) {
          const senderName = tenantName || 'Unknown';
          if (!senderName.includes(SAFETY_CONFIG.TEST_SENDER_NAME)) {
            console.log('\n   ' + '='.repeat(70));
            console.log('   🛡️  TEST MODE: IGNORING MESSAGE (not from test sender)');
            console.log('   ' + '='.repeat(70));
            console.log(`   📋 Subject: ${subject}`);
            console.log(`   👤 From: ${from}`);
            console.log(`   👤 Tenant: ${senderName}`);
            console.log(`   ⚠️  Test mode enabled - only processing messages from "${SAFETY_CONFIG.TEST_SENDER_NAME}"`);
            console.log('   ' + '='.repeat(70));
            continue;
          }
        }

        console.log('\n   ' + '='.repeat(70));
        console.log('   🆕 NEW BOOKING INQUIRY DETECTED');
        console.log('   ' + '='.repeat(70));
        console.log(`   📋 Subject: ${subject}`);
        console.log(`   👤 From: ${from}`);
        console.log(`   📅 Date: ${date}`);
        console.log(`   👤 Tenant: ${tenantName || 'Unknown'}`);
        console.log(`   🆔 Gmail ID: ${gmailMessageId}`);
        console.log('   ' + '='.repeat(70));

        // Add to database with pending status
        db.insertMessage({
          gmail_message_id: gmailMessageId,
          tenant_name: tenantName || 'Unknown Tenant',
          tenant_email: tenantEmail,
          tenant_message: subject, // We'll get the full message from FF
          status: 'pending'
        });

        // Add to queue for processing
        messageQueue.enqueue({
          gmailMessageId,
          tenantName: tenantName || 'Unknown Tenant',
          tenantEmail,
          tenantMessage: subject
        });
      }

      if (newCount === 0) {
        console.log('   ✓ No new messages (all already processed)');
      } else {
        console.log(`\n   ✅ Added ${newCount} new message(s) to queue`);
      }

    } catch (error) {
      console.error('   ❌ Error checking Gmail:', error);
      await errorNotifier.notifySystemError(
        error as Error,
        'Failed to check Gmail for new messages'
      );
    }
  }

  /**
   * Categorize email based on subject line
   */
  private categorizeEmail(
    subject: string,
    from: string
  ): {
    type: 'NEW_INQUIRY' | 'REPLY' | 'UNKNOWN';
    tenantName?: string;
    tenantEmail?: string;
  } {
    let type: 'NEW_INQUIRY' | 'REPLY' | 'UNKNOWN' = 'UNKNOWN';
    let tenantName: string | undefined;
    let tenantEmail: string | undefined;

    // Extract tenant name from subject
    if (subject.includes('Booking Inquiry from')) {
      type = 'NEW_INQUIRY';
      const nameMatch = subject.match(/Booking Inquiry from (.+?)(?:\[|$)/);
      if (nameMatch) {
        tenantName = nameMatch[1].trim();
      }
    } else if (subject.includes('Property Owner Message')) {
      type = 'NEW_INQUIRY';
      const nameMatch = subject.match(/Property Owner Message from (.+?)(?:\[|$)/);
      if (nameMatch) {
        tenantName = nameMatch[1].trim();
      }
    } else if (
      subject.includes('New reply from') ||
      subject.includes('reply from') ||
      subject.includes('Re:')
    ) {
      type = 'REPLY';
    }

    // Try to extract email from "from" header
    const emailMatch = from.match(/<(.+?)>/);
    if (emailMatch) {
      tenantEmail = emailMatch[1];
    }

    return { type, tenantName, tenantEmail };
  }

  /**
   * Get poller status
   */
  getStatus(): {
    isRunning: boolean;
    interval: string;
    filter: string;
  } {
    return {
      isRunning: this.isRunning,
      interval: GMAIL_CHECK_INTERVAL,
      filter: EMAIL_FILTER
    };
  }
}

// Export singleton instance
export const gmailPoller = new GmailPoller();
