import nodemailer from 'nodemailer';
import { createHash } from 'crypto';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Use console logging for development if SMTP not configured
    if (!process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
    } else {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  /**
   * Send OTP email for account verification
   */
  async sendOTP(email: string, otp: string): Promise<void> {
    const template = this.getOTPTemplate(otp);
    
    await this.sendEmail(email, template);
    
    // Log to console in development
    console.log(`\n📧 OTP Email sent to: ${email}`);
    console.log(`🔑 OTP Code: ${otp}`);
    console.log(`⏰ Valid for 10 minutes\n`);
  }

  /**
   * Send recovery email with seed phrase backup instructions
   */
  async sendRecoveryInstructions(email: string, backupCodes: string[]): Promise<void> {
    const template = this.getRecoveryTemplate(backupCodes);
    
    await this.sendEmail(email, template);
    
    console.log(`\n📧 Recovery email sent to: ${email}`);
    console.log(`🔐 Backup codes provided\n`);
  }

  /**
   * Send welcome email after account creation
   */
  async sendWelcomeEmail(email: string, seedPhrase: string): Promise<void> {
    const template = this.getWelcomeTemplate(seedPhrase);
    
    await this.sendEmail(email, template);
    
    console.log(`\n📧 Welcome email sent to: ${email}`);
    console.log(`🌱 Seed phrase: ${seedPhrase.split(' ').slice(0, 3).join(' ')}... (24 words)`);
  }

  /**
   * Send generic email
   */
  private async sendEmail(to: string, template: EmailTemplate): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_USER || 'noreply@zkintents.io',
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      console.log('Email sent:', info.messageId);
    } catch (error) {
      console.error('Failed to send email:', error);
      // In development, this is expected if SMTP is not configured
    }
  }

  /**
   * OTP email template
   */
  private getOTPTemplate(otp: string): EmailTemplate {
    return {
      subject: 'Verify your zk-Intents account',
      text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #030F1C; color: #fff; margin: 0; padding: 40px 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #0A1929; border-radius: 16px; padding: 40px; }
            .logo { font-size: 24px; font-weight: bold; color: #4DA2FF; margin-bottom: 32px; }
            .otp-box { background: #162A40; border: 2px solid #4DA2FF; border-radius: 12px; padding: 24px; text-align: center; margin: 32px 0; }
            .otp-code { font-size: 48px; font-weight: bold; letter-spacing: 8px; color: #4DA2FF; font-family: monospace; }
            .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #1E3A52; color: #7A90A4; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">zk-Intents</div>
            <h1>Verify Your Account</h1>
            <p>Enter this verification code to complete your account setup:</p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            <p>This code expires in <strong>10 minutes</strong>.</p>
            <p>If you didn't request this code, you can safely ignore this email.</p>
            <div class="footer">
              <p>This is an automated message from zk-Intents. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  /**
   * Recovery email template
   */
  private getRecoveryTemplate(backupCodes: string[]): EmailTemplate {
    const codesList = backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n');
    
    return {
      subject: 'Your zk-Intents Recovery Codes',
      text: `Save these recovery codes in a secure location:\n\n${codesList}\n\nEach code can be used once to recover your account.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #030F1C; color: #fff; margin: 0; padding: 40px 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #0A1929; border-radius: 16px; padding: 40px; }
            .logo { font-size: 24px; font-weight: bold; color: #4DA2FF; margin-bottom: 32px; }
            .warning { background: #4A1D1D; border-left: 4px solid #FF6B6B; padding: 16px; margin: 24px 0; border-radius: 8px; }
            .codes { background: #162A40; border-radius: 12px; padding: 24px; margin: 24px 0; font-family: monospace; }
            .code-item { padding: 8px 0; border-bottom: 1px solid #1E3A52; }
            .code-item:last-child { border-bottom: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">zk-Intents</div>
            <h1>Recovery Codes</h1>
            <div class="warning">
              <strong>⚠️ Important:</strong> Save these codes in a secure location. They can be used to recover your account if you lose access.
            </div>
            <div class="codes">
              ${backupCodes.map((code, i) => `<div class="code-item">${i + 1}. ${code}</div>`).join('')}
            </div>
            <p><strong>Security Tips:</strong></p>
            <ul>
              <li>Each code can only be used once</li>
              <li>Store codes offline in a secure location</li>
              <li>Don't share codes with anyone</li>
            </ul>
          </div>
        </body>
        </html>
      `,
    };
  }

  /**
   * Welcome email template with seed phrase
   */
  private getWelcomeTemplate(seedPhrase: string): EmailTemplate {
    const words = seedPhrase.split(' ');
    
    return {
      subject: 'Welcome to zk-Intents - Save Your Seed Phrase',
      text: `Welcome to zk-Intents!\n\nYour 24-word seed phrase:\n${seedPhrase}\n\n⚠️ CRITICAL: Store this in a secure location. This is the only way to recover your account.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #030F1C; color: #fff; margin: 0; padding: 40px 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #0A1929; border-radius: 16px; padding: 40px; }
            .logo { font-size: 24px; font-weight: bold; color: #4DA2FF; margin-bottom: 32px; }
            .alert { background: #4A1D1D; border: 2px solid #FF6B6B; padding: 24px; margin: 24px 0; border-radius: 12px; }
            .seed-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #162A40; padding: 24px; border-radius: 12px; margin: 24px 0; }
            .seed-word { background: #0A1929; padding: 12px; border-radius: 8px; text-align: center; font-family: monospace; font-size: 14px; }
            .word-num { color: #7A90A4; font-size: 10px; display: block; margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">zk-Intents</div>
            <h1>Welcome! 🎉</h1>
            <p>Your account has been created successfully.</p>
            <div class="alert">
              <strong>⚠️ SAVE YOUR SEED PHRASE</strong>
              <p>Write down these 24 words in order. This is the ONLY way to recover your account. zk-Intents cannot recover it for you.</p>
            </div>
            <div class="seed-grid">
              ${words.map((word, i) => `
                <div class="seed-word">
                  <span class="word-num">${i + 1}</span>
                  <strong>${word}</strong>
                </div>
              `).join('')}
            </div>
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Write down these words on paper</li>
              <li>Store in a secure, offline location</li>
              <li>Never share with anyone</li>
              <li>Delete this email after saving</li>
            </ol>
          </div>
        </body>
        </html>
      `,
    };
  }
}

export const emailService = new EmailService();
