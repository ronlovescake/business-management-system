# Customer Duplicate Check - Quick Reference

## 🎯 What Was Added

A **sophisticated duplicate detection system** for the Add New Customer modal that uses the same advanced fuzzy matching algorithms as the dispatch module.

## 📍 Location

- **Module**: `/clothing/operations/customers`
- **Trigger**: When clicking "Add Customer" button in the modal
- **Files Modified**: 2 files + 1 new hook + 1 documentation

## ✨ Key Features

### 1. Three-Stage User Experience

```
Click "Add Customer"
       ↓
[Loading Popup] "Checking for Duplicates..."
       ↓
   ┌───────┴───────┐
   ↓               ↓
No Duplicates   Duplicates Found
   ↓               ↓
Success Popup   Warning Dialog
(1.5s)          with Options
   ↓               ↓
Save Customer   Cancel or Proceed
```

### 2. Sophisticated Matching

- **60%** Address (landmarks, street markers, location)
- **25%** Phone Number (exact, last 7, last 4)
- **15%** Name (full, partial, token-based)

### 3. Risk Levels

- **🔴 80%+ match** = High Risk (likely duplicate)
- **🟡 60-79% match** = Medium Risk (possible duplicate)
- **🟢 50-59% match** = Low Risk (maybe duplicate)

## 🎨 Visual Examples

### Example 1: High Risk Duplicate (95%)

```
⚠️ Possible Duplicate Customer Detected

┌─────────────────────────────────────────┐
│ John Doe | ABC Company          [95%]   │ 🔴 High Risk
│ 📞 09171234567                           │
│ 📍 Block 4 Lot 16B Essen St, Pasig 1600 │
│ Address: 95% • Phone: 100% • Name: 85%   │
└─────────────────────────────────────────┘

[ Cancel ]  [ Proceed Anyway ]
```

### Example 2: Medium Risk (65%)

```
┌─────────────────────────────────────────┐
│ Jane Smith                       [65%]  │ 🟡 Medium Risk
│ 📞 09187654321                           │
│ 📍 Oak Avenue, Makati City               │
│ Address: 65% • Phone: 60%                │
└─────────────────────────────────────────┘
```

## 🚀 How It Works

### Step 1: User Fills Form

```typescript
Customer Name: "John Doe"
Phone: "09171234567"
Address: "Block 4 Lot 16B, Essen St, Pasig, 1600"
```

### Step 2: System Checks

1. Fetches all existing customers (cached 2 min)
2. Compares new customer against ALL existing
3. Uses fuzzy matching for:
   - Address normalization
   - Landmark detection
   - Phone similarity
   - Name variations

### Step 3: Results

- **0 matches** → Save immediately (with success popup)
- **1-5 matches** → Show warning dialog with options
- **User decides** → Cancel or Proceed Anyway

## 📦 Files Created

```
src/modules/clothing/operations/customers/
├── hooks/
│   └── useCustomerDuplicateCheck.ts  ← NEW! (Core logic)
└── components/
    └── CustomersPage.tsx              ← MODIFIED (Integration)

docs/implementations/
└── CUSTOMER_DUPLICATE_CHECK.md        ← NEW! (Full docs)
```

## 🔧 Configuration

### Change Minimum Threshold

```typescript
// In useCustomerDuplicateCheck.ts, line 108
if (overallScore >= 50) {  // Change to 40, 60, 70, etc.
```

### Change Field Weights

```typescript
// In useCustomerDuplicateCheck.ts, line 102-104
const overallScore = Math.round(
  maxAddressScore * 0.6 + // Address: 60%
    phoneScore * 0.25 + // Phone: 25%
    nameScore * 0.15 // Name: 15%
);
```

### Change Number of Matches Shown

```typescript
// In useCustomerDuplicateCheck.ts, line 153
.slice(0, 5);  // Top 5 matches (change to 3, 10, etc.)
```

## 🧪 Test Cases

### Test 1: Exact Duplicate

```
Add: "John Doe, 09171234567, 123 Main St"
Try: "John Doe, 09171234567, 123 Main St"
Result: 95%+ match, RED warning
```

### Test 2: Similar (Typo)

```
Add: "John Doe, 09171234567, Essen Street"
Try: "Jon Doe, 09171234567, Esson Street"
Result: 80%+ match, RED warning
```

### Test 3: Different Address

```
Add: "John Doe, 09171234567, Manila"
Try: "John Doe, 09171234567, Cebu"
Result: 60-70% match, YELLOW warning
```

### Test 4: Completely Different

```
Add: "Alice Smith, 09171111111, Quezon City"
Try: "Bob Jones, 09172222222, Makati"
Result: No duplicates found, proceed
```

## 💡 Pro Tips

1. **Cancel = Safe** - If unsure, click Cancel and search for existing customer
2. **High Score = Likely Duplicate** - 80%+ usually means it's the same customer
3. **Check Details** - Look at which fields matched (Address, Phone, Name)
4. **Proceed if New** - If you're sure it's a different customer, proceed anyway

## 🎯 Benefits

✅ **Prevents duplicate customers** in database
✅ **Maintains data quality** with smart detection
✅ **Saves time** by catching duplicates early
✅ **User-friendly** with clear warnings and options
✅ **Performant** with caching and optimization
✅ **Flexible** - user can override if needed

## 🔗 Related Features

- **Dispatch Matching**: Same algorithm used for order-customer matching
- **Fuzzy Match Library**: `/src/lib/utils/fuzzyMatch.ts`
- **Customer Search**: Uses same customer data source

---

**Ready to use!** Next time you add a customer, the system will automatically check for duplicates and alert you if any are found. 🎉
