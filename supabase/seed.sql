-- ============================================================
-- QueueFlow – seed.sql (Phase 5)
-- Run this in the Supabase SQL editor AFTER schema.sql & functions.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Departments
-- ─────────────────────────────────────────────
insert into departments (id, name, open_time, close_time, break_start, break_end, slot_minutes, max_per_slot)
values
  ('11111111-1111-1111-1111-111111111111', 'Student Affairs', '09:00', '17:00', '13:00', '14:00', 30, 6),
  ('22222222-2222-2222-2222-222222222222', 'Examination',     '09:00', '17:00', '13:00', '14:00', 30, 6),
  ('33333333-3333-3333-3333-333333333333', 'Accounts',        '09:00', '17:00', '13:00', '14:00', 30, 6)
on conflict (id) do update set
  open_time = excluded.open_time,
  close_time = excluded.close_time,
  break_start = excluded.break_start,
  break_end = excluded.break_end,
  slot_minutes = excluded.slot_minutes,
  max_per_slot = excluded.max_per_slot;

-- ─────────────────────────────────────────────
-- 2. Services
-- ─────────────────────────────────────────────
insert into services (id, department_id, name, prefix, avg_duration, priority_level, active)
values
  -- Student Affairs (A, B, C)
  ('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Document Verification',    'A', 5,  0, true),
  ('aaaa0001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Certificate Issuance',     'B', 10, 0, true),
  ('aaaa0001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'New Registration',         'C', 20, 1, true),
  -- Examination (D, E)
  ('aaaa0002-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Exam Form Submission',     'D', 10, 0, true),
  ('aaaa0002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Result Verification',       'E', 5,  0, true),
  -- Accounts (F, G, H)
  ('aaaa0003-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Fee Payment',              'F', 5,  0, true),
  ('aaaa0003-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Scholarship Queries',      'G', 10, 0, true),
  ('aaaa0003-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Fee Refund Processing',   'H', 20, 1, true)
on conflict (id) do update set
  name = excluded.name,
  prefix = excluded.prefix,
  avg_duration = excluded.avg_duration,
  priority_level = excluded.priority_level,
  active = excluded.active;

-- ─────────────────────────────────────────────
-- 3. Department Rules
-- ─────────────────────────────────────────────
insert into rules (department_id, max_appts_per_user_day, max_active_tokens, cancel_limit, late_checkin_minutes, early_checkin_minutes)
values
  ('11111111-1111-1111-1111-111111111111', 2, 1, 3, 10, 10),
  ('22222222-2222-2222-2222-222222222222', 2, 1, 3, 10, 10),
  ('33333333-3333-3333-3333-333333333333', 2, 1, 3, 10, 10)
on conflict (department_id) do update set
  max_appts_per_user_day = excluded.max_appts_per_user_day,
  max_active_tokens = excluded.max_active_tokens,
  cancel_limit = excluded.cancel_limit,
  late_checkin_minutes = excluded.late_checkin_minutes,
  early_checkin_minutes = excluded.early_checkin_minutes;

-- ─────────────────────────────────────────────
-- 4. Counters
-- ─────────────────────────────────────────────
insert into counters (id, department_id, name, service_id, status)
values
  ('1b708382-9dc9-486f-8531-099c303135a4', '11111111-1111-1111-1111-111111111111', 'Counter 1 – Doc Verification', 'aaaa0001-0000-0000-0000-000000000001', 'closed'),
  ('658a5c20-9d2b-4c74-a305-ad1f3921b397', '11111111-1111-1111-1111-111111111111', 'Counter 2 – Registration',     'aaaa0001-0000-0000-0000-000000000003', 'closed'),
  ('c2f79401-514d-4d92-8901-90b50cc1cb10', '22222222-2222-2222-2222-222222222222', 'Counter 3 – Exam Forms',       'aaaa0002-0000-0000-0000-000000000001', 'closed'),
  ('ec643474-162d-44a1-8364-55899600ae26', '33333333-3333-3333-3333-333333333333', 'Counter 4 – Fee Payment',      'aaaa0003-0000-0000-0000-000000000001', 'closed'),
  ('45208938-820c-482d-a834-4ccb5059e969', '33333333-3333-3333-3333-333333333333', 'Counter 5 – General Accounts', null,                                   'closed')
on conflict (id) do update set
  name = excluded.name,
  service_id = excluded.service_id;

-- ─────────────────────────────────────────────
-- 5. 14 Days Historical Simulation
-- Peak hours: 11:00 to 13:00
-- Mondays & Tuesdays: Higher volume
-- Distribution: ~82% completed, ~10% missed, ~8% cancelled/skipped
-- ─────────────────────────────────────────────
do $$
declare
  v_day_offset int;
  v_curr_date date;
  v_dow int;
  v_base_count int;
  v_token_idx int;
  v_service record;
  v_cust_id uuid;
  v_cust_ids uuid[] := array[
    'c9e0a27a-d353-4157-b867-75cfaf1de7dc'::uuid,
    '735b5d25-00c3-4c5b-b003-5665761c7c08'::uuid
  ];
  v_counter_map jsonb := '{
    "aaaa0001-0000-0000-0000-000000000001": "1b708382-9dc9-486f-8531-099c303135a4",
    "aaaa0001-0000-0000-0000-000000000002": "1b708382-9dc9-486f-8531-099c303135a4",
    "aaaa0001-0000-0000-0000-000000000003": "658a5c20-9d2b-4c74-a305-ad1f3921b397",
    "aaaa0002-0000-0000-0000-000000000001": "c2f79401-514d-4d92-8901-90b50cc1cb10",
    "aaaa0002-0000-0000-0000-000000000002": "c2f79401-514d-4d92-8901-90b50cc1cb10",
    "aaaa0003-0000-0000-0000-000000000001": "ec643474-162d-44a1-8364-55899600ae26",
    "aaaa0003-0000-0000-0000-000000000002": "ec643474-162d-44a1-8364-55899600ae26",
    "aaaa0003-0000-0000-0000-000000000003": "45208938-820c-482d-a834-4ccb5059e969"
  }'::jsonb;
  v_counter_id uuid;
  v_hour int;
  v_minute int;
  v_created_at timestamptz;
  v_called_at timestamptz;
  v_started_at timestamptz;
  v_completed_at timestamptz;
  v_service_duration int;
  v_rand float;
  v_status text;
  v_appt_status text;
  v_has_appt boolean;
  v_appt_id uuid;
  v_ref_no text;
  v_start_time time;
  v_end_time time;
  v_token_num text;
  v_seq int;
begin
  for v_day_offset in 1..14 loop
    v_curr_date := current_date - v_day_offset;
    v_dow := extract(dow from v_curr_date);

    if v_dow = 0 then
      continue;
    end if;

    if v_dow in (1, 2) then
      v_base_count := 35;
    elsif v_dow = 6 then
      v_base_count := 18;
    else
      v_base_count := 26;
    end if;

    v_seq := 1;

    for v_token_idx in 1..v_base_count loop
      select * into v_service
      from services
      order by random()
      limit 1;

      v_counter_id := (v_counter_map->>v_service.id::text)::uuid;
      v_cust_id := v_cust_ids[1 + floor(random() * 2)::int];

      v_rand := random();
      if v_rand < 0.45 then
        v_hour := 11 + floor(random() * 2)::int;
      elsif v_rand < 0.75 then
        v_hour := 9 + floor(random() * 2)::int;
      else
        v_hour := 14 + floor(random() * 3)::int;
      end if;

      v_minute := floor(random() * 60)::int;
      v_created_at := (v_curr_date || ' ' || lpad(v_hour::text, 2, '0') || ':' || lpad(v_minute::text, 2, '0') || ':00')::timestamptz;

      v_rand := random();
      if v_rand < 0.82 then
        v_status := 'completed';
        v_appt_status := 'completed';
      elsif v_rand < 0.92 then
        v_status := 'missed';
        v_appt_status := 'missed';
      else
        v_status := 'skipped';
        v_appt_status := 'cancelled';
      end if;

      v_service_duration := greatest(2, round(v_service.avg_duration * (0.8 + random() * 0.5))::int);
      v_called_at := v_created_at + ((floor(random() * 12) + 4) || ' minutes')::interval;
      v_started_at := v_called_at + '30 seconds'::interval;
      v_completed_at := v_started_at + (v_service_duration || ' minutes')::interval;

      v_has_appt := (random() < 0.40);
      v_appt_id := null;

      if v_has_appt then
        v_ref_no := 'APT-' || upper(substr(md5(random()::text || v_seq::text), 1, 6));
        v_start_time := (lpad(v_hour::text, 2, '0') || ':' || lpad((floor(v_minute / 30) * 30)::text, 2, '0') || ':00')::time;
        v_end_time := v_start_time + (v_service.avg_duration || ' minutes')::interval;

        insert into appointments (
          user_id,
          service_id,
          appointment_date,
          start_time,
          end_time,
          status,
          check_in_time,
          ref_no,
          no_show_risk,
          created_at
        ) values (
          v_cust_id,
          v_service.id,
          v_curr_date,
          v_start_time,
          v_end_time,
          v_appt_status,
          case when v_status <> 'missed' then v_created_at else null end,
          v_ref_no,
          round((0.10 + random() * 0.35)::numeric, 2),
          v_created_at - interval '2 days'
        )
        returning id into v_appt_id;
      end if;

      v_token_num := v_service.prefix || '-' || lpad(v_seq::text, 3, '0');

      insert into tokens (
        token_number,
        user_id,
        service_id,
        appointment_id,
        counter_id,
        status,
        queue_position,
        estimated_wait,
        recall_count,
        created_at,
        called_at,
        started_at,
        completed_at
      ) values (
        v_token_num,
        v_cust_id,
        v_service.id,
        v_appt_id,
        v_counter_id,
        v_status,
        v_token_idx,
        floor(random() * 20 + 5)::int,
        case when random() < 0.15 then 1 else 0 end,
        v_created_at,
        case when v_status in ('completed', 'skipped') then v_called_at else null end,
        case when v_status = 'completed' then v_started_at else null end,
        case when v_status = 'completed' then v_completed_at else null end
      );

      insert into activity_logs (actor, action, entity, entity_id, created_at)
      values (
        'f5babb19-718b-4009-ad11-3add12a9d116'::uuid,
        v_status || '_token',
        'token',
        gen_random_uuid(),
        v_created_at
      );

      v_seq := v_seq + 1;
    end loop;
  end loop;
end $$;
