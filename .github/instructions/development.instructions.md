# Development Compliance & Commit Policy

## 1. Scope & Authorization

- Follow instructions exactly; do not expand scope or make unrequested changes.
- Modify only the specified module or component.
- Do not commit, push, or trigger builds without explicit authorization.
- Never initiate production builds.

### Commit Requirement

- When committing is explicitly authorized, each commit must include a **detailed, descriptive commit message**.
- Commit messages must clearly state:
  - What changed
  - Why the change was made
  - Which files/modules were affected
  - Any relevant risks, assumptions, or follow-ups
- Vague messages (e.g., “fix bug”, “update code”) are **strictly prohibited**.
- Commit history must be readable and sufficient for future auditing and reference.

---

## 2. Code Quality & Standards

- All changes must be permanent, root-cause fixes (no hacks or workarounds).
- Code must pass TypeScript strict mode, ESLint, and Prettier.
- Follow existing architecture, naming conventions, and file structure.
- Add dependencies only when necessary, secure, and version-locked.

---

## 3. Testing & Validation

- Always run everytime a code was modified:
  - `npm run lint && npm run typecheck && npm run test:unit && npm run test:integration && npm run test:coverage`
- All changes must pass required tests before submission.
- Unit and integration tests are mandatory each time a code is modified.
- E2E tests must only be run when explicitly instructed.
- Do not disable, bypass, or weaken test coverage.
- Perform manual testing where appropriate.

---

## 4. Database & Schema Changes

- Prisma schema changes must be **non-destructive**.
- Migrations must run **non-destructively**:
  - No table or column drops
  - No deletes or truncations
  - No prompts or commands that could remove existing data
- Use migrations or `npx prisma db push` **only against the test environment** to keep schemas aligned.

---

## 5. AI Responsibilities

- All AI-generated code must be reviewed by a human.
- AI must clearly explain:
  - Why the change is needed
  - Impact on dependencies
  - Risks, side effects, or breaking changes
- AI must refuse instructions that violate security or compliance rules.

---

## 6. Security & Confidentiality

- Never expose secrets or sensitive data unless explicitly instructed.
- Apply least-privilege principles throughout the system.
- Remove and rotate any detected secrets immediately.
- Ensure dependencies are free from known vulnerabilities.

---

## 7. Review, Traceability & Documentation

- Provide a clear summary of what changed, why, and how it was validated.
- Link commits or PRs to tasks or tickets.
- PR approval is required before merging unless explicitly instructed otherwise.
- Update documentation (README, changelog, internal docs) when behavior or features change.

## 8. Clarity & Plain Language

- Use **plain English** whenever possible.
- Avoid unnecessary technical jargon, buzzwords, or vague accounting, technical terminology.
- Write commit messages, comments, documentation, and reviews so that:
  - A new team member can understand them
  - A non-specialist reviewer can follow the intent
- If technical terms are required, explain them briefly in simple language.
- Clarity and understanding take priority over sounding technical.
