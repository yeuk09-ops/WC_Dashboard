# F&F 운전자본 대시보드 - 프로젝트 요약

## 🎯 프로젝트 개요

F&F 그룹의 법인별 및 연결 기준 운전자본 현황을 실시간으로 분석하고, 회전율 지표를 통해 자본 효율성을 모니터링하는 웹 기반 대시보드입니다.

## ✅ 완료된 작업

### 1. 기본 인프라 설정
- ✅ Next.js 14 + TypeScript 프로젝트 구조
- ✅ Tailwind CSS 스타일링
- ✅ Recharts 차트 라이브러리 통합
- ✅ 환경 변수 설정 (.env.example)
- ✅ .gitignore 설정
- ✅ TypeScript 타입 정의 (types/index.ts)

### 2. 데이터 레이어
- ✅ Snowflake 연결 유틸리티 (lib/snowflake.ts)
- ✅ 운전자본 데이터 API (GET /api/wc-data)
- ✅ 회전율 분석 API (GET /api/turnover)
- ✅ Mock 데이터 지원 (Snowflake 없이 테스트 가능)
- ✅ 회전율 자동 계산 (DSO, DIO, DPO, CCC)

### 3. 엑셀 업로드 기능 (신규 추가)
- ✅ xlsx 패키지 설치 및 통합
- ✅ 엑셀 업로드 API (POST /api/upload-excel)
- ✅ 엑셀 템플릿 다운로드 API (GET /api/upload-excel)
- ✅ 엑셀 업로드 UI 컴포넌트 (ExcelUpload.tsx)
- ✅ 데이터 검증 및 오류 처리
- ✅ 실시간 데이터 반영

### 4. 대시보드 UI
- ✅ **Overview 탭**: KPI 카드, 운전자본 추이, 법인별 구성비
- ✅ **회전율분석 탭**: DSO/DIO/DPO/CCC 추이, 법인별 비교
- ✅ **추세분석 탭**: 법인별 YoY 비교, 항목별 구성 추이
- ✅ **액션플랜 탭**: 우선순위별 이슈, CCC 목표 vs 현재
- ✅ **데이터 업로드 탭**: 엑셀 업로드, 템플릿 다운로드, 데이터 현황

### 5. 문서화
- ✅ README.md 업데이트
- ✅ SETUP.md 설치 가이드 작성
- ✅ API 문서화
- ✅ 엑셀 업로드 가이드

## 📊 주요 기능

### 데이터 소스
1. **Snowflake 연결**: 실시간 DB 조회
2. **Mock 데이터**: 개발/테스트용
3. **엑셀 업로드**: 수동 데이터 입력 및 업데이트

### 분석 기능
- 운전자본 추이 분석 (7개 분기)
- 법인별 비교 (국내, 중국, 홍콩, ST, 기타, 연결)
- 회전율 지표 (DSO, DIO, DPO, CCC)
- YoY 변화율 분석
- 목표 대비 현황 모니터링

### 시각화
- KPI 카드 (운전자본, 매출채권, 재고자산, 매입채무)
- 라인 차트 (추이 분석)
- 바 차트 (항목별 비교)
- 파이 차트 (법인별 구성비)
- 콤보 차트 (복합 분석)

## 🗂 파일 구조

```
fnf-wc-dashboard/
├── app/
│   ├── api/
│   │   ├── wc-data/route.ts          # 운전자본 데이터 API
│   │   ├── turnover/route.ts          # 회전율 데이터 API
│   │   └── upload-excel/route.ts      # 엑셀 업로드 API (신규)
│   ├── components/
│   │   └── ExcelUpload.tsx            # 엑셀 업로드 컴포넌트 (신규)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                       # 메인 대시보드
├── lib/
│   └── snowflake.ts                   # Snowflake 연결 유틸
├── types/
│   └── index.ts                       # TypeScript 타입 정의 (신규)
├── .env.example                       # 환경 변수 예시 (신규)
├── .gitignore                         # Git 제외 파일 (신규)
├── package.json                       # 패키지 정보 (xlsx 추가)
├── README.md                          # 프로젝트 문서 (업데이트)
├── SETUP.md                           # 설치 가이드 (신규)
└── PROJECT_SUMMARY.md                 # 이 파일 (신규)
```

## 🔌 API 엔드포인트

### 1. GET /api/wc-data
- **기능**: 운전자본 데이터 조회
- **파라미터**: startQ, endQ, entity
- **응답**: 운전자본 및 회전율 데이터 배열

### 2. GET /api/turnover
- **기능**: 회전율 분석 데이터 조회
- **파라미터**: quarter, entity
- **응답**: DSO/DIO/DPO/CCC 데이터

### 3. POST /api/upload-excel
- **기능**: 엑셀 파일 업로드 및 데이터 변환
- **입력**: multipart/form-data (Excel 파일)
- **응답**: 변환된 운전자본 데이터

### 4. GET /api/upload-excel
- **기능**: 엑셀 템플릿 다운로드
- **응답**: fnf_wc_template.xlsx 파일

## 📦 주요 패키지

```json
{
  "dependencies": {
    "next": "14.2.15",
    "react": "^18.2.0",
    "recharts": "^2.12.7",
    "lucide-react": "^0.447.0",
    "snowflake-sdk": "^1.12.0",
    "xlsx": "^0.18.5"
  }
}
```

## 🚀 시작하기

### 빠른 시작
```bash
# 1. 패키지 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env.local

# 3. 개발 서버 실행
npm run dev
```

### 엑셀 업로드 사용
1. http://localhost:3000 접속
2. "📤 데이터 업로드" 탭 클릭
3. "템플릿 다운로드" 버튼으로 템플릿 다운로드
4. 엑셀 파일에 데이터 입력
5. "파일 선택" 버튼으로 업로드
6. 자동으로 차트에 반영

## 🎨 UI/UX 특징

- **반응형 디자인**: 모든 화면 크기 지원
- **인터랙티브 차트**: 호버, 클릭 상호작용
- **실시간 업데이트**: 엑셀 업로드 시 즉시 반영
- **오류 처리**: 상세한 오류 메시지 및 가이드
- **사용자 친화적**: 직관적인 탭 구조

## 🔐 보안

- 환경 변수로 DB 자격 증명 관리
- .env 파일 Git 제외
- API Routes로 서버사이드 처리
- 파일 업로드 검증 (확장자, 형식)

## 📈 향후 개선 사항 (선택사항)

### 데이터 관리
- [ ] 업로드된 데이터 영구 저장 (DB 또는 파일)
- [ ] 데이터 히스토리 관리
- [ ] 데이터 내보내기 (엑셀, CSV)

### 분석 기능
- [ ] 시나리오 분석 (What-if)
- [ ] 예측 모델 (머신러닝)
- [ ] 벤치마크 비교

### UI/UX
- [ ] 다크 모드
- [ ] 커스텀 차트 색상
- [ ] 대시보드 레이아웃 커스터마이징

### 권한 관리
- [ ] 사용자 인증 (로그인)
- [ ] 역할 기반 접근 제어
- [ ] 감사 로그

## 📞 지원

- **담당**: 재무기획팀
- **데이터 소스**: SAP FI/CO, Snowflake
- **업데이트 주기**: 분기별

---

© 2025 F&F Holdings. Internal Use Only.
