-- ============================================================================
-- WASHMYKICKS â€” MIGRATION 04: ENTERPRISE ROW LEVEL SECURITY (RLS) & STORAGE
-- Roles: CUSTOMER, STAFF, ADMINISTRATOR
-- ============================================================================

-- Enable RLS across all 26 ERD tables + security_login_attempts
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoe_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoe_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_login_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. PUBLIC & CATALOG READ POLICIES (ROLES, BRANCHES, SERVICES)
-- ============================================================================

DROP POLICY IF EXISTS "roles_read_authenticated" ON public.roles;
CREATE POLICY "roles_read_authenticated" ON public.roles
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "roles_admin_all" ON public.roles;
CREATE POLICY "roles_admin_all" ON public.roles
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

DROP POLICY IF EXISTS "branches_public_read" ON public.branches;
CREATE POLICY "branches_public_read" ON public.branches
  FOR SELECT USING (is_active = TRUE OR public.fn_is_staff() OR public.fn_is_admin());

DROP POLICY IF EXISTS "branches_admin_all" ON public.branches;
CREATE POLICY "branches_admin_all" ON public.branches
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

DROP POLICY IF EXISTS "branch_hours_public_read" ON public.branch_hours;
CREATE POLICY "branch_hours_public_read" ON public.branch_hours
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "branch_hours_admin_all" ON public.branch_hours;
CREATE POLICY "branch_hours_admin_all" ON public.branch_hours
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

DROP POLICY IF EXISTS "shoe_services_public_read" ON public.shoe_services;
CREATE POLICY "shoe_services_public_read" ON public.shoe_services
  FOR SELECT USING (is_active = TRUE OR public.fn_is_staff() OR public.fn_is_admin());

DROP POLICY IF EXISTS "shoe_services_admin_all" ON public.shoe_services;
CREATE POLICY "shoe_services_admin_all" ON public.shoe_services
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

DROP POLICY IF EXISTS "branch_services_public_read" ON public.branch_services;
CREATE POLICY "branch_services_public_read" ON public.branch_services
  FOR SELECT USING (is_available = TRUE OR public.fn_is_staff() OR public.fn_is_admin());

DROP POLICY IF EXISTS "branch_services_admin_all" ON public.branch_services;
CREATE POLICY "branch_services_admin_all" ON public.branch_services
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

-- ============================================================================
-- 2. USER_ACCOUNTS & CUSTOMER_PROFILES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "user_accounts_self_or_staff_or_admin_select" ON public.user_accounts;
CREATE POLICY "user_accounts_self_or_staff_or_admin_select" ON public.user_accounts
  FOR SELECT USING (
    user_id = public.fn_current_user_id()
    OR public.fn_is_admin()
    OR (public.fn_is_staff() AND (branch_id = public.fn_current_branch_id() OR branch_id IS NULL))
  );

DROP POLICY IF EXISTS "user_accounts_self_update" ON public.user_accounts;
CREATE POLICY "user_accounts_self_update" ON public.user_accounts
  FOR UPDATE USING (user_id = public.fn_current_user_id() OR public.fn_is_admin())
  WITH CHECK (user_id = public.fn_current_user_id() OR public.fn_is_admin());

DROP POLICY IF EXISTS "user_accounts_admin_all" ON public.user_accounts;
CREATE POLICY "user_accounts_admin_all" ON public.user_accounts
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

DROP POLICY IF EXISTS "customer_profiles_select" ON public.customer_profiles;
CREATE POLICY "customer_profiles_select" ON public.customer_profiles
  FOR SELECT USING (
    user_id = public.fn_current_user_id()
    OR public.fn_is_staff()
    OR public.fn_is_admin()
  );

DROP POLICY IF EXISTS "customer_profiles_self_insert" ON public.customer_profiles;
CREATE POLICY "customer_profiles_self_insert" ON public.customer_profiles
  FOR INSERT WITH CHECK (user_id = public.fn_current_user_id() OR public.fn_is_admin());

DROP POLICY IF EXISTS "customer_profiles_self_update" ON public.customer_profiles;
CREATE POLICY "customer_profiles_self_update" ON public.customer_profiles
  FOR UPDATE USING (user_id = public.fn_current_user_id() OR public.fn_is_admin())
  WITH CHECK (user_id = public.fn_current_user_id() OR public.fn_is_admin());

-- ============================================================================
-- 3. BOOKINGS & SERVICE_ORDERS POLICIES
-- Customer: own records only
-- Staff: branch-related or assigned records only
-- Admin: full access
-- ============================================================================

DROP POLICY IF EXISTS "bookings_customer_own" ON public.bookings;
CREATE POLICY "bookings_customer_own" ON public.bookings
  FOR SELECT USING (customer_id = public.fn_current_customer_id());

DROP POLICY IF EXISTS "bookings_customer_insert" ON public.bookings;
CREATE POLICY "bookings_customer_insert" ON public.bookings
  FOR INSERT WITH CHECK (customer_id = public.fn_current_customer_id() OR public.fn_is_admin());

DROP POLICY IF EXISTS "bookings_customer_update" ON public.bookings;
CREATE POLICY "bookings_customer_update" ON public.bookings
  FOR UPDATE USING (customer_id = public.fn_current_customer_id())
  WITH CHECK (customer_id = public.fn_current_customer_id());

DROP POLICY IF EXISTS "bookings_staff_branch_access" ON public.bookings;
CREATE POLICY "bookings_staff_branch_access" ON public.bookings
  FOR SELECT USING (
    public.fn_is_staff() AND EXISTS (
      SELECT 1 FROM public.branch_services bs
      WHERE bs.branch_service_id = bookings.branch_service_id
        AND bs.branch_id = public.fn_current_branch_id()
    )
  );

DROP POLICY IF EXISTS "bookings_staff_branch_update" ON public.bookings;
CREATE POLICY "bookings_staff_branch_update" ON public.bookings
  FOR UPDATE USING (
    public.fn_is_staff() AND EXISTS (
      SELECT 1 FROM public.branch_services bs
      WHERE bs.branch_service_id = bookings.branch_service_id
        AND bs.branch_id = public.fn_current_branch_id()
    )
  );

DROP POLICY IF EXISTS "bookings_admin_all" ON public.bookings;
CREATE POLICY "bookings_admin_all" ON public.bookings
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

-- SERVICE_ORDERS
DROP POLICY IF EXISTS "service_orders_customer_own" ON public.service_orders;
CREATE POLICY "service_orders_customer_own" ON public.service_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings bk
      WHERE bk.booking_id = service_orders.booking_id
        AND bk.customer_id = public.fn_current_customer_id()
    )
  );

DROP POLICY IF EXISTS "service_orders_staff_branch_or_assigned" ON public.service_orders;
CREATE POLICY "service_orders_staff_branch_or_assigned" ON public.service_orders
  FOR ALL USING (
    public.fn_is_staff() AND (
      assigned_to_user_id = public.fn_current_user_id()
      OR received_by_user_id = public.fn_current_user_id()
      OR EXISTS (
        SELECT 1 FROM public.bookings bk
        JOIN public.branch_services bs ON bs.branch_service_id = bk.branch_service_id
        WHERE bk.booking_id = service_orders.booking_id
          AND bs.branch_id = public.fn_current_branch_id()
      )
    )
  )
  WITH CHECK (
    public.fn_is_staff() AND (
      assigned_to_user_id = public.fn_current_user_id()
      OR received_by_user_id = public.fn_current_user_id()
      OR EXISTS (
        SELECT 1 FROM public.bookings bk
        JOIN public.branch_services bs ON bs.branch_service_id = bk.branch_service_id
        WHERE bk.booking_id = service_orders.booking_id
          AND bs.branch_id = public.fn_current_branch_id()
      )
    )
  );

DROP POLICY IF EXISTS "service_orders_admin_all" ON public.service_orders;
CREATE POLICY "service_orders_admin_all" ON public.service_orders
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

-- ============================================================================
-- 4. SHOE_ASSESSMENTS & ASSESSMENT_PHOTOS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "shoe_assessments_customer_read_own" ON public.shoe_assessments;
CREATE POLICY "shoe_assessments_customer_read_own" ON public.shoe_assessments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.service_orders so
      JOIN public.bookings bk ON bk.booking_id = so.booking_id
      WHERE so.order_id = shoe_assessments.order_id
        AND bk.customer_id = public.fn_current_customer_id()
    )
  );

DROP POLICY IF EXISTS "shoe_assessments_staff_branch_manage" ON public.shoe_assessments;
CREATE POLICY "shoe_assessments_staff_branch_manage" ON public.shoe_assessments
  FOR ALL USING (
    public.fn_is_staff() AND EXISTS (
      SELECT 1 FROM public.service_orders so
      JOIN public.bookings bk ON bk.booking_id = so.booking_id
      JOIN public.branch_services bs ON bs.branch_service_id = bk.branch_service_id
      WHERE so.order_id = shoe_assessments.order_id
        AND (bs.branch_id = public.fn_current_branch_id() OR so.assigned_to_user_id = public.fn_current_user_id())
    )
  )
  WITH CHECK (
    public.fn_is_staff() AND EXISTS (
      SELECT 1 FROM public.service_orders so
      JOIN public.bookings bk ON bk.booking_id = so.booking_id
      JOIN public.branch_services bs ON bs.branch_service_id = bk.branch_service_id
      WHERE so.order_id = shoe_assessments.order_id
        AND (bs.branch_id = public.fn_current_branch_id() OR so.assigned_to_user_id = public.fn_current_user_id())
    )
  );

DROP POLICY IF EXISTS "shoe_assessments_admin_all" ON public.shoe_assessments;
CREATE POLICY "shoe_assessments_admin_all" ON public.shoe_assessments
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

DROP POLICY IF EXISTS "assessment_photos_customer_read_own" ON public.assessment_photos;
CREATE POLICY "assessment_photos_customer_read_own" ON public.assessment_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shoe_assessments sa
      JOIN public.service_orders so ON so.order_id = sa.order_id
      JOIN public.bookings bk ON bk.booking_id = so.booking_id
      WHERE sa.assessment_id = assessment_photos.assessment_id
        AND bk.customer_id = public.fn_current_customer_id()
    )
  );

DROP POLICY IF EXISTS "assessment_photos_staff_branch_manage" ON public.assessment_photos;
CREATE POLICY "assessment_photos_staff_branch_manage" ON public.assessment_photos
  FOR ALL USING (
    public.fn_is_staff() AND EXISTS (
      SELECT 1 FROM public.shoe_assessments sa
      JOIN public.service_orders so ON so.order_id = sa.order_id
      JOIN public.bookings bk ON bk.booking_id = so.booking_id
      JOIN public.branch_services bs ON bs.branch_service_id = bk.branch_service_id
      WHERE sa.assessment_id = assessment_photos.assessment_id
        AND (bs.branch_id = public.fn_current_branch_id() OR so.assigned_to_user_id = public.fn_current_user_id())
    )
  )
  WITH CHECK (
    public.fn_is_staff() AND EXISTS (
      SELECT 1 FROM public.shoe_assessments sa
      JOIN public.service_orders so ON so.order_id = sa.order_id
      JOIN public.bookings bk ON bk.booking_id = so.booking_id
      JOIN public.branch_services bs ON bs.branch_service_id = bk.branch_service_id
      WHERE sa.assessment_id = assessment_photos.assessment_id
        AND (bs.branch_id = public.fn_current_branch_id() OR so.assigned_to_user_id = public.fn_current_user_id())
    )
  );

DROP POLICY IF EXISTS "assessment_photos_admin_all" ON public.assessment_photos;
CREATE POLICY "assessment_photos_admin_all" ON public.assessment_photos
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

-- ============================================================================
-- 5. CRM, NOTIFICATIONS & PREFERENCES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "crm_interactions_public_reviews_read" ON public.crm_interactions;
CREATE POLICY "crm_interactions_public_reviews_read" ON public.crm_interactions
  FOR SELECT USING (
    (interaction_type = 'REVIEW' AND interaction_status = 'Published')
    OR customer_id = public.fn_current_customer_id()
    OR public.fn_is_staff()
    OR public.fn_is_admin()
  );

DROP POLICY IF EXISTS "crm_interactions_customer_insert" ON public.crm_interactions;
CREATE POLICY "crm_interactions_customer_insert" ON public.crm_interactions
  FOR INSERT WITH CHECK (customer_id = public.fn_current_customer_id() OR public.fn_is_admin());

DROP POLICY IF EXISTS "crm_interactions_staff_admin_update" ON public.crm_interactions;
CREATE POLICY "crm_interactions_staff_admin_update" ON public.crm_interactions
  FOR UPDATE USING (public.fn_is_staff() OR public.fn_is_admin())
  WITH CHECK (public.fn_is_staff() OR public.fn_is_admin());

DROP POLICY IF EXISTS "crm_interactions_admin_all" ON public.crm_interactions;
CREATE POLICY "crm_interactions_admin_all" ON public.crm_interactions
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

DROP POLICY IF EXISTS "notifications_customer_own" ON public.notifications;
CREATE POLICY "notifications_customer_own" ON public.notifications
  FOR SELECT USING (
    customer_id = public.fn_current_customer_id()
    OR public.fn_is_staff()
    OR public.fn_is_admin()
  );

DROP POLICY IF EXISTS "notifications_customer_mark_read" ON public.notifications;
CREATE POLICY "notifications_customer_mark_read" ON public.notifications
  FOR UPDATE USING (
    customer_id = public.fn_current_customer_id()
    OR public.fn_is_staff()
    OR public.fn_is_admin()
  );

DROP POLICY IF EXISTS "notifications_staff_admin_insert" ON public.notifications;
CREATE POLICY "notifications_staff_admin_insert" ON public.notifications
  FOR INSERT WITH CHECK (public.fn_is_staff() OR public.fn_is_admin());

DROP POLICY IF EXISTS "notification_contexts_select" ON public.notification_contexts;
CREATE POLICY "notification_contexts_select" ON public.notification_contexts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.notification_id = notification_contexts.notification_id
        AND (n.customer_id = public.fn_current_customer_id() OR public.fn_is_staff() OR public.fn_is_admin())
    )
  );

DROP POLICY IF EXISTS "notification_contexts_staff_admin_all" ON public.notification_contexts;
CREATE POLICY "notification_contexts_staff_admin_all" ON public.notification_contexts
  FOR ALL USING (public.fn_is_staff() OR public.fn_is_admin())
  WITH CHECK (public.fn_is_staff() OR public.fn_is_admin());

DROP POLICY IF EXISTS "customer_notif_prefs_own" ON public.customer_notification_preferences;
CREATE POLICY "customer_notif_prefs_own" ON public.customer_notification_preferences
  FOR ALL USING (
    customer_id = public.fn_current_customer_id()
    OR public.fn_is_admin()
  )
  WITH CHECK (
    customer_id = public.fn_current_customer_id()
    OR public.fn_is_admin()
  );

-- ============================================================================
-- 6. INVENTORY MANAGEMENT POLICIES (STAFF BRANCH ACCESS + ADMIN FULL ACCESS)
-- ============================================================================

DROP POLICY IF EXISTS "suppliers_staff_read_admin_all" ON public.suppliers;
CREATE POLICY "suppliers_staff_read_admin_all" ON public.suppliers
  FOR SELECT USING (public.fn_is_staff() OR public.fn_is_admin());

DROP POLICY IF EXISTS "suppliers_admin_write" ON public.suppliers;
CREATE POLICY "suppliers_admin_write" ON public.suppliers
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

DROP POLICY IF EXISTS "inventory_items_staff_read_admin_all" ON public.inventory_items;
CREATE POLICY "inventory_items_staff_read_admin_all" ON public.inventory_items
  FOR SELECT USING (public.fn_is_staff() OR public.fn_is_admin());

DROP POLICY IF EXISTS "inventory_items_admin_write" ON public.inventory_items;
CREATE POLICY "inventory_items_admin_write" ON public.inventory_items
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

DROP POLICY IF EXISTS "branch_inventory_staff_branch_read_update" ON public.branch_inventory;
CREATE POLICY "branch_inventory_staff_branch_read_update" ON public.branch_inventory
  FOR SELECT USING (
    public.fn_is_admin()
    OR (public.fn_is_staff() AND branch_id = public.fn_current_branch_id())
  );

DROP POLICY IF EXISTS "branch_inventory_staff_update" ON public.branch_inventory;
CREATE POLICY "branch_inventory_staff_update" ON public.branch_inventory
  FOR UPDATE USING (
    public.fn_is_admin()
    OR (public.fn_is_staff() AND branch_id = public.fn_current_branch_id())
  );

DROP POLICY IF EXISTS "branch_inventory_admin_all" ON public.branch_inventory;
CREATE POLICY "branch_inventory_admin_all" ON public.branch_inventory
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

DROP POLICY IF EXISTS "stock_movements_staff_branch" ON public.stock_movements;
CREATE POLICY "stock_movements_staff_branch" ON public.stock_movements
  FOR ALL USING (
    public.fn_is_admin()
    OR (
      public.fn_is_staff() AND EXISTS (
        SELECT 1 FROM public.branch_inventory bi
        WHERE bi.branch_inventory_id = stock_movements.branch_inventory_id
          AND bi.branch_id = public.fn_current_branch_id()
      )
    )
  )
  WITH CHECK (
    public.fn_is_admin()
    OR (
      public.fn_is_staff() AND EXISTS (
        SELECT 1 FROM public.branch_inventory bi
        WHERE bi.branch_inventory_id = stock_movements.branch_inventory_id
          AND bi.branch_id = public.fn_current_branch_id()
      )
    )
  );

DROP POLICY IF EXISTS "purchase_orders_staff_branch_admin_all" ON public.purchase_orders;
CREATE POLICY "purchase_orders_staff_branch_admin_all" ON public.purchase_orders
  FOR ALL USING (
    public.fn_is_admin()
    OR (public.fn_is_staff() AND branch_id = public.fn_current_branch_id())
  )
  WITH CHECK (
    public.fn_is_admin()
    OR (public.fn_is_staff() AND branch_id = public.fn_current_branch_id())
  );

DROP POLICY IF EXISTS "purchase_order_items_staff_branch_admin_all" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items_staff_branch_admin_all" ON public.purchase_order_items
  FOR ALL USING (
    public.fn_is_admin()
    OR (
      public.fn_is_staff() AND EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.purchase_order_id = purchase_order_items.purchase_order_id
          AND po.branch_id = public.fn_current_branch_id()
      )
    )
  )
  WITH CHECK (
    public.fn_is_admin()
    OR (
      public.fn_is_staff() AND EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.purchase_order_id = purchase_order_items.purchase_order_id
          AND po.branch_id = public.fn_current_branch_id()
      )
    )
  );

DROP POLICY IF EXISTS "deliveries_staff_branch_admin_all" ON public.deliveries;
CREATE POLICY "deliveries_staff_branch_admin_all" ON public.deliveries
  FOR ALL USING (
    public.fn_is_admin()
    OR (
      public.fn_is_staff() AND EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.purchase_order_id = deliveries.purchase_order_id
          AND po.branch_id = public.fn_current_branch_id()
      )
    )
  )
  WITH CHECK (
    public.fn_is_admin()
    OR (
      public.fn_is_staff() AND EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.purchase_order_id = deliveries.purchase_order_id
          AND po.branch_id = public.fn_current_branch_id()
      )
    )
  );

DROP POLICY IF EXISTS "delivery_items_staff_branch_admin_all" ON public.delivery_items;
CREATE POLICY "delivery_items_staff_branch_admin_all" ON public.delivery_items
  FOR ALL USING (
    public.fn_is_admin()
    OR (
      public.fn_is_staff() AND EXISTS (
        SELECT 1 FROM public.deliveries d
        JOIN public.purchase_orders po ON po.purchase_order_id = d.purchase_order_id
        WHERE d.delivery_id = delivery_items.delivery_id
          AND po.branch_id = public.fn_current_branch_id()
      )
    )
  )
  WITH CHECK (
    public.fn_is_admin()
    OR (
      public.fn_is_staff() AND EXISTS (
        SELECT 1 FROM public.deliveries d
        JOIN public.purchase_orders po ON po.purchase_order_id = d.purchase_order_id
        WHERE d.delivery_id = delivery_items.delivery_id
          AND po.branch_id = public.fn_current_branch_id()
      )
    )
  );

DROP POLICY IF EXISTS "supplier_returns_staff_branch_admin_all" ON public.supplier_returns;
CREATE POLICY "supplier_returns_staff_branch_admin_all" ON public.supplier_returns
  FOR ALL USING (
    public.fn_is_admin()
    OR (
      public.fn_is_staff() AND EXISTS (
        SELECT 1 FROM public.delivery_items di
        JOIN public.deliveries d ON d.delivery_id = di.delivery_id
        JOIN public.purchase_orders po ON po.purchase_order_id = d.purchase_order_id
        WHERE di.delivery_item_id = supplier_returns.delivery_item_id
          AND po.branch_id = public.fn_current_branch_id()
      )
    )
  )
  WITH CHECK (
    public.fn_is_admin()
    OR (
      public.fn_is_staff() AND EXISTS (
        SELECT 1 FROM public.delivery_items di
        JOIN public.deliveries d ON d.delivery_id = di.delivery_id
        JOIN public.purchase_orders po ON po.purchase_order_id = d.purchase_order_id
        WHERE di.delivery_item_id = supplier_returns.delivery_item_id
          AND po.branch_id = public.fn_current_branch_id()
      )
    )
  );

-- ============================================================================
-- 7. AUDIT_LOGS & SYSTEM_SETTINGS POLICIES (ADMIN ONLY)
-- ============================================================================

DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
  FOR SELECT USING (public.fn_is_admin());

DROP POLICY IF EXISTS "audit_logs_system_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_system_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "system_settings_admin_all" ON public.system_settings;
CREATE POLICY "system_settings_admin_all" ON public.system_settings
  FOR ALL USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

DROP POLICY IF EXISTS "system_settings_staff_read" ON public.system_settings;
CREATE POLICY "system_settings_staff_read" ON public.system_settings
  FOR SELECT USING (public.fn_is_staff() OR public.fn_is_admin());

DROP POLICY IF EXISTS "security_login_attempts_admin_read" ON public.security_login_attempts;
CREATE POLICY "security_login_attempts_admin_read" ON public.security_login_attempts
  FOR SELECT USING (public.fn_is_admin());

-- ============================================================================
-- 8. SUPABASE STORAGE BUCKETS & FILE ACCESS POLICIES
-- Buckets: before-photos, after-photos
-- Path structure: branch-{branch_id}/order-{order_id}/{angle}.jpg
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('before-photos', 'before-photos', FALSE, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('after-photos', 'after-photos', FALSE, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Administrator: Full access to all photos in before-photos and after-photos
DROP POLICY IF EXISTS "storage_admin_all_photos" ON storage.objects;
CREATE POLICY "storage_admin_all_photos" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('before-photos', 'after-photos')
    AND public.fn_is_admin()
  )
  WITH CHECK (
    bucket_id IN ('before-photos', 'after-photos')
    AND public.fn_is_admin()
  );

-- Staff: Read, upload, and update photos for their assigned branch
DROP POLICY IF EXISTS "storage_staff_branch_photos_select" ON storage.objects;
CREATE POLICY "storage_staff_branch_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('before-photos', 'after-photos')
    AND public.fn_is_staff()
    AND (
      (storage.foldername(name))[1] = ('branch-' || public.fn_current_branch_id()::TEXT)
      OR EXISTS (
        SELECT 1 FROM public.assessment_photos ap
        WHERE ap.file_path = storage.objects.name
      )
    )
  );

DROP POLICY IF EXISTS "storage_staff_branch_photos_insert" ON storage.objects;
CREATE POLICY "storage_staff_branch_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('before-photos', 'after-photos')
    AND public.fn_is_staff()
    AND (storage.foldername(name))[1] = ('branch-' || public.fn_current_branch_id()::TEXT)
  );

DROP POLICY IF EXISTS "storage_staff_branch_photos_update" ON storage.objects;
CREATE POLICY "storage_staff_branch_photos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('before-photos', 'after-photos')
    AND public.fn_is_staff()
    AND (storage.foldername(name))[1] = ('branch-' || public.fn_current_branch_id()::TEXT)
  );

-- Customer: Read access to own assessment photos only
DROP POLICY IF EXISTS "storage_customer_own_photos_select" ON storage.objects;
CREATE POLICY "storage_customer_own_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('before-photos', 'after-photos')
    AND public.fn_is_customer()
    AND EXISTS (
      SELECT 1
      FROM public.assessment_photos ap
      JOIN public.shoe_assessments sa ON sa.assessment_id = ap.assessment_id
      JOIN public.service_orders so ON so.order_id = sa.order_id
      JOIN public.bookings bk ON bk.booking_id = so.booking_id
      WHERE ap.file_path = storage.objects.name
        AND bk.customer_id = public.fn_current_customer_id()
    )
  );

