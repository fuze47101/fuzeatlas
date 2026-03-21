// @ts-nocheck

import { NextRequest, NextResponse } from 'next/server';
import { createCampaign, getCampaigns } from '@/lib/campaigns';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaigns = getCampaigns();
    return NextResponse.json({
      ok: true,
      campaigns,
      count: campaigns.length,
    });
  } catch (err: any) {
    console.error('[API] GET /campaigns error:', err.message);
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

    const body = await request.json();
    const {
      name,
      description,
      type,
      status,
      audience,
      customRecipients,
      subject,
      templateId,
      schedule,
    } = body;

    if (!name || !type || !audience || !subject || !templateId) {
      return NextResponse.json(
        {
          error: 'Missing required fields: name, type, audience, subject, templateId',
        },
        { status: 400 }
      );
    }

    const campaign = createCampaign({
      name,
      description,
      type,
      status: status || 'DRAFT',
      audience,
      customRecipients,
      subject,
      templateId,
      schedule,
    });

    return NextResponse.json({
      ok: true,
      campaign,
    });
  } catch (err: any) {
    console.error('[API] POST /campaigns error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
