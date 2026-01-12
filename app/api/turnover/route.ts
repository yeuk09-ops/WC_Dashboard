/**
 * 회전율 분석 API
 * GET /api/turnover
 * 
 * 법인별 DSO, DIO, DPO, CCC 데이터 반환
 */

import { NextRequest, NextResponse } from 'next/server';

// 25.3Q 기준 회전율 데이터
const TURNOVER_DATA = {
  quarters: ['24.1Q', '24.2Q', '24.3Q', '24.4Q', '25.1Q', '25.2Q', '25.3Q'],
  entities: ['국내(OC)', '중국', '홍콩', 'ST(미국)', '기타', '연결'],
  
  // 분기별 법인별 회전율 (누적 매출/매출원가 연환산 기반: 누적 ÷ 분기수 × 4)
  data: [
    // 24.1Q
    { quarter: '24.1Q', entity: '국내(OC)', dso: 24, dio: 250, dpo: 74, ccc: 200 },
    { quarter: '24.1Q', entity: '중국', dso: 3, dio: 83, dpo: 6, ccc: 80 },
    { quarter: '24.1Q', entity: '홍콩', dso: 14, dio: 302, dpo: 0, ccc: 316 },
    { quarter: '24.1Q', entity: 'ST(미국)', dso: 28, dio: 191, dpo: 40, ccc: 179 },
    { quarter: '24.1Q', entity: '기타', dso: 632, dio: 0, dpo: 26, ccc: 606 },
    { quarter: '24.1Q', entity: '연결', dso: 15, dio: 169, dpo: 40, ccc: 144 },
    
    // 24.2Q
    { quarter: '24.2Q', entity: '국내(OC)', dso: 20, dio: 256, dpo: 60, ccc: 216 },
    { quarter: '24.2Q', entity: '중국', dso: 3, dio: 95, dpo: 15, ccc: 83 },
    { quarter: '24.2Q', entity: '홍콩', dso: 13, dio: 311, dpo: 1, ccc: 323 },
    { quarter: '24.2Q', entity: 'ST(미국)', dso: 44, dio: 210, dpo: 148, ccc: 106 },
    { quarter: '24.2Q', entity: '기타', dso: 277, dio: 0, dpo: 9, ccc: 268 },
    { quarter: '24.2Q', entity: '연결', dso: 13, dio: 181, dpo: 39, ccc: 155 },
    
    // 24.3Q
    { quarter: '24.3Q', entity: '국내(OC)', dso: 19, dio: 334, dpo: 156, ccc: 197 },
    { quarter: '24.3Q', entity: '중국', dso: 35, dio: 118, dpo: 18, ccc: 135 },
    { quarter: '24.3Q', entity: '홍콩', dso: 11, dio: 343, dpo: 0, ccc: 354 },
    { quarter: '24.3Q', entity: 'ST(미국)', dso: 58, dio: 220, dpo: 45, ccc: 233 },
    { quarter: '24.3Q', entity: '기타', dso: 0, dio: 0, dpo: 0, ccc: 0 },
    { quarter: '24.3Q', entity: '연결', dso: 27, dio: 215, dpo: 78, ccc: 164 },
    
    // 24.4Q
    { quarter: '24.4Q', entity: '국내(OC)', dso: 34, dio: 265, dpo: 99, ccc: 200 },
    { quarter: '24.4Q', entity: '중국', dso: 17, dio: 104, dpo: 22, ccc: 99 },
    { quarter: '24.4Q', entity: '홍콩', dso: 19, dio: 376, dpo: 1, ccc: 394 },
    { quarter: '24.4Q', entity: 'ST(미국)', dso: 53, dio: 350, dpo: 202, ccc: 201 },
    { quarter: '24.4Q', entity: '기타', dso: 4, dio: 0, dpo: 0, ccc: 4 },
    { quarter: '24.4Q', entity: '연결', dso: 26, dio: 183, dpo: 58, ccc: 151 },
    
    // 25.1Q
    { quarter: '25.1Q', entity: '국내(OC)', dso: 24, dio: 265, dpo: 86, ccc: 203 },
    { quarter: '25.1Q', entity: '중국', dso: 7, dio: 72, dpo: 10, ccc: 69 },
    { quarter: '25.1Q', entity: '홍콩', dso: 11, dio: 296, dpo: 0, ccc: 307 },
    { quarter: '25.1Q', entity: 'ST(미국)', dso: 47, dio: 464, dpo: 98, ccc: 413 },
    { quarter: '25.1Q', entity: '기타', dso: 63, dio: 0, dpo: 0, ccc: 63 },
    { quarter: '25.1Q', entity: '연결', dso: 15, dio: 163, dpo: 43, ccc: 135 },
    
    // 25.2Q
    { quarter: '25.2Q', entity: '국내(OC)', dso: 18, dio: 280, dpo: 75, ccc: 223 },
    { quarter: '25.2Q', entity: '중국', dso: 4, dio: 87, dpo: 15, ccc: 76 },
    { quarter: '25.2Q', entity: '홍콩', dso: 17, dio: 275, dpo: 2, ccc: 290 },
    { quarter: '25.2Q', entity: 'ST(미국)', dso: 53, dio: 395, dpo: 97, ccc: 351 },
    { quarter: '25.2Q', entity: '기타', dso: 56, dio: 0, dpo: 0, ccc: 56 },
    { quarter: '25.2Q', entity: '연결', dso: 12, dio: 181, dpo: 42, ccc: 151 },
    
    // 25.3Q
    { quarter: '25.3Q', entity: '국내(OC)', dso: 20, dio: 361, dpo: 209, ccc: 172 },
    { quarter: '25.3Q', entity: '중국', dso: 37, dio: 157, dpo: 17, ccc: 177 },
    { quarter: '25.3Q', entity: '홍콩', dso: 15, dio: 342, dpo: 2, ccc: 355 },
    { quarter: '25.3Q', entity: 'ST(미국)', dso: 95, dio: 478, dpo: 98, ccc: 475 },
    { quarter: '25.3Q', entity: '기타', dso: 32, dio: 0, dpo: 0, ccc: 32 },
    { quarter: '25.3Q', entity: '연결', dso: 31, dio: 246, dpo: 94, ccc: 183 },
  ]
};

// 캐시
let cachedResponse: any = null;

export async function GET(request: NextRequest) {
  try {
    // 쿼리 파라미터가 없으면 캐시 사용 (전체 데이터)
    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter');
    const entity = searchParams.get('entity');
    
    // 파라미터가 없고 캐시가 있으면 즉시 반환
    if (!quarter && !entity && cachedResponse) {
      return NextResponse.json(cachedResponse);
    }
    
    let filteredData = [...TURNOVER_DATA.data];
    
    if (quarter && quarter !== 'all') {
      filteredData = filteredData.filter(d => d.quarter === quarter);
    }
    
    if (entity && entity !== 'all') {
      filteredData = filteredData.filter(d => d.entity === entity);
    }
    
    const response = {
      success: true,
      data: filteredData,
      quarters: TURNOVER_DATA.quarters,
      entities: TURNOVER_DATA.entities,
      meta: {
        currentQuarter: '25.3Q',
        previousQuarter: '24.3Q',
        cached: !quarter && !entity && cachedResponse ? true : false
      }
    };
    
    // 전체 데이터 요청일 때만 캐시
    if (!quarter && !entity) {
      cachedResponse = response;
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
