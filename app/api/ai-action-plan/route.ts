import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { loadAICache, updateAICachePartial, AIAnalysisCache } from '@/lib/ai-cache';

// 숫자 포맷팅 함수 - 100만원 단위를 억원으로 변환 + 천단위 쉼표 추가
function formatNumber(num: number): string {
  // 100만원 단위를 억원으로 변환 (나누기 100)
  const inBillion = num / 100;
  return inBillion.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

// 우선순위 점수 계산 함수
interface IssueScore {
  entity: string;
  category: string; // '재고', '매출채권', '매입채무'
  score: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  changeRate: number; // 증감률 (%)
  cccImpact: number; // CCC 영향 (일수)
  entityWeight: number; // 비중 (%)
  amountChange: number; // 금액 변화 (억원)
}

function calculatePriorityScore(
  changeRate: number, // 증감률 (%)
  cccImpact: number, // CCC 영향 (일수 변화)
  entityWeight: number, // 연결 대비 비중 (%)
): number {
  // 1. 증감률 점수 (최대 40점)
  let changeScore = 0;
  if (changeRate >= 30) changeScore = 40;
  else if (changeRate >= 20) changeScore = 35;
  else if (changeRate >= 15) changeScore = 30;
  else if (changeRate >= 10) changeScore = 25;
  else if (changeRate >= 5) changeScore = 15;
  else changeScore = 10;

  // 2. CCC 영향 점수 (최대 30점)
  let cccScore = 0;
  if (cccImpact >= 40) cccScore = 30;
  else if (cccImpact >= 30) cccScore = 25;
  else if (cccImpact >= 20) cccScore = 20;
  else if (cccImpact >= 10) cccScore = 15;
  else if (cccImpact >= 5) cccScore = 10;
  else cccScore = 5;

  // 3. 비중 점수 (최대 40점 - 가중치 2배 증가!)
  let weightScore = 0;
  if (entityWeight >= 40) weightScore = 40;
  else if (entityWeight >= 30) weightScore = 35;
  else if (entityWeight >= 20) weightScore = 30;
  else if (entityWeight >= 10) weightScore = 20;
  else if (entityWeight >= 5) weightScore = 10;
  else weightScore = 5; // 5% 미만도 최소 5점

  let totalScore = changeScore + cccScore + weightScore;
  
  // 4. 비중 10% 미만 법인은 최대 70점 제한 (HIGH 방지)
  if (entityWeight < 10 && totalScore > 70) {
    totalScore = 70;
  }

  return totalScore;
}

function assignPriority(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

// OpenAI 클라이언트를 lazy하게 초기화
function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
  });
}

export async function POST(request: NextRequest) {
  try {
    const { data, quarter, selectedEntity, forceRegenerate } = await request.json();

    if (!quarter) {
      return NextResponse.json(
        { success: false, error: '분기 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    const entity = selectedEntity || '연결';
    const cacheKey = `${quarter}-${entity}`;

    // 캐시 확인 (강제 재생성이 아닌 경우)
    if (!forceRegenerate) {
      const cache = loadAICache(quarter);
      const actionPlanCache = cache?.actionPlan?.[entity];
      if (actionPlanCache) {
        console.log(`✅ AI 액션플랜 캐시 사용: ${cacheKey}`);
        return NextResponse.json({
          success: true,
          improvementDirection: actionPlanCache.improvementDirection || '',
          actionItems: actionPlanCache.actionItems || actionPlanCache, // 구버전 호환성
          cached: true,
          generatedAt: cache.generatedAt,
        });
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API Key가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    console.log(`🤖 AI 액션플랜 생성 중: ${cacheKey}`);

    const openai = getOpenAIClient();

    // 데이터 숫자를 미리 포맷팅 (모든 금액 데이터를 억원으로 변환)
    const formattedData = {
      ...data,
      // wcData 배열 포맷팅
      wcData: data.wcData?.map((item: any) => ({
        ...item,
        REVENUE_Q: formatNumber(item.REVENUE_Q || 0),
        COGS_Q: formatNumber(item.COGS_Q || 0),
        RECEIVABLES: formatNumber(item.RECEIVABLES || 0),
        INVENTORY: formatNumber(item.INVENTORY || 0),
        PAYABLES: formatNumber(item.PAYABLES || 0),
        WC: formatNumber(item.WC || 0),
        REVENUE_YTD: item.REVENUE_YTD ? formatNumber(item.REVENUE_YTD) : undefined,
        COGS_YTD: item.COGS_YTD ? formatNumber(item.COGS_YTD) : undefined,
      })),
      // turnoverData는 일수이므로 포맷팅 불필요
      turnoverData: data.turnoverData,
      summary: data.summary ? {
        ...data.summary,
        totalWC: formatNumber(data.summary.totalWC || 0),
        yoyChanges: data.summary.yoyChanges?.map((e: any) => ({
          ...e,
          currentWC: formatNumber(e.currentWC || 0),
          prevWC: formatNumber(e.prevWC || 0),
          wcChange: e.wcChange?.toFixed(1) || '0.0',
        })),
        turnoverMetrics: data.summary.turnoverMetrics?.map((t: any) => ({
          ...t,
          currentCCC: t.currentCCC || 0,
          prevCCC: t.prevCCC || 0,
          dso: t.dso || 0,
          dio: t.dio || 0,
          dpo: t.dpo || 0,
        })),
      } : undefined,
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📊 STEP 1: 전체 법인의 모든 이슈 점수화
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const allIssues: IssueScore[] = [];
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔍 디버깅: ${entity} 법인 점수 계산 시작`);
    console.log(`data.summary exists: ${!!data.summary}`);
    console.log(`data.summary.yoyChanges exists: ${!!data.summary?.yoyChanges}`);
    console.log(`data.summary.turnoverMetrics exists: ${!!data.summary?.turnoverMetrics}`);
    
    // 연결 WC를 기준으로 비중 계산
    const consolidatedWC = data.wcData?.find((d: any) => 
      d.QUARTER === data.currentQuarter && d.ENTITY === '연결'
    )?.WC || 1;
    
    console.log(`consolidatedWC: ${consolidatedWC}`);

    // 각 법인별로 이슈 점수화
    if (data.summary?.yoyChanges && data.summary?.turnoverMetrics) {
      console.log(`yoyChanges count: ${data.summary.yoyChanges.length}`);
      console.log(`turnoverMetrics count: ${data.summary.turnoverMetrics.length}`);
      for (const yoyChange of data.summary.yoyChanges) {
        const entityName = yoyChange.entity;
        
        console.log(`\n--- ${entityName} 법인 분석 ---`);
        console.log(`currentWC: ${yoyChange.currentWC}, prevWC: ${yoyChange.prevWC || 'N/A'}`);
        console.log(`currentInventory: ${yoyChange.currentInventory}, prevInventory: ${yoyChange.prevInventory}`);
        console.log(`currentReceivables: ${yoyChange.currentReceivables}, prevReceivables: ${yoyChange.prevReceivables}`);
        
        const turnoverMetric = data.summary.turnoverMetrics.find(
          (t: any) => t.entity === entityName
        );

        if (!turnoverMetric) {
          console.log(`❌ ${entityName}: turnoverMetric not found`);
          continue;
        }
        
        console.log(`turnoverMetric - dso: ${turnoverMetric.dso}, dio: ${turnoverMetric.dio}, dpo: ${turnoverMetric.dpo}`);

        // 연결 대비 비중 계산
        const entityWeight = (yoyChange.currentWC / consolidatedWC) * 100;
        console.log(`entityWeight: ${entityWeight.toFixed(1)}%`);

        // 재고 이슈 점수화
        const inventoryChangeRate = yoyChange.prevInventory > 0
          ? ((yoyChange.currentInventory - yoyChange.prevInventory) / yoyChange.prevInventory) * 100
          : 0;
        
        console.log(`inventoryChangeRate: ${inventoryChangeRate.toFixed(1)}%`);
        
        // prevDIO 계산: turnoverMetric.prevDIO가 없으면 prev 데이터에서 계산
        let prevDIO = turnoverMetric.prevDIO;
        if (!prevDIO) {
          const prevTurnover = data.turnoverData?.find(
            (t: any) => t.quarter === data.previousQuarter && t.entity === entityName
          );
          prevDIO = prevTurnover?.dio || 0;
          console.log(`prevDIO calculated from turnoverData: ${prevDIO}`);
        }
        const dioChange = turnoverMetric.dio - prevDIO;
        console.log(`dioChange: ${turnoverMetric.dio} - ${prevDIO} = ${dioChange}`);
        
        // 재고 이슈: 회전일수 악화(+5일 이상) OR 금액 대폭 증가(+15% 이상)
        if (dioChange > 5 || inventoryChangeRate > 15) {
          // 단, 둘 다 크게 개선된 경우는 제외
          if (!(inventoryChangeRate < -10 && dioChange < -10)) {
            const inventoryScore = calculatePriorityScore(
              Math.max(0, inventoryChangeRate), // 음수는 0으로
              Math.max(0, dioChange), // 음수는 0으로
              entityWeight
            );
            console.log(`✅ ${entityName} 재고 - score: ${inventoryScore}, priority: ${assignPriority(inventoryScore)}`);
            if (inventoryScore > 0) {
              allIssues.push({
                entity: entityName,
                category: '재고',
                score: inventoryScore,
                priority: assignPriority(inventoryScore),
                changeRate: inventoryChangeRate,
                cccImpact: dioChange,
                entityWeight,
                amountChange: (yoyChange.currentInventory - yoyChange.prevInventory) / 100, // 억원
              });
            }
          } else {
            console.log(`✅ ${entityName} 재고 개선됨: inventoryChangeRate=${inventoryChangeRate.toFixed(1)}%, dioChange=${dioChange.toFixed(1)}일`);
          }
        } else {
          console.log(`❌ ${entityName} 재고 스킵: inventoryChangeRate=${inventoryChangeRate.toFixed(1)}%, dioChange=${dioChange.toFixed(1)}일`);
        }

        // 매출채권 이슈 점수화
        const receivablesChangeRate = yoyChange.prevReceivables > 0
          ? ((yoyChange.currentReceivables - yoyChange.prevReceivables) / yoyChange.prevReceivables) * 100
          : 0;
        
        console.log(`receivablesChangeRate: ${receivablesChangeRate.toFixed(1)}%`);
        
        // prevDSO 계산: turnoverMetric.prevDSO가 없으면 prev 데이터에서 계산
        let prevDSO = turnoverMetric.prevDSO;
        if (!prevDSO) {
          const prevTurnover = data.turnoverData?.find(
            (t: any) => t.quarter === data.previousQuarter && t.entity === entityName
          );
          prevDSO = prevTurnover?.dso || 0;
          console.log(`prevDSO calculated from turnoverData: ${prevDSO}`);
        }
        const dsoChange = turnoverMetric.dso - prevDSO;
        console.log(`dsoChange: ${turnoverMetric.dso} - ${prevDSO} = ${dsoChange}`);
        
        // 매출채권 이슈: 회전일수 악화(+3일 이상) OR 금액 대폭 증가(+15% 이상)
        if (dsoChange > 3 || receivablesChangeRate > 15) {
          // 단, 둘 다 크게 개선된 경우는 제외
          if (!(receivablesChangeRate < -10 && dsoChange < -5)) {
            const receivablesScore = calculatePriorityScore(
              Math.max(0, receivablesChangeRate), // 음수는 0으로
              Math.max(0, dsoChange), // 음수는 0으로
              entityWeight
            );
            console.log(`✅ ${entityName} 매출채권 - score: ${receivablesScore}, priority: ${assignPriority(receivablesScore)}`);
            if (receivablesScore > 0) {
              allIssues.push({
                entity: entityName,
                category: '매출채권',
                score: receivablesScore,
                priority: assignPriority(receivablesScore),
                changeRate: receivablesChangeRate,
                cccImpact: dsoChange,
                entityWeight,
                amountChange: (yoyChange.currentReceivables - yoyChange.prevReceivables) / 100, // 억원
              });
            }
          } else {
            console.log(`✅ ${entityName} 매출채권 개선됨: receivablesChangeRate=${receivablesChangeRate.toFixed(1)}%, dsoChange=${dsoChange.toFixed(1)}일`);
          }
        } else {
          console.log(`❌ ${entityName} 매출채권 스킵: receivablesChangeRate=${receivablesChangeRate.toFixed(1)}%, dsoChange=${dsoChange.toFixed(1)}일`);
        }
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📊 STEP 2: 점수 순으로 정렬
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    allIssues.sort((a, b) => b.score - a.score);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 전체 법인 이슈 점수화 결과 (총 ${allIssues.length}개):`);
    if (allIssues.length === 0) {
      console.log('⚠️ 악화된 이슈가 없습니다!');
    } else {
      allIssues.forEach((issue, index) => {
        console.log(`${index + 1}위. ${issue.entity} ${issue.category}: ${issue.score}점 → ${issue.priority}`);
        console.log(`   증감률 ${issue.changeRate.toFixed(1)}%, CCC 영향 ${issue.cccImpact.toFixed(0)}일, 비중 ${issue.entityWeight.toFixed(1)}%`);
      });
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📊 STEP 3: 필터링
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let filteredIssues: IssueScore[];
    
    if (entity === '연결') {
      // 연결: LOW 제외, 상위 3개만 선택
      filteredIssues = allIssues
        .filter(issue => issue.priority !== 'LOW')
        .slice(0, 3);
      
      console.log(`\n🎯 연결 법인 필터링 규칙:`);
      console.log(`- LOW 우선순위 제외`);
      console.log(`- 상위 3개만 선택 (점수 순)`);
    } else {
      // 개별 법인: 해당 법인의 이슈만 필터링
      filteredIssues = allIssues.filter(issue => issue.entity === entity);
    }

    console.log(`\n📌 ${entity} 법인 필터링 결과 (${filteredIssues.length}개):`);
    if (filteredIssues.length === 0) {
      console.log(`⚠️ ${entity} 법인에 해당하는 이슈가 없습니다!`);
    } else {
      filteredIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.entity} ${issue.category}: ${issue.priority} (전체 ${allIssues.indexOf(issue) + 1}위, ${issue.score}점)`);
      });
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const prompt = `당신은 F&F 그룹의 재무 분석 전문가입니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 분석 대상: ${entity}
📌 우선순위는 이미 계산되어 제공됩니다 - 그대로 사용하세요!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **당신이 할 일:**
1. 아래 제공된 우선순위 정보를 **그대로** 사용하세요
2. 각 이슈에 대해 상세한 분석과 액션플랜을 작성하세요
3. **우선순위를 변경하거나 재계산하지 마세요!**

📊 **제공된 우선순위 정보:**
${filteredIssues.length === 0 
  ? `⚠️ ${entity} 법인에는 악화된 이슈가 없습니다. (모두 개선되었거나 유지 중)

improvementDirection에 개선된 상황을 간단히 설명하고, actionItems는 빈 배열 []로 반환하세요.`
  : filteredIssues.map((issue, index) => 
      `${index + 1}. **${issue.entity} ${issue.category}** (전체 ${allIssues.indexOf(issue) + 1}위)
   - priority: "${issue.priority}"
   - 증감률: ${issue.changeRate.toFixed(1)}%
   - CCC 영향: ${issue.cccImpact.toFixed(0)}일
   - 금액 변화: ${formatNumber(issue.amountChange * 100)}억원
   - 연결 대비 비중: ${issue.entityWeight.toFixed(1)}%
   → 이 우선순위를 그대로 사용하세요!`
    ).join('\n\n')
}

${entity === '연결' 
  ? `\n🔴 **연결 법인 특별 지침:**
- 위 ${filteredIssues.length}개 항목만 액션플랜에 포함하세요
- 더 추가하거나 제외하지 마세요
- 각 항목의 priority는 이미 결정되었습니다`
  : `\n🔵 **${entity} 법인 특별 지침:**
- 위 ${filteredIssues.length}개 항목만 액션플랜에 포함하세요
- priority는 전체 법인 기준으로 이미 결정되었습니다
- 변경하지 말고 그대로 사용하세요`
}

⚠️ **숫자 사용 규칙 (절대 준수):**
- **모든 금액 데이터가 이미 포맷팅되어 제공됩니다**:
  * wcData[].REVENUE_Q, RECEIVABLES, INVENTORY, PAYABLES, WC
  * summary.totalWC, yoyChanges[].currentWC, yoyChanges[].prevWC
- 이 포맷팅된 숫자를 **그대로 사용**하고 "억원"만 붙이세요
- 예: currentWC: "1,424.2" → "1,424.2억원"
- 예: RECEIVABLES: "408.3" → "408.3억원"
- **절대 숫자를 변환하거나 곱하지 마세요!**

**분석 스타일 (매우 중요):**
1. 전문 경제 리포트, 증권사 애널리스트 리서치 보고서 수준의 어조
2. 정중하고 객관적이며 근거 기반의 분석
3. 주요 지표의 맥락과 의미를 설명하여 경영진의 이해도 향상
4. 간결하면서도 핵심을 명확히 전달

**숫자 표기 규칙 (절대 준수):**
1. **천단위 쉼표 필수**: 1,424.2억원 (O) / 1424.2억원 (X)
2. **소수점 첫째 자리까지**:
   - 금액: 1,424.2억원
   - 백분율: 18.5%, 55.1%
3. **숫자를 절대 변환하지 말 것**

**데이터 읽기 및 표기 예시:**
입력: { "entity": "국내(OC)", "currentWC": "1,424.2", "wcChange": "-18.5" }
→ ✅ "국내(OC)의 운전자본 1,424.2억원 (전년 대비 -18.5%)"
→ ❌ "142,419억원" "14,242억원" "1424.2억원"(쉼표없음)

입력: { "entity": "기타", "currentWC": "5.3" }
→ ✅ "기타 법인 5.3억원"
→ ❌ "527억원" "530억원"

입력: { "entity": "중국", "currentWC": "2,250.1" }
→ ✅ "중국 법인 2,250.1억원"
→ ❌ "225,013억원" "22,501억원"

**중요한 비즈니스 컨텍스트:**
1. 홍콩과 중국 법인은 국내 본사의 지역 판매법인으로, 연결제거로 인해 매입채무가 거의 0입니다.
2. 따라서 홍콩/중국 법인의 DPO는 분석적 의미가 없으므로 액션플랜에 포함하지 마세요.
3. 작은 법인(연결 대비 5% 미만)의 경우, 절대 금액이 작더라도 비중을 고려하여 우선순위를 낮게 설정하세요.
4. 모든 금액은 단위(억원)를 명확히 표시해야 합니다.

**분석 지시사항 (매우 중요):**
당신은 데이터를 실제로 분석하는 애널리스트입니다. 분석 방법을 설명하지 말고, 제공된 숫자를 근거로 구체적인 분석을 수행하세요.

**⚠️ 증감 해석 가이드 (절대 오해 금지):**

1. **운전자본 변화 해석**:
   - **감소 (-)** = 전년 대비 운전자본이 줄어듦 = **자금 회수/유입** = 일반적으로 **긍정적**
     * 예: 24.3Q 1,747.8억 → 25.3Q 1,424.2억 = -323.6억 감소 = "323.6억원의 자금 회수"
   - **증가 (+)** = 전년 대비 운전자본이 늘어남 = **자금 투입/유출** = 효율성 측면에서 **부정적**
     * 예: 24.3Q 100억 → 25.3Q 150억 = +50억 증가 = "50억원의 추가 자금 투입"

2. **재고 변화 해석**:
   - **감소 (-)** = 재고가 줄어듦 = 재고 효율화 = **긍정적**
   - **증가 (+)** = 재고가 늘어남 = 자금 묶임 = **부정적** (단, 매출 증가율을 초과하는 경우)

3. **정확한 변화량 계산**:
   - currentWC - prevWC = 변화량
   - 음수(-)면 감소, 양수(+)면 증가
   - 예: 1,424.2 - 1,747.8 = **-323.6억원 (감소)**

4. **금지 사항**:
   - ❌ "운전자본 감소"를 "자금 유출" 또는 "악화"로 표현 금지
   - ❌ 근거 없는 금액 제시 금지 (예: "1,000억원 투입")
   - ❌ 증가/감소 방향을 반대로 해석 금지

**액션플랜 작성 시 필수 (매우 중요):**

1. **비교 분석 포맷 (절대 준수)**:
   
   ❌ **나쁜 예**: "재고가 2,470.2억원에서 2,420.0억원으로 줄었습니다."
   
   ✅ **좋은 예**: 
   "전년동기(24.3Q) 대비 재고 50.2억원 감소(2,470.2억원 → 2,420.0억원)하였으며, 
   이를 통해 DIO는 65일에서 62일로 3일 단축되어 자금 효율성이 개선되었습니다.
   전분기(25.2Q) 대비로는 242.7억원 증가하였으나, 이는 전년동기(24.2Q→24.3Q)의 
   추세(+39.6억원)를 고려할 때 계절적 요인으로 추정됩니다."

2. **필수 비교 항목**:
   - **전년동기 대비**: 반드시 포함, 주요 분석 기준
   - **전분기 대비**: 계절성 파악을 위해 포함
   - **회전율 변화**: 금액 변화와 함께 DSO/DIO/DPO 일수 변화 명시
   - **운전자본 영향**: 개별 항목(재고/채권/채무) 변화가 운전자본에 미친 영향

3. **매출과의 연관성**:
   - 매출 증감률 vs 운전자본 항목 증감률 비교
   - 예: "매출은 5% 증가에 그쳤으나 재고는 12% 증가하여 효율성 저하"

4. **개선 효과 (구체적 근거 필수)**:
   - ✅ "전년동기 수준(XX일) 회복 시 약 YY억원 자금 회수 가능"
   - ✅ "전분기 수준으로 개선 시 ZZ억원 효과 예상"
   - ❌ "DSO를 15일로 감축" (근거 없는 절대 목표 금지)

**금액 표기 주의사항 (절대적으로 중요):**
1. **모든 금액 필드가 이미 포맷팅되어 "억원" 단위입니다**:
   - wcData[].REVENUE_Q, RECEIVABLES, INVENTORY, PAYABLES, WC
   - summary.totalWC, yoyChanges[].currentWC, yoyChanges[].prevWC
2. 이 값들을 **있는 그대로** 사용하고, 뒤에 "억원"만 붙이세요.
3. **절대로 숫자를 곱하거나, 나누거나, 변환하지 마세요.**
4. 쉼표(,)와 소수점(.)이 포함된 **문자열**이므로 그대로 사용하세요.
5. turnoverData의 dso, dio, dpo, ccc는 "일수"이므로 포맷팅되지 않았습니다 (숫자 그대로 사용).

**숫자 표기 규칙 (절대 준수):**

⚠️ **매우 중요: 소수점(.)과 쉼표(,)를 혼동하지 마세요!**

1. **숫자는 절대 변경하지 않습니다** - 곱하거나 나누지 마세요
2. **천단위마다 쉼표를 추가합니다** - 소수점은 그대로 유지
3. **소수점 첫째 자리까지 표시**

**정확한 포맷팅:**

입력: 1424.2 → 출력: "1,424.2억원" ✅
  ❌ "142,419억원" (소수점 제거 + x100)
  ❌ "14,242억원" (소수점 제거 + x10)

입력: 5.3 → 출력: "5.3억원" ✅
  ❌ "527억원" (x100)
  ❌ "53억원" (x10)

입력: 2250.1 → 출력: "2,250.1억원" ✅
  ❌ "225,010억원" (소수점 제거)
  ❌ "22,501억원" (x10)

입력: 97.5 → 출력: "97.5억원" ✅
  ❌ "9,753억원" (x100)
  ❌ "975억원" (x10)

입력: 11.5 → 출력: "11.5억원" ✅
  ❌ "1,149억원" (x100)
  ❌ "115억원" (x10)

**절대 금지:**
- ❌ 소수점 제거
- ❌ 숫자에 10, 100 곱하기
- ❌ 소수점을 쉼표로 착각

**절대 하지 말아야 할 것:**
- ❌ 숫자에 100을 곱하기
- ❌ 소수점을 정수로 변환
- ❌ 단위를 추정하여 변환

**증감률 표현 주의사항:**
1. 전년 데이터가 0이거나 매우 작은 경우 (10억원 미만), 증감률 대신 절대 금액 변화를 표현
   - 나쁜 예: "1000% 증가"
   - 좋은 예: "전년 0억원에서 5.3억원으로 증가"
2. 비중이 5% 미만인 작은 법인의 경우:
   - 백분율보다 절대 금액 변화를 우선 표현
   - 예: "기타 법인 5.3억원 (전년 대비 +5.3억원, 연결 대비 0.1% 비중)"
3. 비정상적으로 큰 증감률(100% 이상)은 반드시 절대 금액과 함께 표현

**절대 금지 사항 (위반 시 분석 전체 무효):**

1. **근거 없는 목표 설정 절대 금지**:
   ❌ "DSO를 15일로 감축"
   ❌ "CCC 60일 달성"
   ❌ "재고를 200억원으로 축소"
   → 근거가 없는 절대 수치 목표는 절대 제시 금지!

2. **허용되는 목표 표현 (상대적 기준만)**:
   ✅ "전년동기(24.3Q) 수준(XX일) 회복"
   ✅ "전분기(25.2Q) 대비 YY% 개선"
   ✅ "24년 연평균(ZZ일) 수준으로 복귀"

3. **불확실한 추정은 명확히 표시**:
   ✅ "계절적 요인으로 추정되나, 추가 검토가 필요합니다"
   ✅ "개선 추세이나, 지속 가능성은 확인이 필요합니다"
   ❌ "계절적 요인입니다" (단정 금지)

4. **무의미한 분석 금지**:
   ❌ "재고 50억원 증가 → 50억원 회수 가능" (단순 반복)
   ❌ "DIO 3일 증가" (실제 334→361일인데 계산 오류)
   ✅ "전년동기(24.3Q 334일) 대비 DIO 27일 증가(361일), 재고 XX억원 과다 투입"
   ✅ "전년동기 수준(334일) 회복 시 약 YY억원 자금 회수 가능 (재고 27일분 × 일평균 COGS)"

5. **계산 검증 필수**:
   - 회전일수 변화 = 금년 회전일수 - 전년 회전일수
   - 자금 효과 = 회전일수 변화 × 일평균 매출/COGS
   - 모든 숫자는 데이터에서 직접 계산, 추정 금지

6. **기타 금지 사항**:
   - 근거 없는 "업계 평균", "업계 목표" 절대 사용 금지
   - 출처가 불분명한 벤치마크 수치 언급 금지
   - 구체적인 목표 일수나 금액은 경영진 결정 사항임을 인지

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 작성 가이드
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**❌ 절대 금지:**
- 우선순위 변경 또는 재계산
- 제공된 항목 추가 또는 제외
- 점수 언급 (내부 계산이므로 숨김)

**✅ 반드시 할 것:**
- 제공된 priority를 그대로 사용
- 제공된 항목 수만큼만 작성
- 전년동기 대비, 전분기 대비 분석
- 구체적이고 실행 가능한 액션 제시

데이터: ${JSON.stringify(formattedData, null, 2)}
📋 JSON 응답 형식
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ **중요 알림:**
- 점수(예: "95점", "85점")는 응답에 절대 포함하지 마세요
- priority 필드에 "HIGH", "MEDIUM", "LOW"만 표시

다음 형식의 JSON 객체를 반환해주세요:
{
  "improvementDirection": "**전반적인 개선 방향**\n\n**1. 현황 평가 (전년동기 대비)**\n25.3Q 연결 기준 운전자본은 X억원으로 전년 동기(24.3Q YY억원) 대비 ZZ억원 증가(+AA%)했습니다. 매출은 BB% 증가에 그쳐 운전자본 증가율이 매출 성장률을 상회하고 있어 자금 효율성이 저하되었습니다.\n\n전분기(25.2Q) 대비로는 CC억원 증가하였으나, 전년동기 추세(24.2Q→24.3Q: +DD억원)와 비교 시 계절적 패턴으로 판단됩니다.\n\n**2. 주요 이슈 (문제 항목만, 법인별)**\n⚠️ 개선된 항목은 언급하지 마세요!\n• [법인명]: 전년동기 대비 [항목] XX억원 증가(YY억→ZZ억), [회전율] AA일 증가(BB일→CC일), 매출증가율(DD%) 대비 과다 투입으로 자금 효율성 저하\n• [법인명]: 전년동기 대비 [항목] XX억원 증가(YY억→ZZ억), [회전율] AA일 증가, 자금 EE억원 추가 투입 필요\n\n**3. 개선 우선순위 및 전략 (문제 항목만)**\n① [법인/항목]: 전년동기 수준(XX일) 회복 시 약 YY억원 자금 회수 가능\n② [법인/항목]: 전분기 대비 추가 증가 억제 필요, 계절성 감안 시 ZZ억원 감축 목표\n\n**4. 예상 개선 효과**\n전년동기 수준 회복 시 총 XX억원, 전분기 대비 개선 시 추가 YY억원의 운전자본 감축이 가능할 것으로 전망됩니다.",
  "actionItems": [
    {
      "priority": "HIGH",
      "label": "재고",
      "issue": "중국 법인 재고 전년동기 대비 485.7억원 증가(948.2억 → 1,433.9억), DIO 39일 증가(118일 → 157일). 매출증가율(13.5%) 대비 재고증가율(51.2%)이 과다하여 자금 효율성 저하. 연결 대비 비중 35%로 최우선 관리 필요.",
      "action": "SKU별 재고 회전율 분석 및 Slow-moving 재고 정리. 전년동기(24.3Q) 추세와 비교하여 과다 재고 원인 파악 후 발주 조정.",
      "target": "전년동기 수준(948.2억원, DIO 118일) 회복. 달성 시 약 200억원 자금 회수 가능.",
      "responsible": "중국 법인 재무팀"
    },
    {
      "priority": "HIGH",
      "label": "재고",
      "issue": "ST(미국) 재고 전년동기 대비 73.3억원 증가(51.5억 → 124.8억), DIO 258일 증가(220일 → 478일). 매출증가율(95.4%) 대비 재고증가율(142%)이 과다하여 자금 효율성 저하. 재고 회전 둔화 심각.",
      "action": "재고 수준 긴급 점검 및 Slow-moving 재고 정리. 수요 예측 정확도 개선 및 발주 최적화.",
      "target": "전년동기 수준(51.5억원, DIO 220일) 회복. 달성 시 약 120억원 자금 회수 가능.",
      "responsible": "ST(미국) 재무팀"
    },
    {
      "priority": "MEDIUM",
      "label": "매출채권",
      "issue": "중국 법인 매출채권 전년동기 대비 156.7억원 증가(818.6억 → 975.3억), DSO 2일 증가(35일 → 37일). 전분기 대비로는 증가 추세로 자금 효율성 저하.",
      "action": "대금 회수 프로세스 점검 및 연체 채권 관리 강화. 주요 거래처 신용 관리 강화.",
      "target": "전년동기 수준(818.6억원, DSO 35일) 회복. 달성 시 약 60억원 자금 회수 가능.",
      "responsible": "중국 법인 영업/재무팀"
    }
  ]
}

⚠️ **주의사항:**
1. 위 예시는 "연결" 법인 케이스 (상위 2-3개 선택)
2. "증가"한 문제 항목만 포함, "감소"나 "단축"된 항목 제외
3. 개별 법인 선택 시에도 우선순위는 전체 법인 기준 유지

**개별 법인 응답 예시:**

${entity === '국내(OC)' 
  ? `**국내(OC) 법인 응답:**
{
  "improvementDirection": "국내 법인은 전년동기 대비 운전자본이 감소하여 자금 효율성이 개선되었으나, 재고 회전일수(DIO)는 27일 증가하여...",
  "actionItems": [
    {
      "priority": "MEDIUM",
      "label": "재고",
      "issue": "국내(OC) 재고 전년동기 대비 50.2억원 증가(2,420.0억 → 2,470.2억), DIO 27일 증가(334일 → 361일)...",
      "action": "SKU별 재고 회전율 분석 및 Slow-moving 재고 정리...",
      "target": "전년동기 수준 회복 시 약 50억원 자금 회수 가능",
      "responsible": "국내(OC) 재무팀"
    }
  ]
}
→ 국내 재고: MEDIUM (전체 4위) - 점수는 내부용, 응답에 미포함`
  : entity === '중국'
  ? `**중국 법인 응답:**
{
  "improvementDirection": "중국 법인은 전년동기 대비 운전자본이 627.4억원 증가하여 자금 효율성이 저하되었으며...",
  "actionItems": [
    {
      "priority": "HIGH",
      "label": "재고",
      "issue": "중국 법인 재고 전년동기 대비 485.7억원 증가(948.2억 → 1,433.9억), DIO 39일 증가(118일 → 157일)...",
      "action": "SKU별 재고 회전율 분석 및 Slow-moving 재고 정리...",
      "target": "전년동기 수준 회복 시 약 200억원 자금 회수 가능",
      "responsible": "중국 법인 재무팀"
    },
    {
      "priority": "MEDIUM",
      "label": "매출채권",
      "issue": "중국 법인 매출채권 전년동기 대비 156.7억원 증가...",
      "action": "대금 회수 프로세스 점검...",
      "target": "약 60억원 자금 회수 가능",
      "responsible": "중국 법인 영업/재무팀"
    }
  ]
}
→ 중국 재고: HIGH (전체 1위) - 점수는 내부용, 응답에 미포함
→ 중국 매출채권: MEDIUM (전체 3위) - 점수는 내부용, 응답에 미포함`
  : `**${entity} 법인 응답:**
해당 법인의 이슈를 포함하되, 우선순위는 전체 법인 기준 점수에 따라 결정.
단, "XX점이므로"와 같은 점수 언급은 절대 금지!`
}

**🔴 최종 체크리스트 (반드시 확인):**
- ✅ **개선된 항목(감소/단축)을 액션플랜에서 완전히 제외했는가?**
  * ❌ 운전자본 감소, 재고 감소, CCC 단축 → 제외!
  * ✅ 운전자본 증가, 재고 증가, CCC 증가 → 포함!
- ✅ **전체 법인(국내, 중국, 홍콩, ST, 기타)의 모든 이슈를 점수화했는가?**
  * 개별 법인 선택 시에도 전체 기준으로 점수화!
- ✅ **우선순위가 전체 법인 기준인가?**
  * 개별 법인 내 비교 ❌
  * 전체 법인 간 비교 ✅
- ✅ 모든 금액이 포맷팅된 값을 그대로 사용했는가?
- ✅ (연결 법인의 경우) 전체 이슈 중 상위 2-3개만 선택했는가?
- ✅ (개별 법인의 경우) 해당 법인 이슈만 필터링하되 우선순위는 전체 기준으로 유지했는가?
- ✅ 증감 방향을 정확히 해석했는가? (WC 감소 = 자금 회수 = 긍정적 = 제외)
- ✅ **응답에 점수를 포함하지 않았는가?** (priority만 HIGH/MEDIUM/LOW로 표시)

주요 분석 포인트:
1. 각 법인별 운전자본 증감률 (YoY)과 연결 대비 비중(%)
   - **성장동력 vs 자금효율성** 양면 평가
   - 매출 성장률 대비 운전자본 증가의 적정성
2. CCC(현금전환주기)의 전년 동기 대비 변화
   - 자금 회전 및 수익성에 미치는 영향
3. DSO, DIO 지표 분석 (홍콩/중국의 경우 DPO 제외)
   - 전년 대비 변화와 매출원가율 변화 연계
   - **계절적 요인** 가능성 검토
4. 재고 증감 분석 (단위: 억원, 전년 대비 %, 맥락 포함)
   - 계절적 요인, 사업 확대, 재고 적체 구분
5. 법인별 특이사항 및 리스크 (비중 고려, 근거 기반)
6. 과거 자사 데이터 대비 개선/악화 추세

**작성 스타일:**
- 정중하고 전문적인 어조 (증권사 애널리스트 리포트 수준)
- 객관적 근거 기반 분석
- 실행 가능하고 구체적인 액션 제시

**분석 데이터:**
${JSON.stringify(formattedData, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 JSON 응답 형식
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

다음 형식의 JSON 객체만 반환하세요:
{
  "improvementDirection": "전반적인 개선 방향 텍스트...",
  "actionItems": [
    {
      "priority": "제공된 우선순위 그대로", 
      "label": "항목명",
      "issue": "상세 설명",
      "action": "구체적 액션",
      "target": "목표",
      "responsible": "담당"
    }
  ]
}

⚠️ **마지막 체크:**
- [ ] 제공된 priority를 그대로 사용했나요?
- [ ] 제공된 ${filteredIssues.length}개 항목만 작성했나요?
- [ ] 점수를 응답에 포함하지 않았나요?
- [ ] JSON 형식이 올바른가요?`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0].message.content?.trim() || '{}';
    
    // JSON 추출 (코드 블록이 있을 경우 제거)
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }
    
    const result = JSON.parse(jsonText);
    const improvementDirection = result.improvementDirection || '';
    const actionItems = result.actionItems || [];

    // 캐시에 법인별로 저장
    const cache: AIAnalysisCache = loadAICache(quarter) || { quarter, generatedAt: new Date().toISOString() };
    const actionPlanCache = cache.actionPlan || {};
    actionPlanCache[entity] = { improvementDirection, actionItems };
    updateAICachePartial(quarter, 'actionPlan', actionPlanCache);
    console.log(`✅ AI 액션플랜 캐시 저장: ${cacheKey}`);

    return NextResponse.json({
      success: true,
      improvementDirection,
      actionItems,
      cached: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('AI 액션플랜 생성 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
