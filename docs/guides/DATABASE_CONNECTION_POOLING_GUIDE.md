# Database Connection Pooling Guide

This guide explains the database connection pooling configuration and best practices for this application.

## 📊 Overview

Connection pooling is critical for:

- **Performance**: Reusing existing connections instead of creating new ones
- **Scalability**: Managing limited database connections efficiently
- **Reliability**: Preventing connection exhaustion and timeouts
- **Cost**: Reducing database server load and connection overhead

## 🔧 Configuration

### Connection Pool Parameters

The application uses PostgreSQL with Prisma ORM. Connection pool settings are configured via the `DATABASE_URL` environment variable.

**Format:**

```bash
postgresql://user:password@host:port/database?param1=value1&param2=value2
```

### Key Parameters

#### 1. `connection_limit` (Default: 10)

Maximum number of concurrent database connections per Node.js process.

**Recommendations:**

- **Development:** 5-10 connections
- **Production (small):** 10-15 connections
- **Production (medium):** 15-20 connections
- **Production (high traffic):** 20-30 connections

**Formula:**

```
connection_limit = (num_cpu_cores * 2) + effective_spindle_count
```

For a typical deployment:

- 2 CPU cores → ~5-10 connections
- 4 CPU cores → ~10-15 connections
- 8 CPU cores → ~15-20 connections

**⚠️ Important:**

- **Too High:** May exhaust database server connections (PostgreSQL default max: 100)
- **Too Low:** Causes request queueing and timeouts under load
- **Multiple processes:** Each Node.js process has its own pool (serverless functions, PM2 clusters)

#### 2. `pool_timeout` (Default: 10s)

Maximum time (in seconds) to wait for an available connection from the pool.

**Recommendations:**

- **Development:** 10-20 seconds
- **Production:** 20-30 seconds

**Behavior:**

- If no connection available within timeout → throws error
- Prevents requests from waiting indefinitely
- Should be set based on expected query duration

#### 3. `connect_timeout` (Default: 5s)

Maximum time (in seconds) to establish a new TCP connection to the database.

**Recommendations:**

- **Development:** 5-10 seconds
- **Production:** 10 seconds

**Behavior:**

- Timeout for initial TCP handshake
- Fast failure for unreachable databases
- Helps detect network/firewall issues quickly

#### 4. `sslmode` (Default: prefer)

SSL/TLS encryption mode for database connections.

**Options:**

- `disable` - No SSL (never use in production!)
- `prefer` - Try SSL, fallback to non-SSL
- `require` - Require SSL (recommended for production)

**Production:** Always use `sslmode=require`

## 🚀 Environment-Specific Configuration

### Development

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/business_management?connection_limit=5&pool_timeout=10&connect_timeout=5"
```

**Rationale:**

- Fewer connections (5) since low traffic
- Shorter timeouts for faster development feedback
- SSL not required for localhost

### Staging

```bash
DATABASE_URL="postgresql://user:password@staging-db.example.com:5432/business_management?sslmode=require&connection_limit=10&pool_timeout=20&connect_timeout=10"
```

**Rationale:**

- Moderate connections (10) for testing
- SSL required (production-like)
- Moderate timeouts

### Production

```bash
DATABASE_URL="postgresql://user:password@prod-db.example.com:5432/business_management?sslmode=require&connection_limit=20&pool_timeout=30&connect_timeout=10"
```

**Rationale:**

- Higher connections (20) for production traffic
- SSL required for security
- Longer pool_timeout to handle bursts
- Fast connect_timeout for failure detection

## 📈 Monitoring

### Built-in Database Statistics

The application tracks database performance automatically:

```typescript
import { getDatabaseStats, logDatabaseStats } from '@/lib/db';

// Get current statistics
const stats = getDatabaseStats();
console.log(stats);
// Output:
// {
//   totalQueries: 1234,
//   slowQueries: 56,
//   slowQueryPercentage: '4.54%',
//   slowQueryThreshold: '100ms'
// }

// Log statistics
logDatabaseStats();
// Logs: 📊 Database Statistics { totalQueries: 1234, slowQueries: 56, ... }
```

### Slow Query Detection

Queries slower than 100ms are automatically logged:

```
⚠️ 🐌 Slow query detected
{
  duration: "234ms",
  query: "SELECT * FROM transactions WHERE ...",
  params: "[...]",
  threshold: "100ms"
}
```

### Health Checks

```typescript
import { testDatabaseConnection } from '@/lib/db';

const isConnected = await testDatabaseConnection();
if (!isConnected) {
  // Handle connection failure
}
```

### Graceful Shutdown

```typescript
import { disconnectDatabase } from '@/lib/db';

// On application shutdown (e.g., SIGTERM)
process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});
```

## ⚠️ Common Issues

### 1. Connection Pool Exhausted

**Symptom:**

```
Error: Timed out fetching a new connection from the connection pool.
```

**Causes:**

- Too many concurrent requests
- Slow queries holding connections
- connection_limit too low

**Solutions:**

- Increase `connection_limit`
- Optimize slow queries
- Add indexes
- Use connection pooling at infrastructure level (PgBouncer)

### 2. Connection Timeout

**Symptom:**

```
Error: Can't reach database server at `host:port`
```

**Causes:**

- Database server down
- Network/firewall issues
- Wrong host/port

**Solutions:**

- Verify database is running
- Check firewall rules
- Verify DATABASE_URL is correct
- Increase `connect_timeout` if network is slow

### 3. Too Many Connections

**Symptom:**

```
Error: too many connections for role "user"
```

**Causes:**

- Multiple application instances
- connection_limit too high
- Serverless functions creating too many connections

**Solutions:**

- Reduce `connection_limit` per instance
- Calculate total connections: `instances × connection_limit`
- Use connection pooler (PgBouncer, RDS Proxy)
- For serverless: Use connection pooling service

## 🏗️ Advanced: External Connection Pooling

For high-traffic applications, use an external connection pooler:

### PgBouncer (Recommended)

**Setup:**

1. Install PgBouncer
2. Configure pool size (e.g., 20 connections to database)
3. Point application to PgBouncer instead of database
4. Each app instance can have higher connection_limit since PgBouncer manages actual database connections

**Benefits:**

- Centralized connection management
- Better resource utilization
- Support for 1000+ application connections with 20 database connections

**Configuration:**

```bash
# Application connects to PgBouncer
DATABASE_URL="postgresql://user:password@pgbouncer:6432/business_management?connection_limit=50&pool_timeout=30"

# PgBouncer manages actual database connections (configured separately)
```

### AWS RDS Proxy

For AWS deployments, use RDS Proxy:

**Benefits:**

- Automatic failover
- Connection multiplexing
- IAM authentication support
- Serverless-friendly

## 📊 Sizing Guidelines

### Calculate Required Connections

**Formula:**

```
total_connections = num_app_instances × connection_limit
```

**Example:**

- 3 application servers
- connection_limit = 10
- Total: 3 × 10 = 30 database connections

**PostgreSQL Default Max:** 100 connections

**Rule of Thumb:**

- Reserve 20% for maintenance/monitoring (20 connections)
- Available for apps: 80 connections
- Max app instances: 80 / connection_limit

### Serverless Considerations

Serverless functions (AWS Lambda, Vercel, etc.) create challenges:

**Problem:**

- Each function instance creates its own connection pool
- 100 concurrent functions × 10 connections = 1000 connections! ❌

**Solutions:**

1. **Use RDS Proxy or PgBouncer** (recommended)
2. **Reduce connection_limit** to 1-2 per function
3. **Use connection pooling service** (e.g., Supabase Supavisor)
4. **Limit function concurrency** (not ideal)

## 🎯 Best Practices

### 1. Start Conservative

- Begin with lower connection_limit (5-10)
- Monitor connection usage
- Increase gradually if needed

### 2. Monitor Slow Queries

- Review slow query logs regularly
- Optimize queries >100ms
- Add appropriate indexes

### 3. Use Appropriate Timeouts

- pool_timeout: 2-3× average query time
- connect_timeout: 5-10 seconds

### 4. Production Checklist

- [ ] SSL enabled (`sslmode=require`)
- [ ] connection_limit set appropriately
- [ ] pool_timeout configured
- [ ] Slow query monitoring enabled
- [ ] Health check endpoint working
- [ ] Graceful shutdown implemented

### 5. Load Testing

Before production:

- Test with expected concurrent users
- Monitor connection pool usage
- Verify no connection exhaustion
- Measure query performance under load

### 6. Database Limits

Ensure database can handle total connections:

```sql
-- PostgreSQL: Check max connections
SHOW max_connections;  -- Default: 100

-- PostgreSQL: See current connections
SELECT count(*) FROM pg_stat_activity;
```

## 🔍 Debugging

### View Active Connections

```sql
-- PostgreSQL
SELECT
  datname as database,
  count(*) as connections,
  usename as user
FROM pg_stat_activity
GROUP BY datname, usename
ORDER BY connections DESC;
```

### Find Long-Running Queries

```sql
-- PostgreSQL
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - pg_stat_activity.query_start > interval '5 seconds'
ORDER BY duration DESC;
```

### Kill Idle Connections

```sql
-- PostgreSQL (use with caution!)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND now() - state_change > interval '5 minutes';
```

## 📚 References

- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [PostgreSQL Connection Pooling](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [PgBouncer Documentation](https://www.pgbouncer.org/)
- [AWS RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html)

## 🎉 Summary

**Current Configuration:**

- ✅ Slow query detection (>100ms)
- ✅ Query logging in development
- ✅ Connection pool monitoring
- ✅ Health check utilities
- ✅ Graceful shutdown support
- ✅ Production-ready defaults

**Key Takeaways:**

1. Set `connection_limit` based on traffic and server capacity
2. Always use SSL in production (`sslmode=require`)
3. Monitor slow queries and optimize
4. Use external pooler (PgBouncer) for high-traffic apps
5. Test connection pool under load before deploying

**Quick Start:**

1. Copy `.env.example` to `.env`
2. Set appropriate `connection_limit` (start with 10)
3. Enable SSL for production
4. Monitor `getDatabaseStats()` for performance
5. Adjust based on actual usage patterns
