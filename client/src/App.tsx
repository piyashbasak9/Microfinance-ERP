import { type FormEvent, type ReactNode, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import './App.css';

type MenuItem = {
  label: string;
  path: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
};

type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  branchId: number | null;
};

type LoginResult = {
  user: AuthenticatedUser;
  permissions: string[];
  token: string;
  expiresAt: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

const menuItems: MenuItem[] = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Members', path: '/members' },
  { label: 'Savings', path: '/savings' },
  { label: 'Loans', path: '/loans' },
  { label: 'Collections', path: '/collections' },
  { label: 'Accounting', path: '/accounting' },
  { label: 'Reports', path: '/reports' },
  { label: 'Audit', path: '/audit' },
  { label: 'Settings', path: '/settings' },
];

const dashboardStats = [
  { label: 'Active Members', value: '1,284', trend: '+8.4%' },
  { label: 'Savings Balance', value: '৳48.9L', trend: '+5.2%' },
  { label: 'Outstanding Loans', value: '৳31.8L', trend: '+1.9%' },
  { label: 'PAR 30', value: '7.4%', trend: '-0.6%' },
];

const memberRows = [
  { name: 'Rahima Khatun', code: 'BR01-000124', status: 'Active', center: 'North Center' },
  { name: 'Abul Hasan', code: 'BR01-000125', status: 'Active', center: 'North Center' },
  { name: 'Shakila Begum', code: 'BR01-000126', status: 'Pending KYC', center: 'East Center' },
];

const loanRows = [
  { member: 'Rahima Khatun', product: 'Micro Enterprise', outstanding: '৳3,25,000', status: 'Active' },
  { member: 'Abul Hasan', product: 'Women Startup', outstanding: '৳1,85,500', status: 'Active' },
  { member: 'Shakila Begum', product: 'Fast Loan', outstanding: '৳42,000', status: 'Approved' },
];

const collectionRows = [
  { center: 'North Center', officer: 'Mizan', collected: '৳89,000', status: 'Reconciled' },
  { center: 'East Center', officer: 'Farhana', collected: '৳1,02,500', status: 'Posted' },
  { center: 'South Center', officer: 'Nabil', collected: '৳64,000', status: 'Submitted' },
];

function App() {
  const [session, setSession] = useState<{ token: string; user: AuthenticatedUser } | null>(null);
  const handleLogout = () => setSession(null);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={setSession} />} />
        <Route path="/dashboard" element={session ? <AppLayout user={session.user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
        <Route path="/members" element={session ? <AppLayout user={session.user} onLogout={handleLogout}><MembersPage /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/savings" element={session ? <AppLayout user={session.user} onLogout={handleLogout}><SavingsPage /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/loans" element={session ? <AppLayout user={session.user} onLogout={handleLogout}><LoansPage /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/collections" element={session ? <AppLayout user={session.user} onLogout={handleLogout}><CollectionsPage /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/accounting" element={session ? <AppLayout user={session.user} onLogout={handleLogout}><AccountingPage /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/reports" element={session ? <AppLayout user={session.user} onLogout={handleLogout}><ReportsPage /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/audit" element={session ? <AppLayout user={session.user} onLogout={handleLogout}><AuditPage /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/settings" element={session ? <AppLayout user={session.user} onLogout={handleLogout}><SettingsPage /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function AppLayout({ children, user, onLogout }: { children?: ReactNode; user: AuthenticatedUser; onLogout: () => void }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-box">
          <div className="brand-mark">M</div>
          <div>
            <strong>Microfinance ERP</strong>
            <span>Head Office</span>
          </div>
        </div>

        <nav className="menu">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content-shell">
        <header className="topbar">
          <div>
            <h1>Operations dashboard</h1>
          </div>
          <div className="user-panel">
            <span>{user.name}</span>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </header>

        {children ?? <DashboardPage />}
      </main>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (session: { token: string; user: AuthenticatedUser }) => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const envelope = (await response.json()) as ApiEnvelope<LoginResult>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || 'Sign in failed.');
      }

      onLogin({ token: envelope.data.token, user: envelope.data.user });
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand-header">
          <div className="brand-mark large">M</div>
          <div>
            <h2>Microfinance ERP</h2>
            <p>Secure branch operations</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Email
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}

function DashboardPage() {
  return (
    <div className="page-stack">
      <section className="stats-grid">
        {dashboardStats.map((item) => (
          <article key={item.label} className="stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <em>{item.trend}</em>
          </article>
        ))}
      </section>

      <section className="two-col-layout">
        <div className="panel">
          <div className="panel-header">
            <h3>Members</h3>
            <button type="button">View all</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Center</th>
              </tr>
            </thead>
            <tbody>
              {memberRows.map((row) => (
                <tr key={row.code}>
                  <td>{row.name}</td>
                  <td><span className="status-tag active">{row.status}</span></td>
                  <td>{row.center}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Collections</h3>
            <button type="button">Open sheets</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Center</th>
                <th>Officer</th>
                <th>Collected</th>
              </tr>
            </thead>
            <tbody>
              {collectionRows.map((row) => (
                <tr key={row.center}>
                  <td>{row.center}</td>
                  <td>{row.officer}</td>
                  <td>{row.collected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Loan portfolio</h3>
          <button type="button">Export</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Product</th>
              <th>Outstanding</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loanRows.map((row) => (
              <tr key={row.member}>
                <td>{row.member}</td>
                <td>{row.product}</td>
                <td>{row.outstanding}</td>
                <td><span className="status-tag active">{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function MembersPage() {
  return <PageShell title="Members" text="Create, verify, and track member onboarding and KYC." />;
}

function SavingsPage() {
  return <PageShell title="Savings" text="Manage group and individual savings accounts, deposits, withdrawals, and interest posting." />;
}

function LoansPage() {
  return <PageShell title="Loans" text="Review loan applications, approval pipeline, disbursement, schedules, and repayments." />;
}

function CollectionsPage() {
  return <PageShell title="Collections" text="Process collection sheets, reconcile cash, and post payments to the ledger." />;
}

function AccountingPage() {
  return <PageShell title="Accounting" text="Chart of accounts, fiscal periods, trial balance, and reconciliation workflows." />;
}

function ReportsPage() {
  return <PageShell title="Reports" text="Generate portfolio, financial, and collection reports in Excel and PDF." />;
}

function AuditPage() {
  return <PageShell title="Audit" text="Review user activity logs, approval history, and compliance outputs." />;
}

function SettingsPage() {
  return <PageShell title="Settings" text="Adjust system preferences, role access, branch rules, and finance configuration." />;
}

function PageShell({ title, text }: { title: string; text: string }) {
  return (
    <div className="page-card panel">
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="placeholder-box">
        <strong>Module ready</strong>
        <span>This feature area is scaffolded to match the ERP architecture in the README.</span>
      </div>
    </div>
  );
}

export default App;
