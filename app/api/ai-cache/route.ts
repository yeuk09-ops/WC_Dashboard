/**
 * AI 캐시 조회/관리 API
 * GET: 특정 분기의 AI 캐시 조회
 * DELETE: 특정 분기의 AI 캐시 삭제 (재분석용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadAICache, deleteAICache, listCachedQuarters } from '@/lib/ai-cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter');
    
    // 분기가 지정되지 않으면 전체 목록 반환
    if (!quarter) {
      const quarters = listCachedQuarters();
      return NextResponse.json({
        success: true,
        quarters,
      });
    }
    
    // 특정 분기의 캐시 조회
    const cache = loadAICache(quarter);
    
    if (!cache) {
      return NextResponse.json({
        success: false,
        error: 'AI 캐시가 없습니다.',
        cached: false,
      });
    }
    
    return NextResponse.json({
      success: true,
      cached: true,
      cache,
    });
    
  } catch (error) {
    console.error('AI 캐시 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter');
    
    if (!quarter) {
      return NextResponse.json(
        { success: false, error: '분기를 지정해주세요.' },
        { status: 400 }
      );
    }
    
    deleteAICache(quarter);
    
    return NextResponse.json({
      success: true,
      message: `${quarter} AI 캐시가 삭제되었습니다.`,
    });
    
  } catch (error) {
    console.error('AI 캐시 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
