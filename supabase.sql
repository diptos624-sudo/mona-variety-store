create extension if not exists pgcrypto;


/* =====================================================
   ADMINS
===================================================== */

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);


/* =====================================================
   STORE SETTINGS
===================================================== */

create table if not exists public.store_settings (

  id int primary key default 1 check (id = 1),

  store_name text not null
    default 'মনা ভ্যারাইটি স্টোর',

  tagline text
    default 'আপনার আস্থার ঠিকানা',

  phone text
    default '01913726867',

  whatsapp text
    default '01913726867',

  facebook_url text
    default '',

  tiktok_url text
    default 'https://www.tiktok.com/@dipto.saha.dipto',

  logo_url text
    default '',

  address text
    default '',

  map_url text
    default '',

  opening_hours text
    default '',

  founding_year int,

  proprietor_name text
    default 'দিলীপ চন্দ্র সাহা',

  management_names text
    default 'দোয়েল সাহা · দীপ্ত সাহা',

  delivery_charge numeric(12,2)
    default 0,

  free_delivery_min numeric(12,2)
    default 0,

  about_text text
    default '',

  updated_at timestamptz
    default now()

);


insert into public.store_settings(id)
values (1)
on conflict (id) do nothing;



/* =====================================================
   CATEGORIES
===================================================== */

create table if not exists public.categories (

  id uuid primary key
    default gen_random_uuid(),

  name text not null,

  slug text unique,

  is_active boolean
    default true,

  sort_order int
    default 0,

  created_at timestamptz
    default now()

);



/* =====================================================
   PRODUCTS
===================================================== */

create table if not exists public.products (

  id uuid primary key
    default gen_random_uuid(),

  name text not null,

  slug text unique,

  category_id uuid
    references public.categories(id)
    on delete set null,

  price numeric(12,2)
    not null
    default 0,

  old_price numeric(12,2),

  image_url text,

  description text,

  stock int
    default 0,

  is_active boolean
    default true,

  is_featured boolean
    default false,

  is_new boolean
    default false,

  is_best_seller boolean
    default false,

  is_discount boolean
    default false,

  created_at timestamptz
    default now(),

  updated_at timestamptz
    default now()

);



/* =====================================================
   PAYMENT METHODS
===================================================== */

create table if not exists public.payment_methods (

  id uuid primary key
    default gen_random_uuid(),

  name text not null,

  type text
    default 'manual',

  number text,

  instructions text,

  is_active boolean
    default true,

  sort_order int
    default 0

);



/* =====================================================
   ORDERS
===================================================== */

create table if not exists public.orders (

  id uuid primary key
    default gen_random_uuid(),

  order_number text unique not null,

  customer_name text not null,

  phone text not null,

  address text not null,

  payment_method text,

  transaction_id text,

  subtotal numeric(12,2)
    not null
    default 0,

  delivery_charge numeric(12,2)
    not null
    default 0,

  total numeric(12,2)
    not null
    default 0,

  status text
    not null
    default 'pending',

  notes text,

  created_at timestamptz
    default now()

);



/* =====================================================
   ORDER ITEMS
===================================================== */

create table if not exists public.order_items (

  id uuid primary key
    default gen_random_uuid(),

  order_id uuid
    references public.orders(id)
    on delete cascade,

  product_id uuid
    references public.products(id)
    on delete set null,

  product_name text not null,

  price numeric(12,2)
    not null,

  quantity int
    not null,

  line_total numeric(12,2)
    not null

);



/* =====================================================
   ENABLE RLS
===================================================== */

alter table public.admins
enable row level security;

alter table public.store_settings
enable row level security;

alter table public.categories
enable row level security;

alter table public.products
enable row level security;

alter table public.payment_methods
enable row level security;

alter table public.orders
enable row level security;

alter table public.order_items
enable row level security;



/* =====================================================
   ADMIN CHECK FUNCTION
===================================================== */

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$

  select exists (

    select 1

    from public.admins

    where user_id = auth.uid()

  );

$$;



/* =====================================================
   ADMIN TABLE POLICY
===================================================== */

drop policy if exists
"admin can read own admin record"
on public.admins;

create policy
"admin can read own admin record"
on public.admins

for select

using (
  user_id = auth.uid()
);



/* =====================================================
   STORE SETTINGS POLICIES
===================================================== */

drop policy if exists
"public can read settings"
on public.store_settings;

create policy
"public can read settings"
on public.store_settings

for select

using (true);



drop policy if exists
"admin can manage settings"
on public.store_settings;

create policy
"admin can manage settings"
on public.store_settings

for all

using (
  public.is_admin()
)

with check (
  public.is_admin()
);



/* =====================================================
   CATEGORY POLICIES
===================================================== */

drop policy if exists
"public can read active categories"
on public.categories;

create policy
"public can read active categories"
on public.categories

for select

using (
  is_active = true
);



drop policy if exists
"admin can manage categories"
on public.categories;

create policy
"admin can manage categories"
on public.categories

for all

using (
  public.is_admin()
)

with check (
  public.is_admin()
);



/* =====================================================
   PRODUCT POLICIES
===================================================== */

drop policy if exists
"public can read active products"
on public.products;

create policy
"public can read active products"
on public.products

for select

using (
  is_active = true
);



drop policy if exists
"admin can manage products"
on public.products;

create policy
"admin can manage products"
on public.products

for all

using (
  public.is_admin()
)

with check (
  public.is_admin()
);



/* =====================================================
   PAYMENT POLICIES
===================================================== */

drop policy if exists
"public can read active payments"
on public.payment_methods;

create policy
"public can read active payments"
on public.payment_methods

for select

using (
  is_active = true
);



drop policy if exists
"admin can manage payments"
on public.payment_methods;

create policy
"admin can manage payments"
on public.payment_methods

for all

using (
  public.is_admin()
)

with check (
  public.is_admin()
);



/* =====================================================
   ORDER POLICIES
===================================================== */

drop policy if exists
"customers can create orders"
on public.orders;

create policy
"customers can create orders"
on public.orders

for insert

with check (true);



drop policy if exists
"admin can manage orders"
on public.orders;

create policy
"admin can manage orders"
on public.orders

for all

using (
  public.is_admin()
)

with check (
  public.is_admin()
);



/* =====================================================
   ORDER ITEM POLICIES
===================================================== */

drop policy if exists
"customers can create order items"
on public.order_items;

create policy
"customers can create order items"
on public.order_items

for insert

with check (true);



drop policy if exists
"admin can manage order items"
on public.order_items;

create policy
"admin can manage order items"
on public.order_items

for all

using (
  public.is_admin()
)

with check (
  public.is_admin()
);



/* =====================================================
   DEFAULT PAYMENT METHODS
===================================================== */

insert into public.payment_methods
(
  name,
  type,
  number,
  instructions,
  sort_order,
  is_active
)

select
  'bKash',
  'manual',
  '01913726867',
  'Send Money করে Transaction ID দিন।',
  1,
  true

where not exists (

  select 1
  from public.payment_methods
  where name = 'bKash'

);



insert into public.payment_methods
(
  name,
  type,
  number,
  instructions,
  sort_order,
  is_active
)

select
  'Nagad',
  'manual',
  '01913726867',
  'Send Money করে Transaction ID দিন।',
  2,
  true

where not exists (

  select 1
  from public.payment_methods
  where name = 'Nagad'

);



insert into public.payment_methods
(
  name,
  type,
  number,
  instructions,
  sort_order,
  is_active
)

select
  'Rocket',
  'manual',
  '',
  'Admin Panel থেকে Rocket নম্বর দিন।',
  3,
  true

where not exists (

  select 1
  from public.payment_methods
  where name = 'Rocket'

);



insert into public.payment_methods
(
  name,
  type,
  number,
  instructions,
  sort_order,
  is_active
)

select
  'Cash on Delivery',
  'cod',
  '',
  'ডেলিভারির সময় পেমেন্ট করুন।',
  4,
  true

where not exists (

  select 1
  from public.payment_methods
  where name = 'Cash on Delivery'

);