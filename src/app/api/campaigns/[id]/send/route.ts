// @ts-nocheck

import { NextRequest, NextResponse } from 'next/server';
import { getCampaign, executeCampaign, getAudienceRecipients } from '@/lib/campaigns';

export async function POST(
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

    // Get recipients
    const recipients = await getAudienceRecipients(campaign.audience, campaign.customRecipients);

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No recipients found for this campaign' },
        { status: 400 }
      );
    }

    // Execute the campaign
    const result = await executeCampaign(params.id);

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      failed: result.failed,
      recipients: recipients.length,
      campaign: getCampaign(params.id),
    });
  } catch (err: any) {
    console.error('[API] POST /campaigns/[id]/send error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
