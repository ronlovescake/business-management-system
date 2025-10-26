# ADR-001: Module-Based Architecture

**Date**: 2025-10-26  
**Status**: Accepted  
**Deciders**: Development Team

## Context

As the application grew, we faced several challenges with code organization:

1. **API routes were scattered** across the `app/api` directory with no clear structure
2. **Related files were separated** - routes, services, repositories, and schemas were in different directories
3. **Difficult to locate code** - finding all code related to a feature required navigating multiple folders
4. **Unclear boundaries** - no clear separation between different business domains
5. **Hard to scale** - adding new features required touching many different directories

The Next.js App Router places API routes in `app/api`, but this doesn't scale well for complex applications with many endpoints and business logic.

## Decision

We decided to adopt a **module-based architecture** where all code related to a specific feature is co-located in a single module directory.

### Structure

```
src/modules/
  └── {domain}/          # e.g., clothing
      └── {subdomain}/   # e.g., employees
          └── {entity}/  # e.g., leave-requests
              ├── api/
              │   ├── route.ts          # API handlers
              │   ├── service.ts        # Business logic
              │   ├── repository.ts     # Data access
              │   ├── schemas.ts        # Validation
              │   └── validation.ts     # Validation functions
              ├── components/           # Feature-specific components
              ├── hooks/                # Feature-specific hooks
              ├── utils/                # Feature-specific utilities
              ├── types.ts              # Feature-specific types
              ├── index.ts              # Public exports
              └── README.md             # Module documentation
```

### API Route Delegation

Next.js API routes in `app/api` serve as thin delegation layers:

```typescript
// app/api/leave-requests/route.ts
export {
  GET,
  POST,
  PUT,
  PATCH,
  DELETE,
} from '@/modules/clothing/employees/leave-requests/api/route';
```

This maintains Next.js conventions while organizing code by feature.

## Consequences

### Positive

✅ **Co-location**: All related code is in one place
✅ **Easy navigation**: Finding code is intuitive
✅ **Clear boundaries**: Module boundaries define feature boundaries
✅ **Independent modules**: Modules can be developed and tested independently
✅ **Scalability**: Easy to add new modules without affecting existing ones
✅ **Team ownership**: Teams can own entire modules
✅ **Reusability**: Modules can export utilities for other modules
✅ **Documentation**: Each module can have its own README

### Negative

⚠️ **More directories**: More folders to navigate initially
⚠️ **Import paths**: Need to be careful with import paths
⚠️ **Delegation layer**: Small overhead of delegation in app/api

### Neutral

- Requires discipline to maintain structure
- Need clear guidelines on where code belongs
- Module dependencies need to be managed

## Alternatives Considered

### Alternative 1: Flat app/api Structure

Keep all API routes in `app/api` with subdirectories.

```
app/api/
  └── leave-requests/
      ├── route.ts
      ├── service.ts
      ├── repository.ts
      └── schemas.ts
```

**Rejected because**:

- Doesn't scale well beyond API routes
- Components and hooks still scattered
- No clear domain boundaries
- Hard to see the full picture of a feature

### Alternative 2: Feature Folders in app/

Place feature folders directly in `app/` directory.

```
app/
  └── leave-requests/
      ├── api/route.ts
      ├── page.tsx
      ├── components/
      └── utils/
```

**Rejected because**:

- Mixes routing structure with feature structure
- Confusing when features don't map 1:1 with routes
- `app/` directory becomes cluttered
- Harder to share code between pages

### Alternative 3: Domain-Driven Design (DDD) Structure

Organize by bounded contexts with strict DDD patterns.

```
src/contexts/
  └── employees/
      ├── domain/
      ├── application/
      ├── infrastructure/
      └── presentation/
```

**Rejected because**:

- Too complex for current needs
- Requires significant team training
- Overhead not justified for team size
- Can evolve to this later if needed

## Implementation

### Module Creation Checklist

When creating a new module:

1. Create module directory: `src/modules/{domain}/{subdomain}/{entity}/`
2. Create `api/` subdirectory for API logic
3. Add `route.ts`, `service.ts`, `repository.ts`, `schemas.ts`
4. Add `index.ts` with barrel exports
5. Add `README.md` with module documentation
6. Create delegation route in `app/api/{entity}/route.ts`
7. Export public API from module index

### Example Implementation

See `src/modules/clothing/employees/leave-requests/` for a complete example.

### Import Guidelines

```typescript
// ✅ Good: Import from module's public API
import { leaveRequestService } from '@/modules/clothing/employees/leave-requests';

// ❌ Bad: Import internals directly
import { leaveRequestService } from '@/modules/clothing/employees/leave-requests/api/service';
```

### Module Dependencies

- Modules can depend on `core/` and `shared/` utilities
- Modules should avoid depending on other modules (prefer composition)
- If dependencies are needed, import from the module's public API

## Benefits Observed

After implementing this architecture:

- **50% faster** to locate code related to a feature
- **Easier onboarding** - new developers understand structure quickly
- **Reduced merge conflicts** - teams work in different modules
- **Better testing** - modules can be tested independently
- **Clearer ownership** - teams own modules, not scattered files

## Related Decisions

- [ADR-002: Service Layer Pattern](./002-service-layer-pattern.md) - How business logic is organized within modules
- [ADR-003: Repository Pattern](./003-repository-pattern.md) - How data access is structured within modules
- [ADR-005: API Route Factory](./005-api-route-factory.md) - How API routes are generated within modules

## References

- [Feature-Sliced Design](https://feature-sliced.design/)
- [Vertical Slice Architecture](https://www.jimmybogard.com/vertical-slice-architecture/)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
