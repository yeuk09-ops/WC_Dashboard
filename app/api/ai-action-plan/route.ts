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

**중요한 비즈니스 컨텍스트:**
1. 홍콩과 중국 법인은 국내 본사의 지역 판매법인으로, 연결제거로 인해 매입채무가 거의 0입니다.
2. 따라서 홍콩/중국 법인의 DPO는 분석적 의미가 없으므로 액션플랜에 포함하지 마세요.
3. 작은 법인(연결 대비 5% 미만)의 경우, 절대 금액이 작더라도 비중을 고려하여 우선순위를 낮게 설정하세요.
4. 모든 금액은 단위(억원)를 명확히 표시해야 합니다.

데이터: ${JSON.stringify(data)}

다음 형식의 JSON 배열을 반환해주세요 (5-7개 항목):
[
  {
    "priority": "HIGH" | "MEDIUM" | "LOW",
    "label": "카테고리 (예: 재고, 채권, 운전자본 등)",
    "issue": "구체적인 이슈 설명 (반드시 금액 단위 '억원' 포함, 연결 대비 비중% 언급)",
    "action": "실행 가능한 구체적인 액션",
    "target": "목표 수치 또는 KPI (단위 명시)",
    "responsible": "담당 부서/법인"
  }
]

우선순위 판단 기준 (비중과 변화율을 모두 고려):
- HIGH: 
  * 연결 대비 20% 이상 비중을 차지하는 법인의 전년 대비 20% 이상 악화
  * CCC 100일 초과하는 주요 법인
  * 즉각적인 현금흐름 리스크가 있는 경우
- MEDIUM: 
  * 연결 대비 10-20% 비중 법인의 전년 대비 15% 이상 악화
  * 분기 내 개선이 필요한 경우
- LOW: 
  * 연결 대비 5% 미만 비중의 법인 (변화율이 크더라도)
  * 안정적이나 모니터링이 필요한 경우

주요 분석 포인트:
1. 각 법인별 운전자본 증감률 (YoY)과 연결 대비 비중(%)
2. CCC(현금전환주기) 변화 및 목표(60-70일) 대비 괴리
3. DSO, DIO 지표의 이상치 (홍콩/중국의 경우 DPO 제외)
4. 재고, 매출채권의 급격한 변화 (단위: 억원)
5. 법인별 특이사항 및 리스크 (비중 고려)

**중요**: 오직 JSON 배열만 반환하고, 다른 텍스트는 포함하지 마세요.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1500,
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
