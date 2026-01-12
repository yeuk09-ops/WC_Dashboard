/**
 * 운전자본 데이터 API
 * GET /api/wc-data
 * 
 * Query Parameters:
 * - startQ: 시작 분기 (예: 24.1Q)
 * - endQ: 종료 분기 (예: 25.3Q)
 * - entity: 법인 필터 (선택)
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, WCData, calcTurnover, WC_QUERY } from '@/lib/snowflake';
import { getLatestQuarter, sortQuarters } from '@/lib/quarter-utils';

// 실제 데이터 (2024.1Q ~ 2025.3Q) - 누적 매출/매출원가 포함
const MOCK_DATA: WCData[] = [
  // 24.1Q
  { QUARTER: '24.1Q', ENTITY: '국내(OC)', REVENUE_Q: 236031, COGS_Q: 84861, REVENUE_YTD: 236031, COGS_YTD: 84861, RECEIVABLES: 62892, INVENTORY: 232095, PAYABLES: 69104, WC: 225883 },
  { QUARTER: '24.1Q', ENTITY: '중국', REVENUE_Q: 238976, COGS_Q: 80578, REVENUE_YTD: 238976, COGS_YTD: 80578, RECEIVABLES: 7225, INVENTORY: 73055, PAYABLES: 5104, WC: 75176 },
  { QUARTER: '24.1Q', ENTITY: '홍콩', REVENUE_Q: 22211, COGS_Q: 4359, REVENUE_YTD: 22211, COGS_YTD: 4359, RECEIVABLES: 3399, INVENTORY: 14443, PAYABLES: 19, WC: 17823 },
  { QUARTER: '24.1Q', ENTITY: 'ST(미국)', REVENUE_Q: 9182, COGS_Q: 2031, REVENUE_YTD: 9182, COGS_YTD: 2031, RECEIVABLES: 2822, INVENTORY: 4244, PAYABLES: 894, WC: 6172 },
  { QUARTER: '24.1Q', ENTITY: '기타', REVENUE_Q: 629, COGS_Q: 2716, REVENUE_YTD: 629, COGS_YTD: 2716, RECEIVABLES: 4358, INVENTORY: 0, PAYABLES: 774, WC: 3584 },
  { QUARTER: '24.1Q', ENTITY: '연결', REVENUE_Q: 507029, COGS_Q: 174545, REVENUE_YTD: 507029, COGS_YTD: 174545, RECEIVABLES: 80696, INVENTORY: 323836, PAYABLES: 75896, WC: 328636 },
  
  // 24.2Q
  { QUARTER: '24.2Q', ENTITY: '국내(OC)', REVENUE_Q: 208996, COGS_Q: 62705, REVENUE_YTD: 445027, COGS_YTD: 147566, RECEIVABLES: 47819, INVENTORY: 207393, PAYABLES: 48681, WC: 206531 },
  { QUARTER: '24.2Q', ENTITY: '중국', REVENUE_Q: 154544, COGS_Q: 48588, REVENUE_YTD: 393520, COGS_YTD: 129166, RECEIVABLES: 7183, INVENTORY: 67516, PAYABLES: 10587, WC: 64112 },
  { QUARTER: '24.2Q', ENTITY: '홍콩', REVENUE_Q: 16965, COGS_Q: 3383, REVENUE_YTD: 39176, COGS_YTD: 7742, RECEIVABLES: 2816, INVENTORY: 13185, PAYABLES: 24, WC: 15977 },
  { QUARTER: '24.2Q', ENTITY: 'ST(미국)', REVENUE_Q: 9282, COGS_Q: 2144, REVENUE_YTD: 18464, COGS_YTD: 4175, RECEIVABLES: 4429, INVENTORY: 4806, PAYABLES: 3380, WC: 5855 },
  { QUARTER: '24.2Q', ENTITY: '기타', REVENUE_Q: 1686, COGS_Q: 3354, REVENUE_YTD: 2315, COGS_YTD: 6070, RECEIVABLES: 3513, INVENTORY: 0, PAYABLES: 285, WC: 3228 },
  { QUARTER: '24.2Q', ENTITY: '연결', REVENUE_Q: 391473, COGS_Q: 120174, REVENUE_YTD: 898502, COGS_YTD: 294719, RECEIVABLES: 65760, INVENTORY: 292899, PAYABLES: 62956, WC: 295703 },
  
  // 24.3Q
  { QUARTER: '24.3Q', ENTITY: '국내(OC)', REVENUE_Q: 167998, COGS_Q: 54707, REVENUE_YTD: 613025, COGS_YTD: 202273, RECEIVABLES: 42931, INVENTORY: 247016, PAYABLES: 115166, WC: 174781 },
  { QUARTER: '24.3Q', ENTITY: '중국', REVENUE_Q: 250154, COGS_Q: 90959, REVENUE_YTD: 643674, COGS_YTD: 220125, RECEIVABLES: 81857, INVENTORY: 94822, PAYABLES: 14414, WC: 162265 },
  { QUARTER: '24.3Q', ENTITY: '홍콩', REVENUE_Q: 15559, COGS_Q: 4012, REVENUE_YTD: 54735, COGS_YTD: 11754, RECEIVABLES: 2230, INVENTORY: 14748, PAYABLES: 0, WC: 16978 },
  { QUARTER: '24.3Q', ENTITY: 'ST(미국)', REVENUE_Q: 8198, COGS_Q: 2241, REVENUE_YTD: 26662, COGS_YTD: 6416, RECEIVABLES: 5643, INVENTORY: 5150, PAYABLES: 1055, WC: 9738 },
  { QUARTER: '24.3Q', ENTITY: '기타', REVENUE_Q: 9053, COGS_Q: 14124, REVENUE_YTD: 11368, COGS_YTD: 20194, RECEIVABLES: 0, INVENTORY: 0, PAYABLES: 2, WC: 0 },
  { QUARTER: '24.3Q', ENTITY: '연결', REVENUE_Q: 450963, COGS_Q: 166042, REVENUE_YTD: 1349465, COGS_YTD: 460761, RECEIVABLES: 132681, INVENTORY: 361737, PAYABLES: 130612, WC: 363806 },
  
  // 24.4Q
  { QUARTER: '24.4Q', ENTITY: '국내(OC)', REVENUE_Q: 301138, COGS_Q: 93282, REVENUE_YTD: 914163, COGS_YTD: 295555, RECEIVABLES: 84347, INVENTORY: 214281, PAYABLES: 79771, WC: 218857 },
  { QUARTER: '24.4Q', ENTITY: '중국', REVENUE_Q: 214166, COGS_Q: 81541, REVENUE_YTD: 857840, COGS_YTD: 301666, RECEIVABLES: 40081, INVENTORY: 86202, PAYABLES: 17885, WC: 108398 },
  { QUARTER: '24.4Q', ENTITY: '홍콩', REVENUE_Q: 20299, COGS_Q: 3631, REVENUE_YTD: 75034, COGS_YTD: 15385, RECEIVABLES: 3967, INVENTORY: 15861, PAYABLES: 37, WC: 19791 },
  { QUARTER: '24.4Q', ENTITY: 'ST(미국)', REVENUE_Q: 10115, COGS_Q: 2593, REVENUE_YTD: 36777, COGS_YTD: 9009, RECEIVABLES: 5304, INVENTORY: 8647, PAYABLES: 4990, WC: 8961 },
  { QUARTER: '24.4Q', ENTITY: '기타', REVENUE_Q: 827, COGS_Q: 7209, REVENUE_YTD: 12195, COGS_YTD: 27403, RECEIVABLES: 126, INVENTORY: 0, PAYABLES: 2, WC: 124 },
  { QUARTER: '24.4Q', ENTITY: '연결', REVENUE_Q: 546544, COGS_Q: 188256, REVENUE_YTD: 1896009, COGS_YTD: 649017, RECEIVABLES: 133826, INVENTORY: 324992, PAYABLES: 102685, WC: 356133 },
  
  // 25.1Q
  { QUARTER: '25.1Q', ENTITY: '국내(OC)', REVENUE_Q: 217218, COGS_Q: 74004, REVENUE_YTD: 217218, COGS_YTD: 74004, RECEIVABLES: 56942, INVENTORY: 214607, PAYABLES: 69813, WC: 201736 },
  { QUARTER: '25.1Q', ENTITY: '중국', REVENUE_Q: 258540, COGS_Q: 93609, REVENUE_YTD: 258540, COGS_YTD: 93609, RECEIVABLES: 20896, INVENTORY: 73990, PAYABLES: 10009, WC: 84877 },
  { QUARTER: '25.1Q', ENTITY: '홍콩', REVENUE_Q: 20663, COGS_Q: 4773, REVENUE_YTD: 20663, COGS_YTD: 4773, RECEIVABLES: 2465, INVENTORY: 15463, PAYABLES: 24, WC: 17904 },
  { QUARTER: '25.1Q', ENTITY: 'ST(미국)', REVENUE_Q: 8443, COGS_Q: 1966, REVENUE_YTD: 8443, COGS_YTD: 1966, RECEIVABLES: 4304, INVENTORY: 9993, PAYABLES: 2115, WC: 12182 },
  { QUARTER: '25.1Q', ENTITY: '기타', REVENUE_Q: 752, COGS_Q: 1530, REVENUE_YTD: 752, COGS_YTD: 1530, RECEIVABLES: 516, INVENTORY: 0, PAYABLES: 5, WC: 511 },
  { QUARTER: '25.1Q', ENTITY: '연결', REVENUE_Q: 505616, COGS_Q: 175883, REVENUE_YTD: 505616, COGS_YTD: 175883, RECEIVABLES: 85122, INVENTORY: 314052, PAYABLES: 81968, WC: 317206 },
  
  // 25.2Q
  { QUARTER: '25.2Q', ENTITY: '국내(OC)', REVENUE_Q: 182702, COGS_Q: 55727, REVENUE_YTD: 399920, COGS_YTD: 129731, RECEIVABLES: 39858, INVENTORY: 199305, PAYABLES: 53640, WC: 185523 },
  { QUARTER: '25.2Q', ENTITY: '중국', REVENUE_Q: 170703, COGS_Q: 55489, REVENUE_YTD: 429243, COGS_YTD: 149098, RECEIVABLES: 8793, INVENTORY: 70971, PAYABLES: 12445, WC: 67319 },
  { QUARTER: '25.2Q', ENTITY: '홍콩', REVENUE_Q: 15742, COGS_Q: 4356, REVENUE_YTD: 36405, COGS_YTD: 9129, RECEIVABLES: 3324, INVENTORY: 13757, PAYABLES: 76, WC: 17005 },
  { QUARTER: '25.2Q', ENTITY: 'ST(미국)', REVENUE_Q: 8590, COGS_Q: 2337, REVENUE_YTD: 17033, COGS_YTD: 4303, RECEIVABLES: 4962, INVENTORY: 9317, PAYABLES: 2292, WC: 11987 },
  { QUARTER: '25.2Q', ENTITY: '기타', REVENUE_Q: 1134, COGS_Q: 2055, REVENUE_YTD: 1886, COGS_YTD: 3585, RECEIVABLES: 582, INVENTORY: 0, PAYABLES: 1, WC: 581 },
  { QUARTER: '25.2Q', ENTITY: '연결', REVENUE_Q: 378871, COGS_Q: 119964, REVENUE_YTD: 884487, COGS_YTD: 295847, RECEIVABLES: 57519, INVENTORY: 293350, PAYABLES: 68454, WC: 282415 },
  
  // 25.3Q
  { QUARTER: '25.3Q', ENTITY: '국내(OC)', REVENUE_Q: 154598, COGS_Q: 53983, REVENUE_YTD: 554518, COGS_YTD: 183714, RECEIVABLES: 40360, INVENTORY: 242000, PAYABLES: 139941, WC: 142419 },
  { QUARTER: '25.3Q', ENTITY: '중국', REVENUE_Q: 283919, COGS_Q: 100125, REVENUE_YTD: 713162, COGS_YTD: 249223, RECEIVABLES: 97531, INVENTORY: 143388, PAYABLES: 15906, WC: 225013 },
  { QUARTER: '25.3Q', ENTITY: '홍콩', REVENUE_Q: 16908, COGS_Q: 3811, REVENUE_YTD: 53313, COGS_YTD: 12940, RECEIVABLES: 2871, INVENTORY: 16156, PAYABLES: 103, WC: 18924 },
  { QUARTER: '25.3Q', ENTITY: 'ST(미국)', REVENUE_Q: 16123, COGS_Q: 2844, REVENUE_YTD: 33156, COGS_YTD: 7147, RECEIVABLES: 11498, INVENTORY: 12483, PAYABLES: 2562, WC: 21419 },
  { QUARTER: '25.3Q', ENTITY: '기타', REVENUE_Q: 2709, COGS_Q: 4539, REVENUE_YTD: 4595, COGS_YTD: 8124, RECEIVABLES: 532, INVENTORY: 0, PAYABLES: 5, WC: 527 },
  { QUARTER: '25.3Q', ENTITY: '연결', REVENUE_Q: 474257, COGS_Q: 165303, REVENUE_YTD: 1358744, COGS_YTD: 461150, RECEIVABLES: 152793, INVENTORY: 414026, PAYABLES: 158517, WC: 408302 },
];

// 환경 변수로 Mock 모드 제어
const USE_MOCK = process.env.USE_MOCK_DATA === 'true' || !process.env.SNOWFLAKE_ACCOUNT;

// 데이터 캐시 (서버 메모리)
let cachedData: any[] | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 60000; // 1분 캐시

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get('entity');
    
    // 데이터 로드
    let data: WCData[];
    
    if (USE_MOCK) {
      // Mock 데이터 사용
      data = MOCK_DATA;
    } else {
      // Snowflake에서 데이터 조회
      data = await executeQuery<WCData>(WC_QUERY);
    }
    
    // 최신 분기 자동 감지
    const allQuarters = [...new Set(data.map(d => d.QUARTER))];
    const sortedQuarters = sortQuarters(allQuarters);
    const latestQuarter = getLatestQuarter(allQuarters) || '25.3Q';
    const startQ = searchParams.get('startQ') || sortedQuarters[0] || '24.1Q';
    const endQ = searchParams.get('endQ') || latestQuarter;
    
    // 캐시 확인 (1분 이내면 캐시 사용)
    const now = Date.now();
    if (cachedData && (now - cacheTime < CACHE_DURATION)) {
      const filteredData = filterData(cachedData, startQ, endQ, entity);
      return NextResponse.json({
        success: true,
        data: filteredData,
        meta: {
          useMock: USE_MOCK,
          cached: true,
          startQ,
          endQ,
          latestQuarter,
          allQuarters: sortedQuarters,
          entity,
          count: filteredData.length
        }
      });
    }
    
    // 회전율 계산 추가 (한 번만)
    const enrichedData = data.map(d => ({
      ...d,
      ...calcTurnover(d)
    }));
    
    // 캐시 저장
    cachedData = enrichedData;
    cacheTime = now;
    
    // 필터링
    const filteredData = filterData(enrichedData, startQ, endQ, entity);
    
    return NextResponse.json({
      success: true,
      data: filteredData,
      meta: {
        useMock: USE_MOCK,
        cached: false,
        startQ,
        endQ,
        latestQuarter,
        allQuarters: sortedQuarters,
        entity,
        count: filteredData.length
      }
    });
    
  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// 데이터 필터링 함수
function filterData(data: any[], startQ: string, endQ: string, entity: string | null) {
  let filtered = data.filter(d => {
    const qOrder = ['24.1Q', '24.2Q', '24.3Q', '24.4Q', '25.1Q', '25.2Q', '25.3Q'];
    const startIdx = qOrder.indexOf(startQ);
    const endIdx = qOrder.indexOf(endQ);
    const dataIdx = qOrder.indexOf(d.QUARTER);
    return dataIdx >= startIdx && dataIdx <= endIdx;
  });
  
  if (entity && entity !== 'all') {
    filtered = filtered.filter(d => d.ENTITY === entity);
  }
  
  return filtered;
}
