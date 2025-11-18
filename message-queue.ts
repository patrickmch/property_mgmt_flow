import { EventEmitter } from 'events';

export interface QueuedMessage {
  gmailMessageId: string;
  tenantName: string;
  tenantEmail?: string;
  tenantMessage: string;
  retryCount: number;
  addedAt: Date;
}

/**
 * Simple in-memory message queue with sequential processing
 */
export class MessageQueue extends EventEmitter {
  private queue: QueuedMessage[] = [];
  private processing: boolean = false;
  private maxRetries: number = 3;

  constructor(maxRetries: number = 3) {
    super();
    this.maxRetries = maxRetries;
  }

  /**
   * Add a message to the queue
   */
  enqueue(message: Omit<QueuedMessage, 'retryCount' | 'addedAt'>): void {
    const queuedMessage: QueuedMessage = {
      ...message,
      retryCount: 0,
      addedAt: new Date()
    };

    this.queue.push(queuedMessage);
    console.log(`📥 Message queued: ${message.tenantName} (Queue size: ${this.queue.length})`);

    // Emit event for new message
    this.emit('messageAdded', queuedMessage);

    // Start processing if not already processing
    if (!this.processing) {
      this.processNext();
    }
  }

  /**
   * Process the next message in the queue
   */
  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      console.log('✓ Queue empty - waiting for new messages');
      return;
    }

    this.processing = true;
    const message = this.queue[0]; // Peek at first message (don't remove yet)

    console.log(`⚙️  Processing message from ${message.tenantName} (${this.queue.length} in queue)`);

    try {
      // Emit processing event - the server will handle the actual processing
      this.emit('processMessage', message);

      // Wait for processing to complete
      // The server will call messageProcessed() or messageFailed() when done

    } catch (error) {
      console.error('Error in queue processing:', error);
      this.messageFailed(message.gmailMessageId, error as Error);
    }
  }

  /**
   * Mark a message as successfully processed and remove from queue
   */
  messageProcessed(gmailMessageId: string): void {
    const index = this.queue.findIndex(m => m.gmailMessageId === gmailMessageId);

    if (index === -1) {
      console.warn(`⚠️  Message ${gmailMessageId} not found in queue`);
      return;
    }

    const message = this.queue[index];
    this.queue.splice(index, 1);

    console.log(`✅ Message processed successfully: ${message.tenantName}`);
    this.emit('messageCompleted', message);

    // Process next message
    this.processNext();
  }

  /**
   * Mark a message as failed and handle retry logic
   */
  messageFailed(gmailMessageId: string, error: Error): void {
    const index = this.queue.findIndex(m => m.gmailMessageId === gmailMessageId);

    if (index === -1) {
      console.warn(`⚠️  Message ${gmailMessageId} not found in queue`);
      return;
    }

    const message = this.queue[index];
    message.retryCount++;

    console.error(`❌ Message processing failed: ${message.tenantName} (Attempt ${message.retryCount}/${this.maxRetries})`);
    console.error(`   Error: ${error.message}`);

    if (message.retryCount >= this.maxRetries) {
      // Max retries exceeded - remove from queue and emit failed event
      this.queue.splice(index, 1);
      console.error(`💀 Max retries exceeded for ${message.tenantName} - removing from queue`);
      this.emit('messageFailed', message, error);

      // Process next message
      this.processNext();
    } else {
      // Retry - move to end of queue
      this.queue.splice(index, 1);
      this.queue.push(message);
      console.log(`🔄 Retrying ${message.tenantName} - moved to end of queue`);

      // Process next message (the retry will come up later)
      this.processNext();
    }
  }

  /**
   * Get current queue status
   */
  getStatus(): {
    queueSize: number;
    processing: boolean;
    messages: Array<{
      tenantName: string;
      gmailMessageId: string;
      retryCount: number;
      addedAt: Date;
    }>;
  } {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      messages: this.queue.map(m => ({
        tenantName: m.tenantName,
        gmailMessageId: m.gmailMessageId,
        retryCount: m.retryCount,
        addedAt: m.addedAt
      }))
    };
  }

  /**
   * Check if a message is already in the queue
   */
  isInQueue(gmailMessageId: string): boolean {
    return this.queue.some(m => m.gmailMessageId === gmailMessageId);
  }

  /**
   * Clear the queue (for testing/debugging)
   */
  clear(): void {
    const clearedCount = this.queue.length;
    this.queue = [];
    this.processing = false;
    console.log(`🗑️  Queue cleared: ${clearedCount} messages removed`);
  }

  /**
   * Get queue size
   */
  get size(): number {
    return this.queue.length;
  }
}

// Export singleton instance
export const messageQueue = new MessageQueue();
