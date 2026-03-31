-- ============================================
-- Practi-QR: Полная схема БД
-- Запустите этот скрипт в Supabase SQL Editor
-- ============================================

-- 1. Группы
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

-- 2. Студенты
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  login text unique not null,
  password_hash text not null,
  group_id uuid references groups(id) on delete set null
);

-- 3. Предприятия
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  allowed_radius integer default 200
);

-- 4. Аккаунты
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  login text unique not null,
  password_hash text not null,
  role text check (role in ('student', 'company', 'teacher', 'admin')) not null,
  company_id uuid references companies(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  created_at timestamp default now()
);

-- 5. QR-токены
create table if not exists qr_tokens (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  company_id uuid references companies(id) on delete cascade,
  expires_at timestamp not null,
  created_at timestamp default now()
);

-- 6. Посещаемость (с координатами)
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  scanned_at timestamp default now(),
  status text check (status in ('present', 'rejected')) not null,
  reason text,
  lat double precision,
  lng double precision
);

-- 7. Связки студент-предприятие (кто где проходит практику)
create table if not exists student_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  created_at timestamp default now()
);

-- ============================================
-- Тестовые данные (опционально)
-- ============================================

-- Админ-аккаунт (логин: admin, пароль: admin)
insert into accounts (login, password_hash, role) values ('admin', 'admin', 'admin')
on conflict (login) do nothing;

-- Преподаватель (логин: teacher, пароль: teacher)
insert into accounts (login, password_hash, role) values ('teacher', 'teacher', 'teacher')
on conflict (login) do nothing;
