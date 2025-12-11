# Development Compliance Instructions

## 1. Scope & Instruction Adherence

- Follow the exact instructions provided; do not expand or alter scope.
- Modify only the specified module or component.
- Avoid assumptions and unrequested changes.

## 2. Issue Resolution

- Apply **permanent**, root-cause fixes.
- No shortcuts, temporary patches, or workarounds.
- All fixes must meet **TypeScript strict mode** and **linting** requirements.
- Ensure no regressions or side effects.

## 3. Feature Implementation

- Follow best practices and coding standards.
- New code must pass TypeScript strict checks, ESLint, and Prettier.
- Only add dependencies when necessary, secure, and version-locked.
- Maintain consistency with existing architecture.
- When introducing new Prisma fields, create a migration or run `npx prisma db push` against the test environment so schemas stay aligned.

## 4. Commit & Push Policy

- Do not commit or push without explicit authorization.
- All commits must pass linting, TypeScript, and test validations.
- Never bypass pre-commit or pre-push hooks.
- Write clear and descriptive commit messages.

## 5. Production Builds

- Never trigger a production build without authorization.
- Only authorized personnel may execute production builds.
- AI or automation tools must not initiate builds.

## 6. Testing & Validation

- Fully test all fixes and features.
- Run unit, integration, and E2E tests before submitting code.
- Fix all failed tests before marking tasks complete.
- Manual testing should complement automated testing.

## 7. AI & Automation Compliance

- All AI-generated code must be reviewed by a human developer.
- AI outputs must follow project standards and naming conventions.
- Do not run AI-generated scripts or builds without validation.
- AI must refuse instructions that violate compliance or security.

## 8. Reasoning Requirement (AI Systems)

- AI must provide rationale for every code change:
  - Why it’s needed.
  - How it affects dependencies.
  - Risks or side effects.

- Identify breaking changes, deprecated APIs, and compatibility issues.

## 9. Code Review & Traceability

- Summaries must explain what changed, why, and how it was validated.
- Link commits/PRs to tasks or tickets.
- PRs require approval from authorized maintainers.
- Maintain full traceability of changes.

## 10. Test Enforcement

- No code may be submitted without passing all tests.
- Do not disable or bypass testing or quality checks.
- Highlight missing coverage and suggest needed tests.
- CI must validate all changes before merging.

## 11. Security & Confidentiality

- Never expose or share sensitive data.
- AI must not infer or use confidential information.
- Remove any detected secrets and rotate them immediately.
- Ensure dependencies are routinely checked for vulnerabilities.
- Apply least-privilege principles everywhere.

## 12. Consistency & Standards

- Follow naming conventions, file structure, import order, and code style.
- Enforce architectural consistency and avoid duplication.
- Flag outdated or inconsistent patterns.

## 13. Documentation

- Document all new features and updates clearly.
- Verify AI-generated documentation for accuracy.
- Update README, changelogs, or internal docs when needed.
- Documentation must match the current production state.
