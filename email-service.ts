/**
 * Email Service
 * Handles email access via IMAP
 * Supports Gmail, Outlook, and other IMAP-compatible email providers
 */

import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { Readable } from 'stream';

export interface EmailMessage {
  id: string;              // Unique email ID (UID)
  subject: string;
  from: string;
  to: string;
  date: Date;
  text: string;            // Plain text content
  html: string;            // HTML content (if available)
  headers: { [key: string]: string | string[] };
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    content: Buffer;
  }>;
}

export interface EmailFilter {
  from?: string[];         // Filter by sender email addresses
  subject?: string[];      // Filter by subject keywords
  unreadOnly?: boolean;    // Only fetch unread emails
  since?: Date;            // Only fetch emails since this date
}

export class EmailService {
  private imap: Imap;
  private emailType: string;
  private emailAddress: string;

  constructor() {
    this.emailType = process.env.EMAIL_TYPE || 'imap';
    this.emailAddress = process.env.EMAIL_ADDRESS || '';

    if (this.emailType === 'imap') {
      this.imap = this.createImapConnection();
    } else {
      throw new Error(`Email type "${this.emailType}" not yet supported. Currently only "imap" is supported.`);
    }
  }

  /**
   * Create IMAP connection based on environment variables
   */
  private createImapConnection(): Imap {
    const host = process.env.EMAIL_IMAP_HOST || 'imap.gmail.com';
    const port = parseInt(process.env.EMAIL_IMAP_PORT || '993');
    const secure = process.env.EMAIL_IMAP_SECURE !== 'false';
    const user = process.env.EMAIL_ADDRESS;
    const password = process.env.EMAIL_PASSWORD;

    if (!user || !password) {
      throw new Error('EMAIL_ADDRESS and EMAIL_PASSWORD must be set in environment variables');
    }

    return new Imap({
      user,
      password,
      host,
      port,
      tls: secure,
      tlsOptions: { rejectUnauthorized: false }, // Allow self-signed certificates
    });
  }

  /**
   * Connect to email server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        console.log('✅ Connected to email server');
        resolve();
      });

      this.imap.once('error', (err: Error) => {
        console.error('❌ IMAP connection error:', err);
        reject(err);
      });

      this.imap.connect();
    });
  }

  /**
   * Open mailbox (e.g., 'INBOX' or custom folder like 'AnalystData')
   * Uses EMAIL_MAILBOX environment variable if set, otherwise defaults to 'INBOX'
   */
  async openMailbox(mailbox: string = process.env.EMAIL_MAILBOX || 'INBOX'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.openBox(mailbox, false, (err, box) => {
        if (err) {
          console.error(`❌ Error opening mailbox ${mailbox}:`, err);
          reject(err);
        } else {
          console.log(`✅ Opened mailbox: ${mailbox} (${box.messages.total} messages)`);
          resolve();
        }
      });
    });
  }

  /**
   * Fetch emails matching filter criteria
   * Uses EMAIL_MAILBOX environment variable if set, otherwise defaults to 'INBOX'
   */
  async fetchEmails(filter: EmailFilter, mailbox: string = process.env.EMAIL_MAILBOX || 'INBOX'): Promise<EmailMessage[]> {
    await this.connect();
    await this.openMailbox(mailbox);

    return new Promise((resolve, reject) => {
      // Build search criteria
      const searchCriteria: any[] = [];

      // Check if we should require PDF attachments (Gmail only)
      const requirePDF = process.env.EMAIL_REQUIRE_PDF === 'true';
      const host = process.env.EMAIL_IMAP_HOST || 'imap.gmail.com';
      const isGmail = host.includes('gmail.com');

      if (requirePDF) {
        if (isGmail) {
          // Use Gmail's X-GM-RAW search to filter for emails with PDF attachments
          // This is much more efficient than downloading all emails and checking manually
          searchCriteria.push(['X-GM-RAW', 'filename:pdf']);
          console.log('   🔍 Using Gmail X-GM-RAW filter: filename:pdf (only emails with PDFs will be fetched)');
        } else {
          console.warn('   ⚠️  EMAIL_REQUIRE_PDF is enabled but not using Gmail. X-GM-RAW search is Gmail-specific and will be ignored.');
          console.warn('   ⚠️  PDF filtering will be done after fetching emails (less efficient).');
        }
      }

      if (filter.unreadOnly) {
        searchCriteria.push('UNSEEN');
      }

      if (filter.since) {
        searchCriteria.push(['SINCE', filter.since]);
      }

      // If no criteria (and not using PDF filter), get recent emails (last 30 days)
      if (searchCriteria.length === 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        searchCriteria.push(['SINCE', thirtyDaysAgo]);
      }

      this.imap.search(searchCriteria, (err, results) => {
        if (err) {
          console.error('❌ Error searching emails:', err);
          reject(err);
          return;
        }

        if (!results || results.length === 0) {
          console.log('📭 No emails found matching criteria');
          this.imap.end();
          resolve([]);
          return;
        }

        console.log(`📧 Found ${results.length} email(s) matching criteria`);

        // Fetch email headers and bodies
        const fetch = this.imap.fetch(results, {
          bodies: '',
          struct: true,
        });

        const emails: EmailMessage[] = [];
        let processedCount = 0;

        fetch.on('message', (msg, seqno) => {
          let uid: number | null = null;
          let attributes: any = null;
          let buffer = '';

          msg.on('body', (stream, info) => {
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
          });

          msg.once('attributes', (attrs) => {
            attributes = attrs;
            uid = attrs.uid;
          });

          msg.once('end', () => {
            simpleParser(buffer)
              .then((parsed: ParsedMail) => {
                // Apply filters
                if (filter.from && filter.from.length > 0) {
                  const fromAddress = parsed.from?.text || '';
                  const matchesFrom = filter.from.some(f => 
                    fromAddress.toLowerCase().includes(f.toLowerCase())
                  );
                  if (!matchesFrom) {
                    processedCount++;
                    if (processedCount === results.length) {
                      this.imap.end();
                      resolve(emails);
                    }
                    return;
                  }
                }

                if (filter.subject && filter.subject.length > 0) {
                  const subject = parsed.subject || '';
                  const matchesSubject = filter.subject.some(s => 
                    subject.toLowerCase().includes(s.toLowerCase())
                  );
                  if (!matchesSubject) {
                    processedCount++;
                    if (processedCount === results.length) {
                      this.imap.end();
                      resolve(emails);
                    }
                    return;
                  }
                }

                // Extract attachments if any
                const attachments = parsed.attachments?.map((att: any) => ({
                  filename: att.filename || 'attachment',
                  contentType: att.contentType || 'application/octet-stream',
                  size: att.size || 0,
                  content: att.content as Buffer,
                }));

                const email: EmailMessage = {
                  id: uid?.toString() || seqno.toString(),
                  subject: parsed.subject || '(No Subject)',
                  from: parsed.from?.text || 'Unknown',
                  to: parsed.to?.text || '',
                  date: parsed.date || new Date(),
                  text: parsed.text || '',
                  html: parsed.html || '',
                  headers: (parsed as any).headers,
                  attachments: attachments && attachments.length > 0 ? attachments : undefined,
                };

                emails.push(email);

                processedCount++;
                if (processedCount === results.length) {
                  this.imap.end();
                  resolve(emails);
                }
              })
              .catch((parseErr: any) => {
                console.error(`❌ Error parsing email ${seqno}:`, parseErr);
                processedCount++;
                if (processedCount === results.length) {
                  this.imap.end();
                  resolve(emails);
                }
              });
          });
        });

        fetch.once('error', (err) => {
          console.error('❌ Error fetching emails:', err);
          this.imap.end();
          reject(err);
        });
      });
    });
  }

  /**
   * Mark emails as read
   * Uses EMAIL_MAILBOX environment variable if set, otherwise defaults to 'INBOX'
   */
  async markAsRead(emailIds: number[], mailbox: string = process.env.EMAIL_MAILBOX || 'INBOX'): Promise<void> {
    await this.connect();
    await this.openMailbox(mailbox);

    return new Promise((resolve, reject) => {
      this.imap.setFlags(emailIds, ['\\Seen'], (err) => {
        if (err) {
          console.error('❌ Error marking emails as read:', err);
          reject(err);
        } else {
          console.log(`✅ Marked ${emailIds.length} email(s) as read`);
          this.imap.end();
          resolve();
        }
      });
    });
  }

  /**
   * Disconnect from email server
   */
  disconnect(): void {
    if (this.imap && this.imap.state !== 'closed') {
      this.imap.end();
    }
  }
}


