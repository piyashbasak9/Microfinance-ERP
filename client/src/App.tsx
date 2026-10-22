import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useSearchParams,
  useNavigate,
} from 'react-router-dom';
import './App.css';

type MenuItem = {
  label: string;
  path: string;
  permissions: string[];
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

type ManagedUser = {
  id: number;
  email: string;
  fullName: string;
  role: string;
  branchId: number | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

type PermissionDefinition = {
  code: string;
  module: string;
  description: string;
};

type ManagedRole = {
  name: string;
  description: string;
  isSystemRole: boolean;
  isActive: boolean;
  permissions: string[];
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
  todayCollections: number | null;
  overdueAmount: number | null;
  portfolioAtRisk: number | null;
  metrics: DashboardMetric[];
  recentMembers: { id: number; name: string; status: string; branch: string }[];
  recentLoans: { id: number; member: string; product: string; outstanding: number; status: string }[];
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
  id: number;
  code: string;
  account: string;
  accountType: string;
  debit: number;
  credit: number;
};

type TrialBalance = {
  accounts: TrialBalanceEntry[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
};

type FinancialReportResult = {
  reportCode: 'trial-balance' | 'income-statement';
  name: string;
  fromDate: string | null;
  toDate: string;
  branchId: number | null;
  accounts: Array<{
    id: number;
    code: string;
    account: string;
    accountType: string;
    debit: number;
    credit: number;
    balance?: number;
  }>;
  totalDebits?: number;
  totalCredits?: number;
  isBalanced?: boolean;
  totalIncome?: number;
  totalExpenses?: number;
  netIncome?: number;
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

type LoanInstallment = {
  installmentNumber: number;
  principal: number;
  interest: number;
  total: number;
  balance: number;
  dueDate: string | null;
  status: string;
  principalPaid: number;
  interestPaid: number;
};

type LoanPaymentRecord = {
  id: number;
  amount: number;
  principalAmount: number;
  interestAmount: number;
  createdAt: string;
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
  { label: 'Dashboard', path: '/dashboard', permissions: ['Dashboard.Read'] },
  { label: 'Branches', path: '/branches', permissions: ['Branches.Read'] },
  { label: 'Members', path: '/members', permissions: ['Members.Read'] },
  { label: 'Savings', path: '/savings', permissions: ['Savings.Read'] },
  { label: 'Loans', path: '/loans', permissions: ['Loans.Read'] },
  { label: 'Collections', path: '/collections', permissions: ['Collections.Read'] },
  { label: 'Accounting', path: '/accounting', permissions: ['Accounting.Read'] },
  { label: 'Reports', path: '/reports', permissions: ['Reports.Read'] },
  { label: 'Audit', path: '/audit', permissions: ['Audit.Read'] },
  { label: 'Settings', path: '/settings', permissions: ['Settings.Read'] },
  { label: 'Security', path: '/admin', permissions: ['Security.Users.Manage', 'Security.Roles.Manage'] },
];

function downloadCsv(fileName: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escapeCell = (value: string | number | null | undefined) => {
    const raw = value == null ? '' : String(value);
    const text = typeof value === 'string' && /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function App() {
  const [session, setSession] = useState<LoginResult | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    window.localStorage.removeItem('mfi-session');
    const abortController = new AbortController();
    const initializeSession = async () => {
      try {
        const restoredSession = await refreshSession(abortController.signal);
        if (restoredSession) {
          setSession(restoredSession);
        }
      } catch (requestError) {
        if (abortController.signal.aborted) {
          return;
        }
        setAuthError(requestError instanceof Error ? requestError.message : 'Unable to restore your session.');
      } finally {
        if (!abortController.signal.aborted) {
          setIsInitializing(false);
        }
      }
    };

    void initializeSession();
    return () => abortController.abort();
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      setSession(null);
      setAuthError('Your session expired. Sign in again.');
    };

    window.addEventListener('mfi:session-expired', handleSessionExpired);
    return () => window.removeEventListener('mfi:session-expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    const refreshDelay = Math.max(Date.parse(session.expiresAt) - Date.now() - 30_000, 0);
    const timeout = window.setTimeout(() => {
      void refreshSession()
        .then((refreshedSession) => {
          if (!refreshedSession) {
            setSession(null);
            setAuthError('Your session expired. Sign in again.');
            return;
          }

          setSession(refreshedSession);
        })
        .catch((requestError: unknown) => {
          setSession(null);
          setAuthError(requestError instanceof Error ? requestError.message : 'Unable to refresh your session.');
        });
    }, refreshDelay);

    return () => window.clearTimeout(timeout);
  }, [session]);

  const handleLogout = () => {
    void apiFetch(`${apiBaseUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).then((response) => {
      if (!response.ok) {
        setAuthError('The server could not revoke this session. It will expire automatically.');
      }
    }).catch(() => {
      setAuthError('The server could not revoke this session. It will expire automatically.');
    });
    setSession(null);
  };

  const renderProtectedPage = (requiredPermissions: string | string[], content: ReactNode) => {
    if (!session) {
      return <Navigate to="/login" replace />;
    }
    const permissionList = typeof requiredPermissions === 'string' ? [requiredPermissions] : requiredPermissions;
    if (!permissionList.some((permission) => session.permissions.includes(permission))) {
      const fallbackPath = menuItems.find((item) => item.permissions.some((itemPermission) => session.permissions.includes(itemPermission)))?.path ?? '/login';
      return <Navigate to={fallbackPath} replace />;
    }

    return (
      <AppLayout
        user={session.user}
        token={session.token}
        permissions={session.permissions}
        onLogout={handleLogout}
      >
        {content}
      </AppLayout>
    );
  };

  return (
    <BrowserRouter>
      {isInitializing ? (
        <div className="login-page"><div className="empty-state">Restoring your session…</div></div>
      ) : (
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={(nextSession) => { setAuthError(''); setSession(nextSession); }} initialError={authError} />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/branches" element={renderProtectedPage('Branches.Read', <BranchesPage token={session?.token ?? ''} canManage={session?.permissions.includes('Branches.Manage') ?? false} />)} />
          <Route path="/dashboard" element={renderProtectedPage('Dashboard.Read', <DashboardPage token={session?.token ?? ''} />)} />
          <Route path="/members" element={renderProtectedPage('Members.Read', <MembersPage
            token={session?.token ?? ''}
            canCreate={session?.permissions.includes('Members.Create') ?? false}
            canEdit={session?.permissions.includes('Members.Update') ?? false}
          />)} />
          <Route path="/savings" element={renderProtectedPage('Savings.Read', <SavingsPage token={session?.token ?? ''} canOpenAccount={session?.permissions.includes('Savings.CreateAccount') ?? false} canTransact={session?.permissions.includes('Savings.Transact') ?? false} />)} />
          <Route path="/loans" element={renderProtectedPage('Loans.Read', <LoansPage token={session?.token ?? ''} permissions={session?.permissions ?? []} />)} />
          <Route path="/collections" element={renderProtectedPage('Collections.Read', <CollectionsPage token={session?.token ?? ''} />)} />
          <Route path="/accounting" element={renderProtectedPage('Accounting.Read', <AccountingPage token={session?.token ?? ''} />)} />
          <Route path="/reports" element={renderProtectedPage('Reports.Read', <ReportsPage token={session?.token ?? ''} />)} />
          <Route path="/audit" element={renderProtectedPage('Audit.Read', <AuditPage token={session?.token ?? ''} />)} />
          <Route path="/settings" element={renderProtectedPage('Settings.Read', <SettingsPage token={session?.token ?? ''} onLogout={handleLogout} />)} />
          <Route path="/admin" element={renderProtectedPage(['Security.Users.Manage', 'Security.Roles.Manage'], <SecurityAdminPage token={session?.token ?? ''} permissions={session?.permissions ?? []} />)} />
          <Route path="/" element={<Navigate to={session ? (menuItems.find((item) => item.permissions.some((permission) => session.permissions.includes(permission)))?.path ?? '/login') : '/login'} replace />} />
          <Route path="*" element={<Navigate to={session ? (menuItems.find((item) => item.permissions.some((permission) => session.permissions.includes(permission)))?.path ?? '/login') : '/login'} replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

async function refreshSession(signal?: AbortSignal): Promise<LoginResult | null> {
  const response = await apiFetch(`${apiBaseUrl}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    signal,
  });
  if (response.status === 401) {
    return null;
  }

  const envelope = (await response.json()) as ApiEnvelope<LoginResult>;
  if (!response.ok || !envelope.success || !envelope.data) {
    throw new Error(envelope.message || 'Unable to restore your session.');
  }
  return envelope.data;
}

async function adminRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await apiFetch(`${apiBaseUrl}${path}`, { ...init, headers });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !envelope.success || !envelope.data) {
    throw new Error(envelope.message || 'The security request failed.');
  }
  return envelope.data;
}

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401 && new Headers(init.headers).has('Authorization')) {
    window.dispatchEvent(new Event('mfi:session-expired'));
  }
  return response;
}

function AppLayout({ children, user, token, permissions, onLogout }: { children?: ReactNode; user: AuthenticatedUser; token: string; permissions: string[]; onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

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
            <span>{user.role === 'Super Admin' || user.branchId === null ? 'All branches' : `Branch #${user.branchId}`}</span>
          </div>
        </div>

        <nav className="menu">
          {menuItems.filter((item) => item.permissions.some((permission) => permissions.includes(permission))).map((item) => (
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
            <h1>{menuItems.find((item) => item.path === location.pathname)?.label ?? 'Operations'}</h1>
          </div>
          <div className="user-panel">
            <span>{user.name} · {user.role}</span>
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

function LoginPage({ onLogin, initialError }: { onLogin: (session: LoginResult) => void; initialError: string }) {
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
      const response = await apiFetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const envelope = (await response.json()) as ApiEnvelope<LoginResult>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || 'Sign in failed.');
      }

      onLogin(envelope.data);
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
          {initialError && <p role="alert">{initialError}</p>}
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
        <button type="button" className="text-button" onClick={() => navigate('/reset-password')}>Forgot password?</button>
      </div>
    </div>
  );
}

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resetToken = searchParams.get('token') ?? '';
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (resetToken && newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = resetToken ? '/auth/password/reset' : '/auth/password/forgot';
      const body = resetToken ? { token: resetToken, newPassword } : { email };
      const response = await apiFetch(`${apiBaseUrl}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const envelope = (await response.json()) as ApiEnvelope<{ signInRequired?: boolean }>;
      if (!response.ok || !envelope.success) {
        throw new Error(envelope.message || 'Unable to complete the password request.');
      }

      setMessage(envelope.message);
      if (resetToken) {
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to complete the password request.');
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
            <h2>{resetToken ? 'Choose a new password' : 'Reset your password'}</h2>
            <p>{resetToken ? 'Your reset link can only be used once.' : 'We will email instructions if an active account matches.'}</p>
          </div>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          {resetToken ? (
            <>
              <label>
                New password
                <input type="password" autoComplete="new-password" minLength={12} maxLength={256} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              </label>
              <label>
                Confirm new password
                <input type="password" autoComplete="new-password" minLength={12} maxLength={256} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </label>
            </>
          ) : (
            <label>
              Email
              <input type="email" autoComplete="email" maxLength={256} required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
          )}
          {error && <p className="error-state" role="alert">{error}</p>}
          {message && <p className="success-state" role="status">{message}</p>}
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : resetToken ? 'Reset password' : 'Send reset instructions'}</button>
        </form>
        <button type="button" className="text-button" onClick={() => navigate('/login')}>Return to sign in</button>
      </div>
    </div>
  );
}

function SecurityAdminPage({ token, permissions }: { token: string; permissions: string[] }) {
  const canManageUsers = permissions.includes('Security.Users.Manage');
  const canManageRoles = permissions.includes('Security.Roles.Manage');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [permissionDefinitions, setPermissionDefinitions] = useState<PermissionDefinition[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const selectedRoleRef = useRef<string | null>(null);
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [userForm, setUserForm] = useState({ email: '', fullName: '', role: '', branchId: '', password: '', isActive: true });
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: [] as string[] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSecurityData = useCallback(async (preferredRole?: string) => {
    const [loadedUsers, loadedBranches, loadedRoles, loadedPermissions] = await Promise.all([
      canManageUsers ? adminRequest<ManagedUser[]>('/admin/users', token) : Promise.resolve([] as ManagedUser[]),
      canManageUsers ? adminRequest<BranchOption[]>('/branches', token) : Promise.resolve([] as BranchOption[]),
      canManageRoles ? adminRequest<ManagedRole[]>('/admin/roles', token) : Promise.resolve([] as ManagedRole[]),
      canManageRoles ? adminRequest<PermissionDefinition[]>('/admin/permissions', token) : Promise.resolve([] as PermissionDefinition[]),
    ]);
    return {
      users: loadedUsers,
      branches: loadedBranches,
      roles: loadedRoles,
      permissions: loadedPermissions,
      preferredRole,
    };
  }, [canManageRoles, canManageUsers, token]);

  const applySecurityData = useCallback((data: Awaited<ReturnType<typeof loadSecurityData>>) => {
    setUsers(data.users);
    setBranches(data.branches);
    setRoles(data.roles);
    setPermissionDefinitions(data.permissions);

    const roleToSelect = data.preferredRole ?? selectedRoleRef.current ?? data.roles[0]?.name;
    const role = data.roles.find((item) => item.name === roleToSelect);
    if (role) {
      selectedRoleRef.current = role.name;
      setSelectedRole(role.name);
      setRoleForm({ name: '', description: '', permissions: role.permissions });
    }
  }, []);

  const refreshSecurityData = useCallback(async (preferredRole?: string) => {
    setLoading(true);
    setError('');
    try {
      applySecurityData(await loadSecurityData(preferredRole));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load security administration.');
    } finally {
      setLoading(false);
    }
  }, [applySecurityData, loadSecurityData]);

  useEffect(() => {
    let isCurrent = true;
    const initialize = async () => {
      try {
        const data = await loadSecurityData();
        if (isCurrent) {
          applySecurityData(data);
        }
      } catch (requestError) {
        if (isCurrent) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load security administration.');
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    };

    void initialize();
    return () => {
      isCurrent = false;
    };
  }, [applySecurityData, loadSecurityData]);

  const submitUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const payload = {
        email: userForm.email,
        fullName: userForm.fullName,
        role: userForm.role,
        branchId: userForm.branchId ? Number(userForm.branchId) : null,
        ...(editingUser === null ? { password: userForm.password } : { isActive: userForm.isActive }),
      };
      await adminRequest<ManagedUser>(
        editingUser === null ? '/admin/users' : `/admin/users/${editingUser}`,
        token,
        { method: editingUser === null ? 'POST' : 'PUT', body: JSON.stringify(payload) },
      );
      setNotice(editingUser === null ? 'Staff account created.' : 'Staff account updated.');
      setEditingUser(null);
      setUserForm({ email: '', fullName: '', role: roles[0]?.name ?? '', branchId: '', password: '', isActive: true });
      await refreshSecurityData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save the staff account.');
    } finally {
      setSubmitting(false);
    }
  };

  const editUser = (user: ManagedUser) => {
    setEditingUser(user.id);
    setUserForm({
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      branchId: user.branchId?.toString() ?? '',
      password: '',
      isActive: user.isActive,
    });
  };

  const selectedRoleDetails = roles.find((role) => role.name === selectedRole);

  const saveRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      if (selectedRole) {
        await adminRequest<ManagedRole>(
          `/admin/roles/${encodeURIComponent(selectedRole)}/permissions`,
          token,
          { method: 'PUT', body: JSON.stringify({ permissionCodes: roleForm.permissions }) },
        );
        setNotice('Role permissions updated.');
      } else {
        const createdRole = await adminRequest<ManagedRole>(
          '/admin/roles',
          token,
          { method: 'POST', body: JSON.stringify({ name: roleForm.name, description: roleForm.description, permissionCodes: roleForm.permissions }) },
        );
        setNotice('Role created.');
        await refreshSecurityData(createdRole.name);
        return;
      }
      await refreshSecurityData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save the role.');
    } finally {
      setSubmitting(false);
    }
  };

  const startNewRole = () => {
    selectedRoleRef.current = '';
    setSelectedRole('');
    setRoleForm({ name: '', description: '', permissions: [] });
  };

  const selectRole = (roleName: string) => {
    selectedRoleRef.current = roleName;
    setSelectedRole(roleName);
    const role = roles.find((item) => item.name === roleName);
    setRoleForm({
      name: '',
      description: '',
      permissions: role?.permissions ?? [],
    });
  };

  const toggleRolePermission = (code: string) => {
    setRoleForm((current) => ({
      ...current,
      permissions: current.permissions.includes(code)
        ? current.permissions.filter((permission) => permission !== code)
        : [...current.permissions, code],
    }));
  };

  return (
    <div className="page-stack">
      <section className="page-card panel">
        <div className="page-toolbar">
          <div>
            <h2>Security administration</h2>
            <p>Manage staff accounts and database-backed role permissions.</p>
          </div>
          <button type="button" onClick={() => void refreshSecurityData()} disabled={loading}>Refresh</button>
        </div>
        {loading && <div className="empty-state">Loading security data…</div>}
        {error && <div className="empty-state error-state" role="alert">{error}</div>}
        {notice && <div className="empty-state success-state" role="status">{notice}</div>}

        {canManageUsers && (
          <section className="admin-section">
            <h3>Staff users</h3>
            <form className="admin-form" onSubmit={submitUser}>
              <div className="admin-form-grid">
                <label>Email<input type="email" required maxLength={256} value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} /></label>
                <label>Full name<input required maxLength={200} value={userForm.fullName} onChange={(event) => setUserForm((current) => ({ ...current, fullName: event.target.value }))} /></label>
                <label>Role
                  <select required value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}>
                    <option value="">Select a role</option>
                    {roles.map((role) => role.isActive && <option key={role.name} value={role.name}>{role.name}</option>)}
                  </select>
                </label>
                <label>Branch
                  <select value={userForm.branchId} onChange={(event) => setUserForm((current) => ({ ...current, branchId: event.target.value }))}>
                    <option value="">All branches</option>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </label>
                {editingUser === null && <label>Initial password<input type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} /></label>}
                {editingUser !== null && <label className="checkbox-label"><input type="checkbox" checked={userForm.isActive} onChange={(event) => setUserForm((current) => ({ ...current, isActive: event.target.checked }))} /> Account active</label>}
              </div>
              <div className="form-actions">
                {editingUser !== null && <button type="button" className="secondary-button" onClick={() => { setEditingUser(null); setUserForm({ email: '', fullName: '', role: roles[0]?.name ?? '', branchId: '', password: '', isActive: true }); }}>Cancel edit</button>}
                <button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editingUser === null ? 'Create staff user' : 'Update staff user'}</button>
              </div>
            </form>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.fullName}</td><td>{user.email}</td><td>{user.role}</td>
                      <td>{branches.find((branch) => branch.id === user.branchId)?.name ?? 'All branches'}</td>
                      <td>{user.isActive ? 'Active' : 'Disabled'}</td>
                      <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</td>
                      <td><button type="button" className="secondary-button" onClick={() => editUser(user)}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && !loading && <div className="empty-state">No staff users found.</div>}
            </div>
          </section>
        )}
      </section>

      {canManageRoles && (
        <section className="page-card panel">
          <div className="page-toolbar">
            <div><h2>Roles and permissions</h2><p>Permission changes take effect immediately for all users assigned to the role.</p></div>
            <button type="button" onClick={startNewRole}>New role</button>
          </div>
          <div className="admin-form-grid role-select-grid">
            <label>Role
              <select value={selectedRole ?? ''} onChange={(event) => event.target.value ? selectRole(event.target.value) : startNewRole()}>
                <option value="">Create a new role</option>
                {roles.map((role) => <option key={role.name} value={role.name}>{role.name}{role.isSystemRole ? ' (system)' : ''}</option>)}
              </select>
            </label>
            {selectedRoleDetails && <p>{selectedRoleDetails.description}{selectedRoleDetails.isSystemRole ? ' Built-in role permissions are read-only.' : ''}</p>}
          </div>
          <form className="admin-form" onSubmit={saveRole}>
            {!selectedRole && (
              <div className="admin-form-grid">
                <label>Role name<input required minLength={2} maxLength={100} value={roleForm.name} onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Description<input required minLength={1} maxLength={300} value={roleForm.description} onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))} /></label>
              </div>
            )}
            <div className="permission-grid">
              {permissionDefinitions.map((permission) => (
                <label key={permission.code} className="permission-option">
                  <input
                    type="checkbox"
                    checked={roleForm.permissions.includes(permission.code)}
                    disabled={!selectedRole || selectedRoleDetails?.isSystemRole}
                    onChange={() => toggleRolePermission(permission.code)}
                  />
                  <span><strong>{permission.code}</strong><small>{permission.description}</small></span>
                </label>
              ))}
            </div>
            {!selectedRoleDetails?.isSystemRole && <div className="form-actions"><button type="submit" disabled={submitting}>{submitting ? 'Saving…' : selectedRole ? 'Save permissions' : 'Create role'}</button></div>}
          </form>
        </section>
      )}
    </div>
  );
}

function DashboardPage({ token }: { token: string }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();

    const loadSummary = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await apiFetch(`${apiBaseUrl}/dashboard/summary`, {
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
  }, [reloadKey, token]);

  const metrics = summary?.metrics ?? [];

  const formatMetricValue = (metric: DashboardMetric) => {
    if (metric.label.includes('Members')) {
      return new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(metric.value);
    }

    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      maximumFractionDigits: 0,
    }).format(metric.value);
  };

  return (
    <div className="page-stack">
      <div className="dashboard-actions">
        <button type="button" className="secondary-button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>Refresh dashboard</button>
      </div>
      {loading ? (
        <div className="empty-state" role="status">Loading dashboard…</div>
      ) : error ? (
        <div className="empty-state error-state" role="alert">{error}</div>
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
                <h3>Recent members</h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Branch</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.recentMembers.map((member) => (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      <td><span className={`status-tag ${member.status.toLowerCase() === 'active' ? 'active' : ''}`}>{member.status}</span></td>
                      <td>{member.branch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {summary?.recentMembers.length === 0 && <div className="empty-state">No members have been registered yet.</div>}
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Collections</h3>
              </div>
              <div className="empty-state">
                Collection totals will be available after collection posting is implemented.
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Recent loans</h3>
              <button type="button" className="secondary-button" disabled={!summary?.recentLoans.length} onClick={() => downloadCsv(
                'recent-loan-portfolio.csv',
                ['Loan ID', 'Member', 'Product', 'Outstanding', 'Status'],
                (summary?.recentLoans ?? []).map((loan) => [loan.id, loan.member, loan.product, loan.outstanding, loan.status]),
              )}>Export recent CSV</button>
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
                {summary?.recentLoans.map((loan) => (
                  <tr key={loan.id}>
                    <td>{loan.member}</td>
                    <td>{loan.product}</td>
                    <td>{new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(loan.outstanding)}</td>
                    <td><span className={`status-tag ${loan.status.toLowerCase() === 'disbursed' ? 'active' : ''}`}>{loan.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {summary?.recentLoans.length === 0 && <div className="empty-state">No disbursed or overdue loans found.</div>}
          </section>
        </>
      )}
    </div>
  );
}

function BranchesPage({ token, canManage }: { token: string; canManage: boolean }) {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState({
    name: '',
    code: '',
    address: '',
    isActive: true,
  });

  const resetForm = () => {
    setEditingBranchId(null);
    setFormState({ name: '', code: '', address: '', isActive: true });
    setFormError('');
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadBranches = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await apiFetch(`${apiBaseUrl}/branches${canManage ? '?includeInactive=true' : ''}`, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        const envelope = (await response.json()) as ApiEnvelope<BranchOption[]>;
        if (!response.ok || !envelope.success || !envelope.data) {
          throw new Error(envelope.message || 'Unable to load branches.');
        }
        setBranches(envelope.data);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return;
        setError(requestError instanceof Error ? requestError.message : 'Unable to load branches.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadBranches();
    return () => controller.abort();
  }, [canManage, reloadKey, token]);

  const handleSaveBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    setFormSuccess('');
    try {
      const response = await apiFetch(
        `${apiBaseUrl}/branches${editingBranchId === null ? '' : `/${editingBranchId}`}`,
        {
          method: editingBranchId === null ? 'POST' : 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formState),
        },
      );
      const envelope = (await response.json()) as ApiEnvelope<BranchOption>;
      if (!response.ok || !envelope.success) {
        throw new Error(envelope.message || 'Unable to save branch.');
      }

      setFormSuccess(envelope.message);
      resetForm();
      setIsFormOpen(false);
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Unable to save branch.');
    } finally {
      setSubmitting(false);
    }
  };

  const editBranch = (branch: BranchOption) => {
    setEditingBranchId(branch.id);
    setFormState({
      name: branch.name,
      code: branch.code,
      address: branch.address ?? '',
      isActive: branch.isActive,
    });
    setFormError('');
    setFormSuccess('');
    setIsFormOpen(true);
  };

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div><h2>Branches</h2><p>View and manage the organization's branches.</p></div>
        <div className="toolbar-actions">
          <button type="button" className="secondary-button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>Refresh</button>
          {canManage && <button type="button" onClick={() => {
            if (isFormOpen) {
              resetForm();
              setIsFormOpen(false);
            } else {
              resetForm();
              setFormSuccess('');
              setIsFormOpen(true);
            }
          }}>{isFormOpen ? 'Cancel' : 'Create branch'}</button>}
        </div>
      </div>
      {formSuccess && <div className="empty-state success-state" role="status">{formSuccess}</div>}
      {isFormOpen && canManage && (
        <form className="member-form" onSubmit={handleSaveBranch}>
          <div className="member-form-grid">
            <label>
              Branch name
              <input type="text" minLength={2} maxLength={200} value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label>
              Branch code
              <input type="text" minLength={2} maxLength={50} pattern="[A-Za-z0-9_-]+" value={formState.code} onChange={(event) => setFormState((current) => ({ ...current, code: event.target.value }))} required />
            </label>
            <label>
              Address
              <input type="text" maxLength={300} value={formState.address} onChange={(event) => setFormState((current) => ({ ...current, address: event.target.value }))} />
            </label>
            <label>
              Status
              <select value={formState.isActive ? 'active' : 'inactive'} onChange={(event) => setFormState((current) => ({ ...current, isActive: event.target.value === 'active' }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          {formError && <div className="empty-state error-state" role="alert">{formError}</div>}
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => { resetForm(); setIsFormOpen(false); }} disabled={submitting}>Cancel</button>
            <button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editingBranchId === null ? 'Create branch' : 'Save changes'}</button>
          </div>
        </form>
      )}
      {loading ? <div className="empty-state" role="status">Loading branches…</div>
        : error ? <div className="empty-state error-state" role="alert">{error}</div>
          : branches.length === 0 ? <div className="empty-state">No branches are available.</div>
            : (
              <div className="table-wrap">
                <table className="member-table">
                  <thead><tr><th>Branch</th><th>Code</th><th>Address</th><th>Status</th>{canManage && <th>Actions</th>}</tr></thead>
                  <tbody>{branches.map((branch) => (
                    <tr key={branch.id}>
                      <td>{branch.name}</td>
                      <td>{branch.code}</td>
                      <td>{branch.address || '—'}</td>
                      <td><span className={`status-tag ${branch.isActive ? 'active' : 'inactive'}`}>{branch.isActive ? 'Active' : 'Inactive'}</span></td>
                      {canManage && <td><button type="button" className="secondary-button" onClick={() => editBranch(branch)}>Edit</button></td>}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
    </div>
  );
}

function MembersPage({ token, canCreate, canEdit }: { token: string; canCreate: boolean; canEdit: boolean }) {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formState, setFormState] = useState({
    firstName: '',
    lastName: '',
    branchId: '',
    phoneNumber: '',
    nationalId: '',
    status: 'Active',
  });

  const loadBranches = useCallback(async () => {
    const response = await apiFetch(`${apiBaseUrl}/branches`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const envelope = (await response.json()) as ApiEnvelope<BranchOption[]>;
    if (!response.ok || !envelope.success || !envelope.data) {
      throw new Error(envelope.message || 'Unable to load branches.');
    }

    const branchOptions = envelope.data;
    setBranches(branchOptions);
    if (branchOptions.length > 0) {
      setFormState((current) => ({
        ...current,
        branchId: current.branchId || String(branchOptions[0].id),
      }));
    }
  }, [token]);

  useEffect(() => {
    const abortController = new AbortController();

    const loadMembers = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await apiFetch(`${apiBaseUrl}/members`, {
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
        if (canCreate) await loadBranches();
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
  }, [canCreate, loadBranches, reloadKey, token]);

  const visibleMembers = members.filter((member) => {
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query || [member.name, member.phoneNumber, member.nationalId, member.branch, member.branchCode]
      .some((value) => value?.toLocaleLowerCase().includes(query));
    return matchesSearch
      && (!branchFilter || String(member.branchId ?? '') === branchFilter)
      && (!statusFilter || member.status === statusFilter);
  });

  const resetForm = () => {
    setEditingMemberId(null);
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

  const handleSaveMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const payload = {
        firstName: formState.firstName.trim(),
        lastName: formState.lastName.trim(),
        phoneNumber: formState.phoneNumber.trim() || null,
        nationalId: formState.nationalId.trim() || null,
        status: formState.status || 'Active',
      };

      const isEditing = editingMemberId !== null;
      const response = await apiFetch(`${apiBaseUrl}/members${isEditing ? `/${editingMemberId}` : ''}`, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(isEditing ? payload : { ...payload, branchId: Number(formState.branchId) }),
      });

      const envelope = (await response.json()) as ApiEnvelope<MemberRecord>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || `Unable to ${isEditing ? 'update' : 'create'} member.`);
      }

      const savedMember = envelope.data;
      if (isEditing) {
        setMembers((current) => current.map((member) => member.id === savedMember.id ? savedMember : member));
      } else {
        setMembers((current) => [savedMember, ...current]);
      }
      setIsFormOpen(false);
      resetForm();
      setFormSuccess(isEditing ? 'Member updated successfully.' : 'Member added successfully.');
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Unable to save member.');
    } finally {
      setSubmitting(false);
    }
  };

  const editMember = (member: MemberRecord) => {
    setEditingMemberId(member.id);
    setFormState({
      firstName: member.firstName ?? member.name.split(' ')[0] ?? '',
      lastName: member.lastName ?? member.name.split(' ').slice(1).join(' '),
      branchId: String(member.branchId ?? ''),
      phoneNumber: member.phoneNumber ?? '',
      nationalId: member.nationalId ?? '',
      status: member.status,
    });
    setFormError('');
    setFormSuccess('');
    setIsFormOpen(true);
  };

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Members</h2>
          <p>Register members and review their branch, contact, and account status.</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="secondary-button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>Refresh</button>
          <button type="button" className="secondary-button" disabled={!visibleMembers.length} onClick={() => downloadCsv(
            'members.csv',
            ['ID', 'Name', 'Branch', 'Branch code', 'Status', 'Created'],
            visibleMembers.map((member) => [member.id, member.name, member.branch, member.branchCode, member.status, member.createdAt]),
          )}>Export CSV</button>
          {canCreate && <button
          type="button"
          onClick={() => {
            setFormError('');
            setFormSuccess('');
            resetForm();
            setIsFormOpen((current) => !current);
          }}
        >
          {isFormOpen ? 'Cancel' : 'Add member'}
          </button>}
        </div>
      </div>

      {formSuccess && <div className="empty-state success-state" role="status">{formSuccess}</div>}

      {isFormOpen && (canCreate || editingMemberId !== null) && (
        <form id="member-form" className="member-form" onSubmit={handleSaveMember}>
          <div className="member-form-grid">
            <label>
              First name
              <input type="text" minLength={2} maxLength={120} value={formState.firstName} onChange={(event) => setFormState((current) => ({ ...current, firstName: event.target.value }))} required />
            </label>
            <label>
              Last name
              <input type="text" minLength={2} maxLength={120} value={formState.lastName} onChange={(event) => setFormState((current) => ({ ...current, lastName: event.target.value }))} required />
            </label>
            {editingMemberId === null ? <label>
              Branch
              <select value={formState.branchId} onChange={(event) => setFormState((current) => ({ ...current, branchId: event.target.value }))} required disabled={branches.length === 0}>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>
                ))}
              </select>
            </label> : <label>Branch<input value={members.find((member) => member.id === editingMemberId)?.branch ?? ''} readOnly /></label>}
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
              <input type="tel" maxLength={20} value={formState.phoneNumber} onChange={(event) => setFormState((current) => ({ ...current, phoneNumber: event.target.value }))} />
            </label>
            <label>
              National ID
              <input type="text" maxLength={40} value={formState.nationalId} onChange={(event) => setFormState((current) => ({ ...current, nationalId: event.target.value }))} />
            </label>
          </div>

          {editingMemberId === null && branches.length === 0 && <p className="form-hint">A branch must be available before a member can be registered.</p>}
          {formError && <div className="empty-state error-state">{formError}</div>}

          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => { resetForm(); setIsFormOpen(false); }} disabled={submitting}>Cancel</button>
            <button type="submit" disabled={submitting || (editingMemberId === null && !formState.branchId)}>{submitting ? 'Saving…' : editingMemberId === null ? 'Save member' : 'Update member'}</button>
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
        <>
          <div className="list-filters">
            <label>Search members
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, phone, ID, or branch" />
            </label>
            <label>Branch
              <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
                <option value="">All branches</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            <label>Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {[...new Set(members.map((member) => member.status))].sort().map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <span className="filter-count">{visibleMembers.length} of {members.length} members</span>
          </div>
          {visibleMembers.length === 0 ? <div className="empty-state">No members match these filters.</div> : (
        <table className="member-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Branch</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Created</th>
              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visibleMembers.map((member) => (
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
                {canEdit && <td><button type="button" className="secondary-button" onClick={() => editMember(member)}>Edit</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
          )}
        </>
      )}
    </div>
  );
}

function SavingsPage({ token, canOpenAccount, canTransact }: { token: string; canOpenAccount: boolean; canTransact: boolean }) {
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [historyAccountId, setHistoryAccountId] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
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
  const visibleAccounts = accounts.filter((account) => {
    const query = accountSearch.trim().toLocaleLowerCase();
    return !query || [account.accountNumber, account.member, account.productName]
      .some((value) => value?.toLocaleLowerCase().includes(query));
  });

  useEffect(() => {
    const abortController = new AbortController();

    const loadAccounts = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await apiFetch(`${apiBaseUrl}/savings/accounts`, {
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

        if (canOpenAccount) {
        const memberResponse = await apiFetch(`${apiBaseUrl}/members`, {
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
  }, [canOpenAccount, reloadKey, token]);

  const openTransactionForm = (accountId: number, type: string) => {
    setSelectedAccountId(String(accountId));
    setTransactionForm({ type, amount: '' });
    setTransactionIdempotencyKey(window.crypto.randomUUID());
    setFormError('');
    setFormSuccess('');
    setTransactions([]);
    setHistoryAccountId(null);
    setHistoryError('');
    setTransactionFormOpen(true);
  };

  const loadTransactionHistory = async (accountId: number) => {
    setHistoryAccountId(accountId);
    setHistoryLoading(true);
    setHistoryError('');
    setTransactions([]);
    try {
      const response = await apiFetch(`${apiBaseUrl}/savings/accounts/${accountId}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const envelope = (await response.json()) as ApiEnvelope<SavingsTransaction[]>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || 'Unable to load transaction history.');
      }
      setTransactions(envelope.data);
    } catch (requestError) {
      setHistoryError(requestError instanceof Error ? requestError.message : 'Unable to load transaction history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/savings/accounts`, {
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
    const amount = Number(transactionForm.amount);
    const account = accounts.find((item) => item.id === Number(selectedAccountId));
    const formattedAmount = new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(amount);
    if (!window.confirm(`${transactionForm.type} ${formattedAmount} ${account ? `for ${account.accountNumber}` : 'to this account'}?`)) return;
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/savings/accounts/${selectedAccountId}/transactions`, {
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
          <p>Manage account balances, deposits, withdrawals, and transaction history.</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="secondary-button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>Refresh</button>
          <button type="button" className="secondary-button" disabled={!visibleAccounts.length} onClick={() => downloadCsv(
            'savings-accounts.csv',
            ['Account number', 'Member', 'Product', 'Balance', 'Minimum balance', 'Status'],
            visibleAccounts.map((account) => [account.accountNumber, account.member, account.productName, account.balance, account.minimumBalance, account.status]),
          )}>Export CSV</button>
          {canOpenAccount && <button type="button" onClick={() => { setFormError(''); setFormSuccess(''); setAccountFormOpen((current) => !current); }}>
            {accountFormOpen ? 'Close' : 'Open account'}
          </button>}
          {canTransact && <button type="button" onClick={() => accounts[0] && openTransactionForm(accounts[0].id, 'Deposit')} disabled={accounts.length === 0}>
            New deposit
          </button>}
        </div>
      </div>

      {formError && <div className="empty-state error-state">{formError}</div>}
      {formSuccess && <div className="empty-state success-state">{formSuccess}</div>}

      {accountFormOpen && canOpenAccount && (
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
          {members.filter((member) => member.status === 'Active').length === 0 && <p className="form-hint">An active member is required before opening an account.</p>}
          <div className="form-actions"><button type="submit" disabled={submitting || !accountForm.memberId || members.filter((member) => member.status === 'Active').length === 0}>{submitting ? 'Saving…' : 'Open savings account'}</button></div>
        </form>
      )}

      {transactionFormOpen && canTransact && (
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

      {!loading && !error && accounts.length > 0 && (
        <div className="list-filters">
          <label>Search accounts
            <input type="search" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Account number, member, or product" />
          </label>
          <span className="filter-count">{visibleAccounts.length} of {accounts.length} accounts</span>
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading savings accounts…</div>
      ) : error ? (
        <div className="empty-state error-state">{error}</div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">No savings accounts found.</div>
      ) : visibleAccounts.length === 0 ? (
        <div className="empty-state">No accounts match this search.</div>
      ) : (
        <div className="table-wrap"><table className="member-table">
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
            {visibleAccounts.map((account) => (
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
                    {canTransact && <button type="button" onClick={() => openTransactionForm(account.id, 'Deposit')}>Deposit</button>}
                    {canTransact && <button type="button" onClick={() => openTransactionForm(account.id, 'Withdrawal')}>Withdraw</button>}
                    <button type="button" onClick={() => void loadTransactionHistory(account.id)}>History</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      {historyAccountId !== null && (
        <section className="transaction-history">
          <div className="panel-header">
            <h3>Transaction history — {accounts.find((account) => account.id === historyAccountId)?.accountNumber ?? `account #${historyAccountId}`}</h3>
            <button type="button" className="secondary-button" onClick={() => setHistoryAccountId(null)}>Close</button>
          </div>
          {historyLoading ? <div className="empty-state" role="status">Loading transaction history…</div>
            : historyError ? <div className="empty-state error-state" role="alert">{historyError}</div>
              : transactions.length === 0 ? <div className="empty-state">No transactions recorded for this account.</div> : <table className="member-table">
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
          </table>}
        </section>
      )}
    </div>
  );
}

function LoansPage({ token, permissions }: { token: string; permissions: string[] }) {
  const canCreate = permissions.includes('Loans.Create');
  const canApprove = permissions.includes('Loans.Approve');
  const canDisburse = permissions.includes('Loans.Disburse');
  const canRepay = permissions.includes('Loans.Repay');
  const [loans, setLoans] = useState<LoanPortfolioItem[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [workflowMessage, setWorkflowMessage] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState<{ loanId: number; entries: LoanInstallment[] } | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleLoanLoadingId, setScheduleLoanLoadingId] = useState<number | null>(null);
  const [selectedLoanForPayment, setSelectedLoanForPayment] = useState<number | null>(null);
  const [paymentsForLoan, setPaymentsForLoan] = useState<{ loanId: number; entries: LoanPaymentRecord[] } | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [transitioningLoanId, setTransitioningLoanId] = useState<number | null>(null);
  const [loanSearch, setLoanSearch] = useState('');
  const [loanStatusFilter, setLoanStatusFilter] = useState('');
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentKey, setRepaymentKey] = useState('');
  const [repaymentSubmitting, setRepaymentSubmitting] = useState(false);
  const [formState, setFormState] = useState({
    memberId: '',
    productName: 'Business Loan',
    principalAmount: '50000',
    interestRate: '14',
    tenureMonths: '12',
    status: 'Pending',
  });
  const visibleLoans = loans.filter((loan) => {
    const query = loanSearch.trim().toLocaleLowerCase();
    return (!query || [loan.member, loan.product, loan.status].some((value) => value.toLocaleLowerCase().includes(query)))
      && (!loanStatusFilter || loan.status === loanStatusFilter);
  });

  const loadMembers = useCallback(async () => {
    const response = await apiFetch(`${apiBaseUrl}/members`, {
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
    if (memberList.length > 0) {
      setFormState((current) => ({
        ...current,
        memberId: current.memberId || String(memberList[0].id),
      }));
    }
  }, [token]);

  useEffect(() => {
    const abortController = new AbortController();

    const loadLoans = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await apiFetch(`${apiBaseUrl}/loans/portfolio`, {
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
        if (canCreate) await loadMembers();
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
  }, [canCreate, loadMembers, reloadKey, token]);

  const resetForm = () => {
    setFormState({
      memberId: members[0]?.id ? String(members[0].id) : '',
      productName: 'Business Loan',
      principalAmount: '50000',
      interestRate: '14',
      tenureMonths: '12',
      status: 'Pending',
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
        interestRate: Number(formState.interestRate) / 100,
        tenureMonths: Number(formState.tenureMonths),
        status: formState.status,
      };

      const response = await apiFetch(`${apiBaseUrl}/loans`, {
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

  const handleLoanTransition = async (loanId: number, transition: 'approve' | 'disburse') => {
    const action = transition === 'approve' ? 'Approve this loan application?' : 'Disburse this approved loan?';
    if (!window.confirm(action)) return;
    setWorkflowMessage('');
    setTransitioningLoanId(loanId);
    try {
      const response = await apiFetch(`${apiBaseUrl}/loans/${loanId}/${transition}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const envelope = (await response.json()) as ApiEnvelope<{
        id: number;
        status: string;
        disbursedAt?: string;
        outstandingBalance?: number;
      }>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || `Unable to ${transition} loan.`);
      }

      const updatedLoan = envelope.data;
      setLoans((current) => current.map((loan) => loan.id === loanId
        ? {
          ...loan,
          status: updatedLoan.status,
          disbursedAt: updatedLoan.disbursedAt ?? loan.disbursedAt,
          outstanding: updatedLoan.outstandingBalance ?? loan.outstanding,
        }
        : loan));
      setWorkflowMessage(envelope.message);
    } catch (requestError) {
      setWorkflowMessage(requestError instanceof Error ? requestError.message : `Unable to ${transition} loan.`);
    } finally {
      setTransitioningLoanId(null);
    }
  };

  const handleScheduleView = async (loanId: number) => {
    setScheduleLoading(true);
    setScheduleLoanLoadingId(loanId);
    setWorkflowMessage('');
    try {
      const response = await apiFetch(`${apiBaseUrl}/loans/${loanId}/schedule`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const envelope = (await response.json()) as ApiEnvelope<LoanInstallment[]>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || 'Unable to load repayment schedule.');
      }

      setSelectedSchedule({ loanId, entries: envelope.data });
    } catch (requestError) {
      setWorkflowMessage(requestError instanceof Error ? requestError.message : 'Unable to load repayment schedule.');
    } finally {
      setScheduleLoading(false);
      setScheduleLoanLoadingId(null);
    }
  };

  const handlePaymentHistory = async (loanId: number) => {
    setPaymentsLoading(true);
    setWorkflowMessage('');
    setPaymentsForLoan({ loanId, entries: [] });
    try {
      const response = await apiFetch(`${apiBaseUrl}/loans/${loanId}/payments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const envelope = (await response.json()) as ApiEnvelope<LoanPaymentRecord[]>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || 'Unable to load loan payment history.');
      }
      setPaymentsForLoan({ loanId, entries: envelope.data });
    } catch (requestError) {
      setPaymentsForLoan(null);
      setWorkflowMessage(requestError instanceof Error ? requestError.message : 'Unable to load loan payment history.');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleRepayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedLoanForPayment === null) {
      return;
    }

    const selectedLoan = loans.find((loan) => loan.id === selectedLoanForPayment);
    const formattedAmount = new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(Number(repaymentAmount));
    if (!window.confirm(`Post a repayment of ${formattedAmount} for ${selectedLoan?.member ?? `loan #${selectedLoanForPayment}`}?`)) return;

    setRepaymentSubmitting(true);
    setWorkflowMessage('');
    const key = repaymentKey || crypto.randomUUID();
    setRepaymentKey(key);
    try {
      const response = await apiFetch(`${apiBaseUrl}/loans/${selectedLoanForPayment}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: Number(repaymentAmount) }),
      });
      const envelope = (await response.json()) as ApiEnvelope<{
        loanId: number;
        amount: number;
        outstandingBalance: number;
        status: string;
      }>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || 'Unable to post repayment.');
      }

      setLoans((current) => current.map((loan) => loan.id === selectedLoanForPayment
        ? { ...loan, outstanding: envelope.data!.outstandingBalance, status: envelope.data!.status }
        : loan));
      let resultMessage = envelope.message;
      if (selectedSchedule?.loanId === selectedLoanForPayment) {
        try {
          const scheduleResponse = await apiFetch(`${apiBaseUrl}/loans/${selectedLoanForPayment}/schedule`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const scheduleEnvelope = (await scheduleResponse.json()) as ApiEnvelope<LoanInstallment[]>;
          if (!scheduleResponse.ok || !scheduleEnvelope.success || !scheduleEnvelope.data) {
            throw new Error(scheduleEnvelope.message || 'Unable to refresh the repayment schedule.');
          }
          setSelectedSchedule({ loanId: selectedLoanForPayment, entries: scheduleEnvelope.data });
        } catch (scheduleError) {
          const scheduleMessage = scheduleError instanceof Error
            ? scheduleError.message
            : 'Schedule refresh failed.';
          resultMessage = `${envelope.message} ${scheduleMessage}`;
        }
      }

      setWorkflowMessage(resultMessage);
      setRepaymentAmount('');
      setRepaymentKey('');
    } catch (requestError) {
      setWorkflowMessage(requestError instanceof Error ? requestError.message : 'Unable to post repayment.');
    } finally {
      setRepaymentSubmitting(false);
    }
  };

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Loans</h2>
          <p>Review loan applications, approval pipeline, disbursement, schedules, and repayments.</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="secondary-button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>Refresh</button>
          <button type="button" className="secondary-button" disabled={!visibleLoans.length} onClick={() => downloadCsv(
            'loan-portfolio.csv',
            ['ID', 'Member', 'Product', 'Principal', 'Outstanding', 'Interest rate', 'Status'],
            visibleLoans.map((loan) => [loan.id, loan.member, loan.product, loan.principalAmount, loan.outstanding, loan.interestRate, loan.status]),
          )}>Export CSV</button>
          {canCreate && <button
            type="button"
            onClick={() => {
              setFormError('');
              setFormSuccess('');
              setIsFormOpen((current) => !current);
              if (!isFormOpen) resetForm();
            }}
          >
            {isFormOpen ? 'Close' : 'Create loan'}
          </button>}
        </div>
      </div>

      {workflowMessage && <div className="empty-state" role="status">{workflowMessage}</div>}

      {isFormOpen && canCreate && (
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
              <input type="text" minLength={2} maxLength={120} value={formState.productName} onChange={(event) => setFormState((current) => ({ ...current, productName: event.target.value }))} required />
            </label>
            <label>
              Principal amount
              <input type="number" min="1" step="1000" value={formState.principalAmount} onChange={(event) => setFormState((current) => ({ ...current, principalAmount: event.target.value }))} required />
            </label>
            <label>
              Interest rate (%)
              <input type="number" min="0" max="100" step="0.01" value={formState.interestRate} onChange={(event) => setFormState((current) => ({ ...current, interestRate: event.target.value }))} required />
            </label>
            <label>
              Tenure (months)
              <input type="number" min="1" max="600" step="1" value={formState.tenureMonths} onChange={(event) => setFormState((current) => ({ ...current, tenureMonths: event.target.value }))} required />
            </label>
          </div>

          {members.length === 0 && <p className="form-hint">Create a member before applying for a loan.</p>}
          {formError && <div className="empty-state error-state">{formError}</div>}
          {formSuccess && <div className="empty-state success-state">{formSuccess}</div>}

          <div className="form-actions">
            <button type="submit" disabled={submitting || !formState.memberId || members.length === 0}>{submitting ? 'Saving…' : 'Save loan'}</button>
          </div>
        </form>
      )}

      {!loading && !error && loans.length > 0 && (
        <div className="list-filters">
          <label>Search loans
            <input type="search" value={loanSearch} onChange={(event) => setLoanSearch(event.target.value)} placeholder="Member, product, or status" />
          </label>
          <label>Status
            <select value={loanStatusFilter} onChange={(event) => setLoanStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {[...new Set(loans.map((loan) => loan.status))].sort().map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <span className="filter-count">{visibleLoans.length} of {loans.length} loans</span>
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading loan portfolio…</div>
      ) : error ? (
        <div className="empty-state error-state">{error}</div>
      ) : loans.length === 0 ? (
        <div className="empty-state">No loan records found.</div>
      ) : visibleLoans.length === 0 ? (
        <div className="empty-state">No loans match these filters.</div>
      ) : (
        <div className="table-wrap"><table className="member-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Product</th>
              <th>Principal</th>
              <th>Outstanding</th>
              <th>Rate</th>
              <th>Status</th>
              <th>Workflow</th>
            </tr>
          </thead>
          <tbody>
            {visibleLoans.map((loan) => (
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
                <td>{(loan.interestRate * 100).toFixed(2)}%</td>
                <td>
                  <span className={`status-tag ${loan.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {loan.status}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    {loan.status === 'Pending' && canApprove && (
                      <button type="button" disabled={transitioningLoanId === loan.id} onClick={() => void handleLoanTransition(loan.id, 'approve')}>
                        {transitioningLoanId === loan.id ? 'Approving…' : 'Approve'}
                      </button>
                    )}
                    {loan.status === 'Approved' && canDisburse && (
                      <button type="button" disabled={transitioningLoanId === loan.id} onClick={() => void handleLoanTransition(loan.id, 'disburse')}>
                        {transitioningLoanId === loan.id ? 'Disbursing…' : 'Disburse'}
                      </button>
                    )}
                    {(loan.status === 'Disbursed' || loan.status === 'Overdue') && loan.outstanding > 0 && canRepay && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLoanForPayment(loan.id);
                          setRepaymentAmount('');
                          setRepaymentKey('');
                        }}
                      >
                        Record payment
                      </button>
                    )}
                    <button type="button" disabled={scheduleLoading} onClick={() => void handleScheduleView(loan.id)}>
                      {scheduleLoanLoadingId === loan.id ? 'Loading…' : 'Schedule'}
                    </button>
                    <button type="button" className="secondary-button" disabled={paymentsLoading} onClick={() => void handlePaymentHistory(loan.id)}>Payments</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      {selectedLoanForPayment !== null && canRepay && (
        <form className="loan-form" onSubmit={handleRepayment}>
          <div className="panel-header">
            <h3>Record repayment — loan #{selectedLoanForPayment}</h3>
            <button type="button" onClick={() => setSelectedLoanForPayment(null)}>Cancel</button>
          </div>
          <label>
            Payment amount
            <input
              type="number"
              min="0.01"
              max={loans.find((loan) => loan.id === selectedLoanForPayment)?.outstanding ?? undefined}
              step="0.01"
              value={repaymentAmount}
              onChange={(event) => {
                setRepaymentAmount(event.target.value);
                setRepaymentKey('');
              }}
              required
            />
          </label>
          {workflowMessage && <div className="empty-state error-state" role="alert">{workflowMessage}</div>}
          <div className="form-actions">
            <button type="submit" disabled={repaymentSubmitting || !repaymentAmount || Number(repaymentAmount) <= 0}>
              {repaymentSubmitting ? 'Posting…' : 'Post repayment'}
            </button>
          </div>
        </form>
      )}
      {selectedSchedule && (
        <section className="panel">
          <div className="panel-header">
            <h3>Repayment schedule — loan #{selectedSchedule.loanId}</h3>
            <button type="button" onClick={() => setSelectedSchedule(null)}>Close</button>
          </div>
          {selectedSchedule.entries.length === 0 ? (
            <div className="empty-state">This loan has no saved installments.</div>
          ) : (
            <table className="member-table">
              <thead><tr><th>#</th><th>Due date</th><th>Principal</th><th>Interest</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead>
              <tbody>
                {selectedSchedule.entries.map((installment) => (
                  <tr key={installment.installmentNumber}>
                    <td>{installment.installmentNumber}</td>
                    <td>{installment.dueDate ? new Date(installment.dueDate).toLocaleDateString() : 'After disbursement'}</td>
                    <td>{new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(installment.principal)}</td>
                    <td>{new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(installment.interest)}</td>
                    <td>{new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(installment.total)}</td>
                    <td>{new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(installment.balance)}</td>
                    <td>{installment.status} (P {installment.principalPaid.toFixed(2)} / I {installment.interestPaid.toFixed(2)})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {paymentsForLoan && (
        <section className="panel">
          <div className="panel-header">
            <h3>Payment history — loan #{paymentsForLoan.loanId}</h3>
            <button type="button" className="secondary-button" onClick={() => setPaymentsForLoan(null)}>Close</button>
          </div>
          {paymentsLoading ? <div className="empty-state" role="status">Loading payment history…</div>
            : paymentsForLoan.entries.length === 0 ? <div className="empty-state">No repayments recorded.</div>
              : <div className="table-wrap"><table className="member-table">
                <thead><tr><th>Date</th><th>Amount</th><th>Principal</th><th>Interest</th></tr></thead>
                <tbody>{paymentsForLoan.entries.map((payment) => (
                  <tr key={payment.id}>
                    <td>{new Date(payment.createdAt).toLocaleString()}</td>
                    <td>{payment.amount.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</td>
                    <td>{payment.principalAmount.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</td>
                    <td>{payment.interestAmount.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}</tbody>
              </table></div>}
        </section>
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

        const response = await apiFetch(`${apiBaseUrl}/collections/sheets`, {
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
          <p>Preview only — collection sheets are not persisted by the API.</p>
        </div>
        <button type="button" disabled title="Collection sheet creation is not available yet">New sheet</button>
      </div>

      <div className="feature-callout" role="status">
        <strong>Example data only — not live collections</strong>
        <p>The API currently returns sample collection sheets. Creating sheets, posting payments, and reconciliation are not implemented.</p>
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
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();

    const loadTrialBalance = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await apiFetch(`${apiBaseUrl}/accounting/trial-balance`, {
          signal: abortController.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const envelope = (await response.json()) as ApiEnvelope<TrialBalance>;
        if (!response.ok || !envelope.success || !envelope.data) {
          throw new Error(envelope.message || 'Unable to load trial balance.');
        }

        setTrialBalance(envelope.data);
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
  }, [reloadKey, token]);

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Accounting</h2>
          <p>Review the current trial balance and reconciliation status.</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="secondary-button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>Refresh</button>
          <button type="button" disabled={!trialBalance?.accounts.length} onClick={() => downloadCsv(
            'trial-balance.csv',
            ['Code', 'Account', 'Type', 'Debit', 'Credit'],
            (trialBalance?.accounts ?? []).map((entry) => [entry.code, entry.account, entry.accountType, entry.debit, entry.credit]),
          )}>Export CSV</button>
        </div>
      </div>

      <div className="feature-callout" role="note">
        <strong>Read-only accounting</strong>
        <p>Manual journal entry and ledger editing are not implemented. This view only displays the backend trial balance.</p>
      </div>

      {loading ? (
        <div className="empty-state">Loading trial balance…</div>
      ) : error ? (
        <div className="empty-state error-state">{error}</div>
      ) : !trialBalance || trialBalance.accounts.length === 0 ? (
        <div className="empty-state">No accounting entries found.</div>
      ) : (
        <>
          <p className={trialBalance.isBalanced ? 'success-state' : 'error-state'}>
            {trialBalance.isBalanced ? 'Debits and credits are balanced.' : 'Trial balance is out of balance.'}
          </p>
          <table className="member-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th>Type</th>
                <th>Debit</th>
                <th>Credit</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.accounts.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.code}</td>
                  <td>{entry.account}</td>
                  <td>{entry.accountType}</td>
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
              <tr>
                <th colSpan={3}>Total</th>
                <th>{new Intl.NumberFormat('en-BD', {
                  style: 'currency',
                  currency: 'BDT',
                  maximumFractionDigits: 0,
                }).format(trialBalance.totalDebits)}</th>
                <th>{new Intl.NumberFormat('en-BD', {
                  style: 'currency',
                  currency: 'BDT',
                  maximumFractionDigits: 0,
                }).format(trialBalance.totalCredits)}</th>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function ReportsPage({ token }: { token: string }) {
  const [reports, setReports] = useState<{ code: FinancialReportResult['reportCode']; name: string; category: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportCode, setReportCode] = useState<FinancialReportResult['reportCode']>('trial-balance');
  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [toDate, setToDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [result, setResult] = useState<FinancialReportResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    const loadReports = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await apiFetch(`${apiBaseUrl}/reports/financial`, {
          signal: abortController.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const envelope = (await response.json()) as ApiEnvelope<{ code: FinancialReportResult['reportCode']; name: string; category: string }[]>;
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

  const handleRunReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await apiFetch(`${apiBaseUrl}/reports/financial/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportCode,
          fromDate: reportCode === 'income-statement' ? fromDate : null,
          toDate,
        }),
      });
      const envelope = (await response.json()) as ApiEnvelope<FinancialReportResult>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || 'Unable to generate report.');
      }
      setResult(envelope.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to generate report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Reports</h2>
          <p>Generate live reports from the journal data available to your account.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={!result?.accounts.length}
          onClick={() => downloadCsv(
            `${result?.reportCode ?? 'financial-report'}.csv`,
            ['Code', 'Account', 'Type', 'Debit', 'Credit', ...(result?.reportCode === 'income-statement' ? ['Balance'] : [])],
            (result?.accounts ?? []).map((account) => [
              account.code,
              account.account,
              account.accountType,
              account.debit,
              account.credit,
              ...(result?.reportCode === 'income-statement' ? [account.balance ?? 0] : []),
            ]),
          )}
        >Export CSV</button>
      </div>

      <form className="member-form" onSubmit={handleRunReport}>
        <div className="member-form-grid">
          <label>
            Financial report
            <select value={reportCode} onChange={(event) => setReportCode(event.target.value as FinancialReportResult['reportCode'])}>
              {reports.map((report) => <option key={report.code} value={report.code}>{report.name}</option>)}
            </select>
          </label>
          {reportCode === 'income-statement' && (
            <label>
              From
              <input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} required />
            </label>
          )}
          <label>
            {reportCode === 'trial-balance' ? 'As of date' : 'Through'}
            <input type="date" value={toDate} min={reportCode === 'income-statement' ? fromDate : undefined} required onChange={(event) => setToDate(event.target.value)} />
          </label>
        </div>
        {error && <div className="empty-state error-state" role="alert">{error}</div>}
        <div className="form-actions">
          <button type="submit" disabled={submitting || loading || reports.length === 0}>
            {submitting ? 'Generating…' : 'Generate report'}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="empty-state">Loading reports…</div>
      ) : reports.length === 0 ? (
        <div className="empty-state">No reports available.</div>
      ) : null}

      {result && (
        <section>
          <div className="panel-header">
            <div>
              <h3>{result.name}</h3>
              <p>{result.reportCode === 'trial-balance'
                ? `As of ${new Date(`${result.toDate}T00:00:00`).toLocaleDateString()}`
                : `${new Date(`${result.fromDate}T00:00:00`).toLocaleDateString()} – ${new Date(`${result.toDate}T00:00:00`).toLocaleDateString()}`}
                {' · '}{result.branchId === null ? 'All branches' : `Branch #${result.branchId}`}</p>
            </div>
          </div>
          {result.reportCode === 'trial-balance' && (
            <p className={result.isBalanced ? 'success-state' : 'error-state'}>
              {result.isBalanced ? 'Debits and credits are balanced.' : 'Trial balance is out of balance.'}
              {' '}Debits: {(result.totalDebits ?? 0).toLocaleString('en-BD', { style: 'currency', currency: 'BDT' })}
              {' · '}Credits: {(result.totalCredits ?? 0).toLocaleString('en-BD', { style: 'currency', currency: 'BDT' })}
            </p>
          )}
          {result.reportCode === 'income-statement' && (
            <p className="success-state">
              Income: {(result.totalIncome ?? 0).toLocaleString('en-BD', { style: 'currency', currency: 'BDT' })}
              {' · '}Expenses: {(result.totalExpenses ?? 0).toLocaleString('en-BD', { style: 'currency', currency: 'BDT' })}
              {' · '}Net income: {(result.netIncome ?? 0).toLocaleString('en-BD', { style: 'currency', currency: 'BDT' })}
            </p>
          )}
          <div className="table-wrap">
            <table className="member-table">
              <thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Debit</th><th>Credit</th>{result.reportCode === 'income-statement' && <th>Balance</th>}</tr></thead>
              <tbody>
                {result.accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.code}</td>
                    <td>{account.account}</td>
                    <td>{account.accountType}</td>
                    <td>{account.debit.toLocaleString('en-BD', { style: 'currency', currency: 'BDT' })}</td>
                    <td>{account.credit.toLocaleString('en-BD', { style: 'currency', currency: 'BDT' })}</td>
                    {result.reportCode === 'income-statement' && <td>{(account.balance ?? 0).toLocaleString('en-BD', { style: 'currency', currency: 'BDT' })}</td>}
                  </tr>
                ))}
                {result.accounts.length === 0 && <tr><td colSpan={result.reportCode === 'income-statement' ? 6 : 5}>No posted journal activity found for this report.</td></tr>}
              </tbody>
            </table>
          </div>
          {result.reportCode === 'income-statement' && result.accounts.every((account) => account.accountType !== 'Expense') && (
            <div className="feature-callout" role="note">
              <strong>No posted expense activity found for this period</strong>
              <p>This result includes posted income activity only. Confirm expense accounts and postings are configured before treating net income as complete.</p>
            </div>
          )}
        </section>
      )}

    </div>
  );
}

function AuditPage({ token }: { token: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();

    const loadAuditEntries = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await apiFetch(`${apiBaseUrl}/audit/logs`, {
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
  }, [reloadKey, token]);

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Audit</h2>
          <p>Review recorded user activity and workflow outcomes.</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="secondary-button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>Refresh</button>
          <button type="button" disabled={!entries.length} onClick={() => downloadCsv(
            'audit-log.csv',
            ['Actor', 'Action', 'Module', 'Outcome', 'Time'],
            entries.map((entry) => [entry.actor, entry.action, entry.module, entry.outcome, entry.time]),
          )}>Export CSV</button>
        </div>
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

function SettingsPage({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    const abortController = new AbortController();

    const loadSettings = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await apiFetch(`${apiBaseUrl}/settings/system`, {
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

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordSubmitting(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/auth/change-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const envelope = (await response.json()) as ApiEnvelope<{ signInRequired: boolean }>;
      if (!response.ok || !envelope.success || !envelope.data) {
        throw new Error(envelope.message || 'Unable to change password.');
      }

      setPasswordSuccess(envelope.message);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      window.setTimeout(onLogout, 1200);
    } catch (requestError) {
      setPasswordError(requestError instanceof Error ? requestError.message : 'Unable to change password.');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Settings</h2>
          <p>View system defaults and change your password.</p>
        </div>
        <span className="read-only-label">System defaults are read-only</span>
      </div>

      <div className="feature-callout" role="status">
        <strong>System configuration updates are not available</strong>
        <p>The values below are informational defaults. Use Security administration to manage roles and permissions.</p>
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

      <section className="password-change-section">
        <h3>Change password</h3>
        <p>Use at least 12 characters with uppercase, lowercase, a number, and a symbol. Changing your password signs out existing sessions.</p>
        <form className="password-change-form" onSubmit={handlePasswordChange}>
          <label>
            Current password
            <input type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} required maxLength={256} />
          </label>
          <label>
            New password
            <input type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} required minLength={12} maxLength={256} />
          </label>
          <label>
            Confirm new password
            <input type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} required minLength={12} maxLength={256} />
          </label>
          {passwordError && <div className="empty-state error-state" role="alert">{passwordError}</div>}
          {passwordSuccess && <div className="empty-state success-state" role="status">{passwordSuccess}</div>}
          <div className="form-actions">
            <button type="submit" disabled={passwordSubmitting}>{passwordSubmitting ? 'Updating…' : 'Change password'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default App;
