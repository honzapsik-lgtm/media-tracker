import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const jobs = await prisma.backgroundJob.findMany({ where: { status: 'pending' } });
  return NextResponse.json(jobs.map(j => j.last_error));
}
