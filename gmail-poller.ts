import { google } from 'googleapis';
import * as fs from 'fs';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'google_credentials.json';
const SEEN_EMAILS_PATH = 'seen_emails.json';

// For testing, use patrick@odysseystrategic.com
// For production, change to: from:furnishedfinder.com
const EMAIL_FILTER = 'from:patrick@odysseystrategic.com';

// Track which emails we've already processed
let seenEmailIds = new Set<string>();

/**
 * Load OAuth2 client with saved credentials
 */
function authorize() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  oAuth2Client.setCredentials(token);

  return oAuth2Client;
}

/**
 * Load previously seen email IDs from disk
 */
function loadSeenEmails() {
  if (fs.existsSync(SEEN_EMAILS_PATH)) {
    const data = JSON.parse(fs.readFileSync(SEEN_EMAILS_PATH, 'utf8'));
    seenEmailIds = new Set(data);
    console.log(`✓ Loaded ${seenEmailIds.size} previously seen emails`);
  } else {
    console.log('✓ No previous email history found, starting fresh');
  }
}

/**
 * Save seen email IDs to disk
 */
function saveSeenEmails() {
  fs.writeFileSync(SEEN_EMAILS_PATH, JSON.stringify(Array.from(seenEmailIds), null, 2));
}

/**
 * Categorize email based on subject line
 */
function categorizeEmail(subject: string) {
  // Extract inquiry ID if present
  const idMatch = subject.match(/\[ID#(\d+)\]/);
  const inquiryId = idMatch ? idMatch[1] : null;

  // Determine email type
  let type = 'UNKNOWN';
  let name = null;

  if (subject.includes('Booking Inquiry from')) {
    type = 'NEW_INQUIRY';
    // Extract name after "from"
    const nameMatch = subject.match(/Booking Inquiry from (.+?)(?:\[|$)/);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }
  } else if (subject.includes('Property Owner Message')) {
    type = 'NEW_INQUIRY';
    // Extract name if available
    const nameMatch = subject.match(/Property Owner Message from (.+?)(?:\[|$)/);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }
  } else if (subject.includes('New reply from Furnished Finder user')) {
    type = 'REPLY';
  } else if (subject.includes('reply from') || subject.includes('Re:')) {
    type = 'REPLY';
  }

  return { type, inquiryId, name };
}

/**
 * Check Gmail for new messages
 */
async function checkGmail(auth: any) {
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    // Search for messages from the specified email
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: EMAIL_FILTER,
      maxResults: 10,
    });

    const messages = response.data.messages || [];

    if (messages.length === 0) {
      console.log('📭 No messages found');
      return;
    }

    console.log(`\n📬 Found ${messages.length} total messages from filter`);

    let newCount = 0;

    // Process each message
    for (const message of messages) {
      // Skip if we've already seen this email
      if (seenEmailIds.has(message.id!)) {
        continue;
      }

      newCount++;

      // Get full message details
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
      });

      // Extract subject and from headers
      const headers = msg.data.payload?.headers || [];
      const subjectHeader = headers.find((h) => h.name === 'Subject');
      const fromHeader = headers.find((h) => h.name === 'From');
      const dateHeader = headers.find((h) => h.name === 'Date');

      const subject = subjectHeader?.value || '(no subject)';
      const from = fromHeader?.value || '(unknown sender)';
      const date = dateHeader?.value || '(unknown date)';

      // Categorize the email
      const { type, inquiryId, name } = categorizeEmail(subject);

      // Log the email details
      console.log('\n' + '='.repeat(80));
      console.log('🆕 NEW EMAIL DETECTED');
      console.log('='.repeat(80));
      console.log(`📧 Type: ${type}`);
      console.log(`📋 Subject: ${subject}`);
      console.log(`👤 From: ${from}`);
      console.log(`📅 Date: ${date}`);

      if (inquiryId) {
        console.log(`🔢 Inquiry ID: ${inquiryId}`);
      }

      if (name) {
        console.log(`👤 Guest Name: ${name}`);
      }

      console.log(`🆔 Message ID: ${message.id}`);
      console.log('='.repeat(80));

      // Mark as seen
      seenEmailIds.add(message.id!);
    }

    if (newCount === 0) {
      console.log('✓ No new messages (all already processed)');
    } else {
      console.log(`\n✓ Processed ${newCount} new message(s)`);
      // Save seen emails to disk
      saveSeenEmails();
    }

  } catch (error) {
    console.error('❌ Error checking Gmail:', error);
  }
}

/**
 * Main polling loop
 */
async function startPolling() {
  console.log('\n🚀 Gmail Poller Started');
  console.log('='.repeat(80));
  console.log(`📧 Monitoring: ${EMAIL_FILTER}`);
  console.log('⏱️  Polling interval: 30 seconds');
  console.log('⏹️  Press Ctrl+C to stop\n');
  console.log('='.repeat(80));

  const auth = authorize();
  loadSeenEmails();

  // Initial check
  console.log('\n🔍 Performing initial check...');
  await checkGmail(auth);

  // Poll every 30 seconds
  setInterval(async () => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n[${timestamp}] 🔍 Checking for new emails...`);
    await checkGmail(auth);
  }, 30000);
}

// Start the poller
startPolling().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
