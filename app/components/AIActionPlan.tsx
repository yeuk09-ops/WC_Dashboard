'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Bot } from 'lucide-react';

interface ActionItem {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  label: string;
  issue: string;
  action: string;
  target: string;
  responsible: string;
}

interface AIActionPlanProps {
  data: any;
  quarter: string;
  selectedEntity: string;
}

export default function AIActionPlan({ data, quarter, selectedEntity }: AIActionPlanProps) {
  const [improvementDirection, setImprovementDirection] = useState<string>('');
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 환경 변수로 AI 기능 활성화 여부 확인
  const isAIEnabled = process.env.NEXT_PUBLIC_ENABLE_AI === 'true';

  // 컴포넌트 마운트 시 캐시된 액션플랜 로드
  useEffect(() => {
    const loadCachedActionPlan = async () => {
      try {
        const res = await fetch('/api/ai-action-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data, quarter, selectedEntity, forceRegenerate: false }),
        });
        const json = await res.json();
        if (json.success) {
          if (json.improvementDirection) {
            setImprovementDirection(json.improvementDirection);
          }
          if (json.actionItems && Array.isArray(json.actionItems)) {
            setActionItems(json.actionItems);
            console.log(`✅ 액션플랜 로드 성공: ${json.actionItems.length}개 항목`);
          }
        }
      } catch (err) {
        console.error('캐시된 액션플랜 로드 실패:', err);
      }
    };

    if (quarter && selectedEntity) {
      loadCachedActionPlan();
    }
  }, [quarter, selectedEntity, data]);

  const fetchActionPlan = async () => {
    if (!isAIEnabled) {
      setError('AI 액션플랜 기능은 개발환경에서만 사용 가능합니다.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-action-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, quarter, selectedEntity, forceRegenerate: true }),
      });
      const json = await res.json();
      if (json.success) {
        setImprovementDirection(json.improvementDirection || '');
        setActionItems(json.actionItems || []);
      } else {
        setError(json.error || 'AI 액션플랜 생성에 실패했습니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* AI 생성 버튼 섹션 */}
      <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Bot className="w-5 h-5 text-sky-500" /> AI 개선방향 및 액션플랜
            {!isAIEnabled && (improvementDirection || actionItems.length > 0) && (
              <span className="text-xs text-sky-600 bg-sky-100 px-2 py-1 rounded">
                정적 분석
              </span>
            )}
          </h3>
          {isAIEnabled && (
            <button
              onClick={fetchActionPlan}
              className="flex items-center px-3 py-1.5 bg-sky-500 text-white rounded-md text-sm font-medium hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Bot className="w-4 h-4 mr-2" />
              )}
              AI 분석 생성
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md mb-4">
            <p className="text-sm">오류: {error}</p>
          </div>
        )}

        {!improvementDirection && !actionItems.length && !loading && !error && (
          <div className="p-6 bg-slate-50 rounded-md text-center text-slate-600">
            <Bot className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="text-sm">AI 분석 생성 버튼을 눌러<br />데이터 기반 개선방향과 액션플랜을 확인하세요.</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-40 bg-slate-50 rounded-md">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
            <span className="ml-3 text-slate-600">AI가 개선방향 및 액션플랜을 생성하고 있습니다...</span>
          </div>
        )}

        {/* 개선방향 섹션 */}
        {!loading && improvementDirection && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 bg-blue-500 rounded"></div>
              <h4 className="font-semibold text-slate-800">📊 개선방향 도출</h4>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {improvementDirection}
              </div>
            </div>
          </div>
        )}

        {/* 액션플랜 리스트 */}
        {!loading && actionItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 bg-green-500 rounded"></div>
              <h4 className="font-semibold text-slate-800">✅ 우선순위별 액션플랜</h4>
            </div>
            <div className="space-y-3">
              {actionItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-l-4 ${
                    item.priority === 'HIGH'
                      ? 'bg-red-50 border-red-500'
                      : item.priority === 'MEDIUM'
                      ? 'bg-amber-50 border-amber-500'
                      : 'bg-green-50 border-green-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold rounded ${
                          item.priority === 'HIGH'
                            ? 'bg-red-500 text-white'
                            : item.priority === 'MEDIUM'
                            ? 'bg-amber-500 text-white'
                            : 'bg-green-500 text-white'
                        }`}
                      >
                        {item.priority}
                      </span>
                      <span className="text-xs font-medium text-slate-600">{item.label}</span>
                    </div>
                    <span className="text-xs text-slate-500">{item.target}</span>
                  </div>
                  <div className="font-medium text-slate-800 mb-1">{item.issue}</div>
                  <div className="text-sm text-slate-600 mb-1">{item.action}</div>
                  <div className="text-xs text-slate-500">{item.responsible}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
