# Sentry Integration Guide

This document explains how Sentry error tracking is set up in the Business Management System.

## 📋 Overview

Sentry is integrated to provide real-time error tracking and performance monitoring in production. It captures:

- **Uncaught Exceptions**: Automatically captures unhandled errors
- **API Errors**: Tracks failed API requests
- **Console Errors**: Captures `logger.error()` calls in production
- **Performance Issues**: Monitors slow transactions and queries
- **Session Replays**: Optional replay of user sessions when errors occur

## 🔧 Setup Steps

### 1. Create Sentry Account

1. Go to [sentry.io](https://sentry.io) and create an account
2. Create a new project and select "Next.js"
3. Copy your DSN (Data Source Name)

### 2. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN="https://your-key@o123456.ingest.sentry.io/123456"
SENTRY_ORG="your-organization-name"
SENTRY_PROJECT="your-project-name"
SENTRY_AUTH_TOKEN="your-auth-token"
```

**To get your auth token:**

1. Go to Sentry → Settings → Account → API → Auth Tokens
2. Create a new token with `project:read` and `project:releases` permissions
3. Copy the token to your `.env.local`

### 3. Test the Integration

```typescript
import { logger } from '@/lib/logger';

// This will be sent to Sentry in production
logger.error('Test error', new Error('This is a test'));
```

## 📁 File Structure

```
/
├── sentry.client.config.ts    # Client-side Sentry configuration
├── sentry.server.config.ts    # Server-side Sentry configuration
├── sentry.edge.config.ts      # Edge runtime Sentry configuration
├── next.config.js             # Includes Sentry webpack plugin
└── src/
    └── lib/
        ├── env.ts             # Environment variable validation
        └── logger.ts          # Integrated with Sentry
```

## 🎯 How It Works

### Automatic Error Capture

Sentry automatically captures:

1. **Unhandled Promise Rejections**
2. **Uncaught Exceptions**
3. **React Error Boundaries** (via ErrorBoundary component)
4. **API Route Errors** (500 errors)

### Manual Error Logging

Use the logger for explicit error tracking:

```typescript
import { logger } from '@/lib/logger';

try {
  // Your code
} catch (error) {
  // Automatically sent to Sentry in production
  logger.error('Operation failed:', error);
}
```

### Source Maps

Source maps are automatically uploaded to Sentry during production builds, allowing you to see the original TypeScript code in stack traces.

## 📊 Sentry Features

### Performance Monitoring

Sentry tracks:

- API request durations
- Database query performance
- Page load times
- Component render times

### Session Replay

When an error occurs, Sentry can replay the user's session to see what led to the error. This is configured in `sentry.client.config.ts`:

```typescript
replaysOnErrorSampleRate: 1.0,  // Record 100% of sessions with errors
replaysSessionSampleRate: 0.1,  // Record 10% of all sessions
```

### Alerts

Configure alerts in Sentry dashboard:

- Email notifications for new errors
- Slack integration
- PagerDuty for critical errors

## 🔒 Privacy & Security

### Data Masking

Session replays are configured to:

- Mask all text by default
- Block all media (images, videos)
- Exclude sensitive input fields

### Filtering Sensitive Data

Add to Sentry config to filter sensitive data:

```typescript
beforeSend(event) {
  // Filter out sensitive headers
  if (event.request?.headers) {
    delete event.request.headers['Authorization'];
    delete event.request.headers['Cookie'];
  }
  return event;
}
```

## 🧪 Development vs Production

- **Development**: Errors are logged to console only
- **Production**: Errors are sent to Sentry AND logged to console

Test Sentry locally by setting:

```bash
NODE_ENV=production npm run build
npm start
```

## 📈 Monitoring Dashboard

Access your Sentry dashboard at:
https://sentry.io/organizations/your-org/issues/

Key metrics to monitor:

- Error frequency
- Affected users
- Stack traces
- Performance issues

## 🔧 Troubleshooting

### Sentry Not Capturing Errors

1. Check `NEXT_PUBLIC_SENTRY_DSN` is set
2. Verify you're in production mode
3. Check Sentry dashboard for DSN validity
4. Look for console errors about Sentry init

### Source Maps Not Working

1. Ensure `SENTRY_AUTH_TOKEN` is set
2. Check `SENTRY_ORG` and `SENTRY_PROJECT` match your Sentry config
3. Verify auth token has correct permissions

### Too Many Errors

Configure sample rates in Sentry configs:

```typescript
// Lower sample rate to reduce noise
tracesSampleRate: 0.1, // Only 10% of transactions
```

## 📚 Resources

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Dashboard](https://sentry.io)
- [Error Handling Best Practices](https://docs.sentry.io/platforms/javascript/guides/nextjs/best-practices/)

## ✅ Verification Checklist

- [ ] Sentry account created
- [ ] Project created in Sentry dashboard
- [ ] Environment variables configured
- [ ] Test error sent and received in Sentry
- [ ] Source maps working (stack traces show TypeScript files)
- [ ] Alerts configured
- [ ] Team members added to Sentry project

## 🚀 Next Steps

1. Configure alert rules in Sentry dashboard
2. Set up Slack integration
3. Configure performance monitoring thresholds
4. Review and adjust sample rates for your traffic volume
5. Set up release tracking with `sentry-cli`
