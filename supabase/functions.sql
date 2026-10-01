-- ============================================================
-- QueueFlow – functions.sql  (Phase 2: token flow + RLS)
-- Run this in the Supabase SQL editor AFTER schema.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- RLS: enable on all tables
-- ─────────────────────────────────────────────
alter table profiles         enable row level security;
alter table appointments     enable row level security;
alter table tokens           enable row level security;
alter table notifications    enable row level security;
alter table counters         enable row level security;
alter table activity_logs    enable row level security;
alter table departments      enable row level security;
alter table services         enable row level security;
alter table rules            enable row level security;

-- Helper: get the current user's role from profiles
create or replace function current_role_name() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- ─────────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────────

-- profiles
create policy "own profile select"
  on profiles for select
  using (id = auth.uid() or current_role_name() in ('staff','manager','admin'));

create policy "own profile update"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

-- departments (public read)
create policy "read departments"
  on departments for select using (true);

create policy "admin manage departments"
  on departments for all
  using (current_role_name() = 'admin');

-- services (public read)
create policy "read services"
  on services for select using (true);

create policy "manager manage services"
  on services for all
  using (current_role_name() in ('manager','admin'));

-- rules (public read for authenticated)
create policy "read rules"
  on rules for select using (auth.uid() is not null);

create policy "manager manage rules"
  on rules for all
  using (current_role_name() in ('manager','admin'));

-- counters (public read)
create policy "read counters"
  on counters for select using (true);

create policy "manager manage counters"
  on counters for all
  using (current_role_name() in ('manager','admin'));

-- appointments
create policy "own appointments"
  on appointments for select
  using (user_id = auth.uid() or current_role_name() in ('staff','manager','admin'));

-- tokens
create policy "own tokens"
  on tokens for select
  using (user_id = auth.uid() or current_role_name() in ('staff','manager','admin'));

-- notifications (own only)
create policy "own notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "own notifications update"
  on notifications for update
  using (user_id = auth.uid());

-- activity_logs (staff+ can read)
create policy "staff read activity logs"
  on activity_logs for select
  using (current_role_name() in ('staff','manager','admin'));

-- /display: public view for the now-serving board
create or replace view public_display as
  select
    t.token_number,
    c.name as counter_name,
    t.status
  from tokens t
  join counters c on c.id = t.counter_id
  where t.status in ('called','in_service');

grant select on public_display to anon;

-- ─────────────────────────────────────────────
-- GRANT RPC functions to authenticated users
-- (added at the bottom of the file)
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- 6.1  Average service time helper
-- ─────────────────────────────────────────────
create or replace function avg_service_minutes(p_service uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select avg(extract(epoch from (completed_at - started_at))/60)
       from (select completed_at, started_at from tokens
             where service_id = p_service and status='completed'
               and started_at is not null and completed_at is not null
             order by completed_at desc limit 20) t),
    (select avg_duration from services where id = p_service)
  );
$$;

-- ─────────────────────────────────────────────
-- 6.2  Recalculate queue positions + waits
-- ─────────────────────────────────────────────
create or replace function recalc_queue(p_service uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_active int;
  v_avg    numeric;
  v_dept   uuid;
begin
  select department_id into v_dept from services where id = p_service;

  select count(*) into v_active from counters
    where department_id = v_dept
      and status in ('available','busy')
      and (service_id is null or service_id = p_service);

  v_avg := avg_service_minutes(p_service);

  with ordered as (
    select id, row_number() over (
      order by (appointment_id is null), created_at  -- appointments first, then FIFO
    ) as pos
    from tokens
    where service_id = p_service and status in ('waiting','recalled')
  )
  update tokens t
     set queue_position = o.pos,
         estimated_wait = ceil(o.pos::numeric * v_avg / greatest(v_active, 1))::int
    from ordered o where t.id = o.id;
end $$;

-- ─────────────────────────────────────────────
-- 6.3  create_token  (Phase 2 core)
-- ─────────────────────────────────────────────
create or replace function create_token(p_service uuid)
returns setof tokens
language plpgsql security definer set search_path = public as $$
declare
  v_uid         uuid := auth.uid();
  v_rule        rules%rowtype;
  v_service     services%rowtype;
  v_active_count int;
  v_next_num    int;
  v_token_num   text;
  v_token_id    uuid;
begin
  -- Must be authenticated
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Advisory lock to prevent race conditions
  perform pg_advisory_xact_lock(hashtext(p_service::text));

  -- Load service
  select * into v_service from services where id = p_service and active = true;
  if not found then
    raise exception 'Service not found or inactive';
  end if;

  -- Load rule (may not exist if no rules row yet)
  select r.* into v_rule
    from rules r
    join services s on s.department_id = r.department_id
    where s.id = p_service;

  -- Check existing active tokens for this user
  select count(*) into v_active_count
    from tokens
    where user_id = v_uid
      and status in ('waiting','called','recalled','in_service');

  if v_active_count > 0 then
    raise exception 'You already have an active token';
  end if;

  -- Respect max_active_tokens rule (default 1)
  if v_rule.max_active_tokens is not null and v_active_count >= v_rule.max_active_tokens then
    raise exception 'You have reached the maximum number of active tokens';
  end if;

  -- Next token number = count of today's tokens for this service + 1
  select count(*) + 1 into v_next_num
    from tokens
    where service_id = p_service
      and created_at >= current_date::timestamptz
      and created_at < (current_date + 1)::timestamptz;

  v_token_num := v_service.prefix || '-' || lpad(v_next_num::text, 3, '0');

  -- Insert the token
  insert into tokens (token_number, user_id, service_id, status)
  values (v_token_num, v_uid, p_service, 'waiting')
  returning id into v_token_id;

  -- Recalculate queue
  perform recalc_queue(p_service);

  -- Return the full row
  return query select * from tokens where id = v_token_id;
end $$;

grant execute on function create_token(uuid) to authenticated;
grant execute on function recalc_queue(uuid) to authenticated;
grant execute on function avg_service_minutes(uuid) to authenticated;
grant execute on function current_role_name() to authenticated, anon;

-- ─────────────────────────────────────────────
-- Helper: get departments with their services (for the /token page)
-- ─────────────────────────────────────────────
create or replace function get_departments_with_services()
returns table (
  department_id   uuid,
  department_name text,
  service_id      uuid,
  service_name    text,
  prefix          char(1),
  avg_duration    int,
  active          boolean
)
language sql stable security definer set search_path = public as $$
  select
    d.id   as department_id,
    d.name as department_name,
    s.id   as service_id,
    s.name as service_name,
    s.prefix,
    s.avg_duration,
    s.active
  from departments d
  join services s on s.department_id = d.id
  order by d.name, s.name;
$$;

grant execute on function get_departments_with_services() to authenticated, anon;

-- ─────────────────────────────────────────────
-- Helper: mark notification as read
-- ─────────────────────────────────────────────
create or replace function mark_notification_read(p_notification uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update notifications
     set read = true
   where id = p_notification
     and user_id = auth.uid();
end $$;

grant execute on function mark_notification_read(uuid) to authenticated;

-- ============================================================
-- PHASE 3: Staff Workflow Functions
-- ============================================================

-- ─────────────────────────────────────────────
-- Policy for public display board and realtime
-- ─────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'tokens' and policyname = 'public read active tokens for display'
  ) then
    create policy "public read active tokens for display"
      on tokens for select
      using (status in ('waiting', 'called', 'recalled', 'in_service'));
  end if;
end $$;

grant select on table tokens to anon;

-- ─────────────────────────────────────────────
-- call_next_token(p_counter uuid)
-- ─────────────────────────────────────────────
create or replace function call_next_token(p_counter uuid)
returns setof tokens
language plpgsql security definer set search_path = public as $$
declare
  v_counter     counters%rowtype;
  v_token       tokens%rowtype;
  v_active_tok  int;
begin
  if current_role_name() not in ('staff', 'manager', 'admin') then
    raise exception 'Unauthorized: staff role required';
  end if;

  select * into v_counter from counters where id = p_counter for update;
  if not found then
    raise exception 'Counter not found';
  end if;

  if v_counter.current_token is not null then
    select count(*) into v_active_tok
    from tokens
    where id = v_counter.current_token and status in ('called', 'recalled', 'in_service');

    if v_active_tok > 0 then
      raise exception 'Counter already has an active token. Complete or skip it first.';
    end if;
  end if;

  select t.* into v_token
  from tokens t
  join services s on s.id = t.service_id
  where (
    (v_counter.service_id is not null and t.service_id = v_counter.service_id)
    or
    (v_counter.service_id is null and s.department_id = v_counter.department_id)
  )
  and t.status in ('waiting', 'recalled')
  order by
    (t.appointment_id is null) asc,
    s.priority_level desc,
    t.created_at asc
  limit 1
  for update skip locked;

  if v_token.id is null then
    return;
  end if;

  update tokens
     set status = 'called',
         counter_id = p_counter,
         called_at = now()
   where id = v_token.id
   returning * into v_token;

  update counters
     set status = 'busy',
         current_token = v_token.id,
         assigned_staff = coalesce(assigned_staff, auth.uid())
   where id = p_counter;

  if v_token.user_id is not null then
    insert into notifications (user_id, message, type)
    values (
      v_token.user_id,
      'Token ' || v_token.token_number || ': please proceed to ' || v_counter.name,
      'token_called'
    );
  end if;

  insert into activity_logs (actor, action, entity, entity_id)
  values (auth.uid(), 'call_next_token', 'token', v_token.id);

  perform recalc_queue(v_token.service_id);

  return query select * from tokens where id = v_token.id;
end $$;

-- ─────────────────────────────────────────────
-- start_service(p_token uuid)
-- ─────────────────────────────────────────────
create or replace function start_service(p_token uuid)
returns setof tokens
language plpgsql security definer set search_path = public as $$
declare
  v_token tokens%rowtype;
begin
  if current_role_name() not in ('staff', 'manager', 'admin') then
    raise exception 'Unauthorized: staff role required';
  end if;

  select * into v_token from tokens where id = p_token for update;
  if not found then
    raise exception 'Token not found';
  end if;

  if v_token.status not in ('called', 'recalled') then
    raise exception 'Token must be in called or recalled status to start service';
  end if;

  update tokens
     set status = 'in_service',
         started_at = coalesce(started_at, now())
   where id = p_token
   returning * into v_token;

  if v_token.appointment_id is not null then
    update appointments set status = 'in_service' where id = v_token.appointment_id;
  end if;

  insert into activity_logs (actor, action, entity, entity_id)
  values (auth.uid(), 'start_service', 'token', v_token.id);

  return query select * from tokens where id = v_token.id;
end $$;

-- ─────────────────────────────────────────────
-- complete_service(p_token uuid)
-- ─────────────────────────────────────────────
create or replace function complete_service(p_token uuid)
returns setof tokens
language plpgsql security definer set search_path = public as $$
declare
  v_token tokens%rowtype;
begin
  if current_role_name() not in ('staff', 'manager', 'admin') then
    raise exception 'Unauthorized: staff role required';
  end if;

  select * into v_token from tokens where id = p_token for update;
  if not found then
    raise exception 'Token not found';
  end if;

  update tokens
     set status = 'completed',
         completed_at = now()
   where id = p_token
   returning * into v_token;

  if v_token.appointment_id is not null then
    update appointments set status = 'completed' where id = v_token.appointment_id;
  end if;

  update counters
     set status = 'available',
         current_token = null
   where current_token = v_token.id
      or (id = v_token.counter_id and current_token = v_token.id);

  insert into activity_logs (actor, action, entity, entity_id)
  values (auth.uid(), 'complete_service', 'token', v_token.id);

  perform recalc_queue(v_token.service_id);

  return query select * from tokens where id = v_token.id;
end $$;

-- ─────────────────────────────────────────────
-- recall_token(p_token uuid)
-- ─────────────────────────────────────────────
create or replace function recall_token(p_token uuid)
returns setof tokens
language plpgsql security definer set search_path = public as $$
declare
  v_token        tokens%rowtype;
  v_counter_name text;
begin
  if current_role_name() not in ('staff', 'manager', 'admin') then
    raise exception 'Unauthorized: staff role required';
  end if;

  select * into v_token from tokens where id = p_token for update;
  if not found then
    raise exception 'Token not found';
  end if;

  update tokens
     set status = 'recalled',
         recall_count = recall_count + 1,
         called_at = now()
   where id = p_token
   returning * into v_token;

  select name into v_counter_name from counters where id = v_token.counter_id;

  if v_token.user_id is not null then
    insert into notifications (user_id, message, type)
    values (
      v_token.user_id,
      'Token ' || v_token.token_number || ' recalled: please proceed to ' || coalesce(v_counter_name, 'your counter'),
      'token_recalled'
    );
  end if;

  insert into activity_logs (actor, action, entity, entity_id)
  values (auth.uid(), 'recall_token', 'token', v_token.id);

  return query select * from tokens where id = v_token.id;
end $$;

-- ─────────────────────────────────────────────
-- skip_token(p_token uuid)
-- ─────────────────────────────────────────────
create or replace function skip_token(p_token uuid)
returns setof tokens
language plpgsql security definer set search_path = public as $$
declare
  v_token tokens%rowtype;
begin
  if current_role_name() not in ('staff', 'manager', 'admin') then
    raise exception 'Unauthorized: staff role required';
  end if;

  select * into v_token from tokens where id = p_token for update;
  if not found then
    raise exception 'Token not found';
  end if;

  update tokens
     set status = 'skipped'
   where id = p_token
   returning * into v_token;

  update counters
     set status = 'available',
         current_token = null
   where current_token = v_token.id
      or (id = v_token.counter_id and current_token = v_token.id);

  insert into activity_logs (actor, action, entity, entity_id)
  values (auth.uid(), 'skip_token', 'token', v_token.id);

  perform recalc_queue(v_token.service_id);

  return query select * from tokens where id = v_token.id;
end $$;

-- ─────────────────────────────────────────────
-- mark_token_missed(p_token uuid)
-- ─────────────────────────────────────────────
create or replace function mark_token_missed(p_token uuid)
returns setof tokens
language plpgsql security definer set search_path = public as $$
declare
  v_token tokens%rowtype;
begin
  if current_role_name() not in ('staff', 'manager', 'admin') then
    raise exception 'Unauthorized: staff role required';
  end if;

  select * into v_token from tokens where id = p_token for update;
  if not found then
    raise exception 'Token not found';
  end if;

  update tokens
     set status = 'missed'
   where id = p_token
   returning * into v_token;

  if v_token.appointment_id is not null then
    update appointments set status = 'missed' where id = v_token.appointment_id;
  end if;

  if v_token.user_id is not null then
    update profiles
       set no_show_count = no_show_count + 1
     where id = v_token.user_id;
  end if;

  update counters
     set status = 'available',
         current_token = null
   where current_token = v_token.id
      or (id = v_token.counter_id and current_token = v_token.id);

  insert into activity_logs (actor, action, entity, entity_id)
  values (auth.uid(), 'mark_token_missed', 'token', v_token.id);

  perform recalc_queue(v_token.service_id);

  return query select * from tokens where id = v_token.id;
end $$;

-- ─────────────────────────────────────────────
-- set_counter_status(p_counter uuid, p_status text)
-- ─────────────────────────────────────────────
create or replace function set_counter_status(p_counter uuid, p_status text)
returns setof counters
language plpgsql security definer set search_path = public as $$
declare
  v_counter    counters%rowtype;
  v_active_tok int;
  s            record;
begin
  if current_role_name() not in ('staff', 'manager', 'admin') then
    raise exception 'Unauthorized: staff role required';
  end if;

  if p_status not in ('available', 'busy', 'break', 'closed') then
    raise exception 'Invalid status: must be available, busy, break, or closed';
  end if;

  select * into v_counter from counters where id = p_counter for update;
  if not found then
    raise exception 'Counter not found';
  end if;

  if p_status in ('break', 'closed') and v_counter.current_token is not null then
    select count(*) into v_active_tok
    from tokens
    where id = v_counter.current_token and status in ('called', 'recalled', 'in_service');

    if v_active_tok > 0 then
      raise exception 'Cannot set status to % while a token is actively being served. Please complete or skip the current token first.', p_status;
    end if;
  end if;

  update counters
     set status = p_status,
         assigned_staff = coalesce(assigned_staff, auth.uid()),
         current_token = case when p_status in ('break', 'closed') then null else current_token end
   where id = p_counter
   returning * into v_counter;

  insert into activity_logs (actor, action, entity, entity_id)
  values (auth.uid(), 'set_counter_status_' || p_status, 'counter', p_counter);

  if v_counter.service_id is not null then
    perform recalc_queue(v_counter.service_id);
  else
    for s in select id from services where department_id = v_counter.department_id loop
      perform recalc_queue(s.id);
    end loop;
  end if;

  return query select * from counters where id = p_counter;
end $$;

-- ─────────────────────────────────────────────
-- Helper: get_counter_queue(p_counter uuid)
-- ─────────────────────────────────────────────
create or replace function get_counter_queue(p_counter uuid)
returns table (
  token_id               uuid,
  token_number           text,
  status                 text,
  queue_position         int,
  estimated_wait         int,
  recall_count           int,
  created_at             timestamptz,
  service_id             uuid,
  service_name           text,
  service_prefix         char(1),
  appointment_id         uuid,
  appointment_ref        text,
  appointment_start_time time,
  appointment_no_show_risk numeric,
  user_id                uuid,
  user_name              text,
  user_email             text,
  user_no_show_count     int
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_counter counters%rowtype;
begin
  select * into v_counter from counters where id = p_counter;
  if not found then
    return;
  end if;

  return query
  select
    t.id                   as token_id,
    t.token_number,
    t.status,
    t.queue_position,
    t.estimated_wait,
    t.recall_count,
    t.created_at,
    s.id                   as service_id,
    s.name                 as service_name,
    s.prefix               as service_prefix,
    a.id                   as appointment_id,
    a.ref_no               as appointment_ref,
    a.start_time           as appointment_start_time,
    a.no_show_risk         as appointment_no_show_risk,
    p.id                   as user_id,
    p.name                 as user_name,
    p.email                as user_email,
    coalesce(p.no_show_count, 0) as user_no_show_count
  from tokens t
  join services s on s.id = t.service_id
  left join appointments a on a.id = t.appointment_id
  left join profiles p on p.id = t.user_id
  where (
    (v_counter.service_id is not null and t.service_id = v_counter.service_id)
    or
    (v_counter.service_id is null and s.department_id = v_counter.department_id)
  )
  and t.status in ('waiting', 'recalled')
  order by
    (t.appointment_id is null) asc,
    s.priority_level desc,
    t.created_at asc;
end $$;

-- ─────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────
grant execute on function call_next_token(uuid) to authenticated;
grant execute on function start_service(uuid) to authenticated;
grant execute on function complete_service(uuid) to authenticated;
grant execute on function recall_token(uuid) to authenticated;
grant execute on function skip_token(uuid) to authenticated;
grant execute on function mark_token_missed(uuid) to authenticated;
grant execute on function set_counter_status(uuid, text) to authenticated;
grant execute on function get_counter_queue(uuid) to authenticated;

-- ============================================================
-- PHASE 4: Database Functions (Appointments & Check-in)
-- ============================================================

-- 1. Helper: get_available_slots
create or replace function get_available_slots(p_service uuid, p_date date)
returns table (
  start_time   time,
  end_time     time,
  max_capacity int,
  booked_count int,
  status       text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_dept        departments%rowtype;
  v_service     services%rowtype;
  v_slot_step   interval;
  v_curr_slot   time;
  v_next_slot   time;
  v_booked      int;
  v_is_today    boolean := (p_date = current_date);
  v_now_time    time := current_time;
begin
  if p_date < current_date then
    return;
  end if;

  select * into v_service from services where id = p_service and active = true;
  if not found then
    return;
  end if;

  select * into v_dept from departments where id = v_service.department_id;
  if not found then
    return;
  end if;

  v_slot_step := (coalesce(v_dept.slot_minutes, 30) || ' minutes')::interval;
  v_curr_slot := v_dept.open_time;

  while (v_curr_slot + v_slot_step) <= v_dept.close_time loop
    v_next_slot := v_curr_slot + v_slot_step;

    -- Skip if slot overlaps with break time
    if v_dept.break_start is not null and v_dept.break_end is not null then
      if not (v_curr_slot >= v_dept.break_end or v_next_slot <= v_dept.break_start) then
        v_curr_slot := v_next_slot;
        continue;
      end if;
    end if;

    -- Skip past slots for today
    if v_is_today and v_curr_slot <= v_now_time then
      v_curr_slot := v_next_slot;
      continue;
    end if;

    -- Count active bookings across department for this slot
    select count(*) into v_booked
    from appointments a
    join services s on s.id = a.service_id
    where s.department_id = v_dept.id
      and a.appointment_date = p_date
      and a.start_time = v_curr_slot
      and a.status not in ('cancelled', 'missed', 'rescheduled');

    start_time   := v_curr_slot;
    end_time     := v_next_slot;
    max_capacity := v_dept.max_per_slot;
    booked_count := v_booked;

    if v_booked >= v_dept.max_per_slot then
      status := 'full';
    else
      status := 'available';
    end if;

    return next;
    v_curr_slot := v_next_slot;
  end loop;
end $$;

-- 2. book_appointment
create or replace function book_appointment(p_service uuid, p_date date, p_start time)
returns setof appointments
language plpgsql security definer set search_path = public as $$
declare
  v_uid            uuid := auth.uid();
  v_service        services%rowtype;
  v_dept           departments%rowtype;
  v_rule           rules%rowtype;
  v_profile        profiles%rowtype;
  v_end            time;
  v_booked         int;
  v_dup            int;
  v_user_day_count int;
  v_ref_no         text;
  v_risk           numeric := 0.10;
  v_appt_id        uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Advisory lock to prevent race conditions on the slot
  perform pg_advisory_xact_lock(hashtext(p_service::text || p_date::text || p_start::text));

  select * into v_service from services where id = p_service and active = true;
  if not found then
    raise exception 'Service not found or inactive';
  end if;

  select * into v_dept from departments where id = v_service.department_id;
  if not found then
    raise exception 'Department not found';
  end if;

  select * into v_rule from rules where department_id = v_dept.id;
  select * into v_profile from profiles where id = v_uid;

  -- Validation: date and time
  if p_date < current_date then
    raise exception 'Cannot book appointments in the past';
  end if;

  if p_date = current_date and p_start <= current_time then
    raise exception 'Cannot book past time slots for today';
  end if;

  v_end := p_start + (coalesce(v_service.avg_duration, 15) || ' minutes')::interval;

  if p_start < v_dept.open_time or v_end > v_dept.close_time then
    raise exception 'Slot outside of working hours (% - %)', v_dept.open_time, v_dept.close_time;
  end if;

  if v_dept.break_start is not null and v_dept.break_end is not null then
    if not (p_start >= v_dept.break_end or v_end <= v_dept.break_start) then
      raise exception 'Selected slot is during break time (% - %)', v_dept.break_start, v_dept.break_end;
    end if;
  end if;

  -- Capacity check: Never allow overbooking
  select count(*) into v_booked
  from appointments a
  join services s on s.id = a.service_id
  where s.department_id = v_dept.id
    and a.appointment_date = p_date
    and a.start_time = p_start
    and a.status not in ('cancelled', 'missed', 'rescheduled');

  if v_booked >= v_dept.max_per_slot then
    raise exception 'This slot is already full. Please choose another time.';
  end if;

  -- Prevent duplicate booking
  select count(*) into v_dup
  from appointments
  where user_id = v_uid
    and service_id = p_service
    and appointment_date = p_date
    and start_time = p_start
    and status not in ('cancelled', 'missed', 'rescheduled');

  if v_dup > 0 then
    raise exception 'You already have an appointment booked for this slot';
  end if;

  -- Enforce max_appts_per_user_day
  select count(*) into v_user_day_count
  from appointments a
  join services s on s.id = a.service_id
  where a.user_id = v_uid
    and s.department_id = v_dept.id
    and a.appointment_date = p_date
    and a.status not in ('cancelled', 'missed', 'rescheduled');

  if v_rule.max_appts_per_user_day is not null and v_user_day_count >= v_rule.max_appts_per_user_day then
    raise exception 'You have reached the maximum of % appointments for this day', v_rule.max_appts_per_user_day;
  end if;

  -- Generate Reference Number
  v_ref_no := 'APT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  -- Calculate AI no-show risk score
  v_risk := 0.10 + least(0.45, 0.15 * coalesce(v_profile.no_show_count, 0));
  if p_date = current_date and extract(epoch from (p_start - current_time))/3600 < 2 then
    v_risk := v_risk + 0.20;
  end if;
  if p_start = v_dept.open_time or p_start >= (v_dept.close_time - interval '1 hour') then
    v_risk := v_risk + 0.10;
  end if;
  v_risk := round(least(1.0, greatest(0.0, v_risk)), 2);

  -- Insert appointment
  insert into appointments (
    user_id,
    service_id,
    appointment_date,
    start_time,
    end_time,
    status,
    ref_no,
    no_show_risk
  ) values (
    v_uid,
    p_service,
    p_date,
    p_start,
    v_end,
    'confirmed',
    v_ref_no,
    v_risk
  )
  returning id into v_appt_id;

  -- Insert notification
  insert into notifications (user_id, message, type)
  values (
    v_uid,
    'Appointment confirmed for ' || v_service.name || ' on ' || to_char(p_date, 'Mon DD, YYYY') || ' at ' || to_char(p_start, 'HH12:MI AM') || '. Ref: ' || v_ref_no,
    'appointment_confirmed'
  );

  -- Log activity
  insert into activity_logs (actor, action, entity, entity_id)
  values (v_uid, 'book_appointment', 'appointment', v_appt_id);

  return query select * from appointments where id = v_appt_id;
end $$;

-- 3. check_in
create or replace function check_in(p_appointment uuid)
returns setof tokens
language plpgsql security definer set search_path = public as $$
declare
  v_uid            uuid := auth.uid();
  v_appt           appointments%rowtype;
  v_service        services%rowtype;
  v_dept           departments%rowtype;
  v_rule           rules%rowtype;
  v_early          int := 10;
  v_late           int := 10;
  v_appt_start_ts  timestamptz;
  v_token_id       uuid;
  v_next_num       int;
  v_token_num      text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_appt from appointments where id = p_appointment for update;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_appt.user_id <> v_uid then
    raise exception 'You can only check in for your own appointment';
  end if;

  if v_appt.status in ('checked_in', 'waiting', 'in_service', 'completed') then
    raise exception 'Appointment has already been checked in';
  end if;

  if v_appt.status in ('cancelled', 'missed', 'rescheduled') then
    raise exception 'Cannot check in for a % appointment', v_appt.status;
  end if;

  select * into v_service from services where id = v_appt.service_id;
  select * into v_dept from departments where id = v_service.department_id;
  select * into v_rule from rules where department_id = v_dept.id;

  if v_rule.early_checkin_minutes is not null then
    v_early := v_rule.early_checkin_minutes;
  end if;
  if v_rule.late_checkin_minutes is not null then
    v_late := v_rule.late_checkin_minutes;
  end if;

  -- Date check: check-in allowed only on the day of the appointment
  if v_appt.appointment_date <> current_date then
    raise exception 'Check-in is only available on the day of your appointment (%)', to_char(v_appt.appointment_date, 'Mon DD, YYYY');
  end if;

  -- Window check
  v_appt_start_ts := (v_appt.appointment_date + v_appt.start_time);

  if now() < (v_appt_start_ts - (v_early || ' minutes')::interval) then
    raise exception 'Check-in opens % minutes before your appointment at %',
      v_early,
      to_char(v_appt.start_time, 'HH12:MI AM');
  end if;

  if now() > (v_appt_start_ts + (v_late || ' minutes')::interval) then
    update appointments set status = 'missed' where id = p_appointment;
    update profiles set no_show_count = no_show_count + 1 where id = v_uid;
    raise exception 'Check-in window closed. Your appointment has been marked as missed.';
  end if;

  update appointments
     set status = 'checked_in',
         check_in_time = now()
   where id = p_appointment;

  select count(*) + 1 into v_next_num
  from tokens
  where service_id = v_appt.service_id
    and created_at >= current_date::timestamptz
    and created_at < (current_date + 1)::timestamptz;

  v_token_num := v_service.prefix || '-' || lpad(v_next_num::text, 3, '0');

  insert into tokens (
    token_number,
    user_id,
    service_id,
    appointment_id,
    status
  ) values (
    v_token_num,
    v_uid,
    v_appt.service_id,
    p_appointment,
    'waiting'
  )
  returning id into v_token_id;

  perform recalc_queue(v_appt.service_id);

  insert into notifications (user_id, message, type)
  values (
    v_uid,
    'Checked in! Priority Token ' || v_token_num || ' issued for appointment ' || v_appt.ref_no,
    'checked_in'
  );

  insert into activity_logs (actor, action, entity, entity_id)
  values (v_uid, 'check_in', 'appointment', p_appointment);

  return query select * from tokens where id = v_token_id;
end $$;

-- 4. cancel_appointment
create or replace function cancel_appointment(p_appointment uuid)
returns setof appointments
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_appt      appointments%rowtype;
  v_rule      rules%rowtype;
  v_service   services%rowtype;
  v_cancel_ct int;
  v_limit     int := 3;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_appt from appointments where id = p_appointment for update;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_appt.user_id <> v_uid and current_role_name() not in ('staff', 'manager', 'admin') then
    raise exception 'Unauthorized';
  end if;

  if v_appt.status in ('completed', 'cancelled', 'missed') then
    raise exception 'Cannot cancel appointment with status %', v_appt.status;
  end if;

  select * into v_service from services where id = v_appt.service_id;
  select * into v_rule from rules where department_id = v_service.department_id;

  if v_rule.cancel_limit is not null then
    v_limit := v_rule.cancel_limit;
  end if;

  select count(*) into v_cancel_ct
  from appointments
  where user_id = v_uid
    and status = 'cancelled'
    and created_at >= (now() - interval '30 days');

  if v_cancel_ct >= v_limit then
    raise exception 'You have reached the cancellation limit of % appointments this month', v_limit;
  end if;

  update appointments
     set status = 'cancelled'
   where id = p_appointment
   returning * into v_appt;

  update tokens
     set status = 'skipped'
   where appointment_id = p_appointment
     and status in ('waiting', 'called');

  perform recalc_queue(v_appt.service_id);

  insert into notifications (user_id, message, type)
  values (v_uid, 'Appointment ' || v_appt.ref_no || ' has been cancelled.', 'appointment_cancelled');

  insert into activity_logs (actor, action, entity, entity_id)
  values (v_uid, 'cancel_appointment', 'appointment', p_appointment);

  return query select * from appointments where id = p_appointment;
end $$;

-- 5. reschedule_appointment
create or replace function reschedule_appointment(
  p_appointment uuid,
  p_date date,
  p_start time
)
returns setof appointments
language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_old      appointments%rowtype;
  v_new      appointments%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_old from appointments where id = p_appointment for update;
  if not found then
    raise exception 'Appointment not found';
  end if;

  if v_old.user_id <> v_uid and current_role_name() not in ('staff', 'manager', 'admin') then
    raise exception 'Unauthorized';
  end if;

  if v_old.status in ('completed', 'cancelled', 'missed', 'in_service') then
    raise exception 'Cannot reschedule appointment with status %', v_old.status;
  end if;

  update appointments
     set status = 'rescheduled'
   where id = p_appointment;

  update tokens
     set status = 'skipped'
   where appointment_id = p_appointment
     and status in ('waiting', 'called');

  for v_new in select * from book_appointment(v_old.service_id, p_date, p_start) loop
    return next v_new;
  end loop;

  insert into activity_logs (actor, action, entity, entity_id)
  values (v_uid, 'reschedule_appointment', 'appointment', p_appointment);
end $$;

-- 6. mark_missed_appointments
create or replace function mark_missed_appointments()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  r       record;
begin
  for r in
    select a.id, a.user_id
    from appointments a
    join services s on s.id = a.service_id
    left join rules rl on rl.department_id = s.department_id
    where a.status in ('confirmed', 'booked')
      and (
        a.appointment_date < current_date
        or (
          a.appointment_date = current_date
          and current_time > (a.start_time + (coalesce(rl.late_checkin_minutes, 10) || ' minutes')::interval)
        )
      )
  loop
    update appointments set status = 'missed' where id = r.id;
    update profiles set no_show_count = no_show_count + 1 where id = r.user_id;

    insert into activity_logs (actor, action, entity, entity_id)
    values (r.user_id, 'mark_missed_appointment', 'appointment', r.id);

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- Grants
grant execute on function get_available_slots(uuid, date) to authenticated, anon;
grant execute on function book_appointment(uuid, date, time) to authenticated;
grant execute on function check_in(uuid) to authenticated;
grant execute on function cancel_appointment(uuid) to authenticated;
grant execute on function reschedule_appointment(uuid, date, time) to authenticated;
grant execute on function mark_missed_appointments() to authenticated, anon;


