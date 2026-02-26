import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { fabricId, content } = await req.json();
  if (!fabricId || !content) {
    return new NextResponse('fabricId and content required', { status: 400 });
  }
  try {
    const submission = await prisma.fabricSubmission.create({
      data: { fabricId, content },
    });
    return NextResponse.json({ submission });
  } catch (e: any) {
    return new NextResponse(e.message, { status: 500 });
  }
}
