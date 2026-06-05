# Account And Cloud Save Plan

Paid features are intentionally deferred. Cloud save can be designed now without coupling it to payment.

## Recommended Direction

Use a simple account provider plus a hosted database:

- Auth: email magic link or OAuth.
- Storage: one `journeys` table keyed by user id and save id.
- Sync model: local-first. The browser remains playable offline; cloud sync uploads and downloads serialized saves.

## Data Contract

Current local save export already has the right shape:

```ts
type CloudJourney = {
  id: string;
  userId: string;
  title: string;
  role: string;
  state: PlayerState;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
};
```

## Supabase Table

Create this table before enabling cloud sync:

```sql
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

create policy "Users can read own journeys"
  on public.journeys for select
  using (auth.uid() = user_id);

create policy "Users can insert own journeys"
  on public.journeys for insert
  with check (auth.uid() = user_id);

create policy "Users can update own journeys"
  on public.journeys for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own journeys"
  on public.journeys for delete
  using (auth.uid() = user_id);
```

Client env vars:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Sync Rules

- Login does not erase local saves.
- On first login, upload local saves that are not present in cloud.
- If the same save id exists on both sides, newer `updatedAt` wins.
- Keep import/export JSON even after cloud save exists. It is useful for support and playtest reports.
- Do not block gameplay when sync fails; surface a small passive status only.

## Decisions Needed From Major

- Auth provider: Supabase, Clerk, Firebase, or custom.
- Whether anonymous guest saves should later attach to an account.
- Whether cross-device sync is required for v1.0 or can wait for v1.x.
- Whether cloud saves need moderation/support tooling.

## Not Doing Yet

- Payment entitlements.
- Server-side narrative memory.
- Social graph or public profiles.
