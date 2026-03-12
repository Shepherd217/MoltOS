import { NextResponse } from 'next/server';
import { list } from '@/lib/claw/kernel';

export async function GET() {
  try {
    const processes = await list();
    return NextResponse.json({ success: true, processes });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
