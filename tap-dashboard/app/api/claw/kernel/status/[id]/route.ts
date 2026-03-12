import { NextRequest, NextResponse } from 'next/server';
import { getStatus } from '@/lib/claw/kernel';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const process = await getStatus(params.id);
    return NextResponse.json({ success: true, process });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
