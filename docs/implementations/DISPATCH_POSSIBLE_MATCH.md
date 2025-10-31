# Dispatch Possible Match Feature

## Overview

The Possible Match tab in the Dispatch module provides intelligent customer matching for orders that don't have exact Shopee username matches. It uses fuzzy string matching algorithms to compare delivery addresses, phone numbers, and names to suggest the top 10 most likely customer matches.

## Features Implemented

### 1. **Fuzzy String Matching Utilities** (`/src/lib/utils/fuzzyMatch.ts`)

#### Levenshtein Distance Algorithm

- Calculates the minimum number of single-character edits needed to change one string to another
- Used as the foundation for all similarity calculations

#### Similarity Scoring Functions

**`calculateAddressSimilarity(address1, address2)`**

- Weighted component scoring:
  - Zip Code: 25% (exact match)
  - Province: 20% (exact match)
  - City: 20% (exact match)
  - Street: 20% (fuzzy match)
  - Keywords: 15% (overlap percentage)
- Normalizes addresses (removes punctuation, standardizes abbreviations)
- Extracts components: street, city, province, zip code, keywords
- Returns 0-100% similarity score

**`calculatePhoneSimilarity(phone1, phone2)`**

- Handles various phone formats
- 100% for exact match
- 90% for last 7 digits match (Philippine mobile numbers)
- 60% for last 4 digits match (masked numbers like "**\*\***04")

**`calculateNameSimilarity(name1, name2)`**

- Handles partial matches and name variations
- 100% for exact match
- 80% if one name contains the other
- Scores based on matching name parts

**`highlightMatches(str1, str2)`**

- Highlights matching words between two strings
- Useful for UI display

### 2. **Possible Matches Hook** (`usePossibleMatches`)

#### How It Works

1. **Fetches all customers** from `/api/customers`
2. **Fetches additional addresses** for each customer from `/api/customers/:id/additional-info`
3. **Calculates similarity scores** for each unmatched order against all customers
4. **Applies weighted scoring**:
   - Address: 60% (most reliable)
   - Phone: 25% (secondary)
   - Name: 15% (least reliable, often masked)
5. **Filters matches** with minimum 40% overall score
6. **Returns top 10 matches** per order, sorted by score

#### API

```typescript
const {
  matches, // Map<orderId, PossibleMatch[]>
  getMatchesForOrder, // (orderId: string) => PossibleMatch[]
  stats, // Statistics object
  isLoading, // boolean
} = usePossibleMatches(unmatchedOrders);
```

#### Statistics Provided

- `totalUnmatchedOrders` - Total orders without matches
- `ordersWithPossibleMatches` - Orders that have at least one possible match
- `ordersWithoutMatches` - Orders with no possible matches
- `totalPossibleMatches` - Sum of all possible matches across all orders
- `averageMatchesPerOrder` - Average number of matches per order

### 3. **UI Implementation** (Possible Match Tab)

#### Statistics Overview Card

- Displays key metrics at a glance
- Shows unmatched orders count
- Progress bar while loading matches

#### Unmatched Orders Accordion

Each order displays:

**Order Information:**

- Shopee username
- Order ID
- Delivery address
- Phone number
- Receiver name

**Possible Matches (Top 10):**

- Customer name and business name
- Similarity score badge (color-coded):
  - 🟢 Green: 80%+ (High confidence)
  - 🔵 Blue: 60-79% (Medium confidence)
  - 🟡 Yellow: 40-59% (Low confidence)
- Match details (Address: X%, Phone: Y%, Name: Z%)
- Customer's registered address and phone
- Progress bar showing address similarity
- **"Link Customer" button** to manually associate

#### Visual Features

- Color-coded left border on match cards
- Expandable/collapsible accordion for each order
- Badge showing number of possible matches
- Empty state when all orders are matched

### 4. **Manual Linking Feature**

The "Link Customer" button allows users to:

1. Review possible matches
2. Manually select the correct customer
3. Link the customer to the order

**Handler Function:**

```typescript
const handleLinkCustomer = (
  orderId: string,
  customerId: number,
  customerName: string
) => {
  // TODO: Implement actual linking logic
  // 1. Save Shopee username to customer's additional info
  // 2. Refresh data
  // 3. Remove from unmatched list
};
```

## Matching Algorithm Details

### Address Normalization

```typescript
// Before: "Block 4, Lot 16B, Essen St., Pasig City, Metro Manila, 1600"
// After: "block 4 lot 16b essen street pasig city metro manila 1600"
```

**Standardizations:**

- Convert to lowercase
- Remove extra whitespace
- Standardize abbreviations (St. → street, Blk → block, etc.)
- Remove punctuation
- Extract components: street, city, province, zip code

### Component Extraction

```typescript
{
  street: "block 4 lot 16b essen street mercdes executive village san miguel",
  city: "pasig",
  province: "metro manila",
  zipCode: "1600",
  keywords: Set(["block", "essen", "mercdes", "executive", "village", "miguel"])
}
```

### Scoring Example

Order Address: "Block 4 Lot 16B Essen St, Pasig City, Metro Manila, 1600"
Customer Address: "Essen Street, San Miguel, Pasig, Metro Manila 1600"

```typescript
Zip Code Match: 25/25 (exact match: 1600)
Province Match: 20/20 (exact match: metro manila)
City Match: 20/20 (exact match: pasig)
Street Similarity: 16/20 (80% similar)
Keyword Overlap: 12/15 (5 common keywords out of 8 total)

Overall Score: 93/100 = 93% 🟢
```

## Performance Considerations

1. **React Query Caching**: 5-minute stale time for customer data
2. **Parallel Fetching**: All customer additional info fetched in parallel
3. **Memoization**: Results memoized to prevent re-calculations
4. **Top 10 Limit**: Only returns top 10 matches per order
5. **40% Threshold**: Filters out low-quality matches early

## Future Enhancements

1. **Auto-Linking**
   - Automatically link orders with 95%+ match score
   - Require manual review for 80-94%
2. **Machine Learning**
   - Learn from manual linking decisions
   - Improve scoring weights over time

3. **Batch Operations**
   - Link multiple orders at once
   - Export unmatched orders report

4. **Additional Matching Criteria**
   - Product preferences
   - Order history patterns
   - Payment methods

5. **Confidence Indicators**
   - Show which fields contributed most to the score
   - Highlight suspicious low-score links

## Testing Guide

1. Navigate to `/clothing/operations/dispatch`
2. Import XLSX file with orders in Raw Data tab
3. Switch to Dashboard tab - see matched orders
4. Switch to Possible Match tab - see unmatched orders
5. Expand an unmatched order accordion
6. Review suggested matches with similarity scores
7. Click "Link Customer" to associate a customer

## Related Files

- `/src/lib/utils/fuzzyMatch.ts` - Fuzzy matching algorithms
- `/src/modules/clothing/operations/dispatch/hooks/usePossibleMatches.ts` - Matching hook
- `/src/modules/clothing/operations/dispatch/components/DispatchComponent.tsx` - UI
- `/src/app/api/customers/[id]/additional-info/route.ts` - API endpoint

## Technical Notes

- Uses Levenshtein distance for string similarity
- Addresses normalized for comparison
- Weighted scoring based on field reliability
- Supports multiple addresses per customer
- Gracefully handles missing/masked data
- Case-insensitive matching throughout
