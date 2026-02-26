# FUZEAtlas – Canonical Spec (Saved)

## 1. Rebuild intent
We are rebuilding FUZEAtlas from scratch.

Reason:
- Knack structure too constrained
- Reporting limited
- Data normalization inconsistent
- Lineage tracking failed in prior attempt
- Atlas must become SaaS-grade infrastructure

Primary goal:
Create a Fortune-10-worthy, scalable, global SaaS platform.

---

## 2. Database strategy
- Postgres (Railway)
- Production DB (existing)
- Dev DB (clone created: Postgres-ZLs2)
- Atlas connects to Dev DB first

Schema Authority
- database/schema_v1.sql is source of truth
- Prisma is migration tool
- No schema changes without governance

---

## 3. Legacy data rules
Legacy data:
- Imported
- Preserved
- Marked pre_atlas = true
- Never overwrite — append only

If Fabric ID missing:
→ Create placeholder
→ Mark as “Pre-Atlas”
→ Preserve lineage

Going forward:
Atlas-native data must be clean, relational, and validated.

---

## 4. Entities + rules
Entities:
- Brands
- Textile Mills
- Factories
- Labs
- Distributors
- Fabrics
- Applications
- Test Reports
- Wash Cycles
- ICP Results
- Antimicrobial Results

Rules:
- One Fabric → many Applications
- One Application → many Tests
- One Test → many Wash Results
- ICP always numeric
- AMB mostly percentage
- Missing wash defaults to 0

---

## 5. Must-have capabilities
Atlas must:
- Track brand → mill → fabric → application → test → approval
- Preserve lineage permanently
- Enable search by:
  - Fiber content
  - Construction
  - Color
  - Wash count
  - ICP value
  - Antimicrobial result
- Allow rep-level test requests with cost approval
- Enable future PDF auto-ingestion
- Eventually expose redacted portal to customers

This becomes FUZE’s global operating backbone.

---

## 6. OpenClaw (AgentBond) authority
Authority Level:
- Propose schema changes
- Generate migration scripts
- Draft modifications
- Draft deployment instructions

Requires human approval to:
- Push migrations
- Modify production DB
- Deploy to Railway

Future option:
Night Mode Autonomy (controlled execution window)

---

## 7. Status
Railway:
- Production Postgres online
- Dev Postgres clone created
- fuzeatlas service connected

Local:
- 801brain active
- Atlas cloned
- Schema v1 created
- Governance model defined
- Telegram agent functional

---

## 8. Phase 2
- Finalize relational integrity
- Write migration
- Deploy to Dev DB
- Begin CSV structured import
- Build validation layer
- Build governance loop
