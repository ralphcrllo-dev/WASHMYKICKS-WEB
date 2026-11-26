-- ============================================================================
-- WASHMYKICKS — MIGRATION 06: SECURITY HARDENING (RLS, VIEWS & RBAC TRIGGER)
-- Closes anon catch-all policies, view RLS bypass, and signup role escalation.
-- Run this migration in Supabase SQL Editor.
-- ============================================================================

-- 1. Drop any permissive anon/public catch-all policies if previously applied
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_accounts', 'customer_profiles', 'bookings', 'service_orders',
    'shoe_assessments', 'assessment_photos', 'crm_interactions',
    'notifications', 'notification_contexts', 'customer_notification_preferences',
    'suppliers', 'inventory_items', 'purchase_orders', 'purchase_order_items',
    'deliveries', 'delivery_items', 'branch_inventory', 'stock_movements',
    'supplier_returns', 'audit_logs', 'system_settings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "wmk_publishable_client_%I" ON public.%I;', t, t);
  END LOOP;
END $$;

-- 2. Force all reporting views to run as SECURITY INVOKER so RLS applies to callers
ALTER VIEW IF EXISTS public.v_branch_inventory_stock SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_low_stock_alerts SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_order_tracking_details SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_branch_performance_summary SET (security_invoker = true);

-- 3. Revoke anonymous direct access from PII and operational tables/views
REVOKE ALL ON public.user_accounts, public.customer_profiles, public.bookings, public.service_orders,
  public.shoe_assessments, public.assessment_photos, public.notifications, public.notification_contexts,
  public.customer_notification_preferences, public.suppliers, public.inventory_items,
  public.purchase_orders, public.purchase_order_items, public.deliveries, public.delivery_items,
  public.branch_inventory, public.stock_movements, public.supplier_returns,
  public.audit_logs, public.system_settings, public.security_login_attempts,
  public.v_branch_inventory_stock, public.v_low_stock_alerts,
  public.v_order_tracking_details, public.v_branch_performance_summary FROM anon;

-- 4. Lock down signup sync trigger so public signups ALWAYS get CUSTOMER role
-- (Prevents raw_user_meta_data->>'role' = 'ADMINISTRATOR' / 'STAFF' escalation)
CREATE OR REPLACE FUNCTION public.fn_sync_auth_user_to_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id INT;
  v_user_id INT;
  v_customer_id INT;
  v_first_name VARCHAR(80);
  v_last_name VARCHAR(80);
BEGIN
  SELECT role_id INTO v_role_id FROM public.roles WHERE role_name = 'CUSTOMER' LIMIT 1;

  INSERT INTO public.user_accounts (
    auth_uid,
    role_id,
    branch_id,
    username,
    email,
    password_hash,
    account_status,
    email_verified_at
  )
  VALUES (
    NEW.id,
    v_role_id,
    NULL,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1) || '_' || SUBSTR(NEW.id::TEXT, 1, 6)
    ),
    NEW.email,
    COALESCE(NEW.encrypted_password, 'SUPABASE_MANAGED_AUTH'),
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN 'ACTIVE' ELSE 'PENDING_VERIFICATION' END,
    NEW.email_confirmed_at
  )
  ON CONFLICT (email) DO UPDATE
    SET auth_uid = EXCLUDED.auth_uid,
        email_verified_at = COALESCE(EXCLUDED.email_verified_at, public.user_accounts.email_verified_at),
        updated_at = NOW()
  RETURNING user_id INTO v_user_id;

  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', 'Valued');
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Customer');

  INSERT INTO public.customer_profiles (user_id, first_name, last_name, phone, address)
  VALUES (
    v_user_id,
    v_first_name,
    v_last_name,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'address'
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING customer_id INTO v_customer_id;

  IF v_customer_id IS NOT NULL THEN
    INSERT INTO public.customer_notification_preferences (customer_id, preference_type, is_enabled)
    VALUES
      (v_customer_id, 'EMAIL_BOOKING', TRUE),
      (v_customer_id, 'EMAIL_ORDER_STATUS', TRUE),
      (v_customer_id, 'EMAIL_PICKUP', TRUE),
      (v_customer_id, 'IN_APP', TRUE)
    ON CONFLICT (customer_id, preference_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Branch-scope customer_profiles SELECT for staff & require auth on audit_logs INSERT
DROP POLICY IF EXISTS "customer_profiles_select" ON public.customer_profiles;
CREATE POLICY "customer_profiles_select" ON public.customer_profiles
  FOR SELECT USING (
    user_id = public.fn_current_user_id()
    OR public.fn_is_admin()
    OR (
      public.fn_is_staff() AND EXISTS (
        SELECT 1
        FROM public.bookings bk
        JOIN public.branch_services bs ON bs.branch_service_id = bk.branch_service_id
        WHERE bk.customer_id = customer_profiles.customer_id
          AND bs.branch_id = public.fn_current_branch_id()
      )
    )
  );

DROP POLICY IF EXISTS "audit_logs_system_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_system_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Safe public non-PII RPC for slot availability (never exposes customer_request or email)
CREATE OR REPLACE FUNCTION public.fn_get_public_slot_counts(
  p_date_label TEXT DEFAULT ''
)
RETURNS TABLE (
  slot_label TEXT,
  booked_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slots TEXT[] := ARRAY['10:00 AM','10:30 AM','11:30 AM','01:00 PM','02:30 PM','04:00 PM','05:30 PM','06:30 PM'];
  v_slot TEXT;
  v_cnt INT;
BEGIN
  FOREACH v_slot IN ARRAY v_slots
  LOOP
    SELECT COUNT(*)::INT
    INTO v_cnt
    FROM public.bookings b
    WHERE b.booking_status <> 'Cancelled'
      AND COALESCE(b.customer_request, '') LIKE ('%' || v_slot || '%')
      AND (p_date_label = '' OR COALESCE(b.customer_request, '') LIKE ('%' || p_date_label || '%'));
    slot_label := v_slot;
    booked_count := v_cnt;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_public_slot_counts(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_get_public_slot_counts(TEXT) TO anon, authenticated;

