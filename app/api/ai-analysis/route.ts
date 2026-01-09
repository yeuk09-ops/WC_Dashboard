/**
 * AI 분석 API
 * POST /api/ai-analysis
 * 
 * OpenAI GPT를 사용하여 운전자본 데이터 분석
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { loadAICache, updateAICachePartial } from '@/lib/ai-cache';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
        prompt = generateTurnoverPrompt(data);
        break;
      case 'trend':
        prompt = generateTrendPrompt(data);
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
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 F&F 그룹의 재무 전문가입니다. 운전자본과 회전율 데이터를 분석하여 실질적이고 구체적인 인사이트를 제공합니다. 한국어로 답변하며, 전문적이면서도 이해하기 쉽게 설명합니다.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
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
  return `다음은 F&F 그룹의 운전자본 데이터입니다:

현재 분기 (25.3Q):
- 운전자본: ${data.currentWC}억원
- 매출채권: ${data.currentReceivables}억원
- 재고자산: ${data.currentInventory}억원
- 매입채무: ${data.currentPayables}억원
- CCC: ${data.currentCCC}일

전년 동기 (24.3Q):
- 운전자본: ${data.previousWC}억원
- CCC: ${data.previousCCC}일

YoY 변화:
- 운전자본: ${data.wcChange > 0 ? '+' : ''}${data.wcChange.toFixed(1)}%
- CCC: ${data.cccChange > 0 ? '+' : ''}${data.cccChange}일

법인별 데이터:
${data.entities.map((e: any) => `- ${e.name}: 운전자본 ${e.wc}억원 (YoY ${e.change > 0 ? '+' : ''}${e.change.toFixed(1)}%)`).join('\n')}

위 데이터를 분석하여:
1. 전체적인 운전자본 현황 평가 (3-4줄)
2. 주요 개선점 또는 우려사항 (2-3개, 각 1-2줄)
3. 즉시 주목해야 할 법인 또는 항목 (1-2개)

간결하고 명확하게, 실무에서 바로 사용할 수 있는 인사이트를 제공해주세요.`;
}

// Turnover 분석 프롬프트
function generateTurnoverPrompt(data: any): string {
  return `다음은 ${data.entity} 법인의 회전율 데이터입니다:

현재 (25.3Q):
- DSO: ${data.dso}일
- DIO: ${data.dio}일
- DPO: ${data.dpo}일
- CCC: ${data.ccc}일

전년 동기 (24.3Q):
- DSO: ${data.prevDso}일 (변화: ${data.dsoChange > 0 ? '+' : ''}${data.dsoChange}일)
- DIO: ${data.prevDio}일 (변화: ${data.dioChange > 0 ? '+' : ''}${data.dioChange}일)
- DPO: ${data.prevDpo}일 (변화: ${data.dpoChange > 0 ? '+' : ''}${data.dpoChange}일)
- CCC: ${data.prevCcc}일 (변화: ${data.cccChange > 0 ? '+' : ''}${data.cccChange}일)

업계 목표:
- CCC: 60-70일 이하

위 데이터를 분석하여:
1. ${data.entity}의 회전율 현황 평가 (2-3줄)
2. DSO, DIO, DPO 중 개선이 필요한 지표와 이유 (2-3줄)
3. 구체적인 개선 방안 (2-3개 액션 아이템)

실무에서 바로 실행 가능한 조언을 제공해주세요.`;
}

// Trend 분석 프롬프트
function generateTrendPrompt(data: any): string {
  return `다음은 ${data.entity}의 분기별 추세 데이터입니다:

운전자본 추이 (24.1Q → 25.3Q):
${data.wcTrend.map((t: any) => `- ${t.quarter}: ${t.wc}억원`).join('\n')}

회전율 추이:
${data.turnoverTrend.map((t: any) => `- ${t.quarter}: DSO ${t.dso}일, DIO ${t.dio}일, DPO ${t.dpo}일, CCC ${t.ccc}일`).join('\n')}

주요 변화:
- 운전자본: ${data.wcTrendDirection}
- CCC: ${data.cccTrendDirection}

위 추세를 분석하여:
1. 전반적인 추세 평가 (개선/악화/유지) - 2-3줄
2. 눈에 띄는 변곡점이나 이상치 (있다면) - 2줄
3. 향후 예상되는 추세와 대응 방안 - 2-3줄

계절성, 사업 특성을 고려하여 분석해주세요.`;
}

// Action Plan 분석 프롬프트
function generateActionPrompt(data: any): string {
  return `다음은 F&F 그룹 전체의 운전자본 현황입니다:

법인별 현황 (25.3Q):
${data.entities.map((e: any) => 
  `- ${e.name}: WC ${e.wc}억원, CCC ${e.ccc}일 (전년 대비 ${e.yoy > 0 ? '+' : ''}${e.yoy.toFixed(1)}%)`
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
   - 이슈: [구체적인 문제]
   - 액션: [실행 가능한 조치]
   - 목표: [구체적인 KPI]
   - 담당: [해당 부서/법인]

실무진이 바로 실행할 수 있도록 구체적이고 명확하게 작성해주세요.`;
}
