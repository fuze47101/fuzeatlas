// @ts-nocheck

const FUZE_COLOR = "#00b4c3";

function emailWrapper(content: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; padding: 20px 0; border-bottom: 3px solid ${FUZE_COLOR};">
        <h1 style="margin: 0; color: ${FUZE_COLOR}; font-size: 24px;">FUZE Atlas</h1>
      </div>
      <div style="padding: 24px 0;">
        ${content}
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding: 16px 0; text-align: center; color: #9ca3af; font-size: 12px;">
        FUZE Biotech &mdash; Antimicrobial Textile Solutions
      </div>
    </div>
  `;
}

export interface WeeklyDigestData {
  weekStartDate: string;
  weekEndDate: string;
  testStats: {
    completed: number;
    passed: number;
    failed: number;
    retesting: number;
  };
  newFabrics: number;
  notableResults: Array<{
    testName: string;
    result: 'PASSED' | 'FAILED' | 'RETEST';
    brandName: string;
    fabricName: string;
  }>;
  pipelineMovements: Array<{
    brandName: string;
    fromStage: string;
    toStage: string;
  }>;
  newOnboarded: {
    brands: Array<{ name: string; contact?: string }>;
    factories: Array<{ name: string; contact?: string }>;
    users: number;
  };
  industryIntel: Array<{
    title: string;
    summary: string;
    link?: string;
  }>;
  upcomingMilestones: Array<{
    title: string;
    date: string;
  }>;
  dashboardUrl?: string;
  unsubscribeUrl?: string;
}

export function weeklyDigestTemplate(data: WeeklyDigestData): string {
  const resultBadgeColor = (result: string) => {
    if (result === 'PASSED') return '#059669';
    if (result === 'FAILED') return '#dc2626';
    if (result === 'RETEST') return '#d97706';
    return '#6b7280';
  };

  const resultLabel = (result: string) => {
    if (result === 'PASSED') return '✓ PASSED';
    if (result === 'FAILED') return '✗ FAILED';
    if (result === 'RETEST') return '⟳ RETEST';
    return result;
  };

  const notableResultsHtml = data.notableResults
    .slice(0, 5)
    .map(
      (result) => `
    <div style="background: #f9fafb; border-left: 4px solid ${resultBadgeColor(result.result)}; padding: 12px; margin: 8px 0; border-radius: 0 4px 4px 0;">
      <p style="margin: 0 0 4px; font-weight: 600; color: #1a1a2e;">${result.testName}</p>
      <p style="margin: 0 0 4px; color: #4b5563; font-size: 13px;"><strong>${result.brandName}</strong> / ${result.fabricName}</p>
      <p style="margin: 0; color: ${resultBadgeColor(result.result)}; font-weight: 700; font-size: 13px;">${resultLabel(result.result)}</p>
    </div>
  `
    )
    .join('');

  const pipelineHtml = data.pipelineMovements
    .slice(0, 5)
    .map(
      (move) => `
    <div style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 13px;"><strong>${move.brandName}</strong></p>
      <p style="margin: 4px 0 0; color: #6b7280; font-size: 12px;">${move.fromStage} → <strong style="color: ${FUZE_COLOR};">${move.toStage}</strong></p>
    </div>
  `
    )
    .join('');

  const newBrandsHtml = data.newOnboarded.brands
    .map((b) => `<li style="margin: 4px 0; color: #4b5563; font-size: 13px;"><strong>${b.name}</strong>${b.contact ? ` (${b.contact})` : ''}</li>`)
    .join('');

  const newFactoriesHtml = data.newOnboarded.factories
    .map((f) => `<li style="margin: 4px 0; color: #4b5563; font-size: 13px;"><strong>${f.name}</strong>${f.contact ? ` (${f.contact})` : ''}</li>`)
    .join('');

  const industryHtml = data.industryIntel
    .slice(0, 3)
    .map(
      (item) => `
    <div style="background: #f0fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 12px; margin: 8px 0; border-radius: 0 4px 4px 0;">
      <p style="margin: 0 0 4px; font-weight: 600; color: #1a1a2e; font-size: 13px;">${item.title}</p>
      <p style="margin: 0 0 8px; color: #4b5563; font-size: 12px; line-height: 1.5;">${item.summary}</p>
      ${item.link ? `<a href="${item.link}" style="color: ${FUZE_COLOR}; text-decoration: none; font-weight: 500; font-size: 12px;">Read more →</a>` : ''}
    </div>
  `
    )
    .join('');

  const upcomingHtml = data.upcomingMilestones
    .slice(0, 3)
    .map(
      (m) => `
    <div style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
      <p style="margin: 0; color: #4b5563; font-size: 13px; font-weight: 500;">${m.title}</p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">${m.date}</p>
    </div>
  `
    )
    .join('');

  const content = `
    <div style="background: linear-gradient(135deg, ${FUZE_COLOR} 0%, #0a9db5 100%); color: white; padding: 32px 24px; border-radius: 8px; text-align: center; margin: -24px -24px 24px;">
      <h2 style="margin: 0 0 8px; font-size: 28px; font-weight: 700;">FUZE Atlas Weekly Intelligence Brief</h2>
      <p style="margin: 0; font-size: 14px; opacity: 0.9;">${data.weekStartDate} – ${data.weekEndDate}</p>
    </div>

    <!-- This Week in Testing -->
    <div style="margin: 24px 0;">
      <h3 style="color: #1a1a2e; margin: 0 0 16px; font-size: 18px; border-bottom: 2px solid ${FUZE_COLOR}; padding-bottom: 8px;">📊 This Week in Testing</h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        <div style="background: #f0fafb; padding: 12px; border-radius: 6px; text-align: center;">
          <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; font-weight: 500;">COMPLETED</p>
          <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${FUZE_COLOR};">${data.testStats.completed}</p>
        </div>
        <div style="background: #f0fafb; padding: 12px; border-radius: 6px; text-align: center;">
          <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; font-weight: 500;">PASSED</p>
          <p style="margin: 0; font-size: 24px; font-weight: 700; color: #059669;">${data.testStats.passed}</p>
        </div>
        <div style="background: #f0fafb; padding: 12px; border-radius: 6px; text-align: center;">
          <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; font-weight: 500;">FAILED</p>
          <p style="margin: 0; font-size: 24px; font-weight: 700; color: #dc2626;">${data.testStats.failed}</p>
        </div>
        <div style="background: #f0fafb; padding: 12px; border-radius: 6px; text-align: center;">
          <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; font-weight: 500;">NEW FABRICS</p>
          <p style="margin: 0; font-size: 24px; font-weight: 700; color: #2563eb;">${data.newFabrics}</p>
        </div>
      </div>
    </div>

    <!-- Test Results Spotlight -->
    <div style="margin: 24px 0;">
      <h3 style="color: #1a1a2e; margin: 0 0 16px; font-size: 18px; border-bottom: 2px solid ${FUZE_COLOR}; padding-bottom: 8px;">🎯 Test Results Spotlight</h3>
      ${notableResultsHtml || '<p style="color: #9ca3af; font-size: 13px;">No notable results this week.</p>'}
    </div>

    <!-- Pipeline Movement -->
    ${data.pipelineMovements.length > 0 ? `
    <div style="margin: 24px 0;">
      <h3 style="color: #1a1a2e; margin: 0 0 16px; font-size: 18px; border-bottom: 2px solid ${FUZE_COLOR}; padding-bottom: 8px;">📈 Pipeline Movement</h3>
      ${pipelineHtml}
    </div>
    ` : ''}

    <!-- New on the Platform -->
    ${data.newOnboarded.brands.length > 0 || data.newOnboarded.factories.length > 0 || data.newOnboarded.users > 0 ? `
    <div style="margin: 24px 0;">
      <h3 style="color: #1a1a2e; margin: 0 0 16px; font-size: 18px; border-bottom: 2px solid ${FUZE_COLOR}; padding-bottom: 8px;">✨ New on the Platform</h3>
      ${data.newOnboarded.brands.length > 0 ? `<p style="margin: 0 0 8px; color: #1a1a2e; font-weight: 600; font-size: 13px;">New Brands</p><ul style="margin: 0 0 12px 20px; padding: 0;">${newBrandsHtml}</ul>` : ''}
      ${data.newOnboarded.factories.length > 0 ? `<p style="margin: 0 0 8px; color: #1a1a2e; font-weight: 600; font-size: 13px;">New Factories</p><ul style="margin: 0 0 12px 20px; padding: 0;">${newFactoriesHtml}</ul>` : ''}
      ${data.newOnboarded.users > 0 ? `<p style="margin: 0; color: #4b5563; font-size: 13px;"><strong>${data.newOnboarded.users}</strong> new users joined</p>` : ''}
    </div>
    ` : ''}

    <!-- Industry Intel -->
    ${data.industryIntel.length > 0 ? `
    <div style="margin: 24px 0;">
      <h3 style="color: #1a1a2e; margin: 0 0 16px; font-size: 18px; border-bottom: 2px solid ${FUZE_COLOR}; padding-bottom: 8px;">📰 Industry Intel</h3>
      ${industryHtml}
    </div>
    ` : ''}

    <!-- Coming Up -->
    ${data.upcomingMilestones.length > 0 ? `
    <div style="margin: 24px 0;">
      <h3 style="color: #1a1a2e; margin: 0 0 16px; font-size: 18px; border-bottom: 2px solid ${FUZE_COLOR}; padding-bottom: 8px;">🔮 Coming Up</h3>
      ${upcomingHtml}
    </div>
    ` : ''}

    <!-- CTA Button -->
    <div style="margin: 24px 0; text-align: center;">
      <a href="${data.dashboardUrl || 'https://fuzeatlas.com/dashboard'}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
        View Full Dashboard
      </a>
    </div>

    <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
      ${data.unsubscribeUrl ? `<a href="${data.unsubscribeUrl}" style="color: #9ca3af; text-decoration: none;">Unsubscribe</a>` : 'Contact us to manage your preferences'}
    </p>
  `;

  return emailWrapper(content);
}

export interface NewTestResultsData {
  testName: string;
  result: 'PASSED' | 'FAILED' | 'RETEST';
  brandName: string;
  fabricName: string;
  testId: string;
  details?: string;
  dashboardUrl?: string;
}

export function newTestResultsTemplate(data: NewTestResultsData): string {
  const resultConfig = {
    PASSED: { color: '#059669', label: '✓ PASSED' },
    FAILED: { color: '#dc2626', label: '✗ FAILED' },
    RETEST: { color: '#d97706', label: '⟳ RETEST REQUIRED' },
  };

  const config = resultConfig[data.result] || { color: '#6b7280', label: data.result };

  const content = `
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Test Results Available</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      New test results are now available for <strong>${data.brandName}</strong>.
    </p>
    <div style="background: #f9fafb; border-left: 4px solid ${config.color}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a2e;">Test: ${data.testName}</p>
      <p style="margin: 0 0 8px; color: #4b5563;">Fabric: ${data.fabricName}</p>
      <p style="margin: 0; color: ${config.color}; font-weight: 700; font-size: 18px;">${config.label}</p>
      ${data.details ? `<p style="margin: 8px 0 0; color: #6b7280; font-size: 13px;">${data.details}</p>` : ''}
    </div>
    <div style="margin: 24px 0;">
      <a href="${data.dashboardUrl || 'https://fuzeatlas.com/tests'}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Results
      </a>
    </div>
  `;

  return emailWrapper(content);
}

export interface OnboardingData {
  name: string;
  companyName: string;
  email: string;
  dashboardUrl?: string;
  loginUrl?: string;
}

export function brandOnboardingWelcomeTemplate(data: OnboardingData): string {
  const content = `
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Welcome to FUZE Atlas!</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${data.name}, welcome to the FUZE Atlas platform! We're excited to have <strong>${data.companyName}</strong> on board.
    </p>
    <div style="background: #f0fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a2e;">What's Next?</p>
      <ul style="margin: 0; padding: 0 0 0 20px; color: #4b5563; line-height: 1.8;">
        <li>Complete your brand profile</li>
        <li>Connect with our testing team</li>
        <li>Submit fabric samples for testing</li>
        <li>Track results in real-time</li>
      </ul>
    </div>
    <div style="margin: 24px 0;">
      <a href="${data.loginUrl || 'https://fuzeatlas.com/login'}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Get Started
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 13px;">
      If you have questions, our team is here to help. Reply to this email or visit our help center.
    </p>
  `;

  return emailWrapper(content);
}

export function brandOnboardingPlatformTourTemplate(data: OnboardingData): string {
  const content = `
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Explore the FUZE Atlas Platform</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${data.name}, let's take a quick tour of the features available to you.
    </p>
    <div style="background: #f9fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <h4 style="margin: 0 0 12px; color: #1a1a2e;">Key Features:</h4>
      <p style="margin: 8px 0; color: #4b5563; font-size: 14px;"><strong>Dashboard</strong> — Real-time overview of your tests and results</p>
      <p style="margin: 8px 0; color: #4b5563; font-size: 14px;"><strong>Fabric Library</strong> — Store and manage all your fabric submissions</p>
      <p style="margin: 8px 0; color: #4b5563; font-size: 14px;"><strong>Test History</strong> — Complete records of all tests and results</p>
      <p style="margin: 8px 0; color: #4b5563; font-size: 14px;"><strong>Reports</strong> — Export detailed testing reports</p>
    </div>
    <div style="margin: 24px 0;">
      <a href="${data.dashboardUrl || 'https://fuzeatlas.com/dashboard'}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Visit Dashboard
      </a>
    </div>
  `;

  return emailWrapper(content);
}

export function brandOnboardingFirstTestTemplate(data: OnboardingData): string {
  const content = `
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Ready to Submit Your First Test?</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${data.name}, your account is set up and ready to go. Here's how to submit your first fabric sample for testing:
    </p>
    <div style="background: #f0fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <h4 style="margin: 0 0 12px; color: #1a1a2e;">Getting Started with Tests:</h4>
      <ol style="margin: 0; padding: 0 0 0 20px; color: #4b5563; line-height: 1.8;">
        <li>Navigate to "Submit Fabric" in your dashboard</li>
        <li>Provide fabric details and treatment information</li>
        <li>Select the tests you need (ICP, Antibacterial, etc.)</li>
        <li>Upload your samples according to guidelines</li>
        <li>Track progress in real-time</li>
      </ol>
    </div>
    <div style="margin: 24px 0;">
      <a href="${data.dashboardUrl || 'https://fuzeatlas.com/submit-fabric'}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Submit Your First Test
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 13px;">
      Need help? We have detailed guides and our support team is ready to assist.
    </p>
  `;

  return emailWrapper(content);
}

export function factoryOnboardingWelcomeTemplate(data: OnboardingData): string {
  const content = `
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Welcome to FUZE Atlas!</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${data.name}, welcome to the FUZE Atlas factory portal! We're thrilled to partner with <strong>${data.companyName}</strong>.
    </p>
    <div style="background: #f0fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a2e;">Factory Portal Access</p>
      <p style="margin: 0 0 8px; color: #4b5563; font-size: 14px;">Your factory profile has been set up. You can now:</p>
      <ul style="margin: 0; padding: 0 0 0 20px; color: #4b5563; line-height: 1.8; font-size: 14px;">
        <li>Manage treatment recipes</li>
        <li>Submit fabric samples</li>
        <li>View test requests from brands</li>
        <li>Track production status</li>
      </ul>
    </div>
    <div style="margin: 24px 0;">
      <a href="${data.loginUrl || 'https://fuzeatlas.com/factory/login'}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Access Portal
      </a>
    </div>
  `;

  return emailWrapper(content);
}

export function factoryOnboardingSubmissionGuideTemplate(data: OnboardingData): string {
  const content = `
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Fabric Submission Guide</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${data.name}, here's how to submit fabric samples through FUZE Atlas:
    </p>
    <div style="background: #f0fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <h4 style="margin: 0 0 12px; color: #1a1a2e;">Submission Requirements:</h4>
      <ul style="margin: 0; padding: 0 0 0 20px; color: #4b5563; line-height: 1.8; font-size: 14px;">
        <li>Fabric specifications (composition, weight, color)</li>
        <li>Treatment details and formulations</li>
        <li>Physical sample (as directed)</li>
        <li>Quality certification documents</li>
      </ul>
    </div>
    <div style="margin: 24px 0;">
      <a href="${data.dashboardUrl || 'https://fuzeatlas.com/factory/submit'}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Start Submission
      </a>
    </div>
  `;

  return emailWrapper(content);
}

export function factoryOnboardingQualityStandardsTemplate(data: OnboardingData): string {
  const content = `
    <h2 style="color: #1a1a2e; margin: 0 0 16px;">Quality Standards & Best Practices</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      Hi ${data.name}, FUZE is committed to excellence. Here's what we expect from our manufacturing partners:
    </p>
    <div style="background: #f0fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <h4 style="margin: 0 0 12px; color: #1a1a2e;">Quality Standards:</h4>
      <ul style="margin: 0; padding: 0 0 0 20px; color: #4b5563; line-height: 1.8; font-size: 14px;">
        <li>ISO 9001 & ISO 14001 compliance</li>
        <li>Consistent color and shrinkage control</li>
        <li>Sustainable dyeing practices</li>
        <li>Full material traceability</li>
        <li>Regular quality audits</li>
      </ul>
    </div>
    <p style="color: #4b5563; line-height: 1.6; margin-top: 16px;">
      Our team will work closely with you to optimize treatment processes and improve results over time.
    </p>
  `;

  return emailWrapper(content);
}

export interface ComplianceAlertData {
  brandName: string;
  testName: string;
  reason: string;
  nextSteps?: string;
  contactEmail?: string;
}

export function complianceAlertTemplate(data: ComplianceAlertData): string {
  const content = `
    <h2 style="color: #dc2626; margin: 0 0 16px;">Alert: Test Requires Retest</h2>
    <p style="color: #4b5563; line-height: 1.6;">
      A test for <strong>${data.brandName}</strong> requires retesting.
    </p>
    <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #7f1d1d;">Test: ${data.testName}</p>
      <p style="margin: 0; color: #5f2120;">${data.reason}</p>
    </div>
    ${data.nextSteps ? `
    <div style="background: #f0fafb; border-left: 4px solid ${FUZE_COLOR}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a2e;">Next Steps:</p>
      <p style="margin: 0; color: #4b5563;">${data.nextSteps}</p>
    </div>
    ` : ''}
    ${data.contactEmail ? `
    <p style="color: #9ca3af; font-size: 13px;">
      Please contact <a href="mailto:${data.contactEmail}" style="color: ${FUZE_COLOR};">${data.contactEmail}</a> for assistance.
    </p>
    ` : ''}
  `;

  return emailWrapper(content);
}

export interface MonthlyRecapData {
  monthYear: string;
  testStats: {
    completed: number;
    passed: number;
    failed: number;
    retesting: number;
  };
  newFabrics: number;
  topBrands: Array<{ name: string; testCount: number }>;
  topFactories: Array<{ name: string; submissionCount: number }>;
  industryHighlights: string[];
  dashboardUrl?: string;
}

export function monthlyRecapTemplate(data: MonthlyRecapData): string {
  const topBrandsHtml = data.topBrands
    .map(
      (b) => `
    <div style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between;">
      <p style="margin: 0; color: #4b5563; font-weight: 500;">${b.name}</p>
      <p style="margin: 0; color: #9ca3af; font-size: 13px;">${b.testCount} tests</p>
    </div>
  `
    )
    .join('');

  const topFactoriesHtml = data.topFactories
    .map(
      (f) => `
    <div style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between;">
      <p style="margin: 0; color: #4b5563; font-weight: 500;">${f.name}</p>
      <p style="margin: 0; color: #9ca3af; font-size: 13px;">${f.submissionCount} submissions</p>
    </div>
  `
    )
    .join('');

  const highlightsHtml = data.industryHighlights
    .map((h) => `<li style="margin: 8px 0; color: #4b5563;">${h}</li>`)
    .join('');

  const content = `
    <div style="background: linear-gradient(135deg, ${FUZE_COLOR} 0%, #0a9db5 100%); color: white; padding: 32px 24px; border-radius: 8px; text-align: center; margin: -24px -24px 24px;">
      <h2 style="margin: 0 0 8px; font-size: 28px; font-weight: 700;">Monthly Recap</h2>
      <p style="margin: 0; font-size: 14px; opacity: 0.9;">${data.monthYear}</p>
    </div>

    <div style="margin: 24px 0;">
      <h3 style="color: #1a1a2e; margin: 0 0 16px; font-size: 18px; border-bottom: 2px solid ${FUZE_COLOR}; padding-bottom: 8px;">Testing Summary</h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        <div style="background: #f0fafb; padding: 12px; border-radius: 6px; text-align: center;">
          <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; font-weight: 500;">COMPLETED</p>
          <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${FUZE_COLOR};">${data.testStats.completed}</p>
        </div>
        <div style="background: #f0fafb; padding: 12px; border-radius: 6px; text-align: center;">
          <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; font-weight: 500;">PASSED</p>
          <p style="margin: 0; font-size: 24px; font-weight: 700; color: #059669;">${data.testStats.passed}</p>
        </div>
      </div>
    </div>

    ${data.topBrands.length > 0 ? `
    <div style="margin: 24px 0;">
      <h3 style="color: #1a1a2e; margin: 0 0 16px; font-size: 18px; border-bottom: 2px solid ${FUZE_COLOR}; padding-bottom: 8px;">Top Brands</h3>
      ${topBrandsHtml}
    </div>
    ` : ''}

    ${data.topFactories.length > 0 ? `
    <div style="margin: 24px 0;">
      <h3 style="color: #1a1a2e; margin: 0 0 16px; font-size: 18px; border-bottom: 2px solid ${FUZE_COLOR}; padding-bottom: 8px;">Top Factories</h3>
      ${topFactoriesHtml}
    </div>
    ` : ''}

    ${data.industryHighlights.length > 0 ? `
    <div style="margin: 24px 0;">
      <h3 style="color: #1a1a2e; margin: 0 0 16px; font-size: 18px; border-bottom: 2px solid ${FUZE_COLOR}; padding-bottom: 8px;">Highlights</h3>
      <ul style="margin: 0; padding: 0 0 0 20px;">${highlightsHtml}</ul>
    </div>
    ` : ''}

    <div style="margin: 24px 0; text-align: center;">
      <a href="${data.dashboardUrl || 'https://fuzeatlas.com/dashboard'}" style="display: inline-block; background: ${FUZE_COLOR}; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
        View Full Dashboard
      </a>
    </div>
  `;

  return emailWrapper(content);
}
