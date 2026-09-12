create table if not exists study_notes (
  id uuid primary key,
  student_id uuid not null references auth.users(id) on delete cascade,
  course varchar(120) not null,
  unit varchar(160) not null,
  file_name varchar(255) not null,
  content_type varchar(100) not null default '',
  text text not null,
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists study_notes_student_unit_idx
  on study_notes (student_id, course, unit, created_at desc);

alter table study_notes enable row level security;

drop policy if exists "Students own study notes" on study_notes;
create policy "Students own study notes" on study_notes
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);
