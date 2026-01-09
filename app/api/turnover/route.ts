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
  
  // 분기별 법인별 회전율
  data: [
    // 24.1Q
    { quarter: '24.1Q', entity: '국내(OC)', dso: 21, dio: 142, dpo: 75, ccc: 88 },
    { quarter: '24.1Q', entity: '중국', dso: 28, dio: 48, dpo: 6, ccc: 70 },
    { quarter: '24.1Q', entity: '홍콩', dso: 15, dio: 85, dpo: 2, ccc: 98 },
    { quarter: '24.1Q', entity: 'ST(미국)', dso: 55, dio: 62, dpo: 12, ccc: 105 },
    { quarter: '24.1Q', entity: '기타', dso: 30, dio: 40, dpo: 8, ccc: 62 },
    { quarter: '24.1Q', entity: '연결', dso: 26, dio: 78, dpo: 28, ccc: 76 },
    
    // 24.2Q
    { quarter: '24.2Q', entity: '국내(OC)', dso: 22, dio: 138, dpo: 72, ccc: 88 },
    { quarter: '24.2Q', entity: '중국', dso: 27, dio: 50, dpo: 7, ccc: 70 },
    { quarter: '24.2Q', entity: '홍콩', dso: 16, dio: 82, dpo: 3, ccc: 95 },
    { quarter: '24.2Q', entity: 'ST(미국)', dso: 58, dio: 65, dpo: 13, ccc: 110 },
    { quarter: '24.2Q', entity: '기타', dso: 32, dio: 42, dpo: 9, ccc: 65 },
    { quarter: '24.2Q', entity: '연결', dso: 27, dio: 76, dpo: 27, ccc: 76 },
    
    // 24.3Q
    { quarter: '24.3Q', entity: '국내(OC)', dso: 23, dio: 135, dpo: 68, ccc: 90 },
    { quarter: '24.3Q', entity: '중국', dso: 26, dio: 46, dpo: 6, ccc: 66 },
    { quarter: '24.3Q', entity: '홍콩', dso: 17, dio: 80, dpo: 2, ccc: 95 },
    { quarter: '24.3Q', entity: 'ST(미국)', dso: 60, dio: 68, dpo: 14, ccc: 114 },
    { quarter: '24.3Q', entity: '기타', dso: 28, dio: 38, dpo: 7, ccc: 59 },
    { quarter: '24.3Q', entity: '연결', dso: 28, dio: 72, dpo: 28, ccc: 72 },
    
    // 24.4Q
    { quarter: '24.4Q', entity: '국내(OC)', dso: 24, dio: 140, dpo: 70, ccc: 94 },
    { quarter: '24.4Q', entity: '중국', dso: 28, dio: 48, dpo: 7, ccc: 69 },
    { quarter: '24.4Q', entity: '홍콩', dso: 18, dio: 85, dpo: 3, ccc: 100 },
    { quarter: '24.4Q', entity: 'ST(미국)', dso: 62, dio: 72, dpo: 15, ccc: 119 },
    { quarter: '24.4Q', entity: '기타', dso: 30, dio: 40, dpo: 8, ccc: 62 },
    { quarter: '24.4Q', entity: '연결', dso: 29, dio: 75, dpo: 29, ccc: 75 },
    
    // 25.1Q
    { quarter: '25.1Q', entity: '국내(OC)', dso: 25, dio: 145, dpo: 78, ccc: 92 },
    { quarter: '25.1Q', entity: '중국', dso: 29, dio: 47, dpo: 6, ccc: 70 },
    { quarter: '25.1Q', entity: '홍콩', dso: 18, dio: 88, dpo: 3, ccc: 103 },
    { quarter: '25.1Q', entity: 'ST(미국)', dso: 64, dio: 75, dpo: 16, ccc: 123 },
    { quarter: '25.1Q', entity: '기타', dso: 32, dio: 42, dpo: 9, ccc: 65 },
    { quarter: '25.1Q', entity: '연결', dso: 30, dio: 78, dpo: 30, ccc: 78 },
    
    // 25.2Q
    { quarter: '25.2Q', entity: '국내(OC)', dso: 24, dio: 143, dpo: 80, ccc: 87 },
    { quarter: '25.2Q', entity: '중국', dso: 30, dio: 46, dpo: 7, ccc: 69 },
    { quarter: '25.2Q', entity: '홍콩', dso: 19, dio: 90, dpo: 3, ccc: 106 },
    { quarter: '25.2Q', entity: 'ST(미국)', dso: 66, dio: 78, dpo: 17, ccc: 127 },
    { quarter: '25.2Q', entity: '기타', dso: 34, dio: 44, dpo: 10, ccc: 68 },
    { quarter: '25.2Q', entity: '연결', dso: 30, dio: 80, dpo: 31, ccc: 79 },
    
    // 25.3Q
    { quarter: '25.3Q', entity: '국내(OC)', dso: 24, dio: 143, dpo: 82, ccc: 85 },
    { quarter: '25.3Q', entity: '중국', dso: 31, dio: 46, dpo: 5, ccc: 72 },
    { quarter: '25.3Q', entity: '홍콩', dso: 16, dio: 88, dpo: 1, ccc: 103 },
    { quarter: '25.3Q', entity: 'ST(미국)', dso: 65, dio: 71, dpo: 15, ccc: 121 },
    { quarter: '25.3Q', entity: '기타', dso: 35, dio: 45, dpo: 11, ccc: 69 },
    { quarter: '25.3Q', entity: '연결', dso: 29, dio: 80, dpo: 31, ccc: 78 },
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
