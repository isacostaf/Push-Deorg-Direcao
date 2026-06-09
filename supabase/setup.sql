-- Cole isso no Supabase: SQL Editor → New query → Run

create table app_stats (
  id int primary key default 1,
  last_upload timestamptz,
  last_export timestamptz,
  constraint app_stats_single_row check (id = 1)
);

insert into app_stats (id) values (1);

alter table app_stats enable row level security;
