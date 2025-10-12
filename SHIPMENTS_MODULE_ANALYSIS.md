# 📦 SHIPMENTS MODULE - COMPLETE ANALYSIS

## 📊 MODULE OVERVIEW

**File:** `/src/app/clothing/operations/shipments/page.tsx`  
**Current Size:** 1,045 lines  
**Target Size:** ~12 lines (route handler)  
**Expected Reduction:** ~99% (1,033 lines extracted)  
**Module Complexity:** MEDIUM-HIGH

---

## 🏗️ ARCHITECTURE BREAKDOWN

### 1️⃣ **DATA STRUCTURE** (11 Columns)

```typescript
interface ShipmentData {
  id: number;
  'Shipment Code': string; // Primary identifier, double-click editable
  'CV Number': string; // Commercial vehicle number
  'No. Of Sacks': number; // Quantity in sacks
  'Total CBM': number; // Cubic meters (m³)
  Weight: number; // Weight in kg
  Fee: number | string; // Fee in ₱ (Philippine Peso) - needs parsing
  'Shipment Status': string; // 7 possible statuses
  'Date Created': string; // Formatted: "MMM d, yyyy"
  'Date Delivered': string; // Formatted: "MMM d, yyyy"
  Duration: string; // **CALCULATED** - Days between dates
  Notes: string; // Optional text
}
```

**Key Field Notes:**

- `Duration` is **auto-calculated** from Date Created → Date Delivered
- `Fee` requires parsing (remove ₱ symbol and commas)
- Dates stored as formatted strings, input as Date objects
- `Shipment Code` is the primary identifier (column 0)

---

### 2️⃣ **FORM STRUCTURE** (10 Input Fields)

```typescript
interface ShipmentFormData {
  shipmentCode: string; // Required
  cvNumber: string; // Optional
  noOfSacks: number; // Required, min: 0
  totalCBM: number; // Required, min: 0, 2 decimals
  weight: number; // Required, min: 0, 2 decimals
  fee: number; // Required, min: 0, 2 decimals
  shipmentStatus: string; // Required, dropdown
  dateCreated: Date | null; // Required, DateInput
  dateDelivered: Date | null; // Optional, DateInput
  notes: string; // Optional, Textarea (3 rows)
}
```

**Validation Rules:**

- 6 fields are **required**: shipmentCode, noOfSacks, totalCBM, weight, fee, shipmentStatus, dateCreated
- 4 fields are **optional**: cvNumber, dateDelivered, notes
- All numeric fields must be **non-negative**
- Numbers use 2 decimal precision

---

### 3️⃣ **STATISTICS** (11 Metrics)

```typescript
interface ShipmentStatistics {
  // Aggregate Metrics (4)
  totalShipments: number; // Count of filtered data
  totalFees: number; // Sum of fees (parse ₱ symbol)
  totalSacks: number; // Sum of sacks
  totalCBM: number; // Sum of CBM
  totalWeight: number; // Sum of weight

  // Status Counts (6)
  inTransitShipments: number; // Status = "In Transit"
  manilaPortShipments: number; // Status = "Manila Port"
  withPierGatepassShipments: number; // Status = "With Pier Gatepass"
  phWarehouseShipments: number; // Status = "PH Warehouse"
  forPickupShipments: number; // Status = "For Pickup"
  deliveredShipments: number; // Status = "Delivered"
}
```

**Calculation Notes:**

- All statistics are **dynamically calculated** from `filteredData` (search-aware)
- Fee parsing: `parseFloat(feeString.replace(/[₱,]/g, '')) || 0`
- Status filtering uses `.toLowerCase()` for case-insensitive matching
- Statistics are **memoized** with `useMemo` (depends on `filteredData`)

---

### 4️⃣ **STAT CARDS** (11 Cards)

| Card Title         | Value Format     | Icon           | Color  | Background |
| ------------------ | ---------------- | -------------- | ------ | ---------- |
| Total Shipments    | `{count}`        | Package        | blue   | blue-6     |
| Total Fees         | `₱{formatted}`   | CurrencyDollar | purple | #9775fa    |
| Total Sacks        | `{formatted}`    | Package        | orange | #fd7e14    |
| Total CBM          | `{formatted} m³` | Box            | teal   | teal-6     |
| Total Weight       | `{formatted} kg` | Scale          | indigo | indigo-6   |
| In Transit         | `{count}`        | Truck          | yellow | yellow-6   |
| Manila Port        | `{count}`        | Anchor         | blue   | blue-7     |
| With Pier Gatepass | `{count}`        | ClipboardCheck | cyan   | cyan-6     |
| PH Warehouse       | `{count}`        | Building       | lime   | lime-6     |
| For Pickup         | `{count}`        | HandStop       | red    | red-6      |
| Delivered          | `{count}`        | Check          | green  | green-6    |

**Icons Used:**

```typescript
import {
  IconPackage,
  IconCurrencyDollar,
  IconBox,
  IconScale,
  IconTruck,
  IconAnchor,
  IconClipboardCheck,
  IconBuilding,
  IconHandStop,
  IconCheck,
  IconPlus,
  IconCalendar,
} from '@tabler/icons-react';
```

---

### 5️⃣ **SHIPMENT STATUS OPTIONS** (7 Statuses)

```typescript
const SHIPMENT_STATUS_OPTIONS = [
  'In Transit',
  'Manila Port',
  'With Pier Gatepass',
  'PH Warehouse',
  'For Pickup',
  'Sorting', // Integration with Sorting Distribution module
  'Delivered',
];
```

**Status Flow:**

1. In Transit → Manila Port → With Pier Gatepass → PH Warehouse → For Pickup/Sorting → Delivered

---

### 6️⃣ **COLUMN CONFIGURATION**

```typescript
const COLUMN_ALIGNMENTS: Record<string, 'left' | 'center' | 'right'> = {
  shipmentCode: 'left',
  cvNumber: 'left',
  noOfSacks: 'right',
  totalCBM: 'right',
  weight: 'right',
  fee: 'right',
  shipmentStatus: 'center',
  dateCreated: 'center',
  dateDelivered: 'center',
  duration: 'center',
  notes: 'left',
};

const ID_TO_KEY: Record<string, keyof ShipmentData> = {
  shipmentCode: 'Shipment Code',
  cvNumber: 'CV Number',
  noOfSacks: 'No. Of Sacks',
  totalCBM: 'Total CBM',
  weight: 'Weight',
  fee: 'Fee',
  shipmentStatus: 'Shipment Status',
  dateCreated: 'Date Created',
  dateDelivered: 'Date Delivered',
  duration: 'Duration',
  notes: 'Notes',
};

const GRID_COLUMNS: GridColumn[] = [
  { title: 'Shipment Code', width: 200, id: 'shipmentCode' },
  { title: 'CV Number', width: 200, id: 'cvNumber' },
  { title: 'No. Of Sacks', width: 200, id: 'noOfSacks' },
  { title: 'Total CBM', width: 200, id: 'totalCBM' },
  { title: 'Weight', width: 200, id: 'weight' },
  { title: 'Fee', width: 200, id: 'fee' },
  { title: 'Shipment Status', width: 200, id: 'shipmentStatus' },
  { title: 'Date Created', width: 200, id: 'dateCreated' },
  { title: 'Date Delivered', width: 200, id: 'dateDelivered' },
  { title: 'Duration', width: 200, id: 'duration' },
  { title: 'Notes', width: 200, grow: 1, id: 'notes' }, // Last column grows
];
```

---

### 7️⃣ **API INTEGRATION**

#### **GET /api/shipments**

- Fetch all shipments
- Revalidation: 30 seconds
- Returns: `ShipmentData[]`

#### **POST /api/shipments**

- Create new shipment (single)
- Bulk import (array of shipments from CSV)
- Request: `ShipmentData | ShipmentData[]`
- Response: `ShipmentData | ShipmentData[]`
- Cache: `no-store` (bypass cache for mutations)

#### **PUT /api/shipments/:id**

- Update existing shipment
- Request: `ShipmentData`
- Response: `ShipmentData`

---

### 8️⃣ **BUSINESS LOGIC**

#### **Duration Calculation**

```typescript
calculateDuration(startDate: Date | null, endDate: Date | null): string {
  if (!startDate || !endDate) return '';
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays.toString(); // Returns string (e.g., "7")
}
```

- Returns empty string if either date is missing
- Always returns **positive** days (uses `Math.abs`)
- Rounds **up** to nearest day (uses `Math.ceil`)

#### **Date Formatting**

```typescript
formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short', // Jan, Feb, Mar, etc.
    day: 'numeric',
  });
}
// Example: "Jan 15, 2024"
```

#### **Fee Parsing (for statistics)**

```typescript
parseFee(feeString: string | number): number {
  const str = feeString.toString().replace(/[₱,]/g, '');
  return parseFloat(str) || 0;
}
// Input: "₱1,234.56" → Output: 1234.56
// Input: 1234.56 → Output: 1234.56
```

---

### 9️⃣ **CSV IMPORT FEATURE**

**Features:**

- Handles quoted CSV fields (commas inside quotes)
- Supports Unix (`\n`) and Windows (`\r\n`) line endings
- Auto-calculates Duration if both dates present
- Bulk saves to API (array of shipments)
- Optimistic UI update (adds to local state)
- Shows success notification with count

**CSV Parsing:**

```typescript
parseCSVLine(line: string): string[] {
  // Handles: "Field with, comma","Normal field",123
  // Returns: ["Field with, comma", "Normal field", "123"]
}
```

**Duration Auto-Calculation in CSV:**

```typescript
calculateDurationFromStrings(dateCreated: string, dateDelivered: string): string {
  // Parse strings → Date objects
  // Calculate difference in days
  // Return as string
}
```

---

### 🔟 **INTERACTION FEATURES**

#### **Double-Click Edit** (Shipment Code Column)

```typescript
// Track last click with useRef
lastClickRef = { cell: Item, time: number } | null

onCellClick(cell, shipment) {
  if (col === 0) { // Shipment Code column
    const now = Date.now();
    if (lastClick && sameCell && (now - lastClick.time < 500ms)) {
      handleEditShipment(shipment); // Double-click detected
      reset lastClickRef;
    } else {
      store click in lastClickRef;
    }
  }
}
```

- Only works on **column 0** (Shipment Code)
- 500ms window for double-click detection
- Opens **Edit Modal** with pre-populated form

#### **Search Functionality**

- Search fields: `['Shipment Code', 'CV Number', 'Shipment Status', 'Notes']`
- Uses `useDataTable` hook
- Updates statistics dynamically based on filtered data

---

### 1️⃣1️⃣ **PERFORMANCE OPTIMIZATIONS**

```typescript
// 1. Memoized columns (never change)
const columns = useMemo(() => [...], []);

// 2. Memoized statistics (only recalc on filter change)
const stats = useMemo(() => calculateStatistics(filteredData), [filteredData]);

// 3. Optimistic updates (no full reload)
// After add:
setShipments(prev => [...prev, newShipment]);

// After edit:
setShipments(prev => prev.map(s => s.id === id ? updated : s));

// After CSV import:
setShipments(prev => [...prev, ...imported]);

// 4. API revalidation: 30 seconds
fetch('/api/shipments', { next: { revalidate: 30 } });
```

---

## 📁 MODULE STRUCTURE (Target)

```
/modules/clothing/operations/shipments/
├── types/
│   └── shipment.types.ts          (~300 lines)
│       - ShipmentData interface
│       - ShipmentFormData interface
│       - ShipmentStatistics interface
│       - ValidationResult interface
│       - Constants: COLUMN_ALIGNMENTS, ID_TO_KEY, SHIPMENT_STATUS_OPTIONS, GRID_COLUMNS
│       - API request/response types
│
├── services/
│   └── ShipmentService.ts         (~450 lines)
│       - validateShipment()
│       - calculateDuration()
│       - calculateStatistics()
│       - loadShipments()
│       - addShipment()
│       - updateShipment()
│       - parseCSVLine()
│       - calculateDurationFromStrings()
│       - formatDateForDisplay()
│       - parseFee()
│
├── hooks/
│   ├── useShipmentsData.ts        (~280 lines)
│   │   - Data fetching (useEffect on mount)
│   │   - CRUD operations (add, update)
│   │   - CSV import handler
│   │   - Memoized statistics
│   │   - Loading states
│   │
│   └── useShipmentForm.ts         (~120 lines)
│       - Add modal state
│       - Edit modal state
│       - Form instances (add/edit)
│       - Double-click tracking (useRef)
│       - Form submission handlers
│
├── components/
│   ├── ShipmentStatsCards.tsx     (~140 lines)
│   │   - 11 stat cards with icons
│   │   - Dynamic value formatting
│   │   - Responsive grid layout
│   │
│   ├── AddShipmentModal.tsx       (~160 lines)
│   │   - 10-field form
│   │   - Validation integration
│   │   - Date inputs with icons
│   │   - Grouped layout
│   │
│   ├── EditShipmentModal.tsx      (~160 lines)
│   │   - Same as AddShipmentModal
│   │   - Pre-populated with existing data
│   │   - Different submit handler
│   │
│   └── ShipmentsPage.tsx          (~380 lines)
│       - Main orchestration component
│       - 11-column grid
│       - Double-click handler
│       - CSV import integration
│       - DataTable wrapper
│       - Modal management
│
├── module.config.ts                (~30 lines)
│   - id: 'clothing-operations-shipments'
│   - name: 'Shipments'
│   - icon: IconAnchor (cast properly)
│   - order: 6
│   - version: '1.0.0'
│   - enabled: true
│
├── index.ts                        (~60 lines)
│   - Export all components
│   - Export all hooks
│   - Export all services
│   - Export all types
│   - Export constants
│
└── page.tsx (route)                (~12 lines)
    - Simple import + export
    - Comprehensive documentation
```

**Total Module Lines:** ~2,092 lines (organized, modular)  
**Route Handler:** ~12 lines  
**Reduction:** 1,045 → 12 (98.9%)

---

## 🎯 KEY FEATURES TO PRESERVE

### ✅ **Data Display** (11 columns)

- [x] All 11 columns display correctly
- [x] Column alignments (left/center/right)
- [x] Last column (Notes) grows to fill space
- [x] Duration auto-calculated from dates

### ✅ **Statistics** (11 metrics)

- [x] Total Shipments (count)
- [x] Total Fees (sum, formatted with ₱)
- [x] Total Sacks (sum)
- [x] Total CBM (sum with m³)
- [x] Total Weight (sum with kg)
- [x] 6 status-specific counts
- [x] Dynamic calculation from filtered data

### ✅ **CRUD Operations**

- [x] Add new shipment (modal form, 10 fields)
- [x] Edit existing shipment (double-click Shipment Code)
- [x] CSV bulk import (with duration auto-calc)
- [x] Optimistic UI updates (no full reload)

### ✅ **Form Validation**

- [x] 6 required fields
- [x] Numeric fields: non-negative, 2 decimals
- [x] Date Created always required
- [x] Date Delivered optional
- [x] Clear error messages

### ✅ **Interactions**

- [x] Double-click edit (Shipment Code column only)
- [x] 500ms window for double-click detection
- [x] Search across 4 fields
- [x] CSV file upload

### ✅ **Date Handling**

- [x] Date inputs (Mantine DateInput with calendar icon)
- [x] Date formatting: "MMM d, yyyy"
- [x] Duration calculation: days between dates
- [x] CSV date parsing and validation

### ✅ **Performance**

- [x] Memoized columns
- [x] Memoized statistics
- [x] Optimistic updates
- [x] 30s API revalidation

### ✅ **User Feedback**

- [x] Loading state
- [x] Success notifications (add, edit, CSV import)
- [x] Error notifications (API failures)
- [x] Import count display
- [x] Footer: "Showing X of Y shipments"

---

## 🔧 SERVICE LAYER METHODS

### **ShipmentService.ts** (14 methods)

1. **validateShipment(data: ShipmentFormData): ValidationResult**
   - Validate all 6 required fields
   - Validate non-negative numbers
   - Return detailed error messages

2. **calculateDuration(start: Date | null, end: Date | null): string**
   - Return empty string if either date missing
   - Calculate difference in days (rounded up)
   - Always positive (use Math.abs)

3. **calculateDurationFromStrings(start: string, end: string): string**
   - Parse string dates to Date objects
   - Validate dates are valid
   - Call calculateDuration()

4. **formatDateForDisplay(date: Date): string**
   - Format: "MMM d, yyyy"
   - Example: "Jan 15, 2024"

5. **parseFee(fee: string | number): number**
   - Remove ₱ symbol and commas
   - Parse to float
   - Default to 0 on error

6. **calculateStatistics(shipments: ShipmentData[]): ShipmentStatistics**
   - Calculate all 11 metrics
   - Handle fee parsing
   - Case-insensitive status matching

7. **loadShipments(): Promise<ShipmentData[]>**
   - Fetch from /api/shipments
   - Revalidate: 30s
   - Error handling

8. **addShipment(data: ShipmentFormData): Promise<ShipmentData>**
   - Format dates for API
   - Calculate duration
   - POST to /api/shipments

9. **updateShipment(id: number, data: ShipmentFormData): Promise<ShipmentData>**
   - Format dates for API
   - Calculate duration
   - PUT to /api/shipments/:id

10. **parseCSVLine(line: string): string[]**
    - Handle quoted fields with commas
    - Trim whitespace
    - Return array of values

11. **parseCSVFile(file: File): Promise<ShipmentData[]>**
    - Read file as text
    - Split by line endings (Unix/Windows)
    - Parse headers and rows
    - Auto-calculate duration

12. **bulkImportShipments(shipments: ShipmentData[]): Promise<ShipmentData[]>**
    - POST array to /api/shipments
    - Cache: no-store
    - Return created shipments

13. **searchShipments(shipments: ShipmentData[], query: string): ShipmentData[]**
    - Search: Shipment Code, CV Number, Shipment Status, Notes
    - Case-insensitive
    - Return filtered array

14. **createShipmentFromForm(formData: ShipmentFormData): ShipmentData**
    - Convert form data to ShipmentData
    - Format dates
    - Calculate duration
    - Generate temporary ID

---

## 🪝 HOOKS LAYER

### **useShipmentsData.ts**

**State:**

```typescript
const [shipments, setShipments] = useState<ShipmentData[]>([]);
const [loading, setLoading] = useState(true);
const [csvFile, setCsvFile] = useState<File | null>(null);
```

**Effects:**

- Load shipments on mount (with error handling)

**Memoized Values:**

```typescript
const statistics = useMemo(
  () => ShipmentService.calculateStatistics(filteredData),
  [filteredData]
);
```

**Methods:**

- `loadShipments()` - Fetch from API
- `addShipment(data)` - Create + optimistic update
- `updateShipment(id, data)` - Update + optimistic update
- `handleCSVImport(file)` - Parse + bulk import + optimistic update
- `handleSearch(query)` - Filter shipments

**Returns:**

```typescript
{
  shipments,
  loading,
  statistics,
  csvFile,
  setCsvFile,
  addShipment,
  updateShipment,
  handleCSVImport,
  handleSearch,
  filteredData,
  searchQuery,
}
```

### **useShipmentForm.ts**

**State:**

```typescript
const [addModalOpened, setAddModalOpened] = useState(false);
const [editModalOpened, setEditModalOpened] = useState(false);
const [editingShipment, setEditingShipment] = useState<ShipmentData | null>(
  null
);
const lastClickRef = useRef<{ cell: Item; time: number } | null>(null);
```

**Form Instances:**

```typescript
const addShipmentForm = useForm({ ... });
const editShipmentForm = useForm({ ... });
```

**Methods:**

- `handleAddShipment()` - Open add modal + reset form
- `handleEditShipment(shipment)` - Open edit modal + pre-populate form
- `handleCellClick(cell, shipment)` - Double-click detection (500ms window)
- `handleSubmitAdd(values)` - Submit new shipment
- `handleSubmitEdit(values)` - Submit updated shipment

**Returns:**

```typescript
{
  addModalOpened,
  editModalOpened,
  editingShipment,
  addShipmentForm,
  editShipmentForm,
  handleAddShipment,
  handleEditShipment,
  handleCellClick,
  handleSubmitAdd,
  handleSubmitEdit,
  closeAddModal,
  closeEditModal,
}
```

---

## 🎨 COMPONENTS LAYER

### **ShipmentStatsCards.tsx** (~140 lines)

- Props: `statistics: ShipmentStatistics`
- Render 11 StatCard components
- Responsive Grid layout (4 columns on desktop)
- Icons from @tabler/icons-react

### **AddShipmentModal.tsx** (~160 lines)

- Props: `opened, onClose, form, onSubmit`
- 10-field form in groups
- Validation integration
- Date inputs with calendar icons
- Submit button with IconPlus

### **EditShipmentModal.tsx** (~160 lines)

- Props: `opened, onClose, form, onSubmit, shipment`
- Same layout as AddShipmentModal
- Pre-populated with shipment data
- Submit button with IconCheck

### **ShipmentsPage.tsx** (~380 lines)

- Main orchestration component
- Integrates useShipmentsData + useShipmentForm
- Renders DataTable with 11 columns
- CSV import integration
- Double-click handler
- Modal management
- Loading state
- Footer with count

---

## 🚀 IMPLEMENTATION PLAN

### **Phase 2: Directory Structure** (15 min)

- Create `/modules/clothing/operations/shipments/` directory
- Create subdirectories: types, services, hooks, components
- Backup original file: `page.tsx.backup`

### **Phase 3: Types Layer** (20 min)

- Create `shipment.types.ts` with all interfaces
- Define constants (COLUMN_ALIGNMENTS, ID_TO_KEY, etc.)
- Validate: 0 TypeScript errors

### **Phase 4: Service Layer** (35 min)

- Create `ShipmentService.ts` with 14 methods
- Implement all business logic
- Validate: 0 TypeScript errors, 0 ESLint warnings

### **Phase 5: Hooks Layer** (30 min)

- Create `useShipmentsData.ts` (data management)
- Create `useShipmentForm.ts` (form management)
- Validate: 0 errors

### **Phase 6: Components** (45 min)

- Create `ShipmentStatsCards.tsx` (11 cards)
- Create `AddShipmentModal.tsx` (10 fields)
- Create `EditShipmentModal.tsx` (10 fields, pre-populated)
- Create `ShipmentsPage.tsx` (orchestration)
- Validate: 0 errors

### **Phase 7: Module Registration** (10 min)

- Create `module.config.ts` (icon: IconAnchor, order: 6)
- Create `index.ts` (public API)
- Validate: 0 errors

### **Phase 8: Update Route Handler** (10 min)

- Update `page.tsx` (1,045 → ~12 lines)
- Add documentation
- Validate: 0 errors

### **Phase 9: Final Validation** (25 min)

- TypeScript check (0 errors)
- ESLint check (0 warnings)
- Line count verification (~99% reduction)
- Feature checklist validation
- Create summary document

**Total Estimated Time:** ~3 hours

---

## 📊 SUCCESS CRITERIA

- ✅ TypeScript: **0 errors** (strict mode)
- ✅ ESLint: **0 warnings**
- ✅ Line Reduction: **~99%** (1,045 → ~12)
- ✅ All 11 columns functional
- ✅ All 11 stat cards display correctly
- ✅ CRUD operations working (add, edit, CSV import)
- ✅ Double-click edit functional
- ✅ Duration auto-calculation working
- ✅ Date formatting correct
- ✅ Fee parsing accurate
- ✅ Search functional (4 fields)
- ✅ Optimistic updates working
- ✅ No workarounds used
- ✅ Pattern consistency with 5 previous modules

---

## 📈 EXPECTED CUMULATIVE RESULTS

**After Shipments Module Completion:**

| Module               | Original   | New      | Reduction  | Errors   |
| -------------------- | ---------- | -------- | ---------- | -------- |
| Dashboard            | 1,850      | 11       | 99.4%      | 0 ✅     |
| Customers            | 2,180      | 12       | 99.4%      | 0 ✅     |
| Prices               | 1,679      | 11       | 99.3%      | 0 ✅     |
| Products             | 2,763      | 41       | 98.5%      | 0 ✅     |
| Sorting Distribution | 1,156      | 44       | 96.2%      | 0 ✅     |
| **Shipments**        | **1,045**  | **~12**  | **~98.9%** | **0 ✅** |
| **TOTALS**           | **10,673** | **~131** | **~98.8%** | **0 ✅** |

---

## 🎯 PHASE 1 STATUS: ✅ COMPLETE

**Analysis Complete!** Ready to proceed to Phase 2: Directory Structure.

---

**Generated:** $(date)  
**Analyst:** GitHub Copilot  
**Next Action:** Create directory structure and backup original file
