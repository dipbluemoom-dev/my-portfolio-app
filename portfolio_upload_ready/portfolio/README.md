# 오준석 포트폴리오

Figma Make 기반 금융 대시보드 포트폴리오.  
원본 Figma 파일: https://www.figma.com/design/raxw4qfhG10fP7ywtIm3cg/

---

## 로컬 개발

```bash
npm i          # 의존성 설치
npm run dev    # 개발 서버 시작 (http://localhost:5173)
npm run build  # 프로덕션 빌드 → dist/
```

---

## Vercel 배포

| 항목 | 값 |
|---|---|
| Framework Preset | **Vite** |
| Root Directory | 이 앱 폴더 (예: `portfolio_upload_ready` 또는 `.`) |
| Build Command | `npm run build` |
| Output Directory | `dist` |

> **404 발생 시 체크리스트**
> 1. Root Directory가 실제 앱 폴더를 가리키는지 확인
> 2. Vercel 빌드 로그에서 오류 확인
> 3. Settings 변경 후 반드시 **Redeploy** 실행

---

## (선택) 클라우드 동기화 설정 — Supabase

기본값은 **브라우저 localStorage** 저장입니다.  
회사·집·휴대폰에서 동일 데이터를 보려면 Supabase(무료)를 연결하세요.

### 1) Supabase 테이블 생성

Supabase 대시보드 → SQL Editor에서 실행:

```sql
create table if not exists public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "Users can read own state"
  on public.user_state for select using (auth.uid() = user_id);

create policy "Users can insert own state"
  on public.user_state for insert with check (auth.uid() = user_id);

create policy "Users can update own state"
  on public.user_state for update using (auth.uid() = user_id);
```

### 2) Vercel 환경 변수 추가

Vercel → Settings → Environment Variables:

| 변수명 | 값 위치 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |

### 3) 사용 방법

사이트 상단 **동기화** 영역에서 이메일 입력 → 로그인 링크 수신  
같은 이메일로 로그인하면 기기 간 데이터 동기화됩니다.

---

## 적용된 안전 수정 내역

| 파일 | 수정 내용 |
|---|---|
| `vercel.json` | SPA 새로고침 404 방지 rewrite 추가 |
| `index.html` | `lang="ko"`, description/theme-color 메타 추가 |
| `vite.config.ts` | `@radix-ui` 청크 분리 추가 |
| `StockPortfolio.tsx` | `totalPortfolioBuyCostKRW` 의존성 오타 수정, `structuredClone` 타입 안전화 |
| `MonthlyBudget.tsx` | localStorage `JSON.parse`를 안전 파서로 교체 |
| `CloudSyncPanel.tsx` | `pullOnce / pushOnce / manualSave`를 `useCallback`으로 감싸 interval 클로저 안정화 |
| `useSupabaseSession.ts` | session 전체 대신 user만 상태로 유지하도록 단순화 |

---

## 라이선스 및 저작권

- UI 컴포넌트: [shadcn/ui](https://ui.shadcn.com/) — [MIT License](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)
- 이미지: [Unsplash](https://unsplash.com) — [Unsplash License](https://unsplash.com/license)
