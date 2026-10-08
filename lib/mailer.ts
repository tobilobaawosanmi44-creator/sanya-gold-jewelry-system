import nodemailer from 'nodemailer';

// Email is configured with ordinary SMTP settings, so it works with Gmail, Zoho, Brevo, Resend, etc.
//   SMTP_HOST, SMTP_PORT (465 or 587), SMTP_USER, SMTP_PASS, and optionally SMTP_FROM.
export const emailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  fromName: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
};

export class MailError extends Error {}

export async function sendMail(m: Mail) {
  if (!emailConfigured()) throw new MailError('Email sending is not set up yet.');
  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  const address = process.env.SMTP_FROM || process.env.SMTP_USER!;
  try {
    await transporter.sendMail({
      from: { name: m.fromName, address: address.replace(/^.*<|>.*$/g, '') },
      to: m.to,
      replyTo: m.replyTo,
      subject: m.subject,
      text: m.text,
      html: m.html,
      attachments: m.attachments,
    });
  } catch (e) {
    const err = e as { code?: string; responseCode?: number; message?: string };
    console.error('Email failed', err.code, err.responseCode, err.message);
    if (err.code === 'EAUTH' || err.responseCode === 535) throw new MailError('The email server rejected the login. Check SMTP_USER and SMTP_PASS (for Gmail use an App Password).');
    if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED', 'EDNS'].includes(err.code ?? '')) {
      throw new MailError('Could not reach the email server. On Render, outgoing email only works on a paid web service.');
    }
    throw new MailError('The email could not be sent. Please check the address and try again.');
  }
}
