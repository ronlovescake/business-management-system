import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { env } from '@/lib/env';

let transporter: Transporter | null = null;

function ensureEmailConfig() {
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error(
      'SMTP configuration is missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM in your environment.'
    );
  }
}

export function getEmailTransporter(): Transporter {
  ensureEmailConfig();

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

export async function sendEmail(options: SendMailOptions) {
  const mailer = getEmailTransporter();

  await mailer.sendMail({
    from: env.EMAIL_FROM ?? env.SMTP_USER,
    ...options,
  });
}
