# Web Application Sitemap

> **Last Updated:** January 9, 2026  
> **Purpose:** Complete hierarchical map of all application routes and modules

---

## 📊 Overview

**Total Business Units:** 2 (Clothing, Trucking)  
**Total Modules:** 80+  
**Route Structure:** Hierarchical with 3-4 levels deep

---

## 🏠 Root Level

```
/                           → Home/Dashboard
/login                      → Authentication
/forgot-password            → Password Recovery
/reset-password             → Password Reset
/profile                    → User Profile
/settings                   → Global Settings
/workspaces                 → Workspace Selector
```

---

## 👔 Clothing Business

### Main Routes

```
/clothing                   → Clothing Business Hub
├── /clothing/users         → User Management
├── /clothing/operations    → Operations Module
├── /clothing/employees     → Employee Management
├── /clothing/accounting    → Accounting & Finance
└── /clothing/ledger        → (Redirects to /clothing/accounting)
```

---

### 📦 Clothing Operations

**Base:** `/clothing/operations`

```
/clothing/operations
├── /dashboard                    → Operations Dashboard
├── /transactions                 → Transaction Management
├── /customers                    → Customer Directory
├── /products                     → Product Catalog
├── /inventory                    → Inventory Management
├── /shipments                    → Shipment Tracking
├── /prices                       → Price Management
├── /sorting-distribution         → Sorting & Distribution
├── /checkout-links              → Invoicing System
├── /dispatching                 → Dispatch Management
├── /dispatch                    → Dispatch (alternative route)
├── /due-dates                   → Due Date Tracking
├── /business-intelligence       → BI & Analytics
├── /messaging                   → Customer Messaging
├── /post-template              → Social Media Templates
├── /message-templates          → Message Template Manager
├── /settings                   → Operations Settings
└── /notifications              → Notification Center
```

**Features:**

- 📊 Real-time inventory tracking
- 🚚 Shipment & dispatch coordination
- 💰 Pricing & invoicing
- 📱 Customer communication
- 📈 Business analytics

---

### 👥 Clothing Employees

**Base:** `/clothing/employees`

```
/clothing/employees
├── /dashboard                    → Employee Dashboard
├── /team                        → Team Directory
├── /attendance                  → Attendance Tracking
├── /schedules                   → Work Schedules
├── /calendar                    → Calendar View
├── /payroll                     → Payroll Management
├── /leave-tracker               → Leave Management
├── /cash-advance                → Cash Advance Requests
├── /employee-loans              → Employee Loan Tracking
├── /thirteenth-month-pay        → 13th Month Pay Calculator
├── /expenses                    → (Redirects to /clothing/accounting)
├── /settings                    → Employee Settings
└── /notifications               → Employee Notifications
```

**Features:**

- ⏰ Time & attendance
- 💵 Payroll & compensation
- 📅 Schedule management
- 🏖️ Leave tracking
- 💳 Advances & loans

---

### 💰 Clothing Accounting

**Base:** `/clothing/accounting`

```
/clothing/accounting
├── /expenses                    → Expense Management
├── /ledger                      → General Ledger
├── /journal                     → Journal Entries
├── /profit-loss                 → Profit & Loss Statement
└── /balance-sheet               → Balance Sheet
```

**Features:**

- 📊 Financial statements
- 💼 Expense tracking with receipts
- 📖 Double-entry bookkeeping
- 📈 Monthly analytics
- 💾 CSV Import/Export

---

## 🚛 Trucking Business

### Main Routes

```
/trucking                   → Trucking Business Hub
├── /trucking/employees     → Employee Management
├── /trucking/operations    → Operations Module
├── /trucking/expenses      → Expense Tracking
├── /trucking/invoices      → Invoice Management
├── /trucking/payments      → Payment Processing
├── /trucking/reports       → Reporting
└── /trucking/analytics     → Analytics & BI
```

---

### 👥 Trucking Employees

**Base:** `/trucking/employees`

```
/trucking/employees
├── /dashboard                   → Employee Dashboard
├── /team                       → Team Directory
├── /attendance                 → Attendance Tracking
├── /schedules                  → Work Schedules
├── /calendar                   → Calendar View
├── /payroll                    → Payroll Management
├── /leave-tracker              → Leave Management
├── /cash-advance               → Cash Advance Requests
├── /employee-loans             → Employee Loan Tracking
├── /thirteenth-month-pay       → 13th Month Pay Calculator
├── /trips                      → Trip Management
├── /expenses                   → Trip Expenses
├── /settings                   → Settings
└── /notifications              → Notifications
```

**Features:**

- 🚛 Trip-based payroll
- 📍 Route tracking
- ⛽ Fuel & expense management
- 👷 Driver & helper management

---

### 🚚 Trucking Operations

**Base:** `/trucking/operations`

```
/trucking/operations
├── /fleet-registry             → Fleet Management
├── /trips                      → Trip Scheduling
├── /truck-assignments          → Truck Assignment
└── /vehicle-assignments        → Vehicle Assignment
```

**Features:**

- 🚛 Fleet registry
- 📋 Trip assignment
- 🔧 Vehicle maintenance tracking

---

### 📊 Trucking Analytics

**Base:** `/trucking/analytics`

```
/trucking/analytics
└── /profitability              → Profitability Analysis
```

**Features:**

- 📈 Trip profitability
- 💹 Revenue analysis

---

### 💼 Trucking Financial

```
/trucking
├── /expenses                   → Expense Tracking
├── /invoices                   → Invoice Management
├── /payments                   → Payment Processing
└── /reports                    → Financial Reports
```

**Features:**

- 💰 Trip-based invoicing
- 💳 Payment tracking
- 📊 Expense categorization

---

## 🔐 Admin Panel

**Base:** `/admin`

```
/admin
├── /backup-restore             → Database Backup & Restore
└── /change-log                 → System Change Log
```

**Access:** SUPER_ADMIN only

**Features:**

- 💾 Database backup/restore
- 📝 Audit trail
- 🔍 Change tracking

---

## 🔌 API Routes

### Core APIs

```
/api
├── /auth                       → Authentication APIs
├── /modules                    → Module Configuration
├── /users                      → User Management
└── /settings                   → Settings APIs
```

### Clothing APIs

```
/api/clothing
├── /customers                  → Customer CRUD
├── /products                   → Product CRUD
├── /transactions               → Transaction CRUD
├── /shipments                  → Shipment CRUD
├── /prices                     → Price CRUD
├── /inventory                  → Inventory APIs
├── /expenses                   → Expense CRUD
├── /employees                  → Employee CRUD
├── /attendance                 → Attendance APIs
├── /schedules                  → Schedule APIs
├── /payroll                    → Payroll APIs
├── /cash-advance               → Cash Advance APIs
├── /employee-loans             → Loan APIs
└── /thirteenth-month-pay       → 13th Month APIs
```

### Trucking APIs

```
/api/trucking
├── /trips                      → Trip CRUD
├── /expenses                   → Expense CRUD
├── /fleet                      → Fleet APIs
├── /employees                  → Employee CRUD
├── /invoices                   → Invoice APIs
└── /payments                   → Payment APIs
```

---

## 🎨 Route Patterns

### URL Structure

```
/{business-unit}/{module}/{sub-module}/{action}

Examples:
/clothing/operations/transactions      → List view
/clothing/employees/payroll           → Payroll management
/trucking/operations/trips            → Trip listing
```

### Common Patterns

| Pattern          | Purpose              | Example                              |
| ---------------- | -------------------- | ------------------------------------ |
| `/dashboard`     | Overview & metrics   | `/clothing/operations/dashboard`     |
| `/settings`      | Module configuration | `/clothing/employees/settings`       |
| `/notifications` | Notification center  | `/clothing/operations/notifications` |

---

## 🔒 Access Control

### Role Hierarchy

```
SUPER_ADMIN
    ↓
  ADMIN
    ↓
MANAGER
    ↓
  USER
```

### Route Protection

| Route                    | Minimum Role | Notes                  |
| ------------------------ | ------------ | ---------------------- |
| `/admin/*`               | SUPER_ADMIN  | Full system access     |
| `/clothing/accounting/*` | ADMIN        | Financial data         |
| `/trucking/analytics/*`  | ADMIN        | Business analytics     |
| `/*/employees/payroll`   | ADMIN        | Sensitive payroll data |
| `/*/operations/*`        | USER         | Operations access      |

---

## 📱 Module Categories

### By Business Function

**Operations** (18 modules)

- Clothing: 16 modules
- Trucking: 5 modules

**Employee Management** (14 modules each)

- Clothing: 14 modules
- Trucking: 14 modules

**Financial** (9 modules)

- Clothing: 5 accounting modules
- Trucking: 4 financial modules

**Administration** (2 modules)

- System-wide admin tools

---

## 🌐 External Integrations

**Routes with External Services:**

| Route                                 | Integration     | Purpose                |
| ------------------------------------- | --------------- | ---------------------- |
| `/clothing/operations/messaging`      | SMS/Email APIs  | Customer communication |
| `/clothing/operations/checkout-links` | Payment Gateway | Invoice payment        |
| `/*/employees/attendance`             | QR/Biometric    | Time tracking          |

---

## 🗂️ File Structure

```
src/app/
├── clothing/
│   ├── operations/          → 18 subdirectories
│   ├── employees/           → 14 subdirectories
│   ├── accounting/          → 5 subdirectories
│   ├── users/
│   └── ledger/
├── trucking/
│   ├── employees/           → 14 subdirectories
│   ├── operations/          → 4 subdirectories
│   ├── analytics/
│   ├── expenses/
│   ├── invoices/
│   ├── payments/
│   └── reports/
└── admin/
    ├── backup-restore/
    └── change-log/
```

---

## 🔄 Redirects & Aliases

**Active Redirects:**

| From                           | To                              | Reason                   |
| ------------------------------ | ------------------------------- | ------------------------ |
| `/clothing/ledger`             | `/clothing/accounting`          | Module consolidation     |
| `/clothing/employees/expenses` | `/clothing/accounting`          | Unified expense tracking |
| `/clothing/accounting`         | `/clothing/accounting/expenses` | Default view             |

---

## 📊 Statistics

### Route Metrics

| Metric                | Count    |
| --------------------- | -------- |
| **Total Pages**       | 80+      |
| **Total API Routes**  | 50+      |
| **Clothing Modules**  | 45       |
| **Trucking Modules**  | 25       |
| **Admin Modules**     | 2        |
| **Shared Components** | 100+     |
| **Max Route Depth**   | 4 levels |

---

## 🎯 Navigation Hierarchy

### Level 1: Business Selection

```
Clothing ↔ Trucking
```

### Level 2: Module Category

```
Operations | Employees | Accounting/Financial
```

### Level 3: Feature Module

```
Dashboard | Transactions | Payroll | etc.
```

### Level 4: Sub-features

```
List View | Create | Edit | Settings
```

---

## 🚀 Future Expansion

**Planned Routes:**

- `/clothing/reports` - Reporting suite
- `/trucking/analytics/fleet-performance` - Fleet analytics
- `/inventory/warehouses` - Multi-warehouse support
- `/crm` - Customer relationship management

---

## 📝 Notes

1. **Module Consistency**: Employee modules are mirrored between Clothing and Trucking for consistency
2. **Accounting Consolidation**: Clothing uses dedicated accounting module; Trucking has separate financial routes
3. **Dynamic Routing**: Some routes support dynamic segments (e.g., `/api/expenses/[id]`)
4. **Theme Inheritance**: Each business unit has its own theme provider

---

## 🔍 Quick Reference

**Find a Route:**

- Employee payroll: `/{business}/employees/payroll`
- Transactions: `/clothing/operations/transactions`
- Expenses: `/{business}/accounting/expenses` or `/trucking/expenses`
- Analytics: `/{business}/operations/business-intelligence` or `/trucking/analytics`

**Find an API:**

- Pattern: `/api/{resource}` or `/api/{business}/{resource}`
- Example: `/api/expenses`, `/api/clothing/customers`

---

**Generated:** January 9, 2026  
**Maintainer:** System  
**Version:** 1.0.0
