# Customer Data Merge Guide

## Summary

Successfully merged two CSV files to create a comprehensive customer database with Shopee usernames ready for import!

## Files Processed

1. **Source 1:** `Czarlie & Ron Customer Database - customers-export-2025-10-24.csv`
   - 1,109 existing customers
   - Full customer information (phone, email, business details)

2. **Source 2:** `2025 CHECKOUT DASHBOARD - Copy of Usernames.csv`
   - 835 Shopee delivery records
   - 697 unique customers
   - Current delivery addresses

3. **Output:** `customers-merged-2025-11-03.csv`
   - 1,117 total customers
   - Ready for "Detailed (Numbered Columns)" import

## Merge Results

### Statistics

```
Total customers: 1,117
├─ Matched with Shopee: 701 customers
│  └─ All addresses updated to Shopee delivery addresses ✓
├─ Pickup only (no Shopee): 408 customers
│  └─ Kept original addresses
└─ New from Shopee: 8 customers
   └─ Added as new customers with current date
```

### Key Features

✅ **Address Priority:** Shopee delivery addresses used as primary (more current/accurate)
✅ **Multiple Usernames:** Up to 5 usernames per customer in numbered columns
✅ **Name Matching:** Smart matching handles variations:

- "John Doe | Jane Doe" ↔ "John Doe"
- "Mary-Ann Smith" ↔ "Mary Ann Smith"
- Partial name matches for compound names

✅ **Pickup Customers:** 408 customers without Shopee accounts preserved
✅ **No Data Loss:** All customers and usernames retained

## Customers with Most Usernames

Top customers with multiple Shopee accounts:

1. **Elora Elle Sagum** - 4 usernames
   - ohmylullabuy, ohmyramram, romelmendoza846, ly_babyclothes

2. **Jeh Aguisanda** - 4 usernames
   - jelliphant, jhaelledelacruz, reejehjewelry, mygoodluckshop

3. **Anne Tionson | Enna Yrrehc** - 4 usernames
   - g869aypt2r, sg5yu4xfcd, delaraonlineshop, delaraonlineshop2

4. **Jai Bulayungan | CJ Bulayungan** - 4 usernames
   - jaibulayungan, micahsclothings, jaiceedee, lianylukeandlorenzo

_(Plus 6 more customers with 3 usernames each)_

## CSV Format

The merged CSV uses the **Numbered Columns** format:

```csv
Date,Customer Name,Phone Number,Address,Facebook,Email Address,
Business Name,Tax Number,Business Address,Business Contact Number,
Customer Status,
Shopee Username 1,Shopee Username 2,Shopee Username 3,Shopee Username 4,Shopee Username 5
```

### Example Row

```csv
2023-04-28,Jewel Jamora,9182123110,"Pk Kaugnayan, Brgy GPS...",
https://www.facebook.com/...,jj965023@gmail.com,,,,,Active,
lewej_965023,kreshna08,,,
```

## How to Import

### Step 1: Review the Merged File

**Location:** `/csv/for update/customers-merged-2025-11-03.csv`

**Check for:**

- Customers with updated addresses (701 customers)
- Pickup-only customers retained (408 customers)
- New customers from Shopee (8 customers)

### Step 2: Backup Current Database

```bash
# Export current customers before import
# Navigate to Clothing → Operations → Customers
# Click "Export CSV" → "Standard CSV"
```

### Step 3: Import Merged Data

**⚠️ IMPORTANT:** You'll need to implement import functionality first!

The current system only has **export** implemented. You need to add:

1. **Import parser** that reads numbered columns
2. **Customer matching** logic (by ID or name)
3. **AdditionalCustomerInfo creation** for Shopee usernames
4. **Bulk upsert** to update addresses and add usernames

### Recommended Import Flow:

```
1. Parse CSV → Read numbered columns (Shopee Username 1-5)
2. Match customers → By ID if present, by name otherwise
3. Update customer → Replace address with Shopee delivery address
4. Create AdditionalCustomerInfo records:
   - For each Shopee Username 1-5 that has value
   - type: 'shopee_username'
   - value: username
   - customerId: matched customer ID
5. Report results → Show matched, updated, created, skipped
```

## Data Quality Notes

### Address Updates (701 customers)

All matched customers now have **current Shopee delivery addresses** instead of outdated addresses from the old database.

**Benefits:**

- More accurate for current deliveries
- Reflects customer location changes
- Reduces delivery errors

### Pickup-Only Customers (408 customers)

These customers have **no Shopee accounts** because they:

- Pick up items directly from warehouse
- Use other platforms (Facebook, walk-in)
- Haven't made Shopee purchases yet

**No action needed** - their data is preserved as-is.

### New Customers (8 customers)

Found in Shopee data but not in customer database:

- Likely new customers from recent Shopee orders
- Added with today's date (2025-11-03)
- Status: Active

## Name Matching Examples

The merge script successfully matched these variations:

| Customer Database                           | Shopee Delivery Name        | Match?          |
| ------------------------------------------- | --------------------------- | --------------- |
| Jewel Jamora                                | Jewel Jamora                | ✅ Exact        |
| ILONAH JEAN MARASIGAN \| Inah Mara          | Ilonah Jean Marasigan       | ✅ Pipe variant |
| Camille Joy Torres \| Camille Joy del Mundo | Camille Joy Torres          | ✅ First name   |
| Anne Tionson \| Enna Yrrehc                 | Anne Tionson \| Enna Yrrehc | ✅ Exact        |
| Mylene Obenita Libunao                      | Mylene Libunao              | ✅ Partial      |

## Known Limitations

### 1. Maximum 5 Usernames Per Customer

- Only first 5 usernames stored in numbered columns
- If customer has >5, excess are truncated
- **Solution:** Use "Duplicate Rows" export format for customers exceeding limit

### 2. No Automatic Import Yet

- Current system only has export functionality
- Import with numbered columns needs to be implemented
- **Workaround:** Manually import via API or database

### 3. Address Overwriting

- All matched customers get Shopee address (by design)
- Original addresses are replaced, not preserved
- **Solution:** If original address needed, keep backup CSV

## Next Steps

### Immediate Actions

1. ✅ **Review merged CSV** - Check for accuracy
2. ⏳ **Implement import** - Create import parser for numbered columns
3. ⏳ **Test import** - Try with small sample first (10-20 customers)
4. ⏳ **Full import** - Import all 1,117 customers

### Implementation Needed

Create import API endpoint that:

```typescript
POST /api/customers/import-detailed
Body: CSV file with numbered columns
Response: {
  created: number,
  updated: number,
  addressesUpdated: number,
  usernamesAdded: number,
  skipped: number,
  errors: [...],
  warnings: [...]
}
```

### Testing Strategy

1. **Sample test (10 customers)**
   - Pick diverse sample (with/without usernames, various username counts)
   - Verify addresses updated correctly
   - Check AdditionalCustomerInfo records created

2. **Validation checks**
   - No duplicate usernames within same customer
   - All phone numbers preserved
   - Email addresses retained
   - Business info unchanged

3. **Full import**
   - Import all 1,117 customers
   - Verify 701 address updates
   - Confirm Shopee usernames added
   - Check pickup-only customers unchanged

## Troubleshooting

### Issue: Some customers not matched

**Check:**

- Name spelling differences
- Extra spaces or special characters
- Married names vs maiden names

**Solution:** Manually review and update CSV before import

### Issue: Address looks wrong after import

**Verify:**

- Shopee delivery address is actually more current
- Customer moved or uses different address for delivery

**Solution:** Manually correct via customer edit form

### Issue: Too many usernames (>5)

**Affected:** Very few customers (shown in merge statistics)

**Solution:**

- Use numbered columns for main usernames
- Store excess in separate batch
- Or use "Duplicate Rows" export for analysis

## Rerunning the Merge

If you need to regenerate the merged file:

```bash
cd /home/ron/Websites/business-management
node scripts/merge-customer-data.js
```

The script will:

- Read both source files
- Generate new merge with current date
- Output: `customers-merged-YYYY-MM-DD.csv`
- Show updated statistics

## Support

For questions or issues:

1. Check merge statistics in script output
2. Review CSV manually in Excel/LibreOffice
3. Test import with small sample first
4. Keep backups before bulk operations

---

**Generated:** November 3, 2025
**Script:** `scripts/merge-customer-data.js`
**Output:** `csv/for update/customers-merged-2025-11-03.csv`
