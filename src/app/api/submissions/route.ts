import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const ALLOWED = ['brandId', 'factoryId', 'fabricId', 'fuzeFabricNumber', 'customerFabricCode', 'factoryFabricCode', 'applicationMethod', 'applicationRecipeRaw', 'padRecipeRaw', 'treatmentLocation', 'applicationDate', 'washTarget', 'icpSent', 'icpReceived', 'icpPassed', 'abSent', 'abReceived', 'abPassed', 'category', 'programName', 'raw'] as const;
type AllowedKey = (typeof ALLOWED)[number];

function pickAllowed(body: any) {
  const data: Record<string, any> = {};
  for (const k of ALLOWED) {
    if (Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined) {
      data[k] = body[k];
    }
  }
  return data as Record<AllowedKey, any>;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const data = pickAllowed(body);

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No valid FabricSubmission fields provided', allowed: ALLOWED },
        { status: 400 }
      );
    }

    if (!data.fabricId || String(data.fabricId).trim() === '') {
      return NextResponse.json({ ok:false, error:'fabricId is required' }, { status: 400 });
    }

    const submission = await prisma.fabricSubmission.create({
      data: data as any,
    });

    return NextResponse.json({ ok: true, submission }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
