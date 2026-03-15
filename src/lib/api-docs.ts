/**
 * FUZE Atlas API Documentation
 *
 * Comprehensive list of all API endpoints organized by functional group.
 * Each endpoint includes method, path, description, auth requirements, and request/response summaries.
 *
 * AUTH NOTE: All endpoints except /api/auth/* require a valid JWT session cookie
 */

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  auth: 'public' | 'user' | 'admin';
  requestBody?: string;
  response?: string;
  notes?: string;
}

export interface ApiGroup {
  group: string;
  description: string;
  endpoints: ApiEndpoint[];
}

export const apiDocumentation: ApiGroup[] = [
  // ── AUTHENTICATION ──
  {
    group: 'Authentication',
    description: 'User authentication and session management',
    endpoints: [
      {
        method: 'POST',
        path: '/api/auth/login',
        description: 'Login with email and password. Returns user session and JWT token.',
        auth: 'public',
        requestBody: '{ email, password }',
        response: '{ ok, user, mustChangePassword, emailVerified }',
        notes: 'Rate limited to 5 attempts per 15 minutes per IP',
      },
      {
        method: 'POST',
        path: '/api/auth/logout',
        description: 'Clear session cookie and logout user.',
        auth: 'user',
        response: '{ ok }',
      },
      {
        method: 'GET',
        path: '/api/auth/me',
        description: 'Get current authenticated user profile.',
        auth: 'user',
        response: '{ ok, user }',
      },
      {
        method: 'POST',
        path: '/api/auth/reset-password',
        description: 'Request password reset with email verification link.',
        auth: 'public',
        requestBody: '{ email }',
        response: '{ ok, message }',
      },
      {
        method: 'POST',
        path: '/api/auth/change-password',
        description: 'Change password for authenticated user.',
        auth: 'user',
        requestBody: '{ currentPassword, newPassword }',
        response: '{ ok }',
      },
      {
        method: 'POST',
        path: '/api/auth/send-verification',
        description: 'Send email verification link to user.',
        auth: 'user',
        response: '{ ok, message }',
      },
      {
        method: 'POST',
        path: '/api/auth/verify-email',
        description: 'Verify email with token from verification link.',
        auth: 'public',
        requestBody: '{ token }',
        response: '{ ok }',
      },
      {
        method: 'GET',
        path: '/api/auth/setup-check',
        description: 'Check if initial admin setup is required.',
        auth: 'public',
        response: '{ ok, setupRequired }',
      },
    ],
  },

  // ── BRANDS ──
  {
    group: 'Brands',
    description: 'Brand management and pipeline tracking',
    endpoints: [
      {
        method: 'GET',
        path: '/api/brands',
        description: 'List all brands grouped by pipeline stage. Includes counts for fabrics, submissions, factories, contacts.',
        auth: 'user',
        response: '{ ok, grouped, brands, total }',
      },
      {
        method: 'POST',
        path: '/api/brands',
        description: 'Create new brand with initial pipeline stage and contact info.',
        auth: 'user',
        requestBody: '{ name, pipelineStage, customerType, website, linkedInProfile, ... }',
        response: '{ ok, brand }',
      },
      {
        method: 'GET',
        path: '/api/brands/[id]',
        description: 'Get detailed brand profile including financials, contacts, and relationships.',
        auth: 'user',
        response: '{ ok, brand }',
      },
      {
        method: 'PUT',
        path: '/api/brands/[id]',
        description: 'Update brand details, pipeline stage, or contact information.',
        auth: 'user',
        requestBody: '{ pipelineStage, website, backgroundInfo, ... }',
        response: '{ ok, brand }',
      },
      {
        method: 'GET',
        path: '/api/brands/[id]/products',
        description: 'Get products associated with a brand.',
        auth: 'user',
        response: '{ ok, products }',
      },
      {
        method: 'GET',
        path: '/api/brands/[id]/users',
        description: 'List users with access to brand portal.',
        auth: 'user',
        response: '{ ok, users }',
      },
    ],
  },

  // ── FACTORIES ──
  {
    group: 'Factories',
    description: 'Factory and manufacturing partner management',
    endpoints: [
      {
        method: 'GET',
        path: '/api/factories',
        description: 'List all factories with location, specialty, and test capabilities.',
        auth: 'user',
        response: '{ ok, factories, total }',
      },
      {
        method: 'POST',
        path: '/api/factories',
        description: 'Create new factory partner with location and capability details.',
        auth: 'user',
        requestBody: '{ name, chineseName, country, city, specialty, capability, ... }',
        response: '{ ok, factory }',
      },
      {
        method: 'GET',
        path: '/api/factories/[id]',
        description: 'Get factory details including contacts, capacity, and test history.',
        auth: 'user',
        response: '{ ok, factory }',
      },
      {
        method: 'PUT',
        path: '/api/factories/[id]',
        description: 'Update factory information, capabilities, or contacts.',
        auth: 'user',
        requestBody: '{ name, specialty, capability, ... }',
        response: '{ ok, factory }',
      },
    ],
  },

  // ── FABRICS ──
  {
    group: 'Fabrics',
    description: 'Fabric sample and specification management',
    endpoints: [
      {
        method: 'GET',
        path: '/api/fabrics',
        description: 'List all fabrics with composition, specifications, and test counts.',
        auth: 'user',
        response: '{ ok, fabrics, total }',
      },
      {
        method: 'POST',
        path: '/api/fabrics',
        description: 'Create or import fabric with composition, specifications, and optional intake form data.',
        auth: 'user',
        requestBody: '{ fuzeNumber, customerCode, construction, color, weightGsm, contents, ... }',
        response: '{ ok, fabric, fuzeNumber }',
        notes: 'Auto-assigns FUZE number if not provided',
      },
      {
        method: 'GET',
        path: '/api/fabrics/[id]',
        description: 'Get detailed fabric specification and composition.',
        auth: 'user',
        response: '{ ok, fabric }',
      },
      {
        method: 'PUT',
        path: '/api/fabrics/[id]',
        description: 'Update fabric specifications, composition, or finish details.',
        auth: 'user',
        requestBody: '{ color, weightGsm, construction, ... }',
        response: '{ ok, fabric }',
      },
      {
        method: 'POST',
        path: '/api/fabrics/enrich',
        description: 'Enrich fabric data with parsed composition and specifications.',
        auth: 'user',
        requestBody: '{ fabricId, rawComposition, ... }',
        response: '{ ok, fabric }',
      },
      {
        method: 'POST',
        path: '/api/fabrics/enrich/icp',
        description: 'Enrich fabric with ICP test recommendations based on composition.',
        auth: 'user',
        requestBody: '{ fabricId, composition }',
        response: '{ ok, recommendations }',
      },
    ],
  },

  // ── TESTS & TEST RUNS ──
  {
    group: 'Tests',
    description: 'Test execution, results, and documentation',
    endpoints: [
      {
        method: 'GET',
        path: '/api/tests',
        description: 'List test runs with filtering by type, project, or brand. Includes result counts and pagination.',
        auth: 'user',
        response: '{ ok, runs, typeBreakdown, resultCounts, total, totalPages }',
        notes: 'Supports pagination and result filtering',
      },
      {
        method: 'POST',
        path: '/api/tests',
        description: 'Create test run record for a submission.',
        auth: 'user',
        requestBody: '{ submissionId, labId, testType, testDate, testReportNumber, ... }',
        response: '{ ok, testRun }',
      },
      {
        method: 'GET',
        path: '/api/tests/[id]',
        description: 'Get test run details including all result types (ICP, AB, Fungal, Odor).',
        auth: 'user',
        response: '{ ok, testRun }',
      },
      {
        method: 'PUT',
        path: '/api/tests/[id]',
        description: 'Update test run status, results, or notes.',
        auth: 'user',
        requestBody: '{ status, notes, resultData }',
        response: '{ ok, testRun }',
      },
      {
        method: 'GET',
        path: '/api/tests/by-entity',
        description: 'Get tests grouped by entity type (brand, factory, lab).',
        auth: 'user',
        response: '{ ok, grouped }',
      },
      {
        method: 'POST',
        path: '/api/tests/confirm',
        description: 'Confirm test result accuracy and mark as verified.',
        auth: 'user',
        requestBody: '{ testId, confirmedBy }',
        response: '{ ok }',
      },
      {
        method: 'POST',
        path: '/api/tests/upload',
        description: 'Upload test result document or certificate.',
        auth: 'user',
        requestBody: 'multipart/form-data { file, testId }',
        response: '{ ok, document }',
      },
      {
        method: 'POST',
        path: '/api/tests/batch-stamp',
        description: 'Batch approve and stamp multiple test results.',
        auth: 'admin',
        requestBody: '{ testIds }',
        response: '{ ok, stamped }',
      },
      {
        method: 'GET',
        path: '/api/tests/[id]/certificate',
        description: 'Generate or retrieve test certificate PDF.',
        auth: 'user',
        response: 'application/pdf',
      },
      {
        method: 'POST',
        path: '/api/tests/[id]/assign',
        description: 'Assign test to specific lab.',
        auth: 'user',
        requestBody: '{ labId }',
        response: '{ ok }',
      },
    ],
  },

  // ── LABS ──
  {
    group: 'Labs',
    description: 'Testing laboratory management and capabilities',
    endpoints: [
      {
        method: 'GET',
        path: '/api/labs',
        description: 'List all active testing labs with capabilities, accreditations, and location filters.',
        auth: 'user',
        response: '{ ok, labs, countries, total }',
        notes: 'Supports filtering by country and test capability (ICP, AB, Fungal, Odor, UV)',
      },
      {
        method: 'POST',
        path: '/api/labs',
        description: 'Create new testing lab with capabilities and accreditations.',
        auth: 'user',
        requestBody: '{ name, city, country, region, website, email, phone, icpApproved, ... }',
        response: '{ ok, lab }',
      },
      {
        method: 'GET',
        path: '/api/labs/[id]',
        description: 'Get detailed lab profile including test history and capabilities.',
        auth: 'user',
        response: '{ ok, lab }',
      },
      {
        method: 'PUT',
        path: '/api/labs/[id]',
        description: 'Update lab details, capabilities, or contact information.',
        auth: 'user',
        requestBody: '{ name, capabilities, accreditations, ... }',
        response: '{ ok, lab }',
      },
      {
        method: 'GET',
        path: '/api/labs/[id]/documents',
        description: 'Get lab certificates, accreditations, and supporting documents.',
        auth: 'user',
        response: '{ ok, documents }',
      },
    ],
  },

  // ── SUBMISSIONS & TEST REQUESTS ──
  {
    group: 'Submissions',
    description: 'Sample submissions and test request tracking',
    endpoints: [
      {
        method: 'GET',
        path: '/api/submissions',
        description: 'List all fabric submissions with status and test history.',
        auth: 'user',
        response: '{ ok, submissions, total }',
      },
      {
        method: 'POST',
        path: '/api/submissions',
        description: 'Create fabric submission linking fabric, brand, factory, and lab.',
        auth: 'user',
        requestBody: '{ fabricId, brandId, factoryId, labId, status, ... }',
        response: '{ ok, submission }',
      },
      {
        method: 'GET',
        path: '/api/test-requests',
        description: 'List test requests with filtering by status, lab, or brand.',
        auth: 'user',
        response: '{ ok, testRequests, total, pages }',
      },
      {
        method: 'POST',
        path: '/api/test-requests',
        description: 'Create test request for lab analysis.',
        auth: 'user',
        requestBody: '{ fabricId, labId, testType, poNumber, ... }',
        response: '{ ok, testRequest }',
      },
      {
        method: 'GET',
        path: '/api/test-requests/[id]',
        description: 'Get test request details and associated test runs.',
        auth: 'user',
        response: '{ ok, testRequest }',
      },
      {
        method: 'PUT',
        path: '/api/test-requests/[id]',
        description: 'Update test request status or details.',
        auth: 'user',
        requestBody: '{ status, notes, ... }',
        response: '{ ok, testRequest }',
      },
      {
        method: 'GET',
        path: '/api/test-requests/[id]/pdf',
        description: 'Generate test request PDF document.',
        auth: 'user',
        response: 'application/pdf',
      },
    ],
  },

  // ── SOW (STATEMENT OF WORK) ──
  {
    group: 'SOW',
    description: 'Statement of Work and commercial agreements',
    endpoints: [
      {
        method: 'GET',
        path: '/api/sow',
        description: 'List all SOWs with milestones, products, and brand information.',
        auth: 'user',
        response: '{ ok, sows }',
      },
      {
        method: 'POST',
        path: '/api/sow',
        description: 'Create new SOW with commercial qualification, success criteria, and financial terms.',
        auth: 'user',
        requestBody: '{ brandId, title, status, executiveSponsor, factoryId, projectedAnnualUnits, ... }',
        response: '{ ok, sow, revenueWarning }',
        notes: 'Validates Stage 0 gate requirements; warns on revenue < $25K',
      },
      {
        method: 'GET',
        path: '/api/sow/[id]',
        description: 'Get detailed SOW with milestones, documents, and commercial terms.',
        auth: 'user',
        response: '{ ok, sow }',
      },
      {
        method: 'PUT',
        path: '/api/sow/[id]',
        description: 'Update SOW status, milestones, or commercial terms.',
        auth: 'user',
        requestBody: '{ status, title, milestones, ... }',
        response: '{ ok, sow }',
      },
      {
        method: 'GET',
        path: '/api/sow/[id]/pdf',
        description: 'Generate SOW PDF document for signing.',
        auth: 'user',
        response: 'application/pdf',
      },
    ],
  },

  // ── DOCUMENTS ──
  {
    group: 'Documents',
    description: 'Document storage and management',
    endpoints: [
      {
        method: 'GET',
        path: '/api/documents/[id]',
        description: 'Get document metadata and download link.',
        auth: 'user',
        response: '{ ok, document }',
      },
      {
        method: 'DELETE',
        path: '/api/documents/[id]',
        description: 'Delete document from storage.',
        auth: 'user',
        response: '{ ok }',
      },
      {
        method: 'GET',
        path: '/api/documents/[id]/download',
        description: 'Download document file.',
        auth: 'user',
        response: 'file/binary',
      },
    ],
  },

  // ── INVOICES ──
  {
    group: 'Invoices',
    description: 'Invoice generation, tracking, and payment management',
    endpoints: [
      {
        method: 'GET',
        path: '/api/invoices',
        description: 'List invoices with status filters and financial summary metrics.',
        auth: 'user',
        response: '{ ok, invoices, summary, total, totalPages }',
        notes: 'Includes collection rates and status-based totals',
      },
      {
        method: 'POST',
        path: '/api/invoices',
        description: 'Create invoice for distributor or factory.',
        auth: 'user',
        requestBody: '{ invoiceNumber, amount, status, distributorId, factoryId, ... }',
        response: '{ ok, invoice }',
        notes: 'Requires distributor and factory IDs and positive amount',
      },
      {
        method: 'GET',
        path: '/api/invoices/[id]',
        description: 'Get invoice details with payment history.',
        auth: 'user',
        response: '{ ok, invoice }',
      },
      {
        method: 'PUT',
        path: '/api/invoices/[id]',
        description: 'Update invoice status or payment information.',
        auth: 'user',
        requestBody: '{ status, paidAmount, paidDate, ... }',
        response: '{ ok, invoice }',
      },
    ],
  },

  // ── CONTACTS ──
  {
    group: 'Contacts',
    description: 'Contact person management across brands and factories',
    endpoints: [
      {
        method: 'GET',
        path: '/api/contacts',
        description: 'List all contacts with associated brand or factory.',
        auth: 'user',
        response: '{ ok, contacts, total }',
      },
      {
        method: 'POST',
        path: '/api/contacts',
        description: 'Create new contact for brand or factory.',
        auth: 'user',
        requestBody: '{ name, firstName, lastName, email, phone, brandId or factoryId, ... }',
        response: '{ ok, contact }',
      },
      {
        method: 'GET',
        path: '/api/contacts/[id]',
        description: 'Get contact details including associated activities.',
        auth: 'user',
        response: '{ ok, contact }',
      },
      {
        method: 'PUT',
        path: '/api/contacts/[id]',
        description: 'Update contact information or preferences.',
        auth: 'user',
        requestBody: '{ name, email, phone, title, ... }',
        response: '{ ok, contact }',
      },
      {
        method: 'DELETE',
        path: '/api/contacts/[id]',
        description: 'Delete contact record.',
        auth: 'user',
        response: '{ ok }',
      },
    ],
  },

  // ── NOTES ──
  {
    group: 'Notes',
    description: 'Internal notes and activity logging',
    endpoints: [
      {
        method: 'GET',
        path: '/api/notes',
        description: 'List notes with optional filtering by entity type and owner.',
        auth: 'user',
        response: '{ ok, notes }',
      },
      {
        method: 'POST',
        path: '/api/notes',
        description: 'Create note attached to brand, fabric, test, or other entity.',
        auth: 'user',
        requestBody: '{ content, entityType, entityId, visibility }',
        response: '{ ok, note }',
      },
      {
        method: 'GET',
        path: '/api/notes/[id]',
        description: 'Get note details.',
        auth: 'user',
        response: '{ ok, note }',
      },
      {
        method: 'PUT',
        path: '/api/notes/[id]',
        description: 'Update note content or visibility.',
        auth: 'user',
        requestBody: '{ content, visibility }',
        response: '{ ok, note }',
      },
      {
        method: 'DELETE',
        path: '/api/notes/[id]',
        description: 'Delete note.',
        auth: 'user',
        response: '{ ok }',
      },
    ],
  },

  // ── NOTIFICATIONS ──
  {
    group: 'Notifications',
    description: 'User notifications and alerts',
    endpoints: [
      {
        method: 'GET',
        path: '/api/notifications',
        description: 'List user notifications with unread count. Supports unread filter.',
        auth: 'user',
        response: '{ ok, notifications, unreadCount }',
      },
      {
        method: 'POST',
        path: '/api/notifications',
        description: 'Create notification for user (admin/employee only).',
        auth: 'admin',
        requestBody: '{ userId, type, title, message, link }',
        response: '{ ok, notification }',
      },
      {
        method: 'PATCH',
        path: '/api/notifications',
        description: 'Mark notifications as read (all or specific IDs).',
        auth: 'user',
        requestBody: '{ ids or all: true }',
        response: '{ ok }',
      },
    ],
  },

  // ── SEARCH ──
  {
    group: 'Search',
    description: 'Global search across entities',
    endpoints: [
      {
        method: 'GET',
        path: '/api/search',
        description: 'Global search returning results from brands, factories, fabrics, labs, contacts, and tests.',
        auth: 'user',
        response: '{ results, query }',
        notes: 'Requires minimum 2 character query; returns up to 8 results per type',
      },
    ],
  },

  // ── MEETINGS & CALENDAR ──
  {
    group: 'Meetings',
    description: 'Meeting scheduling and management',
    endpoints: [
      {
        method: 'GET',
        path: '/api/meetings',
        description: 'List meetings with filtering by brand, project, status, or date range. Includes statistics.',
        auth: 'user',
        response: '{ ok, meetings, stats }',
      },
      {
        method: 'POST',
        path: '/api/meetings',
        description: 'Create meeting with Teams link generation and attendee list.',
        auth: 'user',
        requestBody: '{ title, startTime, endTime, meetingType, timezone, brandId, attendees, ... }',
        response: '{ ok, meeting }',
      },
      {
        method: 'GET',
        path: '/api/meetings/[id]',
        description: 'Get meeting details including attendee responses.',
        auth: 'user',
        response: '{ ok, meeting }',
      },
      {
        method: 'PUT',
        path: '/api/meetings/[id]',
        description: 'Update meeting details, time, or attendee list.',
        auth: 'user',
        requestBody: '{ title, startTime, endTime, attendees, ... }',
        response: '{ ok, meeting }',
      },
      {
        method: 'DELETE',
        path: '/api/meetings/[id]',
        description: 'Cancel meeting.',
        auth: 'user',
        response: '{ ok }',
      },
      {
        method: 'GET',
        path: '/api/meetings/templates',
        description: 'Get available meeting templates for different pipeline stages.',
        auth: 'user',
        response: '{ ok, templates }',
      },
      {
        method: 'GET',
        path: '/api/meetings/[id]/ics',
        description: 'Generate iCalendar file for meeting.',
        auth: 'user',
        response: 'text/calendar',
      },
      {
        method: 'GET',
        path: '/api/availability/slots',
        description: 'Get available time slots based on organizer and attendee availability.',
        auth: 'user',
        response: '{ ok, slots }',
      },
      {
        method: 'POST',
        path: '/api/availability/book',
        description: 'Book available time slot and create meeting.',
        auth: 'user',
        requestBody: '{ slotId, title, attendees, ... }',
        response: '{ ok, meeting }',
      },
    ],
  },

  // ── PIPELINES & PROJECTS ──
  {
    group: 'Pipeline',
    description: 'Sales pipeline and project management',
    endpoints: [
      {
        method: 'GET',
        path: '/api/pipeline',
        description: 'Get pipeline overview with brand distribution by stage and metrics.',
        auth: 'user',
        response: '{ ok, stages, total }',
      },
      {
        method: 'GET',
        path: '/api/projects',
        description: 'List all projects with status and participant information.',
        auth: 'user',
        response: '{ ok, projects, total }',
      },
      {
        method: 'POST',
        path: '/api/projects',
        description: 'Create project linking brand, factory, and participants.',
        auth: 'user',
        requestBody: '{ name, brandId, factoryId, status, description, ... }',
        response: '{ ok, project }',
      },
      {
        method: 'GET',
        path: '/api/projects/[id]',
        description: 'Get project details including participants and timeline.',
        auth: 'user',
        response: '{ ok, project }',
      },
      {
        method: 'PUT',
        path: '/api/projects/[id]',
        description: 'Update project status, timeline, or participant list.',
        auth: 'user',
        requestBody: '{ status, title, description, ... }',
        response: '{ ok, project }',
      },
    ],
  },

  // ── USERS & PERMISSIONS ──
  {
    group: 'Users',
    description: 'User account and permission management',
    endpoints: [
      {
        method: 'GET',
        path: '/api/users',
        description: 'List all users with roles and account status.',
        auth: 'admin',
        response: '{ ok, users, total }',
      },
      {
        method: 'POST',
        path: '/api/users',
        description: 'Create new user account with role assignment.',
        auth: 'admin',
        requestBody: '{ name, email, role, status, ... }',
        response: '{ ok, user }',
      },
      {
        method: 'GET',
        path: '/api/users/[id]',
        description: 'Get user profile and permissions.',
        auth: 'user',
        response: '{ ok, user }',
      },
      {
        method: 'PUT',
        path: '/api/users/[id]',
        description: 'Update user profile, role, or status.',
        auth: 'admin',
        requestBody: '{ name, email, role, status, ... }',
        response: '{ ok, user }',
      },
      {
        method: 'GET',
        path: '/api/settings/users',
        description: 'List users for admin settings (with extended fields).',
        auth: 'admin',
        response: '{ ok, users }',
      },
      {
        method: 'GET',
        path: '/api/settings/users/[id]',
        description: 'Get user settings and preferences.',
        auth: 'admin',
        response: '{ ok, user }',
      },
      {
        method: 'PUT',
        path: '/api/settings/users/[id]',
        description: 'Update user settings and preferences.',
        auth: 'admin',
        requestBody: '{ settings }',
        response: '{ ok, user }',
      },
    ],
  },

  // ── ADMIN ──
  {
    group: 'Admin',
    description: 'Administrative functions and system management',
    endpoints: [
      {
        method: 'GET',
        path: '/api/admin/pending-counts',
        description: 'Get counts of pending items requiring approval (tests, SOWs, etc).',
        auth: 'admin',
        response: '{ ok, pendingTests, pendingSOWs, ... }',
      },
      {
        method: 'GET',
        path: '/api/admin/competitor-pricing',
        description: 'Get competitor pricing intelligence data.',
        auth: 'admin',
        response: '{ ok, competitors }',
      },
      {
        method: 'POST',
        path: '/api/admin/distributor-docs',
        description: 'Upload distributor documentation.',
        auth: 'admin',
        requestBody: 'multipart/form-data',
        response: '{ ok, document }',
      },
      {
        method: 'GET',
        path: '/api/admin/distributor-docs/[id]',
        description: 'Get distributor document.',
        auth: 'admin',
        response: '{ ok, document }',
      },
      {
        method: 'GET',
        path: '/api/admin/distributor-docs/[id]/pdf',
        description: 'Download distributor document as PDF.',
        auth: 'admin',
        response: 'application/pdf',
      },
      {
        method: 'GET',
        path: '/api/admin/sample-trials',
        description: 'List sample trial runs for admin review.',
        auth: 'admin',
        response: '{ ok, trials }',
      },
      {
        method: 'POST',
        path: '/api/admin/migrate-s3',
        description: 'Trigger S3 storage migration (maintenance endpoint).',
        auth: 'admin',
        response: '{ ok }',
      },
    ],
  },

  // ── PORTALS (BRAND, FACTORY, DISTRIBUTOR) ──
  {
    group: 'Portals',
    description: 'Brand, Factory, and Distributor customer portal endpoints',
    endpoints: [
      {
        method: 'GET',
        path: '/api/brand-portal',
        description: 'Get brand portal data including samples, tests, and documents.',
        auth: 'user',
        response: '{ ok, samples, tests, documents }',
      },
      {
        method: 'GET',
        path: '/api/factory-portal/tests',
        description: 'Get tests visible to factory portal user.',
        auth: 'user',
        response: '{ ok, tests }',
      },
      {
        method: 'POST',
        path: '/api/factory-portal/request-test',
        description: 'Factory request test for fabric.',
        auth: 'user',
        requestBody: '{ fabricId, testType, ... }',
        response: '{ ok, testRequest }',
      },
      {
        method: 'GET',
        path: '/api/factory-portal/intake',
        description: 'Get fabric intake forms for factory.',
        auth: 'user',
        response: '{ ok, intakeForms }',
      },
      {
        method: 'POST',
        path: '/api/factory-portal/intake',
        description: 'Submit fabric intake form.',
        auth: 'user',
        requestBody: '{ formData }',
        response: '{ ok, intakeForm }',
      },
      {
        method: 'GET',
        path: '/api/factory-portal/submissions',
        description: 'Get submissions visible to factory.',
        auth: 'user',
        response: '{ ok, submissions }',
      },
      {
        method: 'GET',
        path: '/api/factory-portal/fabrics',
        description: 'Get fabrics in factory library.',
        auth: 'user',
        response: '{ ok, fabrics }',
      },
      {
        method: 'GET',
        path: '/api/factory-portal/stats',
        description: 'Get factory portal statistics.',
        auth: 'user',
        response: '{ ok, stats }',
      },
      {
        method: 'GET',
        path: '/api/factory-portal/sample-trial/[id]',
        description: 'Get sample trial details.',
        auth: 'user',
        response: '{ ok, trial }',
      },
      {
        method: 'POST',
        path: '/api/factory-portal/sample-trial/[id]/icp-submit',
        description: 'Submit ICP validation results.',
        auth: 'user',
        requestBody: '{ result, agValue, ... }',
        response: '{ ok }',
      },
      {
        method: 'GET',
        path: '/api/distributor-portal/invoices',
        description: 'Get invoices visible to distributor.',
        auth: 'user',
        response: '{ ok, invoices }',
      },
      {
        method: 'GET',
        path: '/api/distributor-portal/documents',
        description: 'Get documents available to distributor.',
        auth: 'user',
        response: '{ ok, documents }',
      },
      {
        method: 'GET',
        path: '/api/distributor-portal/stats',
        description: 'Get distributor portal statistics.',
        auth: 'user',
        response: '{ ok, stats }',
      },
    ],
  },

  // ── RECIPES ──
  {
    group: 'Recipes',
    description: 'Fabric treatment recipes and formulations',
    endpoints: [
      {
        method: 'GET',
        path: '/api/recipes',
        description: 'List fabric recipes with optional matching against fabric specifications.',
        auth: 'user',
        response: '{ ok, recipes }',
        notes: 'Supports matching by GSM, fiber content, and yarn type',
      },
      {
        method: 'POST',
        path: '/api/recipes',
        description: 'Create new fabric treatment recipe with process parameters.',
        auth: 'user',
        requestBody: '{ name, fabricType, fiberContent, gsmMin, gsmMax, applicationMethod, ... }',
        response: '{ ok, recipe }',
      },
      {
        method: 'GET',
        path: '/api/recipes/[id]',
        description: 'Get recipe details including test results and validation data.',
        auth: 'user',
        response: '{ ok, recipe }',
      },
      {
        method: 'PUT',
        path: '/api/recipes/[id]',
        description: 'Update recipe formulation or process parameters.',
        auth: 'user',
        requestBody: '{ parameters, testResults, ... }',
        response: '{ ok, recipe }',
      },
    ],
  },

  // ── COMPLIANCE & REPORTING ──
  {
    group: 'Reports',
    description: 'Reporting and analytics',
    endpoints: [
      {
        method: 'GET',
        path: '/api/reports/weekly',
        description: 'Get weekly report summary including tests, submissions, and pipeline metrics.',
        auth: 'user',
        response: '{ ok, summary, metrics }',
      },
      {
        method: 'GET',
        path: '/api/audit-log',
        description: 'Get audit log of system changes (admin only).',
        auth: 'admin',
        response: '{ ok, entries }',
      },
    ],
  },

  // ── BRAND ENGAGEMENT & REVENUE ──
  {
    group: 'Revenue',
    description: 'Revenue tracking and financial forecasting',
    endpoints: [
      {
        method: 'GET',
        path: '/api/revenue/forecast',
        description: 'Get revenue forecast by brand, project, or time period.',
        auth: 'user',
        response: '{ ok, forecast }',
      },
      {
        method: 'GET',
        path: '/api/brand-engagement',
        description: 'Get brand engagement metrics and activity history.',
        auth: 'user',
        response: '{ ok, engagement }',
      },
    ],
  },

  // ── UTILITIES ──
  {
    group: 'System',
    description: 'System utilities and health checks',
    endpoints: [
      {
        method: 'GET',
        path: '/api/health',
        description: 'Health check endpoint for monitoring and uptime verification.',
        auth: 'public',
        response: '{ ok }',
      },
      {
        method: 'GET',
        path: '/api/core/stats',
        description: 'Get core system statistics (counts of entities).',
        auth: 'user',
        response: '{ ok, brands, factories, fabrics, tests, ... }',
      },
      {
        method: 'GET',
        path: '/api/dashboard',
        description: 'Get dashboard overview with key metrics and recent activity.',
        auth: 'user',
        response: '{ ok, metrics, recentActivity }',
      },
      {
        method: 'GET',
        path: '/api/exchange-rates',
        description: 'Get current exchange rates for currency conversion.',
        auth: 'user',
        response: '{ ok, rates }',
      },
      {
        method: 'GET',
        path: '/api/db/inspect',
        description: 'Database inspection endpoint for debugging (dev only).',
        auth: 'admin',
        response: '{ ok, schema }',
      },
    ],
  },

  // ── INGEST & IMPORT ──
  {
    group: 'Import',
    description: 'Data import and ingestion',
    endpoints: [
      {
        method: 'POST',
        path: '/api/ingest/csv',
        description: 'Import bulk data from CSV file (fabrics, submissions, tests).',
        auth: 'user',
        requestBody: 'multipart/form-data { file }',
        response: '{ ok, imported, errors }',
      },
      {
        method: 'POST',
        path: '/api/seed/brand-demo',
        description: 'Seed demo data for testing (dev endpoint).',
        auth: 'admin',
        response: '{ ok, created }',
      },
    ],
  },

  // ── FABRIC LIBRARY ──
  {
    group: 'Fabric Library',
    description: 'Searchable fabric library and specifications',
    endpoints: [
      {
        method: 'GET',
        path: '/api/fabric-library',
        description: 'Search fabric library by construction, GSM, yarn type, or composition.',
        auth: 'user',
        response: '{ ok, fabrics, total }',
      },
    ],
  },

  // ── ACCESS CONTROL ──
  {
    group: 'Access Control',
    description: 'Access requests and permissions',
    endpoints: [
      {
        method: 'GET',
        path: '/api/access-requests',
        description: 'List pending access requests.',
        auth: 'admin',
        response: '{ ok, requests }',
      },
      {
        method: 'POST',
        path: '/api/access-requests',
        description: 'Submit request for portal or entity access.',
        auth: 'user',
        requestBody: '{ entityType, entityId, requestType, reason }',
        response: '{ ok, request }',
      },
      {
        method: 'GET',
        path: '/api/access-requests/[id]',
        description: 'Get access request details.',
        auth: 'admin',
        response: '{ ok, request }',
      },
      {
        method: 'PUT',
        path: '/api/access-requests/[id]',
        description: 'Approve or reject access request.',
        auth: 'admin',
        requestBody: '{ status, notes }',
        response: '{ ok }',
      },
    ],
  },

  // ── BRAND-FACTORY RELATIONSHIPS ──
  {
    group: 'Relationships',
    description: 'Brand-factory and other entity relationships',
    endpoints: [
      {
        method: 'GET',
        path: '/api/brand-factory',
        description: 'Get brand-factory relationships and collaboration status.',
        auth: 'user',
        response: '{ ok, relationships }',
      },
    ],
  },
];

export function getEndpointsByGroup(groupName: string): ApiEndpoint[] {
  const group = apiDocumentation.find(g => g.group === groupName);
  return group?.endpoints || [];
}

export function getAllEndpoints(): ApiEndpoint[] {
  return apiDocumentation.flatMap(group => group.endpoints);
}

export function searchEndpoints(query: string): ApiEndpoint[] {
  const lowerQuery = query.toLowerCase();
  return getAllEndpoints().filter(endpoint =>
    endpoint.path.toLowerCase().includes(lowerQuery) ||
    endpoint.description.toLowerCase().includes(lowerQuery) ||
    endpoint.method.toLowerCase().includes(lowerQuery)
  );
}
