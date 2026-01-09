/**
 * AI 분석 API
 * POST /api/ai-analysis
 * 
 * OpenAI GPT를 사용하여 운전자본 데이터 분석
 */

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
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 F&F 그룹의 재무 전문가입니다. 운전자본과 회전율 데이터를 분석하여 실질적이고 구체적인 인사이트를 제공합니다.

**중요한 비즈니스 컨텍스트:**
1. 홍콩과 중국 법인은 국내 본사의 지역 판매법인으로, 연결 재무제표 작성 시 연결제거가 이루어집니다.
2. 따라서 홍콩/중국 법인의 매입채무는 거의 0에 가깝고, DPO는 분석적 의미가 없습니다.
3. 홍콩/중국 법인 분석 시 DSO와 DIO에 집중하고, DPO는 언급하지 마세요.

**분석 시 반드시 포함해야 할 사항:**
1. 모든 금액은 단위를 명확히 표시 (억원)
2. 전체 연결 대비 각 법인의 비중(%)을 계산하여 언급
3. 작은 법인(전체의 5% 미만)의 경우, 비중이 작음을 고려하여 우선순위를 낮게 평가
4. 추세 분석 시 계절성과 전년 동기 대비 변화율을 함께 고려
5. 구체적인 수치와 단위를 정확히 언급

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
      max_tokens: 1200,
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
  const entitiesWithRatio = data.entities.map((e: any) => ({
    ...e,
    ratio: totalWC > 0 ? (e.wc / totalWC * 100).toFixed(1) : 0
  }));

  return `다음은 F&F 그룹 연결 운전자본 데이터입니다 (단위: 억원):

현재 분기 (25.3Q):
- 연결 운전자본: ${data.currentWC}억원
- 매출채권: ${data.currentReceivables}억원
- 재고자산: ${data.currentInventory}억원
- 매입채무: ${data.currentPayables}억원
- CCC: ${data.currentCCC}일

전년 동기 (24.3Q):
- 연결 운전자본: ${data.previousWC}억원
- CCC: ${data.previousCCC}일

YoY 변화:
- 운전자본: ${data.wcChange > 0 ? '+' : ''}${data.wcChange.toFixed(1)}%
- CCC: ${data.cccChange > 0 ? '+' : ''}${data.cccChange}일

법인별 데이터 (운전자본, 연결 대비 비중, YoY 변화):
${entitiesWithRatio.map((e: any) => 
  `- ${e.name}: ${e.wc}억원 (연결 대비 ${e.ratio}%, YoY ${e.change > 0 ? '+' : ''}${e.change.toFixed(1)}%)`
).join('\n')}

위 데이터를 분석하여:
1. 전체적인 운전자본 현황 평가 (3-4줄, 금액은 반드시 단위 포함)
2. 주요 개선점 또는 우려사항 (2-3개, 각 1-2줄)
   - 각 법인의 연결 대비 비중을 고려하여 우선순위 판단
   - 비중이 5% 미만인 법인은 전체 영향도가 낮음을 언급
3. 즉시 주목해야 할 법인 또는 항목 (1-2개, 비중과 변화율 모두 고려)

간결하고 명확하게, 실무에서 바로 사용할 수 있는 인사이트를 제공해주세요.`;
}

// Turnover 분석 프롬프트
function generateTurnoverPrompt(data: any): string {
  const isHongKongOrChina = data.entity === '홍콩' || data.entity === '중국';
  
  return `다음은 ${data.entity} 법인의 회전율 데이터입니다:

현재 (25.3Q):
- DSO (매출채권회전일수): ${data.dso}일
- DIO (재고자산회전일수): ${data.dio}일
${!isHongKongOrChina ? `- DPO (매입채무회전일수): ${data.dpo}일` : '- DPO: 연결제거로 인해 분석 무의미'}
- CCC (현금전환주기): ${data.ccc}일

전년 동기 (24.3Q):
- DSO: ${data.prevDso}일 (변화: ${data.dsoChange > 0 ? '+' : ''}${data.dsoChange}일)
- DIO: ${data.prevDio}일 (변화: ${data.dioChange > 0 ? '+' : ''}${data.dioChange}일)
${!isHongKongOrChina ? `- DPO: ${data.prevDpo}일 (변화: ${data.dpoChange > 0 ? '+' : ''}${data.dpoChange}일)` : ''}
- CCC: ${data.prevCcc}일 (변화: ${data.cccChange > 0 ? '+' : ''}${data.cccChange}일)

${isHongKongOrChina ? `
**중요:** ${data.entity}는 국내 본사의 지역 판매법인으로, 연결제거로 인해 매입채무가 거의 0입니다.
따라서 DPO는 분석적 의미가 없으므로, DSO와 DIO에만 집중하여 분석해주세요.
` : ''}

**중요:** 업계 평균이나 목표 수치는 명확한 출처 없이 언급하지 마세요.
비교는 전년 동기 대비, 전 분기 대비, 또는 자사의 과거 데이터와의 비교만 사용하세요.

위 데이터를 분석하여:
1. ${data.entity}의 회전율 현황 평가 (2-3줄, 구체적인 일수와 변화량 명시)
2. ${isHongKongOrChina ? 'DSO, DIO' : 'DSO, DIO, DPO'} 중 개선이 필요한 지표와 이유 (2-3줄)
   - 각 지표의 변화 추세와 절대값 모두 고려
3. 구체적인 개선 방안 (2-3개 액션 아이템, 실행 가능한 수준으로)

실무에서 바로 실행 가능한 조언을 제공해주세요.`;
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

  return `다음은 ${data.entity}의 분기별 추세 데이터입니다 (단위: 억원):

운전자본 추이 (24.1Q → 25.3Q):
${data.wcTrend.map((t: any) => `- ${t.quarter}: ${t.wc}억원`).join('\n')}

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
   - 추세의 가속/감속 여부 파악
2. 눈에 띄는 변곡점이나 이상치 (있다면) - 2줄
   - 특정 분기의 급격한 변화 원인 추정
3. 향후 예상되는 추세와 대응 방안 - 2-3줄
   - 계절성 패턴이 있다면 명시
   - 구체적이고 실행 가능한 개선 방안 제시

모든 금액은 단위(억원)를 명시하고, 계절성과 사업 특성을 고려하여 분석해주세요.`;
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
