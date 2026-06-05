create table if not exists public.journeys (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  role text not null,
  state jsonb not null,
  messages jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  schema_version int not null default 1
);

alter table public.journeys enable row level security;

drop policy if exists "Users can read own journeys" on public.journeys;
create policy "Users can read own journeys"
  on public.journeys for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own journeys" on public.journeys;
create policy "Users can insert own journeys"
  on public.journeys for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own journeys" on public.journeys;
create policy "Users can update own journeys"
  on public.journeys for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own journeys" on public.journeys;
create policy "Users can delete own journeys"
  on public.journeys for delete
  using (auth.uid() = user_id);

create table if not exists public.video_assets (
  key text primary key,
  type text not null check (type in ('memory', 'glitch', 'ending')),
  status text not null check (status in ('queued', 'ready', 'failed')),
  prompt text not null,
  task_id text,
  source_url text,
  storage_path text,
  public_url text,
  segment_index int not null default 0,
  created_at bigint not null,
  updated_at bigint not null
);

alter table public.video_assets enable row level security;

drop policy if exists "Anyone can read ready video assets" on public.video_assets;
create policy "Anyone can read ready video assets"
  on public.video_assets for select
  using (status = 'ready');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-videos',
  'story-videos',
  true,
  52428800,
  array['video/mp4', 'video/webm', 'video/quicktime']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read story videos" on storage.objects;
create policy "Public can read story videos"
  on storage.objects for select
  using (bucket_id = 'story-videos');
