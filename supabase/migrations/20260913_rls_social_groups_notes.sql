-- Enable row level security on the tables the backend creates at runtime
-- (database.py / note_store.py `metadata.create_all`) that the earlier
-- migrations never covered. Without RLS these sit in the `public` schema and
-- PostgREST serves them to anyone holding the public anon key.
--
-- Pattern, matching the existing migrations:
--   * RLS on, no anon policies. The backend connects through DATABASE_URL as
--     the table owner and is unaffected by any of this.
--   * profiles, friendships, friend_quests and progress_claims have RLS on and
--     no policies at all, so direct API access to them is denied outright.
--   * study_notes is the one table with a policy, scoped by auth.uid().
--
-- The policies below follow the study_notes form and are SELECT-only: a signed-in
-- user can read rows that are theirs and nothing else. Every write stays
-- backend-only, because each of these tables is written through checks that
-- direct API access would skip (XP awards, rate limits, group size limits,
-- block rules). A user who could INSERT into xp_events could put themselves at
-- the top of every leaderboard and group goal.
--
-- Student IDs are varchar in the backend's tables and uuid in auth, so every
-- comparison casts both sides to text. study_notes.student_id is uuid when this
-- repo's note_ingestion migration created the table and varchar when the backend
-- did, and the cast handles either.
--
-- Each table is guarded by to_regclass because the backend may not have created
-- it yet. Re-running this file is safe.

do $$
begin
  -- Rate-limit ledger. Users may see their own entries.
  if to_regclass('public.social_action_events') is not null then
    alter table public.social_action_events enable row level security;
    drop policy if exists "Students read own social action events" on public.social_action_events;
    create policy "Students read own social action events" on public.social_action_events
      for select to authenticated using (auth.uid()::text = student_id::text);
  end if;

  -- Only the blocker sees a block. The blocked person must not learn about it.
  if to_regclass('public.social_blocks') is not null then
    alter table public.social_blocks enable row level security;
    drop policy if exists "Students read blocks they created" on public.social_blocks;
    create policy "Students read blocks they created" on public.social_blocks
      for select to authenticated using (auth.uid()::text = blocker_id::text);
  end if;

  if to_regclass('public.social_notifications') is not null then
    alter table public.social_notifications enable row level security;
    drop policy if exists "Students read own notifications" on public.social_notifications;
    create policy "Students read own notifications" on public.social_notifications
      for select to authenticated using (auth.uid()::text = recipient_id::text);
  end if;

  if to_regclass('public.social_reactions') is not null then
    alter table public.social_reactions enable row level security;
    drop policy if exists "Students read own reactions" on public.social_reactions;
    create policy "Students read own reactions" on public.social_reactions
      for select to authenticated using (auth.uid()::text = reactor_id::text);
  end if;

  -- Only the reporter sees a report. The reported person must not see it.
  if to_regclass('public.social_reports') is not null then
    alter table public.social_reports enable row level security;
    drop policy if exists "Students read reports they filed" on public.social_reports;
    create policy "Students read reports they filed" on public.social_reports
      for select to authenticated using (auth.uid()::text = reporter_id::text);
  end if;

  -- A member sees their own membership rows. Seeing the other members of a group
  -- would need this policy to query its own table, which Postgres rejects as
  -- infinite recursion. The backend already serves member lists.
  if to_regclass('public.study_group_members') is not null then
    alter table public.study_group_members enable row level security;
    drop policy if exists "Students read own group memberships" on public.study_group_members;
    create policy "Students read own group memberships" on public.study_group_members
      for select to authenticated using (auth.uid()::text = student_id::text);
  end if;

  -- A group is visible to its owner and its members. The membership lookup is
  -- itself filtered by the policy above, which only allows own rows, so this
  -- matches only groups the caller belongs to.
  if to_regclass('public.study_groups') is not null then
    alter table public.study_groups enable row level security;
    drop policy if exists "Members read their study groups" on public.study_groups;
    if to_regclass('public.study_group_members') is not null then
      create policy "Members read their study groups" on public.study_groups
        for select to authenticated using (
          auth.uid()::text = owner_id::text
          or exists (
            select 1 from public.study_group_members m
            where m.group_id = study_groups.id
              and m.student_id::text = auth.uid()::text
          )
        );
    else
      create policy "Members read their study groups" on public.study_groups
        for select to authenticated using (auth.uid()::text = owner_id::text);
    end if;
  end if;

  -- 20260912_note_ingestion.sql already enables RLS here and adds this policy.
  -- If the backend created the table instead, neither exists yet. The policy is
  -- created only when missing so an existing one is left exactly as it is.
  if to_regclass('public.study_notes') is not null then
    alter table public.study_notes enable row level security;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'study_notes' and policyname = 'Students own study notes'
    ) then
      create policy "Students own study notes" on public.study_notes
        for all using (auth.uid()::text = student_id::text) with check (auth.uid()::text = student_id::text);
    end if;
  end if;

  -- Friends' activity is served by the backend. A friendship-based policy here
  -- would read friendships, which has RLS on and no policies, so it would match
  -- nothing.
  if to_regclass('public.xp_events') is not null then
    alter table public.xp_events enable row level security;
    drop policy if exists "Students read own xp events" on public.xp_events;
    create policy "Students read own xp events" on public.xp_events
      for select to authenticated using (auth.uid()::text = student_id::text);
  end if;
end
$$;
