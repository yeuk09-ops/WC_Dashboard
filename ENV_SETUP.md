# 환경 변수 설정 가이드

## 개발 환경 (.env.local)

개발환경에서는 AI 분석 기능과 관리자 페이지를 사용할 수 있습니다.

```env
# 환경 설정
NODE_ENV=development

# OpenAI API (필수)
OPENAI_API_KEY=sk-your-api-key-here

# Mock 데이터 사용
USE_MOCK_DATA=true

# 매출원가율
COGS_RATE=0.60

# 관리자 페이지 활성화
NEXT_PUBLIC_ENABLE_ADMIN=true

# AI 분석 활성화
NEXT_PUBLIC_ENABLE_AI=true
```

## 프로덕션 환경 (Vercel)

프로덕션에서는 개발환경에서 생성된 AI 캐시 파일을 사용합니다.

```env
# 환경 설정
NODE_ENV=production

# Mock 데이터 사용
USE_MOCK_DATA=true

# 매출원가율
COGS_RATE=0.60

# 관리자 페이지 비활성화
NEXT_PUBLIC_ENABLE_ADMIN=false

# AI 분석 비활성화 (정적 캐시만 사용)
NEXT_PUBLIC_ENABLE_AI=false

# OpenAI API 키는 설정하지 않음
```

## 배포 워크플로우

1. **개발환경에서 작업**
   ```bash
   # AI 분석 실행
   npm run dev
   # 관리자 페이지에서 데이터 업로드
   # 각 탭에서 AI 분석 버튼 클릭
   # ai-cache/*.json 파일 생성 확인
   ```

2. **Git 커밋**
   ```bash
   git add ai-cache/
   git commit -m "data: AI 분석 결과 업데이트"
   git push origin main
   ```

3. **Vercel 자동 배포**
   - Vercel 환경 변수에 프로덕션 설정 적용
   - ai-cache/ 폴더의 정적 파일 사용
   - AI API 호출 없음 (비용 절감)
