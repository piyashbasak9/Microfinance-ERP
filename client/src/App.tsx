import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
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

type SessionState = {
  token: string;
  user: AuthenticatedUser;
};

type LoginResult = {
  user: AuthenticatedUser;
  permissions: string[];
  token: string;
  expiresAt: string;
};

type MemberRecord = {
  id: number;
  firstName?: string;
  lastName?: string;
  name: string;
  phoneNumber: string | null;
  nationalId?: string | null;
  status: string;
  branchId?: number;
  branch: string;
  branchCode: string;
  createdAt: string;
};

type BranchOption = {
  id: number;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
};

type DashboardMetric = {
  label: string;
  value: number;
  trend: string;
  tone: string;
};

type DashboardSummary = {
  activeMembers: number;
  savingsBalance: number;
  outstandingLoans: number;
  todayCollections: number;
  overdueAmount: number;
  portfolioAtRisk: number;
  metrics: DashboardMetric[];
};

type SavingsAccount = {
  id: number;
  accountNumber: string;
  member: string;
  memberId?: number;
  productName?: string;
  balance: number;
  minimumBalance?: number;
  currency?: string;
  status: string;
};

type SavingsTransaction = {
  id: number;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
};

type AuditEntry = {
  id: number;
  actor: string;
  action: string;
  module: string;
  time: string;
  outcome: string;
};

type SystemSettings = {
  applicationName: string;
  currency: string;
  timezone: string;
  defaultBranch: string;
  passwordPolicy: string;
  sessionTimeoutMinutes: number;
};

type TrialBalanceEntry = {
  account: string;
  debit: number;
  credit: number;
};

type LoanPortfolioItem = {
  id: number;
  member: string;
  product: string;
  principalAmount: number;
  interestRate: number;
  tenureMonths: number;
  outstanding: number;
  status: string;
  createdAt: string;
  disbursedAt: string | null;
};

type CollectionSheet = {
  id: number;
  center: string;
  dueDate: string;
  officer: string;
  collected: number;
  received: number;
  status: string;
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
  const [session, setSession] = useState<SessionState | null>(() => {
    try {
      const storedSession = window.localStorage.getItem('mfi-session');
      return storedSession ? (JSON.parse(storedSession) as SessionState) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (session) {
      window.localStorage.setItem('mfi-session', JSON.stringify(session));
      return;
    }

    window.localStorage.removeItem('mfi-session');
  }, [session]);

  const handleLogout = () => setSession(null);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={setSession} />} />
        <Route path="/dashboard" element={session ? <AppLayout user={session.user} token={session.token} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
        <Route path="/members" element={session ? <AppLayout user={session.user} token={session.token} onLogout={handleLogout}><MembersPage token={session.token} /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/savings" element={session ? <AppLayout user={session.user} token={session.token} onLogout={handleLogout}><SavingsPage token={session.token} /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/loans" element={session ? <AppLayout user={session.user} token={session.token} onLogout={handleLogout}><LoansPage token={session.token} /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/collections" element={session ? <AppLayout user={session.user} token={session.token} onLogout={handleLogout}><CollectionsPage token={session.token} /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/accounting" element={session ? <AppLayout user={session.user} token={session.token} onLogout={handleLogout}><AccountingPage token={session.token} /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/reports" element={session ? <AppLayout user={session.user} token={session.token} onLogout={handleLogout}><ReportsPage token={session.token} /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/audit" element={session ? <AppLayout user={session.user} token={session.token} onLogout={handleLogout}><AuditPage token={session.token} /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/settings" element={session ? <AppLayout user={session.user} token={session.token} onLogout={handleLogout}><SettingsPage token={session.token} /></AppLayout> : <Navigate to="/login" replace />} />
        <Route path="/" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function AppLayout({ children, user, token, onLogout }: { children?: ReactNode; user: AuthenticatedUser; token: string; onLogout: () => void }) {
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

        {children ?? <DashboardPage token={token} />}
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

function DashboardPage({ token }: { token: string }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const abortController = new AbortController();

    const loadSummary = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${apiBaseUrl}/dashboard/summary`, {
          signal: abortController.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const envelope = (await response.json()) as ApiEnvelope<DashboardSummary>;
        if (!response.ok || !envelope.success || !envelope.data) {
          throw new Error(envelope.message || 'Unable to load dashboard summary.');
        }

        setSummary(envelope.data);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : 'Unable to load dashboard summary.');
      } finally {
        setLoading(false);
      }
    };

    void loadSummary();
    return () => abortController.abort();
  }, [token]);

  const metrics = summary?.metrics ?? dashboardStats.map((item) => ({
    label: item.label,
    value: Number.parseFloat(item.value.replace(/[^\d.-]/g, '')),
    trend: item.trend,
    tone: 'positive',
  }));

  const formatMetricValue = (metric: DashboardMetric) => {
    if (metric.label.includes('PAR')) {
      return `${metric.value.toFixed(1)}%`;
    }

    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      maximumFractionDigits: 0,
    }).format(metric.value);
  };

  return (
    <div className="page-stack">
      {loading ? (
        <div className="empty-state">Loading dashboard…</div>
      ) : error ? (
        <div className="empty-state error-state">{error}</div>
      ) : (
        <>
          <section className="stats-grid">
            {metrics.map((item) => (
              <article key={item.label} className="stat-card">
                <span>{item.label}</span>
                <strong>{formatMetricValue(item)}</strong>
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
        </>
      )}
    </div>
  );
}

function MembersPage({ token }: { token: string }) {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formState, setFormState] = useState({
    firstName: '',
    lastName: '',
    branchId: '',
    phoneNumber: '',
    nationalId: '',
    status: 'Active',
  });

  const loadBranches = async () => {
    const response = await fetch(`${apiBaseUrl}/branches`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const envelope = (await response.json()) as ApiEnvelope<BranchOption[]>;
    if (!response.ok || !envelope.success || !envelope.data) {
      throw new Error(envelope.message || 'Unable to load branches.');
    }

    const branchOptions = envelope.data;
    setBranches(branchOptions);
    if (branchOptions.length > 0 && !formState.branchId) {
      setFormState((current) => ({ ...current, branchId: String(branchOptions[0].id) }));
    }
  };  useEffect(() => {
    const abortController = new AbortController();

    const loadMembers = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${apiBaseUrl}/members`, {
          signal: abortController.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const envelope = (await response.json()) as ApiEnvelope<MemberRecord[]>;
        if (!response.ok || !envelope.success || !envelope.data) {
          throw new Error(envelope.message || 'Unable to load members.');
        }

        setMembers(envelope.data);
        await loadBranches();
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : 'Unable to load members.');
      } finally {
        setLoading(false);
      }
    };

    void loadMembers();
    return () => abortController.abort();
  }, [token]);

  const resetForm = () => {
    setFormState({
      firstName: '',
      lastName: '',
      branchId: branches[0]?.id ? String(branches[0].id) : '',
      phoneNumber: '',
      nationalId: '',
      status: 'Active',
    });
    setFormError('');
    setFormSuccess('');
  };

  const handleCreateMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const payload = {
        firstName: formState.firstName.trim(),
        lastName: formState.lastName.trim(),
        branchId: Number(formState.branchId),
        phoneNumber: formState.phoneNumber.trim() || null,
        nationalId: formState.nationalId.trim() || null,
        status: formState.status || 'Active',
      };

      const response = await fetch(`${apiBaseUrl}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const envelope = (await response.json()) as ApiEnvelope<MemberRecord>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || 'Unable to create member.');
      }

      setMembers((current) => [envelope.data as MemberRecord, ...current]);
      setIsFormOpen(false);
      resetForm();
      setFormSuccess('Member added successfully.');
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Unable to create member.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Members</h2>
          <p>Create, verify, and track member onboarding and KYC.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError('');
            setFormSuccess('');
            setIsFormOpen((current) => !current);
            if (!isFormOpen) {
              resetForm();
            }
          }}
        >
          {isFormOpen ? 'Close' : 'Add member'}
        </button>
      </div>

      {isFormOpen && (
        <form className="member-form" onSubmit={handleCreateMember}>
          <div className="member-form-grid">
            <label>
              First name
              <input type="text" value={formState.firstName} onChange={(event) => setFormState((current) => ({ ...current, firstName: event.target.value }))} required />
            </label>
            <label>
              Last name
              <input type="text" value={formState.lastName} onChange={(event) => setFormState((current) => ({ ...current, lastName: event.target.value }))} required />
            </label>
            <label>
              Branch
              <select value={formState.branchId} onChange={(event) => setFormState((current) => ({ ...current, branchId: event.target.value }))} required>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}>
                <option value="Active">Active</option>
                <option value="Pending KYC">Pending KYC</option>
                <option value="Dormant">Dormant</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
            <label>
              Phone number
              <input type="tel" value={formState.phoneNumber} onChange={(event) => setFormState((current) => ({ ...current, phoneNumber: event.target.value }))} />
            </label>
            <label>
              National ID
              <input type="text" value={formState.nationalId} onChange={(event) => setFormState((current) => ({ ...current, nationalId: event.target.value }))} />
            </label>
          </div>

          {formError && <div className="empty-state error-state">{formError}</div>}
          {formSuccess && <div className="empty-state success-state">{formSuccess}</div>}

          <div className="form-actions">
            <button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save member'}</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="empty-state">Loading members…</div>
      ) : error ? (
        <div className="empty-state error-state">{error}</div>
      ) : members.length === 0 ? (
        <div className="empty-state">No members found.</div>
      ) : (
        <table className="member-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Branch</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="member-name-block">
                    <strong>{member.name}</strong>
                    <small>{member.branchCode}</small>
                  </div>
                </td>
                <td>{member.branch}</td>
                <td>{member.phoneNumber || '—'}</td>
                <td>
                  <span className={`status-tag ${member.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {member.status}
                  </span>
                </td>
                <td>{new Date(member.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SavingsPage({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [transactionFormOpen, setTransactionFormOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [transactionIdempotencyKey, setTransactionIdempotencyKey] = useState(() => window.crypto.randomUUID());
  const [accountForm, setAccountForm] = useState({ memberId: '', productName: 'General Savings', minimumBalance: '0' });
  const [transactionForm, setTransactionForm] = useState({ type: 'Deposit', amount: '' });

  useEffect(() => {
    const abortController = new AbortController();

    const loadAccounts = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${apiBaseUrl}/savings/accounts`, {
          signal: abortController.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const envelope = (await response.json()) as ApiEnvelope<SavingsAccount[]>;
        if (!response.ok || !envelope.success || !envelope.data) {
          throw new Error(envelope.message || 'Unable to load savings accounts.');
        }

        setAccounts(envelope.data);

        const memberResponse = await fetch(`${apiBaseUrl}/members`, {
          signal: abortController.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        const memberEnvelope = (await memberResponse.json()) as ApiEnvelope<MemberRecord[]>;
        if (!memberResponse.ok || !memberEnvelope.success || !memberEnvelope.data) {
          throw new Error(memberEnvelope.message || 'Unable to load members.');
        }
        const memberList = memberEnvelope.data;
        setMembers(memberList);
        if (memberList.length > 0) {
          setAccountForm((current) => ({ ...current, memberId: String(memberList[0].id) }));
        }
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : 'Unable to load savings accounts.');
      } finally {
        setLoading(false);
      }
    };

    void loadAccounts();
    return () => abortController.abort();
  }, [token]);

  const openTransactionForm = (accountId: number, type: string) => {
    setSelectedAccountId(String(accountId));
    setTransactionForm({ type, amount: '' });
    setTransactionIdempotencyKey(window.crypto.randomUUID());
    setFormError('');
    setFormSuccess('');
    setTransactions([]);
    setTransactionFormOpen(true);
  };

  const loadTransactionHistory = async (accountId: number) => {
    setFormError('');
    setFormSuccess('');
    try {
      const response = await fetch(`${apiBaseUrl}/savings/accounts/${accountId}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const envelope = (await response.json()) as ApiEnvelope<SavingsTransaction[]>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || 'Unable to load transaction history.');
      }
      setTransactions(envelope.data);
      setSelectedAccountId(String(accountId));
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Unable to load transaction history.');
    }
  };

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/savings/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          memberId: Number(accountForm.memberId),
          productName: accountForm.productName.trim(),
          minimumBalance: Number(accountForm.minimumBalance),
        }),
      });
      const envelope = (await response.json()) as ApiEnvelope<SavingsAccount>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || 'Unable to open savings account.');
      }
      const createdAccount = envelope.data;
      setAccounts((current) => [createdAccount, ...current]);
      setAccountFormOpen(false);
      setFormSuccess('Savings account opened successfully.');
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Unable to open savings account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/savings/accounts/${selectedAccountId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': transactionIdempotencyKey,
        },
        body: JSON.stringify({ type: transactionForm.type, amount: Number(transactionForm.amount) }),
      });
      const envelope = (await response.json()) as ApiEnvelope<SavingsTransaction>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || 'Unable to post savings transaction.');
      }
      const result = envelope.data;
      setAccounts((current) => current.map((account) => (
        account.id === Number(selectedAccountId) ? { ...account, balance: result.balanceAfter } : account
      )));
      setFormSuccess(`${result.type} posted. New balance: ${new Intl.NumberFormat('en-BD', {
        style: 'currency',
        currency: 'BDT',
        maximumFractionDigits: 2,
      }).format(result.balanceAfter)}`);
      setTransactionFormOpen(false);
      setTransactionIdempotencyKey(window.crypto.randomUUID());
      setTransactions((current) => [result, ...current]);
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Unable to post savings transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Savings</h2>
          <p>Manage account balances, deposits, withdrawals, and interest posting.</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={() => { setFormError(''); setFormSuccess(''); setAccountFormOpen((current) => !current); }}>
            {accountFormOpen ? 'Close' : 'Open account'}
          </button>
          <button type="button" onClick={() => accounts[0] && openTransactionForm(accounts[0].id, 'Deposit')} disabled={accounts.length === 0}>
            New deposit
          </button>
        </div>
      </div>

      {formError && <div className="empty-state error-state">{formError}</div>}
      {formSuccess && <div className="empty-state success-state">{formSuccess}</div>}

      {accountFormOpen && (
        <form className="savings-form" onSubmit={handleCreateAccount}>
          <div className="savings-form-grid">
            <label>
              Member
              <select value={accountForm.memberId} onChange={(event) => setAccountForm((current) => ({ ...current, memberId: event.target.value }))} required>
                {members.filter((member) => member.status === 'Active').map((member) => (
                  <option key={member.id} value={member.id}>{member.name} ({member.branchCode})</option>
                ))}
              </select>
            </label>
            <label>
              Product
              <input value={accountForm.productName} onChange={(event) => setAccountForm((current) => ({ ...current, productName: event.target.value }))} minLength={2} maxLength={120} required />
            </label>
            <label>
              Minimum balance (BDT)
              <input type="number" min="0" step="0.01" value={accountForm.minimumBalance} onChange={(event) => setAccountForm((current) => ({ ...current, minimumBalance: event.target.value }))} required />
            </label>
          </div>
          <div className="form-actions"><button type="submit" disabled={submitting || members.filter((member) => member.status === 'Active').length === 0}>{submitting ? 'Saving…' : 'Open savings account'}</button></div>
        </form>
      )}

      {transactionFormOpen && (
        <form className="savings-form" onSubmit={handleCreateTransaction}>
          <div className="savings-form-grid">
            <label>
              Account
              <select value={selectedAccountId} onChange={(event) => { setSelectedAccountId(event.target.value); setTransactionIdempotencyKey(window.crypto.randomUUID()); }}>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.accountNumber} — {account.member}</option>)}
              </select>
            </label>
            <label>
              Transaction type
              <select value={transactionForm.type} onChange={(event) => { setTransactionForm((current) => ({ ...current, type: event.target.value })); setTransactionIdempotencyKey(window.crypto.randomUUID()); }}>
                <option value="Deposit">Deposit</option>
                <option value="Withdrawal">Withdrawal</option>
              </select>
            </label>
            <label>
              Amount (BDT)
              <input type="number" min="0.01" step="0.01" value={transactionForm.amount} onChange={(event) => { setTransactionForm((current) => ({ ...current, amount: event.target.value })); setTransactionIdempotencyKey(window.crypto.randomUUID()); }} required />
            </label>
          </div>
          <div className="form-actions"><button type="submit" disabled={submitting}>{submitting ? 'Posting…' : 'Post transaction'}</button></div>
        </form>
      )}

      {loading ? (
        <div className="empty-state">Loading savings accounts…</div>
      ) : error ? (
        <div className="empty-state error-state">{error}</div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">No savings accounts found.</div>
      ) : (
        <table className="member-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Member</th>
              <th>Balance</th>
              <th>Minimum</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.accountNumber}</td>
                <td>{account.member}</td>
                <td>{new Intl.NumberFormat('en-BD', {
                  style: 'currency',
                  currency: 'BDT',
                  maximumFractionDigits: 0,
                }).format(account.balance)}</td>
                <td>{new Intl.NumberFormat('en-BD', {
                  style: 'currency',
                  currency: 'BDT',
                  maximumFractionDigits: 2,
                }).format(account.minimumBalance ?? 0)}</td>
                <td>
                  <span className={`status-tag ${account.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {account.status}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" onClick={() => openTransactionForm(account.id, 'Deposit')}>Deposit</button>
                    <button type="button" onClick={() => openTransactionForm(account.id, 'Withdrawal')}>Withdraw</button>
                    <button type="button" onClick={() => void loadTransactionHistory(account.id)}>History</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {transactions.length > 0 && (
        <section className="transaction-history">
          <h3>Transaction history</h3>
          <table className="member-table">
            <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance after</th></tr></thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{new Date(transaction.createdAt).toLocaleString()}</td>
                  <td>{transaction.type}</td>
                  <td>{transaction.amount.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</td>
                  <td>{transaction.balanceAfter.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function LoansPage({ token }: { token: string }) {
  const [loans, setLoans] = useState<LoanPortfolioItem[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formState, setFormState] = useState({
    memberId: '',
    productName: 'Business Loan',
    principalAmount: '50000',
    interestRate: '14',
    tenureMonths: '12',
    status: 'Approved',
  });

  const loadMembers = async () => {
    const response = await fetch(`${apiBaseUrl}/members`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const envelope = (await response.json()) as ApiEnvelope<MemberRecord[]>;
    if (!response.ok || !envelope.success || !envelope.data) {
      throw new Error(envelope.message || 'Unable to load member list.');
    }

    const memberList = envelope.data;
    setMembers(memberList);
    if (memberList.length > 0 && !formState.memberId) {
      setFormState((current) => ({ ...current, memberId: String(memberList[0].id) }));
    }
  };

  useEffect(() => {
    const abortController = new AbortController();

    const loadLoans = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${apiBaseUrl}/loans/portfolio`, {
          signal: abortController.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const envelope = (await response.json()) as ApiEnvelope<LoanPortfolioItem[]>;
        if (!response.ok || !envelope.success || !envelope.data) {
          throw new Error(envelope.message || 'Unable to load loans.');
        }

        setLoans(envelope.data);
        await loadMembers();
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : 'Unable to load loans.');
      } finally {
        setLoading(false);
      }
    };

    void loadLoans();
    return () => abortController.abort();
  }, [token]);

  const resetForm = () => {
    setFormState({
      memberId: members[0]?.id ? String(members[0].id) : '',
      productName: 'Business Loan',
      principalAmount: '50000',
      interestRate: '14',
      tenureMonths: '12',
      status: 'Approved',
    });
    setFormError('');
    setFormSuccess('');
  };

  const handleCreateLoan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const payload = {
        memberId: Number(formState.memberId),
        productName: formState.productName.trim(),
        principalAmount: Number(formState.principalAmount),
        interestRate: Number(formState.interestRate),
        tenureMonths: Number(formState.tenureMonths),
        status: formState.status,
      };

      const response = await fetch(`${apiBaseUrl}/loans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const envelope = (await response.json()) as ApiEnvelope<LoanPortfolioItem>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || 'Unable to create loan.');
      }

      const createdLoan = envelope.data as LoanPortfolioItem;
      setLoans((current) => [createdLoan, ...current]);
      setIsFormOpen(false);
      resetForm();
      setFormSuccess('Loan created successfully.');
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Unable to create loan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Loans</h2>
          <p>Review loan applications, approval pipeline, disbursement, schedules, and repayments.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError('');
            setFormSuccess('');
            setIsFormOpen((current) => !current);
            if (!isFormOpen) {
              resetForm();
            }
          }}
        >
          {isFormOpen ? 'Close' : 'Create loan'}
        </button>
      </div>

      {isFormOpen && (
        <form className="loan-form" onSubmit={handleCreateLoan}>
          <div className="loan-form-grid">
            <label>
              Member
              <select value={formState.memberId} onChange={(event) => setFormState((current) => ({ ...current, memberId: event.target.value }))} required>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
            <label>
              Product name
              <input type="text" value={formState.productName} onChange={(event) => setFormState((current) => ({ ...current, productName: event.target.value }))} required />
            </label>
            <label>
              Principal amount
              <input type="number" min="1" step="1000" value={formState.principalAmount} onChange={(event) => setFormState((current) => ({ ...current, principalAmount: event.target.value }))} required />
            </label>
            <label>
              Interest rate (%)
              <input type="number" min="0" step="0.01" value={formState.interestRate} onChange={(event) => setFormState((current) => ({ ...current, interestRate: event.target.value }))} required />
            </label>
            <label>
              Tenure (months)
              <input type="number" min="1" step="1" value={formState.tenureMonths} onChange={(event) => setFormState((current) => ({ ...current, tenureMonths: event.target.value }))} required />
            </label>
            <label>
              Status
              <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}>
                <option value="Approved">Approved</option>
                <option value="Disbursed">Disbursed</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
            </label>
          </div>

          {formError && <div className="empty-state error-state">{formError}</div>}
          {formSuccess && <div className="empty-state success-state">{formSuccess}</div>}

          <div className="form-actions">
            <button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save loan'}</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="empty-state">Loading loan portfolio…</div>
      ) : error ? (
        <div className="empty-state error-state">{error}</div>
      ) : loans.length === 0 ? (
        <div className="empty-state">No loan records found.</div>
      ) : (
        <table className="member-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Product</th>
              <th>Principal</th>
              <th>Outstanding</th>
              <th>Rate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id}>
                <td>{loan.member}</td>
                <td>{loan.product}</td>
                <td>{new Intl.NumberFormat('en-BD', {
                  style: 'currency',
                  currency: 'BDT',
                  maximumFractionDigits: 0,
                }).format(loan.principalAmount)}</td>
                <td>{new Intl.NumberFormat('en-BD', {
                  style: 'currency',
                  currency: 'BDT',
                  maximumFractionDigits: 0,
                }).format(loan.outstanding)}</td>
                <td>{loan.interestRate}%</td>
                <td>
                  <span className={`status-tag ${loan.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {loan.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CollectionsPage({ token }: { token: string }) {
  const [sheets, setSheets] = useState<CollectionSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const abortController = new AbortController();

    const loadSheets = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${apiBaseUrl}/collections/sheets`, {
          signal: abortController.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const envelope = (await response.json()) as ApiEnvelope<CollectionSheet[]>;
        if (!response.ok || !envelope.success || !envelope.data) {
          throw new Error(envelope.message || 'Unable to load collection sheets.');
        }

        setSheets(envelope.data);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : 'Unable to load collection sheets.');
      } finally {
        setLoading(false);
      }
    };

    void loadSheets();
    return () => abortController.abort();
  }, [token]);

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Collections</h2>
          <p>Process collection sheets, reconcile cash, and post payments to the ledger.</p>
        </div>
        <button type="button">New sheet</button>
      </div>

      {loading ? (
        <div className="empty-state">Loading collection sheets…</div>
      ) : error ? (
        <div className="empty-state error-state">{error}</div>
      ) : sheets.length === 0 ? (
        <div className="empty-state">No collection sheets found.</div>
      ) : (
        <table className="member-table">
          <thead>
            <tr>
              <th>Center</th>
              <th>Officer</th>
              <th>Due date</th>
              <th>Collected</th>
              <th>Received</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((sheet) => (
              <tr key={sheet.id}>
                <td>{sheet.center}</td>
                <td>{sheet.officer}</td>
                <td>{new Date(sheet.dueDate).toLocaleDateString()}</td>
                <td>{new Intl.NumberFormat('en-BD', {
                  style: 'currency',
                  currency: 'BDT',
                  maximumFractionDigits: 0,
                }).format(sheet.collected)}</td>
                <td>{new Intl.NumberFormat('en-BD', {
                  style: 'currency',
                  currency: 'BDT',
                  maximumFractionDigits: 0,
                }).format(sheet.received)}</td>
                <td>
                  <span className={`status-tag ${sheet.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {sheet.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AccountingPage({ token }: { token: string }) {
  const [entries, setEntries] = useState<TrialBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const abortController = new AbortController();

    const loadTrialBalance = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${apiBaseUrl}/accounting/trial-balance`, {
          signal: abortController.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const envelope = (await response.json()) as ApiEnvelope<TrialBalanceEntry[]>;
        if (!response.ok || !envelope.success || !envelope.data) {
          throw new Error(envelope.message || 'Unable to load trial balance.');
        }

        setEntries(envelope.data);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : 'Unable to load trial balance.');
      } finally {
        setLoading(false);
      }
    };

    void loadTrialBalance();
    return () => abortController.abort();
  }, [token]);

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Accounting</h2>
          <p>Review the live trial balance, ledger movements, and reconciliation status.</p>
        </div>
        <button type="button">Post entry</button>
      </div>

      {loading ? (
        <div className="empty-state">Loading trial balance…</div>
      ) : error ? (
        <div className="empty-state error-state">{error}</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">No accounting entries found.</div>
      ) : (
        <table className="member-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Debit</th>
              <th>Credit</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.account}>
                <td>{entry.account}</td>
                <td>{new Intl.NumberFormat('en-BD', {
                  style: 'currency',
                  currency: 'BDT',
                  maximumFractionDigits: 0,
                }).format(entry.debit)}</td>
                <td>{new Intl.NumberFormat('en-BD', {
                  style: 'currency',
                  currency: 'BDT',
                  maximumFractionDigits: 0,
                }).format(entry.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ReportsPage({ token }: { token: string }) {
  const [reports, setReports] = useState<{ name: string; category: string; lastRun: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const abortController = new AbortController();

    const loadReports = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${apiBaseUrl}/reports/financial`, {
          signal: abortController.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const envelope = (await response.json()) as ApiEnvelope<{ name: string; category: string; lastRun: string }[]>;
        if (!response.ok || !envelope.success || !envelope.data) {
          throw new Error(envelope.message || 'Unable to load reports.');
        }

        setReports(envelope.data);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : 'Unable to load reports.');
      } finally {
        setLoading(false);
      }
    };

    void loadReports();
    return () => abortController.abort();
  }, [token]);

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Reports</h2>
          <p>Generate portfolio, financial, and collection reports in Excel and PDF.</p>
        </div>
        <button type="button">Generate</button>
      </div>

      {loading ? (
        <div className="empty-state">Loading reports…</div>
      ) : error ? (
        <div className="empty-state error-state">{error}</div>
      ) : reports.length === 0 ? (
        <div className="empty-state">No reports available.</div>
      ) : (
        <table className="member-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Last run</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.name}>
                <td>{report.name}</td>
                <td>{report.category}</td>
                <td>{new Date(report.lastRun).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AuditPage({ token }: { token: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const abortController = new AbortController();

    const loadAuditEntries = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${apiBaseUrl}/audit/logs`, {
          signal: abortController.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const envelope = (await response.json()) as ApiEnvelope<AuditEntry[]>;
        if (!response.ok || !envelope.success || !envelope.data) {
          throw new Error(envelope.message || 'Unable to load audit logs.');
        }

        setEntries(envelope.data);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : 'Unable to load audit logs.');
      } finally {
        setLoading(false);
      }
    };

    void loadAuditEntries();
    return () => abortController.abort();
  }, [token]);

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Audit</h2>
          <p>Review user activity logs, approval history, and compliance outputs.</p>
        </div>
        <button type="button">Export log</button>
      </div>

      {loading ? (
        <div className="empty-state">Loading audit log…</div>
      ) : error ? (
        <div className="empty-state error-state">{error}</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">No audit events found.</div>
      ) : (
        <table className="member-table">
          <thead>
            <tr>
              <th>Actor</th>
              <th>Action</th>
              <th>Module</th>
              <th>Outcome</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.actor}</td>
                <td>{entry.action}</td>
                <td>{entry.module}</td>
                <td>{entry.outcome}</td>
                <td>{new Date(entry.time).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SettingsPage({ token }: { token: string }) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const abortController = new AbortController();

    const loadSettings = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(`${apiBaseUrl}/settings/system`, {
          signal: abortController.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const envelope = (await response.json()) as ApiEnvelope<SystemSettings>;
        if (!response.ok || !envelope.success || !envelope.data) {
          throw new Error(envelope.message || 'Unable to load system settings.');
        }

        setSettings(envelope.data);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : 'Unable to load system settings.');
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
    return () => abortController.abort();
  }, [token]);

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Settings</h2>
          <p>Adjust system preferences, role access, branch rules, and finance configuration.</p>
        </div>
        <button type="button">Save changes</button>
      </div>

      {loading ? (
        <div className="empty-state">Loading system settings…</div>
      ) : error ? (
        <div className="empty-state error-state">{error}</div>
      ) : settings ? (
        <div className="settings-grid">
          <div className="settings-card">
            <span>Application</span>
            <strong>{settings.applicationName}</strong>
          </div>
          <div className="settings-card">
            <span>Currency</span>
            <strong>{settings.currency}</strong>
          </div>
          <div className="settings-card">
            <span>Timezone</span>
            <strong>{settings.timezone}</strong>
          </div>
          <div className="settings-card">
            <span>Default branch</span>
            <strong>{settings.defaultBranch}</strong>
          </div>
          <div className="settings-card">
            <span>Password policy</span>
            <strong>{settings.passwordPolicy}</strong>
          </div>
          <div className="settings-card">
            <span>Session timeout</span>
            <strong>{settings.sessionTimeoutMinutes} minutes</strong>
          </div>
        </div>
      ) : (
        <div className="empty-state">No settings available.</div>
      )}
    </div>
  );
}

export default App;
