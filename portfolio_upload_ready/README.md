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

## V3 — 섹터 편집·메이슨리 레이아웃 (2026-06)

| # | 변경 내용 |
|---|---|
| 1 | 섹터 카드 여백 축소 — 행 높이·아이콘·금액 칸 컴팩트화 (좁은 컬럼에 맞게) |
| 2 | 지출관리 **메이슨리 3컬럼**(md 2 / xl 3), 주식 탭도 가로형 — 환율+공통 현재가 1:2 배치, 수익률 차트와 손익 추이 그래프 2컬럼 |
| 3 | 그리드 → **CSS 메이슨리(columns)** 전환: 카드 높이가 달라도 빈 공간 없이 위에서부터 채워짐 |
| 4 | **섹터 추가/삭제/이름 변경/순서 이동(↑↓)/수입·지출 전환** 기능 — 상단 '섹터 추가' 버튼, 각 섹터 카드의 관리 툴바. 데이터는 동적 `categories` 구조로 자동 마이그레이션되며, 기존 4개 섹터(고정비/생활비/계좌지출/추가소득)는 그대로 유지. 구버전 필드도 함께 저장해 V2 이하로 롤백해도 데이터 호환 |
| 5 | **손익 추이 그래프** 추가 — 월별 실현손익을 계좌별 점선 + 전체 합계 실선으로 표시 (종목별 수익률 차트 옆) |

---

## V2 — 레이아웃·기능 개선 (2026-06)

| # | 변경 내용 |
|---|---|
| 1 | 지출관리 세로 단일 컬럼 → **가로 2컬럼 그리드** (와이드 화면 공간 활용) |
| 2 | 전체 팔레트 **웜톤 보정** (크림 배경, 웜 그레이 보더/텍스트) |
| 3 | 월 선택 바 **전폭 12등분** (우측 여백 제거) |
| 4 | 월별 매도 현황 **계좌별 카드 + 전체 합계 카드 분리** (연간 합계 표시 포함) |
| 5 | 종목별 수익률 차트 **중앙 0% 축 기준 분기형** (− 좌측 / + 우측) |
| 6 | 현금 보유량 **자동 계산 토글** 추가 — 자동 ON 시 `순입금액 − 보유원가 + 실현손익`으로 계산 (계좌별 설정, USD는 현재 환율 환산, 매수·매도 기록이 정확해야 함). 수동 모드에서도 참고용 계산값 표시 |
| 7 | 입력칸 디자인 업그레이드 (숫자칸 자동 우측정렬·고정폭, 웜 포커스 링, 호버/읽기전용 상태) |
| 8 | 입력 버그 수정 — **소수점 입력(예: 25.01) 중 끝자리 0이 지워지던 문제, 한글 입력 조합이 끊기던 문제** (입력 중에는 외부 상태가 화면 값을 덮어쓰지 않도록 변경) |

데이터 호환: 기존 localStorage/Supabase 데이터 그대로 사용. 신규 필드는 `autoCash`(계좌별, 기본 false) 하나뿐이며 없으면 자동 보정됨.

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
