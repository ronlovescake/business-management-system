# 🚫 IMPORTANT — Keep this repo **clean, minimal, and production-focused**.

---

# 🏗️ Core Foundation
- **React + Next.js + TypeScript (Strict Mode)**
- **Mantine UI** (core component library)
- **Tanstack Query + Prisma + PostgreSQL**

---

# 🧪 Testing Suite
- **Vitest** → Unit tests
- **Playwright** → E2E tests
- **MSW** → API mocking (only for testing, not for app code)

---

# 🔧 Developer Experience
- **React Hook Form + Zod** → Forms & validation
- **Next.js Bundle Analyzer** → Performance monitoring

---

# 🎨 State & Responsive
- **Zustand** → UI-only state (avoid storing server data)
- **React Query DevTools** → Query debugging
- **React Responsive** → Responsive logic

---

# 🛠️ Code Quality
- **Husky + Lint-staged**
- **ESLint + Prettier + Commitlint**

---

# 📊 Data & Rendering Principles
- **No localStorage / IndexedDB** → PostgreSQL is the single source of truth
- **Optimistic updates** → UI updates instantly, then syncs via TanStack Query + Prisma
- **Mantine Tables & Layouts** → For summaries, dashboards, logs

---

# 📋 Glide Data Grid Configuration

### Font Size Customization
To adjust font sizes in Glide Data Grid (v6.0.3+), use the correct theme properties:

```tsx
theme={{
  headerFontStyle: 'bold 17px Inter',  // Column headers
  baseFontStyle: '17px Inter',         // Cell content
  fontFamily: 'Inter',                 // Font family
}}
```

**⚠️ Important Notes:**
- Use canvas-style font specifications (e.g., `'bold 17px Inter'`)
- **DO NOT** use CSS-style format (e.g., `'600 17px Inter, sans-serif'`)
- Adjust `rowHeight` and `headerHeight` props to accommodate larger fonts
- Current optimized settings: 17px fonts with 70px row height, 80px header height

### Center Aligned Headers
To center align column headers, use a custom `drawHeader` callback:

```tsx
// Custom header renderer for center alignment
const drawHeader = useCallback((args: any) => {
  const { ctx, column, rect, theme } = args;
  
  // Fill header background
  ctx.fillStyle = theme.bgHeader;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  
  // Set text properties for center alignment
  ctx.fillStyle = theme.textHeader;
  ctx.font = theme.headerFontStyle;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Draw centered text
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  ctx.fillText(column.title, centerX, centerY);
  
  return true;
}, []);
```

### Complete Working Example
```tsx
<DataEditor
  rowHeight={70}
  headerHeight={80}
  drawHeader={drawHeader}
  theme={{
    headerFontStyle: 'bold 17px Inter',
    baseFontStyle: '17px Inter',
    fontFamily: 'Inter',
    bgHeader: '#f8f9fa',           // Light gray header background
    textHeader: '#343a40',         // Darker header text
    bgHeaderHasFocus: '#e9ecef',   // Focus state
    bgHeaderHovered: '#e9ecef',    // Hover state
    // ... other theme properties
  }}
/>
```

**✅ This solution provides:**
- **Center aligned headers** using canvas-based rendering
- **Custom header styling** with proper theme integration
- **Visual separation** with gray header background
- **Performance optimized** canvas rendering

### Clickable Cells (Customer Details Navigation)
To make specific columns clickable for navigation, use the `onCellClicked` handler:

```tsx
<DataEditor
  // ... other props
  onCellClicked={(cell, event) => {
    const [col, row] = cell;
    const column = columns[col];
    
    // Handle clicks on specific columns (e.g., customer name)
    if (column?.id === 'customerName' && row < filteredData.length) {
      const item = filteredData[row];
      if (item?.id) {
        router.push(`/path/to/details/${item.id}`);
      }
    }
  }}
/>
```

**⚠️ Requirements:**
- Ensure your data includes an `id` field for navigation
- Import `useRouter` from `next/navigation`
- Create corresponding detail pages with dynamic routing `[id]/page.tsx`

### Customer Analytics & KPIs
The customer details page includes comprehensive analytics:

```tsx
// Calculate completion and cancellation rates
const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
const cancellationRate = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0;

// Customer health score algorithm
const healthScore = Math.round(
  (completionRate * 0.4) +           // 40% weight on completion rate
  ((100 - cancellationRate) * 0.3) + // 30% weight on low cancellation
  (Math.min(recentOrders * 10, 100) * 0.2) + // 20% weight on recent activity
  (Math.min(totalOrders * 5, 100) * 0.1)     // 10% weight on total orders
);
```

**📊 Key Metrics Displayed:**
- **Completion Rate** - Percentage of successfully delivered orders
- **Cancellation Rate** - Percentage of cancelled orders
- **Customer Health Score** - Weighted score (0-100) based on performance
- **Average Order Value** - Revenue per completed order
- **Order Status Breakdown** - Visual distribution of order statuses
- **Customer Value Tier** - High/Medium/Standard based on total spending

### Keyboard Shortcuts
Enhanced user experience with custom keyboard shortcuts:

```tsx
// Ctrl+F / Cmd+F keyboard shortcut handler
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
      event.preventDefault(); // Prevent browser's find dialog
      searchInputRef.current?.focus(); // Focus search input
      searchInputRef.current?.select(); // Select existing text
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

**⌨️ Available Shortcuts:**
- **Ctrl+F (Windows/Linux) / Cmd+F (Mac)** - Focus search input instead of browser find
- **Automatically selects existing search text** for easy replacement
- **Works across the entire page** when customers table is active

### Modern Modal Design
Enhanced modal components with professional styling and UX:

```tsx
<Modal 
  size="xl"
  radius="lg"
  shadow="xl"
  centered
  styles={{
    header: {
      backgroundColor: 'var(--mantine-color-blue-0)',
      borderRadius: '12px 12px 0 0',
      padding: '24px 32px 16px 32px',
    },
    body: {
      padding: '32px',
      backgroundColor: 'var(--mantine-color-gray-0)',
    }
  }}
>
```

**✨ Design Features:**
- **Sectioned Layout** → Personal Info and Business Info with themed icons
- **Enhanced Input Styling** → Thicker borders, better focus states, left section icons
- **Gradient Action Buttons** → Modern gradients with hover animations
- **Improved Typography** → Better font weights, sizes, and color hierarchy
- **Smart Auto-fill** → Business info auto-populates from existing customers
- **Status Emojis** → Visual status indicators (✅ Active, ⭐ VIP, etc.)
- **Enhanced Notifications** → Rich success messages with icons and animations

### Automated Product Code Generation
The system automatically generates Product Codes for all products using a sophisticated formula:

```tsx
// Product Code generation algorithm
function generateProductCode(productName: string, postingDate: string): string {
  const initials = productName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('');
  
  // Convert MM/DD/YYYY to MMYYYY format
  const [month, day, year] = postingDate.split('/');
  const dateCode = month.padStart(2, '0') + year;
  
  return initials + dateCode;
}
```

**🔧 Product Code Examples:**
- "Ladies Shirt" + "03/20/2025" → **LS032025**
- "Men's Jeans" + "12/15/2024" → **MJ122024**
- "Kids Summer Dress" + "06/10/2025" → **KSD062025**

**⚡ Auto-Generation Features:**
- **Retroactive Generation** → Automatically creates codes for existing products with empty Product Code fields
- **Smart Initials Extraction** → Takes first letter of each word in product name
- **Date Integration** → Combines posting month and year (MMYYYY format)
- **Preservation Logic** → Maintains existing Product Codes when already present
- **Universal Application** → Works across database loading, CSV imports, and manual entry

### Automated Financial Calculations
The Products page features comprehensive automated financial calculations across 11 key columns:

```tsx
// Core financial calculation formulas
const calculations = {
  // Base Currency Conversion
  php: unitPrice * exchangeRate,
  subTotalPHP: (unitPrice * quantity + shippingFee1) * exchangeRate,
  
  // Transaction & Processing Fees
  transactionFee: subTotalPHP * 0.0299,  // 2.99%
  grandTotal: subTotalPHP + transactionFee,
  
  // Cost Analysis & Pricing
  cogs: grandTotal + shippingFee2 + shippingFee3 + packaging,
  basePrice: cogs / quantity,
  suggestedPrice: Math.ceil(basePrice * 1.22),  // ROUNDUP(Base Price × 122%)
  
  // Revenue & Profitability Analysis
  projectedSalesTotal: actualPrice * quantity,
  projectedProfit: projectedSalesTotal - cogs,
  projectedProfitPercentage: cogs > 0 ? (projectedProfit / cogs) * 100 : 0,
  
  // Markup Analysis
  totalMarkup: php > 0 ? (actualPrice / php) * 100 : 0
};
```

**💰 Financial Columns Automated:**
1. **PHP** → Unit Price × Exchange Rate
2. **Sub Total (PHP)** → (Unit Price × Quantity + Shipping Fee 1) × Exchange Rate
3. **Transaction Fee** → Sub Total (PHP) × 2.99%
4. **Grand Total** → Sub Total (PHP) + Transaction Fee
5. **Suggested Price** → ROUNDUP(Base Price × 122%)
6. **Base Price** → COGS / Quantity
7. **COGS** → Grand Total + Shipping Fee 2 + Shipping Fee 3 + Packaging
8. **Projected Sales Total** → Actual Price × Quantity
9. **Projected Profit** → Projected Sales Total - COGS
10. **Projected Profit (%)** → (Projected Profit / COGS) × 100
11. **Total Markup** → (Actual Price / PHP) × 100

**🔄 Calculation Implementation:**
- **Database Loading** → All existing records recalculated on page load
- **CSV Import** → Automatic calculations applied during bulk import
- **Manual Entry** → Real-time calculations in Add Product modal
- **Safety Checks** → Division by zero protection across all formulas
- **Percentage Formatting** → Proper percentage display for markup columns

**📊 Business Intelligence Features:**
- **Cost Analysis** → Complete breakdown from unit cost to final profit
- **Markup Tracking** → Multiple markup perspectives (with/without packaging)
- **Currency Conversion** → Automatic PHP conversion using exchange rates
- **Profit Margins** → Real-time profitability analysis per product
- **Pricing Optimization** → Data-driven insights for pricing decisions

---

# 🧭 App Navigation (Business → Workspace Flow)

The app follows a **two-level navigation system**:

### Business Selector (top-level dropdown)
- User chooses which business they are managing.
- Example:  
  - Czarlie & Ron Clothing  
  - Czarlie & Ron Trucking  

### Workspace Selector (per business)
- Workspaces depend on the selected business.  
- Example:  
  - Clothing → **Operations + Employees**  
  - Trucking → **Employees only**

---

# 📂 Example Setup (Barebone Only)

## Business: Czarlie & Ron Clothing

### Operations Workspace Pages
- Dashboard  
- Business Intelligence (EMPTY)  
- Transactions (EMPTY)  
- Products (EMPTY)  
- Due Dates (EMPTY)  
- Inventory (EMPTY)  
- Prices (EMPTY)  
- Sorting/Distribution (EMPTY)  
- Customers (EMPTY)  
- Shipments (EMPTY)  
- Shipments Dashboard (EMPTY)  
- Pickup Form (EMPTY)  
- Post Template (EMPTY)  
- Notifications (EMPTY)  
- Settings (EMPTY)  

### Employees Workspace Pages
- Dashboard  
- Attendance (EMPTY)  
- Expenses (EMPTY)  
- Payroll (EMPTY)  
- Calendar (EMPTY)  
- Schedules (EMPTY)  
- Leave Tracker (EMPTY)  
- Cash Advance (EMPTY)  
- Employee Loans (EMPTY)  
- 13th Month Pay (EMPTY)  
- Team (EMPTY)  
- Notifications (EMPTY)  
- Settings (EMPTY)  

---

## Business: Czarlie & Ron Trucking

### Employees Workspace Pages
- Dashboard  
- Trips (EMPTY)  
- Attendance (EMPTY)  
- Expenses (EMPTY)  
- Payroll (EMPTY)  
- Calendar (EMPTY)  
- Schedules (EMPTY)  
- Leave Tracker (EMPTY)  
- Cash Advance (EMPTY)  
- Employee Loans (EMPTY)  
- 13th Month Pay (EMPTY)  
- Team (EMPTY)  
- Notifications (EMPTY)  
- Settings (EMPTY)  

---

# 🔐 Final Phase - Authentication & Security
- [ ] Implement **authentication & authorization** (role-based: Super Admin, Operations Manager, Employee)
- [ ] Authentication is the **last step** (only after structure + pages are fully working)

---

# 🚀 Workflow Summary
- **Top Nav** → Business Selector (e.g., Clothing vs Trucking)  
- **Second Nav** → Workspace Selector (dynamic per business)  
- **Sidebar** → Workspace Pages (different menus per workspace)  

This ensures the app is **scalable, clean, and Notion-style modular**, while avoiding unnecessary clutter or mock data.