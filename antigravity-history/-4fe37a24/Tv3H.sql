-- Drop the recursive policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins and Staff can view all memberships in their product" ON public.product_memberships;
DROP POLICY IF EXISTS "Admins can manage memberships" ON public.product_memberships;
DROP POLICY IF EXISTS "Users can view products they have access to" ON public.products;

-- Create SECURITY DEFINER helper functions (bypass RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_member_of(p_product_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.product_memberships
    WHERE product_id = p_product_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin_of(p_product_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.product_memberships
    WHERE product_id = p_product_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recreate products policy using the helper function (no recursion)
CREATE POLICY "Users can view products they have access to"
  ON public.products FOR SELECT TO authenticated
  USING (public.is_member_of(id));

-- Recreate membership policies using the helper functions (no recursion)
CREATE POLICY "Admins and Staff can view all memberships in their product"
  ON public.product_memberships FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_member_of(product_id)
  );

CREATE POLICY "Admins can manage memberships"
  ON public.product_memberships FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of(product_id));

CREATE POLICY "Admins can update memberships"
  ON public.product_memberships FOR UPDATE TO authenticated
  USING (public.is_admin_of(product_id));

CREATE POLICY "Admins can delete memberships"
  ON public.product_memberships FOR DELETE TO authenticated
  USING (public.is_admin_of(product_id));
