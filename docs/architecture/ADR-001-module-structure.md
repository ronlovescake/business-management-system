# ADR-001: Module Structure and Organization

**Status**: Accepted

**Date**: 2025-10-26

---

## Context

The application has grown to include multiple workspaces (Employees, Operations) with numerous features. We need a consistent, scalable module structure that:

1. Promotes separation of concerns
2. Makes modules easily discoverable
3. Allows parallel development
4. Facilitates testing
5. Enables code reuse

Previous structure had:

- API routes scattered in `/app/api/`
- Services mixed with components
- Inconsistent file organization
- Difficult to understand module boundaries

---

## Decision

We will adopt a **domain-driven module structure** with the following organization:

```
src/modules/clothing/{workspace}/{feature}/
├── api/
│   ├── route.ts          # Next.js API route
│   └── schemas.ts        # Zod validation schemas
├── services/
│   ├── index.ts          # Business logic layer
│   └── repository.ts     # Data access layer
├── components/           # React components (if needed)
├── hooks/                # Custom React hooks
├── types/                # TypeScript types
├── utils/                # Module-specific utilities
├── __tests__/
│   ├── service.test.ts           # Unit tests
│   └── api.integration.test.ts   # Integration tests
└── index.ts              # Public API (barrel exports)
```

### Key Principles:

1. **Colocation**: Keep related code together
2. **Clear Layers**: API → Service → Repository → Database
3. **Single Responsibility**: Each folder has one purpose
4. **Testability**: Tests live alongside code
5. **Encapsulation**: Only expose what's needed via `index.ts`

---

## Consequences

### Positive

✅ **Modularity**: Each feature is self-contained  
✅ **Discoverability**: Easy to find related code  
✅ **Testability**: Tests are co-located with implementation  
✅ **Scalability**: New modules follow the same pattern  
✅ **Team Collaboration**: Clear ownership boundaries  
✅ **Reusability**: Modules can be extracted or replicated

### Negative

⚠️ **Migration Effort**: Existing modules need refactoring  
⚠️ **Initial Setup**: More files to create per module  
⚠️ **Learning Curve**: Team needs to understand the structure

### Mitigations

- Created module generator CLI: `npm run generate:module`
- Documented migration guide
- Automated tooling for scaffolding

---

## Examples

### Good Example: thirteenth-month-pay module

```
thirteenth-month-pay/
├── api/
│   ├── route.ts          # ✅ Clean API handlers
│   └── index.ts          # ✅ Exports service + schemas
├── services/
│   ├── index.ts          # ✅ Business logic
│   └── repository.ts     # ✅ Data access
└── types/
    └── index.ts          # ✅ TypeScript types
```

### Anti-pattern (to avoid):

```
❌ app/api/some-feature/route.ts  # API not in module
❌ services/feature-service.ts    # Global services folder
❌ utils/feature-utils.ts         # Scattered utilities
```

---

## Related

- [ADR-002: Repository Pattern](./ADR-002-repository-pattern.md)
- [Module Framework Guide](../MODULE_FRAMEWORK.md)

---

## Notes

This decision was made to bring the codebase from **9/10 to 10/10 modularity**. The module generator automates adoption, making it easy to maintain consistency.
