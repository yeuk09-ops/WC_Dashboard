# 배포 가이드 - F&F 운전자본 대시보드

## 개요

이 가이드는 F&F 운전자본 대시보드를 Git에 반영하고 Vercel에 배포하는 방법을 설명합니다.

## 주요 변경 사항

### 1. 최신 분기 자동 감지
- 데이터의 가장 최신 분기를 자동으로 감지
- 헤더와 모든 분석에 자동 반영

### 2. AI 분석 캐시 시스템
- 분기별 AI 분석 결과를 `ai-cache/` 폴더에 저장
- 동일한 분기의 분석 결과 재사용으로 OpenAI API 비용 절감
- Git에 포함되어 배포 시 함께 배포됨

### 3. 자동 AI 분석 실행
- 데이터 업로드 또는 변경 시 자동으로 AI 분석 실행
- 한 번 생성된 분석 결과는 캐시에 저장되어 재사용

### 4. AI 재분석 기능
- 각 AI 인사이트 컴포넌트에 "AI 재분석" 버튼 추가
- 필요시 강제로 새로운 분석 생성 가능

## Git 반영 절차

### 1. 현재 상태 확인

```bash
cd fnf-wc-dashboard
git status
```

### 2. 변경사항 스테이징

```bash
# 모든 변경사항 추가
git add .

# 또는 개별 파일/폴더 추가
git add lib/quarter-utils.ts
git add lib/ai-cache.ts
git add app/api/ai-cache/
git add app/api/wc-data/route.ts
git add app/api/upload-excel/route.ts
git add app/api/ai-action-plan/route.ts
git add app/api/ai-analysis/route.ts
git add ai-cache/
```

### 3. 커밋

```bash
git commit -m "feat: 분기별 AI 캐시 시스템 및 자동 분기 감지 구현

- 최신 분기 자동 감지 기능 추가
- AI 분석 결과를 분기별로 캐시하여 저장
- 데이터 업로드 시 자동 AI 분석 실행
- AI 재분석 기능 추가
- 분기별 독립적인 AI 캐시 파일 관리"
```

### 4. 원격 저장소에 푸시

```bash
# main 브랜치에 푸시
git push origin main

# 또는 새 브랜치 생성
git checkout -b feature/ai-cache-system
git push origin feature/ai-cache-system
```

## Vercel 배포 절차

### 방법 1: GitHub 연동 (권장)

1. **Vercel 프로젝트와 GitHub 연동**
   - Vercel 대시보드 (https://vercel.com) 접속
   - 프로젝트 선택
   - Settings > Git > GitHub 저장소 연동 확인

2. **자동 배포**
   - `main` 브랜치에 푸시하면 자동으로 프로덕션 배포
   - 다른 브랜치에 푸시하면 프리뷰 배포 생성

3. **환경 변수 설정**
   - Vercel 대시보드 > 프로젝트 > Settings > Environment Variables
   - 필수 환경 변수 추가:
     ```
     OPENAI_API_KEY=sk-...
     USE_MOCK_DATA=true
     COGS_RATE=0.60
     ```
   - Snowflake 사용 시 추가:
     ```
     SNOWFLAKE_ACCOUNT=...
     SNOWFLAKE_USER=...
     SNOWFLAKE_PASSWORD=...
     SNOWFLAKE_DATABASE=FNF
     SNOWFLAKE_SCHEMA=PRCS
     SNOWFLAKE_WAREHOUSE=...
     USE_MOCK_DATA=false
     ```

### 방법 2: Vercel CLI

```bash
# Vercel CLI 설치 (처음 한 번만)
npm i -g vercel

# 로그인
vercel login

# 배포
vercel --prod
```

## 분기별 배포 전략

### 현재 분기 업데이트 (25.3Q → 25.4Q)

1. **데이터 업로드**
   - 관리자 페이지에서 25.4Q 데이터 엑셀 업로드
   - 자동으로 최신 분기가 25.4Q로 변경됨
   - 자동으로 25.4Q AI 분석 실행 및 캐시 생성

2. **Git 커밋**
   ```bash
   git add .
   git commit -m "data: 25.4Q 데이터 업데이트 및 AI 분석 캐시"
   git push origin main
   ```

3. **Vercel 자동 배포**
   - main 브랜치 푸시 시 자동으로 프로덕션 배포
   - 약 2-3분 소요

### 과거 분기 보존 (선택사항)

과거 분기(예: 25.3Q)의 대시보드를 별도로 유지하려면:

1. **태그 생성**
   ```bash
   git tag v25.3Q
   git push origin v25.3Q
   ```

2. **Vercel에서 별도 프로젝트 생성**
   - Vercel 대시보드에서 "Add New Project"
   - 동일한 GitHub 저장소 선택
   - Production Branch를 `v25.3Q` 태그로 설정
   - 별도 도메인 할당 (예: fnf-wc-25-3q.vercel.app)

## 확인 사항

### 배포 전 체크리스트

- [ ] `.env.local`에 `OPENAI_API_KEY` 설정 확인
- [ ] `ai-cache/` 폴더에 최신 분기 캐시 파일 존재 확인
- [ ] 로컬에서 `npm run build` 성공 확인
- [ ] 관리자 페이지 비밀번호 변경 (필요시)

### 배포 후 확인사항

- [ ] 메인 페이지에서 최신 분기가 올바르게 표시되는지 확인
- [ ] AI 인사이트가 캐시에서 로드되는지 확인 (빠른 로딩)
- [ ] 관리자 페이지에서 데이터 업로드 테스트
- [ ] AI 재분석 버튼 동작 확인

## 문제 해결

### AI 분석이 생성되지 않는 경우

1. Vercel 환경 변수에 `OPENAI_API_KEY` 설정 확인
2. Vercel 로그에서 에러 메시지 확인
3. 로컬에서 테스트:
   ```bash
   npm run dev
   # 관리자 페이지에서 데이터 업로드 테스트
   ```

### 캐시가 적용되지 않는 경우

1. `ai-cache/` 폴더가 Git에 포함되었는지 확인
2. Vercel 배포 로그에서 파일이 포함되었는지 확인
3. API 응답에서 `cached: true` 확인

### 최신 분기가 감지되지 않는 경우

1. Mock 데이터 또는 업로드된 데이터에 분기 정보 확인
2. `/api/wc-data` 응답의 `meta.latestQuarter` 확인

## 모니터링

### Vercel Analytics
- Vercel 대시보드 > Analytics에서 트래픽 및 성능 모니터링

### OpenAI API 사용량
- OpenAI 대시보드 (https://platform.openai.com/usage)에서 API 사용량 및 비용 확인
- 캐시 시스템으로 인해 사용량이 크게 감소해야 함

## 추가 리소스

- [Vercel 공식 문서](https://vercel.com/docs)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [OpenAI API 문서](https://platform.openai.com/docs)

## 연락처

문제 발생 시 개발팀에 문의하세요.
