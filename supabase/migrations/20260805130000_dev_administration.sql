begin;

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('PJ', 'RH', 'ADMIN', 'DEV'));

update public.users
set role = 'DEV', status = 'ACTIVE', updated_at = now()
where lower(email) = 'britojoaomarco@gmail.com';

commit;
