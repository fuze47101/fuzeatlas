# Memory

## Me
Andrew Peterson, CEO/Founder of FUZE Biotech. Building antimicrobial textile treatment platform (FUZE Atlas) and public-facing site (fuzefaq.com).

## Critical Brand Language
| NEVER say | ALWAYS say |
|-----------|------------|
| silver | FUZE |
| nanoparticle(s) | metamaterial |
| nano | metamaterial |
| silver nanoparticles | FUZE metamaterial |
| silver nanoparticle technology | FUZE metamaterial technology |

**Technical/compliance docs (CIL, ARSL, SDS) may use chemical names (Silver, CAS 7440-22-4) but ALL marketing, website, and customer-facing content uses FUZE and metamaterial.**

## Products & Chemistry
| Term | Meaning |
|------|---------|
| **FUZE** | The antimicrobial treatment product — 99.998% ultrapure 18 megaohm DI water + 20 ppm FUZE metamaterial |
| **metamaterial** | What we call our active ingredient (elemental silver produced via liquid laser ablation from recycled electronics) |
| **F1/F2/F3/F4** | Treatment tiers: 1.0 / 0.75 / 0.5 / 0.25 mg/kg on fabric |
| **Stock concentration** | 30 mg/L in delivered FUZE |
| **Standard bottle** | 19L |
| **Three methods** | Exhaust (dyebath), Pad-Dry-Cure, Spray (6" head spacing, 15 m/min) |
| **Liquid laser ablation** | Our production method — 30-amp laser on 1m² table, solar-capable, recycled electronics feedstock |

## Platforms
| Platform | What | Where |
|----------|------|-------|
| **FUZE Atlas** | Multi-portal Next.js app (Admin/Brand/Factory/Lab) | fuzeatlas.com, Vercel |
| **fuzefaq.com** | Public landing page + calculator + sustainability | Railway, fuzecost repo |
| **fuzeatlas repo** | github.com/fuze47101/fuzeatlas.git | Main branch = production |
| **fuzecost repo** | github.com/fuze47101/fuzecost.git | Main branch = Railway deploy |

## Company Info
| Field | Value |
|-------|-------|
| **Company** | FUZE Biotech |
| **Address** | 1895 West 2100 South, Salt Lake City, Utah 84119 USA |
| **Email** | andrew@fuzebiotech.com / andrew@801inc.com |
| **CAS Number** | 7440-22-4 (for compliance docs only) |

## Active Projects
| Project | Status |
|---------|--------|
| **NY Hospitality Market** | Next week — QR codes on calculators → fuzefaq.com |
| **fuzefaq.com launch** | LIVE — needs terminology fixes, logo sizing |
| **FUZE Atlas production fixes** | Prisma errors on multiple API endpoints |
| **Customer compliance forms** | LS&Co CIL, Arvind CIL, Arvind ARSL — generated, under review |
| **Factory Sample Request Workflow** | NEW — see details below |
| **Lab Test Report Upload** | NEW — Tina request, see details below |
| **Mobile View Fix** | NEW — admin pages broken on iPhone |
| **Notification System** | NEW — department-based employee notifications |
| **Email Deliverability** | CRITICAL — all system emails going to spam |

## New Feature Details (April 2026)

### 1. Factory Sample Request Workflow
Factory users need to request FUZE product samples after registration.
- **Shipping**: From regional distributor if available, otherwise direct from USA (SLC)
- **Cost**: Free samples — factory provides their shipping account # and authorizes shipping on their account
- **Flow**: Factory submits request → includes shipping account + approval → FUZE ships → tracking number emailed back through same exchange
- **Onboarding**: After sample request, guide factory to: (a) upload fabric for testing, (b) dilution/application calculator page for recipe based on their chosen method, (c) instructions for requesting testing and sending samples to lab
- **Example**: Thailand factory making for Rhone → no regional distributor → ships from USA

### 2. Lab Test Report Upload (Tina Request)
Labs need a section in Lab Portal to upload test reports received from customers.
- **Current process**: Tina manages testing with ITS, VL, FPC labs via shared Excel — tracks pending tests, expected ready dates, downloads reports manually
- **Needed**: Labs log in and upload reports directly to the system
- **Visibility**: List of ongoing tests with expected ready dates visible to labs AND FUZE account managers
- **Reports**: Auto-filed and sorted in the system, linked to the correct test run/submission

### 3. Mobile View Broken
- Admin pages on iPhone: can't select users, change password, review accounts
- Need responsive audit of user management pages

### 4. Employee Notification System
- Assign employees to department notification groups (Lab, Shipping, Sales, etc.)
- Employees can be in multiple groups (e.g., admin monitors everything)
- **Lab group**: Gets test requests, shipping notifications, lab interaction alerts
- **Account manager**: Gets notifications for their assigned brands/factories
- **Andrew**: Not currently receiving access request notifications (email or text)
- Kaylee reports ALL system emails go straight to spam — email deliverability is broken

### Email Deliverability Problem
- All FUZE Atlas system emails going to spam (confirmed by Kaylee)
- Need to investigate: SPF/DKIM/DMARC records, sending domain, email provider config
- This blocks ALL notification features until fixed

## Tech Stack
- FUZE Atlas: Next.js 15.5 / Prisma 6.19 / PostgreSQL (Railway) / Vercel
- fuzefaq.com: Next.js serving static HTML / Railway
- DB: PostgreSQL on Railway (caboose.proxy.rlwy.net:28355)
- Email: Resend (transactional emails — access approvals, test notifications, etc.)
- Sending domain: needs SPF/DKIM/DMARC audit — all emails going to spam

## Proactive Sales Strategy
- Use Apollo/enrichment tools to research target brands proactively
- Build competitive intelligence on brands currently using competitor antimicrobials (NordShield, Microban, Silvadur, etc.)
- Identify brands with sustainability mandates that align with FUZE's zero-binder, zero-curing advantage
- Feed research into outreach sequences and call prep

## Preferences
- Move fast — meetings next week, lots to do
- Direct communication, no fluff
- Brand language is sacred — FUZE and metamaterial, never silver/nano
→ Full glossary: memory/glossary.md
