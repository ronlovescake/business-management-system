# 🔐 Database Backup & Restore Guide

This guide explains how to backup and restore your business management system data.

## 📋 Table of Contents

- [Backup Options](#backup-options)
- [Quick Start](#quick-start)
- [Detailed Instructions](#detailed-instructions)
- [Restore Procedures](#restore-procedures)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Backup Options

Your system supports **4 backup methods**:

### 1. **Full Database Backup (SQL)** ⭐ RECOMMENDED

- Complete PostgreSQL dump with structure + data
- Can restore everything exactly as it was
- Requires PostgreSQL client tools (`pg_dump`)

### 2. **JSON Backup**

- Human-readable format
- All tables in one file
- Easy to inspect and validate

### 3. **CSV Backup**

- Individual files per table
- Can open in Excel/Google Sheets
- Easy to share specific tables

### 4. **Quick Snapshot**

- Metadata only (counts, recent records)
- Fast, lightweight
- Good for verification, not restoration

---

## 🚀 Quick Start

### Create a Complete Backup

```bash
# All formats (SQL + JSON + CSV)
node scripts/backup-database.js

# Or specific format
node scripts/backup-database.js --format=sql
node scripts/backup-database.js --format=json
node scripts/backup-database.js --format=csv
```

### Restore from Backup

```bash
# Restore from SQL dump
node scripts/restore-database.js backups/2025-10-24T12-30-00/backup-2025-10-24T12-30-00.sql

# Restore from JSON
node scripts/restore-database.js backups/2025-10-24T12-30-00/backup-2025-10-24T12-30-00.json
```

---

## 📚 Detailed Instructions

### Option 1: Full Database Backup (SQL) ⭐

**Best for:** Production backups, complete restoration

```bash
# Create SQL backup
node scripts/backup-database.js --format=sql
```

**What it backs up:**

- ✅ All database tables
- ✅ Table structure (schema)
- ✅ All data (including relationships)
- ✅ Indexes and constraints
- ✅ Sequences (auto-increment values)

**Output:**

```
backups/
└── 2025-10-24T14-30-00/
    ├── backup-2025-10-24T14-30-00.sql  (Full database dump)
    └── MANIFEST.json                    (Backup metadata)
```

**Requirements:**

- PostgreSQL client tools must be installed
- Linux: `sudo apt-get install postgresql-client`
- Mac: `brew install postgresql`
- Windows: Download from postgresql.org

---

### Option 2: JSON Backup

**Best for:** Quick backups, human-readable format

```bash
# Create JSON backup
node scripts/backup-database.js --format=json
```

**What it backs up:**

- ✅ All active records (excludes soft-deleted)
- ✅ All tables in one file
- ✅ Human-readable format

**Output:**

```
backups/
└── 2025-10-24T14-30-00/
    ├── backup-2025-10-24T14-30-00.json
    └── MANIFEST.json
```

**Example JSON structure:**

```json
{
  "metadata": {
    "createdAt": "2025-10-24T14:30:00.000Z",
    "database": "business_management_db",
    "format": "json"
  },
  "tables": {
    "transactions": {
      "count": 1500,
      "data": [...]
    },
    "customers": {
      "count": 250,
      "data": [...]
    }
  }
}
```

---

### Option 3: CSV Backup

**Best for:** Sharing data, importing to Excel/Google Sheets

```bash
# Create CSV backup
node scripts/backup-database.js --format=csv
```

**What it backs up:**

- ✅ Each table as separate CSV file
- ✅ Easy to open in spreadsheet software
- ✅ Good for data analysis

**Output:**

```
backups/
└── 2025-10-24T14-30-00/
    ├── csv/
    │   ├── transactions.csv
    │   ├── customers.csv
    │   ├── products.csv
    │   ├── employees.csv
    │   └── ...
    └── MANIFEST.json
```

---

### Option 4: Quick Snapshot

**Best for:** Quick verification, metadata checks

```bash
# Create snapshot (metadata only)
node scripts/db-snapshot.js
```

**What it backs up:**

- ✅ Record counts per table
- ✅ 5 most recent records per table
- ✅ Timestamp information

**Output:**

```
snapshots/
└── snapshot-2025-10-24T14-30-00.json
```

**Note:** This is NOT sufficient for full restoration!

---

## 🔄 Restore Procedures

### Restore from SQL Backup ⭐ RECOMMENDED

```bash
node scripts/restore-database.js backups/2025-10-24T12-30-00/backup-2025-10-24T12-30-00.sql
```

**Steps:**

1. Script will ask for confirmation
2. Type `yes` to proceed
3. Wait for restoration to complete
4. Verify your data

**⚠️ WARNING:** This will overwrite ALL existing data!

---

### Restore from JSON Backup

```bash
node scripts/restore-database.js backups/2025-10-24T12-30-00/backup-2025-10-24T12-30-00.json
```

**Steps:**

1. Script will ask for confirmation
2. Type `yes` to proceed
3. Records are inserted (duplicates skipped)
4. Verify your data

**Note:** This may not restore sequences/auto-increment values correctly.

---

### Restore Soft-Deleted Records (Quick Recovery)

If you accidentally deleted something today:

```sql
-- View recently deleted transactions
SELECT * FROM "transactions"
WHERE "deletedAt" >= CURRENT_DATE
ORDER BY "deletedAt" DESC;

-- Restore specific transaction
UPDATE "transactions"
SET "deletedAt" = NULL
WHERE id = 123;

-- Restore all deleted today
UPDATE "transactions"
SET "deletedAt" = NULL
WHERE "deletedAt" >= CURRENT_DATE;
```

---

## ✨ Best Practices

### 1. **Regular Backup Schedule**

```bash
# Daily backup (add to cron job)
0 2 * * * cd /home/ron/Websites/business-management && node scripts/backup-database.js --format=sql

# Weekly full backup
0 3 * * 0 cd /home/ron/Websites/business-management && node scripts/backup-database.js --format=all
```

### 2. **Before Critical Operations**

Always backup before:

- Database migrations
- Bulk deletions
- Major updates
- Testing new features
- Production deployments

```bash
# Pre-migration backup
node scripts/backup-database.js --format=sql
npx prisma migrate deploy
```

### 3. **Store Backups Safely**

✅ **DO:**

- Keep backups outside your project folder
- Upload to cloud storage (Google Drive, Dropbox, AWS S3)
- Keep at least 3 copies (3-2-1 rule)
- Test restore regularly

❌ **DON'T:**

- Store backups only on the same server
- Commit backups to Git (too large)
- Keep only one backup
- Trust backups you've never tested

### 4. **Backup Retention Policy**

Recommended retention:

- **Daily backups:** Keep for 7 days
- **Weekly backups:** Keep for 1 month
- **Monthly backups:** Keep for 1 year
- **Before major changes:** Keep forever

### 5. **Test Your Backups**

```bash
# Test restore on a test database
RESTORE_ENV_FILE=.env.test node scripts/restore-database.js backups/latest/backup.sql
```

---

## 🗂️ Backup File Structure

```
business-management/
├── backups/                          # All backups stored here
│   ├── 2025-10-24T14-30-00/         # Timestamped backup folder
│   │   ├── backup-*.sql             # PostgreSQL dump
│   │   ├── backup-*.json            # JSON export
│   │   ├── csv/                     # CSV exports
│   │   │   ├── transactions.csv
│   │   │   ├── customers.csv
│   │   │   └── ...
│   │   └── MANIFEST.json            # Backup metadata
│   └── 2025-10-23T02-00-00/
│       └── ...
└── snapshots/                        # Quick snapshots
    ├── snapshot-2025-10-24T14-30-00.json
    └── ...
```

---

## 🔍 Troubleshooting

### Issue: "pg_dump: command not found"

**Solution:** Install PostgreSQL client tools

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install postgresql-client

# Mac
brew install postgresql

# Verify installation
pg_dump --version
```

---

### Issue: "Permission denied" when creating backup

**Solution:** Make script executable

```bash
chmod +x scripts/backup-database.js
chmod +x scripts/restore-database.js
```

---

### Issue: Backup file too large

**Solution:** Use compression

```bash
# Compress SQL backup
gzip backups/2025-10-24T14-30-00/backup-*.sql

# Decompress before restore
gunzip backups/2025-10-24T14-30-00/backup-*.sql.gz
```

---

### Issue: JSON backup fails with memory error

**Solution:** Use SQL backup instead (more efficient for large datasets)

```bash
node scripts/backup-database.js --format=sql
```

---

### Issue: Restore overwrites new data

**Solution:** Create a backup BEFORE restoring!

```bash
# 1. Backup current state
node scripts/backup-database.js --format=sql

# 2. Then restore old backup
node scripts/restore-database.js old-backup.sql
```

---

## 📊 What Gets Backed Up?

### ✅ Included in Backups

- Transactions (orders, sales)
- Customers (contact info, status)
- Products (inventory, pricing)
- Employees (personal info, payroll)
- Schedules & Attendance
- Payroll records
- Leave requests
- Expenses
- Cash advances
- All relationships between tables

### ⚠️ NOT Included in JSON/CSV Backups

- Soft-deleted records (`deletedAt != null`)
- Database sequences (auto-increment values)
- Custom database functions
- Triggers and stored procedures

### ✅ INCLUDED in SQL Backups

- Everything above PLUS:
- Soft-deleted records
- Database sequences
- Table structure
- Indexes and constraints

---

## 🎯 Quick Reference Commands

```bash
# BACKUPS
node scripts/backup-database.js                    # All formats
node scripts/backup-database.js --format=sql       # SQL only
node scripts/backup-database.js --format=json      # JSON only
node scripts/backup-database.js --format=csv       # CSV only
node scripts/db-snapshot.js                        # Quick snapshot

# RESTORE
node scripts/restore-database.js backups/path/to/backup.sql
node scripts/restore-database.js backups/path/to/backup.json

# LIST BACKUPS
ls -lh backups/

# CHECK BACKUP SIZE
du -sh backups/*

# CLEAN OLD BACKUPS (keep last 7)
cd backups && ls -t | tail -n +8 | xargs rm -rf
```

---

## 📞 Support

If you need help:

1. Check this guide first
2. Verify your database connection (`.env.local`)
3. Test with a small backup first
4. Check PostgreSQL logs for errors

---

## 🔒 Security Notes

- ⚠️ Backup files contain sensitive data!
- Never commit backups to Git
- Encrypt backups before uploading to cloud
- Use strong passwords for database access
- Limit backup file permissions: `chmod 600 backups/*`

---

**Last Updated:** October 24, 2025  
**Version:** 1.0
