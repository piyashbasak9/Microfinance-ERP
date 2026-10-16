import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
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
        setAuthError(requestError instanceof Error ? requestError.message : 'Unable to restore your session.');
      } finally {
        setIsInitializing(false);
      }
    };

    void initializeSession();
    return () => abortController.abort();
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
    void fetch(`${apiBaseUrl}/auth/logout`, {
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
          <Route path="/dashboard" element={renderProtectedPage('Dashboard.Read', <DashboardPage token={session?.token ?? ''} />)} />
          <Route path="/members" element={renderProtectedPage('Members.Read', <MembersPage token={session?.token ?? ''} />)} />
          <Route path="/savings" element={renderProtectedPage('Savings.Read', <SavingsPage token={session?.token ?? ''} />)} />
          <Route path="/loans" element={renderProtectedPage('Loans.Read', <LoansPage token={session?.token ?? ''} />)} />
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
  const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
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

  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !envelope.success || !envelope.data) {
    throw new Error(envelope.message || 'The security request failed.');
  }
  return envelope.data;
}

function AppLayout({ children, user, token, permissions, onLogout }: { children?: ReactNode; user: AuthenticatedUser; token: string; permissions: string[]; onLogout: () => void }) {
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
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
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
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
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
                <h3>Recent members</h3>
                <a href="/members">View all</a>
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
                <a href="/collections">Open module</a>
              </div>
              <div className="empty-state">
                Collection totals will be available after collection posting is implemented.
              </div>
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

  const loadBranches = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/branches`, {
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
  }, [loadBranches, token]);

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
  const [workflowMessage, setWorkflowMessage] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState<{ loanId: number; entries: LoanInstallment[] } | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [selectedLoanForPayment, setSelectedLoanForPayment] = useState<number | null>(null);
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

  const loadMembers = useCallback(async () => {
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
  }, [loadMembers, token]);

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

  const handleLoanTransition = async (loanId: number, transition: 'approve' | 'disburse') => {
    setWorkflowMessage('');
    try {
      const response = await fetch(`${apiBaseUrl}/loans/${loanId}/${transition}`, {
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
    }
  };

  const handleScheduleView = async (loanId: number) => {
    setScheduleLoading(true);
    setWorkflowMessage('');
    try {
      const response = await fetch(`${apiBaseUrl}/loans/${loanId}/schedule`, {
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
    }
  };

  const handleRepayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedLoanForPayment === null) {
      return;
    }

    setRepaymentSubmitting(true);
    setWorkflowMessage('');
    const key = repaymentKey || crypto.randomUUID();
    setRepaymentKey(key);
    try {
      const response = await fetch(`${apiBaseUrl}/loans/${selectedLoanForPayment}/payments`, {
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
          const scheduleResponse = await fetch(`${apiBaseUrl}/loans/${selectedLoanForPayment}/schedule`, {
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

      {workflowMessage && <div className="empty-state">{workflowMessage}</div>}

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
              <input type="number" min="0" max="100" step="0.01" value={formState.interestRate} onChange={(event) => setFormState((current) => ({ ...current, interestRate: event.target.value }))} required />
            </label>
            <label>
              Tenure (months)
              <input type="number" min="1" step="1" value={formState.tenureMonths} onChange={(event) => setFormState((current) => ({ ...current, tenureMonths: event.target.value }))} required />
            </label>
            <label>
              Status
              <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}>
                <option value="Pending">Pending</option>
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
              <th>Workflow</th>
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
                <td>{(loan.interestRate * 100).toFixed(2)}%</td>
                <td>
                  <span className={`status-tag ${loan.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {loan.status}
                  </span>
                </td>
                <td>
                  {loan.status === 'Pending' && (
                    <button type="button" onClick={() => void handleLoanTransition(loan.id, 'approve')}>Approve</button>
                  )}
                  {loan.status === 'Approved' && (
                    <button type="button" onClick={() => void handleLoanTransition(loan.id, 'disburse')}>Disburse</button>
                  )}
                  {(loan.status === 'Disbursed' || loan.status === 'Overdue') && (
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
                    {scheduleLoading && selectedSchedule?.loanId === loan.id ? 'Loading…' : 'Schedule'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {selectedLoanForPayment !== null && (
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
          <div className="form-actions">
            <button type="submit" disabled={repaymentSubmitting}>
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
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
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
  }, [token]);

  return (
    <div className="page-card panel">
      <div className="page-toolbar">
        <div>
          <h2>Accounting</h2>
          <p>Review the live trial balance, ledger movements, and reconciliation status.</p>
        </div>
        <button type="button" disabled title="Manual journal entry is not available yet">
          Post entry
        </button>
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
      const response = await fetch(`${apiBaseUrl}/auth/change-password`, {
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
