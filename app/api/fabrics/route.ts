import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { name, submissionContent } = await req.json();
  if (!name || !submissionContent) {
    return new NextResponse('Name and submission content are required', { status: 400 });
  }
  try {
    const fabric = await prisma.fabric.create({
      data: {
        name,
        submissions: {
          create: { content: submissionContent },
        },
      },
      include: { submissions: true },
    });
    return NextResponse.json({ fabric });
  } catch (e: any) {
    return new NextResponse(e.message, { status: 500 });
  }
}
