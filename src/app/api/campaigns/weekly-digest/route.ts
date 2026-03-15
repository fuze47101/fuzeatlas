// @ts-nocheck

import { NextRequest, NextResponse } from 'next/server';
import { scheduleWeeklyDigest, executeCampaign, getCampaign, getAudienceRecipients } from '@/lib/campaigns';
import { weeklyDigestTemplate } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';

async function getWeeklyDigestData() {
  try {
    const { prisma } = await import('@/lib/prisma');

    // Calculate week date range
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Fetch test stats
    const testRuns = await prisma.testRun.findMany({
      where: {
        createdAt: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
      include: {
        testTemplate: true,
        brand: true,
      },
    });

    const testStats = {
      completed: testRuns.length,
      passed: testRuns.filter((t) => t.status === 'PASSED' || t.status === 'PASSED_COMPLETE').length,
      failed: testRuns.filter((t) => t.status === 'FAILED').length,
      retesting: testRuns.filter((t) => t.status === 'RETEST').length,
    };

    // Fetch new brands
    const newBrands = await prisma.brand.findMany({
      where: {
        createdAt: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
      select: { name: true, id: true },
      take: 5,
    });

    // Fetch new factories
    const newFactories = await prisma.factory.findMany({
      where: {
        createdAt: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
      select: { name: true, id: true },
      take: 5,
    });

    // Fetch new users
    const newUsers = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
    });

    // Notable test results (passed and failed)
    const notableResults = testRuns
      .filter((t) => ['PASSED', 'PASSED_COMPLETE', 'FAILED', 'RETEST'].includes(t.status))
      .slice(0, 5)
      .map((t) => ({
        testName: t.testTemplate?.name || 'Test',
        result: t.status === 'PASSED_COMPLETE' ? 'PASSED' : t.status,
        brandName: t.brand?.name || 'Unknown Brand',
        fabricName: t.fabricName || 'Fabric',
      }));

    // Pipeline movements
    const pipelineMovements: any[] = []; // Would query from BrandEngagement or similar

    // Format dates
    const weekStartDate = startOfWeek.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const weekEndDate = endOfWeek.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return {
      weekStartDate,
      weekEndDate,
      testStats,
      newFabrics: testRuns.length, // Approximation
      notableResults,
      pipelineMovements,
      newOnboarded: {
        brands: newBrands.map((b) => ({ name: b.name, contact: undefined })),
        factories: newFactories.map((f) => ({ name: f.name, contact: undefined })),
        users: newUsers.length,
      },
      industryIntel: [
        {
          title: 'OEKO-TEX Standards Update',
          summary: 'New eco-labeling guidelines focus on water efficiency and chemical safety.',
          link: 'https://www.oeko-tex.com',
        },
        {
          title: 'Antimicrobial Market Growth',
          summary: 'Global demand for antimicrobial textiles continues to surge across healthcare and athletic sectors.',
        },
      ],
      upcomingMilestones: [
        {
          title: 'Q2 Results Review',
          date: endOfWeek.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
        },
      ],
    };
  } catch (err) {
    console.error('[WEEKLY DIGEST] Error fetching data:', err);
    // Return default empty data on error
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return {
      weekStartDate: startOfWeek.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      weekEndDate: endOfWeek.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      testStats: { completed: 0, passed: 0, failed: 0, retesting: 0 },
      newFabrics: 0,
      notableResults: [],
      pipelineMovements: [],
      newOnboarded: { brands: [], factories: [], users: 0 },
      industryIntel: [],
      upcomingMilestones: [],
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create the weekly digest campaign
    const campaign = scheduleWeeklyDigest();

    // Fetch real data for preview
    const digestData = await getWeeklyDigestData();

    // Add dashboard URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fuzeatlas.com';
    digestData.dashboardUrl = `${baseUrl}/dashboard`;
    digestData.unsubscribeUrl = `${baseUrl}/unsubscribe`;

    // Render HTML
    const html = weeklyDigestTemplate(digestData);

    return NextResponse.json({
      ok: true,
      campaign,
      data: digestData,
      html,
      preview: true,
    });
  } catch (err: any) {
    console.error('[API] GET /campaigns/weekly-digest error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create the weekly digest campaign
    let campaign = scheduleWeeklyDigest();

    // Fetch real data for this send
    const digestData = await getWeeklyDigestData();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fuzeatlas.com';
    digestData.dashboardUrl = `${baseUrl}/dashboard`;
    digestData.unsubscribeUrl = `${baseUrl}/unsubscribe`;

    // Render HTML template
    const html = weeklyDigestTemplate(digestData);

    // Get recipients
    const recipients = await getAudienceRecipients(campaign.audience, campaign.customRecipients);

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No recipients found for weekly digest' },
        { status: 400 }
      );
    }

    // Send to all recipients
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      try {
        const result = await sendEmail({
          to: recipient.email,
          subject: campaign.subject,
          html,
        });

        if (result.ok) {
          sent++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error('[WEEKLY DIGEST] Failed to send to', recipient.email, err);
        failed++;
      }
    }

    // Update campaign stats
    const updatedCampaign = getCampaign(campaign.id);

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      recipients: recipients.length,
      campaign: updatedCampaign,
      message: `Weekly digest sent to ${sent} recipients`,
    });
  } catch (err: any) {
    console.error('[API] POST /campaigns/weekly-digest error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
