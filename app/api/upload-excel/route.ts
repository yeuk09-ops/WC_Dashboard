/**
 * 엑셀 업로드 API
 * POST /api/upload-excel
 * 
 * 엑셀 파일을 받아서 운전자본 데이터로 변환
 */

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { calcTurnover } from '@/lib/snowflake';
import { getLatestQuarter } from '@/lib/quarter-utils';
import type { WCDataItem } from '@/types';

// 허용된 법인 목록 (고정)
const ALLOWED_ENTITIES = ['국내(OC)', '중국', '홍콩', 'ST(미국)', '기타', '연결'];

// 허용된 분기 형식 (YY.NQ 형식)
const QUARTER_PATTERN = /^\d{2}\.\d{1}Q$/;

// 데이터 검증 함수
function validateQuarter(quarter: string): { valid: boolean; error?: string } {
  if (!quarter || typeof quarter !== 'string') {
    return { valid: false, error: '분기 값이 없거나 올바르지 않습니다' };
  }
  
  const trimmed = String(quarter).trim();
  if (!QUARTER_PATTERN.test(trimmed)) {
    return { valid: false, error: `분기 형식이 올바르지 않습니다. (예: 24.1Q, 25.3Q) - 입력값: ${trimmed}` };
  }
  
  return { valid: true };
}

function validateEntity(entity: string): { valid: boolean; error?: string } {
  if (!entity || typeof entity !== 'string') {
    return { valid: false, error: '법인명이 없거나 올바르지 않습니다' };
  }
  
  const trimmed = String(entity).trim();
  if (!ALLOWED_ENTITIES.includes(trimmed)) {
    return { 
      valid: false, 
      error: `허용되지 않은 법인명입니다. 허용 법인: ${ALLOWED_ENTITIES.join(', ')} - 입력값: ${trimmed}` 
    };
  }
  
  return { valid: true };
}

function validateNumber(value: any, fieldName: string): { valid: boolean; value?: number; error?: string } {
  // 빈 값이나 '-' 는 0으로 처리
  if (value === null || value === undefined || value === '' || value === '-') {
    return { valid: true, value: 0 };
  }
  
  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName}은 숫자여야 합니다 - 입력값: ${value}` };
  }
  
  if (num < 0) {
    return { valid: false, error: `${fieldName}은 음수일 수 없습니다 - 입력값: ${value}` };
  }
  
  return { valid: true, value: num };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 없습니다.' },
        { status: 400 }
      );
    }

    // 파일 확장자 확인
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { success: false, error: '엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.' },
        { status: 400 }
      );
    }

    // 파일을 버퍼로 읽기
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 엑셀 파일 파싱
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // JSON으로 변환
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (!jsonData || jsonData.length === 0) {
      return NextResponse.json(
        { success: false, error: '엑셀 파일에 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // 데이터 변환 및 검증
    const wcData: WCDataItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row: any = jsonData[i];
      const rowNum = i + 2; // 헤더 제외

      try {
        // 1. 분기 검증
        const quarterValidation = validateQuarter(row['분기']);
        if (!quarterValidation.valid) {
          errors.push(`행 ${rowNum}: ${quarterValidation.error}`);
          continue;
        }

        // 2. 법인 검증
        const entityValidation = validateEntity(row['법인']);
        if (!entityValidation.valid) {
          errors.push(`행 ${rowNum}: ${entityValidation.error}`);
          continue;
        }

        // 3. 필수 숫자 필드 검증
        const revenueValidation = validateNumber(row['매출액'], '매출액');
        if (!revenueValidation.valid) {
          errors.push(`행 ${rowNum}: ${revenueValidation.error}`);
          continue;
        }

        const cogsValidation = validateNumber(row['매출원가'], '매출원가');
        if (!cogsValidation.valid) {
          errors.push(`행 ${rowNum}: ${cogsValidation.error}`);
          continue;
        }

        const receivablesValidation = validateNumber(row['매출채권'], '매출채권');
        if (!receivablesValidation.valid) {
          errors.push(`행 ${rowNum}: ${receivablesValidation.error}`);
          continue;
        }

        const inventoryValidation = validateNumber(row['재고자산'], '재고자산');
        if (!inventoryValidation.valid) {
          errors.push(`행 ${rowNum}: ${inventoryValidation.error}`);
          continue;
        }

        const payablesValidation = validateNumber(row['매입채무'], '매입채무');
        if (!payablesValidation.valid) {
          errors.push(`행 ${rowNum}: ${payablesValidation.error}`);
          continue;
        }

        // 데이터 변환 (검증된 값 사용)
        const dataItem = {
          QUARTER: String(row['분기']).trim(),
          ENTITY: String(row['법인']).trim(),
          REVENUE_Q: revenueValidation.value || 0,
          COGS_Q: (cogsValidation.value && cogsValidation.value > 0) ? cogsValidation.value : undefined, // 매출원가 (0이나 없으면 undefined)
          RECEIVABLES: receivablesValidation.value || 0,
          INVENTORY: inventoryValidation.value || 0,
          PAYABLES: payablesValidation.value || 0,
          WC: 0, // 계산될 예정
        };

        // 운전자본 계산
        dataItem.WC = dataItem.RECEIVABLES + dataItem.INVENTORY - dataItem.PAYABLES;

        // 회전율 계산
        const turnover = calcTurnover(dataItem);

        wcData.push({
          ...dataItem,
          ...turnover,
        });

      } catch (error) {
        errors.push(`행 ${rowNum}: 데이터 변환 오류 - ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }

    if (wcData.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '유효한 데이터가 없습니다.',
          details: errors 
        },
        { status: 400 }
      );
    }

    // 최신 분기 감지
    const allQuarters = [...new Set(wcData.map(d => d.QUARTER))];
    const latestQuarter = getLatestQuarter(allQuarters);
    
    // 성공 응답
    return NextResponse.json({
      success: true,
      data: wcData,
      meta: {
        totalRows: jsonData.length,
        validRows: wcData.length,
        errors: errors.length > 0 ? errors : undefined,
        latestQuarter,
        allQuarters,
        triggerAIAnalysis: true, // 클라이언트에 AI 분석 실행 신호
      }
    });

  } catch (error) {
    console.error('엑셀 업로드 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '파일 처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}

// 엑셀 템플릿 다운로드 API
export async function GET() {
  try {
    // 템플릿 데이터 생성
    const templateData = [
      {
        '분기': '25.3Q',
        '법인': '국내(OC)',
        '매출액': 430000,
        '매출원가': 258000,
        '매출채권': 75000,
        '재고자산': 220000,
        '매입채무': 140000,
      },
      {
        '분기': '25.3Q',
        '법인': '중국',
        '매출액': 220000,
        '매출원가': 132000,
        '매출채권': 45000,
        '재고자산': 70000,
        '매입채무': 8000,
      },
    ];

    // 워크북 생성
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '운전자본 데이터');

    // 엑셀 파일을 버퍼로 변환
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 응답 헤더 설정
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="fnf_wc_template.xlsx"',
      },
    });

  } catch (error) {
    console.error('템플릿 생성 오류:', error);
    return NextResponse.json(
      { success: false, error: '템플릿 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
