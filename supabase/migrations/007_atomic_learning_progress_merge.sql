-- Atomically merge learning progress from multiple signed-in devices.
-- All functions are SECURITY INVOKER; existing per-user RLS policies remain in force.

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

create or replace function public.merge_learning_progress_payload(p_current jsonb, p_incoming jsonb)
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
  v_incoming_date text;
  v_current_date text;
  v_count_current integer := 0;
  v_count_incoming integer := 0;
begin
  select jsonb_build_object(
    'version', 1,
    'knownWords', public.merge_learning_string_arrays(v_current->'knownWords', v_incoming->'knownWords'),
    'favoriteWordIds', public.merge_learning_string_arrays(v_current->'favoriteWordIds', v_incoming->'favoriteWordIds'),
    'activityDays', public.merge_learning_string_arrays(v_current->'activityDays', v_incoming->'activityDays'),
    'completedLessonIds', public.merge_learning_string_arrays(v_current->'completedLessonIds', v_incoming->'completedLessonIds')
  ) into v_result;

  -- Keep the newest 50 distinct exam attempts.
  select coalesce(jsonb_agg(value order by value->>'date' desc), '[]'::jsonb)
    into v_exam_history
  from (
    select value
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
        value->>'system', value->>'level', value->>'score', value->>'total', value->>'date'
    ) as unique_attempts
    order by value->>'date' desc
    limit 50
  ) as latest_attempts;

  -- Merge each flashcard's latest review state.
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

  -- Merge daily tasks with OR when both devices refer to the same local date.
  v_tasks_current := case when jsonb_typeof(v_current->'dailyTasks') = 'object' then v_current->'dailyTasks' else '{}'::jsonb end;
  v_tasks_incoming := case when jsonb_typeof(v_incoming->'dailyTasks') = 'object' then v_incoming->'dailyTasks' else '{}'::jsonb end;
  v_current_date := coalesce(v_tasks_current->>'date', '');
  v_incoming_date := coalesce(v_tasks_incoming->>'date', '');

  if v_current_date = v_incoming_date and v_current_date <> '' then
    v_tasks := jsonb_build_object(
      'date', v_current_date,
      'done', jsonb_build_array(
        (coalesce(v_tasks_current->'done'->>0 = 'true', false) or coalesce(v_tasks_incoming->'done'->>0 = 'true', false)),
        (coalesce(v_tasks_current->'done'->>1 = 'true', false) or coalesce(v_tasks_incoming->'done'->>1 = 'true', false)),
        (coalesce(v_tasks_current->'done'->>2 = 'true', false) or coalesce(v_tasks_incoming->'done'->>2 = 'true', false))
      )
    );
  elsif v_incoming_date >= v_current_date then
    v_tasks := v_tasks_incoming;
  else
    v_tasks := v_tasks_current;
  end if;

  -- Keep the larger same-day review count so concurrent devices do not roll it back.
  v_daily_review := case when jsonb_typeof(v_current->'dailyReviewCount') = 'object' then v_current->'dailyReviewCount' else '{}'::jsonb end;
  v_incoming_date := coalesce(v_incoming->'dailyReviewCount'->>'date', '');
  if v_incoming_date <> '' and v_incoming_date = v_daily_review->>'date' then
    v_count_current := greatest(case when jsonb_typeof(v_daily_review->'count') = 'number' then (v_daily_review->>'count')::integer else 0 end, 0);
    v_count_incoming := greatest(case when jsonb_typeof(v_incoming->'dailyReviewCount'->'count') = 'number' then (v_incoming->'dailyReviewCount'->>'count')::integer else 0 end, 0);
    v_daily_review := jsonb_build_object('date', v_incoming_date, 'count', greatest(v_count_current, v_count_incoming));
  elsif v_incoming_date >= coalesce(v_daily_review->>'date', '') then
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
