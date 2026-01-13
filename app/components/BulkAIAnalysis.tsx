'use client';

import React, { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface BulkAIAnalysisProps {
  wcData: any[];
  turnoverData: any[];
  currentQuarter: string;
  previousQuarter: string;
  entities: string[];
}

interface AnalysisProgress {
  entity: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

export default function BulkAIAnalysis({
  wcData,
  turnoverData,
  currentQuarter,
  previousQuarter,
  entities
}: BulkAIAnalysisProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 환경 변수로 AI 기능 활성화 여부 확인
  const isAIEnabled = process.env.NEXT_PUBLIC_ENABLE_AI === 'true';

  // 보이지 않게 처리
  if (!isAIEnabled) {
    return null;
  }

  const runBulkAnalysis = async () => {
    setIsRunning(true);
    setError(null);
    
    // 개별 법인 먼저 (연결 제외)
    const individualEntities = entities.filter(e => e !== '연결');
    
    // 진행상황 초기화
    const initialProgress: AnalysisProgress[] = [
      ...individualEntities.map(e => ({ entity: e, status: 'pending' as const })),
      { entity: '연결', status: 'pending' as const }
    ];
    setProgress(initialProgress);

    try {
      // 1단계: 개별 법인 분석 (순차 실행 - 데이터 정확성 확보)
      for (const entity of individualEntities) {
        setProgress(prev => prev.map(p => 
          p.entity === entity ? { ...p, status: 'processing', message: '분석 중...' } : p
        ));

        try {
          // 해당 법인 데이터만 필터링
          const entityWCData = wcData.filter(d => d.ENTITY === entity);
          const entityTurnoverData = turnoverData.filter(t => t.entity === entity);
          
          const currentWC = wcData.find(d => d.QUARTER === currentQuarter && d.ENTITY === entity);
          const prevWC = wcData.find(d => d.QUARTER === previousQuarter && d.ENTITY === entity);
          const currentTurnover = turnoverData.find(t => t.quarter === currentQuarter && t.entity === entity);
          const prevTurnover = turnoverData.find(t => t.quarter === previousQuarter && t.entity === entity);

          // 1) 회전율 AI 분석
          await fetch('/api/ai-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: {},  // 필수 파라미터
              type: 'turnover',
              quarter: currentQuarter,
              context: {
                entity,
                currentQuarter,
                prevYearQuarter: previousQuarter,
                current: {
                  dso: currentTurnover?.dso || 0,
                  dio: currentTurnover?.dio || 0,
                  dpo: currentTurnover?.dpo || 0,
                  ccc: currentTurnover?.ccc || 0,
                  revenue: currentWC?.REVENUE_Q || 0,
                  receivables: currentWC?.RECEIVABLES || 0,
                  inventory: currentWC?.INVENTORY || 0,
                },
                prevYear: {
                  dso: prevTurnover?.dso || 0,
                  dio: prevTurnover?.dio || 0,
                  dpo: prevTurnover?.dpo || 0,
                  ccc: prevTurnover?.ccc || 0,
                  revenue: prevWC?.REVENUE_Q || 0,
                  receivables: prevWC?.RECEIVABLES || 0,
                  inventory: prevWC?.INVENTORY || 0,
                },
                changes: {
                  dso: (currentTurnover?.dso || 0) - (prevTurnover?.dso || 0),
                  dio: (currentTurnover?.dio || 0) - (prevTurnover?.dio || 0),
                  dpo: (currentTurnover?.dpo || 0) - (prevTurnover?.dpo || 0),
                  ccc: (currentTurnover?.ccc || 0) - (prevTurnover?.ccc || 0),
                },
                // 추세 데이터
                wcTrend: entityWCData.map(d => ({ quarter: d.QUARTER, wc: d.WC })),
                revenueTrend: entityWCData.map(d => ({ quarter: d.QUARTER, revenue: d.REVENUE_Q })),
                turnoverTrend: entityTurnoverData,
              },
              forceRegenerate: true
            })
          });

          // 2) 액션플랜 분석 (전체 법인 데이터 전달, 해당 법인만 필터링)
          await fetch('/api/ai-action-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quarter: currentQuarter,
              selectedEntity: entity,
              data: {
                wcData: wcData, // 전체 법인 데이터
                turnoverData: turnoverData, // 전체 법인 데이터
                currentQuarter,
                previousQuarter,
                entities: entities, // 전체 법인 리스트
                summary: {
                  totalWC: wcData.find(d => d.QUARTER === currentQuarter && d.ENTITY === '연결')?.WC || 0,
                  avgCCC: turnoverData.find(t => t.quarter === currentQuarter && t.entity === '연결')?.ccc || 0,
                  yoyChanges: entities.slice(0, -1).map(eName => {
                    const current = wcData.find(d => d.QUARTER === currentQuarter && d.ENTITY === eName);
                    const prev = wcData.find(d => d.QUARTER === previousQuarter && d.ENTITY === eName);
                    return {
                      entity: eName,
                      wcChange: ((current?.WC || 0) - (prev?.WC || 0)) / (prev?.WC || 1) * 100,
                      currentWC: current?.WC || 0,
                      prevWC: prev?.WC || 0,
                      currentRevenue: current?.REVENUE_Q || 0,
                      prevRevenue: prev?.REVENUE_Q || 0,
                      currentInventory: current?.INVENTORY || 0,
                      prevInventory: prev?.INVENTORY || 0,
                      currentReceivables: current?.RECEIVABLES || 0,
                      prevReceivables: prev?.RECEIVABLES || 0,
                      currentPayables: current?.PAYABLES || 0,
                      prevPayables: prev?.PAYABLES || 0,
                    };
                  }),
                  turnoverMetrics: entities.slice(0, -1).map(eName => {
                    const current = turnoverData.find(t => t.quarter === currentQuarter && t.entity === eName);
                    const prev = turnoverData.find(t => t.quarter === previousQuarter && t.entity === eName);
                    return {
                      entity: eName,
                      currentCCC: current?.ccc || 0,
                      prevCCC: prev?.ccc || 0,
                      dso: current?.dso || 0,
                      dio: current?.dio || 0,
                      dpo: current?.dpo || 0,
                      prevDSO: prev?.dso || 0,
                      prevDIO: prev?.dio || 0,
                      prevDPO: prev?.dpo || 0,
                    };
                  }),
                }
              },
              forceRegenerate: true
            })
          });

          setProgress(prev => prev.map(p => 
            p.entity === entity ? { ...p, status: 'completed', message: '완료' } : p
          ));
        } catch (err) {
          console.error(`${entity} 분석 오류:`, err);
          setProgress(prev => prev.map(p => 
            p.entity === entity ? { ...p, status: 'error', message: '오류 발생' } : p
          ));
          // 오류 발생해도 다음 법인 계속 진행
        }
      }

      // 2단계: 연결 분석 (모든 법인 데이터 포함)
      setProgress(prev => prev.map(p => 
        p.entity === '연결' ? { ...p, status: 'processing', message: '종합 분석 중...' } : p
      ));

      try {
        const consolidatedWC = wcData.find(d => d.QUARTER === currentQuarter && d.ENTITY === '연결');
        const prevConsolidatedWC = wcData.find(d => d.QUARTER === previousQuarter && d.ENTITY === '연결');
        const consolidatedTurnover = turnoverData.find(t => t.quarter === currentQuarter && t.entity === '연결');
        const prevConsolidatedTurnover = turnoverData.find(t => t.quarter === previousQuarter && t.entity === '연결');

        // 1) 연결 회전율 AI 분석
        await fetch('/api/ai-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {},  // 필수 파라미터
            type: 'turnover',
            quarter: currentQuarter,
            context: {
              entity: '연결',
              currentQuarter,
              prevYearQuarter: previousQuarter,
              current: {
                dso: consolidatedTurnover?.dso || 0,
                dio: consolidatedTurnover?.dio || 0,
                dpo: consolidatedTurnover?.dpo || 0,
                ccc: consolidatedTurnover?.ccc || 0,
                revenue: consolidatedWC?.REVENUE_Q || 0,
                receivables: consolidatedWC?.RECEIVABLES || 0,
                inventory: consolidatedWC?.INVENTORY || 0,
              },
              prevYear: {
                dso: prevConsolidatedTurnover?.dso || 0,
                dio: prevConsolidatedTurnover?.dio || 0,
                dpo: prevConsolidatedTurnover?.dpo || 0,
                ccc: prevConsolidatedTurnover?.ccc || 0,
                revenue: prevConsolidatedWC?.REVENUE_Q || 0,
                receivables: prevConsolidatedWC?.RECEIVABLES || 0,
                inventory: prevConsolidatedWC?.INVENTORY || 0,
              },
              changes: {
                dso: (consolidatedTurnover?.dso || 0) - (prevConsolidatedTurnover?.dso || 0),
                dio: (consolidatedTurnover?.dio || 0) - (prevConsolidatedTurnover?.dio || 0),
                dpo: (consolidatedTurnover?.dpo || 0) - (prevConsolidatedTurnover?.dpo || 0),
                ccc: (consolidatedTurnover?.ccc || 0) - (prevConsolidatedTurnover?.ccc || 0),
              },
              // 추세 데이터
              wcTrend: wcData.filter(d => d.ENTITY === '연결').map(d => ({ quarter: d.QUARTER, wc: d.WC })),
              revenueTrend: wcData.filter(d => d.ENTITY === '연결').map(d => ({ quarter: d.QUARTER, revenue: d.REVENUE_Q })),
              turnoverTrend: turnoverData.filter(t => t.entity === '연결'),
            },
            forceRegenerate: true
          })
        });

        // 2) 연결 액션플랜 분석 (모든 법인의 데이터 포함)
        await fetch('/api/ai-action-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quarter: currentQuarter,
            selectedEntity: '연결',
            data: {
              wcData,
              turnoverData,
              currentQuarter,
              previousQuarter,
              entities,
              summary: {
                totalWC: wcData.find(d => d.QUARTER === currentQuarter && d.ENTITY === '연결')?.WC || 0,
                avgCCC: turnoverData.find(t => t.quarter === currentQuarter && t.entity === '연결')?.ccc || 0,
                yoyChanges: individualEntities.map(entity => {
                  const current = wcData.find(d => d.QUARTER === currentQuarter && d.ENTITY === entity);
                  const prev = wcData.find(d => d.QUARTER === previousQuarter && d.ENTITY === entity);
                  return {
                    entity,
                    wcChange: ((current?.WC || 0) - (prev?.WC || 0)) / (prev?.WC || 1) * 100,
                    currentWC: current?.WC || 0,
                    prevWC: prev?.WC || 0,
                    currentRevenue: current?.REVENUE_Q || 0,
                    prevRevenue: prev?.REVENUE_Q || 0,
                    currentInventory: current?.INVENTORY || 0,
                    prevInventory: prev?.INVENTORY || 0,
                    currentReceivables: current?.RECEIVABLES || 0,
                    prevReceivables: prev?.RECEIVABLES || 0,
                    currentPayables: current?.PAYABLES || 0,
                    prevPayables: prev?.PAYABLES || 0,
                  };
                }),
                turnoverMetrics: individualEntities.map(entity => {
                  const current = turnoverData.find(t => t.quarter === currentQuarter && t.entity === entity);
                  const prev = turnoverData.find(t => t.quarter === previousQuarter && t.entity === entity);
                  return {
                    entity,
                    currentCCC: current?.ccc || 0,
                    prevCCC: prev?.ccc || 0,
                    dso: current?.dso || 0,
                    dio: current?.dio || 0,
                    dpo: current?.dpo || 0,
                    prevDSO: prev?.dso || 0,
                    prevDIO: prev?.dio || 0,
                    prevDPO: prev?.dpo || 0,
                  };
                }),
              }
            },
            forceRegenerate: true
          })
        });

        setProgress(prev => prev.map(p => 
          p.entity === '연결' ? { ...p, status: 'completed', message: '완료' } : p
        ));

        alert('✅ 전체 AI 분석이 완료되었습니다! 각 탭에서 확인하세요.');
      } catch (err) {
        console.error('연결 분석 오류:', err);
        setProgress(prev => prev.map(p => 
          p.entity === '연결' ? { ...p, status: 'error', message: '오류 발생' } : p
        ));
        setError('연결 분석 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('일괄 분석 오류:', err);
      setError('AI 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            🤖 종합 AI 분석
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            모든 법인의 AI 분석을 일괄 실행합니다 (개발 환경 전용)
          </p>
        </div>
        <button
          onClick={runBulkAnalysis}
          disabled={isRunning}
          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition
            ${isRunning 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              분석 중...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              AI 분석 실행
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded text-sm mb-3">
          {error}
        </div>
      )}

      {progress.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-700 mb-2">
            진행률: {progress.filter(p => p.status === 'completed').length} / {progress.length}
          </div>
          {progress.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <div className="w-16 text-slate-700 font-medium">{item.entity}</div>
              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    item.status === 'completed' ? 'bg-green-500' :
                    item.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                    item.status === 'error' ? 'bg-red-500' :
                    'bg-gray-300'
                  }`}
                  style={{ width: item.status === 'completed' ? '100%' : item.status === 'processing' ? '50%' : '0%' }}
                />
              </div>
              <div className="w-16 text-right">
                {item.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-green-600 inline" />}
                {item.status === 'processing' && <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin inline" />}
                {item.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-600 inline" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
