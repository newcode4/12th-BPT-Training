-- 스크랩 / 유튜브 링크 등 "기기가 달라도 같이 보여야 하는" 데이터 저장소
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 한 번만 실행하면 됩니다.
--
-- 녹음/영상 원본 파일은 여기에 올리지 않습니다. 파일은 각자 기기(IndexedDB)에만 남습니다.

create table if not exists public.records (
  id          uuid primary key,
  kind        text not null,          -- analysis | ref_scrap | admin_video | admin_folder
  author      text,
  week        text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists records_kind_idx on public.records (kind);
create index if not exists records_kind_week_idx on public.records (kind, week);

alter table public.records enable row level security;

-- 교육생용 앱이라 익명 키로 모두 읽고 쓸 수 있게 둔다 (questions/answers 와 동일한 정책)
drop policy if exists "records select" on public.records;
drop policy if exists "records insert" on public.records;
drop policy if exists "records update" on public.records;
drop policy if exists "records delete" on public.records;

create policy "records select" on public.records for select using (true);
create policy "records insert" on public.records for insert with check (true);
create policy "records update" on public.records for update using (true) with check (true);
create policy "records delete" on public.records for delete using (true);

-- 로그인 세션 (PC/모바일처럼 한 사람이 동시에 여러 기기에서 접속할 수 있게)
-- 관리자가 허용 대수(1~2대)를 바꿀 수 있고, 그 설정은 records(kind='setting')에 저장한다.
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  token       uuid not null,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create index if not exists sessions_name_idx on public.sessions (name);

alter table public.sessions enable row level security;

drop policy if exists "sessions select" on public.sessions;
drop policy if exists "sessions insert" on public.sessions;
drop policy if exists "sessions update" on public.sessions;
drop policy if exists "sessions delete" on public.sessions;

create policy "sessions select" on public.sessions for select using (true);
create policy "sessions insert" on public.sessions for insert with check (true);
create policy "sessions update" on public.sessions for update using (true) with check (true);
create policy "sessions delete" on public.sessions for delete using (true);
