# F&F 운전자본 대시보드 설치 가이드

이 문서는 F&F 운전자본 대시보드를 처음 설치하고 실행하는 방법을 안내합니다.

## 📋 사전 요구사항

- **Node.js**: 18.0 이상
- **npm** 또는 **yarn**
- **Git** (선택사항)

## 🚀 설치 단계

### 1. 프로젝트 다운로드

```bash
# Git 클론 (GitHub 사용 시)
git clone https://github.com/your-username/fnf-wc-dashboard.git
cd fnf-wc-dashboard

# 또는 ZIP 파일 다운로드 후 압축 해제
```

### 2. 의존성 패키지 설치

```bash
npm install
```

설치되는 주요 패키지:
- `next`: Next.js 프레임워크
- `react`, `react-dom`: React 라이브러리
- `recharts`: 차트 라이브러리
- `lucide-react`: 아이콘
- `snowflake-sdk`: Snowflake 데이터베이스 연결
- `xlsx`: 엑셀 파일 처리
- `typescript`: TypeScript
- `tailwindcss`: CSS 프레임워크

### 3. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env.local` 파일을 생성합니다:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env.local

# Mac/Linux
cp .env.example .env.local
```

`.env.local` 파일을 열어서 Snowflake 연결 정보를 입력합니다:

```env
# Snowflake 연결 정보
SNOWFLAKE_ACCOUNT=your_account.ap-northeast-2.aws
SNOWFLAKE_USER=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_DATABASE=FNF
SNOWFLAKE_SCHEMA=PRCS
SNOWFLAKE_WAREHOUSE=your_warehouse

# Mock 데이터 사용 (Snowflake 연결 없이 테스트)
USE_MOCK_DATA=true
```

**중요:** 
- Snowflake 연결 없이 테스트하려면 `USE_MOCK_DATA=true`로 설정
- 실제 Snowflake 데이터를 사용하려면 `USE_MOCK_DATA=false`로 설정하고 연결 정보 입력

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

### 5. 빌드 및 프로덕션 실행 (선택사항)

```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

## 📤 엑셀 업로드 기능 사용법

### 1. 템플릿 다운로드

1. 대시보드 접속
2. "📤 데이터 업로드" 탭 클릭
3. "템플릿 다운로드" 버튼 클릭
4. `fnf_wc_template.xlsx` 파일 다운로드

### 2. 데이터 입력

엑셀 파일에 다음 컬럼을 입력합니다:

| 분기 | 법인 | 매출액 | 매출채권 | 재고자산 | 매입채무 |
|------|------|--------|----------|----------|----------|
| 25.3Q | 국내(OC) | 430000 | 75000 | 220000 | 140000 |
| 25.3Q | 중국 | 220000 | 45000 | 70000 | 8000 |

**주의사항:**
- 금액은 백만원 단위로 입력
- 법인명은 정확히 입력: `국내(OC)`, `중국`, `홍콩`, `ST(미국)`, `기타`, `연결`
- 분기 형식: `24.1Q`, `24.2Q`, `24.3Q`, `24.4Q`, `25.1Q` 등

### 3. 파일 업로드

1. "파일 선택" 버튼 클릭
2. 작성한 엑셀 파일 선택
3. 업로드 완료 후 자동으로 데이터 반영
4. 다른 탭에서 업데이트된 차트 확인

## 🔧 문제 해결

### 포트 충돌 오류

```bash
# 다른 포트로 실행
PORT=3001 npm run dev
```

### 패키지 설치 오류

```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install
```

### Snowflake 연결 오류

1. `.env.local` 파일의 연결 정보 확인
2. `USE_MOCK_DATA=true`로 설정하여 Mock 데이터로 테스트
3. Snowflake 계정 권한 확인

### 엑셀 업로드 오류

- 파일 형식 확인 (.xlsx 또는 .xls)
- 필수 컬럼이 모두 있는지 확인
- 법인명과 분기 형식이 정확한지 확인
- 금액 필드에 숫자만 입력되었는지 확인

## 📁 프로젝트 구조

```
fnf-wc-dashboard/
├── app/
│   ├── api/
│   │   ├── wc-data/          # 운전자본 데이터 API
│   │   ├── turnover/          # 회전율 데이터 API
│   │   └── upload-excel/      # 엑셀 업로드 API
│   ├── components/
│   │   └── ExcelUpload.tsx    # 엑셀 업로드 컴포넌트
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # 메인 대시보드
├── lib/
│   └── snowflake.ts           # Snowflake 연결 유틸
├── types/
│   └── index.ts               # TypeScript 타입 정의
├── .env.example               # 환경 변수 예시
├── .env.local                 # 환경 변수 (생성 필요)
├── .gitignore
├── package.json
├── README.md
├── SETUP.md                   # 이 파일
└── tsconfig.json
```

## 🌐 Vercel 배포

자세한 배포 방법은 [README.md](./README.md)의 "Vercel 배포 가이드" 섹션을 참조하세요.

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. Node.js 버전: `node --version` (18.0 이상)
2. npm 버전: `npm --version`
3. 환경 변수 설정 확인
4. 브라우저 콘솔 오류 메시지 확인
5. 터미널 오류 메시지 확인

---

© 2025 F&F Holdings. 재무기획팀.
