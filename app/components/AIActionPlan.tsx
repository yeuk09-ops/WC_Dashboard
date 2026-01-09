'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Bot, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

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
}

export default function AIActionPlan({ data, quarter }: AIActionPlanProps) {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActionPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-action-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, quarter }),
      });
      const json = await res.json();
      if (json.success) {
        setActionItems(json.actionItems);
      } else {
        setError(json.error || 'AI 액션플랜 생성에 실패했습니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const highCount = actionItems.filter(item => item.priority === 'HIGH').length;
  const mediumCount = actionItems.filter(item => item.priority === 'MEDIUM').length;
  const lowCount = actionItems.filter(item => item.priority === 'LOW').length;

  return (
    <>
      {/* 우선순위별 카운트 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-red-600 text-sm font-medium">⚠ HIGH</div>
              <div className="text-3xl font-bold text-red-700 mt-1">{highCount}</div>
              <div className="text-xs text-red-600 mt-1">즉시 조치</div>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-amber-600 text-sm font-medium">⚠ MEDIUM</div>
              <div className="text-3xl font-bold text-amber-700 mt-1">{mediumCount}</div>
              <div className="text-xs text-amber-600 mt-1">분기 내</div>
            </div>
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
        </div>
        <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-green-600 text-sm font-medium">✓ LOW</div>
              <div className="text-3xl font-bold text-green-700 mt-1">{lowCount}</div>
              <div className="text-xs text-green-600 mt-1">모니터링</div>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* 액션플랜 목록 */}
      <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Bot className="w-5 h-5 text-sky-500" /> AI 생성 액션플랜
          </h3>
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
            액션플랜 생성
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md mb-4">
            <p className="text-sm">오류: {error}</p>
          </div>
        )}

        {!actionItems.length && !loading && !error && (
          <div className="p-6 bg-slate-50 rounded-md text-center text-slate-600">
            <Bot className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="text-sm">AI 액션플랜 생성 버튼을 눌러<br />데이터 기반 우선순위별 액션플랜을 확인하세요.</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-40 bg-slate-50 rounded-md">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
            <span className="ml-3 text-slate-600">AI가 액션플랜을 생성하고 있습니다...</span>
          </div>
        )}

        {actionItems.length > 0 && (
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
        )}
      </div>
    </>
  );
}
