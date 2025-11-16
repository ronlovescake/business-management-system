import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getBaseUrl } from '@/lib/env';
import { sendEmail } from '@/lib/email/mailer';
import {
  generatePasswordResetToken,
  getLatestResetRequest,
  PASSWORD_RESET_REQUEST_COOLDOWN_MINUTES,
} from '@/lib/auth/password-reset';

const requestSchema = z.object({
  email: z.string().email(),
});

function getClientIp(req: Request) {
  const header = req.headers.get('x-forwarded-for');
  if (!header) {
    return undefined;
  }
  return header.split(',')[0]?.trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return NextResponse.json({
        message:
          'If an account exists for this email, a password reset link has been sent.',
      });
    }

    const lastRequest = await getLatestResetRequest(user.id);
    if (lastRequest) {
      const diffMinutes =
        (Date.now() - lastRequest.createdAt.getTime()) / 1000 / 60;
      if (diffMinutes < PASSWORD_RESET_REQUEST_COOLDOWN_MINUTES) {
        return NextResponse.json(
          {
            error: `You can request another reset email in ${Math.ceil(
              PASSWORD_RESET_REQUEST_COOLDOWN_MINUTES - diffMinutes
            )} minute(s).`,
          },
          { status: 429 }
        );
      }
    }

    const { token, expiresAt } = await generatePasswordResetToken({
      userId: user.id,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent'),
    });

    const resetUrl = new URL('/reset-password', getBaseUrl());
    resetUrl.searchParams.set('token', token);

    await sendEmail({
      to: user.email,
      subject: 'Reset your Czarlie & Ron password',
      text: `A password reset was requested for your account. Use the link below to set a new password. If you did not request this, you can ignore this message.\n\n${resetUrl.toString()}\n\nThis link will expire in 30 minutes.`,
      html: `
        <p>Hi ${user.name ?? 'there'},</p>
        <p>You (or someone else) requested to reset the password for your Czarlie & Ron account.</p>
        <p><a href="${resetUrl.toString()}" target="_blank" rel="noopener noreferrer">Click here to set a new password</a>.</p>
        <p>This link expires at <strong>${expiresAt.toLocaleString()}</strong>. If you did not request this change, you can safely ignore this email.</p>
        <p>— Czarlie & Ron Security</p>
      `,
    });

    return NextResponse.json({
      message:
        'If an account exists for this email, a password reset link has been sent.',
    });
  } catch (error) {
    logger.error('Failed to process password reset request', error);
    return NextResponse.json(
      { error: 'Unable to process request at this time.' },
      { status: 500 }
    );
  }
}
