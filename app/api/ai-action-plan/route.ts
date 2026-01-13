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

    // 법인별 액션플랜 개수 가이드
    const actionCountGuide = entity === '연결' 
      ? '5-6개 (국내, 중국, 홍콩 중심 + ST 또는 기타 추가)'
      : entity === '국내(OC)' || entity === '중국' || entity === '홍콩'
      ? '2-3개 (비중이 큰 법인이므로 상세하게)'
      : '1-2개 (비중이 작은 법인이므로 간단히)';

    const prompt = `당신은 F&F 그룹의 재무 분석 전문가입니다. 

📌 **분석 대상: ${entity}**
📌 **액션플랜 개수: ${actionCountGuide}**

${entity === '연결' 
  ? '연결 기준으로 전체 법인의 종합 분석을 수행하되, 비중이 큰 국내(OC), 중국, 홍콩 법인의 주요 이슈를 중심으로 액션플랜을 작성하세요.'
  : `${entity} 법인에만 집중하여 분석하고, 해당 법인의 핵심 이슈에 대한 액션플랜을 작성하세요.`
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

데이터: ${JSON.stringify(data)}

**🚨 우선순위 점수화 시스템 (내부 판단 기준 - 결과물에 점수 표시 금지!):**

⚠️ **중요: 점수는 당신의 내부 판단 기준으로만 사용하고, 최종 응답(actionItems)에는 절대 포함하지 마세요!**

${entity === '연결' 
  ? `
**⚠️ "연결" 법인 특별 규칙:**
1. **먼저 개별 법인(국내, 중국, 홍콩, ST, 기타)의 모든 주요 이슈를 내부적으로 점수화**
2. **전체 이슈를 점수 순으로 정렬**
3. **상위 2-3개만 선택하여 액션플랜에 포함**
4. 각 법인당 1개씩 나열하지 말 것!

내부 판단 예시 (점수는 응답에 포함하지 않음):
- 중국 재고: 200억 회수 가능, 증감률 +51%, DIO +39일 → (내부 점수: 90점) → **선택 → HIGH**
- ST 재고: 120억 회수 가능, 증감률 +142%, DIO +258일 → (내부 점수: 85점) → **선택 → HIGH**  
- 국내 재고: 50억 회수 가능, 증감률 +2%, DIO +27일 → (내부 점수: 50점) → 제외
- 홍콩 재고: 13억 회수 가능, 증감률 +9%, DIO +1일 → (내부 점수: 30점) → 제외
`
  : `
**개별 법인 규칙:**
- 해당 법인의 주요 이슈(재고, 매출채권 등)를 내부적으로 점수화
- ${actionCountGuide}
`
}

**🚨 액션플랜 = 문제/리스크만 포함! (매우 중요)**

**절대 원칙:**
- ✅ **악화된 항목만** 액션플랜에 포함 (운전자본 증가, 재고 증가, CCC 증가 등)
- ❌ **개선된 항목은 절대 포함 금지** (운전자본 감소, 재고 감소, CCC 단축 등)
- ❌ 증감률이 마이너스(-) 또는 개선된 경우 → 점수 0점 → **액션플랜에서 완전히 제외**

**예시:**
- ❌ 제외: "국내(OC) 운전자본 323.6억원 감소 (자금 회수)" → 이건 좋은 결과!
- ✅ 포함: "중국 재고 485.7억원 증가 (자금 묶임)" → 이건 문제!

**점수 계산 공식 (내부 사용만):**

각 이슈에 대해 다음 항목을 점수화하여 합산 (이 점수는 응답에 포함하지 마세요):

⚠️ **사전 필터링: 개선된 항목(감소/단축)은 점수화 전에 제외!**

1. **증감률 점수** (최대 50점) - **악화(+)만 점수 부여**:
   - +30% 이상 악화: 50점
   - +20~30% 악화: 40점
   - +10~20% 악화: 30점
   - +5~10% 악화: 20점
   - ±5% 이내: 10점
   - **개선(-): 액션플랜에서 제외!**

2. **CCC 영향 점수** (최대 30점) - **증가(+)만 점수 부여**:
   - +40일 이상: 30점
   - +30~40일: 25점
   - +20~30일: 20점
   - +10~20일: 15점
   - +5~10일: 10점
   - ±5일 이내: 5점
   - **개선(단축/-): 액션플랜에서 제외!**

3. **운전자본 비중 점수** (최대 20점):
   - 연결 대비 30% 이상: 20점
   - 20~30%: 15점
   - 10~20%: 10점
   - 5~10%: 5점
   - 5% 미만: 0점 (자동 LOW)

**우선순위 배분 규칙:**
- **총점 기준으로 정렬 후**:
  * 상위 30-40%: HIGH
  * 중위 30-40%: MEDIUM
  * 하위 30-40%: LOW
- **5점 이내 유사 점수는 같은 레벨로 분류**
- **5% 미만 비중 법인은 점수와 무관하게 무조건 LOW**

❌ **금지**: "점수가 XX점이므로 HIGH입니다", "80점으로 최우선 과제입니다" 등의 표현
✅ **허용**: priority 필드에 "HIGH", "MEDIUM", "LOW"만 표시

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

⚠️ **주의: 위 예시는 "증가"한 문제 항목만 포함. "감소"나 "단축"된 항목은 절대 포함하지 마세요!**

**🔴 최종 체크리스트 (반드시 확인):**
- ✅ **개선된 항목(감소/단축)을 액션플랜에서 완전히 제외했는가?**
  * ❌ 운전자본 감소, 재고 감소, CCC 단축 → 제외!
  * ✅ 운전자본 증가, 재고 증가, CCC 증가 → 포함!
- ✅ 모든 금액이 포맷팅된 값을 그대로 사용했는가?
- ✅ 점수화 시스템을 내부적으로 적용하여 우선순위를 정했는가?
- ✅ (연결 법인의 경우) 전체 법인의 **문제 항목만** 점수화하여 상위 2-3개만 선택했는가?
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

**중요**: 
1. 위 formattedData의 **모든 금액 필드는 이미 포맷팅**되어 있습니다
2. 예시:
   - wcData[].WC가 "408.3"이면 → "408.3억원"
   - wcData[].RECEIVABLES가 "1,424.2"이면 → "1,424.2억원"
   - summary.yoyChanges[].currentWC가 "214.2"이면 → "214.2억원"
3. **숫자를 절대 변환하거나 곱하지 마세요**
4. turnoverData의 dso, dio, dpo, ccc는 일수이므로 "일"만 붙이세요 (예: dso가 65이면 → "65일")
5. 오직 JSON 객체만 반환하고, 다른 텍스트는 포함하지 마세요`;

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
