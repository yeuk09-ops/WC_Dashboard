/**
 * 분기 관련 유틸리티 함수
 */

export interface QuarterInfo {
  quarter: string; // 예: "25.3Q"
  year: number;    // 예: 2025
  q: number;       // 예: 3
}

/**
 * 분기 문자열을 QuarterInfo로 변환
 */
export function parseQuarter(quarter: string): QuarterInfo | null {
  const match = quarter.match(/^(\d{2})\.(\d)Q$/);
  if (!match) return null;
  
  const year = 2000 + parseInt(match[1]);
  const q = parseInt(match[2]);
  
  return { quarter, year, q };
}

/**
 * 분기 비교 (a > b이면 양수, a < b이면 음수, 같으면 0)
 */
export function compareQuarters(a: string, b: string): number {
  const qa = parseQuarter(a);
  const qb = parseQuarter(b);
  
  if (!qa || !qb) return 0;
  
  if (qa.year !== qb.year) {
    return qa.year - qb.year;
  }
  
  return qa.q - qb.q;
}

/**
 * 분기 배열에서 최신(가장 큰) 분기 찾기
 */
export function getLatestQuarter(quarters: string[]): string | null {
  if (quarters.length === 0) return null;
  
  return quarters.reduce((latest, current) => {
    return compareQuarters(current, latest) > 0 ? current : latest;
  });
}

/**
 * 1년 전 분기 계산 (YoY 비교용)
 */
export function getYearAgoQuarter(quarter: string): string | null {
  const qi = parseQuarter(quarter);
  if (!qi) return null;
  
  const prevYear = qi.year - 1;
  const yy = prevYear % 100;
  return `${yy.toString().padStart(2, '0')}.${qi.q}Q`;
}

/**
 * 분기 포맷팅 (표시용)
 */
export function formatQuarter(quarter: string): string {
  const qi = parseQuarter(quarter);
  if (!qi) return quarter;
  
  return `${qi.year}년 ${qi.q}분기`;
}

/**
 * 분기 배열 정렬 (오름차순)
 */
export function sortQuarters(quarters: string[]): string[] {
  return [...quarters].sort(compareQuarters);
}

/**
 * 유효한 분기인지 검증
 */
export function isValidQuarter(quarter: string): boolean {
  return parseQuarter(quarter) !== null;
}
