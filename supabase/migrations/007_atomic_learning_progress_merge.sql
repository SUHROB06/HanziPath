-- Atomically merge learning progress from multiple signed-in devices.
-- All functions are SECURITY INVOKER; the existing per-user RLS policies remain in force.

create or replace function public.merge_learning_progress_payload(
  p_current jsonb,
  p_incoming jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_current jsonb := case when jsonb_typeof(p_current) = 'object' then p_current else '{}'::jsonb end;
  v_incoming jsonb := case when jsonb_typeof(p_incoming) = 'object' then p_incoming else '{}'::jsonb end;
  v_result jsonb;
  v_tasks_current jsonb;
  v_tasks_incoming jsonb;
  v_tasks jsonb;
  v_review_schedule jsonb;
  v_exam_history jsonb;
  v_daily_review jsonb;
  v_today text;
  v_date_current text;
  v_date_incoming text;
  v_count_current integer := 0;
  v_count_incoming integer := 0;
begin
  -- Union append-only learning records so one device cannot erase another device's work.
  select jsonb_build_object(
    'version', 1,
    'knownWords', public.merge_learning_string_arrays(v_current->'knownWords', v_incoming->'knownWords'),
    'favoriteWordIds', public.merge_learning_string_arrays(v_current->'favoriteWordIds', v_incoming->'favoriteWordIds'),
    'activityDays', public.merge_learning_string_arrays(v_current->'activityDays', v_incoming->'activityDays'),
    'completedLessonIds', public.merge_learning_string_arrays(v_current->'completedLessonIds', v_incoming->'completedLessonIds')
  ) into v_result;

  -- Exam history is append-only and bounded to the latest 50 distinct attempts.
  select coalesce(jsonb_agg(value order by value->>'date' desc), '[]'::jsonb)
    into v_exam_history
  from (
    select distinct on (
      value->>'system', value->>'level', value->>'score', value->>'total', value->>'date'
    ) value
    from jsonb_array_elements(
      (case when jsonb_typeof(v_current->'examHistory') = 'array' then v_current->'examHistory' else '[]'::jsonb end)
      ||
      (case when jsonb_typeof(v_incoming->'examHistory') = 'array' then v_incoming->'examHistory' else '[]'::jsonb end)
    ) as attempts(value)
    order by
      value->>'system', value->>'level', value->>'score', value->>'total', value->>'date',
      value->>'date' desc
  ) as unique_attempts
  limit 50;

  -- Per-card schedules merge by updatedAt, keeping the newest rating for each word.
  select coalesce(jsonb_object_agg(merged.key, merged.value), '{}'::jsonb)
    into v_review_schedule
  from (
    select
      coalesce(current_rows.key, incoming_rows.key) as key,
      case
        when current_rows.key is null then incoming_rows.value
        when incoming_rows.key is null then current_rows.value
        when coalesce(current_rows.value->>'updatedAt', '') >= coalesce(incoming_rows.value->>'updatedAt', '')
          then current_rows.value
        else incoming_rows.value
      end as value
    from jsonb_each(
      case when jsonb_typeof(v_current->'reviewSchedule') = 'object' then v_current->'reviewSchedule' else '{}'::jsonb end
    ) as current_rows
    full outer join jsonb_each(
      case when jsonb_typeof(v_incoming->'reviewSchedule') = 'object' then v_incoming->'reviewSchedule' else '{}'::jsonb end
    ) as incoming_rows using (key)
  ) as merged;

  -- Preserve both devices' completed tasks for the same local day.
  v_tasks_current := case when jsonb_typeof(v_current->'dailyTasks') = 'object' then v_current->'dailyTasks' else '{}'::jsonb end;
  v_tasks_incoming := case when jsonb_typeof(v_incoming->'dailyTasks') = 'object' then v_incoming->'dailyTasks' else '{}'::jsonb end;
  v_date_current := coalesce(v_tasks_current->>'date', '');
  v_date_incoming := coalesce(v_tasks_incoming->>'date', '');

  if v_date_current = v_date_incoming and v_date_current <> '' then
    v_tasks := jsonb_build_object(
      'date', v_date_current,
      'done', jsonb_build_array(
        (v_tasks_current->'done'->>0 = 'true' or v_tasks_incoming->'done'->>0 = 'true'),
        (v_tasks_current->'done'->>1 = 'true' or v_tasks_incoming->'done'->>1 = 'true'),
        (v_tasks_current->'done'->>2 = 'true' or v_tasks_incoming->'done'->>2 = 'true')
      )
    );
  elsif v_date_incoming >= v_date_current then
    v_tasks := v_tasks_incoming;
  else
    v_tasks := v_tasks_current;
  end if;

  -- Daily review counts are merged by maximum for the same date.
  v_daily_review := case when jsonb_typeof(v_current->'dailyReviewCount') = 'object' then v_current->'dailyReviewCount' else '{}'::jsonb end;
  v_today := coalesce(v_incoming->'dailyReviewCount'->>'date', '');
  if v_today <> '' and v_today = v_daily_review->>'date' then
    v_count_current := greatest(coalesce((v_daily_review->>'count')::integer, 0), 0);
    v_count_incoming := greatest(coalesce((v_incoming->'dailyReviewCount'->>'count')::integer, 0), 0);
    v_daily_review := jsonb_build_object('date', v_today, 'count', greatest(v_count_current, v_count_incoming));
  elsif v_today >= coalesce(v_daily_review->>'date', '') then
    v_daily_review := coalesce(v_incoming->'dailyReviewCount', v_daily_review);
  end if;

  return v_result || jsonb_build_object(
    'examHistory', v_exam_history,
    'reviewSchedule', v_review_schedule,
    'dailyTasks', v_tasks,
    'dailyReviewCount', v_daily_review,
    'dailyGoalWords', coalesce(v_incoming->'dailyGoalWords', v_current->'dailyGoalWords', '15'::jsonb)
  );
end;
$$;

create or replace function public.merge_learning_string_arrays(p_left jsonb, p_right jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
  from (
    select distinct value
    from jsonb_array_elements(
      (case when jsonb_typeof(p_left) = 'array' then p_left else '[]'::jsonb end)
      ||
      (case when jsonb_typeof(p_right) = 'array' then p_right else '[]'::jsonb end)
    ) as values(value)
    where jsonb_typeof(value) = 'string'
  ) as unique_values;
$$;

create or replace function public.merge_user_learning_progress(p_progress jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_merged jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_progress) <> 'object' then
    raise exception 'Learning progress must be a JSON object';
  end if;

  insert into public.user_learning_progress as stored (user_id, progress, updated_at)
  values (v_user_id, p_progress, now())
  on conflict (user_id) do update
    set progress = public.merge_learning_progress_payload(stored.progress, excluded.progress),
        updated_at = now()
  returning progress into v_merged;

  return v_merged;
end;
$$;

revoke all on function public.merge_learning_string_arrays(jsonb, jsonb) from public, anon;
revoke all on function public.merge_learning_progress_payload(jsonb, jsonb) from public, anon;
revoke all on function public.merge_user_learning_progress(jsonb) from public, anon;
grant execute on function public.merge_learning_string_arrays(jsonb, jsonb) to authenticated;
grant execute on function public.merge_learning_progress_payload(jsonb, jsonb) to authenticated;
grant execute on function public.merge_user_learning_progress(jsonb) to authenticated;
