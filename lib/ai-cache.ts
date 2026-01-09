/**
 * AI 분석 결과 캐시 관리
 * 분기별로 AI 분석 결과를 파일 시스템에 저장/로드
 */

import fs from 'fs';
import path from 'path';

export interface AIAnalysisCache {
  quarter: string;
  generatedAt: string;
  overview?: string;
  turnover?: Record<string, string>; // entity별 분석
  trend?: Record<string, string>; // entity별 분석
  actionPlan?: any[];
  actionPlanInsight?: string;
}

const CACHE_DIR = path.join(process.cwd(), 'ai-cache');

/**
 * 캐시 디렉토리 생성 (없으면)
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * 분기별 캐시 파일 경로
 */
function getCacheFilePath(quarter: string): string {
  // 25.3Q -> 25-3Q.json
  const filename = quarter.replace('.', '-') + '.json';
  return path.join(CACHE_DIR, filename);
}

/**
 * AI 분석 결과 저장
 */
export function saveAICache(quarter: string, cache: AIAnalysisCache): void {
  try {
    ensureCacheDir();
    const filePath = getCacheFilePath(quarter);
    
    const data = {
      ...cache,
      quarter,
      generatedAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ AI 캐시 저장: ${quarter} -> ${filePath}`);
  } catch (error) {
    console.error(`❌ AI 캐시 저장 실패 (${quarter}):`, error);
    throw error;
  }
}

/**
 * AI 분석 결과 로드
 */
export function loadAICache(quarter: string): AIAnalysisCache | null {
  try {
    const filePath = getCacheFilePath(quarter);
    
    if (!fs.existsSync(filePath)) {
      console.log(`ℹ️ AI 캐시 없음: ${quarter}`);
      return null;
    }
    
    const data = fs.readFileSync(filePath, 'utf-8');
    const cache = JSON.parse(data) as AIAnalysisCache;
    
    console.log(`✅ AI 캐시 로드: ${quarter} (생성: ${cache.generatedAt})`);
    return cache;
  } catch (error) {
    console.error(`❌ AI 캐시 로드 실패 (${quarter}):`, error);
    return null;
  }
}

/**
 * 특정 분석 타입만 업데이트
 */
export function updateAICachePartial(
  quarter: string,
  type: 'overview' | 'turnover' | 'trend' | 'actionPlan' | 'actionPlanInsight',
  data: any
): void {
  try {
    ensureCacheDir();
    const filePath = getCacheFilePath(quarter);
    
    let cache: AIAnalysisCache = {
      quarter,
      generatedAt: new Date().toISOString(),
    };
    
    // 기존 캐시가 있으면 로드
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, 'utf-8');
      cache = JSON.parse(existing);
    }
    
    // 해당 타입만 업데이트
    cache[type] = data;
    cache.generatedAt = new Date().toISOString();
    
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf-8');
    console.log(`✅ AI 캐시 부분 업데이트: ${quarter}.${type}`);
  } catch (error) {
    console.error(`❌ AI 캐시 부분 업데이트 실패 (${quarter}.${type}):`, error);
    throw error;
  }
}

/**
 * AI 캐시 삭제
 */
export function deleteAICache(quarter: string): void {
  try {
    const filePath = getCacheFilePath(quarter);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ AI 캐시 삭제: ${quarter}`);
    }
  } catch (error) {
    console.error(`❌ AI 캐시 삭제 실패 (${quarter}):`, error);
    throw error;
  }
}

/**
 * 모든 캐시된 분기 목록
 */
export function listCachedQuarters(): string[] {
  try {
    ensureCacheDir();
    
    const files = fs.readdirSync(CACHE_DIR);
    const quarters = files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', '').replace('-', '.'));
    
    return quarters;
  } catch (error) {
    console.error('❌ 캐시 목록 조회 실패:', error);
    return [];
  }
}
