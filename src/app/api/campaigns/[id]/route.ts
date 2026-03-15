// @ts-nocheck

import { NextRequest, NextResponse } from 'next/server';
import { getCampaign, updateCampaign, deleteCampaign } from '@/lib/campaigns';

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

    return NextResponse.json({
      ok: true,
      campaign,
    });
  } catch (err: any) {
    console.error('[API] GET /campaigns/[id] error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const body = await request.json();
    const updated = updateCampaign(params.id, body);

    return NextResponse.json({
      ok: true,
      campaign: updated,
    });
  } catch (err: any) {
    console.error('[API] PATCH /campaigns/[id] error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    deleteCampaign(params.id);

    return NextResponse.json({
      ok: true,
      message: `Campaign ${params.id} deleted`,
    });
  } catch (err: any) {
    console.error('[API] DELETE /campaigns/[id] error:', err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
