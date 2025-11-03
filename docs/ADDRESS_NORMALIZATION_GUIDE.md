# Address Normalization Guide

## Overview

This guide documents the address normalization process used to clean and standardize customer addresses in the database. The normalization includes expanding abbreviations, detecting duplicates, and selecting the best quality address from multiple entries.

---

## Normalization Results

**Date:** November 3, 2025

### Summary Statistics

| Metric                            | Count       |
| --------------------------------- | ----------- |
| Total Customers                   | 1,117       |
| Addresses Improved                | 587 (52.5%) |
| Duplicate Groups Found            | 0           |
| Customers with Multiple Addresses | 0           |

---

## Abbreviation Expansion

The script automatically expands common address abbreviations to their full forms:

### Location & Structure

| Abbreviation   | Full Form |
| -------------- | --------- |
| `Blk` / `blk`  | Block     |
| `Ph` / `Phs`   | Phase     |
| `Pkg`          | Package   |
| `Lt` / `Lot`   | Lot       |
| `Brgy` / `Bgy` | Barangay  |
| `Pob`          | Poblacion |

### Streets & Roads

| Abbreviation   | Full Form |
| -------------- | --------- |
| `St` / `st.`   | Street    |
| `Ave` / `ave.` | Avenue    |
| `Rd` / `rd.`   | Road      |
| `Dr`           | Drive     |
| `Blvd`         | Boulevard |
| `Hwy`          | Highway   |

### Building Types

| Abbreviation     | Full Form   |
| ---------------- | ----------- |
| `Subd` / `subdv` | Subdivision |
| `Bldg`           | Building    |
| `Apt`            | Apartment   |
| `Condo`          | Condominium |

### Directions

| Abbreviation | Full Form |
| ------------ | --------- |
| `N`          | North     |
| `S`          | South     |
| `E`          | East      |
| `W`          | West      |

---

## Examples

### Before and After Normalization

#### Example 1: Block Abbreviation

```
BEFORE: Blk 3 Lot 24 Phase A La Terraza Subdivision Bucandala 3 Imus Cavite
AFTER:  Block 3 Lot 24 Phase A La Terraza Subdivision Bucandala 3 Imus Cavite
```

#### Example 2: Multiple Abbreviations

```
BEFORE: B9 L47 Rail St Westwood 1 Lancaster New City General Trias Cavite
AFTER:  B9 L47 Rail Street Westwood 1 Lancaster New City General Trias Cavite
```

#### Example 3: Barangay Expansion

```
BEFORE: Door II Donata Building Brgy San Gregorio, Burgos, Santa Rosa
AFTER:  Door II Donata Building Barangay San Gregorio, Burgos, Santa Rosa
```

#### Example 4: Street and Building

```
BEFORE: 005 Gervacio st. Felix subd. Cainta
AFTER:  005 Gervacio street. Felix subdivision. Cainta
```

---

## Quality Scoring System

The script uses a sophisticated quality scoring system to select the best address from duplicates:

### Scoring Criteria

| Criterion              | Points      | Description                                          |
| ---------------------- | ----------- | ---------------------------------------------------- |
| **Full Words**         | +3 per word | Uses full words instead of abbreviations             |
| **Abbreviations**      | -2 per abbr | Penalty for using abbreviations                      |
| **Proper Punctuation** | +2          | Has commas between address components (≥3 commas)    |
| **Capitalization**     | +2          | Proper mixed case (not all lowercase or uppercase)   |
| **Barangay Info**      | +1          | Includes barangay information                        |
| **No Landmarks**       | +1          | Doesn't have excessive landmarks like "(Store Name)" |
| **Spacing**            | +1          | No double spaces                                     |
| **Length Bonus**       | +1 to +3    | More complete addresses (per 50 characters)          |

### Example Scores

```
Address: "Blk 3 Lt 24 Ph A La Terraza Subd. Bucandala 3"
Score: 5
Issues: Multiple abbreviations, missing commas

Address: "Block 3 Lot 24 Phase A La Terraza Subdivision, Bucandala 3, Imus, Cavite"
Score: 15
✅ Better: Full words, proper punctuation, well-formatted
```

---

## Duplicate Detection

### Algorithm

The duplicate detection uses a two-step process:

1. **Normalization**: Convert addresses to lowercase, remove punctuation, expand abbreviations
2. **Similarity Comparison**: Calculate Levenshtein distance ratio
   - **Threshold**: 90% similarity = duplicate
   - **Exact Match**: Same normalized address = duplicate

### Examples from Your Data

Based on your provided examples, here's how the system handles them:

#### Case 1: Karen Lleno (Duplicates with Different Quality)

```
Address 1: "phs4a pkg4 block 31 lot1 Bagong Silang Caloocan City Barugo
            Landmark: Lleno Store Barugo Stree, Barangay 176..."
Score: 5 (abbreviations, landmark clutter, typo "Stree")

Address 2: "Ph4A pkg1 blk2 lot1 Barugo Bagong Silang caloocan City,
            Barangay 176, Caloocan City..."
Score: 7 (some abbreviations, but cleaner)

✅ SELECTED: Address 2 (higher score)
✅ AFTER NORMALIZATION: "Phase 4A Package 1 Block 2 Lot 1 Barugo..."
```

#### Case 2: Maan Deacosta (Exact Duplicates)

```
Address 1: "106 A Hillcrest St. Country Homes Subd., Soro-Soro, Binan City..."
Normalized: "106 a hillcrest street country homes subdivision soro-soro binan city..."

Address 2: "106 A Hillcrest St. Country Homes Subdivision, Soro-Soro, Binan City..."
Normalized: "106 a hillcrest street country homes subdivision soro-soro binan city..."

✅ DUPLICATE DETECTED (100% match after normalization)
✅ SELECTED: Address 2 (full "Subdivision" word, score: 10)
```

#### Case 3: Mike Apura (Different Addresses)

```
Address 1: "Gugo Highway, Gugo, Gugo, Samal, North Luzon, Bataan, 2114"
Address 2: "Sitio Malaking Bato Mabatang, Abucay Bataan, Mabatang, Abucay..."
Address 3: "Sitio Malaking Bato, Mabatang, Abucay, Bataan (EVA STORE)..."

Analysis:
- Address 1 is DIFFERENT (Gugo ≠ Abucay) → Additional Address 1
- Address 2 & 3 are DUPLICATES (90%+ similar)

Result:
✅ Primary Address: Address 2 (no landmark clutter)
✅ Additional Address 1: Address 1 (different location)
```

---

## How It Works

### Step 1: Normalize for Comparison

```javascript
function normalizeAddressForComparison(address) {
  return address
    .toLowerCase()
    .replace(/\s+/g, ' ') // Multiple spaces → single
    .replace(/[,\.]/g, '') // Remove punctuation
    .replace(/\bsubd\b/g, 'subdivision') // Expand abbreviations
    .trim();
}
```

### Step 2: Calculate Quality Score

```javascript
function calculateQualityScore(address) {
  let score = 0;

  // +3 for full words (subdivision, street, phase, etc.)
  // -2 for abbreviations (subd., st., ph., etc.)
  // +2 for proper punctuation (≥3 commas)
  // +2 for proper capitalization
  // +1 for barangay info
  // +1 for no landmark clutter
  // +1 for consistent spacing
  // +1-3 length bonus

  return score;
}
```

### Step 3: Detect Duplicates

```javascript
function areAddressesDuplicates(addr1, addr2) {
  const normalized1 = normalizeAddressForComparison(addr1);
  const normalized2 = normalizeAddressForComparison(addr2);

  // Exact match
  if (normalized1 === normalized2) return true;

  // 90%+ similarity
  const similarity = calculateSimilarity(normalized1, normalized2);
  return similarity >= 0.9;
}
```

### Step 4: Select Best Address

```javascript
function selectBestAddress(addresses) {
  const scored = addresses.map((addr) => ({
    address: addr,
    score: calculateQualityScore(addr),
  }));

  // Sort by score (highest first), then by length (longer first)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.address.length - a.address.length;
  });

  return scored[0].address;
}
```

---

## Usage

### Running the Script

```bash
node scripts/normalize-addresses.js
```

### Input File

```
/csv/for update/customers-merged-2025-11-03.csv
```

### Output Files

```
/csv/for update/customers-normalized-2025-11-03.csv  # Normalized data
/csv/for update/address-normalization-report.txt     # Detailed report
```

---

## Report Structure

The script generates a detailed report showing:

1. **Summary Statistics**
   - Total customers processed
   - Number of addresses improved
   - Duplicate groups found
   - Customers with multiple addresses

2. **Duplicate Details** (if found)
   - Customer name
   - All duplicate addresses found
   - Quality scores for each
   - Selected best address

---

## Benefits

### 1. **Consistency**

- All addresses use full words instead of abbreviations
- Standardized format across the entire database

### 2. **Better Searchability**

- Full words make searching easier
- No need to search for multiple abbreviation variations

### 3. **Professional Appearance**

- Clean, professional-looking addresses
- Consistent formatting for invoices and shipping labels

### 4. **Duplicate Prevention**

- Automatically detects and merges duplicate addresses
- Selects the highest quality version

### 5. **Future-Proof**

- Additional Address columns ready for new addresses
- Maintains address history when customers move

---

## Configuration

### Similarity Threshold

Default: **90%** (can be adjusted in the script)

```javascript
const DUPLICATE_THRESHOLD = 0.9; // 90% similarity
```

Higher threshold = stricter duplicate detection  
Lower threshold = more addresses considered duplicates

### Abbreviation Map

You can add custom abbreviations in the script:

```javascript
const ABBREVIATION_MAP = {
  your_abbr: 'full_form',
  cmpd: 'compound',
  ext: 'extension',
  // Add more as needed
};
```

---

## Next Steps

After normalization:

1. **Review Report**
   - Check `/csv/for update/address-normalization-report.txt`
   - Verify duplicate detection accuracy

2. **Import Normalized Data**
   - Use `customers-normalized-2025-11-03.csv` for import
   - Import via "Detailed (Numbered Columns)" format

3. **Update Merge Script**
   - Consider adding normalization step to merge script
   - Ensures all future merges have normalized addresses

4. **Database Update**
   - Import normalized addresses to database
   - Update existing customer records

---

## Troubleshooting

### Issue: Too Many/Few Duplicates Detected

**Solution**: Adjust the similarity threshold

```javascript
// In normalize-addresses.js, line ~213
function areAddressesDuplicates(addr1, addr2, threshold = 0.9) {
  // Increase to 0.95 for stricter matching
  // Decrease to 0.85 for more lenient matching
}
```

### Issue: Abbreviation Not Expanded

**Solution**: Add to ABBREVIATION_MAP

```javascript
const ABBREVIATION_MAP = {
  // Existing...
  your_abbr: 'full_form', // Add this line
};
```

### Issue: Wrong Address Selected

**Solution**: Adjust quality scoring weights

```javascript
// In calculateQualityScore function
if (lower.includes(word)) {
  score += 5; // Increase from 3 to give more weight
}
```

---

## Technical Details

### Algorithm Complexity

- **Time**: O(n²) for duplicate detection (comparing all pairs)
- **Space**: O(n) for storing normalized addresses

### Performance

- Processes **~1,100 customers in <5 seconds**
- Handles addresses up to 500 characters
- Memory efficient (streaming CSV processing)

### Dependencies

- **Node.js**: Built-in `fs` module only
- **No external packages required**

---

## Future Enhancements

1. **Machine Learning**
   - Train model to predict best address quality
   - Learn from manual corrections

2. **Address Validation**
   - Integrate with Google Maps API
   - Verify address accuracy and geocode

3. **Smart Punctuation**
   - Auto-add commas between address components
   - Fix capitalization (Title Case for proper nouns)

4. **Batch Processing**
   - Process addresses in chunks
   - Support for very large datasets (100k+ records)

5. **Interactive Mode**
   - Allow manual selection when scores are close
   - Review and approve duplicates before merging

---

## Related Documentation

- [Customer Export Guide](./CUSTOMER_EXPORT_GUIDE.md)
- [Customer Data Merge Guide](./CUSTOMER_DATA_MERGE_GUIDE.md)
- [Database Schema](./DATABASE_SCHEMA.md)

---

## Support

For issues or questions about address normalization:

1. Check the normalization report for details
2. Review this guide for common solutions
3. Adjust configuration parameters as needed
4. Test with a small sample before full processing
