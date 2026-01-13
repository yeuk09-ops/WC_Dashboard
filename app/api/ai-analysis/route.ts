/**
 * AI 분석 API
 * POST /api/ai-analysis
 * 
 * OpenAI GPT를 사용하여 운전자본 데이터 분석
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { loadAICache, updateAICachePartial } from '@/lib/ai-cache';

// 숫자 포맷팅 함수 - 100만원 단위를 억원으로 변환 + 천단위 쉼표 추가
function formatNumber(num: number): string {
  // 100만원 단위를 억원으로 변환 (나누기 100)
  const inBillion = num / 100;
  return inBillion.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

// 자금 효과 계산 함수
function calculateCashImpact(quarterRevenue: number, quarterCOGS: number) {
  // 분기 → 연간 환산
  const annualRevenue = quarterRevenue * 4;
  const annualCOGS = quarterCOGS * 4;
  
  // 하루 평균 금액 (100만원 단위를 억원으로)
  const dailyRevenue = (annualRevenue / 100) / 365;
  const dailyCOGS = (annualCOGS / 100) / 365;
  
  return {
    dsoPerDay: dailyRevenue,  // DSO 1일당 자금 효과 (억원)
    dioPerDay: dailyCOGS,     // DIO 1일당 자금 효과 (억원)
    dpoPerDay: dailyCOGS      // DPO 1일당 자금 효과 (억원)
  };
}

// OpenAI 클라이언트를 lazy하게 초기화
function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
  });
}

export async function POST(request: NextRequest) {
  try {
    const { data, type, quarter, context, forceRegenerate } = await request.json();

    if (!quarter) {
      return NextResponse.json({
        success: false,
        error: '분기 정보가 필요합니다.'
      }, { status: 400 });
    }

    // 캐시 확인 (강제 재생성이 아닌 경우)
    if (!forceRegenerate) {
      const cache = loadAICache(quarter);
      let cachedAnalysis: string | undefined;
      
      if (type === 'overview' && cache?.overview) {
        cachedAnalysis = cache.overview;
      } else if (type === 'turnover' && cache?.turnover && context?.entity) {
        cachedAnalysis = cache.turnover[context.entity];
      } else if (type === 'trend' && cache?.trend && context?.entity) {
        cachedAnalysis = cache.trend[context.entity];
      } else if (type === 'action' && cache?.actionPlanInsight) {
        cachedAnalysis = cache.actionPlanInsight;
      }
      
      if (cachedAnalysis) {
        console.log(`✅ AI 분석 캐시 사용: ${quarter}.${type}`);
        return NextResponse.json({
          success: true,
          analysis: cachedAnalysis,
          cached: true,
          generatedAt: cache?.generatedAt,
        });
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API 키가 설정되지 않았습니다.',
        analysis: '⚠️ AI 분석을 사용하려면 .env.local 파일에 OPENAI_API_KEY를 설정해주세요.'
      });
    }

    console.log(`🤖 AI 분석 생성 중: ${quarter}.${type}`);

    // 분석 타입에 따른 프롬프트 생성
    let prompt = '';
    
    switch (type) {
      case 'overview':
        prompt = generateOverviewPrompt(data);
        break;
      case 'turnover':
        prompt = generateTurnoverPrompt(context || data);
        break;
      case 'trend':
        prompt = generateTrendPrompt(context || data);
        break;
      case 'action':
        prompt = generateActionPrompt(data);
        break;
      default:
        return NextResponse.json({
          success: false,
          error: '잘못된 분석 타입입니다.'
        }, { status: 400 });
    }

    // OpenAI API 호출
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 F&F 그룹의 수석 재무 애널리스트입니다. 기관투자자 및 경영진에게 제공하는 전문 경제 리포트 수준의 운전자본 분석을 수행합니다.

**분석 스타일 (매우 중요):**
1. 정중하고 전문적인 어조 사용 (경제 리포트, 증권사 리서치 리포트 스타일)
2. 주요 지표의 맥락과 배경을 설명하여 이해도 향상
3. 데이터 기반의 객관적 분석 제공
4. 간결하면서도 핵심을 정확히 전달
5. 불필요한 수식어나 과장 표현 지양

**비즈니스 컨텍스트:**
1. 홍콩과 중국 법인은 국내 본사의 지역 판매법인으로, 연결 재무제표 작성 시 연결제거가 이루어집니다.
2. 따라서 홍콩/중국 법인의 매입채무는 거의 0에 가깝고, DPO는 분석적 의미가 없습니다.
3. 홍콩/중국 법인 분석 시 DSO와 DIO에 집중하고, DPO는 언급하지 마세요.

**분석 지시사항 (매우 중요):**
당신은 데이터를 실제로 분석하는 애널리스트입니다. 분석 방법을 설명하지 말고, 제공된 숫자를 근거로 구체적인 분석을 수행하세요.

**필수 분석 항목:**
1. **운전자본 증가의 적정성**: 
   - 운전자본 YoY 변화율 vs 매출 YoY 변화율을 비교
   - 예: "운전자본이 12.2% 증가했으나 매출은 5.1% 증가에 그쳐 자금 효율성이 저하되었습니다"
   
2. **재고 효율성**: 
   - 재고 증감 금액과 비율을 명시
   - DIO 변화와 함께 해석 (예: "DIO가 16일 증가하여 재고 회전이 둔화되었습니다")
   
3. **매출채권 관리**:
   - DSO 변화의 구체적 영향 (예: "DSO가 5일 증가하여 약 X억원의 추가 자금이 묶여있습니다")
   
4. **CCC 개선 효과**:
   - CCC 변화가 자금에 미치는 실제 영향을 금액으로 환산
   
5. **계절성 판단**:
   - 3Q 특성상 재고 증가가 자연스러운지, 과도한지 과거 데이터로 판단

**분석 시 반드시 포함해야 할 사항:**
1. 모든 금액은 단위를 명확히 표시 (억원)
2. 전체 연결 대비 각 법인의 비중(%)을 계산하여 언급
3. 작은 법인(전체의 5% 미만)의 경우, 비중이 작음을 고려하여 우선순위를 낮게 평가
4. 추세 분석 시 계절성과 전년 동기 대비 변화율을 함께 고려
5. 구체적인 수치와 단위를 정확히 언급

**금액 표기 주의사항 (절대적으로 중요):**
1. 제공된 데이터의 모든 금액 숫자는 이미 "억원" 단위입니다.
2. 숫자를 있는 그대로 사용하고, 뒤에 "억원"만 붙이세요.
3. 절대로 숫자를 곱하거나, 나누거나, 변환하지 마세요.
4. 소수점도 그대로 유지하세요.

**숫자 표기 규칙 (절대 준수):**

⚠️ **매우 중요: 소수점(.)과 쉼표(,)를 혼동하지 마세요!**

1. **숫자는 절대 변경하지 않습니다** - 곱하거나 나누지 마세요
2. **천단위마다 쉼표를 추가합니다** - 소수점은 그대로 유지
3. **소수점 첫째 자리까지 표시**

**정확한 포맷팅 예시:**

입력 숫자: 1424.2
  → 천단위에만 쉼표 추가
출력: "1,424.2억원" ✅

잘못된 예:
- "142,419억원" ❌ (소수점을 없애고 x100 곱함)
- "14,242억원" ❌ (소수점을 없애고 x10 곱함)
- "1424.2억원" ❌ (쉼표 없음)

**더 많은 예시:**

입력: 5.3 → 출력: "5.3억원" ✅
  ❌ "527억원" (x100 곱함)
  ❌ "53억원" (x10 곱함)

입력: 2250.1 → 출력: "2,250.1억원" ✅
  ❌ "225,010억원" (소수점 제거)
  ❌ "22,501억원" (x10 곱함)

입력: 97.5 → 출력: "97.5억원" ✅
  ❌ "9,753억원" (x100 곱함)
  ❌ "975억원" (x10 곱함)

입력: 11.5 → 출력: "11.5억원" ✅
  ❌ "1,149억원" (x100 곱함)
  ❌ "115억원" (x10 곱함)

**포맷팅 규칙:**
- 1000 이상: 쉼표 추가 (1,234.5)
- 1000 미만: 쉼표 없음 (234.5)
- 소수점(.)은 항상 유지
- 백분율: 18.5% (소수 첫째 자리)

**절대 금지:**
- ❌ 소수점 제거
- ❌ 숫자에 10, 100 곱하기
- ❌ 소수점을 쉼표로 착각

**증감률 표현 주의사항:**
1. 전년 데이터가 0이거나 매우 작은 경우, 증감률 대신 절대 금액 변화를 표현
   - 나쁜 예: "1000% 증가"
   - 좋은 예: "전년 0억원에서 5.3억원으로 증가"
2. 비중이 5% 미만인 작은 법인의 경우:
   - 백분율보다 절대 금액 변화를 우선 표현
3. 비정상적으로 큰 증감률(100% 이상)은 반드시 절대 금액과 함께 표현

**절대 금지 사항:**
1. 근거 없는 "업계 평균", "업계 목표" 수치 언급 금지
2. 출처가 명확하지 않은 벤치마크 수치 사용 금지
3. 임의로 추정한 목표 수치 제시 금지
4. 비교 시에는 반드시 "전년 동기 대비", "전 분기 대비", "과거 자사 데이터 대비"만 사용
5. 특정 수치를 목표로 제시할 때는 "예시", "참고" 등으로 명확히 표시하고, 실제 목표는 경영진 결정 사항임을 명시

한국어로 답변하며, 전문적이면서도 이해하기 쉽게 설명합니다.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const analysis = completion.choices[0]?.message?.content || 'AI 분석을 생성할 수 없습니다.';

    // 캐시에 저장
    if (type === 'overview') {
      updateAICachePartial(quarter, 'overview', analysis);
    } else if (type === 'turnover' && context?.entity) {
      const cache = loadAICache(quarter);
      const turnover = cache?.turnover || {};
      turnover[context.entity] = analysis;
      updateAICachePartial(quarter, 'turnover', turnover);
    } else if (type === 'trend' && context?.entity) {
      const cache = loadAICache(quarter);
      const trend = cache?.trend || {};
      trend[context.entity] = analysis;
      updateAICachePartial(quarter, 'trend', trend);
    } else if (type === 'action') {
      updateAICachePartial(quarter, 'actionPlanInsight', analysis);
    }
    
    console.log(`✅ AI 분석 캐시 저장: ${quarter}.${type}`);

    return NextResponse.json({
      success: true,
      analysis,
      cached: false,
      generatedAt: new Date().toISOString(),
      usage: completion.usage,
    });

  } catch (error: any) {
    console.error('AI 분석 오류:', error);
    
    // API 키 관련 오류 처리
    if (error?.status === 401) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API 키가 유효하지 않습니다.',
        analysis: '⚠️ OpenAI API 키를 확인해주세요.'
      });
    }
    
    return NextResponse.json({
      success: false,
      error: error.message || 'AI 분석 중 오류가 발생했습니다.',
      analysis: '죄송합니다. AI 분석을 생성하는 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// Overview 분석 프롬프트
function generateOverviewPrompt(data: any): string {
  const totalWC = data.currentWC;
  
  // 연결 자금 효과 계산
  const consolidatedImpact = calculateCashImpact(
    data.currentRevenue || 0, 
    data.currentCOGS || (data.currentRevenue || 0) * 0.35
  );
  
  // 법인별 데이터 준비
  const entitiesWithDetails = (data.entitiesDetail || []).map((e: any) => {
    const impact = calculateCashImpact(e.currentRevenue || 0, e.currentCOGS || 0);
    return {
      name: e.name,
      currentRevenue: e.currentRevenue || 0,
      previousRevenue: e.previousRevenue || 0,
      revenueChange: e.revenueChange || 0,
      currentReceivables: e.currentReceivables || 0,
      previousReceivables: e.previousReceivables || 0,
      receivablesChange: e.receivablesChange || 0,
      currentInventory: e.currentInventory || 0,
      previousInventory: e.previousInventory || 0,
      inventoryChange: e.inventoryChange || 0,
      currentDSO: e.currentDSO || 0,
      previousDSO: e.previousDSO || 0,
      dsoChange: e.dsoChange || 0,
      currentDIO: e.currentDIO || 0,
      previousDIO: e.previousDIO || 0,
      dioChange: e.dioChange || 0,
      cashImpact: impact,
      wcRatio: totalWC > 0 ? ((e.currentWC || 0) / totalWC * 100).toFixed(1) : 0
    };
  });

  return `⚠️ **중요: 아래 숫자는 이미 포맷팅되어 있습니다. 그대로 사용하고 "억원"만 붙이세요!**

# F&F 그룹 운전자본 분석 데이터 (단위: 억원)

## 1️⃣ 연결 관점 데이터

**현재 분기 (25.3Q):**
- 운전자본: ${formatNumber(data.currentWC)}억원
- 분기 매출: ${formatNumber(data.currentRevenue || 0)}억원
- 매출채권: ${formatNumber(data.currentReceivables)}억원
- 재고자산: ${formatNumber(data.currentInventory)}억원
- CCC: ${data.currentCCC}일

**전년 동기 (24.3Q):**
- 운전자본: ${formatNumber(data.previousWC)}억원
- 분기 매출: ${formatNumber(data.previousRevenue || 0)}억원
- 재고자산: ${formatNumber(data.previousInventory || 0)}억원
- CCC: ${data.previousCCC}일

**YoY 변화:**
- 운전자본: ${data.wcChange > 0 ? '+' : ''}${data.wcChange.toFixed(1)}% (${formatNumber(Math.abs(data.currentWC - data.previousWC))}억원)
- 매출: ${data.revenueChange > 0 ? '+' : ''}${data.revenueChange?.toFixed(1) || 0}%
- 재고: ${formatNumber(Math.abs(data.currentInventory - (data.previousInventory || 0)))}억원 (${((data.currentInventory - (data.previousInventory || 0)) / (data.previousInventory || 1) * 100).toFixed(1)}%)
- CCC: ${data.cccChange > 0 ? '+' : ''}${data.cccChange}일

**연결 자금 효과 (개선 시):**
- DSO 1일 단축 → ${consolidatedImpact.dsoPerDay.toFixed(1)}억원 회수
- DIO 1일 단축 → ${consolidatedImpact.dioPerDay.toFixed(1)}억원 절감
- DPO 1일 연장 → ${consolidatedImpact.dpoPerDay.toFixed(1)}억원 유예

## 2️⃣ 주요 법인별 데이터

${entitiesWithDetails.filter((e: any) => parseFloat(e.wcRatio) >= 10).map((e: any) => `
**${e.name} (연결 대비 ${e.wcRatio}%)**
- 매출: ${formatNumber(e.currentRevenue)}억원 → 전년 ${formatNumber(e.previousRevenue)}억원 (YoY ${e.revenueChange > 0 ? '+' : ''}${e.revenueChange.toFixed(1)}%)
- 매출채권: ${formatNumber(e.currentReceivables)}억원 → 전년 ${formatNumber(e.previousReceivables)}억원 (${e.receivablesChange > 0 ? '+' : ''}${e.receivablesChange.toFixed(1)}%)
- 재고: ${formatNumber(e.currentInventory)}억원 → 전년 ${formatNumber(e.previousInventory)}억원 (${e.inventoryChange > 0 ? '+' : ''}${e.inventoryChange.toFixed(1)}%)
- DSO: ${e.currentDSO}일 → 전년 ${e.previousDSO}일 (${e.dsoChange > 0 ? '+' : ''}${e.dsoChange}일)
- DIO: ${e.currentDIO}일 → 전년 ${e.previousDIO}일 (${e.dioChange > 0 ? '+' : ''}${e.dioChange}일)
- 자금 효과: DSO 1일 단축 시 ${e.cashImpact.dsoPerDay.toFixed(1)}억원 회수
`).join('\n')}

**위 데이터를 근거로 실제 분석을 수행하세요:**

## 분석 구조 (필수)

### 1. 연결 관점 분석 (3-4줄)
- 연결 매출 증가율 vs 운전자본 증가율 비교 → 효율성 판단
- 재고 증가가 매출 증가 대비 적정한지 평가
- CCC 변화가 자금 회전에 미치는 영향 (자금 효과 금액 활용)
- 결론: 전반적 운전자본 관리 수준

### 2. 주요 법인별 분석 (각 2-3줄, 비중 10% 이상 법인)
각 법인마다:
- 매출 증가율 vs 매출채권/재고 증가율 비교
- DSO/DIO 변화의 의미 해석
- 개선 필요 시 예상 자금 효과 (제공된 "자금 효과" 값 활용)

**예시:**
"중국 법인은 매출이 13.5% 증가했으나 매출채권은 19.2% 증가하여 DSO가 5일 악화되었습니다. DSO를 전년 수준으로 개선하면 약 84억원(16.9억원×5일)의 자금을 회수할 수 있습니다."

### 3. 즉시 조치 항목 (1-2개)
- 가장 큰 자금 영향이 있는 항목
- 구체적 개선 목표와 예상 효과 (금액)

**숫자 표기 필수:**
예) 1424.2 → "1,424.2억원" (천단위 쉼표만 추가, 소수점 유지)
   ❌ "142,419억원" "14,242억원" (숫자 변경 금지!)

증권사 애널리스트 리포트 수준의 전문적이고 정중한 분석을 작성해주세요.`;
}

// Turnover 분석 프롬프트 (회전율 + 추세 통합)
function generateTurnoverPrompt(data: any): string {
  const isHongKongOrChina = data.entity === '홍콩' || data.entity === '중국';
  
  // 3Q 분기 히스토리 분석
  const thirdQuarterAnalysis = data.thirdQuarterHistory && data.thirdQuarterHistory.length > 0
    ? data.thirdQuarterHistory.map((q: any) => 
        `- ${q.quarter}: DSO ${q.dso}일, DIO ${q.dio}일, ${!isHongKongOrChina ? `DPO ${q.dpo}일, ` : ''}CCC ${q.ccc}일`
      ).join('\n')
    : '과거 3Q 데이터 없음';
  
  // 추세 데이터
  const wcTrend = data.wcTrend || [];
  const revenueTrend = data.revenueTrend || [];
  const turnoverTrend = data.turnoverTrend || [];
  
  return `⚠️ **중요: 아래 금액 숫자는 이미 포맷팅되어 있습니다. 그대로 사용하고 "억원"만 붙이세요!**

# ${data.entity} 법인 회전율 및 추세 분석

## 1️⃣ 현재 분기 vs 전년 동기 비교

**${data.currentQuarter}:**
- 분기 매출: ${formatNumber(data.current?.revenue || 0)}억원
- 매출채권: ${formatNumber(data.current?.receivables || 0)}억원
- 재고자산: ${formatNumber(data.current?.inventory || 0)}억원
- DSO (매출채권회전일수): ${data.current.dso}일
- DIO (재고자산회전일수): ${data.current.dio}일
${!isHongKongOrChina ? `- DPO (매입채무회전일수): ${data.current.dpo}일` : '- DPO: 연결제거로 인해 분석 무의미'}
- CCC (현금전환주기): ${data.current.ccc}일

**${data.prevYearQuarter} (전년 동기):**
- 분기 매출: ${formatNumber(data.prevYear?.revenue || 0)}억원 → **변화: ${data.current?.revenue && data.prevYear?.revenue ? (((data.current.revenue - data.prevYear.revenue) / data.prevYear.revenue * 100).toFixed(1)) : '0'}%**
- 매출채권: ${formatNumber(data.prevYear?.receivables || 0)}억원 → **변화: ${data.current?.receivables && data.prevYear?.receivables ? (((data.current.receivables - data.prevYear.receivables) / data.prevYear.receivables * 100).toFixed(1)) : '0'}%**
- 재고자산: ${formatNumber(data.prevYear?.inventory || 0)}억원 → **변화: ${data.current?.inventory && data.prevYear?.inventory ? (((data.current.inventory - data.prevYear.inventory) / data.prevYear.inventory * 100).toFixed(1)) : '0'}%**
- DSO: ${data.prevYear.dso}일 → **변화: ${data.changes.dso > 0 ? '+' : ''}${data.changes.dso}일**
- DIO: ${data.prevYear.dio}일 → **변화: ${data.changes.dio > 0 ? '+' : ''}${data.changes.dio}일**
${!isHongKongOrChina ? `- DPO: ${data.prevYear.dpo}일 → **변화: ${data.changes.dpo > 0 ? '+' : ''}${data.changes.dpo}일**` : ''}
- CCC: ${data.prevYear.ccc}일 → **변화: ${data.changes.ccc > 0 ? '+' : ''}${data.changes.ccc}일**

## 2️⃣ 3Q 분기 히스토리 (계절성 분석)

**과거 3분기 데이터:**
${thirdQuarterAnalysis}

**계절성 패턴 확인:**
3Q(7-9월)는 일반적으로 하반기 시즌 준비를 위한 재고 확보 시기입니다.
- 패션업의 경우 F/W 시즌 준비로 재고(DIO)가 증가하는 경향
- 추석 등 명절 요인으로 매출채권(DSO) 변동 가능
- 위 히스토리 데이터를 통해 ${data.entity}의 3Q 고유 패턴을 파악하세요

## 3️⃣ 운전자본 및 회전율 추세

**운전자본 추이 (24.1Q → 25.3Q):**
${wcTrend.map((t: any) => `- ${t.quarter}: ${formatNumber(t.wc)}억원`).join('\n')}

**매출 추이 (24.1Q → 25.3Q):**
${revenueTrend.map((t: any) => `- ${t.quarter}: ${formatNumber(t.revenue)}억원`).join('\n')}

**회전율 추이 (24.1Q → 25.3Q):**
${turnoverTrend.map((t: any) => {
  if (isHongKongOrChina) {
    return `- ${t.quarter}: DSO ${t.dso}일, DIO ${t.dio}일, CCC ${t.ccc}일`;
  }
  return `- ${t.quarter}: DSO ${t.dso}일, DIO ${t.dio}일, DPO ${t.dpo}일, CCC ${t.ccc}일`;
}).join('\n')}

**추세 방향:**
- 운전자본: ${data.wcTrendDirection || '추세 정보 없음'}
- 매출: ${data.revenueTrendDirection || '추세 정보 없음'}
- CCC: ${data.cccTrendDirection || '추세 정보 없음'}

${isHongKongOrChina ? `
⚠️ **중요:** ${data.entity}는 국내 본사의 지역 판매법인으로, 연결제거로 인해 매입채무가 거의 0입니다.
따라서 DPO는 분석적 의미가 없으므로, **DSO와 DIO에만 집중**하여 분석해주세요.
` : ''}

---

## 📊 분석 가이드 (필수 준수)

**분석은 크게 2파트로 구성:**

### PART 1: 회전율 분석 (현재 분기 집중)

1. **전년 동기 대비 평가 (3-4줄)**
- ${data.prevYearQuarter} 대비 주요 변화와 의미
- **매출 증가율 vs 채권/재고 증가율 비교**: 매출이 X% 증가했는데 채권/재고가 Y% 증가했다면, 효율성이 개선/악화되었는지 판단
- 계절성을 고려한 평가 (과거 3Q 패턴과 비교)
- 자금 효율성 관점에서 판단

2. **분기별 특수성 분석 (2-3줄)**
- 3Q 고유의 패턴이 관찰되는가?
- 금년 3Q가 과거 3Q와 비교하여 특이한 점은?
- 계절 요인으로 설명 가능한 부분과 그렇지 않은 부분 구분

### PART 2: 추세 분석 (전체 분기 흐름)

3. **전반적인 추세 평가 (2-3줄)**
- 최근 분기와 과거 분기의 구체적인 수치 비교
- **성장동력 vs 자금효율성** 관점에서 추세 평가
- 추세의 가속/감속 여부와 원인 분석

4. **변곡점 또는 이상치 (있다면, 2-3줄)**
- 특정 분기의 급격한 변화 원인 분석
- 계절적 요인, 사업 확대, 재고 적체 등 검토

5. **향후 예상 추세 및 개선 방안 (2-3줄)**
- 계절성 패턴을 고려한 예측
- 자금 효율성 개선 방안
- 실행 가능한 구체적 액션

**금지사항:**
❌ 출처 없는 "업계 평균" 언급 금지
❌ 연간 기준 회전율과 비교 금지 (반드시 전년 동기 비교)
❌ 계절성 무시하고 단순 YoY 증감만 언급 금지

증권사 애널리스트 수준의 정중하고 전문적인 분석을 작성해주세요.`;
}

// Trend 분석 프롬프트
function generateTrendPrompt(data: any): string {
  const isHongKongOrChina = data.entity === '홍콩' || data.entity === '중국';
  
  // 최근 3개 분기 평균과 비교
  const recentTrend = data.wcTrend.slice(-3);
  const avgRecent = recentTrend.reduce((sum: number, t: any) => sum + t.wc, 0) / recentTrend.length;
  const latestWC = data.wcTrend[data.wcTrend.length - 1]?.wc || 0;
  const trendDiffValue = ((latestWC - avgRecent) / avgRecent * 100);
  const trendDiff = trendDiffValue.toFixed(1);

  return `⚠️ **중요: 아래 금액 숫자는 이미 포맷팅되어 있습니다. 그대로 사용하고 "억원"만 붙이세요!**

다음은 ${data.entity}의 분기별 추세 데이터입니다 (단위: 억원):

운전자본 추이 (24.1Q → 25.3Q):
${data.wcTrend.map((t: any) => `- ${t.quarter}: ${formatNumber(t.wc)}억원`).join('\n')}

회전율 추이:
${data.turnoverTrend.map((t: any) => {
  if (isHongKongOrChina) {
    return `- ${t.quarter}: DSO ${t.dso}일, DIO ${t.dio}일, CCC ${t.ccc}일`;
  }
  return `- ${t.quarter}: DSO ${t.dso}일, DIO ${t.dio}일, DPO ${t.dpo}일, CCC ${t.ccc}일`;
}).join('\n')}

주요 변화:
- 운전자본: ${data.wcTrendDirection}
- CCC: ${data.cccTrendDirection}
- 최근 3개 분기 평균 대비: ${trendDiffValue > 0 ? '+' : ''}${trendDiff}%

${isHongKongOrChina ? `
**참고:** ${data.entity}는 지역 판매법인으로 DPO는 연결제거로 인해 분석에서 제외합니다.
` : ''}

위 추세를 심층 분석하여:
1. 전반적인 추세 평가 (개선/악화/유지) - 2-3줄
   - 최근 분기와 과거 분기의 구체적인 수치 비교
   - **성장동력 vs 자금효율성** 관점에서 추세 평가
   - 추세의 가속/감속 여부와 원인 분석
   
2. 눈에 띄는 변곡점이나 이상치 (있다면) - 2-3줄
   - 특정 분기의 급격한 변화 원인 분석
   - **계절적 요인, 사업 확대, 재고 적체** 등 다양한 요인 검토
   - 매출 성장과의 연관성 파악
   
3. 향후 예상되는 추세와 전문적 대응 방안 - 2-3줄
   - **계절성 패턴**을 고려한 예측
   - 자금 효율성 개선 방안
   - 근거 기반의 구체적이고 실행 가능한 방안 제시

**숫자 표기:**
예) 1424.2 → "1,424.2억원" (숫자 그대로 + 천단위 쉼표)
   ❌ "142,419억원" "14,242억원" (곱하기 금지!)

경제 리포트 수준의 정중하고 전문적인 추세 분석을 작성해주세요.`;
}

// Action Plan 분석 프롬프트
function generateActionPrompt(data: any): string {
  return `⚠️ **중요: 아래 금액 숫자는 이미 포맷팅되어 있습니다. 그대로 사용하고 "억원"만 붙이세요!**

다음은 F&F 그룹 전체의 운전자본 현황입니다:

법인별 현황 (25.3Q):
${data.entities.map((e: any) => 
  `- ${e.name}: WC ${formatNumber(e.wc)}억원, CCC ${e.ccc}일 (전년 대비 ${e.yoy > 0 ? '+' : ''}${e.yoy.toFixed(1)}%)`
).join('\n')}

주요 이슈:
${data.issues.map((i: any) => `- ${i}`).join('\n')}

목표:
- 연결 CCC: 현재 ${data.currentCCC}일 → 목표 60일

위 정보를 바탕으로:
1. 우선순위 액션 플랜 (HIGH/MEDIUM/LOW 분류)
   - HIGH: 즉시 조치가 필요한 항목 (2-3개)
   - MEDIUM: 분기 내 개선 필요 항목 (2개)
   - LOW: 모니터링 항목 (1-2개)

2. 각 액션 플랜은 다음 형식으로:
   - 이슈: [구체적인 문제, 맥락 포함]
   - 액션: [실행 가능한 조치, 근거 기반]
   - 목표: [구체적인 KPI, 측정 가능]
   - 담당: [해당 부서/법인]

**숫자 표기:**
예) 1424.2 → "1,424.2억원" (숫자 그대로 + 천단위 쉼표)
   ❌ "142,419억원" (소수점 제거하면 안됨!)

경영진과 실무진을 위한 전문적이고 실행 가능한 액션 인사이트를 작성해주세요.`;
}
