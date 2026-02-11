# Customer Messaging Integration Feature

## Overview

Implemented one-click customer messaging workflow in the Checkout Links Invoicing tab. When clicking a customer name, the system automatically copies the invoice message to clipboard, opens Facebook Messenger, ticks the checkbox, and persists the status to the database.

## Workflow

### User Actions:

1. **Click customer name** in the Invoicing tab
2. **System automatically**:
   - ✅ Generates personalized invoice message with time-based greeting and dynamic data
   - ✅ Copies message to clipboard
   - ✅ Opens customer's Facebook Messenger in new window
   - ✅ Ticks the checkbox (marks as sent)
   - ✅ Persists tickbox status to database
   - ✅ Shows success notification

### Manual Checkbox:

- Users can also manually tick/untick checkboxes
- Changes are automatically persisted to database
- Optimistic UI updates with revert on failure

## Features Implemented

### 1. Customer Lookup Hook

**File**: `/src/modules/clothing/operations/checkout-links/hooks/useInvoiceCustomerLookup.ts`

- Fetches all customers with Facebook Messenger links
- Creates lookup map for customer name → Facebook link
- Supports customer name, business name, and combined name formats
- Uses React Query for caching (10 min stale time, 30 min cache)
- Provides `lookupFacebookLink()` and `hasFacebookLink()` functions

### 2. Tickbox API Endpoint

**File**: `/src/app/api/invoices/[id]/tickbox/route.ts`

- `PUT /api/invoices/:id/tickbox` - Updates invoice tickbox status
- Validates boolean input
- Returns 404 if invoice not found
- Proper error handling and logging

### 3. Customer Name Click Handler

**Function**: `handleCustomerNameClick(invoice)`

**Actions performed**:

1. Looks up customer's Facebook Messenger link
2. Validates invoice settings are loaded
3. Calculates final weight from actual weight
4. Finds matching Shopee checkout link based on final weight
5. Generates personalized message using template:
   - Replaces `{GREETING}` with time-based greeting
   - Replaces `{DRIVE_FILES}` with customer's invoice link
   - Replaces `{SHOPEE_LINK}` with weight-based checkout link
   - Replaces `{PAYMENT_CHANNELS_URL}` with payment channels
6. Copies message to clipboard using navigator.clipboard API
7. Opens Facebook Messenger in new window
8. Updates tickbox to true in database
9. Updates UI optimistically

**Validations**:

- Checks if customer has Facebook link (shows yellow notification if missing)
- Checks if invoice settings are loaded (shows yellow notification if loading)
- Handles clipboard copy failures gracefully

### 4. UI Changes

#### Customer Name Cell

- **Before**: Plain text, not clickable
- **After**:
  - Clickable anchor link (blue) if customer has Facebook link
  - Plain text if no Facebook link available
  - Tooltip: "Click to copy message and open Facebook Messenger"
  - Cursor changes to pointer on hover

#### Checkbox Cell

- **Before**: Only updated UI state (not persisted)
- **After**:
  - Optimistic UI update (instant feedback)
  - Persists to database via API call
  - Reverts on failure
  - Async onChange handler

## Generated Message Example

```text
Good Day

Your order has been packed and ready for dispatch!
Please complete this transaction within 3 days.

View invoice:
https://drive.google.com/file/d/abc123/view?usp=drivesdk

Payment Channels:
drive.google.com/drive/folders/1PsgfqahjqjSlts3NZnhQ8XQKxDJKohqF

Shopee checkout link:
https://shopee.ph/product/123456789/987654321

FOR SHOPEE CHECKOUTS:
1. Deduct ₱50.00 from your amount due
2. Change the courier to J&T

We look forward to completing your order!

Czarlie & Ron
```

**Time-based greetings**:

- 4:00 AM - 7:59 AM: "Good Morning"
- 8:00 AM - 4:59 PM: "Good Day"
- 5:00 PM - 5:59 PM: "Good Afternoon"
- 6:00 PM - 3:59 AM: "Good Evening"

## Technical Implementation

### Dependencies Added

- `useInvoiceCustomerLookup` hook for customer data
- `useQuery` for fetching invoice settings
- `generateInvoiceMessage` utility for message templating
- `calculateFinalWeight` for weight calculations
- `findCheckoutLinkByWeight` for matching Shopee links

### State Management

- Customer data cached via React Query (10 min stale, 30 min cache)
- Invoice settings cached via React Query (10 min stale)
- Optimistic UI updates for checkbox changes
- Automatic revert on API failures

### Error Handling

- Facebook link not found → Yellow notification
- Settings not loaded → Yellow notification
- Clipboard copy failure → Red notification, stops execution
- API tickbox update failure → Red notification, reverts UI

### Database Schema

**Existing `invoices` table** already has:

- `tickbox` field (Boolean, default false)
- `driveFiles` field (String, stores Google Drive links)
- `customerName` field (String, used for lookup)

**Existing `customers` table** has:

- `facebook` field (String, stores Facebook Messenger chat ID/link)
- `customerName` and `businessName` fields

## User Experience Flow

### Scenario 1: Successful Message Send

1. User clicks on "Karen King Balana"
2. ✅ Notification: "Message Copied! Invoice message copied to clipboard. Opening Facebook Messenger..."
3. ✅ Facebook Messenger opens in new tab with Karen's chat
4. ✅ Checkbox automatically ticks
5. ✅ User pastes message (Ctrl+V) into Messenger and sends

### Scenario 2: No Facebook Link

1. User clicks on customer without Facebook link
2. ⚠️ Notification: "No Facebook Link - No Facebook Messenger link found for [Customer Name]"
3. Name remains as plain text (not clickable)

### Scenario 3: Manual Checkbox Toggle

1. User manually checks/unchecks checkbox
2. ✅ UI updates instantly (optimistic)
3. ✅ API call persists to database
4. ✅ If API fails → UI reverts + error notification

## Files Created

1. `/src/modules/clothing/operations/checkout-links/hooks/useInvoiceCustomerLookup.ts` - Customer lookup hook (126 lines)
2. `/src/app/api/invoices/[id]/tickbox/route.ts` - Tickbox API endpoint (58 lines)

## Files Modified

1. `/src/modules/clothing/operations/checkout-links/components/CheckoutLinksComponent.tsx`:
   - Added imports for hooks and utilities
   - Added `useInvoiceCustomerLookup()` hook
   - Added `useQuery` for invoice settings
   - Added `updateInvoiceTickbox()` helper function
   - Added `handleCustomerNameClick()` handler
   - Updated customer name cell to be clickable anchor
   - Updated checkbox to persist changes to database

## Testing Checklist

- [ ] Click customer name with Facebook link → message copied, Messenger opens, checkbox ticked
- [ ] Click customer name without Facebook link → yellow notification shown
- [ ] Verify message contains correct greeting based on time
- [ ] Verify message contains correct drive files link
- [ ] Verify message contains correct Shopee checkout link based on weight
- [ ] Verify message contains correct payment channels URL
- [ ] Manually check checkbox → persisted to database
- [ ] Manually uncheck checkbox → persisted to database
- [ ] Refresh page → checkbox state persists
- [ ] Test with different customers (various name formats)
- [ ] Test clipboard copy functionality
- [ ] Test Facebook Messenger window opening

## Benefits

1. **Efficiency**: One click vs. multiple manual steps (copy, open, tick)
2. **Accuracy**: No copy/paste errors, consistent message format
3. **Tracking**: Automatic tickbox tracking of sent messages
4. **Professional**: Time-based greetings, personalized data
5. **Persistence**: Tickbox state saved to database, survives page refreshes
6. **User-friendly**: Clear notifications, intuitive UI, visual feedback

## Integration Points

- Uses existing `customers` table Facebook field
- Uses existing `invoices` table tickbox and driveFiles fields
- Uses invoice settings template from Settings page
- Uses final weight calculator and checkout link matcher utilities
- Uses message generator with placeholder replacement
- Integrates with Google Drive invoice links
- Integrates with Shopee checkout links

## Future Enhancements (Optional)

1. Add message preview on hover over customer name
2. Add "Resend" button to regenerate and copy message again
3. Add bulk message copy for multiple customers
4. Add message history/log (track when messages were sent)
5. Add custom message templates per customer
6. Add WhatsApp support (in addition to Facebook Messenger)
7. Add message delivery confirmation tracking
