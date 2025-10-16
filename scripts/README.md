# CSV Transformation Script

## 📋 Purpose

This script transforms your old attendance CSV format to match your new attendance system structure.

## 🚀 Quick Start

### Step 1: Run the Transformation Script

```bash
cd /home/ron/Websites/business-management
node scripts/transform-attendance-csv.js
```

### Step 2: Review the Output

The script will create: `Transformed_Attendance_Records.csv` in your project root.

### Step 3: Import into Your System

1. Open your attendance page: `/clothing/employees/attendance`
2. Click the **"Import CSV"** button
3. Select `Transformed_Attendance_Records.csv`
4. Verify the imported records

## 🔍 What the Script Does

### Data Mapping

```
Old CSV Column          →  New Structure
─────────────────────────────────────────
employee_id            →  employeeId
employee               →  employeeName
date                   →  date
check_in               →  timeIn
check_out              →  timeOut
break_1_start          →  break1Start
break_1_end            →  break1End
lunch_start            →  lunchStart
lunch_end              →  lunchEnd
break_2_start          →  break2Start
break_2_end            →  break2End
hours_worked           →  totalHours
status                 →  status
notes                  →  notes
```

### Data Enrichment

The script automatically:

- ✅ Generates unique IDs for each record
- ✅ Adds missing employee details (department, position)
- ✅ Formats times to HH:MM (24-hour format)
- ✅ Calculates total hours if missing
- ✅ Maps status values (`on_leave` → `on-leave`)
- ✅ Skips records with critical missing data
- ✅ Escapes special characters for CSV compatibility

## 📝 Employee Details Lookup

The script includes details for:

- EMP-0003: Arnel Ephraim Subia Aliangan (Warehouse POC)
- EMP-0004: Rain Joel Subia Orong (Stay-in Employee)
- EMP-0005: Joan Lacaulan Tapic (Warehouse Staff)

### To Add More Employees:

Edit `scripts/transform-attendance-csv.js` and update the `employeeDetails` object:

```javascript
const employeeDetails = {
  'EMP-0003': {
    name: 'Arnel Ephraim Subia Aliangan',
    department: 'Operations',
    position: 'Warehouse POC',
  },
  // Add your employees here:
  'EMP-0006': {
    name: 'New Employee Name',
    department: 'Department Name',
    position: 'Position Title',
  },
};
```

## ⚠️ Important Notes

### Records That Will Be Skipped:

- Records missing both `employee_id` AND `employee` name
- Records missing the `date` field

### Time Format Handling:

- Converts various time formats to HH:MM (24-hour)
- Empty time fields remain empty
- Removes timezone info and extra characters

### Status Mapping:

- `present` → `present`
- `late` → `late`
- `absent` → `absent`
- `on_leave` → `on-leave`

## 📊 Expected Output

After running the script, you'll see:

```
🚀 Starting CSV transformation...

✅ Successfully read old CSV file
📊 Found 200 records to process

✅ Successfully transformed 198 records
⚠️  Skipped 2 records due to missing data

✅ Successfully wrote transformed CSV to: /path/to/Transformed_Attendance_Records.csv

📈 Transformation Summary:
   Total records processed: 198
   Records with breaks: 180
   Present status: 170
   On-leave status: 20
   Absent status: 8

✨ Transformation complete!

📁 Import the file: Transformed_Attendance_Records.csv
   into your attendance page using the "Import CSV" button.
```

## 🐛 Troubleshooting

### Script Won't Run?

```bash
# Make sure you're in the right directory
cd /home/ron/Websites/business-management

# Check if the old CSV exists
ls -la "Old Attendance Records.csv"

# Run with Node.js
node scripts/transform-attendance-csv.js
```

### Missing Employee Details?

Update the `employeeDetails` object in the script with your employee information.

### Wrong Time Format?

The script handles most time formats automatically. If you see issues, check the console warnings.

## 🔒 Backup Reminder

Before importing:

1. ✅ Keep your original `Old Attendance Records.csv` as backup
2. ✅ Test import with a small sample first
3. ✅ Verify data after import
4. ✅ Back up your database before bulk import

## 💡 After Import

Once successfully imported, you can:

- Archive the old CSV file
- Delete `Transformed_Attendance_Records.csv`
- Keep the script for future imports if needed
