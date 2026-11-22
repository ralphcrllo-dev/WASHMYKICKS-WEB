# WASHMYKICKS FINAL QA CHECKLIST

## A. LOGIN / ROLE ACCESS & ACCOUNT REGISTRATION
[ ] Administrator can register and login via Administrator Portal.
[ ] Staff can register (with Employee ID & assigned branch) and login via Staff Portal.
[ ] Customer can register and login via Customer Portal.
[ ] Login screen has no pre-filled demo credentials (clean production inputs).
[ ] Newly created accounts start with 0 orders, 0 completed pairs, and 0 unread notifications.
[ ] Wrong password or unregistered email shows a clear authentication error message.
[ ] Forgot Password recovery flow sends/triggers password reset feedback.
[ ] Customer sees Customer-only modules (Dashboard, Book Appointment, Track Shoes, Notifications, Service History, Reviews, Profile).
[ ] Staff sees Staff-only modules (Dashboard, Job Orders, Shoe Assessment, Before & After Documentation, Assigned Services, Inventory, Customers, Notifications).
[ ] Administrator sees all 10 executive modules (Dashboard, Branches, Services, Inventory, CRM, Job Orders, Reports, Audit Trail, User Management, Settings).
[ ] Log out clears active session and returns to Account Selection.

## B. PUBLIC PAGES & BRANCH LOCATOR MAP
[ ] Public navigation (Home, Services, Track Shoes, Branches, Reviews, About) loads without errors.
[ ] Branch Locator Map displays all 7 branches with `Wash My Kicks – Pasig City` set as Branch `#1 (Flagship Store)`.
[ ] Map view toggle switches cleanly between Standard (Esri Street Map, no watermark), Satellite, and Dark views.
[ ] Clicking "Use My Location" calculates nearest branch and driving/distance metrics.
[ ] Clicking "Book This Branch" on any active branch pre-selects that branch in the Booking Wizard.
[ ] "Coming Soon" branches (Montalban Rizal, Morong Rizal, Bacoor Cavite) cannot be booked.

## C. CUSTOMER BOOKING & EMAIL OTP VERIFICATION FLOW
[ ] Customer can start the 5-Step Booking Wizard from Public Booking or Customer Portal.
[ ] Step 1: Active branches can be selected (`Pasig City Flagship`, `San Juan City`, `Quezon City`, `Pateros`).
[ ] Step 2: Active services from the Services Catalog appear with accurate pricing and turnaround duration.
[ ] Step 3: Sneaker Model / Brand and Material / Special Care Notes are required before proceeding.
[ ] Step 4: Calendar starts on the current month/date; past dates and previous months are disabled.
[ ] Step 4: Time slots display real-time remaining slot availability (`2 slots left` / `1 slot left` / `Full`) per branch and date.
[ ] Step 5: Customer enters email address and clicks "Send Verification Code".
[ ] Customer receives the 6-digit OTP email (via Gmail SMTP `/api/booking-otp`) addressed to the name derived from their email.
[ ] Invalid or expired 6-digit OTP code is rejected; valid 6-digit OTP marks email as `✓ VERIFIED`.
[ ] "Confirm appointment" is blocked until email OTP verification succeeds.
[ ] Confirmed booking generates a unique Job Order ID (`WMK-2026-XXXX`) and appears immediately in Customer Dashboard, Track Shoes, and Staff/Admin queues.
[ ] Public "Track Shoes" page can look up the order by Job Order ID (`WMK-2026-XXXX`) or Customer Email.

## D. STAFF JOB ORDERS & SHOE ASSESSMENT FLOW
[ ] Staff can view incoming bookings in Job Orders and Today's Priority Queue.
[ ] Staff can open a Job Order in the **Shoe Assessment** module.
[ ] Staff can select condition tags (Midsole Oxidation, Suede Water Staining, Upper Creasing, Outsole Heel Drag, Mesh Discoloration, Glue Separation, Scuff Marks, Deep Mud / Odor).
[ ] Staff can record specialist assessment notes and confirm sneaker brand/model label.
[ ] Staff can upload intake ("Before") photos directly during Shoe Assessment.
[ ] Completing Shoe Assessment marks the order as Assessed (`✔ Yes`) and advances status to `In Progress`.

## E. 4-ANGLE BEFORE & AFTER DOCUMENTATION FLOW
[ ] Staff can select any assigned order in **Before & After Documentation**.
[ ] All 4 required sneaker angles (`Left side`, `Right side`, `Toe box`, `Sole`) are selectable.
[ ] Upload buttons use consistent formatting across all 4 angles (`Upload Left side Before` / `Upload Left side After`, `Upload Right side Before` / `Upload Right side After`, `Upload Toe box Before` / `Upload Toe box After`, `Upload Sole Before` / `Upload Sole After`).
[ ] Uploading a local image updates the side-by-side Before & After comparison preview immediately.
[ ] Documentation Set checklist tracks completion across all 4 angles (`X of 4 shoe angles complete`).
[ ] Customer can view uploaded 4-angle Before & After documentation in real time on their **Track Shoes** tab.

## F. ASSIGNED SERVICES & 5-STAGE ORDER TRACKING FLOW
[ ] Staff Assigned Services displays orders in a structured table format matching Service History.
[ ] Staff and Admin can update order status across all 5 stages (`Pending Assessment` → `In Progress` → `Quality Check` → `Ready for Pickup` → `Completed`).
[ ] Admin can assign or reassign the handling Sneaker Specialist (`Carlo Mendoza`, `Marco Santos`, `Paolo Rivera`).
[ ] Customer **Track Shoes** table and 5-stage progress tracker reflect status changes immediately.
[ ] Customer **Notifications** tab and bell badge update dynamically based on their own active orders.
[ ] Completed orders appear in Customer **Service History** and increment the customer's Completed Services count.
[ ] Customer can submit a star rating (`1★`–`5★`) and written feedback in the **Reviews** tab.

## G. SERVICES CATALOG MANAGEMENT (ADMIN)
[ ] Admin can view all services in the **Services** tab.
[ ] Admin can add a new sneaker care service with Service Name, Description, Price (`₱`), and Turnaround duration.
[ ] Admin can inline-edit an existing service's title, description, price, and turnaround duration.
[ ] Admin can **Archive** a service, hiding it from the Customer Booking Wizard and Public Services listing.
[ ] Admin can **Restore** an archived service back to the active booking catalog.

## H. INVENTORY MANAGEMENT FLOW (STAFF & ADMIN)
[ ] Inventory starts clean with live records and branch filtering (`All Branches` for Admin, assigned branch default for Staff).
[ ] Staff/Admin can add a new inventory consumable with Item Name, Category (`Cleaning Solution`, `Brushes & Tools`, `Repellent & Coating`, `Packaging`, `Restoration Supply`), Branch, Initial Stock, Target Par Level, and Unit.
[ ] Staff/Admin can adjust stock quantities (`-1`, `+1`, `+5`) and edit Target Par Level inline.
[ ] Inventory status badge automatically updates between `Healthy`, `Low Stock`, and `Critical` (`0` or severe deficit).
[ ] Low Stock and Critical items trigger live alerts in Staff Notifications and Admin Inventory Alerts KPI.
[ ] Search and status filter (`All`, `Low Stock`, `Critical`, `Healthy`) filter the inventory table accurately.
[ ] Admin can delete an obsolete inventory item; Staff delete action is restricted by RBAC.

## I. DASHBOARDS, REPORTS, CRM & EXCEL (`.XLSX`) EXPORTS
[ ] Customer, Staff, and Admin dashboards load without errors and display live metrics from Supabase.
[ ] Admin **Reports** KPI cards and **Day-by-Day Revenue & Operations Log** start at `₱0` / `0 orders` on a fresh database and update day by day as orders are booked.
[ ] Admin **4 Analytics Charts** (Orders Per Branch, Daily Revenue Trends, Inventory Usage, Service Popularity) calculate live percentages and counts from actual records.
[ ] Admin **CRM** table lists registered customers, their preferred branch, completed pairs, and automatic loyalty tier (`Member`, `Silver Member`, `Gold Member`, `VIP Sneakerhead`).
[ ] Native `.xlsx` Excel export downloads and opens cleanly in Microsoft Excel / Google Sheets for:
  - [ ] Admin Full Financial & Operations Multi-Sheet Report (`.xlsx`)
  - [ ] Admin All-Branch Job Orders (`.xlsx`)
  - [ ] Admin CRM Customers (`.xlsx`)
  - [ ] Staff Branch Job Orders (`.xlsx`)
  - [ ] Staff Branch Customers (`.xlsx`)
  - [ ] Staff / Admin Branch Inventory (`.xlsx`)

## J. AUDIT TRAIL, USER MANAGEMENT & FINAL CLEANUP
[ ] Admin **Audit Trail** displays chronological security and operations logs without hardcoded fake rows.
[ ] Admin **User Management** lists registered Customer, Staff, and Administrator accounts and allows suspending/activating accounts.
[ ] Admin **Settings** displays the Role-Based Access Control (RBAC) Policy Matrix and triggers daily backup manifest snapshots.
[ ] No hardcoded demo orders, fake notifications, or pre-filled login credentials appear for newly created accounts.
[ ] Empty states across all tables and notification panels are clear and professional.
[ ] Browser console has no critical errors during the end-to-end production flow.
