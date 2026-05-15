create or replace function update_updated_at_column()
returns trigger as $$
begin
   new.updated_at = now();
   return new;
end;
$$ language plpgsql;

drop trigger if exists update_characters_updated_at on public.characters;

create trigger update_characters_updated_at
before update on public.characters
for each row
execute function update_updated_at_column();

create table public.characters (
  id uuid primary key default gen_random_uuid(),

  -- Informações principais
  name text not null,
  level integer default 1,
  classe text default '',
  ego text default '',
  dt integer default 15,
  money integer default 0,
  movement integer default 0,

  -- Vida e estresse
  hp integer default 0,
  hp_max integer default 0,

  stress integer default 100,
  stress_max integer default 100,

  -- Atributos
  agl integer default 1,
  car integer default 1,
  forca integer default 1,
  intt integer default 1,
  pre integer default 1,
  vig integer default 1,

  -- Resistências
  reflex integer default 0,
  fort integer default 0,
  vont integer default 0,

  -- Dados complexos
  skills jsonb default '[]'::jsonb,
  expert_skills jsonb default '[]'::jsonb,
  powers jsonb default '[]'::jsonb,
  inventory jsonb default '[]'::jsonb,

  -- Informações extras
  notes text default '',

  -- Aparência
  avatar_url text default '',
  theme_color text default '#8b5cf6',

  -- Controle
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Supabase: tabela session_state
CREATE TABLE session_state (
  id text PRIMARY KEY DEFAULT 'global',
  mode text DEFAULT 'exploration', -- exploration | social | combat | downtime
  updated_at timestamptz DEFAULT now()
);

alter table public.session_state
add column if not exists state jsonb not null default '{}'::jsonb,
add column if not exists log_cleared_at timestamptz;
insert into public.session_state (id, mode, state)
values ('global', 'exploration', '{}'::jsonb)
on conflict (id) do nothing;