create table if not exists public.pillars (
  id text primary key,
  title text not null,
  color text not null,
  active_focus text not null default '',
  dos jsonb not null default '[]'::jsonb,
  donts jsonb not null default '[]'::jsonb,
  quality_standard text not null default '',
  later jsonb not null default '[]'::jsonb,
  sort_order int not null,
  updated_at timestamptz not null default now()
);

create index if not exists pillars_sort_order_idx on public.pillars (sort_order);
