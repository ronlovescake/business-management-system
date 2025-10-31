# Dispatch Customer Lookup Implementation

## Overview

This document describes the implementation of customer name lookup functionality in the Dispatch module. The system automatically matches Shopee usernames from dispatch orders to customer records and displays the customer's full name and business name.

## Problem Statement

The dispatch component imports order data from XLSX files containing a "Username (Buyer)" field (e.g., "sierraandbenny"). We needed to:

1. Match this Shopee username to customers in our database
2. Display the customer's real name and business name (e.g., "Lyn Domingo | SIERRAS THRIFTEES")
3. Show a visual indicator for matched vs unmatched customers

## Solution Architecture

### 1. Database Structure

We utilize the existing `AdditionalCustomerInfo` table in Prisma:

```prisma
model AdditionalCustomerInfo {
  id         Int       @id @default(autoincrement())
  customerId Int
  type       String    @db.VarChar(50) // 'address', 'phone', 'shopee_username'
  value      String    @db.VarChar(500)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  deletedAt  DateTime?
  customer   Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
}
```

This table stores Shopee usernames with `type = 'shopee_username'`.

### 2. Custom Hook: `useDispatchCustomerLookup`

**Location:** `src/modules/clothing/operations/dispatch/hooks/useDispatchCustomerLookup.ts`

This hook provides the core functionality:

#### Features:

- Fetches all customers from `/api/customers`
- Fetches additional info (including Shopee usernames) for each customer
- Creates an optimized lookup map: `shopeeUsername -> customerDisplayName`
- Provides a `lookupCustomerName(username)` function for instant lookups

#### Performance Optimizations:

- Uses React Query for caching (5-minute stale time)
- Parallel fetching of customer additional info
- Memoized lookup map for O(1) lookups
- Case-insensitive matching (usernames normalized to lowercase)

#### API:

```typescript
const {
  customersWithShopee, // Array of customers with shopee usernames
  shopeeUsernameMap, // Map<string, string> for lookups
  lookupCustomerName, // (username: string) => string
  isLoading, // boolean
} = useDispatchCustomerLookup();
```

### 3. Component Integration: `DispatchComponent`

**Location:** `src/modules/clothing/operations/dispatch/components/DispatchComponent.tsx`

#### Changes Made:

1. **Import the hook:**

   ```typescript
   import { useDispatchCustomerLookup } from '../hooks';
   ```

2. **Use the hook:**

   ```typescript
   const { lookupCustomerName, isLoading: loadingCustomers } =
     useDispatchCustomerLookup();
   ```

3. **Transform data with lookup:**

   ```typescript
   const dataSource: DispatchItem[] =
     rawData.length > 0
       ? rawData.map((row, index) => {
           const username = row['Username (Buyer)'] || '';
           const matchedCustomer = lookupCustomerName(username);

           return {
             id: row['Order ID'] || `imported-${index}`,
             orderStatus: row['Order Status'] || '',
             shippingOptions: row['Shipping Option'] || '',
             username,
             customerNames: matchedCustomer || row['Receiver Name'] || '',
             messageCustomer: row['Remark from buyer'] || '',
           };
         })
       : mockData;
   ```

4. **Visual Indicators:**
   - Green "Matched" badge when customer is found
   - Yellow "No Match" badge when customer is not found
   - Display format: "Customer Name | BUSINESS NAME" (if business name exists)

## User Experience

### When an XLSX file is imported:

1. System automatically looks up each Shopee username
2. If match found:
   - Displays: `Customer Name | Business Name`
   - Shows green "Matched" badge
3. If no match found:
   - Falls back to "Receiver Name" from XLSX
   - Shows yellow "No Match" badge
   - Displays "No customer found" in italics

### Example:

| Username (Buyer) | Customer Names                   | Status      |
| ---------------- | -------------------------------- | ----------- |
| sierraandbenny   | Lyn Domingo \| SIERRAS THRIFTEES | 🟢 Matched  |
| unknown_user     | John Doe                         | 🟡 No Match |

## API Endpoints Used

1. **GET `/api/customers`**
   - Fetches all customers
   - Returns: `{ id, customerName, businessName, ... }`

2. **GET `/api/customers/:id/additional-info`**
   - Fetches additional customer info
   - Returns:
     ```json
     {
       "addresses": [...],
       "phones": [...],
       "shopeeUsernames": [
         { "id": "123", "value": "sierraandbenny" }
       ]
     }
     ```

## Future Enhancements

1. **Batch Operations**
   - Add "Auto-match all" button to trigger bulk lookups
   - Export matched vs unmatched customers

2. **Possible Match Tab**
   - Implement fuzzy matching for similar usernames
   - Show suggestions when exact match not found

3. **Cache Management**
   - Add manual refresh button for customer data
   - Show last updated timestamp

4. **Performance**
   - Consider server-side lookup for very large datasets
   - Implement virtual scrolling for thousands of orders

## Testing

To test the functionality:

1. Navigate to `/clothing/operations/dispatch`
2. Go to "Raw Data" tab
3. Import an XLSX file with "Username (Buyer)" column
4. Switch to "Dashboard" tab
5. Verify:
   - Matched usernames show customer name with green badge
   - Unmatched usernames show receiver name with yellow badge
   - Search works across all fields including customer names

## Related Files

- `/src/modules/clothing/operations/dispatch/hooks/useDispatchCustomerLookup.ts` - Main hook
- `/src/modules/clothing/operations/dispatch/hooks/index.ts` - Barrel export
- `/src/modules/clothing/operations/dispatch/components/DispatchComponent.tsx` - UI component
- `/src/app/api/customers/[id]/additional-info/route.ts` - API endpoint
- `/prisma/schema.prisma` - Database schema

## Notes

- Usernames are case-insensitive (normalized to lowercase)
- Customer data is cached for 5 minutes
- Lookup is O(1) time complexity using Map
- System gracefully handles missing or malformed data
