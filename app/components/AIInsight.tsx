'use client';

import React, { useState } from 'react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

interface AIInsightProps {
  data: any;
  type: 'overview' | 'turnover' | 'trend' | 'action';
  title?: string;
}

export default function AIInsight({ data, type, title = 'AI 인사이트' }: AIInsightProps) {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, type }),
      });

      const result = await response.json();

      if (result.success) {
        setAnalysis(result.analysis);
        setHasAnalyzed(true);
      } else {
        setError(result.error || 'AI 분석에 실패했습니다.');
        setAnalysis(result.analysis || '');
      }
    } catch (err) {
      setError('AI 분석 요청 중 오류가 발생했습니다.');
      console.error('AI Analysis Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-5 border border-purple-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h4 className="font-semibold text-purple-900">{title}</h4>
        </div>
        <button
          onClick={fetchAnalysis}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm rounded-lg transition"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              분석 중...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {hasAnalyzed ? 'AI 재분석' : 'AI 분석'}
            </>
          )}
        </button>
      </div>

      {!hasAnalyzed && !loading && !error && (
        <div className="text-sm text-purple-700 bg-white/50 rounded-lg p-4 text-center">
          <p className="mb-2">🤖 AI가 데이터를 분석하여 인사이트를 제공합니다</p>
          <p className="text-xs text-purple-600">위의 'AI 분석' 버튼을 클릭하세요</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">{error}</p>
              {analysis && <p className="mt-1 text-xs">{analysis}</p>}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white/50 rounded-lg p-4 animate-pulse">
          <div className="space-y-2">
            <div className="h-4 bg-purple-200 rounded w-3/4"></div>
            <div className="h-4 bg-purple-200 rounded w-full"></div>
            <div className="h-4 bg-purple-200 rounded w-5/6"></div>
          </div>
        </div>
      )}

      {analysis && !loading && !error && (
        <div className="bg-white/80 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap">
          {analysis}
        </div>
      )}
    </div>
  );
}
