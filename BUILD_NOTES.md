# FUZE Atlas — Build Notes

## Pending / Future Work

### In-House Test Names & Definitions
We need to create and define the test names for our in-lab, in-house tests that we perform. This includes naming conventions like our Helios testing. Andrew will prepare a full list of all tests we run so they can be properly cataloged in the system before moving forward with this feature.

**Status:** Awaiting test list from Andrew

---

### Down Samples / Material Types
"Down samples of down" aren't really fabrics — need to revisit how non-fabric materials are handled in the system. May need a broader "Material" or "Sample" concept alongside Fabric.

**Status:** Deferred

---

### Brand Delete Feature
Add ability to delete brands from the system.

**Status:** Deferred — "future status after we full clean up"

---

### Lab-Specific PDF Parsing Profiles
Upload one of each lab's test format to build more accurate parsing profiles per lab. Current parsing is tactical/quick-fix based.

**Status:** Ongoing — improving as new lab formats are encountered

---

## Recent Deployments

### Project Entity (pending deploy)
- Added `Project` model to Prisma schema (belongs to Brand, has many TestRuns)
- Project selection in Assign modal and Upload flow
- Project column + filter dropdown on Tests page
- **Migration required:** `npx prisma migrate dev --name add-project-model`

### Test Edit Modal (deployed — 00b157d)
- Edit button on test rows (mobile + desktop)
- PATCH API for test core fields

### PDF Parser Improvements (deployed — d446d8c)
- CTLA lab detection, report number extraction
- Word-boundary regex for short lab acronyms
- Removed UL false positive

### Fabric Dropdown Fix (deployed — d446d8c)
- Better display names (FUZE-number / customerCode)
- Increased visible items from 8 to 15
