'use client';

import React, { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { WCDataItem } from '@/types';

interface ExcelUploadProps {
  onDataUploaded: (data: WCDataItem[]) => void;
}

export default function ExcelUpload({ onDataUploaded }: ExcelUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [details, setDetails] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus('idle');
    setMessage('');
    setDetails([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-excel', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setUploadStatus('success');
        setMessage(`성공적으로 업로드되었습니다. (${result.meta.validRows}개 행)`);
        
        if (result.meta.errors && result.meta.errors.length > 0) {
          setDetails(result.meta.errors);
        }

        // 부모 컴포넌트에 데이터 전달
        onDataUploaded(result.data);
      } else {
        setUploadStatus('error');
        setMessage(result.error || '업로드 실패');
        if (result.details) {
          setDetails(Array.isArray(result.details) ? result.details : [result.details]);
        }
      }
    } catch (error) {
      setUploadStatus('error');
      setMessage('파일 업로드 중 오류가 발생했습니다.');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
      // 파일 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/upload-excel', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('템플릿 다운로드 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fnf_wc_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Template download error:', error);
      alert('템플릿 다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-slate-700">엑셀 데이터 업로드</h3>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded transition"
        >
          <Download className="w-4 h-4" />
          템플릿 다운로드
        </button>
      </div>

      <div className="space-y-4">
        {/* 파일 업로드 영역 */}
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-sky-400 transition">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-600 mb-2">
            엑셀 파일을 선택하거나 드래그하여 업로드하세요
          </p>
          <button
            onClick={handleUploadClick}
            disabled={uploading}
            className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
          >
            {uploading ? '업로드 중...' : '파일 선택'}
          </button>
        </div>

        {/* 업로드 상태 메시지 */}
        {uploadStatus !== 'idle' && (
          <div
            className={`p-4 rounded-lg border ${
              uploadStatus === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start gap-2">
              {uploadStatus === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    uploadStatus === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {message}
                </p>
                {details.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      상세 내용:
                    </p>
                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                      {details.map((detail, index) => (
                        <li key={index}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 사용 안내 */}
        <div className="space-y-3">
          <div className="bg-sky-50 rounded-lg p-4 text-sm text-slate-600">
            <p className="font-medium text-sky-700 mb-2">📋 업로드 가이드</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>템플릿을 다운로드하여 형식을 확인하세요</li>
              <li>필수 컬럼: 분기, 법인, 매출액, 매출원가, 매출채권, 재고자산, 매입채무</li>
              <li><strong>분기 형식:</strong> 24.1Q, 24.2Q, 25.3Q 등 (YY.NQ 형식만 허용)</li>
              <li><strong>법인명:</strong> 국내(OC), 중국, 홍콩, ST(미국), 기타, 연결 (정확히 일치해야 함)</li>
              <li>금액은 백만원 단위로 입력하세요</li>
              <li>매출원가가 없으면 매출액의 60%로 자동 추정됩니다</li>
            </ul>
          </div>

          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 text-sm text-amber-800">
            <p className="font-medium mb-2">⚠️ 데이터 검증 규칙</p>
            <ul className="space-y-1 text-xs">
              <li>• 허용되지 않은 법인명은 업로드가 거부됩니다</li>
              <li>• 분기 형식이 잘못되면 오류가 발생합니다</li>
              <li>• 모든 금액은 0 이상의 숫자여야 합니다</li>
              <li>• 법인 추가/변경이 필요하면 관리자에게 문의하세요</li>
            </ul>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 text-sm text-blue-800">
            <p className="font-medium mb-2">💡 법인/분기 변경이 필요한 경우</p>
            <p className="text-xs">
              새로운 법인 추가나 데이터 구조 변경이 필요한 경우, 대시보드 구성 변경이 필요합니다.
              재무기획팀 또는 시스템 관리자에게 먼저 문의해주세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
