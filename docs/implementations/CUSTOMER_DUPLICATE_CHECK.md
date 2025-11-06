# Customer Duplicate Check Implementation

## 📋 Overview

Added sophisticated duplicate detection to the **Add New Customer** modal in `/clothing/operations/customers`. Before saving a new customer, the system performs an intelligent fuzzy matching analysis to detect potential duplicates and alerts the user with a beautiful SweetAlert2 popup.

## ✨ Features Implemented

### 1. **Sophisticated Fuzzy Matching**

Uses the same advanced algorithms as the dispatch module:

- **Address matching** (60% weight) - Most reliable indicator
  - Landmarks detection (gas stations, buildings, brands)
  - Street markers (KM, Block, Lot numbers)
  - Geographic components (zip, city, province)
- **Phone matching** (25% weight) - Secondary indicator
- **Name matching** (15% weight) - Least reliable (can vary)

### 2. **Three-Stage User Experience**

#### Stage 1: Checking Dialog

When user clicks "Add Customer", a loading popup appears:

```
┌─────────────────────────────────┐
│  Checking for Duplicates        │
│                                 │
│         [Spinner Animation]     │
│                                 │
│  Analyzing customer data for    │
│  possible matches...            │
│  This uses sophisticated fuzzy  │
│  matching algorithms            │
└─────────────────────────────────┘
```

#### Stage 2: No Duplicates Found (Quick Success)

If no duplicates detected:

```
┌─────────────────────────────────┐
│  ✓ No Duplicates Found          │
│                                 │
│  This appears to be a new       │
│  customer. Proceeding with      │
│  save...                        │
│                                 │
│  (Auto-closes in 1.5 seconds)   │
└─────────────────────────────────┘
```

#### Stage 3: Duplicates Found (Warning with Options)

If potential duplicates detected:

```
┌─────────────────────────────────────────────────────────┐
│  ⚠️ Possible Duplicate Customer Detected                │
│                                                         │
│  We found 2 existing customers that might be            │
│  similar to the one you're adding. Please review:       │
│                                                         │
│  ┌─────────────────────────────────────────┐          │
│  │ John Doe | ABC Company           [95%]  │ 🔴 High │
│  │ 📞 09171234567                           │         │
│  │ 📍 123 Main St, Makati, Metro Manila     │         │
│  │ Address: 95% • Phone: 90% • Name: 85%    │         │
│  └─────────────────────────────────────────┘          │
│                                                         │
│  ┌─────────────────────────────────────────┐          │
│  │ Jane Doe                          [65%]  │ 🟡 Med  │
│  │ 📞 09187654321                           │         │
│  │ 📍 456 Oak Ave, Pasig, Metro Manila      │         │
│  │ Address: 65% • Phone: 60%                │         │
│  └─────────────────────────────────────────┘          │
│                                                         │
│  💡 If this is indeed a duplicate, click "Cancel"      │
│      and use the existing customer instead.            │
│                                                         │
│  [ Cancel ]  [ Proceed Anyway ]                        │
└─────────────────────────────────────────────────────────┘
```

### 3. **Color-Coded Risk Levels**

- **🔴 High Risk** (80%+ match) - Green border
- **🟡 Medium Risk** (60-79% match) - Blue border
- **🟢 Low Risk** (50-59% match) - Yellow border

### 4. **Smart Thresholds**

- **Minimum threshold: 50%** (higher than dispatch's 40%)
- Shows **top 5 matches** only (prevents overwhelming the user)
- **Multiple field matching** highlighted in details

## 📁 Files Created/Modified

### New Files

1. **`/src/modules/clothing/operations/customers/hooks/useCustomerDuplicateCheck.ts`**
   - Custom React hook for duplicate checking
   - Fetches all customers with addresses
   - Performs fuzzy matching analysis
   - Manages SweetAlert2 dialogs

### Modified Files

1. **`/src/modules/clothing/operations/customers/components/CustomersPage.tsx`**
   - Integrated `useCustomerDuplicateCheck` hook
   - Updated `handleAddCustomer` to check for duplicates before saving
   - User can proceed or cancel after seeing duplicate warnings

## 🔄 User Flow

```
User clicks "Add Customer"
         ↓
[Form Validation]
         ↓
Show "Checking for Duplicates" loading popup
         ↓
Fetch all customers with addresses (cached 2 min)
         ↓
Run fuzzy matching algorithm
         ↓
┌──────────────┴──────────────┐
│                              │
No duplicates found        Duplicates found (≥50% match)
│                              │
Show success message       Show warning dialog with:
(1.5s auto-close)          - List of potential duplicates
│                          - Similarity scores
Proceed to save            - Risk levels
                           - Match details
                                 │
                   ┌─────────────┴─────────────┐
                   │                           │
              User clicks              User clicks
              "Cancel"                 "Proceed Anyway"
                   │                           │
              Return to form              Save customer
              (modal stays open)          Close modal
                                         Show success
```

## 🎯 Matching Algorithm Details

### Address Scoring (60% weight)

1. **Landmarks** (30%) - Brands, buildings
   - "Petron Gas Station" → Highly specific
   - "Mercedes Village" → Highly specific
2. **Street Markers** (25%) - KM, Block, Lot
   - "KM 42" → Very precise
   - "Block 4 Lot 16B" → Very precise
3. **Geographic** (26%)
   - Zip code (10%)
   - Province (8%)
   - City (8%)
4. **Street Similarity** (12%) - Token/Levenshtein
5. **Keywords** (7%) - Significant words

### Phone Scoring (25% weight)

- Exact match: 100%
- Last 7 digits: 90%
- Last 4 digits: 60%
- Levenshtein distance for others

### Name Scoring (15% weight)

- Exact match: 100%
- Contains match: 80%
- Token-based partial matching

### Example Calculation

```typescript
New Customer:
- Name: "John Doe"
- Phone: "09171234567"
- Address: "Block 4 Lot 16B, Essen St, Pasig City, 1600"

Existing Customer:
- Name: "John D."
- Phone: "09171234567"
- Address: "Essen Street, San Miguel, Pasig, 1600"

Scores:
- Address: 90% (street markers + city + zip match)
- Phone: 100% (exact match)
- Name: 85% (partial match)

Overall: (90 × 0.6) + (100 × 0.25) + (85 × 0.15) = 91.75% 🔴 High Risk
```

## ⚡ Performance Optimizations

1. **React Query Caching**
   - Customers data cached for 2 minutes
   - Prevents repeated API calls
   - Stale time configurable

2. **Single API Call**
   - Fetches all customers WITH addresses in one query
   - Uses `/api/customers/with-all-addresses` endpoint
   - No N+1 query problem

3. **Top 5 Limit**
   - Only shows top 5 most similar matches
   - Prevents information overload
   - Sorted by similarity score

4. **Smart Threshold**
   - 50% minimum (vs dispatch's 40%)
   - Higher threshold for new customer detection
   - Reduces false positives

## 🎨 UI/UX Features

### SweetAlert2 Styling

- **Modern design** with rounded corners
- **Scrollable list** for multiple matches (max-height: 400px)
- **Color-coded borders** for quick risk assessment
- **Detailed match information** with icons
- **Responsive layout** (700px width)
- **Reversed buttons** (Cancel is primary action)

### User-Friendly Messages

- Clear explanations of what's happening
- Helpful tips ("If this is a duplicate...")
- Non-technical language
- Visual indicators (emojis, colors)

## 🧪 Testing Guide

### Test Case 1: No Duplicates

1. Open `/clothing/operations/customers`
2. Click "Add New Customer"
3. Fill in unique customer data
4. Click "Add Customer"
5. **Expected**: Loading popup → Success popup (1.5s) → Customer saved

### Test Case 2: Exact Duplicate

1. Add a customer with:
   - Name: "Test Customer"
   - Phone: "09171234567"
   - Address: "123 Test St, Manila"
2. Try adding again with same data
3. **Expected**: Loading popup → Warning with 95%+ match → User can cancel or proceed

### Test Case 3: Similar Customer (Different spelling)

1. Add customer: "John Doe, 09171234567, Essen St Pasig"
2. Try adding: "Jon Doe, 09171234567, Esson Street Pasig"
3. **Expected**: Loading popup → Warning with 80%+ match

### Test Case 4: Different Customer (Low match)

1. Add customer: "Alice Smith, 09171111111, Quezon City"
2. Try adding: "Bob Jones, 09172222222, Makati City"
3. **Expected**: Loading popup → Success (no duplicates)

### Test Case 5: Multiple Potential Duplicates

1. Add 5 customers with similar addresses
2. Try adding another with similar address
3. **Expected**: Warning showing top 5 matches, sorted by score

## 🔧 Configuration

### Adjusting Thresholds

In `useCustomerDuplicateCheck.ts`:

```typescript
// Line 108: Overall threshold
if (overallScore >= 50) {  // Change 50 to desired threshold
```

### Adjusting Weights

```typescript
// Line 102-104: Weighted scoring
const overallScore = Math.round(
  maxAddressScore * 0.6 + // Address weight (60%)
    phoneScore * 0.25 + // Phone weight (25%)
    nameScore * 0.15 // Name weight (15%)
);
```

### Adjusting Number of Matches Shown

```typescript
// Line 153: Top N matches
.slice(0, 5);  // Change 5 to desired number
```

## 📊 Statistics & Monitoring

The duplicate check can be monitored through:

- Browser console logs (via `logger`)
- React Query DevTools (cache status)
- SweetAlert2 popups (user interactions)

## 🚀 Future Enhancements

1. **Learn from User Decisions**
   - Track when users proceed despite warnings
   - Improve algorithm weights over time

2. **Merge Customer Feature**
   - Add "Merge with Existing" button in duplicate dialog
   - Automatically merge data from both records

3. **Whitelist Feature**
   - Allow marking certain matches as "not duplicates"
   - Skip showing these in future checks

4. **Batch Duplicate Detection**
   - Check entire customer database for duplicates
   - Show report of potential merge candidates

5. **Custom Matching Rules**
   - Allow admin to configure weights
   - Add custom matching fields
   - Business-specific rules

## 🔗 Related Files

- **Fuzzy Matching Library**: `/src/lib/utils/fuzzyMatch.ts`
- **Dispatch Matching**: `/src/modules/clothing/operations/dispatch/hooks/usePossibleMatches.ts`
- **Customers API**: `/src/app/api/customers/with-all-addresses/route.ts`
- **Customer Types**: `/src/modules/clothing/operations/customers/types/customer.types.ts`

## ✅ Completion Checklist

- [x] Created `useCustomerDuplicateCheck.ts` hook
- [x] Integrated with `CustomersPage.tsx`
- [x] Added SweetAlert2 loading dialog
- [x] Added SweetAlert2 results dialog
- [x] Implemented fuzzy matching algorithm
- [x] Added risk level indicators
- [x] Added color-coded UI
- [x] Optimized performance with caching
- [x] Created documentation

## 🎉 Result

The customer module now has **intelligent duplicate detection** that:

- ✅ Prevents accidental duplicate customer creation
- ✅ Provides clear visual feedback to users
- ✅ Uses sophisticated matching algorithms
- ✅ Maintains excellent performance
- ✅ Offers flexible user control (proceed vs cancel)

This brings the same level of sophistication from the dispatch module to customer management, ensuring data quality and preventing duplicate records!
