/**
 * Snowflake 연결 유틸리티
 * F&F 운전자본 대시보드용
 */

import snowflake from 'snowflake-sdk';

// 연결 설정
const connectionConfig = {
  account: process.env.SNOWFLAKE_ACCOUNT || '',
  username: process.env.SNOWFLAKE_USER || '',
  password: process.env.SNOWFLAKE_PASSWORD || '',
  database: process.env.SNOWFLAKE_DATABASE || 'FNF',
  schema: process.env.SNOWFLAKE_SCHEMA || 'PRCS',
  warehouse: process.env.SNOWFLAKE_WAREHOUSE || '',
};

// 연결 생성
function createConnection() {
  return snowflake.createConnection(connectionConfig);
}

// 쿼리 실행 함수
export async function executeQuery<T>(query: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const connection = createConnection();
    
    connection.connect((err) => {
      if (err) {
        console.error('Snowflake 연결 실패:', err.message);
        reject(err);
        return;
      }
      
      connection.execute({
        sqlText: query,
        complete: (err, stmt, rows) => {
          // 연결 종료
          connection.destroy((destroyErr) => {
            if (destroyErr) {
              console.error('연결 종료 오류:', destroyErr.message);
            }
          });
          
          if (err) {
            console.error('쿼리 실행 실패:', err.message);
            reject(err);
            return;
          }
          
          resolve((rows || []) as T[]);
        }
      });
    });
  });
}

// 운전자본 데이터 타입
export interface WCData {
  QUARTER: string;
  ENTITY: string;
  REVENUE_Q: number;
  COGS_Q?: number; // 매출원가 (선택적)
  RECEIVABLES: number;
  INVENTORY: number;
  PAYABLES: number;
  WC: number;
}

// 운전자본 데이터 조회 쿼리
export const WC_QUERY = `
-- F&F 연결 운전자본 조회
-- 법인별: 국내(OC), 중국, 홍콩, ST(미국), 기타, 연결
WITH QUARTERLY_DATA AS (
  SELECT 
    CONCAT(SUBSTR(YYYYMM, 1, 2), '.', 
           CASE 
             WHEN SUBSTR(YYYYMM, 5, 2) IN ('01','02','03') THEN '1Q'
             WHEN SUBSTR(YYYYMM, 5, 2) IN ('04','05','06') THEN '2Q'
             WHEN SUBSTR(YYYYMM, 5, 2) IN ('07','08','09') THEN '3Q'
             ELSE '4Q'
           END) AS QUARTER,
    ENTITY_CD,
    CASE ENTITY_CD
      WHEN '1000' THEN '국내(OC)'
      WHEN '2100' THEN '중국'
      WHEN '2200' THEN '홍콩'
      WHEN '3100' THEN 'ST(미국)'
      ELSE '기타'
    END AS ENTITY,
    SUM(REVENUE) AS REVENUE_Q,
    SUM(AR_BALANCE) AS RECEIVABLES,
    SUM(INVENTORY_BALANCE) AS INVENTORY,
    SUM(AP_BALANCE) AS PAYABLES
  FROM FNF.SAP_FNF.DW_WC_MONTHLY
  WHERE YYYYMM >= '202401'
  GROUP BY QUARTER, ENTITY_CD
)
SELECT 
  QUARTER,
  ENTITY,
  REVENUE_Q,
  RECEIVABLES,
  INVENTORY,
  PAYABLES,
  (RECEIVABLES + INVENTORY - PAYABLES) AS WC
FROM QUARTERLY_DATA
ORDER BY QUARTER, ENTITY
`;

// 회전율 계산 함수
export function calcTurnover(data: WCData) {
  const annualRevenue = data.REVENUE_Q * 4;
  
  // DSO는 매출액 기준
  const dso = data.RECEIVABLES > 0 ? Math.round(365 / (annualRevenue / data.RECEIVABLES)) : 0;
  
  // DIO, DPO는 매출원가 기준
  // 실제 매출원가가 있으면 사용, 없으면 매출액의 60%로 추정
  const cogsRate = 0.60; // 매출원가율 (추정용)
  const annualCOGS = data.COGS_Q ? data.COGS_Q * 4 : annualRevenue * cogsRate;
  
  const dio = data.INVENTORY > 0 ? Math.round(365 / (annualCOGS / data.INVENTORY)) : 0;
  const dpo = data.PAYABLES > 0 ? Math.round(365 / (annualCOGS / data.PAYABLES)) : 0;
  const ccc = dso + dio - dpo;
  
  return { dso, dio, dpo, ccc };
}

export default { executeQuery, calcTurnover, WC_QUERY };
