'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Shield, ArrowLeft, Database, RefreshCw } from 'lucide-react';
import ExcelUpload from '../components/ExcelUpload';
import type { WCDataItem } from '@/types';

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [wcData, setWcData] = useState<WCDataItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // 관리자 페이지 활성화 여부 확인
  const isAdminEnabled = process.env.NEXT_PUBLIC_ENABLE_ADMIN === 'true';

  // 관리자 비밀번호 (실제 환경에서는 환경 변수나 백엔드 인증 사용)
  const ADMIN_PASSWORD = 'fnf2025';

  useEffect(() => {
    // 관리자 페이지 비활성화 시 홈으로 리다이렉트
    if (!isAdminEnabled) {
      router.push('/');
      return;
    }

    // 세션 확인
    const auth = sessionStorage.getItem('admin_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
      fetchData();
    } else {
      setDataLoading(false);
    }
  }, [isAdminEnabled, router]);

  const fetchData = async () => {
    try {
      setDataLoading(true);
      const response = await fetch('/api/wc-data', {
        headers: { 'Cache-Control': 'no-cache' } // 관리자는 항상 최신 데이터
      });
      const result = await response.json();
      if (result.success) {
        setWcData(result.data);
      }
    } catch (err) {
      console.error('데이터 로드 실패:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 간단한 비밀번호 확인
    setTimeout(() => {
      if (password === ADMIN_PASSWORD) {
        setIsAuthenticated(true);
        sessionStorage.setItem('admin_auth', 'true');
        fetchData();
      } else {
        setError('비밀번호가 올바르지 않습니다.');
      }
      setLoading(false);
    }, 500);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('admin_auth');
    setPassword('');
  };

  const handleDataUploaded = (uploadedData: WCDataItem[]) => {
    const mergedData = [...wcData];
    uploadedData.forEach(newItem => {
      const existingIndex = mergedData.findIndex(
        item => item.QUARTER === newItem.QUARTER && item.ENTITY === newItem.ENTITY
      );
      if (existingIndex >= 0) {
        mergedData[existingIndex] = newItem;
      } else {
        mergedData.push(newItem);
      }
    });
    mergedData.sort((a, b) => {
      const qOrder = ['24.1Q', '24.2Q', '24.3Q', '24.4Q', '25.1Q', '25.2Q', '25.3Q'];
      return qOrder.indexOf(a.QUARTER) - qOrder.indexOf(b.QUARTER);
    });
    setWcData(mergedData);
  };

  const formatOk = (n: number) => `${Math.round(n / 10) / 10}억`;

  // 로그인 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
            {/* 헤더 */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">관리자 로그인</h1>
              <p className="text-sm text-slate-500">F&F 운전자본 대시보드 관리</p>
            </div>

            {/* 로그인 폼 */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  비밀번호
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="관리자 비밀번호를 입력하세요"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? '확인 중...' : '로그인'}
              </button>
            </form>

            {/* 돌아가기 */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <button
                onClick={() => router.push('/')}
                className="w-full flex items-center justify-center gap-2 text-slate-600 hover:text-slate-800 text-sm font-medium transition"
              >
                <ArrowLeft className="w-4 h-4" />
                대시보드로 돌아가기
              </button>
            </div>

            {/* 안내 */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700 text-center">
                💡 관리자만 접근 가능한 페이지입니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 관리자 페이지
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">관리자 페이지</h1>
              <p className="text-blue-100 text-sm">데이터 관리 및 업로드</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
            >
              <ArrowLeft className="w-4 h-4" />
              대시보드
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 엑셀 업로드 */}
      <ExcelUpload onDataUploaded={handleDataUploaded} />

      {/* 현재 데이터 현황 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 text-lg">현재 데이터 현황</h3>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-3 text-slate-600">데이터 로딩 중...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-blue-600 mb-1">총 데이터 수</div>
                <div className="text-3xl font-bold text-blue-700">{wcData.length}</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                <div className="text-sm text-green-600 mb-1">분기 수</div>
                <div className="text-3xl font-bold text-green-700">
                  {new Set(wcData.map(d => d.QUARTER)).size}
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                <div className="text-sm text-purple-600 mb-1">법인 수</div>
                <div className="text-3xl font-bold text-purple-700">
                  {new Set(wcData.map(d => d.ENTITY)).size}
                </div>
              </div>
            </div>

            {wcData.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">분기</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">법인</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">매출</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">운전자본</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">DSO</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">DIO</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">DPO</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">CCC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {wcData.slice(-15).reverse().map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3">{item.QUARTER}</td>
                        <td className="px-4 py-3 font-medium">{item.ENTITY}</td>
                        <td className="px-4 py-3 text-right">{formatOk(item.REVENUE_Q)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatOk(item.WC)}</td>
                        <td className="px-4 py-3 text-right">{item.dso}일</td>
                        <td className="px-4 py-3 text-right">{item.dio}일</td>
                        <td className="px-4 py-3 text-right">{item.dpo}일</td>
                        <td className="px-4 py-3 text-right font-medium text-blue-600">{item.ccc}일</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {wcData.length > 15 && (
                  <div className="bg-slate-50 px-4 py-2 text-xs text-slate-500 text-center border-t border-slate-200">
                    최근 15개 항목만 표시됩니다 (전체: {wcData.length}개)
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 안내 사항 */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">⚠️ 주의사항</p>
            <ul className="space-y-1 list-disc list-inside text-amber-700">
              <li>업로드된 데이터는 즉시 대시보드에 반영됩니다.</li>
              <li>기존 데이터와 동일한 분기/법인이 있으면 덮어씁니다.</li>
              <li>데이터 백업은 별도로 관리하시기 바랍니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
