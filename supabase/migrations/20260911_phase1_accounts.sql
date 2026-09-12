-- Phase 1: account profiles, guest-progress claims, and profile extras.
-- Safe to run on databases that already have the original Bindit tables.

create table if not exists progress_claims (
  guest_id text primary key,
  account_id text not null,
  claimed_at timestamptz not null default timezone('utc', now())
);

create table if not exists profiles (
  student_id text primary key references student_progress(student_id) on delete cascade,
  username varchar(24) not null unique,
  display_name varchar(40) not null,
  avatar_path varchar(500) not null default '',
  friend_code varchar(12) not null unique,
  daily_goal integer not null default 20,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table profiles add column if not exists avatar_path varchar(500) not null default '';
alter table profiles add column if not exists daily_goal integer not null default 20;
alter table profiles add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists progress_claims_account_id_idx on progress_claims (account_id);
create index if not exists profiles_username_idx on profiles (username);

alter table profiles enable row level security;
alter table progress_claims enable row level security;
