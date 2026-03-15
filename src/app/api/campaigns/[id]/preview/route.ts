// @ts-nocheck

import { NextRequest, NextResponse } from 'next/server';
import { getCampaign } from '@/lib/campaigns';
import { weeklyDigestTemplate } from '@/lib/email-templates';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaign = getCampaign(params.id);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Generate sample HTML based on template type
    let html = '';

    if (campaign.templateId === 'weekly-digest' || campaign.type === 'WEEKLY_DIGEST') {
      // Sample weekly digest data
      const sampleData = {
        weekStartDate: 'Mar 10, 2026',
        weekEndDate: 'Mar 16, 2026',
        testStats: {
          completed: 12,
          passed: 10,
          failed: 1,
          retesting: 1,
        },
        newFabrics: 5,
        notableResults: [
          {
            testName: 'Antibacterial Test',
            result: 'PASSED',
            brandName: 'EcoWear Inc',
            fabricName: 'Organic Cotton Jersey',
          },
          {
            testName: 'ICP Validation',
            result: 'FAILED',
            brandName: 'FastFashion Co',
            fabricName: 'Synthetic Blend',
          },
          {
            testName: 'UV Resistance',
            result: 'PASSED',
            brandName: 'Premium Athletics',
            fabricName: 'Performance Polyester',
          },
        ],
        pipelineMovements: [
          { brandName: 'NewStart Fashion', fromStage: 'LEAD', toStage: 'PRESENTATION' },
          { brandName: 'Global Textiles', fromStage: 'BRAND_TESTING', toStage: 'FACTORY_ONBOARDING' },
        ],
        newOnboarded: {
          brands: [
            { name: 'Sustainable Threads', contact: 'contact@threads.com' },
            { name: 'Future Fabrics LLC', contact: 'hello@future-fabrics.com' },
          ],
          factories: [
            { name: 'Shanghai Mill Works', contact: 'sales@shanghaimill.cn' },
          ],
          users: 3,
        },
        industryIntel: [
          {
            title: 'New OEKO-TEX Standards Released',
            summary: 'Updated eco-labeling standards focus on water consumption and chemical safety.',
            link: 'https://example.com',
          },
          {
            title: 'Antimicrobial Demand Surges',
            summary: 'Market research shows 45% increase in demand for antimicrobial textiles.',
            link: 'https://example.com',
          },
        ],
        upcomingMilestones: [
          { title: 'Q2 Testing Results Review', date: 'Mar 20, 2026' },
          { title: 'Factory Certification Audit', date: 'Mar 25, 2026' },
        ],
        dashboardUrl: 'https://fuzeatlas.com/dashboard',
        unsubscribeUrl: 'https://fuzeatlas.com/unsubscribe',
      };

      html = weeklyDigestTemplate(sampleData);
    } else {
      // Generic template
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; padding: 20px 0; border-bottom: 3px solid #00b4c3;">
            <h1 style="margin: 0; color: #00b4c3; font-size: 24px;">FUZE Atlas</h1>
          </div>
          <div style="padding: 24px 0;">
            <h2 style="color: #1a1a2e; margin: 0 0 16px;">${campaign.subject}</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              This is a preview of your campaign: <strong>${campaign.name}</strong>
            </p>
            <div style="background: #f0fafb; border-left: 4px solid #00b4c3; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0 0 4px;"><strong>Campaign Type:</strong> ${campaign.type}</p>
              <p style="margin: 0 0 4px;"><strong>Audience:</strong> ${campaign.audience}</p>
              <p style="margin: 0;"><strong>Status:</strong> ${campaign.status}</p>
            </div>
            <p style="color: #9ca3af; font-size: 13px;">
              This is a preview. Actual template content will be rendered when sent.
            </p>
          </div>
          <div style="border-top: 1px solid #e5e7eb; padding: 16px 0; text-align: center; color: #9ca3af; font-size: 12px;">
            FUZE Biotech &mdash; Antimicrobial Textile Solutions
          </div>
        </div>
      `;
    }

    return NextResponse.json({
      ok: true,
      campaign,
      html,
      preview: true,
    });
  } catch (err: any) {
    console.error('[API] GET /campaigns/[id]/preview error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
