# FUZE Atlas — End-to-End Lab Testing Workflow

## Overview

Complete customer-facing workflow from fabric submission through test result delivery. Every step includes automated email notifications so the customer always knows where their sample is and what's happening.

---

## The 8 Stages

```
1. FABRIC INTAKE          Customer uploads fabric details
        ↓
2. TEST REQUEST           Customer selects tests + lab
        ↓
3. SHIPPING FORM          System generates shipping form + instructions
        ↓
4. SAMPLE SHIPPED         Customer enters tracking number
        ↓
5. SAMPLE RECEIVED        Lab/admin marks received → auto-reply to customer
        ↓
6. TESTING IN PROGRESS    Lab starts testing → email with estimated completion
        ↓
7. RESULTS UPLOADED       Lab uploads results → admin reviews + stamps
        ↓
8. RESULTS DELIVERED      Customer gets email with results + certificate
```

---

## Stage 1: FABRIC INTAKE (Exists Today)

**Who:** Factory or Brand user
**Where:** Factory Portal → Submit Fabric / Brand Portal → Fabrics

**What happens:**
- Customer fills in fabric details (construction, weight, width, yarn type, finish, color)
- System auto-assigns FUZE fabric number (FUZE-1001, FUZE-1002, etc.)
- Creates Fabric record + FabricSubmission in SUBMITTED status

**Email → Admins:** "New fabric submitted: FUZE-1042 from [Factory Name]"

**Status:** ✅ LIVE

---

## Stage 2: TEST REQUEST

**Who:** Factory or Brand user
**Where:** Factory Portal → Request Test / Brand Portal → Fabrics → Request Testing

**What happens:**
- Customer selects fabric from their list
- Selects lab (or FUZE internal lab)
- Picks tests (ICP, Antibacterial, Fungal, Odor, UV, Recipe Build, etc.)
- Sees pricing per test, rush options, estimated turnaround
- Submits request

**System creates:**
- TestRequest (PO) with auto-generated PO number: FUZE-PO-20260329-0001
- TestRequestLine items for each test selected
- Estimated cost calculated from LabService pricing

**Email → Admins:** "New test request FUZE-PO-20260329-0001 from [Customer] — [X] tests, $[total]"
**Email → Customer:** "Your test request has been received — PO: FUZE-PO-20260329-0001"

**Status:** ✅ LIVE — request creation + confirmation email (F-034) to customer + admin notification

---

## Stage 3: SHIPPING FORM

**Trigger:** Admin approves test request (status → APPROVED)

**What the customer receives (email):**

### FUZE Sample Shipping Form

```
═══════════════════════════════════════════════
          FUZE SAMPLE SHIPPING FORM
═══════════════════════════════════════════════

PO Number:         FUZE-PO-20260329-0001
Fabric:            FUZE-1042 (Customer Code: ABC-100)
Tests Requested:   ICP Analysis, Antibacterial Screen
Lab:               FUZE Testing Services
Est. Turnaround:   10 business days after receipt

───────────────────────────────────────────────
SHIP TO:
───────────────────────────────────────────────
FUZE Testing Services
1895 West 2100 South
Salt Lake City, UT 84119 USA
Attn: Lab — PO FUZE-PO-20260329-0001

───────────────────────────────────────────────
SAMPLE REQUIREMENTS:
───────────────────────────────────────────────
☐ Minimum 1 meter treated fabric
☐ 1 meter UNTREATED control (same lot/batch)
☐ Label each piece clearly: TREATED / CONTROL
☐ Include this form printed in the package
☐ Ship flat or rolled — NO center folds
☐ Store in cool, dry conditions before shipping

───────────────────────────────────────────────
INTERNATIONAL SHIPPING:
───────────────────────────────────────────────
Mark packages:
  "TEXTILE SAMPLES — NO COMMERCIAL VALUE
   FOR TESTING PURPOSES ONLY"
HS Code: 5911.90
Use tracked shipping (FedEx, DHL, UPS)

═══════════════════════════════════════════════
```

**Also in email:**
- Link to enter tracking number on FUZE Atlas
- "Once you ship, click here to enter your tracking number"
- Expected timeline: "Ship within 5 business days for priority processing"

**What happens in the system:**
- TestRequest status → APPROVED
- SampleShipment record created in PREPARING status
- Customer's portal shows "Awaiting Sample Shipment" with the shipping form available as PDF download

**Status:** ✅ LIVE — Shipping instructions email sent on approval. Customer portal shows tracking entry form with carrier dropdown (FedEx/DHL/UPS/SF Express/Other), tracking number, and date picker.

---

## Stage 4: SAMPLE SHIPPED

**Who:** Customer
**Where:** Factory/Brand Portal → their test request → "Enter Tracking Number"

**What the customer does:**
- Clicks link from email (or navigates to their test request)
- Enters carrier (FedEx/DHL/UPS/Other) and tracking number
- Optionally enters ship date and number of pieces sent
- Clicks "Mark as Shipped"

**System does:**
- Updates SampleShipment status → SHIPPED
- Records carrier, tracking number, ship date
- Updates FuzeTestRequest.trackingNumber and shippedDate

**Email → Admins + Lab:** "Sample shipped for PO FUZE-PO-20260329-0001 — Tracking: [number] via [carrier]"
**Email → Customer:** "We've recorded your shipment. Tracking: [number]. We'll notify you when the sample arrives at our lab."

**Status:** ✅ LIVE — Customer enters tracking on Factory Portal → My Requests. Emails F-035 (to admins + lab + AM) and F-036 (confirmation to customer) fire automatically. Smart notification routing via notify-workflow.ts.

---

## Stage 5: SAMPLE RECEIVED

**Who:** Lab tech or Admin
**Where:** Admin Dashboard → Shipments or Lab Portal → Incoming Samples

**What admin/lab does:**
- Sees list of expected incoming shipments
- Opens shipment → clicks "Mark as Received"
- Fills in receiving form:
  - Date received
  - Condition assessment (Good / Damaged / Insufficient)
  - Number of pieces received
  - Control sample included? Yes/No
  - Any notes (e.g., "package was damp" or "only 0.5m received, need more")
- If condition is "Damaged" or "Insufficient" → status goes to ISSUE, customer notified

**System does:**
- SampleShipment status → AT_LAB
- FuzeTestRequest.receivedDate set
- TestRequest status → SUBMITTED (samples in hand, ready for lab queue)

**Email → Customer (auto-reply):**
```
Subject: ✅ Sample Received — PO FUZE-PO-20260329-0001

Your sample for FUZE-1042 has been received at our lab.

  Received:    March 30, 2026
  Condition:   Good
  PO Number:   FUZE-PO-20260329-0001
  Tests:       ICP Analysis, Antibacterial Screen

Your sample is now in our testing queue. We'll notify you
when testing begins with an estimated completion date.

Track your request: [Link to portal]
```

**If there's an issue:**
```
Subject: ⚠️ Sample Issue — PO FUZE-PO-20260329-0001

We received your sample but found an issue:

  Issue: Insufficient sample size (0.5m received, 1m required)

  Please ship an additional 0.5m of treated fabric to proceed.
  Testing is on hold until the additional sample arrives.

Contact lab@fuze47.com with questions.
```

**Status:** ✅ LIVE — Admin dashboard has "Receive Sample" button with condition prompt (GOOD/DAMAGED/INSUFFICIENT) and notes. Sends F-037 (received confirmation) or F-038 (issue alert) to customer + AM automatically.

---

## Stage 6: TESTING IN PROGRESS

**Who:** Lab tech or Admin
**Where:** Admin → Test Requests → Start Testing

**What admin/lab does:**
- Opens PO → clicks "Start Testing" or assigns to lab queue
- System calculates estimated completion date based on turnaround days

**System does:**
- TestRequest status → IN_PROGRESS
- Each TestRequestLine status → IN_PROGRESS
- Estimated completion date = today + max(turnaroundDays across all lines)

**Email → Customer:**
```
Subject: 🔬 Testing Started — PO FUZE-PO-20260329-0001

Testing has begun on your sample FUZE-1042.

  Tests in progress:
    • ICP Analysis (ICP-OES) — Est. 7 days
    • Antibacterial Screen (AATCC 100) — Est. 10 days

  Estimated completion: April 9, 2026

  We'll email you as soon as results are ready.

  Track your request: [Link to portal]
```

**Customer portal shows:**
- Status: "Testing In Progress"
- Progress bar based on days elapsed vs estimated
- Estimated completion date
- Individual test line statuses

**Status:** ✅ LIVE — Admin dashboard has "Start Testing" button. Auto-calculates estimated completion from max turnaround days across all test lines. Sets all PENDING lines to IN_PROGRESS. Sends F-039 email to customer + AM with test list and estimated completion date.

---

## Stage 7: RESULTS UPLOADED

**Who:** Lab tech uploads results → Admin reviews and stamps

**What happens:**
1. Lab tech uploads test report PDF (drag & drop parser exists)
2. System parses results: ICP values, bacterial reduction %, pass/fail
3. AI reviews for anomalies, validates math
4. Admin assigns results to fabric/submission
5. Admin reviews and "stamps" (approves for brand visibility)

**System does on stamp:**
- TestRun.brandVisible = true
- TestRequestLine status → COMPLETE
- If all lines complete → TestRequest status → RESULTS_RECEIVED
- Admin can add notes, flag retests

**Status:** ✅ LIVE — Upload, parse, assign, and stamp all working. Results stamping triggers email notification.

---

## Stage 8: RESULTS DELIVERED

**Trigger:** Admin stamps test results (brandVisible = true)

**Email → Customer:**
```
Subject: 📊 Test Results Ready — FUZE-1042 — PASSED

Your test results for FUZE-1042 are ready.

  PO Number:   FUZE-PO-20260329-0001
  Fabric:      FUZE-1042 (ABC-100)

  Results Summary:
  ┌─────────────────────────────┬──────────┐
  │ ICP Analysis (ICP-OES)      │ ✅ PASS  │
  │ Antibacterial (AATCC 100)   │ ✅ PASS  │
  └─────────────────────────────┴──────────┘

  ICP Silver Content: 0.85 mg/kg (Target: F1 = 1.0 mg/kg)
  Antibacterial Reduction: 99.97% (>99% = PASS)

  View full results: [Link to portal]
  Download certificate: [Link to PDF]

  Thank you for choosing FUZE.
```

**Customer portal shows:**
- Full test results with data tables
- Pass/fail status per test
- Downloadable test report PDF
- FUZE certification badge (if all tests pass)

**If RETEST needed:**
```
Subject: 🔄 Retest Required — FUZE-1042

One or more tests require retesting:

  • ICP Analysis: 0.15 mg/kg (Below F4 threshold of 0.25 mg/kg)
    → Recommendation: Retreat fabric at higher concentration

  Next steps: We'll contact you to discuss retreatment options.
```

**Status:** ✅ LIVE — F-040 email fires on stamp with full pass/fail summary table per test (ICP values, bacterial reduction %, etc.), overall PASSED/FAILED/MIXED result, and portal link.

---

## Build Status

### P1 — Critical Path ✅ ALL COMPLETE

1. ✅ **Sample Shipping Form** — Shipping instructions email on approval. Customer portal tracking entry with carrier dropdown, tracking number, date picker.
2. ✅ **Customer Tracking Entry UI** — Factory Portal → My Requests page with inline tracking form. Calls mark_shipped API action.
3. ✅ **Sample Receiving Form** — Admin "Receive Sample" button with condition assessment (GOOD/DAMAGED/INSUFFICIENT), notes. Auto-emails customer.
4. ✅ **"Testing Started" Trigger + Email** — Admin "Start Testing" button. Auto-calculates estimated completion date. Emails customer with test list + ETA.
5. ✅ **Results Email Enhancement** — F-040 email with full pass/fail summary table, ICP values, bacterial reduction %, overall PASSED/FAILED/MIXED.
6. ✅ **Smart Notification Routing** — notify-workflow.ts routes emails to customer, account manager (salesRepId), lab team (labId users), and FUZE admins per stage.
7. ✅ **Customer Portal "My Requests"** — Visual 7-stage timeline with status badges, expandable cards, shipment info, estimated completion.

### P2 — Polish (Next Up)

1. **Status cascade** — When all TestRequestLines are complete, auto-update TestRequest to RESULTS_RECEIVED → COMPLETE.
2. **Retest workflow** — Flag failed tests, trigger retest request, notify customer with recommendations.
3. **Shipping form PDF download** — Printable PDF version of the shipping form for customers to include in package.
4. **Estimated completion tracker** — Progress bar on customer portal based on actual vs estimated days.

### P3 — Nice to Have

11. **FedEx/DHL/UPS tracking integration** — Auto-pull tracking status updates.
12. **Sample photo upload** — Customer or lab uploads photos of received samples.
13. **Batch receiving** — Mark multiple shipments received at once.
14. **SMS notifications** — Text message option for key status changes.
15. **Branded test certificate PDF** — Auto-generated FUZE-branded PDF certificate for passed tests.

---

## Database Schema ✅ DEPLOYED

### Fields added to TestRequest:
```
testingStartedAt         DateTime?   // Set when admin clicks "Start Testing"
testingStartedById       String?     // Who started it
estimatedCompletionDate  DateTime?   // Calculated from max turnaround days
```

### Fields added to SampleShipment:
```
receivedCondition    String?   // GOOD, DAMAGED, INSUFFICIENT
receivedPieces       Int?      // Number of pieces received
controlIncluded      Boolean?  // Was control sample included
receivedNotes        String?   // Free text notes on receiving
receivedById         String?   // Who marked it received
```

### Email Templates ✅ ALL BUILT (src/lib/email.ts)
| Code | Function | Trigger | Recipients |
|------|----------|---------|------------|
| F-034 | `sendTestRequestConfirmationEmail()` | Customer submits request | Customer |
| F-035 | `sendSampleShippedNotification()` | Customer enters tracking | Admins + Lab + AM |
| F-036 | `sendShipmentConfirmedEmail()` | Customer enters tracking | Customer |
| F-037 | `sendSampleReceivedEmail()` | Lab marks received (GOOD) | Customer + AM |
| F-038 | `sendSampleIssueEmail()` | Lab marks received (DAMAGED/INSUFFICIENT) | Customer + AM |
| F-039 | `sendTestingStartedEmail()` | Admin starts testing | Customer + AM |
| F-040 | `sendResultsReadyEmail()` | Admin stamps results | Customer + AM |

---

## Customer Portal Experience (What they see)

### Test Request Card (on their portal)
```
┌─────────────────────────────────────────────────────┐
│ PO: FUZE-PO-20260329-0001          Status: ● Active │
│ Fabric: FUZE-1042 (ABC-100)                         │
│ Tests: ICP, Antibacterial                           │
│ Lab: FUZE Testing Services                          │
│                                                     │
│ ● Request Submitted    Mar 29                       │
│ ● Approved             Mar 29                       │
│ ● Sample Shipped       Mar 30  — FedEx 7891234567   │
│ ● Sample Received      Apr 1   — Condition: Good    │
│ ● Testing Started      Apr 2   — Est. complete Apr 9│
│ ○ Results Ready                                     │
│ ○ Complete                                          │
│                                                     │
│ [View Shipping Form]  [View Results]                │
└─────────────────────────────────────────────────────┘
```

---

## Email Sequence Summary

| # | Email | Trigger | To |
|---|-------|---------|-----|
| 1 | "Test request received" | Customer submits | Customer |
| 2 | "New test request" | Customer submits | Admins |
| 3 | "Shipping form + instructions" | Admin approves | Customer |
| 4 | "Sample shipped" | Customer enters tracking | Admins + Lab |
| 5 | "Shipment confirmed" | Customer enters tracking | Customer |
| 6 | "Sample received at lab" | Lab marks received | Customer |
| 7 | "Testing started" | Lab starts testing | Customer |
| 8 | "Results ready" | Admin stamps results | Customer |

8 touchpoints. The customer never has to wonder what's happening.
