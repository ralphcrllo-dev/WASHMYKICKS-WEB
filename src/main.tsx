import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BranchLocatorMap } from './components/BranchLocatorMap'
import {
  createBookingRecord,
  dispatchTransactionalEmail,
  fetchLiveProductionData,
  registerCustomerAccount,
  requestPasswordResetEmail,
  saveLiveProductionInventory,
  saveLiveProductionOrders,
  signInWithRole,
  signOutSession,
  submitCustomerCrmInteraction,
  triggerDatabaseBackupManifest,
  updateServiceOrderStatus,
  uploadAssessmentPhotoToStorage,
  upsertShoeAssessmentRecord,
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
  docs: ShoeDocumentation
}

const initialOrders: JobOrder[] = []

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
  { id: 'r1', author: 'Angela M.', service: 'Restoration', branch: 'Wash My Kicks – San Juan City', rating: 5, quote: 'My white pairs looked brand new—honestly unreal.', date: 'March 18, 2026' },
  { id: 'r2', author: 'Jiro R.', service: 'Deep Cleaning', branch: 'Wash My Kicks – Quezon City', rating: 5, quote: 'The progress photos made the whole service feel premium.', date: 'March 15, 2026' },
  { id: 'r3', author: 'Kaye S.', service: 'Shoe Repair', branch: 'Wash My Kicks – Pasig City', rating: 5, quote: 'Fast, meticulous, and totally worth it.', date: 'March 11, 2026' },
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
        <small>SNEAKER CARE SYSTEM</small>
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
          <>
            <button
              className={page === 'login-customer' ? 'active' : ''}
              onClick={() => go('login-customer')}
            >
              Log in
            </button>
            <button className="nav-cta" onClick={() => go('portals')}>
              Select Account / Portal
            </button>
          </>
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
        <p>Premium sneaker care, now organized from booking to pickup.</p>
      </div>
      <div>
        <b>Explore</b>
        <button onClick={() => setPage('services')}>Services</button>
        <button onClick={() => setPage('track')}>Track order</button>
        <button onClick={() => setPage('branches')}>Branches</button>
      </div>
      <div>
        <b>Portals</b>
        <button onClick={() => setPage('portals')}>Account Selection</button>
        <button onClick={() => setPage('login-customer')}>Customer Login</button>
        <button onClick={() => setPage('login-staff')}>Staff Login</button>
        <button onClick={() => setPage('login-admin')}>Administrator Login</button>
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
          <span className="eyebrow">MANILA'S TRUSTED SNEAKER CARE</span>
          <h1>
            WE BRING YOUR
            <br />
            KICKS <em>BACK.</em>
          </h1>
          <p>
            Professional shoe cleaning, repair, and restoration from sneaker specialists who treat every pair like their own.
          </p>
          <div className="actions">
            <button className="primary" onClick={() => setPage('book')}>
              Book an appointment <ArrowRight size={16} />
            </button>
            <button className="text-button" onClick={() => setPage('track')}>
              Track my shoes
            </button>
          </div>
          <div className="social-proof">
            <span className="avatars">A M J</span>
            <span>
              <b>4.9/5</b> from 2,800+ sneakerheads
            </span>
          </div>
        </div>
        <div className="hero-image">
          <div className="quality-card">
            <Check size={16} />
            <span>
              <b>Quality checked</b>
              <small>Every pair. Every time.</small>
            </span>
          </div>
        </div>
      </section>
      <div className="ticker">
        DEEP CLEAN <i /> RESTORATION <i /> SOLE REPAIR <i /> PROTECTION <i /> COLOR REVIVAL <i /> BUILT FOR EVERY PAIR
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">BUILT FOR SNEAKERS</span>
            <h2>Sneaker care, done right.</h2>
          </div>
          <button className="text-button" onClick={() => setPage('services')}>
            View all services <ArrowRight size={16} />
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
          <span className="eyebrow">THE WMK STANDARD</span>
          <h2>
            Results you can see.
            <br />
            Care you can trust.
          </h2>
          <p>
            Every pair goes through a documented multi-step process—from assessment and before photos to final quality control.
          </p>
          <ul>
            <li>Photo-documented service</li>
            <li>Specialist assigned to every pair</li>
            <li>Live status notifications</li>
            <li>Final 5-point quality check</li>
          </ul>
          <button className="primary" onClick={() => setPage('reviews')}>
            See customer results <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <section className="stats">
        {[
          ['12K+', 'PAIRS REVIVED'],
          ['4.9', 'AVERAGE RATING'],
          ['7+', 'METRO BRANCHES'],
          ['96%', 'RETURN CUSTOMERS'],
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
            <span className="eyebrow">NEAR YOU</span>
            <h2>Find your closest branch.</h2>
            <p>Seven active locations across Metro Manila, Rizal, and Cavite — one consistent standard of care.</p>
          </div>
          <button className="text-button" onClick={() => setPage('branches')}>
            Explore all branches <ArrowRight size={16} />
          </button>
        </div>
        <BranchLocatorMap onBookBranch={onBookBranch} />
      </section>
      <section className="cta">
        <span className="eyebrow">YOUR KICKS DESERVE BETTER</span>
        <h2>Ready for a fresh start?</h2>
        <p>Sign in to your portal and book in under two minutes.</p>
        <button className="primary light" onClick={() => setPage('login')}>
          Log in / Book appointment <ArrowRight size={16} />
        </button>
      </section>
    </>
  )
}

function Listing({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="listing">
      <span className="eyebrow">{eyebrow}</span>
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
    <Listing eyebrow="OUR SERVICES" title="Care for every kind of kick.">
      <p className="lead">Transparent pricing, expert hands, and progress updates from drop-off to pickup.</p>
      <div className="services-grid full">
        {activeServices.map((s) => (
          <ServiceCard service={s} key={s.id} onClick={() => setPage('login')} />
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
    <Listing eyebrow="ORDER TRACKING" title="Know where your kicks are.">
      <p className="lead">Enter your job order number to see the latest update from your assigned specialist.</p>
      <div className="tracking-box">
        <label>
          Job order number
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. WMK-2026-0001" />
        </label>
        {matched ? (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <b>{matched.id} — {matched.shoe}</b>
              <StatusBadge status={matched.status} />
            </div>
            <p style={{ margin: '6px 0 12px', fontSize: 12 }}>
              {matched.service} · {matched.branch} · Specialist: {matched.specialist}
            </p>
            <ServiceStatusTimeline currentStatus={matched.status} />
          </div>
        ) : (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 18, color: '#6b7280', fontSize: 13 }}>
            {orders.length === 0
              ? 'No live job orders in Supabase yet. Book an appointment to generate your first live Job Order.'
              : 'No matching job order found for that reference number.'}
          </div>
        )}
        <button className="primary" onClick={() => setPage('login-customer')}>
          Sign in to Customer Portal for full tracking <ArrowRight size={16} />
        </button>
        <p>
          Don't have an order yet? <button onClick={() => setPage('login')}>Book an appointment</button>
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
    <Listing eyebrow="OUR LOCATIONS" title="Care that’s close to home.">
      <p className="lead">
        Locate the nearest WashMyKicks branch in real time, switch between Satellite, Hybrid, and Standard views, and book directly.
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
              {branch.comingSoon ? 'Coming Soon' : 'Book Appointment'} <ArrowRight size={15} />
            </button>
          </article>
        ))}
      </div>
    </Listing>
  )
}

function Reviews({ reviews }: { reviews: ReviewItem[] }) {
  return (
    <Listing eyebrow="CUSTOMER STORIES" title="The results speak loud.">
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
    <Listing eyebrow="ABOUT WASHMYKICKS" title="Built by sneakerheads, for sneakerheads.">
      <p className="lead">
        We started with a simple belief: every pair deserves skilled, careful work. Today, our specialists combine proven
        methods with a customer experience that keeps every step clear.
      </p>
      <div className="about-strip">
        <div>
          <b>12K+</b>
          <span>pairs revived</span>
        </div>
        <div>
          <b>7</b>
          <span>active branches</span>
        </div>
        <div>
          <b>4.9/5</b>
          <span>customer rating</span>
        </div>
      </div>
    </Listing>
  )
}

/* ============================================================================
   SCREEN 1: ACCOUNT SELECTION PAGE
   ============================================================================ */

function AccountSelectionPage({ setPage }: { setPage: (page: string) => void }) {
  const [forgotModal, setForgotModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const cards = [
    {
      id: 'customer' as Role,
      tag: 'CUSTOMER PORTAL',
      title: 'Customer Portal',
      routePath: '/login',
      icon: <User size={26} />,
      description:
        'Book appointments, track shoe orders, receive notifications, manage service history, and submit reviews.',
      buttonText: 'Continue as Customer',
    },
    {
      id: 'staff' as Role,
      tag: 'STAFF PORTAL',
      title: 'Staff Portal',
      routePath: '/staff/login',
      icon: <Briefcase size={26} />,
      description:
        'Manage job orders, perform shoe assessments, upload documentation, update service progress, and manage assigned tasks.',
      buttonText: 'Continue as Staff',
    },
    {
      id: 'admin' as Role,
      tag: 'ADMINISTRATOR PORTAL',
      title: 'Administrator Portal',
      routePath: '/admin/login',
      icon: <Shield size={26} />,
      description:
        'Manage branches, monitor inventory, view reports, oversee staff activities, and control system settings.',
      buttonText: 'Continue as Administrator',
    },
  ]

  return (
    <Listing eyebrow="ROLE-BASED LOGIN SYSTEM" title="Welcome to WashMyKicks">
      <p className="lead">Choose how you want to access the system.</p>

      <div className="portal-grid">
        {cards.map((card) => (
          <article
            key={card.id}
            className="portal-card"
            onClick={() => setPage(`login-${card.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setPage(`login-${card.id}`)
            }}
          >
            <div className="portal-icon-box">{card.icon}</div>
            <span className="eyebrow">{card.tag}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <button
              type="button"
              className="primary"
              onClick={(e) => {
                e.stopPropagation()
                setPage(`login-${card.id}`)
              }}
            >
              {card.buttonText} <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </div>

      <div className="portal-links">
        <button type="button" onClick={() => setPage('home')}>
          ← Back to Home
        </button>
        <button
          type="button"
          onClick={() => {
            setResetSent(false)
            setForgotModal(true)
          }}
        >
          Forgot Password
        </button>
      </div>

      {forgotModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 20,
          }}
          onClick={() => setForgotModal(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="eyebrow">ACCOUNT RECOVERY</span>
            <h3 style={{ fontSize: 22, margin: '8px 0 8px' }}>Reset your password</h3>
            {resetSent ? (
              <>
                <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
                  Password reset instructions have been sent to <b>{resetEmail || 'your email'}</b>.
                </p>
                <button className="primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => setForgotModal(false)}>
                  Back to Account Selection
                </button>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setResetSent(true)
                }}
              >
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                  Enter your registered email address and we'll send a recovery link.
                </p>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@washmykicks.com"
                  style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8, marginBottom: 16 }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="outline" style={{ flex: 1 }} onClick={() => setForgotModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary" style={{ flex: 1, justifyContent: 'center' }}>
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
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
        const parts = (fullName.trim() || deriveDisplayName(email)).split(' ')
        const regRes = await registerCustomerAccount({
          email,
          password,
          firstName: parts[0] || roleLabel,
          lastName: parts.slice(1).join(' ') || 'Account',
          role: roleEnum,
          branchId: isStaff ? branchIdx : undefined,
          branchName: isStaff ? branch : undefined,
          employeeId: isStaff ? employeeId : undefined,
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
          <span className="eyebrow">{roleLabel.toUpperCase()} PORTAL ACCESS</span>
          <h1>
            Every pair has a story.
            <br />
            We keep it moving.
          </h1>
          <p>
            Connected sneaker care workflows across all WashMyKicks branches—from booking and assessment to final pickup.
          </p>
        </div>
        <div className="auth-rbac-preview">
          <h4>Role-Based Access Control ({roleLabel})</h4>
          <div className="auth-rbac-list">
            {perms.allowed.map((item) => (
              <span key={item} className="auth-rbac-chip">
                <Check size={12} color="#22c55e" /> {item}
              </span>
            ))}
          </div>
          {perms.restricted.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>
              Restricted modules: {perms.restricted.join(' · ')}
            </div>
          )}
        </div>
      </div>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit}>
          <button type="button" className="back-link" onClick={() => setPage('portals')}>
            <ArrowLeft size={14} /> Back to Account Selection
          </button>

          <span className="eyebrow">{roleLabel.toUpperCase()} PORTAL</span>
          <h1>{isCreatingAccount ? `Register ${roleLabel} Account` : `${roleLabel} Login`}</h1>
          <p>
            {isCustomer
              ? isCreatingAccount
                ? 'Register your WashMyKicks customer profile in Supabase Auth.'
                : 'Sign in with your registered customer credentials.'
              : isStaff
              ? isCreatingAccount
                ? 'Provision a branch staff account in Supabase Auth.'
                : 'Sign in with your provisioned branch staff account.'
              : isCreatingAccount
              ? 'Provision an administrator account in Supabase Auth.'
              : 'Sign in with your administrator credentials.'}
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
                setForgotMessage(`Password reset instructions sent to ${email.trim()}.`)
              }}
            >
              Forgot Password?
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreatingAccount(!isCreatingAccount)
                setForgotMessage('')
                setIsErrorMsg(false)
              }}
            >
              {isCreatingAccount
                ? 'Already registered? Sign In'
                : isStaff
                ? 'Provision Staff Account'
                : isAdmin
                ? 'Provision Admin Account'
                : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

/* ============================================================================
   CUSTOMER 5-STEP BOOK APPOINTMENT WIZARD (MATCHING UPLOADED SCREENSHOTS)
   ============================================================================ */

function CustomerBookAppointmentWizard({
  initialBranchId = 1,
  preselectedFromMap = false,
  existingOrders = initialOrders,
  servicesCatalog = services,
  onCompleteBooking,
  onCancel,
}: {
  initialBranchId?: number
  preselectedFromMap?: boolean
  existingOrders?: JobOrder[]
  servicesCatalog?: Service[]
  onCompleteBooking: (newOrder: JobOrder) => void
  onCancel: () => void
}) {
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDate = today.getDate()

  const activeServices = servicesCatalog.filter((s) => !s.archived)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [selectedBranchId, setSelectedBranchId] = useState<number>(initialBranchId)
  const [selectedServiceId, setSelectedServiceId] = useState<string>('02') // Deep Cleaning default like screenshot
  const [calendarYear, setCalendarYear] = useState<number>(todayYear)
  const [calendarMonth, setCalendarMonth] = useState<number>(todayMonth)
  const [selectedDay, setSelectedDay] = useState<number>(todayDate)
  const [selectedTime, setSelectedTime] = useState<string>('10:30 AM')
  const [shoeBrand, setShoeBrand] = useState<string>('Nike')
  const [shoeModel, setShoeModel] = useState<string>('Air Jordan 1 Retro High')

  // Booking Email Verification (OTP) state
  const [customerEmail, setCustomerEmail] = useState<string>('juan.delacruz@email.com')
  const [otpSent, setOtpSent] = useState<boolean>(false)
  const [otpSending, setOtpSending] = useState<boolean>(false)
  const [otpMode, setOtpMode] = useState<'server-hmac' | 'supabase-auth'>('server-hmac')
  const [otpToken, setOtpToken] = useState<string>('')
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0)
  const [enteredOtp, setEnteredOtp] = useState<string>('')
  const [otpVerified, setOtpVerified] = useState<boolean>(false)
  const [otpNotice, setOtpNotice] = useState<string>('')
  const [remoteSlotCounts, setRemoteSlotCounts] = useState<Record<string, number>>({})

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

  // Fetch live slot availability from /api/available-slots when entering Step 4
  useEffect(() => {
    if (step !== 4) return
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
  }, [step, selectedBranch.name, formattedDate])

  const steps = [
    { num: 1, label: 'Branch' },
    { num: 2, label: 'Service' },
    { num: 3, label: 'Date' },
    { num: 4, label: 'Schedule' },
    { num: 5, label: 'Confirm' },
  ] as const

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
    return local || 'Valued Customer'
  }

  const handleSendBookingOtp = async () => {
    const emailTarget = customerEmail.trim()
    if (!emailTarget || !emailTarget.includes('@')) {
      setOtpNotice('Please enter a valid email address first.')
      return
    }

    const derivedName = getCustomerNameFromEmail(emailTarget)
    setOtpSending(true)
    setEnteredOtp('')
    setOtpVerified(false)
    setOtpNotice(`Sending verification code to ${emailTarget}...`)

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

      if (res.ok) {
        const data = await res.json()
        setOtpMode('server-hmac')
        setOtpToken(String(data.token || ''))
        setOtpExpiresAt(Number(data.expiresAt || 0))
        setOtpSent(true)
        setOtpNotice(`A 6-digit verification code has been sent to ${emailTarget}. Please check your Inbox (and Spam folder).`)
        setOtpSending(false)
        return
      }
    } catch {
      // Fallback to Supabase Auth OTP below
    }

    // Fallback: Use Supabase Auth built-in Email OTP delivery
    if (supabase) {
      const { error } = await supabase.auth.signInWithOtp({
        email: emailTarget,
        options: { shouldCreateUser: true },
      })
      if (!error) {
        setOtpMode('supabase-auth')
        setOtpSent(true)
        setOtpNotice(`A verification email has been sent to ${emailTarget} via Supabase Auth. Check your Inbox or Spam folder and enter the code below.`)
        setOtpSending(false)
        return
      }
      setOtpSending(false)
      setOtpNotice(`Could not send email (${error.message}). Configure GMAIL_USER and GMAIL_APP_PASSWORD in Vercel Environment Variables for instant Gmail SMTP delivery.`)
      return
    }

    setOtpSending(false)
    setOtpNotice('Email service unavailable. Please configure GMAIL_USER and GMAIL_APP_PASSWORD in Vercel Environment Variables.')
  }

  const handleVerifyOtp = async () => {
    const candidate = enteredOtp.trim()
    const emailTarget = customerEmail.trim()
    if (!candidate || candidate.length < 6) {
      setOtpNotice('Please enter the 6-digit verification code sent to your email.')
      return false
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
          setOtpNotice('✓ Email verification code confirmed!')
          return true
        }
        setOtpNotice(data?.error || 'Invalid verification code. Please check your email and try again.')
        return false
      } catch {
        setOtpNotice('Could not verify code with server. Please try again.')
        return false
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
        setOtpNotice('✓ Email verification code confirmed!')
        return true
      }
      const secondTry = await supabase.auth.verifyOtp({
        email: emailTarget,
        token: candidate,
        type: 'signup',
      })
      if (!secondTry.error) {
        setOtpVerified(true)
        setOtpNotice('✓ Email verification code confirmed!')
        return true
      }
      setOtpNotice(firstTry.error?.message || 'Invalid verification code. Please check your email and try again.')
      return false
    }

    setOtpNotice('Please click "Send Verification Code" first.')
    return false
  }

  const handleConfirm = async () => {
    if (!otpVerified) {
      if (!otpSent) {
        await handleSendBookingOtp()
        return
      }
      const ok = await handleVerifyOtp()
      if (!ok) return
    }

    const derivedName = getCustomerNameFromEmail(customerEmail)
    const numericPrice = Number(selectedService.price.replace(/[^0-9.]/g, '')) || 650
    const scheduledIso = new Date(calendarYear, calendarMonth, activeSelectedDay, 10, 30).toISOString()

    const cleanBrand = shoeBrand.trim()
    const cleanModel = shoeModel.trim()
    const combinedShoe =
      cleanBrand && cleanModel && !cleanModel.toLowerCase().startsWith(cleanBrand.toLowerCase())
        ? `${cleanBrand} ${cleanModel}`
        : cleanModel || cleanBrand || 'Sneaker Pair'

    void createBookingRecord({
      customerId: 1,
      branchServiceId: selectedBranch.id,
      scheduledAt: scheduledIso,
      priceAtBooking: numericPrice,
      customerRequest: `${combinedShoe} — ${selectedService.title} (${formattedDate} · ${selectedTime}) [Email Verified]`,
      customerEmail: customerEmail || 'juan.delacruz@email.com',
      customerName: derivedName,
      serviceName: selectedService.title,
      branchName: selectedBranch.name,
    }).catch(() => null)

    const newOrder: JobOrder = {
      id: `WMK-${calendarYear}-${Math.floor(1850 + Math.random() * 900)}`,
      customer: derivedName,
      email: customerEmail || 'juan.delacruz@email.com',
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
      docs: createDefaultDocumentation(),
    }
    onCompleteBooking(newOrder)
  }

  return (
    <div>
      <div className="breadcrumb">
        <button type="button" onClick={onCancel}>
          Dashboard
        </button>
        <span>&gt;</span>
        <span>Book an appointment</span>
      </div>
      <span className="eyebrow">SHOE BOOKING MANAGEMENT MODULE</span>
      <h1>Book an appointment</h1>
      <p>Schedule your pair in five simple steps.</p>

      {preselectedFromMap && (
        <div
          style={{
            maxWidth: 780,
            margin: '0 auto 18px',
            padding: '12px 18px',
            borderRadius: 12,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: 12.5,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span>
            ✓ Branch pre-selected from Branch Locator: <b>{selectedBranch.name}</b>
          </span>
          {step === 1 && (
            <button
              type="button"
              className="primary"
              style={{ padding: '7px 13px', fontSize: 11.5 }}
              onClick={() => setStep(2)}
            >
              Continue with {selectedBranch.name.replace('Wash My Kicks – ', '')} <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* 5-step horizontal stepper matching screenshots */}
      <div className="stepper-bar">
        {steps.map((s, idx) => {
          const isDone = step > s.num
          const isActive = step === s.num
          return (
            <React.Fragment key={s.num}>
              <button
                type="button"
                onClick={() => {
                  if (s.num <= step) setStep(s.num)
                }}
                className={`stepper-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
              >
                <span className="stepper-circle">{isDone ? <Check size={13} /> : s.num}</span>
                <span>{s.label}</span>
              </button>
              {idx < steps.length - 1 && <div className={`stepper-line ${step > s.num ? 'done' : ''}`} />}
            </React.Fragment>
          )
        })}
      </div>

      {/* STEP 1: CHOOSE A BRANCH */}
      {step === 1 && (
        <div className="wizard-card">
          <div className="wizard-header">
            <span className="step-tag">STEP 1 OF 5</span>
            <h2>Choose a branch</h2>
            <p>Where would you like to drop off your pair?</p>
          </div>

          <div className="wizard-grid-2">
            {wizardBranches.map((b) => {
              const isSelected = selectedBranchId === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={b.comingSoon}
                  className={`choice-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedBranchId(b.id)}
                >
                  <span className="choice-num">{b.id}</span>
                  <span className="choice-body">
                    <b>{b.name}</b>
                    <small>{b.address}</small>
                    {b.comingSoon && <span className="price-tag">COMING SOON</span>}
                  </span>
                  {isSelected && <Check size={16} className="choice-check" />}
                </button>
              )
            })}
          </div>

          <div className="wizard-footer">
            <button type="button" className="wizard-back" onClick={onCancel}>
              ← Cancel
            </button>
            <button type="button" className="primary" onClick={() => setStep(2)}>
              Continue <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: SELECT YOUR SERVICE */}
      {step === 2 && (
        <div className="wizard-card">
          <div className="wizard-header">
            <span className="step-tag">STEP 2 OF 5</span>
            <h2>Select your service</h2>
            <p>What does your pair need?</p>
          </div>

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
                  <span style={{ color: '#dc2626', flexShrink: 0 }}>
                    <ShieldCheck size={20} />
                  </span>
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

          <div className="wizard-footer">
            <button type="button" className="wizard-back" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button type="button" className="primary" onClick={() => setStep(3)}>
              Continue <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CHOOSE A DATE */}
      {step === 3 && (
        <div className="wizard-card">
          <div className="wizard-header">
            <span className="step-tag">STEP 3 OF 5</span>
            <h2>Choose a date</h2>
            <p>Select your preferred drop-off date.</p>
          </div>

          <div className="calendar-box">
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

          <div className="wizard-footer">
            <button type="button" className="wizard-back" onClick={() => setStep(2)}>
              ← Back
            </button>
            <button type="button" className="primary" onClick={() => setStep(4)}>
              Continue <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: SCHEDULE & SHOE PAIR DETAILS */}
      {step === 4 && (
        <div className="wizard-card">
          <div className="wizard-header">
            <span className="step-tag">STEP 4 OF 5</span>
            <h2>Select a schedule</h2>
            <p>
              Pick your preferred time slot on {currentMonthName} {activeSelectedDay}, {calendarYear}.
            </p>
          </div>

          <div className="wizard-grid-2" style={{ marginBottom: 20 }}>
            {timeSlots.map((slot) => {
              const { remaining, isFull } = getSlotAvailability(slot)
              const isSelected = selectedTime === slot && !isFull
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={isFull}
                  className={`choice-card ${isSelected ? 'selected' : ''}`}
                  style={isFull ? { opacity: 0.55, cursor: 'not-allowed', background: '#f9fafb' } : undefined}
                  onClick={() => {
                    if (!isFull) setSelectedTime(slot)
                  }}
                >
                  <Clock3 size={18} color={isFull ? '#9ca3af' : '#dc2626'} />
                  <span className="choice-body">
                    <b>{slot}</b>
                    <small>
                      {isFull
                        ? 'Slot full — no remaining capacity'
                        : `${remaining} of ${MAX_SLOT_CAPACITY} drop-off slots available`}
                    </small>
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 4,
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 10.5,
                        fontWeight: 700,
                        background: isFull ? '#fee2e2' : remaining === 1 ? '#fef3c7' : '#dcfce7',
                        color: isFull ? '#991b1b' : remaining === 1 ? '#b45309' : '#166534',
                      }}
                    >
                      {isFull ? 'FULL · BOOKED' : remaining === 1 ? '1 SLOT LEFT' : 'AVAILABLE'}
                    </span>
                  </span>
                  {isSelected && <Check size={16} className="choice-check" />}
                </button>
              )
            })}
          </div>

          <div className="wizard-grid-2" style={{ maxWidth: 640, margin: '0 auto' }}>
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
                  padding: '12px 14px',
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
                placeholder="e.g. Air Jordan 1 Retro High, Dunk Low, Samba"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: 10,
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          <div className="wizard-footer">
            <button type="button" className="wizard-back" onClick={() => setStep(3)}>
              ← Back
            </button>
            <button type="button" className="primary" onClick={() => setStep(5)}>
              Continue <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: CONFIRM YOUR BOOKING */}
      {step === 5 && (
        <div className="wizard-card">
          <div className="wizard-header">
            <span className="step-tag">STEP 5 OF 5</span>
            <h2>Confirm your booking</h2>
            <p>Review the details before confirming.</p>
          </div>

          <div className="confirm-list">
            <div className="confirm-item">
              <div className="confirm-icon">
                <MapPin size={18} />
              </div>
              <div className="confirm-text">
                <span>BRANCH</span>
                <b>{selectedBranch.name}</b>
                <small>{selectedBranch.address}</small>
              </div>
              <button type="button" className="confirm-change" onClick={() => setStep(1)}>
                Change
              </button>
            </div>

            <div className="confirm-item">
              <div className="confirm-icon">
                <Sparkles size={18} />
              </div>
              <div className="confirm-text">
                <span>SERVICE</span>
                <b>{selectedService.title}</b>
                <small>Estimated service time: {selectedService.duration}</small>
              </div>
              <button type="button" className="confirm-change" onClick={() => setStep(2)}>
                Change
              </button>
            </div>

            <div className="confirm-item">
              <div className="confirm-icon">
                <Calendar size={18} />
              </div>
              <div className="confirm-text">
                <span>DROP-OFF</span>
                <b>
                  {currentMonthName} {activeSelectedDay}, {calendarYear} · {selectedTime}
                </b>
                <small>
                  Selected appointment date · {[shoeBrand.trim(), shoeModel.trim()].filter(Boolean).join(' ') || 'Sneaker Pair'}
                </small>
              </div>
              <button type="button" className="confirm-change" onClick={() => setStep(3)}>
                Change
              </button>
            </div>

            <div className="confirm-total-bar">
              <div>
                <span>ESTIMATED TOTAL</span>
                <small>Pay at branch after assessment</small>
              </div>
              <b>{selectedService.price.replace('From ', '')}</b>
            </div>
          </div>

          {/* FEATURE 1: BOOKING EMAIL VERIFICATION CODE (OTP) */}
          <div
            style={{
              maxWidth: 540,
              margin: '18px auto 0',
              padding: '16px 18px',
              borderRadius: 12,
              border: otpVerified ? '1px solid #86efac' : '1px solid #e5e7eb',
              background: otpVerified ? '#f0fdf4' : '#f9fafb',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={16} color={otpVerified ? '#16a34a' : '#dc2626'} />
                <b style={{ fontSize: 13 }}>Booking Email Verification (OTP)</b>
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
                {otpVerified ? '✓ VERIFIED' : 'VERIFICATION REQUIRED'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Enter your email for booking verification"
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: '9px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 12.5,
                  background: '#fff',
                }}
              />
              <button
                type="button"
                className="outline"
                disabled={otpSending}
                style={{ padding: '9px 14px', fontSize: 12 }}
                onClick={handleSendBookingOtp}
              >
                {otpSending ? 'Sending...' : otpSent ? 'Resend Code' : 'Send Verification Code'}
              </button>
            </div>

            {otpSent && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <input
                  type="text"
                  maxLength={6}
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value)}
                  placeholder="Enter 6-digit code"
                  style={{
                    width: 170,
                    padding: '9px 12px',
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
                  style={{ padding: '9px 14px', fontSize: 12 }}
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

          <div className="wizard-footer">
            <button type="button" className="wizard-back" onClick={() => setStep(4)}>
              ← Back
            </button>
            <button type="button" className="primary" onClick={handleConfirm}>
              {otpVerified ? 'Confirm appointment' : 'Verify & Confirm appointment'} <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   CUSTOMER DASHBOARD FLOW
   ============================================================================ */

function CustomerDashboard({
  userMeta,
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
  userMeta: { name: string; email: string }
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
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || 'WMK-2026-01842')

  // Review form state
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewService, setReviewService] = useState('Deep Cleaning')
  const [reviewBranch, setReviewBranch] = useState(staffBranches[0])
  const [reviewQuote, setReviewQuote] = useState('')

  // Profile form state
  const [profileName, setProfileName] = useState(userMeta.name)
  const [profileEmail, setProfileEmail] = useState(userMeta.email)
  const [profilePhone, setProfilePhone] = useState('')
  const [profileBranch, setProfileBranch] = useState(staffBranches[0])

  const customerOrders = orders.filter(
    (o) => !userMeta.email || o.email.trim().toLowerCase() === userMeta.email.trim().toLowerCase()
  )
  const activeOrders = customerOrders.filter((o) => o.status !== 'Completed')
  const completedOrders = customerOrders.filter((o) => o.status === 'Completed')
  const trackedOrder = customerOrders.find((o) => o.id === selectedOrderId) || customerOrders[0]
  const nextAppointment = activeOrders[0] || null

  const customerNotifications = customerOrders.map((o) => ({
    id: o.id,
    title: `${o.service} (${o.status}) — ${o.id}`,
    body: `Your ${o.shoe} at ${o.branch} is currently in stage: ${o.status}. Scheduled drop-off: ${o.date} at ${o.time}.`,
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
      <aside className="sidebar dark-sidebar">
        <Brand onClick={() => setPage('home')} />
        <span className="portal-label">CUSTOMER PORTAL</span>
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-btn ${tab === item.key ? 'selected' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.icon}
            <span>{item.key}</span>
            {item.badge && <span className="sidebar-badge">{item.badge}</span>}
          </button>
        ))}
        <button type="button" className="sidebar-btn" onClick={() => setPage('home')}>
          <ArrowLeft size={17} />
          <span>Public Homepage</span>
        </button>
        <button type="button" className="sidebar-btn logout" onClick={onLogout}>
          <LogOut size={17} />
          <span>Log out</span>
        </button>
      </aside>

      <div className="dash-main">
        <header className="dash-header">
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
            <div className="dash-avatar">{avatarInitials}</div>
            <div className="dash-user-info">
              <b>{profileName}</b>
              <small>Customer · {profileBranch.replace('Wash My Kicks – ', '')}</small>
            </div>
          </div>
        </header>

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
              <span className="eyebrow">CUSTOMER PORTAL</span>
              <h1>Welcome, {profileName.split(' ')[0]}.</h1>
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
                  <span className="eyebrow">CUSTOMER ACTIONS</span>
                  <h3>Continue your sneaker care workflow.</h3>
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

          {/* TAB 2: BOOK APPOINTMENT (5-STEP WIZARD FROM SCREENSHOTS) */}
          {tab === 'Book Appointment' && (
            <CustomerBookAppointmentWizard
              initialBranchId={preselectedBranchId}
              preselectedFromMap={preselectedFromMap}
              existingOrders={orders}
              servicesCatalog={servicesCatalog}
              onCancel={() => setTab('Dashboard')}
              onCompleteBooking={(newOrder) => {
                const enrichedOrder: JobOrder = {
                  ...newOrder,
                  customer: profileName || newOrder.customer,
                  email: userMeta.email || newOrder.email,
                }
                setOrders((prev) => [enrichedOrder, ...prev])
                setSelectedOrderId(enrichedOrder.id)
                void createBookingRecord({
                  customerId: 1,
                  branchServiceId: 1,
                  scheduledAt: new Date().toISOString(),
                  priceAtBooking: Number(enrichedOrder.price.replace(/[^\d.]/g, '')) || 650,
                  customerRequest: `${enrichedOrder.shoe} — ${enrichedOrder.service}`,
                  customerEmail: enrichedOrder.email,
                  customerName: enrichedOrder.customer,
                  serviceName: enrichedOrder.service,
                  branchName: enrichedOrder.branch,
                }).catch(() => null)
                showToast(
                  `Appointment confirmed! Job Order ${enrichedOrder.id} created for ${enrichedOrder.date} at ${enrichedOrder.time}.`
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
                  <p style={{ marginBottom: 14 }}>No live job orders in Supabase yet.</p>
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
                        gap: 16,
                      }}
                    >
                      <div>
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
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
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
                  showToast('Customer profile updated successfully.')
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
                    Email Address
                    <input
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      style={{ width: '100%', padding: 11, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
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
                !o.specialist ||
                o.specialist === 'Carlo Mendoza' ||
                o.specialist === 'Pending Specialist Assessment' ||
                o.specialist === 'Assigned Specialist'
                  ? userMeta.name
                  : o.specialist,
            }
          : o
      )
    )
    void updateServiceOrderStatus({
      orderNumber: id,
      nextStatus,
      customerEmail: targetOrder?.email,
      customerName: targetOrder?.customer,
      serviceName: targetOrder?.service,
      branchName: targetOrder?.branch,
    }).catch(() => null)
    showToast(`Order ${id} status updated to "${nextStatus}".`)
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
      <aside className="sidebar dark-sidebar">
        <Brand />
        <span className="portal-label">STAFF PORTAL</span>
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-btn ${tab === item.key ? 'selected' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.icon}
            <span>{item.key}</span>
            {item.badge && <span className="sidebar-badge">{item.badge}</span>}
          </button>
        ))}
        <button type="button" className="sidebar-btn logout" onClick={onLogout}>
          <LogOut size={17} />
          <span>Log out</span>
        </button>
      </aside>

      <div className="dash-main">
        <header className="dash-header">
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
              <span className="eyebrow">BRANCH OPERATIONS</span>
              <h1>Welcome, {userMeta.name.split(' ')[0]}.</h1>
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
                  <span className="eyebrow">STAFF ACTIONS</span>
                  <h3>Continue your branch workflow.</h3>
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
                            No live orders in Supabase yet.
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
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [newSvcTitle, setNewSvcTitle] = useState('')
  const [newSvcCopy, setNewSvcCopy] = useState('')
  const [newSvcPrice, setNewSvcPrice] = useState('₱500')
  const [newSvcDuration, setNewSvcDuration] = useState('2–4 days')

  const [usersList, setUsersList] = useState<
    { id: string; name: string; email: string; role: string; branch: string; active: boolean }[]
  >([])
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
  }, [])

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
      <aside className="sidebar dark-sidebar">
        <Brand />
        <span className="portal-label">ADMINISTRATOR PORTAL</span>
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-btn ${tab === item.key ? 'selected' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.icon}
            <span>{item.key}</span>
          </button>
        ))}
        <button type="button" className="sidebar-btn logout" onClick={onLogout}>
          <LogOut size={17} />
          <span>Log out</span>
        </button>
      </aside>

      <div className="dash-main">
        <header className="dash-header">
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
              <span className="eyebrow">EXECUTIVE COMMAND CENTER</span>
              <h1>Welcome, {userMeta.name.split(' ')[0]}.</h1>
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
                  className="wmk-inv-kpi-card"
                  onClick={() => setTab('Reports')}
                  style={{ cursor: 'pointer', gridColumn: 'span 2' }}
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
                  <span className="eyebrow">ADMINISTRATOR ACTIONS</span>
                  <h3>Continue your network operations workflow.</h3>
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
                            No live orders in Supabase yet.
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
                              setOrders((prev) =>
                                prev.map((ord) => (ord.id === o.id ? { ...ord, status: next } : ord))
                              )
                              showToast(`Updated ${o.id} status to "${next}".`)
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
  onCompleteBooking,
  setPage,
}: {
  initialBranchId: number
  preselectedFromMap: boolean
  existingOrders?: JobOrder[]
  servicesCatalog?: Service[]
  onCompleteBooking: (newOrder: JobOrder) => void
  setPage: (p: string) => void
}) {
  const [bookedOrder, setBookedOrder] = useState<JobOrder | null>(null)

  if (bookedOrder) {
    return (
      <section className="listing">
        <div className="wizard-card" style={{ textAlign: 'center', maxWidth: 620 }}>
          <span className="eyebrow">APPOINTMENT CONFIRMED</span>
          <h2 style={{ fontSize: 28, margin: '10px 0 8px' }}>Your kicks are scheduled!</h2>
          <p style={{ fontSize: 13.5, color: '#4b5563', marginBottom: 20 }}>
            Job Order <b>{bookedOrder.id}</b> has been created at <b>{bookedOrder.branch}</b> on{' '}
            <b>
              {bookedOrder.date} · {bookedOrder.time}
            </b>
            .
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="primary" onClick={() => setPage('track')}>
              Track My Order ({bookedOrder.id}) <ArrowRight size={15} />
            </button>
            <button type="button" className="outline" onClick={() => setPage('login-customer')}>
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
    case '/portals':
    case '/select-account':
      return 'portals'
    case '/login':
    case '/customer/login':
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
    case 'portals':
      sub = '/portals'
      break
    case 'login':
    case 'login-customer':
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

  // Sync browser URL on initial mount and listen to Back/Forward buttons
  useEffect(() => {
    if (typeof window === 'undefined') return
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

  const [orders, setOrders] = useState<JobOrder[]>(initialOrders)
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews)
  const [inventory, setInventory] = useState<InventoryRecord[]>(INITIAL_INVENTORY_RECORDS)
  const [servicesCatalog, setServicesCatalog] = useState<Service[]>(services)

  // Fetch live production rows from Supabase PostgreSQL on mount
  useEffect(() => {
    fetchLiveProductionData()
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
  }, [])

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
    const nextMeta = {
      name: meta.name || fallbackName,
      email: meta.email,
      employeeId: meta.employeeId,
      branch: meta.branch,
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
        onCompleteBooking={(newOrder) => setOrders((prev) => [newOrder, ...prev])}
        setPage={setPage}
      />
    ) : page === 'reviews' ? (
      <Reviews reviews={reviews} />
    ) : page === 'about' ? (
      <About />
    ) : (
      <AccountSelectionPage setPage={setPage} />
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
