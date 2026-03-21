Atlas Log — working notes

- Goal: replace Knack dependency entirely; Knack exports are “legacy”, not a live source.
- CSV ingestion is for one-time/bootstrap + occasional bulk loads, but primary day-to-day is manual entry + linking.
- System must support:
  - Creating fabrics, submissions, tests, documents
  - Linking tests to submissions/fabrics
  - Viewing unmatched tests
  - Finding matches by FUZE fabric number, customer code, factory code, dates, lab report numbers

Operational requirements:
- No “framework drift”: do not introduce react-router, axios, pages router, or a second app shell.
- Job runner (Claw) should:
  - propose changes
  - apply changes
  - run build
  - deploy
  - verify endpoints
  - report back in Telegram with success/failure and logs.

Current known endpoints (baseline):
- GET /api/health => { ok: true }
- GET /api/fabrics?page=&pageSize=&q= => paged list
- GET /api/fabrics/[id] => detail
- UI:
  - Homepage lists fabrics, supports paging + “load more”
  - /fabrics/[id] shows details

Next deliverables:
1) Fabric detail page must show:
   - submissions for fabric (including codes)
   - tests linked to submissions (ICP, antibacterial, fungal)
   - documents
2) Add create flows:
   - create fabric + submission
   - create test run and attach documents
   - link/unlink tests
3) Add “Unmatched tests” view:
   - list all tests without submissionId
   - tools to search + link them

