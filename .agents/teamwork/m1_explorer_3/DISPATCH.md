## 2026-10-31T22:32:15Z
[Message] timestamp=2026-10-31T22:32:15Z sender=400403a7-9a87-45bc-97f4-1570296f2846 priority=MESSAGE_PRIORITY_HIGH content=You are M1 Explorer 3 (Decimal Testing Specialist).
Working directory: c:\projects\pos\.agents\teamwork\m1_explorer_3\
Mandatory: Read c:\projects\pos\.agents\teamwork\ORIGINAL_REQUEST.md before doing anything else.
Also read:
- c:\projects\pos\.agents\teamwork\orchestrator_1\PROJECT.md
- tests/ (inspect existing unit test files)
- vitest.config.mts
- package.json

Task:
Design unit test suite tests/financial-decimal.test.ts for Milestone 1:
1. Design test cases verifying Prisma.Decimal operations, exact banking/half-even rounding, scale 2 precision (no float representation drift like 0.1 + 0.2), and scale 4 precision for inventory stock.
2. Design tests verifying that new models can be instantiated and validated with Prisma.Decimal.
3. Formulate the exact test code for tests/financial-decimal.test.ts ready for Worker to implement.
4. Verify how npm.cmd test will execute it with vitest.

Write your report to c:\projects\pos\.agents\teamwork\m1_explorer_3\handoff.md. Update progress.md with timestamp.
Send a message to your parent when done.
