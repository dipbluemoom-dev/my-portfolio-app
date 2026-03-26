적용한 안전 수정 요약

1. vercel.json
- SPA 새로고침 404 방지 rewrite 추가

2. index.html
- lang="ko" 적용
- description / theme-color 메타 추가
- favicon은 실제 파일이 없어서 추가하지 않음

3. vite.config.ts
- @radix-ui 청크 분리 추가

4. src/app/components/StockPortfolio.tsx
- totalPortfolioBuyCostKRW 의존성 오타 수정
- structuredClone 사용부를 타입 안전하게 수정

5. src/app/components/MonthlyBudget.tsx
- localStorage JSON.parse를 안전 파서로 교체

6. src/app/components/CloudSyncPanel.tsx
- pullOnce / pushOnce / manualSave를 useCallback으로 감싸 interval 클로저 안정화

7. src/app/hooks/useSupabaseSession.ts
- session 전체 대신 user만 상태로 유지하도록 단순화

보류한 항목
- package.json 대규모 의존성 제거: 현재 앱 기준 일부는 미사용처럼 보이지만, ui 컴포넌트 파일들이 해당 패키지들을 참조하고 있어 일괄 삭제는 보류
- index.html favicon 추가: 실제 favicon 파일이 없어 보류
