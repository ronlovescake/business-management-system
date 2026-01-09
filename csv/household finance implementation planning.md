# Household Finance Implementation Planning

## Accounts (Personal / Household)

### Purpose

Accounts are the **sources of funds & balances** (real-world money holders). Every household **expense** and **income** must point to exactly **one Account**.

Examples:

- Cash
- Bank account
- E-wallet (GCash/Maya)
- Credit card
- Loan

### Database: `personal_accounts` (recommended)

#### MVP columns

- `id` (PK)
- `name` (string) — e.g., “GCash - Ron”, “BPI Checking”, “Cash Wallet”
- `type` (enum/string) — `CASH | BANK | EWALLET | CREDIT_CARD | LOAN`
- `currency` (string) — default `PHP`
- `isActive` (boolean) — archive instead of delete
- `createdAt`, `updatedAt`

#### Recommended (still simple)

- `institution` (string, nullable) — “BPI”, “BDO”, “GCash”
- `accountNumberLast4` (string, nullable)
- `notes` (string, nullable)
- `sortOrder` (int, nullable)

### Balance approach (decision)

- Preferred: balances are derived from transactions (income/expenses/transfers). Don’t store `currentBalance` as a source of truth.
- Optional later: “opening balance” as an initial transaction per account.

### Module behavior (Accounts page)

- CRUD: create, edit, archive (avoid hard delete if referenced)
- Dropdown ordering (uses `sortOrder` or name)
- Default account (optional setting later)

### Relationships (needed to wire modules)

- Household Expenses: add `accountId` to `household_expenses` → `personal_accounts.id`
- Household Income: add `accountId` to income table → `personal_accounts.id`
- Transfers (later): `fromAccountId` + `toAccountId`

### Migration strategy (safe)

- Add `accountId` nullable first + backfill existing rows to a default account (e.g., “Cash”)
- Then make `accountId` required for new entries

## Income (Personal / Household)

### Purpose

Income records represent money **coming into household accounts**.

In our case, most household funds come from the business, so the primary income type is:

- **Business Draw / Owner Draw** (money moved from business → household)

Note:

- If the money is just moving between household accounts (Bank → Cash), that should be a **Transfer**, not Income.

### Database: `household_income` (recommended)

#### MVP columns

- `id` (PK)
- `date` (required)
- `amount` (required, positive)
- `accountId` (required) — where the funds land (Cash/GCash/Bank)
- `category` (required) — start minimal: `BUSINESS_DRAW` (and optionally `REFUND`, `REIMBURSEMENT`, `OTHER`)
- `description` (required)
- `notes` (nullable)
- `receipt` / `attachment` (nullable)
- `createdAt`, `updatedAt`

#### Recommended (since all funds come from business)

- `sourceBusiness` (enum/string, nullable) — `CLOTHING | TRUCKING | BOTH | OTHER`
- `reference` (string, nullable) — bank transfer reference / cheque no.

### Module behavior (Income page)

- CRUD: create, edit, archive/delete (same pattern as expenses)
- Always require selecting the **Deposit to Account** (`accountId`)
- Default category to `BUSINESS_DRAW`

### Relationships

- `household_income.accountId` → `personal_accounts.id`

### Migration strategy (safe)

- Create `household_income` table first (new module; no backfill required)
