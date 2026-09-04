begin;

create or replace function public.create_sector(
  p_organization_id text, p_actor_id text, p_sector_id text, p_name text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
  v_sector public.sectors%rowtype;
begin
  select u.role into v_role
  from public.users u join public.organizations o on o.id = u.organization_id
  where u.id = p_actor_id and u.organization_id = p_organization_id
    and u.status = 'ACTIVE' and o.status = 'ACTIVE';
  if v_role not in ('RH', 'ADMIN', 'DEV') then
    raise exception 'Forbidden operation' using errcode = '42501';
  end if;
  if p_sector_id is null or p_sector_id !~ '^sec_.+'
     or length(pg_catalog.btrim(coalesce(p_name, ''))) not between 1 and 120 then
    raise exception 'Invalid sector values' using errcode = '22023';
  end if;

  insert into public.sectors (id, organization_id, name, status)
  values (p_sector_id, p_organization_id, pg_catalog.btrim(p_name), 'ACTIVE')
  returning * into v_sector;
  insert into public.audit_logs (id, organization_id, user_id, action, entity_type, entity_id, new_value)
  values (pg_catalog.gen_random_uuid()::text, p_organization_id, p_actor_id,
    'SECTOR_CREATED', 'Sector', v_sector.id, pg_catalog.to_jsonb(v_sector));
  return pg_catalog.jsonb_build_object('id', v_sector.id, 'name', v_sector.name, 'status', v_sector.status);
end;
$$;

create or replace function public.update_sector(
  p_organization_id text, p_actor_id text, p_sector_id text, p_name text, p_status text, p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
  v_previous public.sectors%rowtype;
  v_sector public.sectors%rowtype;
begin
  select u.role into v_role
  from public.users u join public.organizations o on o.id = u.organization_id
  where u.id = p_actor_id and u.organization_id = p_organization_id
    and u.status = 'ACTIVE' and o.status = 'ACTIVE';
  if v_role not in ('RH', 'ADMIN', 'DEV') then
    raise exception 'Forbidden operation' using errcode = '42501';
  end if;
  if length(pg_catalog.btrim(coalesce(p_name, ''))) not between 1 and 120
     or p_status not in ('ACTIVE', 'INACTIVE')
     or length(pg_catalog.btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Invalid sector values' using errcode = '22023';
  end if;
  select * into v_previous from public.sectors
  where id = p_sector_id and organization_id = p_organization_id for update;
  if v_previous.id is null then
    raise exception 'Sector not found' using errcode = 'P0002';
  end if;

  update public.sectors
  set name = pg_catalog.btrim(p_name), status = p_status, updated_at = pg_catalog.now()
  where id = v_previous.id and organization_id = p_organization_id
  returning * into v_sector;
  insert into public.audit_logs (id, organization_id, user_id, action, entity_type, entity_id, previous_value, new_value, reason)
  values (pg_catalog.gen_random_uuid()::text, p_organization_id, p_actor_id,
    case when v_previous.status = v_sector.status then 'SECTOR_UPDATED' else 'SECTOR_STATUS_CHANGED' end,
    'Sector', v_sector.id, pg_catalog.to_jsonb(v_previous), pg_catalog.to_jsonb(v_sector), pg_catalog.btrim(p_reason));
  return pg_catalog.jsonb_build_object('id', v_sector.id, 'name', v_sector.name, 'status', v_sector.status);
end;
$$;

create or replace function public.set_contractor_sector(
  p_organization_id text, p_actor_id text, p_contractor_id text, p_sector_id text, p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
  v_previous public.users%rowtype;
  v_contractor public.users%rowtype;
begin
  select u.role into v_role
  from public.users u join public.organizations o on o.id = u.organization_id
  where u.id = p_actor_id and u.organization_id = p_organization_id
    and u.status = 'ACTIVE' and o.status = 'ACTIVE';
  if v_role not in ('RH', 'ADMIN', 'DEV') then
    raise exception 'Forbidden operation' using errcode = '42501';
  end if;
  if length(pg_catalog.btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Invalid sector values' using errcode = '22023';
  end if;
  select * into v_previous from public.users
  where id = p_contractor_id and organization_id = p_organization_id and role = 'PJ' for update;
  if v_previous.id is null then
    raise exception 'Contractor not found' using errcode = 'P0002';
  end if;
  if p_sector_id is not null and not exists (
    select 1 from public.sectors
    where id = p_sector_id and organization_id = p_organization_id and status = 'ACTIVE'
  ) then
    raise exception 'Invalid sector' using errcode = '22023';
  end if;

  update public.users
  set sector_id = p_sector_id, updated_at = pg_catalog.now()
  where id = v_previous.id and organization_id = p_organization_id
  returning * into v_contractor;
  insert into public.audit_logs (id, organization_id, user_id, action, entity_type, entity_id, previous_value, new_value, reason)
  values (pg_catalog.gen_random_uuid()::text, p_organization_id, p_actor_id,
    'CONTRACTOR_SECTOR_CHANGED', 'User', v_contractor.id,
    pg_catalog.to_jsonb(v_previous), pg_catalog.to_jsonb(v_contractor), pg_catalog.btrim(p_reason));
  return pg_catalog.jsonb_build_object('id', v_contractor.id, 'sectorId', v_contractor.sector_id);
end;
$$;

revoke all on function public.create_sector(text,text,text,text) from public, anon, authenticated;
revoke all on function public.update_sector(text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.set_contractor_sector(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_sector(text,text,text,text) to service_role;
grant execute on function public.update_sector(text,text,text,text,text,text) to service_role;
grant execute on function public.set_contractor_sector(text,text,text,text,text) to service_role;

commit;
