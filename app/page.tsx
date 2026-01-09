'use client';

import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, RadarChart, Radar, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, ComposedChart
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Package, FileText, RefreshCw, AlertTriangle, CheckCircle, AlertCircle, Activity } from 'lucide-react';
import AIInsight from './components/AIInsight';
import AIActionPlan from './components/AIActionPlan';
import type { WCDataItem, TurnoverItem } from '@/types';

// 색상 정의
const colors = { 
  inventory: '#f59e0b',
  receivables: '#22c55e', 
  payables: '#ef4444', 
  wc: '#3b82f6',
  revenue: '#8b5cf6'
};

const entityColors: Record<string, string> = {
  '국내(OC)': '#0ea5e9',
  '중국': '#ef4444',
  '홍콩': '#f59e0b',
  'ST(미국)': '#10b981',
  '기타': '#8b5cf6',
  '연결': '#1e293b'
};

const pieColors = ['#0ea5e9', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6'];

const toOk = (val: number) => Math.round(val / 10) / 10;
const formatNum = (n: number) => n.toLocaleString('ko-KR');
const formatOk = (n: number) => `${formatNum(toOk(n))}억`;

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const [wcData, setWcData] = useState<WCDataItem[]>([]);
  const [turnoverData, setTurnoverData] = useState<TurnoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState('연결');
  const [showConsolidated, setShowConsolidated] = useState(true);
  const [showItems, setShowItems] = useState({ all: true, inv: true, ar: true, ap: true, wc: true });

  const tabs = ['📊 Overview', '📈 회전율', '📊 추세', '🎯 액션플랜'];
  const entities = ['국내(OC)', '중국', '홍콩', 'ST(미국)', '기타', '연결'];
  const quarters = ['24.1Q', '24.2Q', '24.3Q', '24.4Q', '25.1Q', '25.2Q', '25.3Q'];

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // 병렬 요청으로 속도 개선
        const [wcRes, turnRes] = await Promise.all([
          fetch('/api/wc-data', {
            headers: { 'Cache-Control': 'max-age=60' } // 브라우저 캐시 1분
          }),
          fetch('/api/turnover', {
            headers: { 'Cache-Control': 'max-age=60' }
          })
        ]);
        
        const [wcJson, turnJson] = await Promise.all([wcRes.json(), turnRes.json()]);
        
        if (wcJson.success && turnJson.success) {
          setWcData(wcJson.data);
          setTurnoverData(turnJson.data);
        } else throw new Error('데이터 로드 실패');
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally { 
        setLoading(false); 
      }
    }
    fetchData();
  }, []);

  const latestConsolidated = wcData.find(d => d.QUARTER === '25.3Q' && d.ENTITY === '연결');
  const prevConsolidated = wcData.find(d => d.QUARTER === '24.3Q' && d.ENTITY === '연결');
  const yoyChange = (c: number, p: number) => p ? ((c - p) / p * 100) : 0;

  const consolidatedTrend = wcData.filter(d => d.ENTITY === '연결').map(d => ({
    quarter: d.QUARTER,
    재고자산: toOk(d.INVENTORY),
    매출채권: toOk(d.RECEIVABLES),
    매입채무: toOk(d.PAYABLES),
    운전자본: toOk(d.WC)
  }));

  const entityData253Q = wcData.filter(d => d.QUARTER === '25.3Q' && d.ENTITY !== '연결');
  const pieData = entityData253Q.map((d, i) => ({
    name: d.ENTITY,
    value: toOk(d.WC),
    percentage: 0
  }));
  const total = pieData.reduce((sum, item) => sum + item.value, 0);
  pieData.forEach(item => {
    item.percentage = (item.value / total) * 100;
  });

  const cccTrendData = quarters.map(q => {
    const row: Record<string, any> = { quarter: q };
    entities.forEach(e => {
      const item = turnoverData.find(t => t.quarter === q && t.entity === e);
      if (item) row[e] = item.ccc;
    });
    return row;
  });

  const selectedTurnover = turnoverData.find(t => t.quarter === '25.3Q' && t.entity === selectedEntity);
  const consolidatedTurnover = turnoverData.find(t => t.quarter === '25.3Q' && t.entity === '연결');

  // 레이더 차트 데이터
  const radarData = selectedTurnover ? [
    { metric: 'DSO', value: selectedTurnover.dso, fullMark: 100 },
    { metric: 'DIO', value: selectedTurnover.dio, fullMark: 150 },
    { metric: 'DPO', value: selectedTurnover.dpo, fullMark: 100 },
    { metric: 'CCC', value: selectedTurnover.ccc, fullMark: 150 },
  ] : [];

  // YoY 비교 테이블 데이터
  const yoyTableData = entities.map(entity => {
    const current = wcData.find(d => d.QUARTER === '25.3Q' && d.ENTITY === entity);
    const previous = wcData.find(d => d.QUARTER === '24.3Q' && d.ENTITY === entity);
    const currentTurn = turnoverData.find(t => t.quarter === '25.3Q' && t.entity === entity);
    const prevTurn = turnoverData.find(t => t.quarter === '24.3Q' && t.entity === entity);
    
    return {
      entity,
      revenue: current?.REVENUE_Q || 0,
      revenueYoY: yoyChange(current?.REVENUE_Q || 0, previous?.REVENUE_Q || 0),
      wc: current?.WC || 0,
      wcYoY: yoyChange(current?.WC || 0, previous?.WC || 0),
      receivables: current?.RECEIVABLES || 0,
      inventory: current?.INVENTORY || 0,
      payables: current?.PAYABLES || 0,
      dso: currentTurn?.dso || 0,
      dsoChange: (currentTurn?.dso || 0) - (prevTurn?.dso || 0),
      dio: currentTurn?.dio || 0,
      dioChange: (currentTurn?.dio || 0) - (prevTurn?.dio || 0),
      dpo: currentTurn?.dpo || 0,
      dpoChange: (currentTurn?.dpo || 0) - (prevTurn?.dpo || 0),
      ccc: currentTurn?.ccc || 0,
      cccChange: (currentTurn?.ccc || 0) - (prevTurn?.ccc || 0),
    };
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <RefreshCw className="w-12 h-12 animate-spin text-blue-500" />
      <div className="text-center">
        <p className="text-lg font-medium text-slate-700">데이터 로딩 중...</p>
        <p className="text-sm text-slate-500 mt-1">잠시만 기다려주세요</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p className="text-red-600 font-medium">오류: {error}</p>
      <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
        새로고침
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 탭 네비게이션 */}
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-6 py-3 font-medium transition-all ${
              activeTab === i
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview 탭 */}
      {activeTab === 0 && (
        <div className="space-y-6">
          {/* KPI 카드 - 6개 */}
          <div className="grid grid-cols-6 gap-4">
            {[
              {
                label: '운전자본',
                desc: '재고+채권-채무',
                value: latestConsolidated?.WC || 0,
                prev: prevConsolidated?.WC || 0,
                unit: '억',
                color: 'purple',
                icon: DollarSign,
                positive: false
              },
              {
                label: '매출채권',
                desc: 'DSO 29일',
                value: latestConsolidated?.RECEIVABLES || 0,
                prev: prevConsolidated?.RECEIVABLES || 0,
                unit: '억',
                color: 'blue',
                icon: FileText,
                positive: false
              },
              {
                label: '재고자산',
                desc: 'DIO 80일',
                value: latestConsolidated?.INVENTORY || 0,
                prev: prevConsolidated?.INVENTORY || 0,
                unit: '억',
                color: 'amber',
                icon: Package,
                positive: false
              },
              {
                label: '매입채무',
                desc: 'DPO 30일',
                value: latestConsolidated?.PAYABLES || 0,
                prev: prevConsolidated?.PAYABLES || 0,
                unit: '억',
                color: 'green',
                icon: FileText,
                positive: true
              },
              {
                label: '분기매출',
                desc: '',
                value: latestConsolidated?.REVENUE_Q || 0,
                prev: prevConsolidated?.REVENUE_Q || 0,
                unit: '억',
                color: 'sky',
                icon: TrendingUp,
                positive: true
              },
              {
                label: 'CCC',
                desc: 'DSO+DIO-DPO',
                value: latestConsolidated?.ccc || 0,
                prev: prevConsolidated?.ccc || 0,
                unit: '일',
                color: 'violet',
                icon: Activity,
                positive: false
              },
            ].map((item, idx) => {
              const change = item.unit === '일' 
                ? (item.value - item.prev)
                : yoyChange(item.value, item.prev);
              const isPositive = item.positive ? change > 0 : change < 0;
              
              return (
                <div key={idx} className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                      <div className="text-2xl font-bold text-slate-800">
                        {item.unit === '억' ? formatOk(item.value) : `${item.value}${item.unit}`}
                      </div>
                    </div>
                    <item.icon className={`w-5 h-5 text-${item.color}-500`} />
                  </div>
                  <div className="text-xs text-slate-400 mb-1">{item.desc}</div>
                  <div className={`flex items-center text-sm font-medium ${
                    isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isPositive ? <TrendingDown className="w-3 h-3 mr-1" /> : <TrendingUp className="w-3 h-3 mr-1" />}
                    {item.unit === '일' ? `${change > 0 ? '+' : ''}${change}` : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`} YoY
                  </div>
                </div>
              );
            })}
          </div>

          {/* 차트 영역 */}
          <div className="grid grid-cols-3 gap-6">
            {/* 연결 운전자본 추이 */}
            <div className="col-span-2 bg-white rounded-lg p-5 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">연결 운전자본 추이</h3>
                <div className="flex gap-2">
                  {[
                    { key: 'all', label: '전체', color: '#94a3b8' },
                    { key: 'ar', label: '채고', color: colors.inventory },
                    { key: 'inv', label: '채권', color: colors.receivables },
                    { key: 'ap', label: '채무', color: colors.payables },
                    { key: 'wc', label: 'WC', color: colors.wc }
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => {
                        if (item.key === 'all') {
                          const allOn = Object.values(showItems).every(v => v);
                          setShowItems({ all: !allOn, inv: !allOn, ar: !allOn, ap: !allOn, wc: !allOn });
                        } else {
                          setShowItems(s => ({ ...s, [item.key]: !s[item.key as keyof typeof s] }));
                        }
                      }}
                      className="px-3 py-1 text-xs font-medium rounded transition"
                      style={{
                        backgroundColor: showItems[item.key as keyof typeof showItems] ? item.color : '#e2e8f0',
                        color: showItems[item.key as keyof typeof showItems] ? 'white' : '#64748b'
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={consolidatedTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v}억`, '']} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {showItems.ar && <Bar dataKey="재고자산" fill={colors.inventory} />}
                  {showItems.inv && <Bar dataKey="매출채권" fill={colors.receivables} />}
                  {showItems.ap && <Bar dataKey="매입채무" fill={colors.payables} />}
                  {showItems.wc && (
                    <Line type="monotone" dataKey="운전자본" stroke={colors.wc} strokeWidth={3} dot={{ r: 4, fill: colors.wc }} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* 법인별 구성비 + 인사이트 */}
            <div className="space-y-6">
              {/* 파이 차트 */}
              <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4">법인별 구성비 (25.3Q)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                      labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={pieColors[index]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v}억`, '']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1">
                  {pieData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: pieColors[idx] }} />
                        <span className="text-slate-600">{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value.toFixed(1)}억 ({item.percentage.toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 핵심 인사이트 */}
              <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-500" />
                  핵심 인사이트
                </h3>
                <div className="space-y-2">
                  <div className="p-2 bg-amber-50 border-l-2 border-amber-400 rounded text-xs">
                    <div className="flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-amber-800">중국 운전자본 +38.7%</div>
                        <div className="text-amber-700">매출증가 대비 자본효율 저하</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 bg-red-50 border-l-2 border-red-400 rounded text-xs">
                    <div className="flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-red-800">ST(미국) +120%</div>
                        <div className="text-red-700">확장 투자로 CCC 128일</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 bg-green-50 border-l-2 border-green-400 rounded text-xs">
                    <div className="flex items-start gap-1">
                      <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-green-800">국내 -18.5%</div>
                        <div className="text-green-700">매입채무 활용 개선</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 bg-blue-50 border-l-2 border-blue-400 rounded text-xs">
                    <div className="flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-blue-800">연결 CCC 95일</div>
                        <div className="text-blue-700">전년 72일 대비 악화</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI 인사이트 */}
          <AIInsight
            type="overview"
            title="🤖 AI 전체 분석"
            data={{
              currentWC: toOk(latestConsolidated?.WC || 0),
              currentReceivables: toOk(latestConsolidated?.RECEIVABLES || 0),
              currentInventory: toOk(latestConsolidated?.INVENTORY || 0),
              currentPayables: toOk(latestConsolidated?.PAYABLES || 0),
              currentCCC: latestConsolidated?.ccc || 0,
              previousWC: toOk(prevConsolidated?.WC || 0),
              previousCCC: prevConsolidated?.ccc || 0,
              wcChange: yoyChange(latestConsolidated?.WC || 0, prevConsolidated?.WC || 0),
              cccChange: (latestConsolidated?.ccc || 0) - (prevConsolidated?.ccc || 0),
              entities: entities.slice(0, -1).map(entityName => {
                const current = wcData.find(d => d.QUARTER === '25.3Q' && d.ENTITY === entityName);
                const prev = wcData.find(d => d.QUARTER === '24.3Q' && d.ENTITY === entityName);
                return {
                  name: entityName,
                  wc: toOk(current?.WC || 0),
                  change: yoyChange(current?.WC || 0, prev?.WC || 0)
                };
              })
            }}
          />

          {/* YoY 비교 테이블 */}
          <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-4">25.3Q vs 24.3Q YoY 비교</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">법인</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">매출</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">YoY</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">운전자본</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">YoY</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">매출채권</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">재고자산</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">매입채무</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">DSO</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">DIO</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">DPO</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">CCC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {yoyTableData.map((row, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50 ${row.entity === '연결' ? 'bg-slate-50 font-medium' : ''}`}>
                      <td className="px-3 py-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entityColors[row.entity] }} />
                        {row.entity}
                      </td>
                      <td className="px-3 py-2 text-right">{toOk(row.revenue).toFixed(1)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${row.revenueYoY >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {row.revenueYoY > 0 ? '+' : ''}{row.revenueYoY.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-right">{toOk(row.wc).toFixed(1)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${row.wcYoY >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {row.wcYoY > 0 ? '+' : ''}{row.wcYoY.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-right">{toOk(row.receivables).toFixed(1)}</td>
                      <td className="px-3 py-2 text-right">{toOk(row.inventory).toFixed(1)}</td>
                      <td className="px-3 py-2 text-right">{toOk(row.payables).toFixed(1)}</td>
                      <td className="px-3 py-2 text-right">
                        {row.dso} 
                        <span className={`ml-1 text-xs ${row.dsoChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          ({row.dsoChange > 0 ? '+' : ''}{row.dsoChange})
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.dio}
                        <span className={`ml-1 text-xs ${row.dioChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          ({row.dioChange > 0 ? '+' : ''}{row.dioChange})
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.dpo}
                        <span className={`ml-1 text-xs ${row.dpoChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          ({row.dpoChange > 0 ? '+' : ''}{row.dpoChange})
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.ccc}
                        <span className={`ml-1 text-xs ${row.cccChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          ({row.cccChange > 0 ? '+' : ''}{row.cccChange})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 회전율 탭 */}
      {activeTab === 1 && (
        <div className="space-y-6">
          {/* 법인 선택 버튼 */}
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm text-slate-600 mr-2">법인 선택:</span>
            {entities.map(e => (
              <button
                key={e}
                onClick={() => setSelectedEntity(e)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedEntity === e
                    ? 'ring-2 ring-offset-2 scale-105 shadow-md'
                    : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: entityColors[e],
                  color: 'white'
                }}
              >
                {e}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200">
              <span className="text-sm text-slate-600">연결 비교:</span>
              <button
                onClick={() => setShowConsolidated(!showConsolidated)}
                className={`px-3 py-1 text-sm font-medium rounded transition ${
                  showConsolidated ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {showConsolidated ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* DSO/DIO/DPO/CCC 카드 */}
          <div className="grid grid-cols-4 gap-4">
            {selectedTurnover && [
              { label: 'DSO', value: selectedTurnover.dso, desc: '매출채권회전일수' },
              { label: 'DIO', value: selectedTurnover.dio, desc: '재고회전일수' },
              { label: 'DPO', value: selectedTurnover.dpo, desc: '매입채무회전일수' },
              { label: 'CCC', value: selectedTurnover.ccc, desc: '현금전환주기' }
            ].map(item => {
              const prevTurn = turnoverData.find(t => t.quarter === '24.3Q' && t.entity === selectedEntity);
              const change = item.value - (prevTurn?.[item.label.toLowerCase() as keyof TurnoverItem] as number || 0);
              
              return (
                <div key={item.label} className="bg-white rounded-lg p-5 shadow-sm border-2" style={{ borderColor: entityColors[selectedEntity] }}>
                  <div className="text-sm text-slate-500 mb-1">{item.desc}</div>
                  <div className="text-xs text-slate-400 mb-2">{item.label}</div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-bold" style={{ color: entityColors[selectedEntity] }}>
                      {item.value}
                    </div>
                    <div className="text-base text-slate-500">일</div>
                  </div>
                  <div className={`text-sm mt-2 font-medium ${
                    item.label === 'DPO'
                      ? (change > 0 ? 'text-green-600' : 'text-red-600')
                      : (change > 0 ? 'text-red-600' : 'text-green-600')
                  }`}>
                    YoY {change > 0 ? '+' : ''}{change}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 차트 영역 */}
          <div className="grid grid-cols-2 gap-6">
            {/* CCC 추이 */}
            <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">CCC 추이</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cccTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 140]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {entities.map(e => (
                    <Line
                      key={e}
                      type="monotone"
                      dataKey={e}
                      stroke={entityColors[e]}
                      strokeWidth={selectedEntity === e ? 3 : 1}
                      strokeDasharray={e === '연결' && showConsolidated ? '5 5' : undefined}
                      opacity={selectedEntity === e || (e === '연결' && showConsolidated) ? 1 : 0.3}
                      dot={{ r: selectedEntity === e ? 5 : 2 }}
                      hide={e === '연결' && !showConsolidated}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 법인별 회전율수 비교 (레이더) + 인사이트 */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4">법인별 회전율수 비교 (25.3Q)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={selectedTurnover && consolidatedTurnover ? [
                    { metric: 'DSO', value: selectedTurnover.dso, consolidatedValue: consolidatedTurnover.dso },
                    { metric: 'DIO', value: selectedTurnover.dio, consolidatedValue: consolidatedTurnover.dio },
                    { metric: 'DPO', value: selectedTurnover.dpo, consolidatedValue: consolidatedTurnover.dpo },
                    { metric: 'CCC', value: selectedTurnover.ccc, consolidatedValue: consolidatedTurnover.ccc },
                  ] : []}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis tick={{ fontSize: 10 }} />
                    <Radar
                      name={selectedEntity}
                      dataKey="value"
                      stroke={entityColors[selectedEntity]}
                      fill={entityColors[selectedEntity]}
                      fillOpacity={0.5}
                      strokeWidth={2}
                    />
                    {showConsolidated && consolidatedTurnover && (
                      <Radar
                        name="연결"
                        dataKey="consolidatedValue"
                        stroke={entityColors['연결']}
                        fill={entityColors['연결']}
                        fillOpacity={0.2}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                    )}
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* AI 인사이트 - 회전율 */}
              <AIInsight
                type="turnover"
                title={`🤖 ${selectedEntity} AI 분석`}
                data={{
                  entity: selectedEntity,
                  dso: selectedTurnover?.dso || 0,
                  dio: selectedTurnover?.dio || 0,
                  dpo: selectedTurnover?.dpo || 0,
                  ccc: selectedTurnover?.ccc || 0,
                  prevDso: turnoverData.find(t => t.quarter === '24.3Q' && t.entity === selectedEntity)?.dso || 0,
                  prevDio: turnoverData.find(t => t.quarter === '24.3Q' && t.entity === selectedEntity)?.dio || 0,
                  prevDpo: turnoverData.find(t => t.quarter === '24.3Q' && t.entity === selectedEntity)?.dpo || 0,
                  prevCcc: turnoverData.find(t => t.quarter === '24.3Q' && t.entity === selectedEntity)?.ccc || 0,
                  dsoChange: (selectedTurnover?.dso || 0) - (turnoverData.find(t => t.quarter === '24.3Q' && t.entity === selectedEntity)?.dso || 0),
                  dioChange: (selectedTurnover?.dio || 0) - (turnoverData.find(t => t.quarter === '24.3Q' && t.entity === selectedEntity)?.dio || 0),
                  dpoChange: (selectedTurnover?.dpo || 0) - (turnoverData.find(t => t.quarter === '24.3Q' && t.entity === selectedEntity)?.dpo || 0),
                  cccChange: (selectedTurnover?.ccc || 0) - (turnoverData.find(t => t.quarter === '24.3Q' && t.entity === selectedEntity)?.ccc || 0),
                }}
              />

              {/* 연결 회전율 인사이트 */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-900">연결 회전율 인사이트</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="bg-white/60 rounded p-2">
                    <div className="font-medium text-blue-800">현황: 관리필요</div>
                    <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                      <div>DSO: <span className="font-bold">{consolidatedTurnover?.dso}일</span></div>
                      <div>DIO: <span className="font-bold">{consolidatedTurnover?.dio}일</span></div>
                      <div>DPO: <span className="font-bold">{consolidatedTurnover?.dpo}일</span></div>
                      <div>CCC: <span className="font-bold text-red-600">{consolidatedTurnover?.ccc}일</span></div>
                    </div>
                  </div>
                  <div className="bg-white/60 rounded p-2 text-xs">
                    <div className="font-medium text-amber-800 mb-1">🚨 주요 이슈</div>
                    <ul className="space-y-0.5 text-amber-700">
                      <li>• CCC 95일 (+23일 YoY)</li>
                      <li>• DIO 91일 재고 증가 주가</li>
                    </ul>
                  </div>
                  <div className="bg-white/60 rounded p-2 text-xs">
                    <div className="font-medium text-pink-800 mb-1">💡 개선 방향</div>
                    <ul className="space-y-0.5 text-pink-700">
                      <li>• 법인별 재고를 정책 수립</li>
                      <li>• 재고 최적화 우선 추진</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 회전율 공식 및 의미 */}
          <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">회전율 공식 및 의미</h3>
              <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1 rounded">
                ※ DIO/DPO는 매출원가율 60% 가정 적용
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  label: 'DSO',
                  title: 'Days Sales Outstanding',
                  formula: '365÷(연매출÷매출채권)',
                  meaning: '채권 회수 일수',
                  action: '→ 낮을수록 좋음',
                  color: 'blue'
                },
                {
                  label: 'DIO',
                  title: 'Days Inventory Outstanding',
                  formula: '365÷(연매출원가÷재고)',
                  meaning: '재고 판매 일수',
                  action: '→ 낮을수록 좋음',
                  color: 'amber'
                },
                {
                  label: 'DPO',
                  title: 'Days Payables Outstanding',
                  formula: '365÷(연매출원가÷매입채무)',
                  meaning: '채무 결제 일수',
                  action: '→ 적정 유지',
                  color: 'green'
                },
                {
                  label: 'CCC',
                  title: 'Cash Conversion Cycle',
                  formula: 'DSO+DIO-DPO',
                  meaning: '현금전환주기',
                  action: '→ 낮을수록 좋음',
                  color: 'purple'
                },
              ].map((item) => (
                <div key={item.label} className={`p-4 rounded-lg border-2 border-${item.color}-200 bg-${item.color}-50`}>
                  <div className={`inline-block px-2 py-1 bg-${item.color}-500 text-white text-xs font-bold rounded mb-2`}>
                    {item.label}
                  </div>
                  <div className="text-xs text-slate-600 mb-2">{item.title}</div>
                  <div className="text-sm font-mono bg-white/60 p-2 rounded mb-2 text-slate-800">
                    {item.formula}
                  </div>
                  <div className="text-xs text-slate-700 mb-1">{item.meaning}</div>
                  <div className={`text-xs font-medium text-${item.color}-700`}>{item.action}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 추세 탭 */}
      {activeTab === 2 && (
        <div className="space-y-6">
          {/* 법인 선택 */}
          <div className="flex gap-2 flex-wrap">
            {entities.map(e => (
              <button
                key={e}
                onClick={() => setSelectedEntity(e)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedEntity === e ? 'ring-2 ring-offset-2 scale-105' : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: entityColors[e], color: 'white' }}
              >
                {e}
              </button>
            ))}
          </div>

          {/* 차트 그리드 */}
          <div className="grid grid-cols-2 gap-6">
            {/* YoY 추세 비교 (선택된 법인) */}
            <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">{selectedEntity} YoY 추세 비교</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={[
                  { quarter: '1Q', '24년': toOk(wcData.find(d => d.QUARTER === '24.1Q' && d.ENTITY === selectedEntity)?.WC || 0), '25년': toOk(wcData.find(d => d.QUARTER === '25.1Q' && d.ENTITY === selectedEntity)?.WC || 0) },
                  { quarter: '2Q', '24년': toOk(wcData.find(d => d.QUARTER === '24.2Q' && d.ENTITY === selectedEntity)?.WC || 0), '25년': toOk(wcData.find(d => d.QUARTER === '25.2Q' && d.ENTITY === selectedEntity)?.WC || 0) },
                  { quarter: '3Q', '24년': toOk(wcData.find(d => d.QUARTER === '24.3Q' && d.ENTITY === selectedEntity)?.WC || 0), '25년': toOk(wcData.find(d => d.QUARTER === '25.3Q' && d.ENTITY === selectedEntity)?.WC || 0) },
                  { quarter: '4Q', '24년': toOk(wcData.find(d => d.QUARTER === '24.4Q' && d.ENTITY === selectedEntity)?.WC || 0), '25년': null },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quarter" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => [`${v}억`, '']} />
                  <Legend />
                  <Line type="monotone" dataKey="24년" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="25년" stroke={entityColors[selectedEntity]} strokeWidth={3} dot={{ r: 5, fill: entityColors[selectedEntity] }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 운전자본 구성 추이 (선택된 법인) */}
            <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">{selectedEntity} 운전자본 구성 추이</h3>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={wcData.filter(d => d.ENTITY === selectedEntity).map(d => ({
                  quarter: d.QUARTER,
                  재고자산: toOk(d.INVENTORY),
                  매출채권: toOk(d.RECEIVABLES),
                  매입채무: toOk(d.PAYABLES),
                  운전자본: toOk(d.WC)
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip formatter={(v: number) => [`${v}억`, '']} />
                  <Legend />
                  <Bar dataKey="재고자산" fill={colors.inventory} />
                  <Bar dataKey="매출채권" fill={colors.receivables} />
                  <Bar dataKey="매입채무" fill={colors.payables} />
                  <Line type="monotone" dataKey="운전자본" stroke={entityColors[selectedEntity]} strokeWidth={3} dot={{ r: 4, fill: entityColors[selectedEntity] }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* 법인별 3Q YoY 비교 (전체) */}
            <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">법인별 3Q YoY 비교</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={entities.slice(0, -1).map(entity => {
                  const current = wcData.find(d => d.QUARTER === '25.3Q' && d.ENTITY === entity);
                  const prev = wcData.find(d => d.QUARTER === '24.3Q' && d.ENTITY === entity);
                  return {
                    entity,
                    '24.3Q': toOk(prev?.WC || 0),
                    '25.3Q': toOk(current?.WC || 0),
                    yoy: yoyChange(current?.WC || 0, prev?.WC || 0)
                  };
                })}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="entity" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip formatter={(v: number) => [`${v}억`, '']} />
                  <Legend />
                  <Bar dataKey="24.3Q" fill="#94a3b8" opacity={selectedEntity === '연결' ? 0.5 : 1} />
                  <Bar dataKey="25.3Q" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 flex gap-4 justify-center text-xs">
                {entities.slice(0, -1).map(entity => {
                  const current = wcData.find(d => d.QUARTER === '25.3Q' && d.ENTITY === entity);
                  const prev = wcData.find(d => d.QUARTER === '24.3Q' && d.ENTITY === entity);
                  const change = yoyChange(current?.WC || 0, prev?.WC || 0);
                  const isSelected = entity === selectedEntity;
                  return (
                    <div key={entity} className={`text-center ${isSelected ? 'font-bold' : ''}`}>
                      <div className={isSelected ? 'text-slate-800' : 'text-slate-500'}>{entity}</div>
                      <div className={`${isSelected ? 'font-extrabold' : 'font-bold'} ${change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {change > 0 ? '+' : ''}{change.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 회전일수 추이 (선택된 법인) */}
            <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">{selectedEntity} 회전일수 추이</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={quarters.map(q => {
                  const turn = turnoverData.find(t => t.quarter === q && t.entity === selectedEntity);
                  return {
                    quarter: q,
                    DSO: turn?.dso || 0,
                    DIO: turn?.dio || 0,
                    DPO: turn?.dpo || 0,
                    CCC: turn?.ccc || 0,
                  };
                })}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="DSO" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="DIO" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="DPO" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="CCC" stroke={entityColors[selectedEntity]} strokeWidth={3} dot={{ r: 5, fill: entityColors[selectedEntity] }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI 인사이트 - 추세 */}
          <AIInsight
            type="trend"
            title={`🤖 ${selectedEntity} 추세 AI 분석`}
            data={{
              entity: selectedEntity,
              wcTrend: quarters.map(q => {
                const item = wcData.find(d => d.QUARTER === q && d.ENTITY === selectedEntity);
                return { quarter: q, wc: toOk(item?.WC || 0) };
              }),
              turnoverTrend: quarters.map(q => {
                const turn = turnoverData.find(t => t.quarter === q && t.entity === selectedEntity);
                return {
                  quarter: q,
                  dso: turn?.dso || 0,
                  dio: turn?.dio || 0,
                  dpo: turn?.dpo || 0,
                  ccc: turn?.ccc || 0,
                };
              }),
              wcTrendDirection: yoyChange(
                wcData.find(d => d.QUARTER === '25.3Q' && d.ENTITY === selectedEntity)?.WC || 0,
                wcData.find(d => d.QUARTER === '24.3Q' && d.ENTITY === selectedEntity)?.WC || 0
              ) > 0 ? '증가 추세' : '감소 추세',
              cccTrendDirection: ((turnoverData.find(t => t.quarter === '25.3Q' && t.entity === selectedEntity)?.ccc || 0) -
                (turnoverData.find(t => t.quarter === '24.3Q' && t.entity === selectedEntity)?.ccc || 0)) > 0 ? '증가 추세 (악화)' : '감소 추세 (개선)',
            }}
          />
        </div>
      )}

      {/* 액션플랜 탭 */}
      {activeTab === 3 && (
        <div className="space-y-6">
          {/* AI 생성 액션플랜 */}
          <AIActionPlan
            data={{
              wcData: wcData,
              turnoverData: turnoverData,
              currentQuarter: '25.3Q',
              previousQuarter: '24.3Q',
              entities: entities,
              summary: {
                totalWC: wcData.find(d => d.QUARTER === '25.3Q' && d.ENTITY === '연결')?.WC || 0,
                avgCCC: turnoverData.find(t => t.quarter === '25.3Q' && t.entity === '연결')?.ccc || 0,
                yoyChanges: entities.slice(0, -1).map(entity => {
                  const current = wcData.find(d => d.QUARTER === '25.3Q' && d.ENTITY === entity);
                  const prev = wcData.find(d => d.QUARTER === '24.3Q' && d.ENTITY === entity);
                  return {
                    entity,
                    wcChange: ((current?.WC || 0) - (prev?.WC || 0)) / (prev?.WC || 1) * 100,
                    currentWC: current?.WC || 0,
                    prevWC: prev?.WC || 0,
                  };
                }),
                turnoverMetrics: entities.slice(0, -1).map(entity => {
                  const current = turnoverData.find(t => t.quarter === '25.3Q' && t.entity === entity);
                  const prev = turnoverData.find(t => t.quarter === '24.3Q' && t.entity === entity);
                  return {
                    entity,
                    currentCCC: current?.ccc || 0,
                    prevCCC: prev?.ccc || 0,
                    dso: current?.dso || 0,
                    dio: current?.dio || 0,
                    dpo: current?.dpo || 0,
                  };
                }),
              }
            }}
          />

          {/* CCC 목표 vs 현재 + 개선 방향 */}
          <div className="grid grid-cols-2 gap-6">
            {/* CCC 목표 vs 현재 */}
            <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">CCC 목표 vs 현재</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={[
                    { entity: '국내', 현재: 84, 목표: 70 },
                    { entity: '중국', 현재: 72, 목표: 55 },
                    { entity: '홍콩', 현재: 101, 목표: 75 },
                    { entity: 'ST', 현재: 122, 목표: 90 },
                  ]}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="entity" type="category" width={50} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="현재" fill="#ef4444" />
                  <Bar dataKey="목표" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 개선 방향 */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-4">💡 개선 방향</h3>
              <div className="space-y-3">
                <div className="bg-white/80 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                      1
                    </div>
                    <div className="font-medium text-blue-900">국내</div>
                  </div>
                  <div className="text-sm text-slate-700 pl-8">
                    DPO 82일 공급망 리스크 → 60~75일 적정화
                  </div>
                </div>
                <div className="bg-white/80 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">
                      2
                    </div>
                    <div className="font-medium text-red-900">중국</div>
                  </div>
                  <div className="text-sm text-slate-700 pl-8">
                    DIO 관리 필요 → CCC 70일 이하 목표
                  </div>
                </div>
                <div className="bg-white/80 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">
                      3
                    </div>
                    <div className="font-medium text-green-900">ST</div>
                  </div>
                  <div className="text-sm text-slate-700 pl-8">
                    CCC 128일 과다 → 90일 단계적 개선
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-green-100 rounded-lg">
                <div className="font-medium text-green-900 mb-2">💰 개선 효과 (CCC 102→58일)</div>
                <div className="text-sm text-green-800">
                  • 운전자본 절감: 약 2,288억원<br />
                  • 연간 이자비용 절감: 약 114억원 (5% 가정)
                </div>
              </div>
            </div>
          </div>

          {/* AI 액션 플랜 */}
          <AIInsight
            type="action"
            title="🤖 AI 액션 플랜 추천"
            data={{
              entities: yoyTableData.map(row => ({
                name: row.entity,
                wc: toOk(row.wc),
                ccc: row.ccc,
                yoy: row.wcYoY,
              })),
              issues: [
                `연결 재고 ${yoyChange(latestConsolidated?.INVENTORY || 0, prevConsolidated?.INVENTORY || 0).toFixed(1)}% 증가`,
                `중국 채권 ${yoyChange(
                  wcData.find(d => d.QUARTER === '25.3Q' && d.ENTITY === '중국')?.RECEIVABLES || 0,
                  wcData.find(d => d.QUARTER === '24.3Q' && d.ENTITY === '중국')?.RECEIVABLES || 0
                ).toFixed(1)}% 증가`,
                `ST(미국) 운전자본 ${yoyChange(
                  wcData.find(d => d.QUARTER === '25.3Q' && d.ENTITY === 'ST(미국)')?.WC || 0,
                  wcData.find(d => d.QUARTER === '24.3Q' && d.ENTITY === 'ST(미국)')?.WC || 0
                ).toFixed(1)}% 증가`,
              ],
              currentCCC: latestConsolidated?.ccc || 0,
            }}
          />
        </div>
      )}

    </div>
  );
}
