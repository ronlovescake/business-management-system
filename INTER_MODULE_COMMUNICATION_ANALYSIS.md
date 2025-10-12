# 🔄 Inter-Module Communication Analysis

## 📊 Current Sync Implementation

### **Summary: You Already Have Cross-Module Sync Working!** ✅

Your current implementation uses **React Query** for automatic cache invalidation and **manual sync logic** in the Transactions module. Here's what's already working:

---

## 🎯 Current Sync Mechanisms

### 1. **React Query Cache Invalidation** (Global Sync)

**Location:** `src/hooks/useSheetData.ts`

**How It Works:**

```typescript
// When shipments are updated:
const bulkUpdateMutation = useMutation({
  mutationFn: (newData: ShipmentDTO[]) => ShipmentService.bulkUpdate(newData),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipments'] }),
});

// This automatically refetches shipments in ALL components using useShipmentData()
```

**What Syncs:**

- ✅ **Customers** → All pages using `useCustomerData()` automatically refresh
- ✅ **Products** → All pages using `useProductData()` automatically refresh
- ✅ **Transactions** → All pages using `useTransactionData()` automatically refresh
- ✅ **Shipments** → All pages using `useShipmentData()` automatically refresh
- ✅ **Prices** → All pages using `usePriceData()` automatically refresh

**Benefits:**

- Automatic invalidation on mutations
- No manual event bus needed
- Works across all open tabs/windows (within 5 min stale time)
- Optimistic updates with rollback on error

---

### 2. **Manual Cross-Module Sync** (Transactions → Shipments)

**Location:** `src/modules/clothing/operations/transactions/hooks/useTransactionsData.ts`

**How It Works:**

```typescript
// Load product→shipment mappings
useEffect(() => {
  const loadProductMappings = async () => {
    const [productsResponse, shipmentsResponse] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/shipments'),
    ]);

    // Create mappings
    const productToShipmentMap = {
      /* Product Code → Shipment Code */
    };
    const productToShipmentStatusMap = {
      /* Product Code → Shipment Status */
    };
  };
}, []);

// Auto-sync transactions when shipment status changes
useEffect(() => {
  if (Object.keys(productToShipmentStatusMap).length > 0) {
    syncTransactionsWithShipmentStatus(productToShipmentStatusMap);
  }
}, [productToShipmentStatusMap, transactions.length]);
```

**What It Does:**

1. Fetches **Products** and **Shipments** data
2. Creates **Product Code → Shipment Code** mapping
3. Creates **Product Code → Shipment Status** mapping
4. Automatically updates Transaction's **Order Status** based on Shipment Status:
   - Shipment = "In Transit" → Transaction = "In Transit"
   - Shipment = "Warehouse" → Transaction = "Warehouse"
   - Only updates if current status is empty, "In Transit", or "Warehouse"
   - Preserves manual status changes (Prepared, Cancelled, etc.)

**Sync Rules:**

```typescript
// TransactionService.syncTransactionsWithShipmentStatus()
const shouldAutoPopulateStatus =
  currentOrderStatus === '' ||
  currentOrderStatus.toLowerCase() === 'in transit' ||
  currentOrderStatus.toLowerCase() === 'warehouse';
```

---

## 🔍 Current Sync Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SHIPMENTS PAGE                            │
│  User updates: "Shipment Status" = "PH Warehouse"          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
         ┌──────────────────────────┐
         │  ShipmentService.update  │
         └──────────┬───────────────┘
                    │
                    ↓
       ┌────────────────────────────┐
       │  React Query Mutation      │
       │  onSuccess: invalidate     │
       │  queryKey: ['shipments']   │
       └──────────┬─────────────────┘
                  │
                  ↓
    ┌────────────────────────────────┐
    │  ALL components using          │
    │  useShipmentData() refetch     │
    └────────┬───────────────────────┘
             │
             ↓
┌────────────────────────────────────┐
│   TRANSACTIONS PAGE (automatically) │
│   1. useTransactionsData.ts runs   │
│   2. Detects shipment status change│
│   3. Syncs Order Status            │
│   4. Updates transactions          │
└────────────────────────────────────┘
```

---

## 🆚 Current Approach vs. Inter-Module Communication

### Current Approach (React Query + Manual Sync)

**Pros:**

- ✅ Already implemented and working
- ✅ Uses industry-standard React Query
- ✅ Automatic cache invalidation
- ✅ Optimistic updates built-in
- ✅ Error handling with rollback
- ✅ Works across tabs/windows
- ✅ No additional dependencies
- ✅ Simple to understand and maintain
- ✅ Type-safe (TypeScript)

**Cons:**

- ⚠️ Manual mapping logic in Transactions module
- ⚠️ Fetches related data (products, shipments) in multiple places
- ⚠️ Sync logic is embedded in useTransactionsData hook
- ⚠️ Not easily extensible to new modules
- ⚠️ Tight coupling between Transactions and Shipments

**Current Code Smell:**

```typescript
// In useTransactionsData.ts - this is tightly coupled
useEffect(() => {
  const loadProductMappings = async () => {
    // Manually fetching shipments and products
    const [productsResponse, shipmentsResponse] = await Promise.all([...]);
    // Manual mapping logic
  };
}, []);
```

---

### Event Bus Approach (Inter-Module Communication)

**Pros:**

- ✅ Decoupled modules (loose coupling)
- ✅ Centralized event management
- ✅ Easy to add new listeners
- ✅ Clear intent (event names)
- ✅ Scalable to many modules
- ✅ Can add middleware (logging, analytics)
- ✅ Testable (mock events)

**Cons:**

- ❌ Additional complexity
- ❌ New abstraction to learn
- ❌ Potential for "event spaghetti"
- ❌ Harder to trace data flow
- ❌ Need to maintain event types
- ❌ React Query already provides most benefits

**Example Implementation:**

```typescript
// Event Bus
eventBus.emit('shipment.updated', { shipmentCode, status });

// In TransactionsModule
eventBus.on('shipment.updated', (data) => {
  syncTransactionStatus(data);
});

// In ProductsModule
eventBus.on('shipment.updated', (data) => {
  updateProductShipmentInfo(data);
});
```

---

## 📈 Advantages of Inter-Module Communication

### 1. **Decoupling** ⭐⭐⭐⭐⭐

**Current:**

```typescript
// Transactions module directly fetches shipments
const shipmentsResponse = await fetch('/api/shipments');
```

**With Event Bus:**

```typescript
// Shipments module emits event when updated
eventBus.emit('shipment.statusChanged', { productCode, status });

// Transactions module listens
eventBus.on('shipment.statusChanged', handleShipmentUpdate);
```

**Benefit:** Transactions doesn't need to know about Shipments API

---

### 2. **Multiple Listeners** ⭐⭐⭐⭐

**Current:**

- Only Transactions module reacts to shipment changes
- Would need duplicate code for other modules

**With Event Bus:**

```typescript
// Multiple modules can listen to same event
eventBus.on('shipment.statusChanged', (data) => {
  // In Transactions
  syncOrderStatus(data);
});

eventBus.on('shipment.statusChanged', (data) => {
  // In Products
  updateShipmentInfo(data);
});

eventBus.on('shipment.statusChanged', (data) => {
  // In Dashboard
  refreshStatistics();
});
```

**Benefit:** One event → many reactions

---

### 3. **Event History & Debugging** ⭐⭐⭐

**With Event Bus:**

```typescript
// Add logging middleware
eventBus.use((event, data) => {
  console.log(`[Event] ${event}`, data);
  logToAnalytics(event, data);
});

// Add event replay for debugging
eventBus.replay(); // Replay last 10 events
```

**Benefit:** Better observability and debugging

---

### 4. **Undo/Redo Support** ⭐⭐⭐

**With Event Bus:**

```typescript
// Store event history
const eventHistory = [];

eventBus.on('*', (event, data) => {
  eventHistory.push({ event, data, timestamp: Date.now() });
});

// Undo last action
function undo() {
  const lastEvent = eventHistory.pop();
  eventBus.emit(`${lastEvent.event}.undo`, lastEvent.data);
}
```

**Benefit:** Time-travel debugging and user-facing undo

---

### 5. **Cross-Tab Communication** ⭐⭐⭐⭐

**With Event Bus + BroadcastChannel:**

```typescript
// User updates in Tab 1
eventBus.emit('customer.updated', customerData);

// Tab 2, Tab 3, Tab 4 all receive update
// All customer lists refresh automatically
```

**Benefit:** Real-time sync across browser tabs

---

### 6. **Extensibility** ⭐⭐⭐⭐⭐

**Current:**

- Adding new sync requires modifying existing modules
- Hard to add new relationships

**With Event Bus:**

```typescript
// Easy to add new modules without touching existing code
// Just register new listeners

// New Inventory Module
eventBus.on('shipment.delivered', (data) => {
  updateInventoryStock(data);
});

// New Notifications Module
eventBus.on('shipment.delivered', (data) => {
  showNotification('Shipment delivered!');
});
```

**Benefit:** Open-closed principle (open for extension, closed for modification)

---

## 🎯 Recommendation

### **Keep Current Approach for Now** ✅

**Reasons:**

1. **It's Already Working:** Your React Query setup is solid
2. **Simple & Maintainable:** Easy to understand and debug
3. **Industry Standard:** React Query is battle-tested
4. **Low Overhead:** No additional abstraction needed
5. **Current Scope:** You only have 1 cross-module dependency (Transactions ↔ Shipments)

### **When to Add Event Bus:** 🔮

Consider adding inter-module communication when:

- **5+ modules** need to react to same event
- **Complex workflows** span multiple modules
- **Cross-tab sync** is required
- **Event history/replay** is needed for debugging
- **Undo/redo** functionality is required
- **Plugin system** needs to listen to core events (you already have Module Marketplace!)

---

## 🚀 Hybrid Approach (Best of Both Worlds)

### **Proposal: Enhance Current Setup**

Keep React Query for data sync, but add lightweight event system for **business logic coordination**:

```typescript
// src/core/EventBus.ts
type EventCallback = (data: unknown) => void;

class EventBus {
  private events = new Map<string, Set<EventCallback>>();

  on(event: string, callback: EventCallback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback) {
    this.events.get(event)?.delete(callback);
  }

  emit(event: string, data?: unknown) {
    this.events.get(event)?.forEach((cb) => cb(data));
  }
}

export const eventBus = new EventBus();
```

**Usage:**

```typescript
// In ShipmentsModule
import { eventBus } from '@/core/EventBus';

const updateShipment = async (data) => {
  await ShipmentService.update(data);

  // Emit event AFTER successful update
  eventBus.emit('shipment.statusChanged', {
    shipmentCode: data.shipmentCode,
    status: data.status,
    products: affectedProducts,
  });
};

// In TransactionsModule
useEffect(() => {
  const handleShipmentUpdate = (data) => {
    // React Query will handle data refresh
    // This just triggers business logic
    console.log('Shipment updated:', data);
  };

  eventBus.on('shipment.statusChanged', handleShipmentUpdate);

  return () => {
    eventBus.off('shipment.statusChanged', handleShipmentUpdate);
  };
}, []);
```

---

## 📊 Comparison Table

| Feature                         | Current (React Query + Manual) | Event Bus        | Hybrid        |
| ------------------------------- | ------------------------------ | ---------------- | ------------- |
| **Data Sync**                   | ✅ Automatic (React Query)     | ⚠️ Manual        | ✅ Automatic  |
| **Business Logic Coordination** | ⚠️ Manual                      | ✅ Automatic     | ✅ Automatic  |
| **Decoupling**                  | ⚠️ Tight                       | ✅ Loose         | ✅ Loose      |
| **Type Safety**                 | ✅ Full                        | ⚠️ Requires work | ✅ Full       |
| **Complexity**                  | ⭐⭐ Low                       | ⭐⭐⭐⭐ High    | ⭐⭐⭐ Medium |
| **Debugging**                   | ✅ Easy                        | ⚠️ Harder        | ✅ Easy       |
| **Extensibility**               | ⚠️ Limited                     | ✅ Excellent     | ✅ Good       |
| **Cross-Tab Sync**              | ✅ Works                       | ✅ Works         | ✅ Works      |
| **Undo/Redo**                   | ❌ No                          | ✅ Yes           | ✅ Yes        |
| **Event History**               | ❌ No                          | ✅ Yes           | ✅ Yes        |
| **Performance**                 | ✅ Excellent                   | ✅ Good          | ✅ Excellent  |
| **Learning Curve**              | ⭐⭐ Low                       | ⭐⭐⭐⭐ High    | ⭐⭐⭐ Medium |

---

## 🎯 Action Items

### Option 1: Keep Current (Recommended for Now) ✅

**Why:** It works, it's simple, you only have 1 cross-module dependency

**Improvements:**

```typescript
// 1. Extract sync logic to a service
// src/services/SyncService.ts
export class SyncService {
  static async syncTransactionsWithShipments(
    transactions: TransactionData[],
    shipments: ShipmentData[]
  ): Promise<TransactionData[]> {
    // Centralized sync logic
  }
}

// 2. Make it reusable
const { syncedData } = useCrossModuleSync({
  source: 'shipments',
  target: 'transactions',
  syncFn: SyncService.syncTransactionsWithShipments,
});
```

---

### Option 2: Add Event Bus (Future Enhancement) 🔮

**Why:** When you have 5+ modules with complex interactions

**Implementation:**

```typescript
// 1. Create minimal event bus (50 lines)
// src/core/EventBus.ts

// 2. Add events to Module Registry
// Each module can define events it emits/listens to

// 3. Use for Module Marketplace plugin communication
// Perfect fit for dynamic module system!
```

---

### Option 3: Hybrid Approach (Best Long-Term) 🚀

**Why:** Combines benefits of both, minimal overhead

**Plan:**

1. Keep React Query for data sync (already working)
2. Add lightweight EventBus for business logic (50 lines)
3. Use EventBus in Module Marketplace for plugin communication
4. Gradually migrate complex sync logic to events

---

## 💡 My Recommendation

### **Short-term (Now):**

✅ **Keep current approach** - It works great for your current needs

**Quick Improvement:**

```typescript
// Extract sync logic to shared service
// src/services/CrossModuleSyncService.ts
export class CrossModuleSyncService {
  static async syncTransactionsWithShipments() {
    const [products, shipments] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/shipments'),
    ]);
    // Return mappings for any module to use
    return {
      productToShipmentMap,
      productToShipmentStatusMap,
    };
  }
}
```

---

### **Long-term (When you have Module Marketplace):**

🚀 **Add Event Bus** - Perfect for plugin communication

**Why:**

- Plugins need to communicate with core modules
- Plugins shouldn't directly depend on each other
- Event bus is perfect abstraction for plugin ecosystem

**Example:**

```typescript
// Analytics Plugin
eventBus.on('transaction.created', (data) => {
  trackAnalytics('transaction', data);
});

// Inventory Plugin
eventBus.on('shipment.delivered', (data) => {
  updateStock(data);
});

// Notification Plugin
eventBus.on('*', (event, data) => {
  if (shouldNotify(event)) {
    showNotification(event, data);
  }
});
```

---

## 📈 Summary

### **Your Current Setup is GOOD** ✅

You have:

- ✅ React Query for automatic data sync across all modules
- ✅ Optimistic updates with rollback
- ✅ Manual sync logic for Transactions ↔ Shipments
- ✅ Type-safe TypeScript throughout
- ✅ Works reliably in production

### **Event Bus Would Add:**

- ✅ Better decoupling
- ✅ Easier to add new modules
- ✅ Event history for debugging
- ✅ Undo/redo support
- ✅ Perfect for plugin system

### **But...**

- ⚠️ Adds complexity
- ⚠️ More abstraction to learn
- ⚠️ Current approach already works
- ⚠️ Only 1 cross-module dependency now

---

## 🎯 Final Verdict

**Verdict:** **DON'T replace current sync logic** - it's working well!

**Instead:** **Enhance it incrementally:**

1. **Now:** Extract sync logic to `CrossModuleSyncService` for reusability
2. **Phase 3:** Add EventBus for Module Marketplace plugin communication
3. **Phase 4:** Gradually adopt events for complex multi-module workflows
4. **Phase 5:** Full event-driven architecture when you have 10+ modules

**Your React Query setup is already 80% of what an event bus would give you!**

The remaining 20% (business logic coordination) can be added when you actually need it for the Module Marketplace plugin system. 🚀

---

Would you like me to:

1. **Extract sync logic** to a reusable service now? (30 min)
2. **Implement EventBus** for Module Marketplace? (1-2 hours)
3. **Keep as-is** and move to next feature? (0 min)

Let me know! 😊
