
  # 오준석 포트폴리오 (Community)

  This is a code bundle for 오준석 포트폴리오 (Community). The original project is available at https://www.figma.com/design/raxw4qfhG10fP7ywtIm3cg/%EC%98%A4%EC%A4%80%EC%84%9D-%ED%8F%AC%ED%8A%B8%ED%8F%B4%EB%A6%AC%EC%98%A4--Community-.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## (선택) 회사/집/폰 동기화 설정 (Supabase)

이 프로젝트는 기본적으로 **브라우저 localStorage**에 저장합니다.
회사/집/휴대폰에서 같은 값을 보려면 Supabase(무료)를 붙여서 클라우드 동기화를 켤 수 있습니다.

### 1) Supabase에서 테이블 만들기

Supabase 대시보드 → SQL Editor에서 아래를 실행하세요.

```sql
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "Users can read own state"
  on public.user_state for select
  using (auth.uid() = user_id);

create policy "Users can insert own state"
  on public.user_state for insert
  with check (auth.uid() = user_id);

create policy "Users can update own state"
  on public.user_state for update
  using (auth.uid() = user_id);
```

### 2) Vercel(Environment Variables) 설정

Vercel 프로젝트 → Settings → Environment Variables에 아래 2개를 추가하세요.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

값은 Supabase 프로젝트의 **Project Settings → API**에서 확인할 수 있습니다.

### 3) 사용 방법

사이트 상단의 **동기화** 영역에서 이메일을 입력하면 로그인 링크가 발송됩니다.
회사/집/폰에서 같은 이메일로 로그인하면 동일 데이터가 보입니다.

  