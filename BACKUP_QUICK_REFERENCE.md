# 🔐 Backup Quick Reference Card

## ⚡ Quick Commands

### Create Backup

```bash
# Complete backup (all formats)
node scripts/backup-database.js

# JSON only (fastest, no pg_dump needed)
node scripts/backup-database.js --format=json

# SQL only (best for production)
node scripts/backup-database.js --format=sql

# CSV only (for Excel/Sheets)
node scripts/backup-database.js --format=csv
```

### Restore Backup

```bash
# From SQL
node scripts/restore-database.js backups/2025-10-24T15-30-00/backup-*.sql

# From JSON
node scripts/restore-database.js backups/2025-10-24T15-30-00/backup-*.json
```

### Quick Snapshot (Metadata Only)

```bash
node scripts/db-snapshot.js
```

---

## 📍 Backup Locations

- **Full Backups:** `backups/` folder (timestamped)
- **Snapshots:** `snapshots/` folder
- **Each backup includes:** SQL dump, JSON export, CSV files, MANIFEST

---

## ⏰ When to Backup

✅ **ALWAYS backup before:**

- Database migrations
- Bulk deletions
- Major updates
- Production deployments
- Testing new features

```bash
# Pre-migration backup workflow
node scripts/backup-database.js --format=sql
npx prisma migrate deploy
```

---

## 🔄 Restore Deleted Data

### Option 1: From Soft Delete (Quick)

```sql
-- View deleted transactions
SELECT * FROM "transactions" WHERE "deletedAt" IS NOT NULL;

-- Restore specific record
UPDATE "transactions" SET "deletedAt" = NULL WHERE id = 123;

-- Restore all deleted today
UPDATE "transactions" SET "deletedAt" = NULL
WHERE "deletedAt" >= CURRENT_DATE;
```

### Option 2: From Backup (Full Restore)

```bash
node scripts/restore-database.js backups/latest/backup.sql
```

---

## 📊 Check Backup Status

```bash
# List all backups
ls -lh backups/

# Check latest backup
ls -t backups/ | head -1

# Check backup size
du -sh backups/*

# View backup contents
cat backups/2025-10-24T15-30-00/MANIFEST.json
```

---

## 🚨 Emergency Recovery

### If you accidentally deleted data:

1. **DON'T PANIC** - You have soft-delete protection
2. **Check soft-deleted records first:**
   ```sql
   SELECT * FROM "transactions" WHERE "deletedAt" IS NOT NULL ORDER BY "deletedAt" DESC LIMIT 10;
   ```
3. **Restore from soft-delete if recent:**
   ```sql
   UPDATE "transactions" SET "deletedAt" = NULL WHERE id IN (123, 456, 789);
   ```
4. **If soft-delete doesn't work, restore from backup:**
   ```bash
   node scripts/restore-database.js backups/latest/backup.sql
   ```

---

## 💾 What Gets Backed Up?

### ✅ All Your Data:

- Transactions (orders, sales)
- Customers
- Products & Prices
- Employees & Payroll
- Schedules & Attendance
- Leave Requests
- Expenses
- Cash Advances
- Audit Logs

### Backup Formats:

- **SQL**: Complete database (structure + data)
- **JSON**: All records in one file
- **CSV**: Individual table files

---

## 🔒 Security Reminder

⚠️ **Backups contain sensitive data!**

- Never commit to Git (already in `.gitignore`)
- Store in safe location
- Upload to cloud storage
- Encrypt before sharing

---

## 📞 Troubleshooting

### pg_dump not found?

```bash
# Install PostgreSQL client tools
sudo apt-get install postgresql-client  # Linux
brew install postgresql                  # Mac
```

### Backup too large?

```bash
# Compress it
gzip backups/2025-10-24T15-30-00/backup-*.sql
```

### Need older backup?

```bash
# List all backups by date
ls -lt backups/
```

---

## 📚 Full Documentation

For detailed information, see: **BACKUP_RESTORE_GUIDE.md**

---

**Last Updated:** October 24, 2025
