# 🏗️ Module Marketplace Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE (Phase 2)                        │
│                     /clothing/operations/settings                       │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐│
│  │ Marketplace  │  │  Installed   │  │   Updates    │  │Dependencies ││
│  │   Browser    │  │   Modules    │  │  Available   │  │    Tree     ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘│
│         │                  │                  │                  │      │
└─────────┼──────────────────┼──────────────────┼──────────────────┼──────┘
          │                  │                  │                  │
          ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        API LAYER (Phase 1) ✅                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ GET  /api/marketplace/modules                                   │   │
│  │      - Fetch all published modules                              │   │
│  │      - Search & filter capabilities                             │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ POST /api/modules/install                                       │   │
│  │      - Install module with dependencies                         │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ POST /api/modules/uninstall                                     │   │
│  │      - Safe uninstall with dependency check                     │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ POST /api/modules/update                                        │   │
│  │      - Update to latest version                                 │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ GET/POST/DELETE /api/modules/config                             │   │
│  │      - Manage module configurations                             │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PLUGIN MANAGER (Phase 1) ✅                          │
│                  src/core/PluginManager.ts                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Core Operations:                                                │  │
│  │  ✅ initialize()           - Load installed modules              │  │
│  │  ✅ fetchMarketplace()     - Get available modules               │  │
│  │  ✅ searchMarketplace()    - Search modules                      │  │
│  │  ✅ installModule()        - Install with deps                   │  │
│  │  ✅ uninstallModule()      - Safe uninstall                      │  │
│  │  ✅ updateModule()         - Update to latest                    │  │
│  │  ✅ getAvailableUpdates()  - Check updates                       │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Safety Features:                                                │  │
│  │  ✅ Dependency validation                                        │  │
│  │  ✅ Conflict detection                                           │  │
│  │  ✅ Module validation                                            │  │
│  │  ✅ Version format checking                                      │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Error Handling:                                                 │  │
│  │  ✅ PluginError         - Base error class                       │  │
│  │  ✅ DependencyError     - Dependency issues                      │  │
│  │  ✅ ValidationError     - Invalid configuration                  │  │
│  │  ✅ DownloadError       - Download failures                      │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ MODULE REGISTRY  │ │   DATABASE       │ │  MODULE STORE    │
│     (Phase 1)    │ │   (Phase 1)      │ │    (Future)      │
├──────────────────┤ ├──────────────────┤ ├──────────────────┤
│                  │ │                  │ │                  │
│ ✅ ModuleConfig  │ │ ✅ InstalledModule│ │ • Download       │
│ ✅ ModulePackage │ │ ✅ ModuleMarketpl│ │ • Extract        │
│ ✅ Routes        │ │                  │ │ • Verify         │
│ ✅ Navigation    │ │ Tables:          │ │ • Load           │
│ ✅ Dependencies  │ │ - id             │ │                  │
│                  │ │ - moduleId       │ │                  │
│ Functions:       │ │ - name           │ │                  │
│ • register()     │ │ - version        │ │                  │
│ • unregister()   │ │ - enabled        │ │                  │
│ • getAll()       │ │ - source         │ │                  │
│ • getEnabled()   │ │ - config (JSON)  │ │                  │
│ • setEnabled()   │ │ - downloads      │ │                  │
│                  │ │ - rating         │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

## 🔄 Data Flow

### Installing a Module:

```
User UI → POST /api/modules/install
           ↓
       PluginManager.installModule()
           ↓
       1. Validate module configuration
           ↓
       2. Check & install dependencies
           ↓
       3. Download module (if remote)
           ↓
       4. Register in ModuleRegistry
           ↓
       5. Save to Database (InstalledModule)
           ↓
       6. Add to installed modules Map
           ↓
       Success Response → User UI
```

### Uninstalling a Module:

```
User UI → POST /api/modules/uninstall
           ↓
       PluginManager.uninstallModule()
           ↓
       1. Check if module exists
           ↓
       2. Find dependent modules
           ↓
       3. If dependents exist → Error
           ↓
       4. Unregister from ModuleRegistry
           ↓
       5. Delete from Database
           ↓
       6. Remove from installed Map
           ↓
       Success Response → User UI
```

### Fetching Marketplace:

```
User UI → GET /api/marketplace/modules
           ↓
       Database Query (ModuleMarketplace)
           ↓
       Apply filters (search, category)
           ↓
       Sort results (downloads, rating)
           ↓
       Transform to ModuleManifest
           ↓
       Return JSON → Cache in PluginManager
           ↓
       Display in UI
```

## 🧩 Module Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    MODULE LIFECYCLE                         │
└─────────────────────────────────────────────────────────────┘

1. DISCOVERY
   └─> Search marketplace
       └─> Find by name, tags, description

2. VALIDATION
   └─> Check version format
       └─> Validate dependencies
           └─> Check for conflicts

3. INSTALLATION
   └─> Install dependencies first
       └─> Download bundle (if remote)
           └─> Register in ModuleRegistry
               └─> Save to database
                   └─> Mark as installed

4. ACTIVATION
   └─> Module enabled by default
       └─> Routes added to router
           └─> Navigation items visible
               └─> Ready to use

5. UPDATE
   └─> Check for new version
       └─> Uninstall old version
           └─> Install new version
               └─> Preserve configuration

6. DEACTIVATION (optional)
   └─> Set enabled = false
       └─> Routes hidden
           └─> Navigation removed
               └─> Still installed

7. UNINSTALLATION
   └─> Check for dependents
       └─> Unregister from ModuleRegistry
           └─> Remove from database
               └─> Cleanup files
```

## 📊 Type System Hierarchy

```
ModuleConfig (Base)
  ├─ id: string
  ├─ name: string
  ├─ version: string
  ├─ enabled: boolean
  ├─ dependencies?: string[]
  ├─ routes?: ModuleRoute[]
  ├─ navigation?: ModuleNavigation[]
  ├─ permissions?: string[]
  └─ metadata?: { ... }

       ⬇ extends

ModulePackage (Plugin System)
  ├─ All ModuleConfig fields
  ├─ source?: ModuleSource
  ├─ downloadUrl?: string
  ├─ installPath?: string
  ├─ size?: number
  ├─ downloads?: number
  ├─ rating?: number
  ├─ screenshots?: string[]
  ├─ repository?: string
  ├─ license?: string
  ├─ author?: ModuleAuthor
  ├─ keywords?: string[]
  ├─ peerDependencies?: Record<string, string>
  └─ bundledDependencies?: string[]
```

## 🔐 Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY ARCHITECTURE                     │
└─────────────────────────────────────────────────────────────┘

Layer 1: API Authentication (TODO)
  └─> JWT token validation
      └─> Role-based access control

Layer 2: Input Validation (✅ Implemented)
  └─> Module ID format check
      └─> Version format validation
          └─> Required fields validation

Layer 3: Dependency Validation (✅ Implemented)
  └─> Circular dependency detection
      └─> Missing dependency check
          └─> Version compatibility

Layer 4: Integrity Validation (TODO)
  └─> Checksum verification
      └─> Digital signature validation
          └─> Source verification

Layer 5: Sandboxing (TODO)
  └─> Code isolation
      └─> Resource limits
          └─> Permission boundaries

Layer 6: Audit Logging (TODO)
  └─> Install/uninstall logging
      └─> User action tracking
          └─> Error logging
```

## 📈 Scalability Considerations

```
Current Implementation:
  • In-memory module cache (Map)
  • Database for persistence
  • Single-server architecture

Future Enhancements:
  • Redis cache for module metadata
  • CDN for module downloads
  • Distributed module registry
  • Version rollback capability
  • A/B testing for modules
  • Module analytics dashboard
```

---

## 🎯 Phase 1 Complete ✅

All components are implemented and ready for:

- Database migration
- TypeScript server restart
- Testing
- Phase 2 (UI) development
