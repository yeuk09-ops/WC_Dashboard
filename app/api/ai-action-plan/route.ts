import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { loadAICache, updateAICachePartial } from '@/lib/ai-cache';

// OpenAI 클라이언트를 lazy하게 초기화
function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
  });
}

export async function POST(request: NextRequest) {
  try {
    const { data, quarter, forceRegenerate } = await request.json();

    if (!quarter) {
      return NextResponse.json(
        { success: false, error: '분기 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    // 캐시 확인 (강제 재생성이 아닌 경우)
    if (!forceRegenerate) {
      const cache = loadAICache(quarter);
      if (cache?.actionPlan) {
        console.log(`✅ AI 액션플랜 캐시 사용: ${quarter}`);
        return NextResponse.json({
          success: true,
          actionItems: cache.actionPlan,
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

    console.log(`🤖 AI 액션플랜 생성 중: ${quarter}`);

    const openai = getOpenAIClient();

    const prompt = `당신은 F&F 그룹의 재무 분석 전문가입니다. 다음 운전자본 데이터를 분석하여 우선순위별 액션플랜을 JSON 형식으로 생성해주세요.

**데이터 읽기 예시 (절대적으로 중요):**
데이터에 이렇게 있다면:
{
  "entity": "국내(OC)",
  "wc": 1424.2,
  "yoy": -18.5
}
반드시 이렇게 읽으세요: "국내(OC)의 운전자본 1424.2억원 (전년 대비 -18.5%)"
절대 이렇게 읽지 마세요: "142,419억원" 또는 "14,242억원"

데이터에 이렇게 있다면:
{
  "entity": "기타",
  "wc": 5.3,
  "yoy": 0
}
반드시 이렇게 읽으세요: "기타 법인 5.3억원"
절대 이렇게 읽지 마세요: "527억원" 또는 "530억원"

**중요한 비즈니스 컨텍스트:**
1. 홍콩과 중국 법인은 국내 본사의 지역 판매법인으로, 연결제거로 인해 매입채무가 거의 0입니다.
2. 따라서 홍콩/중국 법인의 DPO는 분석적 의미가 없으므로 액션플랜에 포함하지 마세요.
3. 작은 법인(연결 대비 5% 미만)의 경우, 절대 금액이 작더라도 비중을 고려하여 우선순위를 낮게 설정하세요.
4. 모든 금액은 단위(억원)를 명확히 표시해야 합니다.

**금액 표기 주의사항 (절대적으로 중요):**
1. JSON 데이터의 모든 WC, RECEIVABLES, INVENTORY, PAYABLES 값은 이미 "억원" 단위입니다.
2. 숫자를 있는 그대로 사용하고, 뒤에 "억원"만 붙이세요.
3. 절대로 숫자를 곱하거나, 나누거나, 변환하지 마세요.
4. 소수점도 그대로 유지하세요.

**올바른 예시:**
- 데이터: "wc": 1424.2 → 출력: "1424.2억원" (142,420억원 아님!)
- 데이터: "wc": 2250.1 → 출력: "2250.1억원" (225,010억원 아님!)
- 데이터: "wc": 5.3 → 출력: "5.3억원" (530억원 아님!)
- 데이터: "wc": 214.2 → 출력: "214.2억원" (21,420억원 아님!)

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

**절대 금지 사항:**
1. 근거 없는 "업계 평균", "업계 목표" 수치 절대 사용 금지
2. 출처가 불분명한 벤치마크 수치 언급 금지
3. 임의로 추정한 목표치 제시 금지 (예: "CCC 60일 목표", "DSO 30일 이하" 등)
4. 목표 수치는 "전년 대비 X% 개선", "전 분기 수준 회복" 등 상대적 표현만 사용
5. 구체적인 목표 일수나 금액은 경영진 결정 사항임을 인지하고 제시하지 않음

데이터: ${JSON.stringify(data)}

다음 형식의 JSON 배열을 반환해주세요 (5-7개 항목):
[
  {
    "priority": "HIGH" | "MEDIUM" | "LOW",
    "label": "카테고리 (예: 재고, 채권, 운전자본 등)",
    "issue": "구체적인 이슈 설명 (반드시 금액 단위 '억원' 포함, 연결 대비 비중% 언급)",
    "action": "실행 가능한 구체적인 액션",
    "target": "개선 방향 (예: '전년 수준 회복', '전 분기 대비 10% 개선' 등, 절대 수치 사용 금지)",
    "responsible": "담당 부서/법인"
  }
]

우선순위 판단 기준 (비중과 변화율을 모두 고려):
- HIGH: 
  * 연결 대비 20% 이상 비중을 차지하는 법인의 전년 대비 20% 이상 악화
  * 전년 동기 대비 현저한 악화 추세를 보이는 주요 법인 (비중 10% 이상)
  * 즉각적인 현금흐름 리스크가 있는 경우
- MEDIUM: 
  * 연결 대비 10-20% 비중 법인의 전년 대비 15% 이상 악화
  * 연결 대비 5-10% 비중 법인의 전년 대비 30% 이상 악화
  * 분기 내 개선이 필요한 경우
- LOW: 
  * **연결 대비 5% 미만 비중의 법인은 반드시 LOW (변화율과 무관)**
  * 예: 기타 법인, 0.1% 비중 법인 등
  * 안정적이나 모니터링이 필요한 경우

**매우 중요:** 
1. 비중 5% 미만 법인은 금액이나 변화율과 무관하게 반드시 LOW 우선순위
2. 절대적인 일수나 금액 기준은 사용하지 말고, 전년 대비 변화율과 비중만으로 판단
3. 액션플랜은 실질적 영향도가 큰 법인에 집중

주요 분석 포인트:
1. 각 법인별 운전자본 증감률 (YoY)과 연결 대비 비중(%)
2. CCC(현금전환주기)의 전년 동기 대비 변화 추세
3. DSO, DIO 지표의 전년 대비 변화 (홍콩/중국의 경우 DPO 제외)
4. 재고, 매출채권의 급격한 변화 (단위: 억원, 전년 대비 %)
5. 법인별 특이사항 및 리스크 (비중 고려)
6. 과거 자사 데이터 대비 개선/악화 추세

**중요**: 오직 JSON 배열만 반환하고, 다른 텍스트는 포함하지 마세요.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0].message.content?.trim() || '[]';
    
    // JSON 추출 (코드 블록이 있을 경우 제거)
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }
    
    const actionItems = JSON.parse(jsonText);

    // 캐시에 저장
    updateAICachePartial(quarter, 'actionPlan', actionItems);
    console.log(`✅ AI 액션플랜 캐시 저장: ${quarter}`);

    return NextResponse.json({
      success: true,
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
