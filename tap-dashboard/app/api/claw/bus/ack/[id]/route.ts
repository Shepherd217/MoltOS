import { NextRequest, NextResponse } from 'next/server';
import { getClawBusService } from '@/lib/claw/bus';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const service = getClawBusService();
    await service.acknowledge(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
