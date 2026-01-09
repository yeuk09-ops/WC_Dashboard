# F&F 운전자본 대시보드

F&F 그룹의 연결 운전자본을 분석하고 모니터링하는 대시보드입니다.

## 주요 기능

### 📊 대시보드
- **운전자본 개요**: 법인별 운전자본 현황 및 YoY 비교
- **회전율 분석**: DSO, DIO, DPO, CCC 지표 분석
- **추세 분석**: 분기별 운전자본 및 회전율 추세
- **액션플랜**: AI 기반 우선순위별 개선 과제

### 🤖 AI 인사이트
- OpenAI GPT-4o-mini 기반 자동 분석
- **개발환경**: AI 분석 실행 및 캐시 생성
- **프로덕션**: 정적 캐시 파일 사용 (API 호출 없음)
- 분기별 독립적인 분석 결과 저장

### 📁 데이터 관리
- **개발환경 전용**:
  - 엑셀 파일 업로드
  - 데이터 유효성 검증
  - 관리자 페이지 (비밀번호: `fnf2025`)
- **프로덕션**: 데이터 업로드 비활성화

### 🔄 배포 워크플로우
1. 개발환경에서 데이터 업로드 및 AI 분석 실행
2. `ai-cache/*.json` 파일 Git 커밋
3. Vercel 자동 배포 (정적 캐시 사용)

## 기술 스택

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **AI**: OpenAI GPT-4o-mini
- **Database**: Snowflake (선택) / Mock 데이터
- **Deployment**: Vercel

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

#### 개발 환경 (`.env.local`)

```env
# OpenAI API 키 (개발환경 필수)
OPENAI_API_KEY=sk-your-api-key

# AI 기능 활성화
NEXT_PUBLIC_ENABLE_AI=true

# 관리자 페이지 활성화
NEXT_PUBLIC_ENABLE_ADMIN=true

# Mock 데이터 사용
USE_MOCK_DATA=true

# 매출원가율
COGS_RATE=0.60
```

#### 프로덕션 환경 (Vercel)

Vercel 대시보드 → Settings → Environment Variables에 설정:

```env
# AI 기능 비활성화 (정적 캐시만 사용)
NEXT_PUBLIC_ENABLE_AI=false

# 관리자 페이지 비활성화
NEXT_PUBLIC_ENABLE_ADMIN=false

# Mock 데이터 사용
USE_MOCK_DATA=true

# 매출원가율
COGS_RATE=0.60

# OpenAI API 키는 설정하지 않음
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### 4. 프로덕션 빌드

```bash
npm run build
npm start
```

## 사용 방법

### 데이터 업로드

1. 우측 상단 "관리자" 버튼 클릭
2. 비밀번호 입력 (기본값: `fnf2025`)
3. 엑셀 템플릿 다운로드
4. 데이터 입력 후 업로드
5. 자동으로 AI 분석 실행

### AI 분석

- 데이터 업로드 시 자동으로 최초 1회 실행
- 각 탭의 "AI 분석" 버튼으로 재분석 가능
- 결과는 `ai-cache/` 폴더에 분기별로 저장

### 엑셀 데이터 형식

| 분기 | 법인 | 매출액 | 매출원가 | 매출채권 | 재고자산 | 매입채무 |
|------|------|--------|----------|----------|----------|----------|
| 25.3Q | 국내(OC) | 430000 | 258000 | 75000 | 220000 | 140000 |

#### 법인명 (고정)
- 국내(OC)
- 중국
- 홍콩
- ST(미국)
- 기타
- 연결

#### 분기 형식
- YY.NQ (예: 24.1Q, 25.3Q)

## 프로젝트 구조

```
fnf-wc-dashboard/
├── app/
│   ├── api/              # API 라우트
│   │   ├── wc-data/      # 운전자본 데이터
│   │   ├── turnover/     # 회전율 데이터
│   │   ├── ai-analysis/  # AI 분석
│   │   ├── ai-action-plan/ # AI 액션플랜
│   │   ├── ai-cache/     # AI 캐시 관리
│   │   └── upload-excel/ # 엑셀 업로드
│   ├── components/       # React 컴포넌트
│   ├── admin/            # 관리자 페이지
│   ├── layout.tsx        # 레이아웃
│   └── page.tsx          # 메인 페이지
├── lib/
│   ├── snowflake.ts      # Snowflake 연결
│   ├── quarter-utils.ts  # 분기 유틸리티
│   └── ai-cache.ts       # AI 캐시 시스템
├── types/
│   └── index.ts          # TypeScript 타입
├── ai-cache/             # AI 분석 캐시 (Git 포함)
├── public/               # 정적 파일
└── DEPLOYMENT_GUIDE.md   # 배포 가이드
```

## 배포

### Vercel 배포 (권장)

1. **GitHub에 푸시**
   ```bash
   git add .
   git commit -m "feat: F&F 운전자본 대시보드 구축"
   git push origin main
   ```

2. **Vercel 연동**
   - [Vercel](https://vercel.com)에 로그인
   - GitHub 저장소 연결
   - 환경 변수 설정
   - 자동 배포

자세한 내용은 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)를 참고하세요.

## AI 캐시 시스템

- 분기별로 AI 분석 결과를 캐시하여 저장
- OpenAI API 호출 비용 절감
- Git에 포함되어 배포 시 함께 배포
- 캐시 파일 위치: `ai-cache/[분기].json`

## 주요 지표

### 운전자본 (WC)
```
WC = 매출채권 + 재고자산 - 매입채무
```

### 현금전환주기 (CCC)
```
CCC = DSO + DIO - DPO
```

- **DSO** (Days Sales Outstanding): 매출채권 회수 일수
- **DIO** (Days Inventory Outstanding): 재고 판매 일수
- **DPO** (Days Payables Outstanding): 매입채무 결제 일수

## 보안

- 관리자 페이지는 비밀번호로 보호
- 세션 스토리지 사용
- 환경 변수로 민감 정보 관리
- `.env.local` 파일은 Git에서 제외

## 라이선스

이 프로젝트는 F&F 그룹 내부용입니다.

## 문의

F&F 재무기획팀

---

**최신 업데이트**: 2026년 1월 9일
