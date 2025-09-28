# Database Setup Guide

## Prerequisites

1. **Install PostgreSQL** on your system
   - macOS: `brew install postgresql`
   - Ubuntu/Debian: `sudo apt-get install postgresql postgresql-contrib`
   - Windows: Download from [postgresql.org](https://www.postgresql.org/download/)

2. **Start PostgreSQL service**
   - macOS: `brew services start postgresql`
   - Ubuntu/Debian: `sudo systemctl start postgresql`
   - Windows: Start from Services or pgAdmin

## Database Setup Steps

### 1. Create Database

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create database
CREATE DATABASE business_management_db;

# Create user (optional)
CREATE USER business_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE business_management_db TO business_user;

# Exit PostgreSQL
\q
```

### 2. Configure Environment Variables

Update your `.env.local` file with your actual database credentials:

```bash
# Example configurations:

# Local development (default postgres user)
DATABASE_URL="postgresql://postgres:password@localhost:5432/business_management_db?schema=public"

# Custom user
DATABASE_URL="postgresql://business_user:your_password@localhost:5432/business_management_db?schema=public"

# Remote database (example)
DATABASE_URL="postgresql://user:password@hostname:5432/database?schema=public"
```

### 3. Test Connection

```bash
# Test database connection
npm run db:test

# Expected output:
# 🔌 Testing database connection...
# ✅ Database connection successful!
# ✅ Database query test passed: [ { test: 1 } ]
```

### 4. API Health Check

Once the connection is working, test the API endpoint:

```bash
# Start development server
npm run dev

# Test health endpoint (in another terminal)
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2025-09-27T21:15:00.000Z",
  "database": "connected",
  "services": {
    "api": "operational",
    "database": "operational"
  }
}
```

## Common Issues & Solutions

### Issue: "Connection refused"

- **Solution**: Make sure PostgreSQL is running
- **Check**: `sudo systemctl status postgresql` (Linux) or `brew services list | grep postgres` (macOS)

### Issue: "Database does not exist"

- **Solution**: Create the database using the SQL commands above

### Issue: "Authentication failed"

- **Solution**: Check username/password in DATABASE_URL
- **Alternative**: Use peer authentication for local development (remove password from URL)

### Issue: "No models defined"

- **This is expected!** We're following the "no mock data" principle
- Models will be added later when implementing real features

## Database Commands Reference

```bash
# Generate Prisma client (after adding models)
npm run db:generate

# Push schema changes to database
npm run db:push

# Create and run migrations
npm run db:migrate

# Open Prisma Studio (GUI for database)
npm run db:studio

# Reset database (destructive!)
npm run db:reset

# Test connection
npm run db:test
```

## Next Steps

1. ✅ Set up database connection (you're here!)
2. 🔄 Test connection with `npm run db:test`
3. 🔄 Verify API health check works
4. ⏳ Add database models when implementing features
5. ⏳ Implement authentication (final phase)

---

📚 **Reference**: [Prisma PostgreSQL Setup](https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch/relational-databases/connect-your-database-typescript-postgresql)
