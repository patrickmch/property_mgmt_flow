import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, 'messages.db');

export interface Message {
  id?: number;
  gmail_message_id: string;
  tenant_name: string;
  tenant_email?: string;
  tenant_message: string;
  our_response?: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  created_at?: string;
  processed_at?: string;
  error?: string;
  ff_conversation_url?: string;
}

class MessageDatabase {
  private db: SqlJsDatabase | null = null;
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    const SQL = await initSqlJs();

    // Load existing database if it exists
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.initializeSchema();
    this.initialized = true;
  }

  private initializeSchema() {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gmail_message_id TEXT UNIQUE NOT NULL,
        tenant_name TEXT NOT NULL,
        tenant_email TEXT,
        tenant_message TEXT NOT NULL,
        our_response TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'sent', 'failed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        error TEXT,
        ff_conversation_url TEXT
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_status ON messages(status)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_gmail_id ON messages(gmail_message_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_created_at ON messages(created_at)`);

    this.save();
  }

  /**
   * Save database to disk
   */
  private save() {
    if (!this.db) return;
    const data = this.db.export();
    fs.writeFileSync(DB_PATH, data);
  }

  /**
   * Insert a new message into the database
   */
  insertMessage(message: Message): number {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `INSERT INTO messages (
        gmail_message_id,
        tenant_name,
        tenant_email,
        tenant_message,
        status,
        ff_conversation_url
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        message.gmail_message_id,
        message.tenant_name,
        message.tenant_email || null,
        message.tenant_message,
        message.status,
        message.ff_conversation_url || null
      ]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0] as number;

    this.save();
    return id;
  }

  /**
   * Check if a Gmail message ID already exists
   */
  messageExists(gmailMessageId: string): boolean {
    if (!this.db) return false;

    const result = this.db.exec(
      'SELECT COUNT(*) as count FROM messages WHERE gmail_message_id = ?',
      [gmailMessageId]
    );

    if (result.length === 0) return false;
    return (result[0].values[0][0] as number) > 0;
  }

  /**
   * Update message status
   */
  updateStatus(
    gmailMessageId: string,
    status: Message['status'],
    error?: string
  ): void {
    if (!this.db) return;

    this.db.run(
      `UPDATE messages
      SET status = ?, error = ?, processed_at = CURRENT_TIMESTAMP
      WHERE gmail_message_id = ?`,
      [status, error || null, gmailMessageId]
    );

    this.save();
  }

  /**
   * Update message with LLM response
   */
  updateResponse(gmailMessageId: string, response: string): void {
    if (!this.db) return;

    this.db.run(
      `UPDATE messages
      SET our_response = ?
      WHERE gmail_message_id = ?`,
      [response, gmailMessageId]
    );

    this.save();
  }

  /**
   * Get message by Gmail message ID
   */
  getMessageByGmailId(gmailMessageId: string): Message | undefined {
    if (!this.db) return undefined;

    const result = this.db.exec(
      'SELECT * FROM messages WHERE gmail_message_id = ?',
      [gmailMessageId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return undefined;
    }

    return this.rowToMessage(result[0].columns, result[0].values[0]);
  }

  /**
   * Get all messages by status
   */
  getMessagesByStatus(status: Message['status']): Message[] {
    if (!this.db) return [];

    const result = this.db.exec(
      'SELECT * FROM messages WHERE status = ? ORDER BY created_at DESC',
      [status]
    );

    if (result.length === 0) return [];

    return result[0].values.map(row =>
      this.rowToMessage(result[0].columns, row)
    );
  }

  /**
   * Get recent messages (for status endpoint)
   */
  getRecentMessages(limit: number = 10): Message[] {
    if (!this.db) return [];

    const result = this.db.exec(
      'SELECT * FROM messages ORDER BY created_at DESC LIMIT ?',
      [limit]
    );

    if (result.length === 0) return [];

    return result[0].values.map(row =>
      this.rowToMessage(result[0].columns, row)
    );
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    sent: number;
    failed: number;
  } {
    if (!this.db) {
      return { total: 0, pending: 0, processing: 0, sent: 0, failed: 0 };
    }

    const result = this.db.exec(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM messages
    `);

    if (result.length === 0 || result[0].values.length === 0) {
      return { total: 0, pending: 0, processing: 0, sent: 0, failed: 0 };
    }

    const row = result[0].values[0];
    return {
      total: row[0] as number,
      pending: row[1] as number,
      processing: row[2] as number,
      sent: row[3] as number,
      failed: row[4] as number
    };
  }

  /**
   * Convert SQL row to Message object
   */
  private rowToMessage(columns: string[], values: any[]): Message {
    const message: any = {};
    columns.forEach((col, idx) => {
      message[col] = values[idx];
    });
    return message as Message;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}

// Export singleton instance
export const db = new MessageDatabase();
