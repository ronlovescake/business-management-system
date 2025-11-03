# Customer Export Guide

## Overview

The customer export feature allows you to export customer data with all additional information (Shopee usernames, additional addresses, and additional phone numbers) in multiple formats.

## Export Formats

### 1. Standard CSV (Basic)

**When to use:**

- Quick export of basic customer information
- No additional info needed
- Compatible with older systems

**Columns included:**

- ID
- Date
- Customer Name
- Phone Number
- Address
- Facebook
- Email Address
- Business Name
- Tax Number
- Business Address
- Business Contact Number
- Customer Status

**Example:**

```csv
ID,Date,Customer Name,Phone Number,Address,...
1,2024-01-01,John Doe,09123456789,123 Main St,...
2,2024-01-02,Jane Smith,09234567890,456 Oak Ave,...
```

---

### 2. Detailed (Numbered Columns) - **RECOMMENDED**

**When to use:**

- Export customers with Shopee usernames, additional addresses, and phones
- Most customers have ≤5 items per type (90% of data)
- Clean, Excel-friendly format
- Easy to edit and maintain

**Additional columns:**

- Shopee Username 1, 2, 3, 4, 5
- Additional Address 1, 2, 3, 4, 5
- Additional Phone 1, 2, 3, 4, 5

**Example:**

```csv
ID,Customer Name,Phone Number,Address,Shopee Username 1,Shopee Username 2,Additional Address 1,...
1,John Doe,09123456789,123 Main St,johndoe88,jd_shop,456 2nd St,...
2,Jane Smith,09234567890,456 Oak Ave,janesmith22,,,,...
```

**Limitations:**

- Maximum 5 items per type
- If a customer has >5 Shopee usernames, addresses, or phones, data will be truncated
- Export shows a warning if any customer exceeds the limit

**Overflow warning:**

```
⚠️ Export Successful (with warnings)
Some customers have more than 5 items per type. Data will be truncated.
Consider using the "For Analysis (Duplicate Rows)" export format.
```

---

### 3. For Analysis (Duplicate Rows)

**When to use:**

- Analysis, reporting, or data mining
- Customers with >5 additional items per type
- Need to process all data without truncation
- Using pivot tables or data analysis tools

**Additional columns:**

- Additional Info Type (Shopee Username | Additional Address | Additional Phone)
- Additional Info Value

**Example:**

```csv
ID,Customer Name,Phone Number,Address,Additional Info Type,Additional Info Value
1,John Doe,09123456789,123 Main St,Shopee Username,johndoe88
1,John Doe,09123456789,123 Main St,Shopee Username,jd_shop
1,John Doe,09123456789,123 Main St,Additional Address,456 2nd St
2,Jane Smith,09234567890,456 Oak Ave,Shopee Username,janesmith22
```

**Notes:**

- One customer can have multiple rows
- All additional info items are preserved (no truncation)
- Harder to edit in Excel (data duplication)
- Perfect for SQL queries, pivot tables, and data analysis

---

## How to Export

1. Go to **Clothing → Operations → Customers**
2. (Optional) Use the search bar to filter customers
3. Click the **Export CSV** dropdown button
4. Select your preferred format:
   - **Standard CSV** - Basic info only
   - **Detailed (Numbered Columns)** - With additional info (recommended)
   - **For Analysis (Duplicate Rows)** - For advanced analysis

5. The CSV file will download automatically with a timestamped filename:
   - `customers-export-2024-11-15.csv` (Standard)
   - `customers-detailed-2024-11-15.csv` (Numbered Columns)
   - `customers-analysis-2024-11-15.csv` (Duplicate Rows)

---

## Technical Details

### API Endpoint

**GET** `/api/customers/export`

Returns all customers with their additional info in a single optimized query:

```typescript
{
  success: true,
  data: [
    {
      id: 1,
      date: "2024-01-01",
      customerName: "John Doe",
      phoneNumber: "09123456789",
      address: "123 Main St",
      // ... other fields
      shopeeUsernames: ["johndoe88", "jd_shop"],
      additionalAddresses: ["456 2nd St"],
      additionalPhones: ["09345678901"]
    }
  ],
  stats: {
    totalCustomers: 1234,
    withShopeeUsernames: 567,
    maxShopeeUsernames: 8,
    // ... other stats
  }
}
```

### Performance

- **Single database query** with JOIN (not 1000+ individual queries)
- Fetches all customers with all additional info at once
- Excludes soft-deleted records
- Orders by customer ID and creation date

### Database Schema

```prisma
model Customer {
  id                     Int       @id @default(autoincrement())
  customerName           String?
  phoneNumber            String?
  address                String?
  // ... other fields
  additionalCustomerInfo AdditionalCustomerInfo[]
  deletedAt              DateTime?
}

model AdditionalCustomerInfo {
  id         Int       @id @default(autoincrement())
  customerId Int
  type       String    // 'shopee_username' | 'address' | 'phone'
  value      String?
  createdAt  DateTime  @default(now())
  deletedAt  DateTime?
  customer   Customer  @relation(fields: [customerId], references: [id])
}
```

---

## Data Distribution

Based on your current data:

- **90% of customers** have ≤1 Shopee username and ≤1 additional address
- **5 columns per type** covers most edge cases
- **Numbered Columns format** is perfect for most exports
- **Duplicate Rows format** is available for rare cases with >5 items

---

## Best Practices

### For Regular Exports

✅ Use **Detailed (Numbered Columns)** format

- Clean and readable
- Excel-friendly
- Covers 90%+ of your data

### For Analysis/Reporting

✅ Use **For Analysis (Duplicate Rows)** format

- No data truncation
- Perfect for pivot tables
- SQL-friendly structure

### For Legacy Systems

✅ Use **Standard CSV** format

- Basic info only
- Maximum compatibility
- Smallest file size

---

## Future Enhancements

### Import Support (Coming Soon)

- Auto-detect export format
- Parse numbered columns back to AdditionalCustomerInfo
- Parse duplicate rows back to normalized structure
- Replace or merge modes
- Validation and error reporting

### Additional Features

- Custom column selection
- Date range filtering
- Status-based filtering
- Business-only export
- Email-friendly format

---

## Troubleshooting

### Export shows overflow warning

**Solution:** Some customers have >5 additional items per type. Options:

1. Use "For Analysis (Duplicate Rows)" format to export all data
2. Edit customers to reduce items to ≤5 per type
3. Manually add truncated data after export

### Export is slow

**Cause:** Large number of customers (>5000)
**Solution:** Export is optimized with single query. Consider:

1. Using search to filter customers before export
2. Exporting in batches if needed

### Excel shows special characters incorrectly

**Cause:** UTF-8 encoding issue
**Solution:** When opening in Excel:

1. Use "Data → From Text/CSV" instead of double-clicking
2. Select UTF-8 encoding
3. Confirm delimiter is comma

### CSV fields contain commas

**Not an issue:** Fields with commas are automatically quoted:

```csv
"John Doe","+63 912 345 6789","123 Main St, Apartment 4B"
```

---

## Example Use Cases

### Use Case 1: Send to Marketing Team

**Format:** Detailed (Numbered Columns)
**Why:** Clean format, includes all Shopee usernames for targeting

### Use Case 2: Data Analysis in SQL

**Format:** For Analysis (Duplicate Rows)
**Why:** One row per item, easy to join and aggregate

### Use Case 3: Import to Old System

**Format:** Standard CSV
**Why:** Basic fields only, maximum compatibility

### Use Case 4: Print Customer List

**Format:** Standard CSV
**Why:** Simpler, cleaner printout

---

## Support

If you encounter any issues:

1. Check the browser console for error messages
2. Verify database connection
3. Check file permissions for downloads
4. Review server logs in terminal

For questions or feature requests, contact the development team.
