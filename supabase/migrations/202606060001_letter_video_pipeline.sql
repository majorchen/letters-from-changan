alter table public.video_assets
  add column if not exists video_id text;

alter table public.video_assets
  drop constraint if exists video_assets_type_check;

alter table public.video_assets
  add constraint video_assets_type_check
  check (type in ('letter', 'memory', 'glitch', 'ending'));

create index if not exists video_assets_video_id_idx
  on public.video_assets(video_id)
  where video_id is not null;
