# 🚀 Quick Start: Module Marketplace Phase 1

## Required Steps to Activate

### Step 1: Run Database Migration

The Prisma schema has been updated with two new tables. You need to create and apply the migration:

```bash
# Create and apply migration
npx prisma migrate dev --name add_module_marketplace_tables

# This will:
# 1. Create a new migration file in prisma/migrations/
# 2. Apply it to your database
# 3. Regenerate Prisma Client with new types
```

### Step 2: Restart TypeScript Server

In VS Code:

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type: "TypeScript: Restart TS Server"
3. Press Enter

This loads the new Prisma client types so TypeScript recognizes:

- `prisma.installedModule`
- `prisma.moduleMarketplace`

### Step 3: Verify Everything Works

```bash
# Build the project
npm run build

# Or run in development mode
npm run dev
```

---

## 📋 What Was Implemented

### Core Files Created:

1. `src/core/PluginManager.ts` - Plugin management system
2. `src/app/api/marketplace/modules/route.ts` - Marketplace API
3. `src/app/api/modules/config/route.ts` - Module config API
4. `src/app/api/modules/config/[moduleId]/route.ts` - Module config by ID
5. `src/app/api/modules/install/route.ts` - Install module API
6. `src/app/api/modules/uninstall/route.ts` - Uninstall module API
7. `src/app/api/modules/update/route.ts` - Update module API

### Modified Files:

1. `src/core/ModuleRegistry.ts` - Added plugin system types
2. `prisma/schema.prisma` - Added InstalledModule and ModuleMarketplace models

---

## 🧪 Testing the System

### Test API Endpoints:

```bash
# Fetch marketplace modules
curl http://localhost:3000/api/marketplace/modules

# Get installed modules
curl http://localhost:3000/api/modules/config

# Install a module (example)
curl -X POST http://localhost:3000/api/modules/install \
  -H "Content-Type: application/json" \
  -d '{"moduleId": "clothing-inventory", "version": "1.0.0"}'
```

### Test in Code:

```typescript
import { pluginManager } from '@/core/PluginManager';

// In an async function:
await pluginManager.initialize();
const marketplace = await pluginManager.fetchMarketplace();
console.log(`${marketplace.length} modules available`);
```

---

## ⚠️ Known Issues

### Tabler Icons Build Error

You may see this error when building:

```
Cannot get final name for export 'IconCalendarDue'
```

**This is NOT related to Phase 1 implementation.** It's a Next.js barrel optimization issue with Tabler Icons.

**Solutions:**

1. **Temporary:** Run `npm run dev` (development mode still works)
2. **Permanent Fix Option 1:** Add to `next.config.js`:

```js
experimental: {
  optimizePackageImports: ['@tabler/icons-react'],
}
```

3. **Permanent Fix Option 2:** Use direct imports:

```typescript
import { IconSettings } from '@tabler/icons-react/dist/esm/icons/IconSettings';
```

---

## 📖 Full Documentation

See `MODULE_MARKETPLACE_PHASE_1_COMPLETE.md` for:

- Complete feature list
- API documentation
- Usage examples
- Security considerations
- Phase 2 preview

---

## ✅ Success Checklist

- [ ] Database migration applied
- [ ] TypeScript server restarted
- [ ] No TypeScript errors in core files
- [ ] Prisma client recognizes new models
- [ ] API endpoints respond correctly
- [ ] Ready for Phase 2 (Settings UI)

---

## 🆘 Troubleshooting

### "Property 'installedModule' does not exist"

**Solution:** Restart TypeScript server (Step 2 above)

### "Table 'installed_modules' doesn't exist"

**Solution:** Run database migration (Step 1 above)

### Build fails with icon errors

**Solution:** This is a separate issue. Development mode (`npm run dev`) should work fine.

---

## 🎯 Next Phase

Once Phase 1 is working, you can proceed to Phase 2:

- Settings page UI
- Module marketplace browser
- Install/uninstall UI
- Dependency visualization
- Update management UI

**Would you like me to continue with Phase 2?**
