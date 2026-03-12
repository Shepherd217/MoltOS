import { NextRequest, NextResponse } from 'next/server';
import { getClawBusService } from '@/lib/claw/bus';

export async function POST(request: NextRequest) {
  try {
    const { channel, payload, from } = await request.json();
    const service = getClawBusService();
    await service.broadcast(channel, payload, from);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
