import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BranchLocatorMap } from './components/BranchLocatorMap'
import {
  checkCustomerAccountByEmail,
  createBookingRecord,
  dispatchTransactionalEmail,
  fetchLiveProductionData,
  loadCachedProductionData,
  registerCustomerAccount,
  requestPasswordResetEmail,
  resolveCustomerAccountEmail,
  saveLiveProductionInventory,
  saveLiveProductionOrders,
  signInWithRole,
  signOutSession,
  submitCustomerCrmInteraction,
  triggerDatabaseBackupManifest,
  updateServiceOrderStatus,
  uploadAssessmentPhotoToStorage,
  upsertShoeAssessmentRecord,
  verifyPersistedSessionRole,
} from './lib/api'
import { downloadExcel, exportDateStamp, pesoToNumber } from './lib/excelExport'
import { supabase } from './lib/supabase'
import {
  BeforeAfterDocumentationModule,
  INITIAL_INVENTORY_RECORDS,
  InventoryManagementModule,
  InventoryRecord,
  ServiceStatusTimeline,
  ShoeAngleKey,
  ShoeDocumentation,
  StaffAssignedServicesModule,
  StaffShoeAssessmentModule,
  StatusBadge,
  StatusSelect,
  createDefaultDocumentation,
  getInventoryStatus,
} from './components/OperationsModules'
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Package,
  Plus,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import './styles.css'

/* ============================================================================
   SHARED DATA & TYPES
   ============================================================================ */

type Role = 'customer' | 'staff' | 'admin'

export type Service = {
  id: string
  title: string
  copy: string
  price: string
  numericPrice: number
  duration: string
  archived?: boolean
}

const services: Service[] = [
  { id: '01', title: 'Basic Cleaning', copy: 'Exterior clean, midsole care, and freshening.', price: '₱350', numericPrice: 350, duration: '2–3 days', archived: false },
  { id: '02', title: 'Deep Cleaning', copy: 'Full upper, sole, insole, and lace deep clean.', price: '₱650', numericPrice: 650, duration: '3–5 days', archived: false },
  { id: '03', title: 'Restoration', copy: 'Color revival, de-yellowing, and repainting.', price: 'From ₱1,200', numericPrice: 1200, duration: '7–14 days', archived: false },
  { id: '04', title: 'Shoe Repair', copy: 'Sole reglue, stitching, and damage repair.', price: 'From ₱800', numericPrice: 800, duration: '5–10 days', archived: false },
  { id: '05', title: 'Shoe Protection', copy: 'Water and stain-repellent premium coating.', price: '₱280', numericPrice: 280, duration: '1 day', archived: false },
]

const staffBranches = [
  'Wash My Kicks – Pasig City',
  'Wash My Kicks – San Juan City',
  'Wash My Kicks – Quezon City',
  'Wash My Kicks – Pateros',
  'Wash My Kicks – Montalban Rizal',
  'Wash My Kicks – Morong Rizal',
  'Wash My Kicks – Bacoor Cavite',
]

const wizardBranches = [
  { id: 1, name: 'Wash My Kicks – Pasig City', address: 'West Capitol Dr., Brgy. Kapitolyo, Pasig City (Flagship Store)', comingSoon: false },
  { id: 2, name: 'Wash My Kicks – San Juan City', address: '300 Col. Bonny Serrano Ave., San Juan City', comingSoon: false },
  { id: 3, name: 'Wash My Kicks – Quezon City', address: 'Tomas Morato Ave. cor. Scout Lozano, Quezon City', comingSoon: false },
  { id: 4, name: 'Wash My Kicks – Pateros', address: '402 G. De Borja St., Brgy. Aguho, Pateros', comingSoon: false },
  { id: 5, name: 'Wash My Kicks – Montalban, Rizal', address: 'E. Rodriguez Hwy, Montalban, Rizal', comingSoon: false },
  { id: 6, name: 'Wash My Kicks – Morong, Rizal', address: '2nd Floor A5R Commercial Space Rental, Manila East Road, Morong, Rizal', comingSoon: false },
  { id: 7, name: 'Wash My Kicks – Bacoor, Cavite', address: 'Cerritos Trails Molino 3, Bacoor, Cavite', comingSoon: false },
  { id: 8, name: 'Wash My Kicks – 8th Branch', address: 'Location to be announced', comingSoon: true },
]

export type JobOrder = {
  id: string
  customer: string
  email: string
  shoe: string
  shoeBrand?: string
  shoeModel?: string
  service: string
  branch: string
  date: string
  time: string
  price: string
  status: 'Pending Assessment' | 'In Progress' | 'Quality Check' | 'Ready for Pickup' | 'Completed'
  stageIndex: number
  specialist: string
  assessed: boolean
  assessmentNotes?: string
  conditionTags?: string[]
  beforePhoto?: string
  afterPhoto?: string
  linkedToAccount?: boolean
  docs: ShoeDocumentation
}

const initialOrders: JobOrder[] = []

const CUSTOMER_PREFS_STORAGE_KEY = 'wmk-customer-prefs-v1'

type CustomerProfilePrefs = {
  name?: string
  phone?: string
  branch?: string
}

function loadCustomerProfilePrefs(email?: string): CustomerProfilePrefs | null {
  const key = (email || '').trim().toLowerCase()
  if (!key) return null
  try {
    const map = JSON.parse(localStorage.getItem(CUSTOMER_PREFS_STORAGE_KEY) || '{}')
    return map && typeof map === 'object' ? map[key] || null : null
  } catch {
    return null
  }
}

function saveCustomerProfilePrefs(email: string, prefs: CustomerProfilePrefs): void {
  const key = (email || '').trim().toLowerCase()
  if (!key) return
  try {
    const map = JSON.parse(localStorage.getItem(CUSTOMER_PREFS_STORAGE_KEY) || '{}')
    const next = map && typeof map === 'object' ? { ...map, [key]: prefs } : { [key]: prefs }
    localStorage.setItem(CUSTOMER_PREFS_STORAGE_KEY, JSON.stringify(next))
  } catch {}
}

function findBranchIdByName(branchName?: string): number {
  const norm = (s: string) => s.replace(/,/g, '').trim().toLowerCase()
  const target = norm(branchName || '')
  if (!target) return 1
  const match = wizardBranches.find((b) => norm(b.name) === target || norm(b.name).includes(target) || target.includes(norm(b.name.replace('Wash My Kicks – ', ''))))
  return match && !match.comingSoon ? match.id : 1
}

async function applyOrderStatusUpdate({
  id,
  nextStatus,
  orders,
  setOrders,
  showToast,
  actorName,
}: {
  id: string
  nextStatus: JobOrder['status']
  orders: JobOrder[]
  setOrders: React.Dispatch<React.SetStateAction<JobOrder[]>>
  showToast: (msg: string) => void
  actorName?: string
}) {
  const stageMap: Record<JobOrder['status'], number> = {
    'Pending Assessment': 2,
    'In Progress': 3,
    'Quality Check': 4,
    'Ready for Pickup': 5,
    Completed: 5,
  }
  const targetOrder = orders.find((o) => o.id === id)
  setOrders((prev) =>
    prev.map((o) =>
      o.id === id
        ? {
            ...o,
            status: nextStatus,
            stageIndex: stageMap[nextStatus],
            specialist:
              actorName &&
              (!o.specialist ||
                o.specialist === 'Carlo Mendoza' ||
                o.specialist === 'Pending Specialist Assessment' ||
                o.specialist === 'Assigned Specialist')
                ? actorName
                : o.specialist,
          }
        : o
    )
  )

  const resolvedEmail = resolveCustomerAccountEmail(targetOrder?.email, targetOrder?.customer)
  showToast(
    nextStatus === 'Ready for Pickup'
      ? `Order ${id} marked Ready for Pickup. Sending notification email...`
      : `Order ${id} status updated to "${nextStatus}".`
  )

  const res = await updateServiceOrderStatus({
    orderNumber: id,
    nextStatus,
    customerEmail: resolvedEmail || targetOrder?.email,
    customerName: targetOrder?.customer,
    shoeName: targetOrder?.shoe,
    serviceName: targetOrder?.service,
    branchName: targetOrder?.branch,
    price: targetOrder?.price,
  })

  if (nextStatus === 'Ready for Pickup') {
    if (res.emailSent && res.sentTo) {
      showToast(`Order ${id} is Ready for Pickup — email sent to ${res.sentTo} (${targetOrder?.branch}).`)
    } else if (!resolvedEmail) {
      showToast(`Order ${id} marked Ready for Pickup (no customer email on file).`)
    } else {
      showToast(`Order ${id} marked Ready for Pickup (email failed: ${res.emailError || 'SMTP error'}).`)
    }
  } else if (res.emailSent && res.sentTo) {
    showToast(`Order ${id} updated to "${nextStatus}" — email update sent to ${res.sentTo}.`)
  }
}

export type ReviewItem = {
  id: string
  author: string
  service: string
  branch: string
  rating: number
  quote: string
  date: string
}

const initialReviews: ReviewItem[] = [
  { id: 'r1', author: 'Angela M.', service: 'Restoration', branch: 'Wash My Kicks – San Juan City', rating: 5, quote: 'Brought in my beat-up white AF1s at San Juan. Midsoles came back clean and the smell is gone.', date: 'March 18, 2026' },
  { id: 'r2', author: 'Jiro R.', service: 'Deep Cleaning', branch: 'Wash My Kicks – Quezon City', rating: 5, quote: 'Got before-and-after photos of my Dunk Lows before pickup at Tomas Morato. Worth the ₱650.', date: 'March 15, 2026' },
  { id: 'r3', author: 'Kaye S.', service: 'Shoe Repair', branch: 'Wash My Kicks – Pasig City', rating: 5, quote: 'Sole reglue on my Jordan 4s held up through three runs already. Quick turnaround at Pasig.', date: 'March 11, 2026' },
]

/* ============================================================================
   ROLE-BASED ACCESS CONTROL (RBAC) MATRIX
   ============================================================================ */

export const RBAC_PERMISSIONS: Record<
  Role,
  {
    allowed: string[]
    restricted: string[]
  }
> = {
  customer: {
    allowed: ['Homepage', 'Book Appointment', 'Track Order', 'Notifications', 'Service History', 'Reviews', 'Profile'],
    restricted: ['Inventory', 'Reports', 'User Management', 'Staff Assignment'],
  },
  staff: {
    allowed: [
      'Job Orders',
      'Assessments',
      'Documentation',
      'Status Updates',
      'Inventory',
      'Assigned Services',
      'Customers',
      'Notifications',
    ],
    restricted: ['System Settings', 'User Management', 'Revenue Reports'],
  },
  admin: {
    allowed: ['All Modules', 'Branches', 'Inventory', 'CRM', 'Job Orders', 'Reports', 'Audit Trail', 'User Management', 'Settings'],
    restricted: [],
  },
}

/* ============================================================================
   BRAND, HEADER & FOOTER (UNCHANGED BRANDING & LAYOUT)
   ============================================================================ */

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <button className="brand" type="button" onClick={onClick}>
      <img
        className="brand-logo"
        src={`${typeof window !== 'undefined' && window.location.pathname.startsWith('/WASHMYKICKS-WEB') ? '/WASHMYKICKS-WEB' : ''}/washmykicks-logo.jpg`}
        alt="WashMyKicks shoe cleaning services"
      />
      <span>
        <b>WASHMYKICKS</b>
        <small>SHOE CLEANING &amp; RESTORATION</small>
      </span>
    </button>
  )
}

function Header({
  page,
  setPage,
  activeRole,
}: {
  page: string
  setPage: (page: string) => void
  activeRole: Role | null
}) {
  const [open, setOpen] = useState(false)
  const go = (target: string) => {
    setPage(target)
    setOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return (
    <header className="header">
      <Brand onClick={() => go('home')} />
      <button className="menu" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
        {open ? <X /> : <Menu />}
      </button>
      <nav className={open ? 'nav nav-open' : 'nav'}>
        {[
          ['home', 'Home'],
          ['services', 'Services'],
          ['track', 'Track Shoes'],
          ['branches', 'Branches'],
          ['reviews', 'Reviews'],
          ['about', 'About'],
        ].map(([key, label]) => (
          <button key={key} className={page === key ? 'active' : ''} onClick={() => go(key)}>
            {label}
          </button>
        ))}
        {activeRole ? (
          <button className="nav-cta" onClick={() => go(`dashboard-${activeRole}`)}>
            Return to {activeRole[0].toUpperCase() + activeRole.slice(1)} Dashboard
          </button>
        ) : (
          <button className="nav-cta" onClick={() => go('login-customer')}>
            Log in
          </button>
        )}
      </nav>
    </header>
  )
}

function ServiceCard({ service, onClick }: { service: Service; onClick?: () => void }) {
  return (
    <article className="service-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="service-id">{service.id}</div>
      <div>
        <h3>{service.title}</h3>
        <p>{service.copy}</p>
      </div>
      <div className="service-meta">
        <b>{service.price}</b>
        <span>
          <Clock3 size={14} />
          {service.duration}
        </span>
      </div>
      <ChevronRight />
    </article>
  )
}

function Footer({ setPage }: { setPage: (page: string) => void }) {
  return (
    <footer>
      <div className="footer-brand">
        <Brand onClick={() => setPage('home')} />
        <p>Hand-washed, reglued, and restored across 7 branches in Metro Manila, Rizal, and Cavite.</p>
      </div>
      <div>
        <b>Explore</b>
        <button onClick={() => setPage('services')}>Services</button>
        <button onClick={() => setPage('track')}>Track order</button>
        <button onClick={() => setPage('branches')}>Branches</button>
      </div>
      <div>
        <b>Account</b>
        <button onClick={() => setPage('login-customer')}>Customer Login</button>
        <button onClick={() => setPage('book')}>Book Appointment</button>
      </div>
      <form onSubmit={(e) => e.preventDefault()}>
        <b>Service updates</b>
        <p>Get care tips and branch promos.</p>
        <div className="email">
          <input type="email" placeholder="Your email address" aria-label="Email address" />
          <button type="submit">Join</button>
        </div>
      </form>
      <small className="copyright">© 2026 WashMyKicks. All rights reserved.</small>
    </footer>
  )
}

/* ============================================================================
   PUBLIC PAGES
   ============================================================================ */

function Home({
  setPage,
  onBookBranch,
  servicesCatalog = services,
}: {
  setPage: (page: string) => void
  onBookBranch: (branchName: string, branchId: number) => void
  servicesCatalog?: Service[]
}) {
  const activeServices = servicesCatalog.filter((s) => !s.archived)
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>
            WE BRING YOUR
            <br />
            KICKS <em>BACK.</em>
          </h1>
          <p>
            Hand-cleaned, reglued, and restored by sneaker techs across 7 Metro Manila, Rizal, and Cavite branches. Book a drop-off and pay at the shop after inspection.
          </p>
          <div className="actions">
            <button className="primary" onClick={() => setPage('book')}>
              Book a drop-off <ArrowRight size={16} />
            </button>
            <button className="text-button" onClick={() => setPage('track')}>
              Track my shoes
            </button>
          </div>
          <div className="social-proof">
            <span className="avatars">A M J</span>
            <span>
              <b>4.9/5</b> from 2,800+ Metro Manila pairs cleaned
            </span>
          </div>
        </div>
        <div className="hero-image">
          <div className="quality-card">
            <Check size={16} />
            <span>
              <b>Pay at the branch</b>
              <small>After we inspect your pair</small>
            </span>
          </div>
        </div>
      </section>
      <div className="ticker">
        DEEP CLEAN <i /> RESTORATION <i /> SOLE REGLUE <i /> WATER REPELLENT <i /> DE-YELLOWING <i /> 7 ACTIVE BRANCHES
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <h2>Services &amp; Rates</h2>
          </div>
          <button className="text-button" onClick={() => setPage('services')}>
            See all services <ArrowRight size={16} />
          </button>
        </div>
        <div className="services-grid">
          {activeServices.slice(0, 4).map((s) => (
            <ServiceCard key={s.id} service={s} onClick={() => setPage('book')} />
          ))}
        </div>
      </section>
      <section className="standard">
        <div className="standard-image">
          <span>RESTORED</span>
        </div>
        <div className="standard-copy">
          <h2>
            No guesswork.
            <br />
            You see the work.
          </h2>
          <p>
            We check your pair at the counter, take before-and-after photos of all four angles, and message you the moment it is ready for pickup.
          </p>
          <ul>
            <li>4-angle before &amp; after photos (left, right, toe box, sole)</li>
            <li>Dedicated shoe tech per pair</li>
            <li>Real-time status tracking by Job Order ID</li>
            <li>Pay at the branch after final check</li>
          </ul>
          <button className="primary" onClick={() => setPage('reviews')}>
            Read customer reviews <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <section className="stats">
        {[
          ['12K+', 'PAIRS CLEANED'],
          ['4.9', 'SHOP RATING'],
          ['7', 'ACTIVE BRANCHES'],
          ['96%', 'REPEAT CUSTOMERS'],
        ].map(([number, label]) => (
          <div key={label}>
            <b>{number}</b>
            <span>{label}</span>
          </div>
        ))}
      </section>
      <section className="section branch-section">
        <div className="section-heading">
          <div>
            <h2>7 Branches Near You</h2>
            <p>Drop off at Pasig Kapitolyo (Flagship), San Juan, Quezon City, Pateros, Montalban, Morong, or Bacoor.</p>
          </div>
          <button className="text-button" onClick={() => setPage('branches')}>
            View all branches <ArrowRight size={16} />
          </button>
        </div>
        <BranchLocatorMap onBookBranch={onBookBranch} />
      </section>
      <section className="cta">
        <h2>Got a pair sitting in the box?</h2>
        <p>Book a drop-off slot in under a minute. Pay at the branch after we inspect your shoes.</p>
        <button className="primary light" onClick={() => setPage('book')}>
          Book a drop-off <ArrowRight size={16} />
        </button>
      </section>
    </>
  )
}

function Listing({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section className="listing">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {children}
    </section>
  )
}

function Services({
  setPage,
  servicesCatalog = services,
}: {
  setPage: (p: string) => void
  servicesCatalog?: Service[]
}) {
  const activeServices = servicesCatalog.filter((s) => !s.archived)
  return (
    <Listing title="Services & Rates">
      <p className="lead">Straightforward pricing and turnaround times. Pay at the shop after our tech checks your pair.</p>
      <div className="services-grid full">
        {activeServices.map((s) => (
          <ServiceCard service={s} key={s.id} onClick={() => setPage('book')} />
        ))}
      </div>
    </Listing>
  )
}

function Track({ orders, setPage }: { orders: JobOrder[]; setPage: (p: string) => void }) {
  const [query, setQuery] = useState('')
  const matched =
    (query.trim() && orders.find((o) => o.id.toLowerCase() === query.trim().toLowerCase())) ||
    (!query.trim() ? orders[0] : undefined)
  return (
    <Listing title="Track Your Shoes">
      <p className="lead">Enter your job order number to check the current stage of your pair.</p>
      <div className="tracking-box">
        <label>
          Job order number
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. WMK-2026-2553" />
        </label>
        {matched ? (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <b>{matched.id} · {matched.shoe}</b>
              <StatusBadge status={matched.status} />
            </div>
            <p style={{ margin: '6px 0 12px', fontSize: 12 }}>
              {matched.service} · {matched.branch} · Tech: {matched.specialist}
            </p>
            <ServiceStatusTimeline currentStatus={matched.status} />
          </div>
        ) : (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 18, color: '#6b7280', fontSize: 13 }}>
            {orders.length === 0
              ? 'No orders yet. Book a drop-off to get your job order number.'
              : 'No matching job order found for that reference number.'}
          </div>
        )}
        <button className="primary" onClick={() => setPage('login-customer')}>
          Log in to view full order history <ArrowRight size={16} />
        </button>
        <p>
          Need a clean? <button onClick={() => setPage('book')}>Book a drop-off</button>
        </p>
      </div>
    </Listing>
  )
}

function Branches({
  onBookBranch,
}: {
  onBookBranch: (branchName: string, branchId: number) => void
}) {
  return (
    <Listing title="Our Branches">
      <p className="lead">
        Find the closest Wash My Kicks shop, check opening hours, and book your drop-off directly.
      </p>
      <div style={{ marginBottom: 40 }}>
        <BranchLocatorMap onBookBranch={onBookBranch} />
      </div>
      <div className="branch-cards">
        {wizardBranches.map((branch, i) => (
          <article key={branch.id}>
            <span>0{i + 1}</span>
            <h3>{branch.name}</h3>
            <p>{branch.address}</p>
            <p>Open daily · 10:00 AM – 8:00 PM</p>
            <button
              disabled={branch.comingSoon}
              onClick={() => !branch.comingSoon && onBookBranch(branch.name, branch.id)}
            >
              {branch.comingSoon ? 'Coming Soon' : 'Book Here'} <ArrowRight size={15} />
            </button>
          </article>
        ))}
      </div>
    </Listing>
  )
}

function Reviews({ reviews }: { reviews: ReviewItem[] }) {
  return (
    <Listing title="Customer Reviews">
      <div className="review-grid">
        {reviews.map((r) => (
          <article key={r.id}>
            <div>
              {Array.from({ length: r.rating }).map((_, x) => (
                <Star fill="currentColor" key={x} size={15} />
              ))}
            </div>
            <blockquote>“{r.quote}”</blockquote>
            <p>
              {r.author} · {r.service} ({r.branch.replace('Wash My Kicks – ', '')})
            </p>
          </article>
        ))}
      </div>
    </Listing>
  )
}

function About() {
  return (
    <Listing title="About Wash My Kicks">
      <p className="lead">
        Started in Metro Manila by people who wear and collect sneakers every day. Whether it is a daily beater, suede runners, or deadstock Jordans, we clean and repair every pair by hand and document the job before you pick it up.
      </p>
      <div className="about-strip">
        <div>
          <b>12K+</b>
          <span>pairs cleaned</span>
        </div>
        <div>
          <b>7</b>
          <span>active branches</span>
        </div>
        <div>
          <b>4.9/5</b>
          <span>shop rating</span>
        </div>
      </div>
    </Listing>
  )
}

/* ============================================================================
   ROLE-SPECIFIC LOGIN PAGES (CUSTOMER, STAFF, ADMIN)
   ============================================================================ */

function RoleLogin({
  role,
  setPage,
  onLoginSuccess,
}: {
  role: Role
  setPage: (page: string) => void
  onLoginSuccess: (role: Role, meta: { email: string; employeeId?: string; branch?: string; name?: string }) => void
}) {
  const isCustomer = role === 'customer'
  const isStaff = role === 'staff'
  const isAdmin = role === 'admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [branch, setBranch] = useState(staffBranches[0])
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [fullName, setFullName] = useState('')
  const [forgotMessage, setForgotMessage] = useState('')
  const [isErrorMsg, setIsErrorMsg] = useState(false)

  const roleLabel = isAdmin ? 'Administrator' : isStaff ? 'Staff' : 'Customer'
  const perms = RBAC_PERMISSIONS[role]

  const deriveDisplayName = (emailStr: string, providedName?: string) => {
    if (providedName && providedName.trim()) return providedName.trim()
    const local = (emailStr || '').split('@')[0] || ''
    const cleaned = local.replace(/[0-9]+/g, ' ').replace(/[._-]+/g, ' ').trim()
    if (!cleaned) return local || roleLabel
    return cleaned
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotMessage('')
    setIsErrorMsg(false)
    try {
      const roleEnum = isAdmin ? 'ADMINISTRATOR' : isStaff ? 'STAFF' : 'CUSTOMER'
      const branchIdx = Math.max(1, staffBranches.indexOf(branch) + 1)

      if (isCreatingAccount) {
        if (!isCustomer) {
          throw new Error('Staff and administrator accounts can only be provisioned by an administrator.')
        }
        const parts = (fullName.trim() || deriveDisplayName(email)).split(' ')
        const regRes = await registerCustomerAccount({
          email,
          password,
          firstName: parts[0] || roleLabel,
          lastName: parts.slice(1).join(' ') || 'Account',
          role: 'CUSTOMER',
        })
        const metaName = deriveDisplayName(
          email,
          fullName ||
            [regRes.user?.user_metadata?.first_name, regRes.user?.user_metadata?.last_name]
              .filter(Boolean)
              .join(' ')
        )
        onLoginSuccess(role, {
          email: email.trim(),
          employeeId: isStaff ? employeeId.trim() : undefined,
          branch: isStaff ? branch : undefined,
          name: metaName,
        })
        return
      }

      const authRes = await signInWithRole({
        email,
        password,
        expectedRole: roleEnum,
        branchId: isStaff ? branchIdx : undefined,
        branchName: isStaff ? branch : undefined,
        employeeId: isStaff ? employeeId : undefined,
      })

      const meta = authRes.user?.user_metadata || {}
      const resolvedName = deriveDisplayName(
        email,
        [meta.first_name, meta.last_name].filter(Boolean).join(' ')
      )
      const resolvedBranch = isStaff ? String(meta.branch_name || branch) : undefined
      const resolvedEmpId = isStaff ? String(meta.employee_id || employeeId) : undefined

      onLoginSuccess(role, {
        email: email.trim(),
        employeeId: resolvedEmpId,
        branch: resolvedBranch,
        name: resolvedName,
      })
    } catch (err: any) {
      setIsErrorMsg(true)
      setForgotMessage(err?.message || 'Invalid credentials or account not registered in Supabase Auth.')
    }
  }

  return (
    <section className="auth-screen">
      <div className="auth-story">
        <Brand onClick={() => setPage('home')} />
        <div>
          <h1>
            Clean pairs.
            <br />
            Zero guesswork.
          </h1>
          <p>
            Drop off your sneakers at any of our 7 branches, get 4-angle before-and-after photos, and pay at the counter after we check your pair.
          </p>
        </div>
        <div className="auth-rbac-preview">
          <h4>Shop Hours &amp; Locations</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, color: '#d1d5db' }}>
            <div>
              <b style={{ color: '#fff' }}>Flagship Store:</b> West Capitol Dr., Brgy. Kapitolyo, Pasig City
            </div>
            <div>
              <b style={{ color: '#fff' }}>Store Hours:</b> Open Daily, 10:00 AM – 8:00 PM
            </div>
            <div>
              <b style={{ color: '#fff' }}>Branches:</b> Pasig · San Juan · Quezon City · Pateros · Montalban · Morong · Bacoor
            </div>
          </div>
        </div>
      </div>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-mobile-brand">
            <Brand onClick={() => setPage('home')} />
          </div>
          <button type="button" className="back-link" onClick={() => setPage('home')}>
            <ArrowLeft size={14} /> Back to Home
          </button>

          <h1>{isCreatingAccount ? `Create ${roleLabel} Account` : `${roleLabel} Sign In`}</h1>
          <p>
            {isCustomer
              ? isCreatingAccount
                ? 'Create an account to book drop-offs and track your pairs.'
                : 'Sign in to book a drop-off or check on your shoes.'
              : isStaff
              ? isCreatingAccount
                ? 'Create a branch staff account for your assigned shop.'
                : 'Sign in with your branch staff account.'
              : isCreatingAccount
              ? 'Create an administrator account for Wash My Kicks.'
              : 'Sign in to manage branches, orders, and inventory.'}
          </p>

          {forgotMessage && (
            <div
              style={{
                background: isErrorMsg ? '#fef2f2' : '#ecfdf5',
                border: isErrorMsg ? '1px solid #fecaca' : '1px solid #a7f3d0',
                color: isErrorMsg ? '#991b1b' : '#065f46',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 12,
                marginBottom: 14,
              }}
            >
              {forgotMessage}
            </div>
          )}

          {isCreatingAccount && (
            <label>
              Full Name
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </label>
          )}

          {isStaff && (
            <>
              <label>
                Employee ID
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="Enter your Employee ID (e.g. WMK-EMP-0104)"
                />
              </label>

              <label>
                Assigned Branch
                <select value={branch} onChange={(e) => setBranch(e.target.value)} required>
                  {staffBranches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label>
            {isAdmin ? 'Administrator Email' : 'Email Address'}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isAdmin ? 'Enter administrator email' : 'Enter your email address'}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </label>

          <button type="submit" className="primary auth-submit">
            {isCreatingAccount ? `Register ${roleLabel} Account` : 'Sign In'} <ArrowRight size={16} />
          </button>

          <div className="auth-links-row">
            <button
              type="button"
              onClick={() => {
                if (!email.trim()) {
                  setIsErrorMsg(true)
                  setForgotMessage('Enter your email address first to request a password reset.')
                  return
                }
                void requestPasswordResetEmail(email.trim()).catch(() => null)
                setIsErrorMsg(false)
                setForgotMessage(`If an account exists for ${email.trim()}, password reset instructions have been sent.`)
              }}
            >
              Forgot Password?
            </button>
            {isCustomer ? (
              <button
                type="button"
                onClick={() => {
                  setIsCreatingAccount(!isCreatingAccount)
                  setForgotMessage('')
                  setIsErrorMsg(false)
                }}
              >
                {isCreatingAccount ? 'Already registered? Sign In' : 'Create Account'}
              </button>
            ) : (
              <span style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 500 }}>
                Provisioned by WashMyKicks HQ
              </span>
            )}
          </div>
        </form>
      </div>
    </section>
  )
}

/* ============================================================================
   SINGLE-PAGE CUSTOMER BOOKING FORM (CLEAN, FAST, ZERO-SLOP)
   ============================================================================ */

function CustomerBookAppointmentWizard({
  initialBranchId = 1,
  preselectedFromMap = false,
  existingOrders = initialOrders,
  servicesCatalog = services,
  defaultEmail = '',
  accountEmail = '',
  accountName = '',
  onCompleteBooking,
  onCancel,
}: {
  initialBranchId?: number
  preselectedFromMap?: boolean
  existingOrders?: JobOrder[]
  servicesCatalog?: Service[]
  defaultEmail?: string
  accountEmail?: string
  accountName?: string
  onCompleteBooking: (newOrder: JobOrder) => void
  onCancel: () => void
}) {
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDate = today.getDate()

  const activeServices = servicesCatalog.filter((s) => !s.archived)
  const [selectedBranchId, setSelectedBranchId] = useState<number>(initialBranchId)
  const [selectedServiceId, setSelectedServiceId] = useState<string>('02')
  const [calendarYear, setCalendarYear] = useState<number>(todayYear)
  const [calendarMonth, setCalendarMonth] = useState<number>(todayMonth)
  const [selectedDay, setSelectedDay] = useState<number>(todayDate)
  const [selectedTime, setSelectedTime] = useState<string>('10:30 AM')
  const [shoeBrand, setShoeBrand] = useState<string>('')
  const [shoeModel, setShoeModel] = useState<string>('')

  // Booking Email Verification (OTP) state
  const [customerEmail, setCustomerEmail] = useState<string>(defaultEmail)
  const [otpSent, setOtpSent] = useState<boolean>(false)
  const [otpSending, setOtpSending] = useState<boolean>(false)
  const [otpMode, setOtpMode] = useState<'server-hmac' | 'supabase-auth'>('server-hmac')
  const [otpToken, setOtpToken] = useState<string>('')
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0)
  const [enteredOtp, setEnteredOtp] = useState<string>('')
  const [otpVerified, setOtpVerified] = useState<boolean>(false)
  const [otpNotice, setOtpNotice] = useState<string>('')
  const [detectedAccount, setDetectedAccount] = useState<{
    checking: boolean
    hasAccount: boolean
    customerName?: string
    preferredBranch?: string
  }>({ checking: false, hasAccount: false })
  const [remoteSlotCounts, setRemoteSlotCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (defaultEmail && !customerEmail) {
      setCustomerEmail(defaultEmail)
    }
  }, [defaultEmail])

  useEffect(() => {
    const emailCandidate = customerEmail.trim().toLowerCase()
    if (!emailCandidate || !emailCandidate.includes('@') || !emailCandidate.includes('.')) {
      setDetectedAccount({ checking: false, hasAccount: false })
      return
    }

    let cancelled = false
    setDetectedAccount((prev) => ({ ...prev, checking: true }))
    const timer = window.setTimeout(() => {
      checkCustomerAccountByEmail(emailCandidate)
        .then((res) => {
          if (cancelled) return
          setDetectedAccount({
            checking: false,
            hasAccount: res.hasAccount,
            customerName: res.customerName,
            preferredBranch: res.preferredBranch,
          })
        })
        .catch(() => {
          if (cancelled) return
          setDetectedAccount({ checking: false, hasAccount: false })
        })
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [customerEmail])

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  const currentMonthName = monthNames[calendarMonth]
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay()
  const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate()
  const prevMonthTrailingDays = Array.from(
    { length: firstDayOfWeek },
    (_, idx) => daysInPrevMonth - firstDayOfWeek + idx + 1
  )
  const isCurrentMonth = calendarYear === todayYear && calendarMonth === todayMonth
  const canGoPrevMonth =
    calendarYear > todayYear || (calendarYear === todayYear && calendarMonth > todayMonth)
  const minAllowedDay = isCurrentMonth ? todayDate : 1
  const activeSelectedDay = Math.max(minAllowedDay, Math.min(selectedDay, daysInMonth))
  const formattedDate = `${currentMonthName} ${activeSelectedDay}, ${calendarYear}`

  const handlePrevMonth = () => {
    if (!canGoPrevMonth) return
    if (calendarMonth === 0) {
      setCalendarMonth(11)
      setCalendarYear((y) => y - 1)
    } else {
      setCalendarMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0)
      setCalendarYear((y) => y + 1)
    } else {
      setCalendarMonth((m) => m + 1)
    }
  }

  useEffect(() => {
    setSelectedBranchId(initialBranchId)
  }, [initialBranchId])

  const selectedBranch = wizardBranches.find((b) => b.id === selectedBranchId) || wizardBranches[0]
  const selectedService =
    activeServices.find((s) => s.id === selectedServiceId) || activeServices[0] || services[1]

  // Fetch live slot availability whenever branch or date changes
  useEffect(() => {
    const q = new URLSearchParams({
      branch: selectedBranch.name,
      date: formattedDate,
    })
    fetch(`/api/available-slots?${q.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.slots && Array.isArray(data.slots)) {
          const map: Record<string, number> = {}
          for (const item of data.slots) {
            map[item.slot] = Number(item.booked) || 0
          }
          setRemoteSlotCounts(map)
        }
      })
      .catch(() => {})
  }, [selectedBranch.name, formattedDate])

  const timeSlots = [
    '10:00 AM',
    '10:30 AM',
    '11:30 AM',
    '01:00 PM',
    '02:30 PM',
    '04:00 PM',
    '05:30 PM',
    '06:30 PM',
  ]

  const MAX_SLOT_CAPACITY = 2

  const getSlotAvailability = (slot: string) => {
    const localCount = existingOrders.filter(
      (o) => o.branch === selectedBranch.name && o.date === formattedDate && o.time === slot
    ).length
    const remoteCount = remoteSlotCounts[slot] || 0
    const booked = Math.max(localCount, remoteCount)
    const remaining = Math.max(0, MAX_SLOT_CAPACITY - booked)
    return {
      booked,
      remaining,
      isFull: remaining === 0,
    }
  }

  const getCustomerNameFromEmail = (emailStr: string): string => {
    const local = (emailStr || '').split('@')[0] || ''
    const cleaned = local
      .replace(/[0-9]+/g, ' ')
      .replace(/[._-]+/g, ' ')
      .trim()
    if (cleaned) {
      return cleaned
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ')
    }
    return local || 'Customer'
  }

  const handleSendBookingOtp = async () => {
    const emailTarget = customerEmail.trim()
    if (!emailTarget || !emailTarget.includes('@')) {
      setOtpNotice('Enter a valid email address first.')
      return
    }

    const derivedName = getCustomerNameFromEmail(emailTarget)
    setOtpSending(true)
    setEnteredOtp('')
    setOtpVerified(false)
    setOtpNotice(`Sending 6-digit code to ${emailTarget}...`)

    try {
      const res = await fetch('/api/booking-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          email: emailTarget,
          customerName: derivedName,
          serviceName: selectedService.title,
          branchName: selectedBranch.name,
          scheduledAt: `${formattedDate} · ${selectedTime}`,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setOtpMode('server-hmac')
        setOtpToken(String(data.token || ''))
        setOtpExpiresAt(Number(data.expiresAt || 0))
        setOtpSent(true)
        setOtpNotice(`Code sent to ${emailTarget}. Check your Inbox or Spam folder.`)
        setOtpSending(false)
        return
      }
      if (res.status === 429 || res.status === 400 || res.status === 403) {
        setOtpSending(false)
        setOtpNotice(String(data?.error || 'Too many verification requests. Please wait a few minutes.'))
        return
      }
    } catch {}

    if (supabase) {
      const { error } = await supabase.auth.signInWithOtp({
        email: emailTarget,
        options: { shouldCreateUser: true },
      })
      if (!error) {
        setOtpMode('supabase-auth')
        setOtpSent(true)
        setOtpNotice(`Verification code sent to ${emailTarget}. Check your Inbox or Spam folder.`)
        setOtpSending(false)
        return
      }
      setOtpSending(false)
      setOtpNotice(`Could not send email (${error.message}).`)
      return
    }

    setOtpSending(false)
    setOtpNotice('Email verification service unavailable. Try again in a moment.')
  }

  const handleVerifyOtp = async (): Promise<{
    ok: boolean
    hasAccount?: boolean
    customerName?: string
  }> => {
    const candidate = enteredOtp.trim()
    const emailTarget = customerEmail.trim()
    if (!candidate || candidate.length < 6) {
      setOtpNotice('Enter the 6-digit code from your email.')
      return { ok: false }
    }

    if (otpMode === 'server-hmac' && otpToken) {
      try {
        const res = await fetch('/api/booking-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify',
            email: emailTarget,
            code: candidate,
            token: otpToken,
            expiresAt: otpExpiresAt,
          }),
        })
        const data = await res.json()
        if (res.ok && data?.verified) {
          setOtpVerified(true)
          if (data?.hasAccount) {
            const acctName = data.customerName ? String(data.customerName) : undefined
            setDetectedAccount({
              checking: false,
              hasAccount: true,
              customerName: acctName,
              preferredBranch: data.preferredBranch ? String(data.preferredBranch) : undefined,
            })
            setOtpNotice('Email verified. WashMyKicks Customer Account detected — booking will appear on your dashboard.')
            return { ok: true, hasAccount: true, customerName: acctName }
          }
          setOtpNotice('Email verified.')
          return { ok: true, hasAccount: detectedAccount.hasAccount, customerName: detectedAccount.customerName }
        }
        setOtpNotice(data?.error || 'Wrong code. Check your email and try again.')
        return { ok: false }
      } catch {
        setOtpNotice('Could not verify code. Try again.')
        return { ok: false }
      }
    }

    if (otpMode === 'supabase-auth' && supabase) {
      const firstTry = await supabase.auth.verifyOtp({
        email: emailTarget,
        token: candidate,
        type: 'email',
      })
      if (!firstTry.error) {
        setOtpVerified(true)
        setOtpNotice(
          detectedAccount.hasAccount
            ? 'Email verified. WashMyKicks Customer Account detected — booking will appear on your dashboard.'
            : 'Email verified.'
        )
        return { ok: true, hasAccount: detectedAccount.hasAccount, customerName: detectedAccount.customerName }
      }
      const secondTry = await supabase.auth.verifyOtp({
        email: emailTarget,
        token: candidate,
        type: 'signup',
      })
      if (!secondTry.error) {
        setOtpVerified(true)
        setOtpNotice(
          detectedAccount.hasAccount
            ? 'Email verified. WashMyKicks Customer Account detected — booking will appear on your dashboard.'
            : 'Email verified.'
        )
        return { ok: true, hasAccount: detectedAccount.hasAccount, customerName: detectedAccount.customerName }
      }
      setOtpNotice(firstTry.error?.message || 'Wrong code. Check your email and try again.')
      return { ok: false }
    }

    setOtpNotice('Click "Send Code" first.')
    return { ok: false }
  }

  const handleConfirm = async () => {
    const cleanBrand = shoeBrand.trim()
    const cleanModel = shoeModel.trim()
    if (!cleanBrand && !cleanModel) {
      setOtpNotice('Enter your shoe brand and model before booking.')
      return
    }

    let verifiedHasAccount = detectedAccount.hasAccount
    let verifiedCustomerName = detectedAccount.customerName

    if (!otpVerified) {
      if (!otpSent) {
        await handleSendBookingOtp()
        return
      }
      const verifyResult = await handleVerifyOtp()
      if (!verifyResult.ok) return
      if (verifyResult.hasAccount) {
        verifiedHasAccount = true
        if (verifyResult.customerName) verifiedCustomerName = verifyResult.customerName
      }
    }

    const otpEmail = customerEmail.trim().toLowerCase()
    const accountPersonalEmail = (accountEmail || '').trim().toLowerCase()
    const notificationEmailFinal = accountPersonalEmail || otpEmail
    const resolvedCustomerName =
      (accountName || '').trim() || verifiedCustomerName || getCustomerNameFromEmail(notificationEmailFinal)
    const numericPrice = Number(selectedService.price.replace(/[^0-9.]/g, '')) || 650
    const scheduledIso = new Date(calendarYear, calendarMonth, activeSelectedDay, 10, 30).toISOString()

    const combinedShoe =
      cleanBrand && cleanModel && !cleanModel.toLowerCase().startsWith(cleanBrand.toLowerCase())
        ? `${cleanBrand} ${cleanModel}`
        : cleanModel || cleanBrand || 'Sneaker Pair'

    const generatedOrderId = `WMK-${calendarYear}-${Math.floor(1850 + Math.random() * 900)}`
    const isLinkedAccount = Boolean(accountPersonalEmail || verifiedHasAccount)

    void createBookingRecord({
      customerId: 1,
      branchServiceId: selectedBranch.id,
      branchId: selectedBranch.id,
      orderNumber: generatedOrderId,
      scheduledAt: scheduledIso,
      priceAtBooking: numericPrice,
      customerRequest: `${combinedShoe} — ${selectedService.title} (${formattedDate} · ${selectedTime}) [${
        isLinkedAccount ? 'Account Linked' : 'Email Verified'
      }]`,
      customerEmail: notificationEmailFinal,
      customerName: resolvedCustomerName,
      serviceName: selectedService.title,
      branchName: selectedBranch.name,
      otpCode: enteredOtp.trim(),
      otpToken,
      otpExpiresAt,
      loggedInSession: Boolean(accountPersonalEmail),
    }).catch(() => null)

    const newOrder: JobOrder = {
      id: generatedOrderId,
      customer: resolvedCustomerName,
      email: notificationEmailFinal,
      shoe: combinedShoe,
      shoeBrand: cleanBrand,
      shoeModel: cleanModel,
      service: selectedService.title,
      branch: selectedBranch.name,
      date: formattedDate,
      time: selectedTime,
      price: selectedService.price.replace('From ', ''),
      status: 'Pending Assessment',
      stageIndex: 1,
      specialist: 'Pending Specialist Assessment',
      assessed: false,
      linkedToAccount: isLinkedAccount,
      docs: createDefaultDocumentation(),
    }
    onCompleteBooking(newOrder)
  }

  const previewShoeLabel =
    [shoeBrand.trim(), shoeModel.trim()].filter(Boolean).join(' ') || 'Enter shoe brand & model above'

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 6px' }}>Book a Drop-Off</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
            Pick a branch, service, and time slot below. You only pay at the shop after our tech inspects your pair.
          </p>
        </div>
        <button type="button" className="outline" onClick={onCancel} style={{ padding: '8px 14px', fontSize: 12.5 }}>
          Cancel
        </button>
      </div>

      {preselectedFromMap && (
        <div
          style={{
            marginBottom: 18,
            padding: '12px 16px',
            borderRadius: 10,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ✓ Selected from map: <b>{selectedBranch.name}</b>
        </div>
      )}

      <div className="wizard-card wmk-booking-wizard-card">
        {/* 1. BRANCH */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>1. Choose Branch</h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>
            All active branches are open daily, 10:00 AM – 8:00 PM.
          </p>
          <div className="wizard-grid-2">
            {wizardBranches
              .filter((b) => !b.comingSoon)
              .map((b) => {
                const isSelected = selectedBranchId === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`choice-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedBranchId(b.id)}
                  >
                    <span className="choice-num">{b.id}</span>
                    <span className="choice-body">
                      <b>{b.name.replace('Wash My Kicks – ', '')}</b>
                      <small>{b.address}</small>
                    </span>
                    {isSelected && <Check size={16} className="choice-check" />}
                  </button>
                )
              })}
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #eceae6', margin: '0 0 28px' }} />

        {/* 2. SERVICE */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>2. Choose Service</h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>
            Final price is confirmed at the counter after we check the material and condition.
          </p>
          <div className="wizard-grid-2">
            {activeServices.map((s) => {
              const isSelected = selectedServiceId === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`choice-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedServiceId(s.id)}
                >
                  <span className="choice-body">
                    <b>{s.title}</b>
                    <small>{s.copy}</small>
                    <span className="price-tag">
                      {s.price} · {s.duration}
                    </span>
                  </span>
                  {isSelected && <Check size={16} className="choice-check" />}
                </button>
              )
            })}
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #eceae6', margin: '0 0 28px' }} />

        {/* 3. YOUR PAIR & SCHEDULE */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>3. Shoe Pair &amp; Drop-Off Time</h3>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>
            Tell us what pair you are bringing and pick an available drop-off date and time.
          </p>

          <div className="wizard-grid-2" style={{ marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Shoe Brand
              </label>
              <input
                type="text"
                value={shoeBrand}
                onChange={(e) => setShoeBrand(e.target.value)}
                placeholder="e.g. Nike, Jordan, Adidas, New Balance"
                style={{
                  width: '100%',
                  padding: '11px 13px',
                  border: '1px solid #d1d5db',
                  borderRadius: 10,
                  fontSize: 13,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Shoe Model
              </label>
              <input
                type="text"
                value={shoeModel}
                onChange={(e) => setShoeModel(e.target.value)}
                placeholder="e.g. Air Jordan 1, Dunk Low, Samba OG"
                style={{
                  width: '100%',
                  padding: '11px 13px',
                  border: '1px solid #d1d5db',
                  borderRadius: 10,
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          <div className="wizard-grid-2" style={{ alignItems: 'start', gap: 20 }}>
            {/* Calendar */}
            <div className="calendar-box" style={{ margin: 0, maxWidth: '100%' }}>
              <div className="calendar-nav">
                <button
                  type="button"
                  aria-label="Previous month"
                  disabled={!canGoPrevMonth}
                  style={!canGoPrevMonth ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                  onClick={handlePrevMonth}
                >
                  <ChevronLeft size={14} />
                </button>
                <b>
                  {currentMonthName} {calendarYear}
                </b>
                <button type="button" aria-label="Next month" onClick={handleNextMonth}>
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="calendar-grid">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                  <div key={d} className="calendar-dow">
                    {d}
                  </div>
                ))}
                {prevMonthTrailingDays.map((d) => (
                  <button key={`prev-${d}`} type="button" disabled className="calendar-day muted">
                    {d}
                  </button>
                ))}
                {Array.from({ length: daysInMonth }, (_, idx) => idx + 1).map((day) => {
                  const isPastDay =
                    calendarYear < todayYear ||
                    (calendarYear === todayYear && calendarMonth < todayMonth) ||
                    (isCurrentMonth && day < todayDate)
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isPastDay}
                      className={`calendar-day ${isPastDay ? 'muted' : ''} ${
                        !isPastDay && activeSelectedDay === day ? 'selected' : ''
                      }`}
                      style={isPastDay ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                      onClick={() => {
                        if (!isPastDay) setSelectedDay(day)
                      }}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Live Time Slots */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                Available slots for {formattedDate}
              </div>
              <div className="wmk-timeslot-grid">
                {timeSlots.map((slot) => {
                  const { remaining, isFull } = getSlotAvailability(slot)
                  const isSelected = selectedTime === slot && !isFull
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isFull}
                      className={`choice-card ${isSelected ? 'selected' : ''}`}
                      style={{
                        padding: '10px 12px',
                        ...(isFull ? { opacity: 0.5, cursor: 'not-allowed', background: '#f9fafb' } : {}),
                      }}
                      onClick={() => {
                        if (!isFull) setSelectedTime(slot)
                      }}
                    >
                      <span className="choice-body">
                        <b style={{ fontSize: 13 }}>{slot}</b>
                        <small style={{ fontSize: 11, color: isFull ? '#b91c1c' : '#6b7280' }}>
                          {isFull ? 'Full' : `${remaining} of ${MAX_SLOT_CAPACITY} left`}
                        </small>
                      </span>
                      {isSelected && <Check size={14} className="choice-check" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #eceae6', margin: '0 0 28px' }} />

        {/* 4. VERIFY EMAIL & CONFIRM */}
        <div>
          <h3 style={{ fontSize: 16, margin: '0 0 12px' }}>4. Verify Email &amp; Confirm</h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 12,
              padding: 16,
              borderRadius: 12,
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              marginBottom: 16,
              fontSize: 12.5,
            }}
          >
            <div>
              <span style={{ display: 'block', fontSize: 11, color: '#6b7280', fontWeight: 700 }}>BRANCH</span>
              <b>{selectedBranch.name.replace('Wash My Kicks – ', '')}</b>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: 11, color: '#6b7280', fontWeight: 700 }}>SERVICE</span>
              <b>{selectedService.title}</b>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: 11, color: '#6b7280', fontWeight: 700 }}>DROP-OFF</span>
              <b>
                {formattedDate} · {selectedTime}
              </b>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: 11, color: '#6b7280', fontWeight: 700 }}>PAIR</span>
              <b>{previewShoeLabel}</b>
            </div>
          </div>

          <div className="confirm-total-bar" style={{ marginBottom: 16 }}>
            <div>
              <span>ESTIMATED TOTAL</span>
              <small>Pay at the branch after inspection</small>
            </div>
            <b>{selectedService.price.replace('From ', '')}</b>
          </div>

          <div
            style={{
              padding: '16px 18px',
              borderRadius: 12,
              border: otpVerified ? '1px solid #86efac' : '1px solid #e5e7eb',
              background: otpVerified ? '#f0fdf4' : '#ffffff',
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={16} color={otpVerified ? '#16a34a' : '#dc2626'} />
                <b style={{ fontSize: 13 }}>Email Verification Code</b>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: otpVerified ? '#dcfce7' : '#fee2e2',
                  color: otpVerified ? '#166534' : '#991b1b',
                }}
              >
                {otpVerified ? '✓ Verified' : 'Required'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => {
                  const val = e.target.value
                  setCustomerEmail(val)
                  if (otpVerified || otpSent) {
                    setOtpVerified(false)
                    setOtpSent(false)
                    setEnteredOtp('')
                    setOtpNotice('')
                  }
                }}
                placeholder="Enter your email address"
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 13,
                  background: '#fff',
                }}
              />
              <button
                type="button"
                className="outline"
                disabled={otpSending}
                style={{ padding: '10px 14px', fontSize: 12.5 }}
                onClick={handleSendBookingOtp}
              >
                {otpSending ? 'Sending...' : otpSent ? 'Resend Code' : 'Send Code'}
              </button>
            </div>

            {accountEmail ? (
              <div style={{ fontSize: 11.5, color: '#4b5563', marginBottom: 8 }}>
                Ready-for-pickup &amp; status emails for this order will go to your account email: <b>{accountEmail}</b>
              </div>
            ) : (
              customerEmail.trim().includes('@') &&
              customerEmail.trim().includes('.') && (
                <div
                  style={{
                    fontSize: 11.5,
                    marginBottom: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: detectedAccount.hasAccount ? '#ecfdf5' : '#f9fafb',
                    border: `1px solid ${detectedAccount.hasAccount ? '#a7f3d0' : '#e5e7eb'}`,
                    color: detectedAccount.hasAccount ? '#065f46' : '#4b5563',
                  }}
                >
                  {detectedAccount.hasAccount ? (
                    <>
                      <b>WashMyKicks Customer Account detected.</b> This booking will automatically appear in your
                      Customer Dashboard for <b>{customerEmail.trim().toLowerCase()}</b>.
                    </>
                  ) : (
                    'Verify your email with the 6-digit code. If this email already has a WashMyKicks account, your booking will sync to your Customer Dashboard once verified.'
                  )}
                </div>
              )
            )}

            {otpSent && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <input
                  type="text"
                  maxLength={6}
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value)}
                  placeholder="6-digit code"
                  style={{
                    width: 170,
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 3,
                    background: '#fff',
                  }}
                />
                <button
                  type="button"
                  className="primary"
                  style={{ padding: '10px 16px', fontSize: 12.5 }}
                  onClick={() => void handleVerifyOtp()}
                >
                  Verify Code
                </button>
              </div>
            )}

            {otpNotice && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: otpVerified ? '#166534' : '#b91c1c',
                }}
              >
                {otpNotice}
              </div>
            )}
          </div>

          <div className="wmk-wizard-confirm-row">
            <button type="button" className="primary wmk-wizard-confirm-btn" onClick={handleConfirm}>
              {otpVerified ? 'Confirm Drop-Off' : 'Send Code & Confirm Drop-Off'} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
   CUSTOMER DASHBOARD FLOW
   ============================================================================ */

function CustomerDashboard({
  userMeta,
  onUpdateUserMeta,
  orders,
  setOrders,
  reviews,
  setReviews,
  servicesCatalog = services,
  setPage,
  onLogout,
  initialTab = 'Dashboard',
  preselectedBranchId = 1,
  preselectedFromMap = false,
}: {
  userMeta: { name: string; email: string; branch?: string }
  onUpdateUserMeta?: (patch: { name?: string; branch?: string }) => void
  orders: JobOrder[]
  setOrders: React.Dispatch<React.SetStateAction<JobOrder[]>>
  reviews: ReviewItem[]
  setReviews: React.Dispatch<React.SetStateAction<ReviewItem[]>>
  servicesCatalog?: Service[]
  setPage: (p: string) => void
  onLogout: () => void
  initialTab?: 'Dashboard' | 'Book Appointment' | 'Track Shoes' | 'Notifications' | 'Service History' | 'Reviews' | 'Profile'
  preselectedBranchId?: number
  preselectedFromMap?: boolean
}) {
  const [tab, setTab] = useState<
    'Dashboard' | 'Book Appointment' | 'Track Shoes' | 'Notifications' | 'Service History' | 'Reviews' | 'Profile'
  >(initialTab)

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || 'WMK-2026-01842')

  const savedPrefs = loadCustomerProfilePrefs(userMeta.email)

  // Review form state
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewService, setReviewService] = useState('Deep Cleaning')
  const [reviewBranch, setReviewBranch] = useState(savedPrefs?.branch || userMeta.branch || staffBranches[0])
  const [reviewQuote, setReviewQuote] = useState('')

  // Profile form state (synced with personal login email & preferred branch)
  const [profileName, setProfileName] = useState(savedPrefs?.name || userMeta.name)
  const [profileEmail, setProfileEmail] = useState(userMeta.email)
  const [profilePhone, setProfilePhone] = useState(savedPrefs?.phone || '')
  const [profileBranch, setProfileBranch] = useState(savedPrefs?.branch || userMeta.branch || staffBranches[0])

  useEffect(() => {
    const prefs = loadCustomerProfilePrefs(userMeta.email)
    setProfileEmail(userMeta.email)
    setProfileName(prefs?.name || userMeta.name)
    setProfilePhone(prefs?.phone || '')
    setProfileBranch(prefs?.branch || userMeta.branch || staffBranches[0])
  }, [userMeta.email])

  const preferredBranchId = findBranchIdByName(profileBranch)

  const customerOrders = orders.filter(
    (o) => !userMeta.email || o.email.trim().toLowerCase() === userMeta.email.trim().toLowerCase()
  )
  const activeOrders = customerOrders.filter((o) => o.status !== 'Completed')
  const completedOrders = customerOrders.filter((o) => o.status === 'Completed')
  const trackedOrder = customerOrders.find((o) => o.id === selectedOrderId) || customerOrders[0]
  const nextAppointment = activeOrders[0] || null

  const customerNotifications = customerOrders.map((o) => ({
    id: o.id,
    title:
      o.status === 'Ready for Pickup'
        ? `Ready for Pickup at ${o.branch.replace('Wash My Kicks – ', '')} — ${o.id}`
        : `${o.service} (${o.status}) — ${o.id}`,
    body:
      o.status === 'Ready for Pickup'
        ? `Your ${o.shoe} (${o.service}) is ready for pickup at ${o.branch}. A pickup email was sent to ${o.email || userMeta.email}.`
        : `Your ${o.shoe} at ${o.branch} is currently in stage: ${o.status}. Scheduled drop-off: ${o.date} at ${o.time}.`,
    time: o.date,
    unread: o.status !== 'Completed',
  }))
  const unreadNotifCount = customerNotifications.filter((n) => n.unread).length

  const avatarInitials =
    profileName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'CU'

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const sidebarItems: {
    key: typeof tab
    icon: React.ReactNode
    badge?: number
  }[] = [
    { key: 'Dashboard', icon: <LayoutDashboard size={17} /> },
    { key: 'Book Appointment', icon: <Calendar size={17} /> },
    { key: 'Track Shoes', icon: <Package size={17} /> },
    {
      key: 'Notifications',
      icon: <Bell size={17} />,
      badge: unreadNotifCount > 0 ? unreadNotifCount : undefined,
    },
    { key: 'Service History', icon: <History size={17} /> },
    { key: 'Reviews', icon: <Star size={17} /> },
    { key: 'Profile', icon: <User size={17} /> },
  ]

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  return (
    <section className="dashboard">
      {mobileNavOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar dark-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top-row">
          <Brand onClick={() => setPage('home')} />
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>
        <span className="portal-label">CUSTOMER PORTAL</span>
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-btn ${tab === item.key ? 'selected' : ''}`}
            onClick={() => {
              setTab(item.key)
              setMobileNavOpen(false)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            {item.icon}
            <span>{item.key}</span>
            {item.badge && <span className="sidebar-badge">{item.badge}</span>}
          </button>
        ))}
        <button
          type="button"
          className="sidebar-btn"
          onClick={() => {
            setMobileNavOpen(false)
            setPage('home')
          }}
        >
          <ArrowLeft size={17} />
          <span>Public Homepage</span>
        </button>
        <button
          type="button"
          className="sidebar-btn logout"
          onClick={() => {
            setMobileNavOpen(false)
            onLogout()
          }}
        >
          <LogOut size={17} />
          <span>Log out</span>
        </button>
      </aside>

      <div className="dash-main">
        <header className="dash-header">
          <button
            type="button"
            className="dash-menu-btn"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div className="dash-search">
            <Search size={15} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your orders..."
            />
          </div>
          <div className="dash-user">
            <button type="button" className="dash-bell-btn" onClick={() => setTab('Notifications')}>
              <Bell size={17} />
              {unreadNotifCount > 0 && <span className="badge-dot">{unreadNotifCount}</span>}
            </button>
            <div className="dash-avatar" onClick={() => setTab('Profile')} style={{ cursor: 'pointer' }}>
              {avatarInitials}
            </div>
            <div className="dash-user-info">
              <b>{profileName}</b>
              <small>Customer · {profileBranch.replace('Wash My Kicks – ', '')}</small>
            </div>
          </div>
        </header>

        <nav className="dash-mobile-tabs" aria-label="Customer portal tabs">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`dash-mobile-tab ${tab === item.key ? 'active' : ''}`}
              onClick={() => {
                setTab(item.key)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              {item.icon}
              <span>{item.key}</span>
              {item.badge && <span className="dash-mobile-tab-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>

        <main className="dash-content">
          {toast && (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                padding: '12px 18px',
                borderRadius: 12,
                marginBottom: 20,
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>✓ {toast}</span>
              <button type="button" onClick={() => setToast('')}>
                <X size={15} />
              </button>
            </div>
          )}

          {/* TAB 1: CUSTOMER DASHBOARD OVERVIEW */}
          {tab === 'Dashboard' && (
            <>
              <div className="wmk-breadcrumb">
                <b>Dashboard</b> &gt; Welcome, {profileName.split(' ')[0]}.
              </div>
              <h1 style={{ marginTop: 4 }}>Welcome, {profileName.split(' ')[0]}.</h1>
              <p>{profileBranch.replace('Wash My Kicks – ', '')} branch · {todayFormatted}</p>

              {/* Row 1: 4 Icon KPI Stat Cards (100% Live From Customer Orders) */}
              <div className="wmk-inv-kpi-grid">
                <div className="wmk-inv-kpi-card" onClick={() => setTab('Track Shoes')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Package size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Current Orders</span>
                    <b>{activeOrders.length} orders</b>
                    <small>{activeOrders.length === 0 ? 'No active orders yet' : `${activeOrders.length} in active care`}</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Book Appointment')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon red">
                    <Clock3 size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Upcoming Appointments</span>
                    <b>{nextAppointment ? nextAppointment.date : 'None'}</b>
                    <small>
                      {nextAppointment
                        ? `${nextAppointment.time} · ${nextAppointment.branch.replace('Wash My Kicks – ', '')}`
                        : 'No scheduled drop-offs'}
                    </small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Service History')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon green">
                    <Check size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Completed Services</span>
                    <b>{completedOrders.length} pairs</b>
                    <small>{completedOrders.length === 0 ? 'No completed pairs yet' : '100% quality checked'}</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Notifications')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Bell size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Recent Notifications</span>
                    <b>{unreadNotifCount} unread</b>
                    <small>{unreadNotifCount === 0 ? 'All caught up' : 'Needs attention'}</small>
                  </div>
                </div>
              </div>

              {/* Row 2: Horizontal Quick Actions Banner */}
              <div className="wmk-action-banner">
                <div>
                  <h3>Quick Actions</h3>
                </div>
                <div className="wmk-action-banner-btns">
                  <button type="button" className="primary" onClick={() => setTab('Book Appointment')}>
                    <Calendar size={15} /> Book Appointment
                  </button>
                  <button type="button" className="outline" onClick={() => setTab('Track Shoes')}>
                    <Package size={15} /> Track Order
                  </button>
                  <button type="button" className="outline" onClick={() => setTab('Reviews')}>
                    <Star size={15} /> Leave Review
                  </button>
                </div>
              </div>

              {/* Row 3: 2-Column Split (Priority Queue + Order Updates) */}
              <div className="wmk-dash-split">
                <div className="wmk-queue-card">
                  <div className="wmk-queue-head">
                    <div>
                      <span className="eyebrow">MY SHOE ORDERS</span>
                      <h3>Active &amp; recent queue</h3>
                    </div>
                    <button type="button" className="wmk-link-btn" onClick={() => setTab('Track Shoes')}>
                      View all
                    </button>
                  </div>

                  <table className="wmk-queue-table">
                    <thead>
                      <tr>
                        <th>Job order</th>
                        <th>Customer</th>
                        <th>Shoe</th>
                        <th>Service</th>
                        <th>Branch</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerOrders.slice(0, 5).map((o, idx) => (
                        <tr key={o.id}>
                          <td>
                            <b>{o.id}</b>
                          </td>
                          <td>{o.customer}</td>
                          <td>{o.shoe.split('·')[0]}</td>
                          <td>{o.service}</td>
                          <td>{o.branch.replace('Wash My Kicks – ', '')}</td>
                          <td>
                            <span className={`wmk-priority-tag ${idx === 0 ? 'high' : 'normal'}`}>
                              {idx === 0 ? 'High' : 'Normal'}
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={o.status} />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="wmk-dots-btn"
                              onClick={() => setTab('Track Shoes')}
                              title="Track order"
                            >
                              •••
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="wmk-updates-card">
                  <div className="wmk-updates-head">
                    <h3>Order updates</h3>
                    <button type="button" className="wmk-link-btn" onClick={() => setTab('Notifications')}>
                      View all
                    </button>
                  </div>

                  <div className="wmk-update-list">
                    {customerOrders.length === 0 ? (
                      <div style={{ padding: '18px 12px', textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>
                        No order updates yet. Book an appointment to start tracking.
                      </div>
                    ) : (
                      customerOrders.slice(0, 3).map((o) => (
                        <div
                          key={o.id}
                          className="wmk-update-item"
                          onClick={() => {
                            setSelectedOrderId(o.id)
                            setTab('Track Shoes')
                          }}
                        >
                          <div className="wmk-update-icon">
                            <Sparkles size={15} />
                          </div>
                          <div className="wmk-update-body">
                            <b>{o.status}</b>
                            <span>
                              {o.id} · {o.date}
                            </span>
                          </div>
                          <ChevronRight size={15} className="wmk-update-arrow" />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: BOOK APPOINTMENT (SINGLE-PAGE BOOKING FORM) */}
          {tab === 'Book Appointment' && (
            <CustomerBookAppointmentWizard
              initialBranchId={preselectedFromMap ? preselectedBranchId : preferredBranchId}
              preselectedFromMap={preselectedFromMap}
              existingOrders={orders}
              servicesCatalog={servicesCatalog}
              defaultEmail={userMeta.email || profileEmail}
              accountEmail={userMeta.email || profileEmail}
              accountName={profileName || userMeta.name}
              onCancel={() => setTab('Dashboard')}
              onCompleteBooking={(newOrder) => {
                const enrichedOrder: JobOrder = {
                  ...newOrder,
                  customer: profileName || newOrder.customer,
                  email: userMeta.email || profileEmail || newOrder.email,
                }
                setOrders((prev) => [enrichedOrder, ...prev])
                setSelectedOrderId(enrichedOrder.id)
                showToast(
                  `Drop-off booked! Job Order ${enrichedOrder.id} created for ${enrichedOrder.date} at ${enrichedOrder.time}. Confirmation sent to ${enrichedOrder.email}.`
                )
                setTab('Track Shoes')
              }}
            />
          )}

          {/* TAB 3: TRACK SHOES / ORDER TRACKING */}
          {tab === 'Track Shoes' && (
            <>
              <span className="eyebrow">LIVE ORDER TRACKING</span>
              <h1>Track Shoes</h1>
              <p>Real-time status updates and specialist documentation for your pairs.</p>

              {trackedOrder ? (
                <>
                  {/* Selected Order Live 5-Stage Timeline Card */}
                  <div className="dash-panel" style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <span className="eyebrow">{trackedOrder.id}</span>
                        <h2>{trackedOrder.shoe}</h2>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                          Service: <b>{trackedOrder.service}</b> · Branch: <b>{trackedOrder.branch}</b> · Drop-off: {trackedOrder.date} ({trackedOrder.time})
                        </p>
                      </div>
                      <StatusBadge status={trackedOrder.status} />
                    </div>

                    <ServiceStatusTimeline currentStatus={trackedOrder.status} />

                    {trackedOrder.assessmentNotes && (
                      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginTop: 14 }}>
                        <b style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                          Specialist Assessment Notes ({trackedOrder.specialist}):
                        </b>
                        <p style={{ fontSize: 12.5, color: '#4b5563', margin: 0 }}>{trackedOrder.assessmentNotes}</p>
                      </div>
                    )}

                    <div className="dash-actions">
                      <button type="button" className="primary" onClick={() => setTab('Reviews')}>
                        Proceed to Leave Feedback / Review <ArrowRight size={15} />
                      </button>
                      <button type="button" className="outline" onClick={() => setTab('Book Appointment')}>
                        Book Another Pair
                      </button>
                    </div>
                  </div>

                  {/* Clean Service-History-Style Table to Select Any Order to Track */}
                  <div className="dash-panel">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Job Order</th>
                          <th>Sneaker Pair</th>
                          <th>Service</th>
                          <th>Branch</th>
                          <th>Date</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerOrders.map((o) => {
                          const isCurrent = trackedOrder.id === o.id
                          return (
                            <tr
                              key={o.id}
                              style={isCurrent ? { background: '#fef2f2' } : undefined}
                            >
                              <td>
                                <b>{o.id}</b>
                              </td>
                              <td>{o.shoe}</td>
                              <td>{o.service}</td>
                              <td>{o.branch}</td>
                              <td>{o.date}</td>
                              <td>
                                <b>{o.price}</b>
                              </td>
                              <td>
                                <StatusBadge status={o.status} />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="confirm-change"
                                  style={isCurrent ? { fontWeight: 800, textDecoration: 'underline' } : undefined}
                                  onClick={() => {
                                    setSelectedOrderId(o.id)
                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                  }}
                                >
                                  {isCurrent ? 'Tracking ✓' : 'Track / View'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="dash-panel" style={{ padding: 28, textAlign: 'center', color: '#6b7280' }}>
                  <p style={{ marginBottom: 14 }}>No job orders yet.</p>
                  <button type="button" className="primary" onClick={() => setTab('Book Appointment')}>
                    Book Your First Appointment <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </>
          )}

          {/* TAB 4: NOTIFICATIONS */}
          {tab === 'Notifications' && (
            <>
              <span className="eyebrow">ALERTS & UPDATES</span>
              <h1>Notifications</h1>
              <p>Stay updated on assessments, cleaning milestones, and pickup readiness.</p>

              <div className="dash-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {customerNotifications.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
                    No notifications yet. Notifications will appear here automatically once you book an appointment.
                  </div>
                ) : (
                  customerNotifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        border: '1px solid #e5e7eb',
                        background: n.unread ? '#fffbfb' : '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 14,
                      }}
                    >
                      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                        <b style={{ fontSize: 13.5, display: 'block', marginBottom: 4 }}>{n.title}</b>
                        <p style={{ fontSize: 12.5, color: '#6b7280', margin: 0 }}>{n.body}</p>
                        <small style={{ fontSize: 11, color: '#9ca3af' }}>{n.time}</small>
                      </div>
                      <button
                        type="button"
                        className="outline"
                        onClick={() => {
                          setSelectedOrderId(n.id)
                          setTab('Track Shoes')
                        }}
                      >
                        View Order
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* TAB 5: SERVICE HISTORY */}
          {tab === 'Service History' && (
            <>
              <span className="eyebrow">PAST & CURRENT CARE</span>
              <h1>Service History</h1>
              <p>Complete archive of all your sneaker care sessions with WashMyKicks.</p>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job Order</th>
                      <th>Sneaker Pair</th>
                      <th>Service</th>
                      <th>Branch</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerOrders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <b>{o.id}</b>
                        </td>
                        <td>{o.shoe}</td>
                        <td>{o.service}</td>
                        <td>{o.branch}</td>
                        <td>{o.date}</td>
                        <td>
                          <b>{o.price}</b>
                        </td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="confirm-change"
                            onClick={() => {
                              setSelectedOrderId(o.id)
                              setTab('Track Shoes')
                            }}
                          >
                            Track / View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB 6: REVIEWS / FEEDBACK */}
          {tab === 'Reviews' && (
            <>
              <span className="eyebrow">CUSTOMER FEEDBACK</span>
              <h1>Reviews</h1>
              <p>Share your experience with our sneaker specialists.</p>

              <div className="wizard-grid-2" style={{ alignItems: 'start' }}>
                <form
                  className="dash-panel"
                  style={{ marginTop: 0 }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!reviewQuote.trim()) return
                    void submitCustomerCrmInteraction({
                      customerId: 1,
                      interactionType: 'REVIEW',
                      customerMessage: reviewQuote,
                      rating: reviewRating,
                    }).catch(() => null)
                    setReviews((prev) => [
                      {
                        id: `r-${Date.now()}`,
                        author: profileName,
                        service: reviewService,
                        branch: reviewBranch,
                        rating: reviewRating,
                        quote: reviewQuote,
                        date: 'March 28, 2026',
                      },
                      ...prev,
                    ])
                    setReviewQuote('')
                    showToast('Thank you! Your review has been published.')
                  }}
                >
                  <span className="eyebrow">SUBMIT FEEDBACK</span>
                  <h2>Leave a Review</h2>

                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
                    Star Rating
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setReviewRating(num)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #e5e7eb',
                          background: reviewRating >= num ? '#fef2f2' : '#fff',
                          color: reviewRating >= num ? '#dc2626' : '#9ca3af',
                          fontWeight: 700,
                        }}
                      >
                        ★ {num}
                      </button>
                    ))}
                  </div>

                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
                    Service Received
                    <select
                      value={reviewService}
                      onChange={(e) => setReviewService(e.target.value)}
                      style={{ width: '100%', padding: 11, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.title}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
                    Branch
                    <select
                      value={reviewBranch}
                      onChange={(e) => setReviewBranch(e.target.value)}
                      style={{ width: '100%', padding: 11, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
                    >
                      {staffBranches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
                    Your Feedback
                    <textarea
                      required
                      rows={3}
                      value={reviewQuote}
                      onChange={(e) => setReviewQuote(e.target.value)}
                      placeholder="How did your kicks turn out?"
                      style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
                    />
                  </label>

                  <button type="submit" className="primary" style={{ marginTop: 12 }}>
                    Submit Review <ArrowRight size={15} />
                  </button>
                </form>

                <div className="dash-panel" style={{ marginTop: 0 }}>
                  <span className="eyebrow">RECENT COMMUNITY REVIEWS</span>
                  <h2>Customer Stories</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {reviews.map((r) => (
                      <div key={r.id} style={{ padding: 14, border: '1px solid #f0eeeb', borderRadius: 10 }}>
                        <div style={{ color: '#dc2626', fontSize: 13 }}>{'★'.repeat(r.rating)}</div>
                        <p style={{ fontWeight: 600, fontSize: 13.5, margin: '6px 0' }}>“{r.quote}”</p>
                        <small style={{ color: '#6b7280', fontSize: 11.5 }}>
                          {r.author} · {r.service} · {r.branch}
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 7: PROFILE */}
          {tab === 'Profile' && (
            <>
              <span className="eyebrow">ACCOUNT SETTINGS</span>
              <h1>Profile</h1>
              <p>Manage your personal information and preferred drop-off branch.</p>

              <form
                className="dash-panel"
                style={{ maxWidth: 620 }}
                onSubmit={(e) => {
                  e.preventDefault()
                  const targetEmail = userMeta.email || profileEmail
                  saveCustomerProfilePrefs(targetEmail, {
                    name: profileName.trim(),
                    phone: profilePhone.trim(),
                    branch: profileBranch,
                  })
                  onUpdateUserMeta?.({
                    name: profileName.trim() || userMeta.name,
                    branch: profileBranch,
                  })
                  showToast(
                    `Profile saved. Preferred pickup branch: ${profileBranch.replace('Wash My Kicks – ', '')} (notifications go to ${targetEmail}).`
                  )
                }}
              >
                <div className="wizard-grid-2">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Full Name
                    <input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      style={{ width: '100%', padding: 11, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
                    />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Login Email (Pickup Notifications)
                    <input
                      value={profileEmail}
                      readOnly={Boolean(userMeta.email)}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: 11,
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        marginTop: 6,
                        background: userMeta.email ? '#f9fafb' : '#fff',
                        color: '#374151',
                      }}
                    />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Mobile Number
                    <input
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      style={{ width: '100%', padding: 11, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
                    />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Preferred Branch
                    <select
                      value={profileBranch}
                      onChange={(e) => setProfileBranch(e.target.value)}
                      style={{ width: '100%', padding: 11, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
                    >
                      {staffBranches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="dash-actions">
                  <button type="submit" className="primary">
                    Save Profile Changes
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </section>
  )
}

/* ============================================================================
   STAFF DASHBOARD FLOW
   ============================================================================ */

function StaffDashboard({
  userMeta,
  orders,
  setOrders,
  inventory,
  setInventory,
  onLogout,
}: {
  userMeta: { name: string; email: string; employeeId?: string; branch?: string }
  orders: JobOrder[]
  setOrders: React.Dispatch<React.SetStateAction<JobOrder[]>>
  inventory: InventoryRecord[]
  setInventory: React.Dispatch<React.SetStateAction<InventoryRecord[]>>
  onLogout: () => void
}) {
  const [tab, setTab] = useState<
    | 'Dashboard'
    | 'Job Orders'
    | 'Shoe Assessment'
    | 'Before & After Documentation'
    | 'Assigned Services'
    | 'Inventory'
    | 'Customers'
    | 'Notifications'
  >('Dashboard')
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || 'WMK-2026-0046')
  const [toast, setToast] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const staffPendingCount = orders.filter((o) => o.status === 'Pending Assessment').length
  const staffInProgressCount = orders.filter((o) => o.status === 'In Progress' || o.status === 'Quality Check').length
  const staffCompletedCount = orders.filter((o) => o.status === 'Completed').length
  const staffLowStockItems = inventory.filter(
    (i) => (!userMeta.branch || i.branch === userMeta.branch) && getInventoryStatus(i.stock, i.target) !== 'Healthy'
  )
  const staffAlerts: { id: string; title: string; body: string; targetTab: typeof tab; orderId?: string }[] = [
    ...orders
      .filter((o) => o.status !== 'Completed')
      .map((o) => ({
        id: `order-${o.id}`,
        title:
          o.status === 'Pending Assessment'
            ? `New Drop-Off Assigned — ${o.id}`
            : `Service Update Needed (${o.status}) — ${o.id}`,
        body:
          o.status === 'Pending Assessment'
            ? `${o.customer} dropped off ${o.shoe} for ${o.service} at ${o.branch.replace('Wash My Kicks – ', '')}. Please complete initial Shoe Assessment.`
            : `${o.shoe} (${o.service}) is currently "${o.status}". Update 4-Angle Documentation or service status.`,
        targetTab: (o.status === 'Pending Assessment' ? 'Shoe Assessment' : 'Before & After Documentation') as typeof tab,
        orderId: o.id,
      })),
    ...staffLowStockItems.map((item) => ({
      id: `inv-${item.id}`,
      title: `Branch Inventory Low Alert — ${item.branch.replace('Wash My Kicks – ', '')}`,
      body: `${item.name} is down to ${item.stock} / ${item.target} units. Check the Inventory module to restock or transfer.`,
      targetTab: 'Inventory' as typeof tab,
    })),
  ]
  const staffUnreadCount = staffAlerts.length
  const staffInitials =
    userMeta.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'ST'
  const staffTodayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const sidebarItems: { key: typeof tab; icon: React.ReactNode; badge?: number }[] = [
    { key: 'Dashboard', icon: <LayoutDashboard size={17} /> },
    { key: 'Job Orders', icon: <ClipboardCheck size={17} /> },
    { key: 'Shoe Assessment', icon: <Wrench size={17} /> },
    { key: 'Before & After Documentation', icon: <Camera size={17} /> },
    { key: 'Assigned Services', icon: <Briefcase size={17} /> },
    { key: 'Inventory', icon: <Package size={17} /> },
    { key: 'Customers', icon: <Users size={17} /> },
    {
      key: 'Notifications',
      icon: <Bell size={17} />,
      badge: staffUnreadCount > 0 ? staffUnreadCount : undefined,
    },
  ]

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const updateOrderStatus = (id: string, nextStatus: JobOrder['status']) => {
    void applyOrderStatusUpdate({
      id,
      nextStatus,
      orders,
      setOrders,
      showToast,
      actorName: userMeta.name,
    })
  }

  const handleUploadAnglePhoto = (
    orderId: string,
    angle: ShoeAngleKey,
    side: 'before' | 'after',
    dataUrl: string
  ) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              docs: {
                ...o.docs,
                [angle]: {
                  ...o.docs[angle],
                  [side]: dataUrl,
                },
              },
            }
          : o
      )
    )
    void uploadAssessmentPhotoToStorage({
      branchId: 1,
      orderId: Number(orderId.replace(/\D/g, '')) || 46,
      assessmentId: Number(orderId.replace(/\D/g, '')) || 46,
      side,
      angle,
      fileOrDataUrl: dataUrl,
    }).catch(() => null)
    const angleNames: Record<ShoeAngleKey, string> = {
      left: 'Left side',
      right: 'Right side',
      toe: 'Toe box',
      sole: 'Outsole / Sole',
    }
    showToast(`Uploaded ${angleNames[angle]} (${side.toUpperCase()}) photo for ${orderId}.`)
  }

  return (
    <section className="dashboard">
      {mobileNavOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar dark-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top-row">
          <Brand />
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>
        <span className="portal-label">STAFF PORTAL</span>
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-btn ${tab === item.key ? 'selected' : ''}`}
            onClick={() => {
              setTab(item.key)
              setMobileNavOpen(false)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            {item.icon}
            <span>{item.key}</span>
            {item.badge && <span className="sidebar-badge">{item.badge}</span>}
          </button>
        ))}
        <button
          type="button"
          className="sidebar-btn logout"
          onClick={() => {
            setMobileNavOpen(false)
            onLogout()
          }}
        >
          <LogOut size={17} />
          <span>Log out</span>
        </button>
      </aside>

      <div className="dash-main">
        <header className="dash-header">
          <button
            type="button"
            className="dash-menu-btn"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div className="dash-search">
            <Search size={15} />
            <input placeholder="Search orders and customers..." />
          </div>
          <div className="dash-user">
            <button type="button" className="dash-bell-btn" onClick={() => setTab('Notifications')}>
              <Bell size={17} />
              {staffUnreadCount > 0 && <span className="badge-dot">{staffUnreadCount}</span>}
            </button>
            <div className="dash-avatar">{staffInitials}</div>
            <div className="dash-user-info">
              <b>{userMeta.name}</b>
              <small>Staff · {(userMeta.branch || 'Wash My Kicks – Pasig City').replace('Wash My Kicks – ', '')}</small>
            </div>
          </div>
        </header>

        <nav className="dash-mobile-tabs" aria-label="Staff portal tabs">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`dash-mobile-tab ${tab === item.key ? 'active' : ''}`}
              onClick={() => {
                setTab(item.key)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              {item.icon}
              <span>{item.key}</span>
              {item.badge && <span className="dash-mobile-tab-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>

        <main className="dash-content">
          {toast && (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                padding: '12px 18px',
                borderRadius: 12,
                marginBottom: 20,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ✓ {toast}
            </div>
          )}

          {/* STAFF DASHBOARD OVERVIEW */}
          {tab === 'Dashboard' && (
            <>
              <div className="wmk-breadcrumb">
                <b>Dashboard</b> &gt; Welcome, {userMeta.name.split(' ')[0]}.
              </div>
              <h1 style={{ marginTop: 4 }}>Welcome, {userMeta.name.split(' ')[0]}.</h1>
              <p>{(userMeta.branch || 'Wash My Kicks – Pasig City').replace('Wash My Kicks – ', '')} branch · {staffTodayStr}</p>

              {/* Row 1: 4 Icon KPI Stat Cards */}
              <div className="wmk-inv-kpi-grid">
                <div className="wmk-inv-kpi-card" onClick={() => setTab('Job Orders')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Package size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Assigned Orders</span>
                    <b>{orders.length} orders</b>
                    <small>{orders.length === 0 ? 'No active orders yet' : 'Live branch queue'}</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Assigned Services')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon red">
                    <Clock3 size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Orders In Progress</span>
                    <b>{staffInProgressCount} pairs</b>
                    <small>{staffInProgressCount === 0 ? 'No pairs in progress' : 'Active service stage'}</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Job Orders')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon green">
                    <Check size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Orders Completed</span>
                    <b>{staffCompletedCount} pairs</b>
                    <small>{staffCompletedCount === 0 ? 'No completed pairs yet' : 'Quality checked'}</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Shoe Assessment')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Sparkles size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Pending Assessments</span>
                    <b>{staffPendingCount} pairs</b>
                    <small>{staffPendingCount === 0 ? 'All assessed' : 'Needs attention'}</small>
                  </div>
                </div>
              </div>

              {/* Row 2: Horizontal Staff Actions Banner */}
              <div className="wmk-action-banner">
                <div>
                  <h3>Quick Actions</h3>
                </div>
                <div className="wmk-action-banner-btns">
                  <button type="button" className="primary" onClick={() => setTab('Shoe Assessment')}>
                    <Sparkles size={15} /> Create Assessment
                  </button>
                  <button type="button" className="outline" onClick={() => setTab('Before & After Documentation')}>
                    <Camera size={15} /> Upload Photos
                  </button>
                  <button type="button" className="outline" onClick={() => setTab('Assigned Services')}>
                    <SettingsIcon size={15} /> Update Status
                  </button>
                </div>
              </div>

              {/* Row 3: 2-Column Split (Priority Queue + Branch Updates) */}
              <div className="wmk-dash-split">
                <div className="wmk-queue-card">
                  <div className="wmk-queue-head">
                    <div>
                      <span className="eyebrow">MY ASSIGNED ORDERS</span>
                      <h3>Today&apos;s priority queue</h3>
                    </div>
                    <button type="button" className="wmk-link-btn" onClick={() => setTab('Job Orders')}>
                      View all
                    </button>
                  </div>

                  <table className="wmk-queue-table">
                    <thead>
                      <tr>
                        <th>Job order</th>
                        <th>Customer</th>
                        <th>Shoe</th>
                        <th>Service</th>
                        <th>Branch</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', color: '#6b7280', padding: 18 }}>
                            No orders yet.
                          </td>
                        </tr>
                      ) : (
                        orders.slice(0, 5).map((row, idx) => (
                          <tr key={row.id}>
                            <td>
                              <b>{row.id}</b>
                            </td>
                            <td>{row.customer}</td>
                            <td>{row.shoe}</td>
                            <td>{row.service}</td>
                            <td>{row.branch.replace('Wash My Kicks – ', '')}</td>
                            <td>
                              <span className={`wmk-priority-tag ${idx === 0 ? 'high' : 'normal'}`}>
                                {idx === 0 ? 'High' : 'Normal'}
                              </span>
                            </td>
                            <td>
                              <StatusBadge status={row.status} />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="wmk-dots-btn"
                                onClick={() => {
                                  setSelectedOrderId(row.id)
                                  setTab('Shoe Assessment')
                                }}
                                title="Open order actions"
                              >
                                •••
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="wmk-updates-card">
                  <div className="wmk-updates-head">
                    <h3>Branch updates</h3>
                    <button type="button" className="wmk-link-btn" onClick={() => setTab('Notifications')}>
                      View all
                    </button>
                  </div>

                  <div className="wmk-update-list">
                    {orders.length === 0 && staffLowStockItems.length === 0 ? (
                      <div style={{ padding: '14px 4px', color: '#6b7280', fontSize: 13 }}>
                        No branch updates yet. Updates will appear here as orders are booked or inventory changes.
                      </div>
                    ) : (
                      <>
                        {orders.slice(0, 3).map((ord) => (
                          <div
                            key={ord.id}
                            className="wmk-update-item"
                            onClick={() => {
                              setSelectedOrderId(ord.id)
                              setTab(ord.status === 'Pending Assessment' ? 'Shoe Assessment' : 'Before & After Documentation')
                            }}
                          >
                            <div className="wmk-update-icon">
                              {ord.status === 'Completed' ? (
                                <Check size={15} />
                              ) : ord.status === 'Pending Assessment' ? (
                                <Sparkles size={15} />
                              ) : (
                                <Camera size={15} />
                              )}
                            </div>
                            <div className="wmk-update-body">
                              <b>{ord.status === 'Pending Assessment' ? 'Assessment requested' : ord.status}</b>
                              <span>
                                {ord.id} · {ord.date}
                              </span>
                            </div>
                            <ChevronRight size={15} className="wmk-update-arrow" />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* STAFF TAB: JOB ORDERS */}
          {tab === 'Job Orders' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                <div>
                  <span className="eyebrow">BRANCH QUEUE</span>
                  <h1>Job Orders</h1>
                  <p>Select a job order to update service progress or proceed to shoe assessment &amp; documentation.</p>
                </div>
                <button
                  type="button"
                  className="outline"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    const fileName = `WashMyKicks_Staff_JobOrders_${exportDateStamp()}.xlsx`
                    downloadExcel(fileName, [
                      {
                        name: 'Job Orders',
                        headers: ['Job Order ID', 'Customer', 'Email', 'Shoe Pair', 'Service', 'Branch', 'Date', 'Time', 'Price (PHP)', 'Assessed', 'Status'],
                        rows: orders.map((o) => [
                          o.id,
                          o.customer,
                          o.email,
                          o.shoe,
                          o.service,
                          o.branch,
                          o.date,
                          o.time,
                          pesoToNumber(o.price),
                          o.assessed ? 'Yes' : 'Pending',
                          o.status,
                        ]),
                      },
                    ])
                    showToast(`Exported ${orders.length} job orders to ${fileName}.`)
                  }}
                >
                  <Download size={15} /> Export Job Orders (.xlsx)
                </button>
              </div>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job Order</th>
                      <th>Customer</th>
                      <th>Shoe Pair</th>
                      <th>Service</th>
                      <th>Assessed</th>
                      <th>Status</th>
                      <th>Update Status</th>
                      <th>Workflow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <b>{o.id}</b>
                        </td>
                        <td>{o.customer}</td>
                        <td>{o.shoe}</td>
                        <td>{o.service}</td>
                        <td>{o.assessed ? '✔ Yes' : 'Pending'}</td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                        <td>
                          <StatusSelect
                            value={o.status}
                            onChange={(next) => updateOrderStatus(o.id, next)}
                          />
                        </td>
                        <td style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="outline"
                            style={{ padding: '6px 10px', fontSize: 11 }}
                            onClick={() => {
                              setSelectedOrderId(o.id)
                              setTab('Shoe Assessment')
                            }}
                          >
                            Assess
                          </button>
                          <button
                            type="button"
                            className="primary"
                            style={{ padding: '6px 10px', fontSize: 11 }}
                            onClick={() => {
                              setSelectedOrderId(o.id)
                              setTab('Before & After Documentation')
                            }}
                          >
                            4-Angle Docs <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* STAFF TAB: SHOE ASSESSMENT */}
          {tab === 'Shoe Assessment' && (
            <StaffShoeAssessmentModule
              orders={orders}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
              onSaveDraft={(msg, draftUpdate) => {
                if (draftUpdate) {
                  setOrders((prev) =>
                    prev.map((o) =>
                      o.id === draftUpdate.orderId
                        ? {
                            ...o,
                            shoe: draftUpdate.shoeLabel || o.shoe,
                            shoeBrand: draftUpdate.shoeBrand || o.shoeBrand,
                            shoeModel: draftUpdate.shoeModel || o.shoeModel,
                            specialist: userMeta.name,
                            assessmentNotes: draftUpdate.notes,
                            conditionTags: draftUpdate.conditions,
                          }
                        : o
                    )
                  )
                }
                showToast(msg)
              }}
              onUploadIntakePhoto={(orderId, angle, url) =>
                handleUploadAnglePhoto(orderId, angle, 'before', url)
              }
              onCompleteAssessment={(orderId, notes, conditions, shoeLabel, shoeBrand, shoeModel) => {
                void upsertShoeAssessmentRecord({
                  orderId: Number(orderId.replace(/\D/g, '')) || 46,
                  shoeCondition: conditions.join(', '),
                  damageFindings: notes,
                  recommendations: 'Restoration + Deep Clean',
                  serviceNotes: notes,
                  assessmentStatus: 'Completed',
                }).catch(() => null)
                setOrders((prev) =>
                  prev.map((o) =>
                    o.id === orderId
                      ? {
                          ...o,
                          shoe: shoeLabel || o.shoe,
                          shoeBrand: shoeBrand ?? o.shoeBrand,
                          shoeModel: shoeModel ?? o.shoeModel,
                          specialist: userMeta.name,
                          assessed: true,
                          status: 'In Progress',
                          stageIndex: 3,
                          assessmentNotes: notes,
                          conditionTags: conditions,
                        }
                      : o
                  )
                )
                showToast(`Assessment completed for ${orderId} by ${userMeta.name}. Order moved to "In Progress".`)
              }}
            />
          )}

          {/* STAFF TAB: BEFORE & AFTER DOCUMENTATION (LEFT SIDE, RIGHT SIDE, TOE, SOLE) */}
          {tab === 'Before & After Documentation' && (
            <BeforeAfterDocumentationModule
              orders={orders}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
              onUploadAnglePhoto={handleUploadAnglePhoto}
              onUpdateOrderStatus={updateOrderStatus}
              onBackToDashboard={() => setTab('Dashboard')}
            />
          )}

          {/* STAFF TAB: ASSIGNED SERVICES */}
          {tab === 'Assigned Services' && (
            <StaffAssignedServicesModule
              orders={orders}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
              onSaveStatus={updateOrderStatus}
              onOpenDocumentation={(id) => {
                setSelectedOrderId(id)
                setTab('Before & After Documentation')
              }}
              onBackToDashboard={() => setTab('Dashboard')}
            />
          )}

          {/* STAFF TAB: INVENTORY MANAGEMENT MODULE (RBAC ENABLED) */}
          {tab === 'Inventory' && (
            <InventoryManagementModule
              roleLabel="STAFF"
              branches={staffBranches}
              defaultBranch={userMeta.branch || staffBranches[0]}
              inventory={inventory}
              setInventory={setInventory}
              onBackToDashboard={() => setTab('Dashboard')}
              onNotify={showToast}
            />
          )}

          {/* STAFF TAB: CUSTOMERS */}
          {tab === 'Customers' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                <div>
                  <span className="eyebrow">BRANCH DIRECTORY</span>
                  <h1>Customers</h1>
                  <p>Customers with active or recent shoe orders at your branch.</p>
                </div>
                <button
                  type="button"
                  className="outline"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    const fileName = `WashMyKicks_Branch_Customers_${exportDateStamp()}.xlsx`
                    downloadExcel(fileName, [
                      {
                        name: 'Branch Customers',
                        headers: ['Customer Name', 'Email', 'Active Pair', 'Service', 'Branch', 'Order Status'],
                        rows: orders.map((o) => [o.customer, o.email, o.shoe, o.service, o.branch, o.status]),
                      },
                    ])
                    showToast(`Exported ${orders.length} customer records to ${fileName}.`)
                  }}
                >
                  <Download size={15} /> Export Customers (.xlsx)
                </button>
              </div>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Email</th>
                      <th>Active Pair</th>
                      <th>Service</th>
                      <th>Order Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: 18 }}>
                          No customer orders recorded at your branch yet.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <b>{o.customer}</b>
                          </td>
                          <td>{o.email}</td>
                          <td>{o.shoe}</td>
                          <td>{o.service}</td>
                          <td>
                            <StatusBadge status={o.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* STAFF TAB: NOTIFICATIONS */}
          {tab === 'Notifications' && (
            <>
              <span className="eyebrow">STAFF ALERTS</span>
              <h1>Notifications</h1>
              <p>Branch drop-off alerts, documentation checks, and low-stock notifications.</p>

              <div className="dash-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {staffAlerts.length === 0 ? (
                  <div style={{ padding: 18, textAlign: 'center', color: '#6b7280', fontSize: 13.5 }}>
                    No branch notifications or alerts yet. Alerts will appear here when customers book appointments or stock runs low.
                  </div>
                ) : (
                  staffAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer' }}
                      onClick={() => {
                        if (alert.orderId) setSelectedOrderId(alert.orderId)
                        setTab(alert.targetTab)
                      }}
                    >
                      <b>{alert.title}</b>
                      <p style={{ fontSize: 12.5, color: '#6b7280', margin: '4px 0 0' }}>{alert.body}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </section>
  )
}

/* ============================================================================
   ADMIN DASHBOARD FLOW
   ============================================================================ */

function AdminDashboard({
  userMeta,
  orders,
  setOrders,
  inventory,
  setInventory,
  servicesCatalog,
  setServicesCatalog,
  onLogout,
}: {
  userMeta: { name: string; email: string }
  orders: JobOrder[]
  setOrders: React.Dispatch<React.SetStateAction<JobOrder[]>>
  inventory: InventoryRecord[]
  setInventory: React.Dispatch<React.SetStateAction<InventoryRecord[]>>
  servicesCatalog: Service[]
  setServicesCatalog: React.Dispatch<React.SetStateAction<Service[]>>
  onLogout: () => void
}) {
  const [tab, setTab] = useState<
    | 'Dashboard'
    | 'Branches'
    | 'Services'
    | 'Inventory'
    | 'CRM'
    | 'Job Orders'
    | 'Reports'
    | 'Audit Trail'
    | 'User Management'
    | 'Settings'
  >('Dashboard')
  const [toast, setToast] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [newSvcTitle, setNewSvcTitle] = useState('')
  const [newSvcCopy, setNewSvcCopy] = useState('')
  const [newSvcPrice, setNewSvcPrice] = useState('₱500')
  const [newSvcDuration, setNewSvcDuration] = useState('2–4 days')

  const [usersList, setUsersList] = useState<
    { id: string; name: string; email: string; role: string; branch: string; active: boolean }[]
  >(() => loadCachedProductionData().users)
  const [auditLogs, setAuditLogs] = useState<
    { time: string; actor: string; role: string; action: string; target: string }[]
  >([])

  useEffect(() => {
    fetchLiveProductionData()
      .then((res) => {
        if (res.users.length > 0) setUsersList(res.users)
        if (res.auditLogs.length > 0) setAuditLogs(res.auditLogs)
      })
      .catch(() => {})
  }, [orders.length])

  const sidebarItems: { key: typeof tab; icon: React.ReactNode }[] = [
    { key: 'Dashboard', icon: <LayoutDashboard size={17} /> },
    { key: 'Branches', icon: <Building2 size={17} /> },
    { key: 'Services', icon: <Sparkles size={17} /> },
    { key: 'Inventory', icon: <Package size={17} /> },
    { key: 'CRM', icon: <Users size={17} /> },
    { key: 'Job Orders', icon: <ClipboardCheck size={17} /> },
    { key: 'Reports', icon: <BarChart3 size={17} /> },
    { key: 'Audit Trail', icon: <FileText size={17} /> },
    { key: 'User Management', icon: <ShieldCheck size={17} /> },
    { key: 'Settings', icon: <SettingsIcon size={17} /> },
  ]

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const lowStockCount = inventory.filter(
    (i) => getInventoryStatus(i.stock, i.target) !== 'Healthy'
  ).length
  const adminInProgressCount = orders.filter((o) => o.status === 'In Progress' || o.status === 'Quality Check').length
  const adminCompletedCount = orders.filter((o) => o.status === 'Completed').length
  const adminReadyCount = orders.filter((o) => o.status === 'Ready for Pickup').length
  const adminRevenueTotal = orders.reduce((sum, o) => sum + pesoToNumber(o.price), 0)
  const adminInitials =
    userMeta.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'AD'
  const adminTodayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <section className="dashboard">
      {mobileNavOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar dark-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top-row">
          <Brand />
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>
        <span className="portal-label">ADMINISTRATOR PORTAL</span>
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-btn ${tab === item.key ? 'selected' : ''}`}
            onClick={() => {
              setTab(item.key)
              setMobileNavOpen(false)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            {item.icon}
            <span>{item.key}</span>
          </button>
        ))}
        <button
          type="button"
          className="sidebar-btn logout"
          onClick={() => {
            setMobileNavOpen(false)
            onLogout()
          }}
        >
          <LogOut size={17} />
          <span>Log out</span>
        </button>
      </aside>

      <div className="dash-main">
        <header className="dash-header">
          <button
            type="button"
            className="dash-menu-btn"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div className="dash-search">
            <Search size={15} />
            <input placeholder="Search orders and customers..." />
          </div>
          <div className="dash-user">
            <button type="button" className="dash-bell-btn" onClick={() => setTab('Audit Trail')}>
              <Bell size={17} />
              {(orders.length + lowStockCount) > 0 && (
                <span className="badge-dot">{orders.length + lowStockCount}</span>
              )}
            </button>
            <div className="dash-avatar">{adminInitials}</div>
            <div className="dash-user-info">
              <b>{userMeta.name}</b>
              <small>Administrator</small>
            </div>
          </div>
        </header>

        <nav className="dash-mobile-tabs" aria-label="Administrator portal tabs">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`dash-mobile-tab ${tab === item.key ? 'active' : ''}`}
              onClick={() => {
                setTab(item.key)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              {item.icon}
              <span>{item.key}</span>
            </button>
          ))}
        </nav>

        <main className="dash-content">
          {toast && (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                padding: '12px 18px',
                borderRadius: 12,
                marginBottom: 20,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ✓ {toast}
            </div>
          )}

          {/* ADMIN DASHBOARD OVERVIEW: 7 WIDGETS + ACTION BANNER + QUEUE/UPDATES + 4 CHARTS */}
          {tab === 'Dashboard' && (
            <>
              <div className="wmk-breadcrumb">
                <b>Dashboard</b> &gt; Welcome, {userMeta.name.split(' ')[0]}.
              </div>
              <h1 style={{ marginTop: 4 }}>Welcome, {userMeta.name.split(' ')[0]}.</h1>
              <p>All 7 branches · {adminTodayStr}</p>

              {/* Row 1: 7 Required Admin Widgets styled with the white card + icon UI */}
              <div className="wmk-inv-kpi-grid">
                <div className="wmk-inv-kpi-card" onClick={() => setTab('Job Orders')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Package size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Total Orders</span>
                    <b>{orders.length} orders</b>
                    <small>Live database orders</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Job Orders')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon red">
                    <Clock3 size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Orders In Progress</span>
                    <b>{adminInProgressCount} pairs</b>
                    <small>Across 7 active branches</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Job Orders')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon green">
                    <Check size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Completed Orders</span>
                    <b>{adminCompletedCount} pairs</b>
                    <small>Quality checked</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Job Orders')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Sparkles size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Ready for Pickup</span>
                    <b>{adminReadyCount} pairs</b>
                    <small>Awaiting customer claim</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('CRM')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Users size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Active Customers</span>
                    <b>{usersList.length}</b>
                    <small>Registered accounts</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Inventory')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon red">
                    <Bell size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Inventory Alerts</span>
                    <b>{lowStockCount} alerts</b>
                    <small>{lowStockCount === 0 ? 'Stock healthy' : 'Needs attention'}</small>
                  </div>
                </div>

                <div
                  className="wmk-inv-kpi-card span-2"
                  onClick={() => setTab('Reports')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="wmk-inv-kpi-icon green">
                    <BarChart3 size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Revenue Summary</span>
                    <b>₱{adminRevenueTotal.toLocaleString()}</b>
                    <small>Gross revenue from live orders across all branches</small>
                  </div>
                </div>
              </div>

              {/* Row 2: Horizontal Admin Actions Banner */}
              <div className="wmk-action-banner">
                <div>
                  <h3>Quick Actions</h3>
                </div>
                <div className="wmk-action-banner-btns">
                  <button type="button" className="primary" onClick={() => setTab('Inventory')}>
                    <Package size={15} /> Manage Inventory
                  </button>
                  <button type="button" className="outline" onClick={() => setTab('Reports')}>
                    <BarChart3 size={15} /> Revenue Reports
                  </button>
                  <button type="button" className="outline" onClick={() => setTab('Branches')}>
                    <Building2 size={15} /> Branch Network
                  </button>
                </div>
              </div>

              {/* Row 3: 2-Column Split (Priority Queue + Network Updates) */}
              <div className="wmk-dash-split" style={{ marginBottom: 18 }}>
                <div className="wmk-queue-card">
                  <div className="wmk-queue-head">
                    <div>
                      <span className="eyebrow">ALL-BRANCH JOB ORDERS</span>
                      <h3>Today&apos;s priority queue</h3>
                    </div>
                    <button type="button" className="wmk-link-btn" onClick={() => setTab('Job Orders')}>
                      View all
                    </button>
                  </div>

                  <table className="wmk-queue-table">
                    <thead>
                      <tr>
                        <th>Job order</th>
                        <th>Customer</th>
                        <th>Shoe</th>
                        <th>Service</th>
                        <th>Branch</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', color: '#6b7280', padding: 18 }}>
                            No orders yet.
                          </td>
                        </tr>
                      ) : (
                        orders.slice(0, 5).map((row, idx) => (
                          <tr key={row.id}>
                            <td>
                              <b>{row.id}</b>
                            </td>
                            <td>{row.customer}</td>
                            <td>{row.shoe}</td>
                            <td>{row.service}</td>
                            <td>{row.branch.replace('Wash My Kicks – ', '')}</td>
                            <td>
                              <span className={`wmk-priority-tag ${idx === 0 ? 'high' : 'normal'}`}>
                                {idx === 0 ? 'High' : 'Normal'}
                              </span>
                            </td>
                            <td>
                              <StatusBadge status={row.status} />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="wmk-dots-btn"
                                onClick={() => setTab('Job Orders')}
                                title="Manage order"
                              >
                                •••
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="wmk-updates-card">
                  <div className="wmk-updates-head">
                    <h3>Branch updates</h3>
                    <button type="button" className="wmk-link-btn" onClick={() => setTab('Audit Trail')}>
                      View all
                    </button>
                  </div>

                  <div className="wmk-update-list">
                    {orders.length === 0 && lowStockCount === 0 ? (
                      <div style={{ padding: '14px 4px', color: '#6b7280', fontSize: 13 }}>
                        No network updates yet. Updates will appear here as orders are booked or inventory changes.
                      </div>
                    ) : (
                      <>
                        {lowStockCount > 0 && (
                          <div className="wmk-update-item" onClick={() => setTab('Inventory')}>
                            <div className="wmk-update-icon">
                              <Bell size={15} />
                            </div>
                            <div className="wmk-update-body">
                              <b>Low stock alert</b>
                              <span>{lowStockCount} item(s) need restock</span>
                            </div>
                            <ChevronRight size={15} className="wmk-update-arrow" />
                          </div>
                        )}
                        {orders.slice(0, 3).map((ord) => (
                          <div key={ord.id} className="wmk-update-item" onClick={() => setTab('Job Orders')}>
                            <div className="wmk-update-icon">
                              {ord.status === 'Completed' ? <Check size={15} /> : <Camera size={15} />}
                            </div>
                            <div className="wmk-update-body">
                              <b>{ord.status}</b>
                              <span>
                                {ord.id} · {ord.branch.replace('Wash My Kicks – ', '')}
                              </span>
                            </div>
                            <ChevronRight size={15} className="wmk-update-arrow" />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 4: 4 Required Admin Charts (100% Live from Supabase Orders & Inventory) */}
              <div className="charts-grid">
                {/* Chart 1: Orders Per Branch */}
                <div className="dash-panel" style={{ marginTop: 0 }}>
                  <span className="eyebrow">CHART 1 · BRANCH VOLUME</span>
                  <h2>Orders Per Branch</h2>
                  {staffBranches.map((fullBranch) => {
                    const shortName = fullBranch.replace('Wash My Kicks – ', '')
                    const count = orders.filter((o) => o.branch === fullBranch || o.branch.includes(shortName)).length
                    const pct = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0
                    return (
                      <div key={fullBranch} className="chart-bar-row">
                        <div className="chart-bar-label">
                          <span>{shortName}</span>
                          <b>{count} orders</b>
                        </div>
                        <div className="chart-bar-track">
                          <div className="chart-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Chart 2: Revenue Trends (Day-by-Day Live Grouping) */}
                <div className="dash-panel" style={{ marginTop: 0 }}>
                  <span className="eyebrow">CHART 2 · FINANCIAL PERFORMANCE</span>
                  <h2>Daily Revenue Trends</h2>
                  {(() => {
                    const byDate = new Map<string, number>()
                    orders.forEach((o) => {
                      const d = o.date || 'Unscheduled'
                      byDate.set(d, (byDate.get(d) || 0) + pesoToNumber(o.price))
                    })
                    const entries = Array.from(byDate.entries()).slice(0, 5)
                    const maxRev = Math.max(1, ...entries.map(([, r]) => r))
                    if (entries.length === 0) {
                      return (
                        <div style={{ padding: '18px 4px', color: '#6b7280', fontSize: 13 }}>
                          No revenue recorded yet. Daily revenue bars will populate automatically day by day as orders are booked.
                        </div>
                      )
                    }
                    return (
                      <>
                        {entries.map(([dateLabel, rev]) => {
                          const pct = Math.round((rev / maxRev) * 100)
                          return (
                            <div key={dateLabel} className="chart-bar-row">
                              <div className="chart-bar-label">
                                <span>{dateLabel}</span>
                                <b>₱{rev.toLocaleString()}</b>
                              </div>
                              <div className="chart-bar-track">
                                <div className="chart-bar-fill" style={{ width: `${pct}%`, background: '#111827' }} />
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )
                  })()}
                </div>

                {/* Chart 3: Inventory Usage */}
                <div className="dash-panel" style={{ marginTop: 0 }}>
                  <span className="eyebrow">CHART 3 · CONSUMABLES TRACKING</span>
                  <h2>Inventory Usage</h2>
                  {inventory.length === 0 ? (
                    <div style={{ padding: '18px 4px', color: '#6b7280', fontSize: 13 }}>
                      No branch inventory items recorded yet. Add stock items in the Inventory tab to track utilization.
                    </div>
                  ) : (
                    inventory.slice(0, 5).map((item) => {
                      const usedPct = Math.min(96, Math.max(0, 100 - Math.round((item.stock / Math.max(item.target, 1)) * 100)))
                      return (
                        <div key={item.id} className="chart-bar-row">
                          <div className="chart-bar-label">
                            <span>{item.name}</span>
                            <b>{usedPct}% utilized</b>
                          </div>
                          <div className="chart-bar-track">
                            <div
                              className="chart-bar-fill"
                              style={{
                                width: `${usedPct}%`,
                                background: usedPct > 70 ? '#dc2626' : '#2563eb',
                              }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Chart 4: Service Popularity */}
                <div className="dash-panel" style={{ marginTop: 0 }}>
                  <span className="eyebrow">CHART 4 · SERVICE MIX</span>
                  <h2>Service Popularity</h2>
                  {servicesCatalog
                    .filter((s) => !s.archived)
                    .map((svc) => {
                      const count = orders.filter((o) => o.service.toLowerCase() === svc.title.toLowerCase()).length
                      const pct = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0
                      return (
                        <div key={svc.id} className="chart-bar-row">
                          <div className="chart-bar-label">
                            <span>
                              {svc.title} ({svc.price})
                            </span>
                            <b>
                              {count} bookings ({pct}%)
                            </b>
                          </div>
                          <div className="chart-bar-track">
                            <div className="chart-bar-fill" style={{ width: `${pct}%`, background: '#059669' }} />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </>
          )}

          {/* ADMIN TAB: BRANCHES */}
          {tab === 'Branches' && (
            <>
              <span className="eyebrow">NETWORK MANAGEMENT</span>
              <h1>Branches</h1>
              <p>Monitor branch capacity, assigned specialists, and daily order volume.</p>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Branch Name</th>
                      <th>Address</th>
                      <th>Lead Specialist</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wizardBranches.map((b) => (
                      <tr key={b.id}>
                        <td>0{b.id}</td>
                        <td>
                          <b>{b.name}</b>
                        </td>
                        <td>{b.address}</td>
                        <td>{b.comingSoon ? 'TBA' : 'Assigned Branch Team'}</td>
                        <td>
                          <span className={`status-pill ${b.comingSoon ? 'amber' : 'green'}`}>
                            {b.comingSoon ? 'Coming Soon' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ADMIN TAB: SERVICES CATALOG (EDIT, ARCHIVE & RESTORE) */}
          {tab === 'Services' && (
            <>
              <span className="eyebrow">SHOE SERVICE CATALOG MANAGEMENT</span>
              <h1>Services Catalog</h1>
              <p>Add, edit pricing &amp; turnaround duration, or archive and restore services across all WashMyKicks branches.</p>

              <div className="dash-panel" style={{ marginBottom: 18 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Add New Sneaker Care Service</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!newSvcTitle.trim()) return
                    const nextNum = String(servicesCatalog.length + 1).padStart(2, '0')
                    const numPrice = pesoToNumber(newSvcPrice) || 500
                    setServicesCatalog((prev) => [
                      ...prev,
                      {
                        id: nextNum,
                        title: newSvcTitle.trim(),
                        copy: newSvcCopy.trim() || 'Specialized sneaker care treatment.',
                        price: newSvcPrice.trim() || '₱500',
                        numericPrice: numPrice,
                        duration: newSvcDuration.trim() || '2–4 days',
                        archived: false,
                      },
                    ])
                    showToast(`Added "${newSvcTitle.trim()}" to the active services catalog.`)
                    setNewSvcTitle('')
                    setNewSvcCopy('')
                  }}
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>Service Name</label>
                    <input
                      type="text"
                      value={newSvcTitle}
                      onChange={(e) => setNewSvcTitle(e.target.value)}
                      placeholder="e.g. Suede & Nubuck Revival"
                      style={{ width: '100%', padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12.5 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>Description</label>
                    <input
                      type="text"
                      value={newSvcCopy}
                      onChange={(e) => setNewSvcCopy(e.target.value)}
                      placeholder="Service details..."
                      style={{ width: '100%', padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12.5 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>Price</label>
                    <input
                      type="text"
                      value={newSvcPrice}
                      onChange={(e) => setNewSvcPrice(e.target.value)}
                      placeholder="₱750"
                      style={{ width: '100%', padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12.5 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>Turnaround</label>
                    <input
                      type="text"
                      value={newSvcDuration}
                      onChange={(e) => setNewSvcDuration(e.target.value)}
                      placeholder="3–5 days"
                      style={{ width: '100%', padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12.5 }}
                    />
                  </div>
                  <button type="submit" className="primary" style={{ padding: '10px 14px', fontSize: 12.5 }}>
                    <Plus size={15} /> Add Service
                  </button>
                </form>
              </div>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Service Title</th>
                      <th>Description</th>
                      <th>Price</th>
                      <th>Duration</th>
                      <th>Catalog Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicesCatalog.map((svc) => {
                      const isEditing = editingServiceId === svc.id
                      return (
                        <tr key={svc.id} style={svc.archived ? { opacity: 0.65, background: '#f9fafb' } : undefined}>
                          <td>
                            <b>#{svc.id}</b>
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                value={svc.title}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setServicesCatalog((prev) =>
                                    prev.map((x) => (x.id === svc.id ? { ...x, title: v } : x))
                                  )
                                }}
                                style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, width: '100%' }}
                              />
                            ) : (
                              <b>{svc.title}</b>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                value={svc.copy}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setServicesCatalog((prev) =>
                                    prev.map((x) => (x.id === svc.id ? { ...x, copy: v } : x))
                                  )
                                }}
                                style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, width: '100%' }}
                              />
                            ) : (
                              svc.copy
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                value={svc.price}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setServicesCatalog((prev) =>
                                    prev.map((x) =>
                                      x.id === svc.id ? { ...x, price: v, numericPrice: pesoToNumber(v) || x.numericPrice } : x
                                    )
                                  )
                                }}
                                style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, width: 95 }}
                              />
                            ) : (
                              <b>{svc.price}</b>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                value={svc.duration}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setServicesCatalog((prev) =>
                                    prev.map((x) => (x.id === svc.id ? { ...x, duration: v } : x))
                                  )
                                }}
                                style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, width: 95 }}
                              />
                            ) : (
                              svc.duration
                            )}
                          </td>
                          <td>
                            <span className={`status-pill ${svc.archived ? 'gray' : 'green'}`}>
                              {svc.archived ? 'Archived (Hidden)' : 'Active'}
                            </span>
                          </td>
                          <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="outline"
                              style={{ padding: '5px 10px', fontSize: 11.5 }}
                              onClick={() => {
                                if (isEditing) {
                                  setEditingServiceId(null)
                                  showToast(`Saved changes to ${svc.title}.`)
                                } else {
                                  setEditingServiceId(svc.id)
                                }
                              }}
                            >
                              {isEditing ? 'Save' : 'Edit'}
                            </button>
                            <button
                              type="button"
                              className={svc.archived ? 'primary' : 'outline'}
                              style={{ padding: '5px 10px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              onClick={() => {
                                const nextArchived = !svc.archived
                                setServicesCatalog((prev) =>
                                  prev.map((x) => (x.id === svc.id ? { ...x, archived: nextArchived } : x))
                                )
                                showToast(
                                  nextArchived
                                    ? `Archived "${svc.title}" (hidden from booking wizard).`
                                    : `Restored "${svc.title}" to active booking catalog.`
                                )
                              }}
                            >
                              {svc.archived ? (
                                <>
                                  <RotateCcw size={12} /> Restore
                                </>
                              ) : (
                                <>
                                  <Archive size={12} /> Archive
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ADMIN TAB: INVENTORY */}
          {tab === 'Inventory' && (
            <InventoryManagementModule
              roleLabel="ADMINISTRATION"
              branches={staffBranches}
              inventory={inventory}
              setInventory={setInventory}
              onBackToDashboard={() => setTab('Dashboard')}
              onNotify={showToast}
            />
          )}

          {/* ADMIN TAB: CRM */}
          {tab === 'CRM' && (() => {
            const crmMap = new Map<string, { name: string; email: string; branch: string; pairs: number }>()
            usersList
              .filter((u) => u.role.toLowerCase().includes('customer'))
              .forEach((u) => {
                crmMap.set(u.email.toLowerCase(), {
                  name: u.name,
                  email: u.email,
                  branch: (u.branch || 'Pasig City').replace('Wash My Kicks – ', ''),
                  pairs: 0,
                })
              })
            orders.forEach((o) => {
              const key = (o.email || o.customer).toLowerCase()
              const existing = crmMap.get(key)
              if (existing) {
                if (o.status === 'Completed') existing.pairs += 1
              } else {
                crmMap.set(key, {
                  name: o.customer,
                  email: o.email,
                  branch: o.branch.replace('Wash My Kicks – ', ''),
                  pairs: o.status === 'Completed' ? 1 : 0,
                })
              }
            })
            const crmProfiles = Array.from(crmMap.values()).map((c) => ({
              ...c,
              tier: c.pairs >= 10 ? 'VIP Sneakerhead' : c.pairs >= 5 ? 'Gold Member' : c.pairs >= 1 ? 'Silver Member' : 'Member',
            }))
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                  <div>
                    <span className="eyebrow">CUSTOMER RELATIONSHIP MANAGEMENT</span>
                    <h1>CRM</h1>
                    <p>Customer profiles, lifetime sneaker care value, and retention insights.</p>
                  </div>
                  <button
                    type="button"
                    className="outline"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => {
                      const crmRows = crmProfiles.map((c) => [c.name, c.email, c.branch, c.pairs, c.tier])
                      const fileName = `WashMyKicks_CRM_Customers_${exportDateStamp()}.xlsx`
                      downloadExcel(fileName, [
                        {
                          name: 'CRM Customers',
                          headers: ['Customer Name', 'Email', 'Preferred Branch', 'Completed Pairs', 'Loyalty Tier'],
                          rows: crmRows,
                        },
                      ])
                      showToast(`Exported ${crmRows.length} CRM customer profiles to ${fileName}.`)
                    }}
                  >
                    <Download size={15} /> Export Customers (.xlsx)
                  </button>
                </div>

                <div className="dash-panel">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Email</th>
                        <th>Preferred Branch</th>
                        <th>Completed Pairs</th>
                        <th>Loyalty Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crmProfiles.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: 18 }}>
                            No customer profiles recorded yet.
                          </td>
                        </tr>
                      ) : (
                        crmProfiles.map((c) => (
                          <tr key={c.email}>
                            <td>
                              <b>{c.name}</b>
                            </td>
                            <td>{c.email}</td>
                            <td>{c.branch}</td>
                            <td>{c.pairs} pairs</td>
                            <td>
                              <span className="status-pill blue">{c.tier}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )
          })()}

          {/* ADMIN TAB: JOB ORDERS */}
          {tab === 'Job Orders' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                <div>
                  <span className="eyebrow">ALL-BRANCH JOB ORDERS</span>
                  <h1>Job Orders</h1>
                  <p>Complete visibility and specialist assignment across all branches.</p>
                </div>
                <button
                  type="button"
                  className="outline"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    const fileName = `WashMyKicks_All_JobOrders_${exportDateStamp()}.xlsx`
                    downloadExcel(fileName, [
                      {
                        name: 'All Job Orders',
                        headers: ['Job Order ID', 'Customer', 'Email', 'Sneaker Pair', 'Service', 'Branch', 'Date', 'Time', 'Price (PHP)', 'Specialist', 'Assessed', 'Status'],
                        rows: orders.map((o) => [
                          o.id,
                          o.customer,
                          o.email,
                          o.shoe,
                          o.service,
                          o.branch,
                          o.date,
                          o.time,
                          pesoToNumber(o.price),
                          o.specialist,
                          o.assessed ? 'Yes' : 'Pending',
                          o.status,
                        ]),
                      },
                    ])
                    showToast(`Exported ${orders.length} job orders to ${fileName}.`)
                  }}
                >
                  <Download size={15} /> Export Job Orders (.xlsx)
                </button>
              </div>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job Order</th>
                      <th>Customer</th>
                      <th>Sneaker</th>
                      <th>Service</th>
                      <th>Branch</th>
                      <th>Specialist</th>
                      <th>Status</th>
                      <th>Update Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <b>{o.id}</b>
                        </td>
                        <td>{o.customer}</td>
                        <td>{o.shoe}</td>
                        <td>{o.service}</td>
                        <td>{o.branch}</td>
                        <td>
                          <select
                            value={o.specialist}
                            onChange={(e) => {
                              const nextSpec = e.target.value
                              setOrders((prev) =>
                                prev.map((ord) => (ord.id === o.id ? { ...ord, specialist: nextSpec } : ord))
                              )
                              showToast(`Assigned ${nextSpec} to ${o.id}.`)
                            }}
                            style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }}
                          >
                            {Array.from(
                              new Set([
                                o.specialist || 'Pending Specialist Assessment',
                                ...usersList
                                  .filter((u) => u.role.toLowerCase().includes('staff'))
                                  .map((u) => u.name),
                                'Pending Specialist Assessment',
                              ])
                            ).map((specName) => (
                              <option key={specName} value={specName}>
                                {specName}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                        <td>
                          <StatusSelect
                            value={o.status}
                            onChange={(next) => {
                              void applyOrderStatusUpdate({
                                id: o.id,
                                nextStatus: next,
                                orders,
                                setOrders,
                                showToast,
                              })
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ADMIN TAB: REPORTS */}
          {tab === 'Reports' && (() => {
            const avgTicket = orders.length > 0 ? Math.round(adminRevenueTotal / orders.length) : 0
            const dailyMap = new Map<string, { date: string; totalOrders: number; completedPairs: number; revenue: number }>()
            orders.forEach((o) => {
              const d = o.date || 'Unscheduled'
              const existing = dailyMap.get(d)
              const priceNum = pesoToNumber(o.price)
              if (existing) {
                existing.totalOrders += 1
                if (o.status === 'Completed') existing.completedPairs += 1
                existing.revenue += priceNum
              } else {
                dailyMap.set(d, {
                  date: d,
                  totalOrders: 1,
                  completedPairs: o.status === 'Completed' ? 1 : 0,
                  revenue: priceNum,
                })
              }
            })
            const dailyRows = Array.from(dailyMap.values())
            return (
              <>
                <span className="eyebrow">ANALYTICS & EXPORTS</span>
                <h1>Reports</h1>
                <p>Live financial summaries, day-by-day revenue logs, and branch KPI exports.</p>

                <div className="dash-panel">
                  <div className="dash-stats" style={{ marginBottom: 20 }}>
                    <article>
                      <span>Gross Revenue</span>
                      <b>₱{adminRevenueTotal.toLocaleString()}</b>
                      <small>{orders.length === 0 ? 'No orders recorded yet' : `From ${orders.length} live orders`}</small>
                    </article>
                    <article>
                      <span>Avg. Ticket Value</span>
                      <b>₱{avgTicket.toLocaleString()}</b>
                      <small>{orders.length === 0 ? 'Awaiting bookings' : 'Live average order value'}</small>
                    </article>
                    <article>
                      <span>Completed Pairs</span>
                      <b>{adminCompletedCount} pairs</b>
                      <small>{orders.length === 0 ? '0% completed' : 'Across all 7 branches'}</small>
                    </article>
                    <article>
                      <span>Registered Users</span>
                      <b>{usersList.length}</b>
                      <small>Verified accounts</small>
                    </article>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Day-by-Day Revenue &amp; Operations Log</h3>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Orders Booked</th>
                          <th>Completed Pairs</th>
                          <th>Daily Gross Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyRows.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', color: '#6b7280', padding: 18 }}>
                              No daily report entries yet. Financial reports will automatically populate day by day as orders are created.
                            </td>
                          </tr>
                        ) : (
                          dailyRows.map((row) => (
                            <tr key={row.date}>
                              <td>
                                <b>{row.date}</b>
                              </td>
                              <td>{row.totalOrders} orders</td>
                              <td>{row.completedPairs} pairs</td>
                              <td>
                                <b>₱{row.revenue.toLocaleString()}</b>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    className="primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    onClick={() => {
                      const fileName = `WashMyKicks_Executive_Report_${exportDateStamp()}.xlsx`
                      downloadExcel(fileName, [
                        {
                          name: 'Executive Summary',
                          headers: ['Metric', 'Value', 'Notes'],
                          rows: [
                            ['Gross Revenue (PHP)', adminRevenueTotal, `From ${orders.length} live orders`],
                            ['Average Ticket Value (PHP)', avgTicket, 'Live average order value'],
                            ['Completed Pairs', adminCompletedCount, 'Across all 7 branches'],
                            ['Registered Users', usersList.length, 'Verified accounts'],
                          ],
                        },
                        {
                          name: 'Daily Revenue Log',
                          headers: ['Date', 'Orders Booked', 'Completed Pairs', 'Daily Revenue (PHP)'],
                          rows: dailyRows.map((r) => [r.date, r.totalOrders, r.completedPairs, r.revenue]),
                        },
                        {
                          name: 'Job Orders',
                          headers: ['Job Order ID', 'Customer', 'Email', 'Sneaker Pair', 'Service', 'Branch', 'Date', 'Time', 'Price (PHP)', 'Specialist', 'Status'],
                          rows: orders.map((o) => [
                            o.id,
                            o.customer,
                            o.email,
                            o.shoe,
                            o.service,
                            o.branch,
                            o.date,
                            o.time,
                            pesoToNumber(o.price),
                            o.specialist,
                            o.status,
                          ]),
                        },
                        {
                          name: 'Services Catalog',
                          headers: ['Code', 'Service Name', 'Description', 'Price (PHP)', 'Turnaround', 'Status'],
                          rows: servicesCatalog.map((s) => [
                            s.id,
                            s.title,
                            s.copy,
                            s.numericPrice,
                            s.duration,
                            s.archived ? 'Archived' : 'Active',
                          ]),
                        },
                        {
                          name: 'Branch Inventory',
                          headers: ['Item ID', 'Item Name', 'Category', 'Branch', 'Current Stock', 'Target Level', 'Status'],
                          rows: inventory.map((i) => [
                            i.id,
                            i.name,
                            i.category,
                            i.branch,
                            i.stock,
                            i.target,
                            getInventoryStatus(i.stock, i.target),
                          ]),
                        },
                      ])
                      showToast(`Exported multi-sheet Excel workbook ${fileName}`)
                    }}
                  >
                    <Download size={16} /> Export Full Financial &amp; Operations Report (.xlsx)
                  </button>
                </div>
              </>
            )
          })()}

          {/* ADMIN TAB: AUDIT TRAIL */}
          {tab === 'Audit Trail' && (
            <>
              <span className="eyebrow">SECURITY & COMPLIANCE LOGS</span>
              <h1>Audit Trail</h1>
              <p>Immutable chronological record of role logins, status changes, and inventory updates.</p>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Actor</th>
                      <th>Role</th>
                      <th>Action</th>
                      <th>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: 18 }}>
                          No audit trail entries recorded yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log, i) => (
                        <tr key={i}>
                          <td>{log.time}</td>
                          <td>
                            <b>{log.actor}</b>
                          </td>
                          <td>
                            <span className="status-pill gray">{log.role}</span>
                          </td>
                          <td>{log.action}</td>
                          <td>{log.target}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ADMIN TAB: USER MANAGEMENT */}
          {tab === 'User Management' && (
            <>
              <span className="eyebrow">ROLE & ACCOUNT ADMINISTRATION</span>
              <h1>User Management</h1>
              <p>Manage Customer, Staff, and Administrator accounts and role permissions.</p>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Assigned Role</th>
                      <th>Branch</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>
                          <b>{u.name}</b>
                        </td>
                        <td>{u.email}</td>
                        <td>
                          <span className="status-pill blue">{u.role}</span>
                        </td>
                        <td>{u.branch}</td>
                        <td>
                          <span className={`status-pill ${u.active ? 'green' : 'gray'}`}>
                            {u.active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="outline"
                            style={{ padding: '5px 10px', fontSize: 11 }}
                            onClick={() => {
                              setUsersList((prev) =>
                                prev.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x))
                              )
                              showToast(`Updated account status for ${u.name}.`)
                            }}
                          >
                            {u.active ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ADMIN TAB: SETTINGS & RBAC MATRIX */}
          {tab === 'Settings' && (
            <>
              <span className="eyebrow">SYSTEM CONFIGURATION</span>
              <h1>Settings</h1>
              <p>Configure Role-Based Access Control (RBAC) policies and global system preferences.</p>

              <div className="dash-panel">
                <h2>Role-Based Access Control (RBAC) Policy Matrix</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Module / Capability</th>
                      <th>Customer Role</th>
                      <th>Staff Role</th>
                      <th>Administrator Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Homepage & Public Pages', '✔ Allowed', '✔ Allowed', '✔ Allowed'],
                      ['Book Appointment & Track Order', '✔ Allowed', '✖ Restricted', '✔ Allowed'],
                      ['Reviews & Customer Profile', '✔ Allowed', '✖ Restricted', '✔ Allowed'],
                      ['Job Orders & Status Updates', '✖ Restricted', '✔ Allowed', '✔ Allowed'],
                      ['Shoe Assessments & Documentation', '✖ Restricted', '✔ Allowed', '✔ Allowed'],
                      ['Inventory Management', '✖ Restricted', '✔ Allowed', '✔ Allowed'],
                      ['Revenue Reports & CRM', '✖ Restricted', '✖ Restricted', '✔ Allowed'],
                      ['Audit Trail & User Management', '✖ Restricted', '✖ Restricted', '✔ Allowed'],
                      ['System Settings', '✖ Restricted', '✖ Restricted', '✔ Allowed'],
                    ].map(([mod, cust, stf, adm]) => (
                      <tr key={String(mod)}>
                        <td>
                          <b>{mod}</b>
                        </td>
                        <td style={{ color: String(cust).startsWith('✔') ? '#059669' : '#dc2626', fontWeight: 600 }}>
                          {cust}
                        </td>
                        <td style={{ color: String(stf).startsWith('✔') ? '#059669' : '#dc2626', fontWeight: 600 }}>
                          {stf}
                        </td>
                        <td style={{ color: '#059669', fontWeight: 700 }}>{adm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="dash-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => showToast('System & RBAC policies saved to system_settings.')}
                  >
                    Save System Configuration
                  </button>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => {
                      void triggerDatabaseBackupManifest().catch(() => null)
                      showToast('Daily database backup manifest & integrity snapshot recorded in audit_logs.')
                    }}
                  >
                    Run Daily Backup Snapshot
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </section>
  )
}

/* ============================================================================
   PUBLIC SHOE BOOKING MANAGEMENT MODULE (PRE-SELECTED BRANCH INTEGRATION)
   ============================================================================ */

function PublicShoeBookingModule({
  initialBranchId,
  preselectedFromMap,
  existingOrders = initialOrders,
  servicesCatalog = services,
  activeCustomerEmail = '',
  activeCustomerName = '',
  onCompleteBooking,
  setPage,
}: {
  initialBranchId: number
  preselectedFromMap: boolean
  existingOrders?: JobOrder[]
  servicesCatalog?: Service[]
  activeCustomerEmail?: string
  activeCustomerName?: string
  onCompleteBooking: (newOrder: JobOrder) => void
  setPage: (p: string) => void
}) {
  const [bookedOrder, setBookedOrder] = useState<JobOrder | null>(null)

  if (bookedOrder) {
    const signedInSameEmail =
      Boolean(activeCustomerEmail) &&
      activeCustomerEmail.trim().toLowerCase() === bookedOrder.email.trim().toLowerCase()

    return (
      <section className="listing">
        <div className="wizard-card" style={{ textAlign: 'center', maxWidth: 620 }}>
          <span className="eyebrow">APPOINTMENT CONFIRMED</span>
          <h2 style={{ fontSize: 28, margin: '10px 0 8px' }}>Your kicks are scheduled!</h2>
          <p style={{ fontSize: 13.5, color: '#4b5563', marginBottom: 16 }}>
            Job Order <b>{bookedOrder.id}</b> has been created at <b>{bookedOrder.branch}</b> on{' '}
            <b>
              {bookedOrder.date} · {bookedOrder.time}
            </b>
            .
          </p>
          {bookedOrder.linkedToAccount && (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 18,
                fontSize: 13,
                color: '#065f46',
                textAlign: 'left',
              }}
            >
              <b>Synced to Customer Account:</b> Your existing account for <b>{bookedOrder.email}</b> was detected — this
              booking has been added to your Customer Dashboard.
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="primary" onClick={() => setPage('track')}>
              Track My Order ({bookedOrder.id}) <ArrowRight size={15} />
            </button>
            <button
              type="button"
              className="outline"
              onClick={() => setPage(signedInSameEmail ? 'dashboard-customer' : 'login-customer')}
            >
              Open in Customer Portal
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="listing" style={{ paddingTop: 48 }}>
      <CustomerBookAppointmentWizard
        initialBranchId={initialBranchId}
        preselectedFromMap={preselectedFromMap}
        existingOrders={existingOrders}
        servicesCatalog={servicesCatalog}
        defaultEmail={activeCustomerEmail}
        accountEmail={activeCustomerEmail}
        accountName={activeCustomerName}
        onCancel={() => setPage('home')}
        onCompleteBooking={(order) => {
          onCompleteBooking(order)
          setBookedOrder(order)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    </section>
  )
}

/* ============================================================================
   DEDICATED URL ROUTING & SESSION PERSISTENCE
   - Customer Login:     /login              (or /customer/login)
   - Staff Login:        /staff/login        (or /staff)
   - Admin Login:        /admin/login        (or /admin)
   - Customer Dashboard: /customer/dashboard (or /dashboard)
   - Staff Dashboard:    /staff/dashboard
   - Admin Dashboard:    /admin/dashboard
   - Portal Switcher:    /portals
   ============================================================================ */

const ACTIVE_SESSION_STORAGE_KEY = 'wmk-active-session-v1'

type PersistedRoleSession = {
  role: Role
  userMeta: {
    name: string
    email: string
    employeeId?: string
    branch?: string
  }
}

function loadPersistedRoleSession(): PersistedRoleSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && (parsed.role === 'customer' || parsed.role === 'staff' || parsed.role === 'admin') && parsed.userMeta) {
      return parsed as PersistedRoleSession
    }
    return null
  } catch {
    return null
  }
}

function savePersistedRoleSession(session: PersistedRoleSession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
    } else {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session))
    }
  } catch {}
}

function getBasePathPrefix(): string {
  if (typeof window === 'undefined') return ''
  return window.location.pathname.startsWith('/WASHMYKICKS-WEB') ? '/WASHMYKICKS-WEB' : ''
}

function urlPathToPage(rawPathname: string): string {
  const prefix = getBasePathPrefix()
  let path = rawPathname
  if (prefix && path.startsWith(prefix)) {
    path = path.slice(prefix.length)
  }
  const clean = (path.replace(/\/+$/, '') || '/').toLowerCase()

  switch (clean) {
    case '/':
    case '/home':
    case '/index.html':
      return 'home'
    case '/services':
      return 'services'
    case '/track':
      return 'track'
    case '/branches':
      return 'branches'
    case '/book':
      return 'book'
    case '/reviews':
      return 'reviews'
    case '/about':
      return 'about'
    case '/login':
    case '/customer/login':
    case '/portals':
    case '/select-account':
      return 'login-customer'
    case '/staff/login':
    case '/staff':
      return 'login-staff'
    case '/admin/login':
    case '/admin':
      return 'login-admin'
    case '/customer/dashboard':
    case '/dashboard':
      return 'dashboard-customer'
    case '/staff/dashboard':
      return 'dashboard-staff'
    case '/admin/dashboard':
      return 'dashboard-admin'
    default:
      return 'home'
  }
}

function pageToUrlPath(pageKey: string): string {
  const prefix = getBasePathPrefix()
  let sub = '/'
  switch (pageKey) {
    case 'home':
      sub = '/'
      break
    case 'services':
      sub = '/services'
      break
    case 'track':
      sub = '/track'
      break
    case 'branches':
      sub = '/branches'
      break
    case 'book':
      sub = '/book'
      break
    case 'reviews':
      sub = '/reviews'
      break
    case 'about':
      sub = '/about'
      break
    case 'login':
    case 'login-customer':
    case 'portals':
      sub = '/login'
      break
    case 'login-staff':
      sub = '/staff/login'
      break
    case 'login-admin':
      sub = '/admin/login'
      break
    case 'dashboard-customer':
      sub = '/customer/dashboard'
      break
    case 'dashboard-staff':
      sub = '/staff/dashboard'
      break
    case 'dashboard-admin':
      sub = '/admin/dashboard'
      break
    default:
      sub = '/'
      break
  }
  if (!prefix) return sub
  return sub === '/' ? `${prefix}/` : `${prefix}${sub}`
}

/* ============================================================================
   MAIN APPLICATION ROUTER & STATE
   ============================================================================ */

function App() {
  const initialSavedSession = loadPersistedRoleSession()
  const initialRoutePage = (() => {
    if (typeof window === 'undefined') return 'home'
    const requested = urlPathToPage(window.location.pathname)
    if (requested === 'dashboard-customer' && initialSavedSession?.role !== 'customer') {
      return 'login-customer'
    }
    if (requested === 'dashboard-staff' && initialSavedSession?.role !== 'staff') {
      return 'login-staff'
    }
    if (requested === 'dashboard-admin' && initialSavedSession?.role !== 'admin') {
      return 'login-admin'
    }
    return requested
  })()

  const [page, setPageState] = useState(initialRoutePage)
  const [activeRole, setActiveRole] = useState<Role | null>(initialSavedSession?.role || null)
  const [preselectedBranchId, setPreselectedBranchId] = useState<number>(1)
  const [preselectedFromMap, setPreselectedFromMap] = useState<boolean>(false)
  const [customerInitialTab, setCustomerInitialTab] = useState<
    'Dashboard' | 'Book Appointment' | 'Track Shoes' | 'Notifications' | 'Service History' | 'Reviews' | 'Profile'
  >('Dashboard')

  const [userMeta, setUserMeta] = useState<{
    name: string
    email: string
    employeeId?: string
    branch?: string
  }>(
    initialSavedSession?.userMeta || {
      name: 'Customer',
      email: '',
      employeeId: '',
      branch: staffBranches[0],
    }
  )

  const setPage = (nextPage: string) => {
    const normalized = nextPage === 'login' ? 'login-customer' : nextPage
    setPageState(normalized)
    if (typeof window !== 'undefined') {
      const targetUrl = pageToUrlPath(normalized)
      if (window.location.pathname !== targetUrl) {
        window.history.pushState({ page: normalized }, '', targetUrl)
      }
    }
  }

  // Sync browser URL on initial mount and verify live session integrity
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (initialSavedSession?.role) {
      verifyPersistedSessionRole(initialSavedSession.role)
        .then((check) => {
          if (!check.valid && !check.unreachable) {
            savePersistedRoleSession(null)
            setActiveRole(null)
            setPageState((curr) =>
              curr.startsWith('dashboard-') ? `login-${initialSavedSession.role}` : curr
            )
          }
        })
        .catch(() => {})
    }
    const expectedUrl = pageToUrlPath(page)
    if (window.location.pathname !== expectedUrl) {
      window.history.replaceState({ page }, '', expectedUrl)
    }

    const handlePopState = () => {
      const session = loadPersistedRoleSession()
      const requested = urlPathToPage(window.location.pathname)
      if (requested === 'dashboard-customer' && session?.role !== 'customer') {
        setPageState('login-customer')
        window.history.replaceState({ page: 'login-customer' }, '', pageToUrlPath('login-customer'))
        return
      }
      if (requested === 'dashboard-staff' && session?.role !== 'staff') {
        setPageState('login-staff')
        window.history.replaceState({ page: 'login-staff' }, '', pageToUrlPath('login-staff'))
        return
      }
      if (requested === 'dashboard-admin' && session?.role !== 'admin') {
        setPageState('login-admin')
        window.history.replaceState({ page: 'login-admin' }, '', pageToUrlPath('login-admin'))
        return
      }
      setPageState(requested)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const [orders, setOrders] = useState<JobOrder[]>(() => {
    const cached = loadCachedProductionData()
    return cached.orders.map((o: any) => ({
      ...o,
      docs: o.docs || createDefaultDocumentation(),
    }))
  })
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews)
  const [inventory, setInventory] = useState<InventoryRecord[]>(() => {
    const cached = loadCachedProductionData()
    return cached.inventory.length > 0 ? cached.inventory : INITIAL_INVENTORY_RECORDS
  })
  const [servicesCatalog, setServicesCatalog] = useState<Service[]>(services)

  // Fetch live production rows from Supabase PostgreSQL & Customer Booking API on mount & after login
  useEffect(() => {
    fetchLiveProductionData(activeRole === 'customer' ? userMeta.email : undefined)
      .then((live) => {
        if (live.orders.length > 0) {
          const staffUsers = (live.users || []).filter((u: any) =>
            String(u.role || '').toLowerCase().includes('staff')
          )
          setOrders(
            live.orders.map((o: any) => {
              let resolvedSpec = o.specialist
              if (
                !resolvedSpec ||
                resolvedSpec === 'Carlo Mendoza' ||
                resolvedSpec === 'Assigned Specialist'
              ) {
                const branchStaff =
                  staffUsers.find((s: any) => s.branch === o.branch) || staffUsers[0]
                if (o.assessed || o.assessmentNotes || o.status !== 'Pending Assessment') {
                  resolvedSpec = branchStaff?.name || 'Branch Specialist'
                } else {
                  resolvedSpec = branchStaff?.name || 'Pending Specialist Assessment'
                }
              }
              return {
                ...o,
                specialist: resolvedSpec,
                docs: o.docs || createDefaultDocumentation(),
              }
            })
          )
        }
        if (live.inventory.length > 0) {
          setInventory(live.inventory)
        }
      })
      .catch(() => {})
  }, [activeRole, userMeta.email])

  useEffect(() => {
    if (orders.length > 0) saveLiveProductionOrders(orders)
  }, [orders])

  useEffect(() => {
    if (inventory.length > 0) saveLiveProductionInventory(inventory)
  }, [inventory])

  const handleBookBranchFromMap = (_branchName: string, branchId: number) => {
    setPreselectedBranchId(branchId)
    setPreselectedFromMap(true)
    if (activeRole === 'customer') {
      setCustomerInitialTab('Book Appointment')
      setPage('dashboard-customer')
    } else {
      setCustomerInitialTab('Book Appointment')
      setPage('book')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLoginSuccess = (
    role: Role,
    meta: { email: string; employeeId?: string; branch?: string; name?: string }
  ) => {
    const fallbackName =
      (meta.email || '')
        .split('@')[0]
        .replace(/[0-9._-]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ') || (role === 'customer' ? 'Customer' : role === 'staff' ? 'Staff Specialist' : 'Administrator')
    const savedPrefs = role === 'customer' ? loadCustomerProfilePrefs(meta.email) : null
    const nextMeta = {
      name: savedPrefs?.name || meta.name || fallbackName,
      email: meta.email,
      employeeId: meta.employeeId,
      branch: savedPrefs?.branch || meta.branch,
    }
    setActiveRole(role)
    setUserMeta(nextMeta)
    savePersistedRoleSession({ role, userMeta: nextMeta })
    if (role === 'customer' && preselectedFromMap) {
      setCustomerInitialTab('Book Appointment')
    } else {
      setCustomerInitialTab('Dashboard')
    }
    setPage(`dashboard-${role}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLogout = () => {
    const previousRole = activeRole
    void signOutSession(userMeta.email).catch(() => null)
    savePersistedRoleSession(null)
    setActiveRole(null)
    setCustomerInitialTab('Dashboard')
    if (previousRole === 'staff') {
      setPage('login-staff')
    } else if (previousRole === 'admin') {
      setPage('login-admin')
    } else {
      setPage('login-customer')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Role-Specific Login Pages (/login, /staff/login, /admin/login)
  if (page === 'login' || page.startsWith('login-')) {
    const role = (page === 'login' ? 'customer' : page.replace('login-', '')) as Role
    return <RoleLogin role={role} setPage={setPage} onLoginSuccess={handleLoginSuccess} />
  }

  // Role Dashboards
  if (page === 'dashboard-customer') {
    return (
      <CustomerDashboard
        userMeta={userMeta}
        onUpdateUserMeta={(patch) => {
          const updated = { ...userMeta, ...patch }
          setUserMeta(updated)
          savePersistedRoleSession({ role: 'customer', userMeta: updated })
        }}
        orders={orders}
        setOrders={setOrders}
        reviews={reviews}
        setReviews={setReviews}
        servicesCatalog={servicesCatalog}
        setPage={setPage}
        onLogout={handleLogout}
        initialTab={customerInitialTab}
        preselectedBranchId={preselectedBranchId}
        preselectedFromMap={preselectedFromMap}
      />
    )
  }

  if (page === 'dashboard-staff') {
    return (
      <StaffDashboard
        userMeta={userMeta}
        orders={orders}
        setOrders={setOrders}
        inventory={inventory}
        setInventory={setInventory}
        onLogout={handleLogout}
      />
    )
  }

  if (page === 'dashboard-admin') {
    return (
      <AdminDashboard
        userMeta={userMeta}
        orders={orders}
        setOrders={setOrders}
        inventory={inventory}
        setInventory={setInventory}
        servicesCatalog={servicesCatalog}
        setServicesCatalog={setServicesCatalog}
        onLogout={handleLogout}
      />
    )
  }

  // Public Pages & Account Selection Screen
  const content =
    page === 'home' ? (
      <Home setPage={setPage} onBookBranch={handleBookBranchFromMap} servicesCatalog={servicesCatalog} />
    ) : page === 'services' ? (
      <Services setPage={setPage} servicesCatalog={servicesCatalog} />
    ) : page === 'track' ? (
      <Track orders={orders} setPage={setPage} />
    ) : page === 'branches' ? (
      <Branches onBookBranch={handleBookBranchFromMap} />
    ) : page === 'book' ? (
      <PublicShoeBookingModule
        initialBranchId={preselectedBranchId}
        preselectedFromMap={preselectedFromMap}
        existingOrders={orders}
        servicesCatalog={servicesCatalog}
        activeCustomerEmail={activeRole === 'customer' ? userMeta.email : ''}
        activeCustomerName={activeRole === 'customer' ? userMeta.name : ''}
        onCompleteBooking={(newOrder) =>
          setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)])
        }
        setPage={setPage}
      />
    ) : page === 'reviews' ? (
      <Reviews reviews={reviews} />
    ) : page === 'about' ? (
      <About />
    ) : (
      <Home setPage={setPage} onBookBranch={handleBookBranchFromMap} servicesCatalog={servicesCatalog} />
    )

  return (
    <>
      <Header page={page} setPage={setPage} activeRole={activeRole} />
      <main>{content}</main>
      <Footer setPage={setPage} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
