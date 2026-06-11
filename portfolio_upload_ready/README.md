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

## V1 — 디자인 전면 개편 (2026-06)

콘셉트: **퍼스널 레저(개인 장부)** — 화이트 서피스 + 헤어라인 보더, 차콜 잉크, 고정폭 숫자.
**데이터(localStorage 키·구조)와 계산/동기화 로직은 변경 없음.**

| 파일 | 변경 내용 |
|---|---|
| `index.html` | Pretendard 폰트 추가 |
| `src/styles/index.css` | 테마 토큰 전면 교체 (수입=그린 / 지출=브릭 / 주식 수익=빨강 / 손실=파랑), `tnum`·`eyebrow` 유틸 추가 |
| `src/app/components/ui/index.tsx` | 버튼·카드·인풋 리스타일, 탭을 언더라인 내비게이션으로 변경 |
| `src/app/App.tsx` | 상단 헤더 바 신설, 동기화 패널 슬림화(상태 표시등), 월 선택 세그먼트 컨트롤 |
| `src/app/components/MonthlyBudget.tsx` | 장부 스타일 행 디자인, **지출 구성 가로 바 차트 추가** |
| `src/app/components/StockPortfolio.tsx` | 새 토큰 적용, 파이차트 팔레트 교체, **종목별 수익률(%) 가로 바 차트 추가** (전 계좌 티커 합산, 매수원가 대비) |

### 기능 정리 (V1 이전 반영분)
- 주식 일정표 / 통장 / 자산 추이 탭 제거 → 지출관리 / 주식 2탭 체제
- `cloudSync.ts` SYNC_KEYS 정리 (stockPortfolio + monthlyBudget_1~12)
- 제거된 기능의 클라우드 데이터는 삭제되지 않고 보존됨 (복원 시 재사용 가능)

---

## 라이선스 및 저작권

- UI 컴포넌트: [shadcn/ui](https://ui.shadcn.com/) — [MIT License](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)
- 이미지: [Unsplash](https://unsplash.com) — [Unsplash License](https://unsplash.com/license)
