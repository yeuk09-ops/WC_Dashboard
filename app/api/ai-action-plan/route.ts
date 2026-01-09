import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { loadAICache, updateAICachePartial } from '@/lib/ai-cache';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    if (!openai.apiKey) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API Key가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    console.log(`🤖 AI 액션플랜 생성 중: ${quarter}`);

    const prompt = `당신은 F&F 그룹의 재무 분석 전문가입니다. 다음 운전자본 데이터를 분석하여 우선순위별 액션플랜을 JSON 형식으로 생성해주세요.

데이터: ${JSON.stringify(data)}

다음 형식의 JSON 배열을 반환해주세요 (5-7개 항목):
[
  {
    "priority": "HIGH" | "MEDIUM" | "LOW",
    "label": "카테고리 (예: 재고, 채권, 채무, 운전자본 등)",
    "issue": "구체적인 이슈 설명 (수치 포함)",
    "action": "실행 가능한 구체적인 액션",
    "target": "목표 수치 또는 KPI",
    "responsible": "담당 부서/법인"
  }
]

우선순위 판단 기준:
- HIGH: 전년 대비 20% 이상 악화, CCC 100일 초과, 즉각적인 현금흐름 리스크
- MEDIUM: 전년 대비 10-20% 악화, 분기 내 개선 필요
- LOW: 안정적이나 모니터링 필요

주요 분석 포인트:
1. 각 법인별 운전자본 증감률 (YoY)
2. CCC(현금전환주기) 변화 및 목표 대비 괴리
3. DSO, DIO, DPO 각 지표의 이상치
4. 재고, 매출채권, 매입채무의 급격한 변화
5. 법인별 특이사항 및 리스크

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
