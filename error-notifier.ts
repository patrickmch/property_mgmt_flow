import { google } from 'googleapis';
import * as fs from 'fs';

const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS_PATH || 'google_credentials.json';
const TOKEN_PATH = process.env.GMAIL_TOKEN_PATH || 'token.json';
const ERROR_EMAIL = process.env.ERROR_NOTIFICATION_EMAIL || 'patrick@odysseystrategic.com';

/**
 * Error notification service using Gmail API
 */
export class ErrorNotifier {
  private auth: any;

  constructor() {
    this.initializeAuth();
  }

  private initializeAuth() {
    try {
      // Check if credentials file exists
      if (!fs.existsSync(CREDENTIALS_PATH)) {
        console.warn('⚠️  Gmail credentials not found - email notifications disabled');
        this.auth = null;
        return;
      }

      // Check if token file exists
      if (!fs.existsSync(TOKEN_PATH)) {
        console.warn('⚠️  Gmail token not found - email notifications disabled');
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
    } catch (error) {
      console.error('Failed to initialize Gmail auth for error notifications:', error);
      this.auth = null;
    }
  }

  /**
   * Send error notification email
   */
  async sendErrorNotification(
    subject: string,
    errorDetails: {
      error: Error | string;
      context?: string;
      gmailMessageId?: string;
      tenantName?: string;
      timestamp?: Date;
    }
  ): Promise<void> {
    if (!this.auth) {
      console.error('Cannot send error notification: Gmail auth not initialized');
      return;
    }

    try {
      const gmail = google.gmail({ version: 'v1', auth: this.auth });

      const emailBody = this.formatErrorEmail(subject, errorDetails);
      const encodedMessage = Buffer.from(emailBody)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      console.log(`✓ Error notification sent: ${subject}`);
    } catch (error) {
      console.error('Failed to send error notification email:', error);
    }
  }

  /**
   * Format error details into email body
   */
  private formatErrorEmail(
    subject: string,
    errorDetails: {
      error: Error | string;
      context?: string;
      gmailMessageId?: string;
      tenantName?: string;
      timestamp?: Date;
    }
  ): string {
    const timestamp = errorDetails.timestamp || new Date();
    const errorMessage = errorDetails.error instanceof Error
      ? errorDetails.error.message
      : errorDetails.error;
    const errorStack = errorDetails.error instanceof Error
      ? errorDetails.error.stack
      : '';

    const lines = [
      `To: ${ERROR_EMAIL}`,
      `Subject: [Furnished Finder Bot] ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      '<html><body>',
      '<h2>🚨 Furnished Finder Bot Error</h2>',
      `<p><strong>Time:</strong> ${timestamp.toISOString()}</p>`,
      errorDetails.context ? `<p><strong>Context:</strong> ${errorDetails.context}</p>` : '',
      errorDetails.tenantName ? `<p><strong>Tenant:</strong> ${errorDetails.tenantName}</p>` : '',
      errorDetails.gmailMessageId ? `<p><strong>Gmail Message ID:</strong> ${errorDetails.gmailMessageId}</p>` : '',
      '<hr>',
      '<h3>Error Details:</h3>',
      `<pre>${errorMessage}</pre>`,
      errorStack ? `<h3>Stack Trace:</h3><pre>${errorStack}</pre>` : '',
      '<hr>',
      '<p><em>This is an automated notification from the Furnished Finder automation system.</em></p>',
      '</body></html>'
    ];

    return lines.filter(line => line !== '').join('\r\n');
  }

  /**
   * Notify about Playwright failure
   */
  async notifyPlaywrightError(error: Error, gmailMessageId?: string): Promise<void> {
    await this.sendErrorNotification('Playwright Automation Failed', {
      error,
      context: 'Failed to navigate Furnished Finder or send response',
      gmailMessageId
    });
  }

  /**
   * Notify about LLM API failure
   */
  async notifyLLMError(error: Error, tenantName?: string): Promise<void> {
    await this.sendErrorNotification('LLM API Failed', {
      error,
      context: 'Failed to generate response from LLM API',
      tenantName
    });
  }

  /**
   * Notify about authentication expiration
   */
  async notifyAuthExpired(): Promise<void> {
    await this.sendErrorNotification('Furnished Finder Auth Expired', {
      error: 'Session authentication has expired',
      context: 'Need to refresh auth-state.json with new login'
    });
  }

  /**
   * Notify about message mismatch
   */
  async notifyMessageMismatch(
    gmailMessageId: string,
    tenantName: string
  ): Promise<void> {
    await this.sendErrorNotification('Message Mismatch Detected', {
      error: 'Gmail notification does not match Furnished Finder message',
      context: 'Timing issue or incorrect message extracted',
      gmailMessageId,
      tenantName
    });
  }

  /**
   * Notify about general system error
   */
  async notifySystemError(error: Error, context?: string): Promise<void> {
    await this.sendErrorNotification('System Error', {
      error,
      context: context || 'General system error'
    });
  }

  /**
   * Send success notification (for important milestones)
   */
  async sendSuccessNotification(
    tenantName: string,
    messagePreview: string
  ): Promise<void> {
    if (!this.auth) return;

    try {
      const gmail = google.gmail({ version: 'v1', auth: this.auth });

      const emailBody = [
        `To: ${ERROR_EMAIL}`,
        'Subject: [Furnished Finder Bot] ✓ Response Sent Successfully',
        'Content-Type: text/html; charset=utf-8',
        '',
        '<html><body>',
        '<h2>✅ Response Sent Successfully</h2>',
        `<p><strong>Tenant:</strong> ${tenantName}</p>`,
        `<p><strong>Time:</strong> ${new Date().toISOString()}</p>`,
        '<hr>',
        '<h3>Response Preview:</h3>',
        `<pre>${messagePreview.substring(0, 200)}${messagePreview.length > 200 ? '...' : ''}</pre>`,
        '<hr>',
        '<p><em>This is an automated notification from the Furnished Finder automation system.</em></p>',
        '</body></html>'
      ].join('\r\n');

      const encodedMessage = Buffer.from(emailBody)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      console.log(`✓ Success notification sent for ${tenantName}`);
    } catch (error) {
      console.error('Failed to send success notification:', error);
    }
  }
}

// Export singleton instance
export const errorNotifier = new ErrorNotifier();
