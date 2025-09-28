# 🚫 IMPORTANT —- Keep this repo **clean, modular, and production-focused**.



# ✅ Setup Order

### 1. Initialize Project
- [ ] Install **Node.js LTS** (latest stable)
- [ ] Create Next.js app with TypeScript (Strict Mode ON)
- [ ] Setup base folder structure (`/app`, `/components`, `/lib`, `/pages/api`)

### 2. Core Dependencies
- [ ] Install **Mantine UI**  
- [ ] Install **Zustand** (UI-only state)  
- [ ] Install **TanStack Query** (server data)  
- [ ] Install **Prisma + PostgreSQL**  

### 3. Developer Experience
- [ ] Install **React Hook Form + Zod** (forms + validation)  
- [ ] Install **React Responsive** (responsive logic)  
- [ ] Install **Next.js Bundle Analyzer** (performance)  

### 4. Testing
- [ ] Install **Vitest** (unit tests)  
- [ ] Install **Playwright** (E2E tests)  
- [ ] Install **MSW** (API mocking — testing only)  

### 5. Code Quality
- [ ] Install **ESLint + Prettier + Commitlint**  
- [ ] Setup **Husky + Lint-staged** (pre-commit hooks)  

---

# 📂 Implementation Flow

### Phase 1 — Navigation Skeleton
- [ ] Add **Top Nav → Business Selector** (dropdown)  
- [ ] Add **Second Nav → Workspace Selector** (dynamic)  
- [ ] Add **Sidebar → Workspace Pages** (empty menus per workspace)  

### Phase 2 — Empty Pages
- [ ] Create all **Operations Workspace Pages** (EMPTY)  
- [ ] Create all **Employees Workspace Pages** (EMPTY)  
- [ ] Create all **Trucking Workspace Pages** (EMPTY)  

⚠️ Each page = **empty Mantine layout only**, NO mock tables/data.

### Phase 3 — Layout & Styling
- [ ] Apply Mantine layouts (AppShell, Navbar, Sidebar, etc.)  
- [ ] Add page titles + placeholders (text only, no data)  

### Phase 4 — Testing & Linting
- [ ] Setup basic Vitest test (smoke test: "renders page")  
- [ ] Setup Playwright test (login page loads, sidebar visible)  
- [ ] Run ESLint & Prettier checks  

### Phase 5 — Authentication (Final)
- [ ] Implement role-based authentication & authorization  
  - Super Admin → all businesses  
  - Operations Manager → specific business only  
  - Employee → workspace pages only  

Authentication comes **last** once navigation + empty pages are stable.

---

# 🚀 Development Workflow
1. Always work **page by page** (no jumping ahead).  
2. Never add mock/fake data (tables must remain empty).  
3. Commit frequently with proper linting.  
4. Authentication is the final step after everything is functional.