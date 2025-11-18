import { TELEGRAM_CONFIG } from './config';

/**
 * Telegram Notifier for response approval
 *
 * This sends generated responses to your Telegram for manual review/approval
 * before they are sent to Furnished Finder.
 */
export class TelegramNotifier {
  /**
   * Send response to Telegram for approval
   */
  async sendResponseForApproval(
    tenantName: string,
    tenantMessage: string,
    generatedResponse: string,
    conversationUrl: string
  ): Promise<void> {
    try {
      if (!TELEGRAM_CONFIG.BOT_TOKEN || !TELEGRAM_CONFIG.CHAT_ID) {
        console.log('\n⚠️  TELEGRAM NOT CONFIGURED - Response generated but not sent:');
        console.log('='.repeat(80));
        console.log(`Tenant: ${tenantName}`);
        console.log(`\nTheir message:\n${tenantMessage}`);
        console.log(`\nGenerated response:\n${generatedResponse}`);
        console.log(`\nConversation URL: ${conversationUrl}`);
        console.log('='.repeat(80));
        console.log('\nTo enable Telegram notifications:');
        console.log('1. Set TELEGRAM_BOT_TOKEN in .env');
        console.log('2. Set TELEGRAM_CHAT_ID in .env');
        return;
      }

      // TODO: Implement actual Telegram API call
      // For now, just log the message
      console.log('\n📱 TELEGRAM NOTIFICATION (would send to Telegram):');
      console.log('='.repeat(80));
      console.log(`🆕 New Response Ready for Approval`);
      console.log(`\n👤 Tenant: ${tenantName}`);
      console.log(`\n📥 Their Message:\n${tenantMessage}`);
      console.log(`\n📤 Generated Response:\n${generatedResponse}`);
      console.log(`\n🔗 Conversation: ${conversationUrl}`);
      console.log('='.repeat(80));

      // When Telegram is implemented, this would send the message
      // and provide buttons for "Approve" and "Reject" actions

    } catch (error) {
      console.error('❌ Error sending Telegram notification:', error);
      throw error;
    }
  }

  /**
   * Send error notification via Telegram
   */
  async sendErrorNotification(
    errorMessage: string,
    tenantName?: string
  ): Promise<void> {
    try {
      if (!TELEGRAM_CONFIG.BOT_TOKEN || !TELEGRAM_CONFIG.CHAT_ID) {
        console.error(`\n❌ ERROR: ${errorMessage}`);
        if (tenantName) {
          console.error(`   Tenant: ${tenantName}`);
        }
        return;
      }

      // TODO: Implement actual Telegram API call
      console.log('\n📱 TELEGRAM ERROR NOTIFICATION (would send to Telegram):');
      console.log(`❌ Error: ${errorMessage}`);
      if (tenantName) {
        console.log(`   Tenant: ${tenantName}`);
      }

    } catch (error) {
      console.error('❌ Error sending Telegram error notification:', error);
    }
  }
}

// Export singleton instance
export const telegramNotifier = new TelegramNotifier();
