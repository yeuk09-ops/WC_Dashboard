# AI 인사이트 기능 설정 가이드

F&F 운전자본 대시보드의 AI 인사이트 기능을 사용하기 위한 설정 가이드입니다.

## 🤖 AI 기능 개요

OpenAI GPT-4를 활용하여 다음과 같은 AI 분석을 제공합니다:

### 1. Overview 탭
- 전체 운전자본 현황 평가
- 주요 개선점 및 우려사항 식별
- 즉시 주목해야 할 법인/항목 추천

### 2. 회전율 탭
- 법인별 회전율 현황 평가
- DSO/DIO/DPO 개선 필요 지표 분석
- 구체적인 개선 방안 제시

### 3. 추세 탭
- 분기별 추세 분석 (개선/악화/유지)
- 변곡점 및 이상치 탐지
- 향후 예상 추세 및 대응 방안

### 4. 액션플랜 탭
- 우선순위별 액션 플랜 (HIGH/MEDIUM/LOW)
- 실행 가능한 구체적 조치사항
- 담당 부서 및 KPI 제시

## 📋 설정 방법

### 1. OpenAI API 키 발급

1. [OpenAI Platform](https://platform.openai.com/) 접속
2. 계정 생성 또는 로그인
3. API Keys 메뉴 이동
4. "Create new secret key" 클릭
5. 생성된 키 복사 (sk-로 시작)

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# .env.local 파일 생성
# Windows
copy .env.example .env.local

# Mac/Linux
cp .env.example .env.local
```

`.env.local` 파일에 OpenAI API 키 추가:

```env
# Snowflake 연결 정보
SNOWFLAKE_ACCOUNT=your_account.ap-northeast-2.aws
SNOWFLAKE_USER=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_DATABASE=FNF
SNOWFLAKE_SCHEMA=PRCS
SNOWFLAKE_WAREHOUSE=your_warehouse

# Mock 데이터 사용
USE_MOCK_DATA=true

# OpenAI API 키 (필수)
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. 개발 서버 재시작

```bash
# 기존 서버 중지 (Ctrl+C)
# 서버 재시작
npm run dev
```

## 💡 사용 방법

### AI 분석 실행

1. 대시보드의 각 탭으로 이동
2. "🤖 AI 인사이트" 섹션 찾기
3. "AI 분석" 버튼 클릭
4. 3-5초 후 AI 분석 결과 표시

### AI 재분석

- 데이터가 변경되었거나 다른 관점의 분석이 필요한 경우
- "AI 재분석" 버튼 클릭
- 새로운 분석 결과 생성

## 💰 비용 안내

### OpenAI API 사용료

- **모델**: GPT-4o-mini (비용 효율적)
- **예상 비용**: 분석당 약 $0.001-0.003 (약 1-4원)
- **월 예상**: 100회 분석 시 약 $0.10-0.30 (약 130-400원)

### 무료 크레딧

- 신규 가입 시 $5 무료 크레딧 제공
- 약 1,500-5,000회 분석 가능

## 🔒 보안 주의사항

### API 키 관리

1. **절대 공개하지 마세요**
   - GitHub 등 공개 저장소에 업로드 금지
   - `.env.local` 파일은 `.gitignore`에 포함됨

2. **키 노출 시 조치**
   - 즉시 OpenAI 대시보드에서 키 삭제
   - 새 키 발급 및 교체

3. **접근 제한**
   - API 키는 서버사이드에서만 사용
   - 클라이언트에 노출되지 않음

## 🚨 문제 해결

### "OpenAI API 키가 설정되지 않았습니다"

**원인**: `.env.local` 파일이 없거나 API 키가 누락됨

**해결**:
1. `.env.local` 파일 존재 확인
2. `OPENAI_API_KEY=sk-...` 형식으로 입력 확인
3. 개발 서버 재시작

### "OpenAI API 키가 유효하지 않습니다"

**원인**: API 키가 잘못되었거나 만료됨

**해결**:
1. OpenAI 대시보드에서 키 확인
2. 새 키 발급
3. `.env.local` 파일 업데이트
4. 서버 재시작

### "AI 분석 요청 중 오류가 발생했습니다"

**원인**: 네트워크 오류 또는 API 할당량 초과

**해결**:
1. 인터넷 연결 확인
2. OpenAI 대시보드에서 사용량 확인
3. 잠시 후 재시도

### AI 분석이 느린 경우

**원인**: 네트워크 속도 또는 API 응답 시간

**정상 범위**: 3-10초
**해결**: 
- 네트워크 상태 확인
- 잠시 후 재시도

## 📊 AI 분석 품질 향상

### 더 나은 인사이트를 위한 팁

1. **정확한 데이터 입력**
   - 매출원가 데이터 포함
   - 모든 필드 정확히 입력

2. **정기적 업데이트**
   - 분기별 최신 데이터 업로드
   - 추세 분석 정확도 향상

3. **맥락 제공**
   - 특이사항이 있으면 관리자에게 공유
   - AI 분석 결과와 실무 경험 결합

## 🔧 고급 설정 (선택사항)

### AI 모델 변경

`app/api/ai-analysis/route.ts` 파일에서:

```typescript
// GPT-4o-mini (기본, 빠르고 저렴)
model: 'gpt-4o-mini'

// GPT-4o (더 정확하지만 비쌈)
model: 'gpt-4o'
```

### 분석 길이 조정

```typescript
max_tokens: 1000  // 기본값
max_tokens: 1500  // 더 상세한 분석
max_tokens: 500   // 간단한 분석
```

## 📞 지원

문제가 지속되면:
- 재무기획팀 문의
- 시스템 관리자 연락
- [OpenAI 지원 센터](https://help.openai.com/)

---

© 2025 F&F Holdings. Internal Use Only.
