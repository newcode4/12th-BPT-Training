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
