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
  actionPlan?: Record<string, { improvementDirection: string; actionItems: any[] }>; // entity별 액션플랜
  actionPlanInsight?: string;
}

// Vercel serverless 환경에서는 /tmp만 쓰기 가능
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const CACHE_DIR = isServerless 
  ? path.join('/tmp', 'ai-cache')
  : path.join(process.cwd(), 'ai-cache');

/**
 * 캐시 디렉토리 생성 (없으면)
 */
function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    return true;
  } catch (error) {
    console.warn('⚠️ 캐시 디렉토리 생성 실패:', error);
    return false;
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
export function saveAICache(quarter: string, cache: AIAnalysisCache): boolean {
  try {
    if (!ensureCacheDir()) {
      console.warn(`⚠️ 캐시 디렉토리 생성 불가 (${quarter})`);
      return false;
    }
    
    const filePath = getCacheFilePath(quarter);
    
    const data = {
      ...cache,
      quarter,
      generatedAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ AI 캐시 저장: ${quarter} -> ${filePath}`);
    return true;
  } catch (error) {
    console.warn(`⚠️ AI 캐시 저장 실패 (${quarter}):`, error);
    return false;
  }
}

/**
 * AI 분석 결과 로드
 */
export function loadAICache(quarter: string): AIAnalysisCache | null {
  try {
    const filePath = getCacheFilePath(quarter);
    let fileToRead = filePath;
    
    // Vercel 환경에서는 여러 경로 확인
    if (!fs.existsSync(filePath)) {
      if (isServerless) {
        // 1) 프로젝트 ai-cache 폴더
        const projectPath = path.join(process.cwd(), 'ai-cache', quarter.replace('.', '-') + '.json');
        // 2) public 폴더 (정적 파일)
        const publicPath = path.join(process.cwd(), 'public', 'ai-cache', quarter.replace('.', '-') + '.json');
        
        if (fs.existsSync(projectPath)) {
          fileToRead = projectPath;
          console.log(`✅ 프로젝트 캐시 사용: ${quarter}`);
        } else if (fs.existsSync(publicPath)) {
          fileToRead = publicPath;
          console.log(`✅ public 캐시 사용: ${quarter}`);
        } else {
          console.log(`ℹ️ AI 캐시 없음: ${quarter}`);
          return null;
        }
      } else {
        console.log(`ℹ️ AI 캐시 없음: ${quarter}`);
        return null;
      }
    }
    
    const data = fs.readFileSync(fileToRead, 'utf-8');
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
): boolean {
  try {
    if (!ensureCacheDir()) {
      console.warn(`⚠️ 캐시 디렉토리 생성 불가 (${quarter}.${type})`);
      return false;
    }
    
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
    return true;
  } catch (error) {
    console.warn(`⚠️ AI 캐시 부분 업데이트 실패 (${quarter}.${type}):`, error);
    return false;
  }
}

/**
 * AI 캐시 삭제
 */
export function deleteAICache(quarter: string): boolean {
  try {
    const filePath = getCacheFilePath(quarter);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ AI 캐시 삭제: ${quarter}`);
    }
    return true;
  } catch (error) {
    console.warn(`⚠️ AI 캐시 삭제 실패 (${quarter}):`, error);
    return false;
  }
}

/**
 * 모든 캐시된 분기 목록
 */
export function listCachedQuarters(): string[] {
  try {
    if (!ensureCacheDir()) {
      return [];
    }
    
    const files = fs.readdirSync(CACHE_DIR);
    const quarters = files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', '').replace('-', '.'));
    
    return quarters;
  } catch (error) {
    console.warn('⚠️ 캐시 목록 조회 실패:', error);
    return [];
  }
}
