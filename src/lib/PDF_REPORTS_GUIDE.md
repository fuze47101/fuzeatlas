# FUZE Atlas PDF Report Builder

A comprehensive report generation system for FUZE Atlas textile antimicrobial testing platform. Generates professional HTML email-compatible reports for test results, brand scorecards, compliance, and weekly business digests.

## Overview

The PDF report builder consists of three components:

1. **src/lib/pdf-reports.ts** - Report template generators (HTML as strings)
2. **src/app/api/reports/route.ts** - Main API endpoint with query parameters
3. **src/app/api/reports/[reportType]/route.ts** - Dynamic routing for cleaner URLs

All reports are generated as HTML and can be:
- Viewed in browser
- Printed to PDF (via browser)
- Sent via email (using Resend)
- Embedded in applications

## Report Types

### 1. Test Results Report
**Purpose:** Comprehensive summary of all test results for a fabric/brand

**API Endpoint:**
```
GET /api/reports/test-results?brandId=BRAND_ID&format=html
GET /api/reports?type=test-results&brandId=BRAND_ID&format=html
```

**Returns:**
- Test summary table with type, method, date, lab, pass/fail status
- Color-coded pass/fail badges
- Detailed result values (ICP Ag/Au ppm, antibacterial reduction %, fungal result)
- Wash count information
- Overall pass rate metric

**Parameters:**
- `brandId` (required): Brand database ID
- `format` (optional): "html" (default) or "email"
- `to` (optional): Email address if format=email

**Example:**
```bash
curl -H "x-user-id: user123" \
  "http://localhost:3000/api/reports/test-results?brandId=clm4x9z8&format=html"
```

### 2. Brand Scorecard
**Purpose:** Health dashboard showing brand metrics, pipeline stage, test performance, and upcoming milestones

**API Endpoint:**
```
GET /api/reports/brand-scorecard?brandId=BRAND_ID&format=html
GET /api/reports?type=brand-scorecard&brandId=BRAND_ID&format=html
```

**Returns:**
- Key metrics: Total fabrics, total tests, pass rate
- Pipeline stage and compliance status
- Active SOWs count
- Recent test results (last 5)
- Upcoming milestones with due dates

**Parameters:**
- `brandId` (required): Brand database ID
- `format` (optional): "html" (default) or "email"
- `to` (optional): Email address if format=email

**Example:**
```bash
curl -H "x-user-id: user123" \
  "http://localhost:3000/api/reports/brand-scorecard?brandId=clm4x9z8&format=email&to=andrew@fuzeatlas.com"
```

### 3. Compliance Report
**Purpose:** Compliance summary showing certifications status, test pass rates by type, and flagged/failed tests

**API Endpoint:**
```
GET /api/reports/compliance?brandId=BRAND_ID&format=html
GET /api/reports?type=compliance&brandId=BRAND_ID&format=html
```

**Returns:**
- Certification status table (OEKO-TEX, bluesign, ZDHC Level 3, etc.)
- Pass rate by test type with progress bars
- Flagged tests requiring attention
- Recommendations for compliance maintenance

**Parameters:**
- `brandId` (required): Brand database ID
- `format` (optional): "html" (default) or "email"
- `to` (optional): Email address if format=email

**Example:**
```bash
curl -H "x-user-id: user123" \
  "http://localhost:3000/api/reports/compliance?brandId=clm4x9z8"
```

### 4. Weekly Digest (Andrew's Weekly Drop)
**Purpose:** Executive summary of weekly activity including new tests, brands, factories, pipeline movement, and compliance updates

**API Endpoint:**
```
GET /api/reports/weekly-digest?weekOf=2026-03-09&format=html
GET /api/reports?type=weekly-digest&weekOf=2026-03-09&format=html
```

**Returns:**
- This week's test results (table with pass/fail status)
- New brands onboarded
- New factories onboarded
- Pipeline movement (brands advancing stages)
- Compliance updates (SOW status changes)
- Coming up next week (upcoming milestones)

**Parameters:**
- `weekOf` (optional): ISO date for the week (defaults to current week). Format: YYYY-MM-DD
- `format` (optional): "html" (default) or "email"
- `to` (optional): Email address if format=email

**Example:**
```bash
# Weekly digest for week starting March 9, 2026
curl -H "x-user-id: user123" \
  "http://localhost:3000/api/reports/weekly-digest?weekOf=2026-03-09&format=email&to=andrew@fuzeatlas.com"

# Current week digest
curl -H "x-user-id: user123" \
  "http://localhost:3000/api/reports/weekly-digest"
```

## API Usage

### Authentication
All requests require the `x-user-id` header:
```bash
curl -H "x-user-id: USER_ID" \
  "http://localhost:3000/api/reports/..."
```

### Response Formats

#### HTML Response (format=html)
```bash
curl -H "x-user-id: user123" \
  "http://localhost:3000/api/reports/test-results?brandId=clm4x9z8"

# Returns:
# Content-Type: text/html; charset=utf-8
# <html>...</html>
```

Can be:
- Saved as .html file and opened in browser
- Printed to PDF via browser (Ctrl+P → Save as PDF)
- Embedded in email clients
- Displayed in iframe

#### Email Response (format=email)
```bash
curl -H "x-user-id: user123" \
  "http://localhost:3000/api/reports/test-results?brandId=clm4x9z8&format=email&to=user@company.com"

# Returns:
# {
#   "success": true,
#   "message": "Test Results Report sent to user@company.com",
#   "emailId": "xxxx-xxxx-xxxx"
# }
```

Sends report via Resend email service with:
- From: `noreply@fuzeatlas.com` (or env var `RESEND_FROM_EMAIL`)
- To: Email address specified in `to` param
- Subject: "FUZE Atlas: [Report Type]"
- Body: Full HTML report formatted for email clients

### Error Responses

**Missing Auth Header:**
```json
{
  "error": "Unauthorized: x-user-id header required"
}
```

**Missing Required Parameter:**
```json
{
  "error": "brandId parameter required for test-results report"
}
```

**Brand Not Found:**
```json
{
  "error": "Brand not found"
}
```

**Email Send Failure:**
```json
{
  "error": "Failed to send email",
  "details": "..."
}
```

## Data Sources

Reports query Prisma models for real data:

### Test Results Report
- `FabricSubmission` → `TestRun` (via brand)
- `TestRun.lab` (lab name)
- `TestRun.icpResult`, `.abResult`, `.fungalResult`, `.odorResult`

### Brand Scorecard
- `Brand` (name, pipelineStage, fabrics, sows)
- `FabricSubmission` (via brand)
- `TestRun` (via submissions)
- `SOWMilestone` (upcoming milestones for brand)

### Compliance Report
- `Brand` (name)
- `FabricSubmission` → `TestRun` (for pass rate calculation)
- Hardcoded certifications (OEKO-TEX, bluesign, ZDHC) - can be enhanced

### Weekly Digest
- `TestRun` (filtered by testDate in week range, brandVisible=true)
- `Brand` (created in week)
- `Factory` (created in week)
- `SOW` (updated in week)
- `SOWMilestone` (due next week)

All queries use proper Prisma includes and relationships to avoid N+1 queries.

## HTML Design

### Branding
- Primary color: `#00b4c3` (FUZE Teal)
- Dark color: `#1A1A2E` (FUZE Dark)
- Light background: `#f5f5f5`
- Success: `#28a745` (Green)
- Warning: `#ffc107` (Yellow)
- Danger: `#dc3545` (Red)

### Email Compatibility
- Inline CSS (no style sheets)
- Table-based layout for broad email client support
- CSS fallbacks for non-supporting clients
- Responsive grid layouts
- Mobile-friendly font sizes

### Print Optimization
- Proper page breaks (`page-break-inside: avoid`)
- Print-specific margins
- Removes interactive elements
- Optimized for standard letter/A4 paper

## Implementation Details

### File Structure
```
src/lib/pdf-reports.ts
  ├─ getBaseStyles() - Common CSS template
  ├─ generateTestResultsReport(params)
  ├─ generateBrandScorecard(params)
  ├─ generateComplianceReport(params)
  └─ generateWeeklyDigest(params)

src/app/api/reports/route.ts
  └─ GET handler with type query param
     ├─ Handles test-results
     ├─ Handles brand-scorecard
     ├─ Handles compliance
     └─ Handles weekly-digest

src/app/api/reports/[reportType]/route.ts
  └─ Dynamic GET handler
     ├─ /api/reports/test-results
     ├─ /api/reports/brand-scorecard
     ├─ /api/reports/compliance
     └─ /api/reports/weekly-digest
```

### Type Safety
- All functions use TypeScript interfaces (no `any`)
- Prisma queries are properly typed
- `@ts-nocheck` used for safety due to database dependency

### Error Handling
- Try-catch blocks in API routes
- Graceful handling of missing data
- Proper HTTP status codes
- Detailed error messages in logs

### Performance
- Database queries with specific selects (no over-fetching)
- Proper use of Prisma includes
- Limited results (take: N) for large datasets
- Filtered by date ranges (weekly digest)

## Usage Examples

### Display Test Results in App
```typescript
// In Next.js component
const response = await fetch(
  `/api/reports/test-results?brandId=${brandId}`,
  { headers: { "x-user-id": userId } }
);
const html = await response.text();

// Render in iframe
<iframe srcDoc={html} />

// Or print to PDF
window.open(`/api/reports/test-results?brandId=${brandId}`);
```

### Send Weekly Digest via Email
```typescript
// Send every Monday
const response = await fetch(
  `/api/reports/weekly-digest?format=email&to=andrew@fuzeatlas.com`,
  { headers: { "x-user-id": "admin-user" } }
);
const result = await response.json();
console.log(result.message); // "Weekly Digest sent to andrew@fuzeatlas.com"
```

### Generate Compliance Report PDF
```typescript
// User clicks "Download PDF" button
const html = await fetch(
  `/api/reports/compliance?brandId=${brandId}`,
  { headers: { "x-user-id": userId } }
).then(r => r.text());

// Browser print
const printWindow = window.open('', '', 'height=400,width=800');
printWindow?.document.write(html);
printWindow?.document.close();
printWindow?.print();
```

### Create Brand Scorecard for Admin Dashboard
```typescript
// Display on admin dashboard
const response = await fetch(
  `/api/reports/brand-scorecard?brandId=${brandId}`,
  { headers: { "x-user-id": userId } }
);
const html = await response.text();

// Embed in page
document.getElementById('dashboard').innerHTML = html;
```

## Environment Variables

Required for email functionality:
```
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@fuzeatlas.com  # Optional, defaults to noreply@fuzeatlas.com
```

## Future Enhancements

1. **Advanced Filtering**
   - Filter by date range, lab, test method
   - Custom test selection for reports

2. **Scheduling**
   - Automatic weekly digest via cron
   - Scheduled report generation

3. **Customization**
   - Template selection
   - Custom branding options
   - User-defined metrics

4. **Export Formats**
   - PDF generation (using pdfkit)
   - CSV export
   - JSON export

5. **Real-time Updates**
   - Live dashboard updates
   - Notification on new test results
   - Weekly digest preview

6. **Advanced Analytics**
   - Trend analysis over time
   - Predictive pass rate forecasting
   - Compliance risk scoring

## Troubleshooting

### Report shows "No data available"
- Verify brand/fabric submission exists in database
- Check that test runs are marked as `brandVisible: true`
- Ensure related records (labs, results) are properly linked

### Email not sending
- Verify `RESEND_API_KEY` is set in environment
- Check Resend API key is valid
- Verify `to` parameter is valid email
- Check server logs for detailed error

### HTML rendering issues in email
- Some email clients have limited CSS support
- Test in target email client (Gmail, Outlook, Apple Mail)
- Use inline styles instead of classes
- Keep layout simple (avoid complex grids)

### Week calculation issues
- `weekOf` parameter should be ISO date format (YYYY-MM-DD)
- Week starts on Monday, ends on Sunday
- If date is not provided, defaults to current week

## Testing

### Test API Endpoints
```bash
# Set auth header
USER_ID="test-user"

# Test report generation
curl -H "x-user-id: $USER_ID" \
  "http://localhost:3000/api/reports/test-results?brandId=clm4x9z8"

# Test email sending (requires valid email)
curl -H "x-user-id: $USER_ID" \
  "http://localhost:3000/api/reports/test-results?brandId=clm4x9z8&format=email&to=test@example.com"

# Test weekly digest
curl -H "x-user-id: $USER_ID" \
  "http://localhost:3000/api/reports/weekly-digest?weekOf=2026-03-09"
```

### Unit Tests
Could add tests for:
- Report generation (HTML structure)
- Database queries (mocked Prisma)
- Error handling
- Email sending (mocked Resend)
- Date calculations (weekly digest)

## Production Considerations

1. **Rate Limiting**: Implement rate limiting on report endpoints
2. **Caching**: Cache reports for 15-30 minutes
3. **Logging**: Log all report generations and emails sent
4. **Monitoring**: Alert on high failure rates
5. **Backup**: Archive generated reports
6. **Compliance**: Ensure PII handling complies with regulations
