import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const debug = {
    isVercel: !!process.env.VERCEL,
    cwd: process.cwd(),
    aiCachePath: path.join(process.cwd(), 'ai-cache'),
    files: [] as string[],
    error: null as string | null,
  };

  try {
    const aiCachePath = path.join(process.cwd(), 'ai-cache');
    if (fs.existsSync(aiCachePath)) {
      debug.files = fs.readdirSync(aiCachePath);
    } else {
      debug.error = 'ai-cache 폴더가 존재하지 않습니다';
    }
  } catch (err: any) {
    debug.error = err.message;
  }

  return NextResponse.json(debug);
}
