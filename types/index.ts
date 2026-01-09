/**
 * F&F 운전자본 대시보드 타입 정의
 */

// 운전자본 데이터 타입
export interface WCDataItem {
  QUARTER: string;
  ENTITY: string;
  REVENUE_Q: number;
  COGS_Q?: number; // 매출원가 (선택적, 없으면 매출액의 60%로 추정)
  RECEIVABLES: number;
  INVENTORY: number;
  PAYABLES: number;
  WC: number;
  dso: number;
  dio: number;
  dpo: number;
  ccc: number;
}

// 회전율 데이터 타입
export interface TurnoverItem {
  quarter: string;
  entity: string;
  dso: number;
  dio: number;
  dpo: number;
  ccc: number;
}

// API 응답 타입
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, any>;
}

// 엑셀 업로드 데이터 타입
export interface ExcelUploadData {
  quarter: string;
  entity: string;
  revenue: number;
  receivables: number;
  inventory: number;
  payables: number;
}

// 차트 데이터 타입
export interface ChartDataItem {
  quarter?: string;
  entity?: string;
  [key: string]: string | number | undefined;
}

// 법인 타입
export type EntityType = '국내(OC)' | '중국' | '홍콩' | 'ST(미국)' | '기타' | '연결';

// 분기 타입
export type QuarterType = '24.1Q' | '24.2Q' | '24.3Q' | '24.4Q' | '25.1Q' | '25.2Q' | '25.3Q';
