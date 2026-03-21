-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core Tables

-- 1. Profiles
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  branding JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Product Memberships
CREATE TYPE membership_role AS ENUM ('admin', 'staff', 'user');
CREATE TYPE membership_status AS ENUM ('active', 'invited', 'suspended');

CREATE TABLE public.product_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role membership_role DEFAULT 'user' NOT NULL,
  status membership_status DEFAULT 'active' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(product_id, user_id)
);

-- 4. Audit Logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Notifications
CREATE TYPE notification_status AS ENUM ('unread', 'read');

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  status notification_status DEFAULT 'unread' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Security Configuration (RLS)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users can read basic profiles.
CREATE POLICY "Authenticated users can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Products: Users can see a product if they have an active membership.
CREATE POLICY "Users can view products they have access to" ON public.products FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_memberships 
    WHERE product_id = products.id AND user_id = auth.uid() AND status = 'active'
  )
);

-- Admin can bypass to see all products if needed, but per requirement "Hub muestra solo productos permitidos".
-- Let's also add a policy for service role so seeds work easily, though Supabase disables RLS for postgres/Service Roles.

-- Product Memberships:
CREATE POLICY "Users can view their own memberships" ON public.product_memberships FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins and Staff can view all memberships in their product" ON public.product_memberships FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_memberships AS pm 
    WHERE pm.product_id = product_memberships.product_id 
      AND pm.user_id = auth.uid() 
      AND (pm.role = 'admin' OR pm.role = 'staff')
      AND pm.status = 'active'
  )
);

CREATE POLICY "Admins can manage memberships" ON public.product_memberships FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_memberships AS pm 
    WHERE pm.product_id = product_memberships.product_id 
      AND pm.user_id = auth.uid() 
      AND pm.role = 'admin'
      AND pm.status = 'active'
  )
);

-- Audit Logs: 
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_memberships AS pm 
    WHERE pm.product_id = audit_logs.product_id 
      AND pm.user_id = auth.uid() 
      AND pm.role = 'admin'
      AND pm.status = 'active'
  )
);

CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = actor_user_id);

-- Notifications:
CREATE POLICY "Users can manage their own notifications" ON public.notifications FOR ALL TO authenticated
USING (user_id = auth.uid());

-- Triggers

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
