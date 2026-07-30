"use client";

import {
  Badge,
  Banner,
  Button,
  Code,
  Dialog,
  Empty,
  Input,
  InputArea,
  LayerCard,
  Meter,
  Select,
  Sidebar,
  Surface,
  Table,
  Text,
} from "@cloudflare/kumo";
import {
  ActivityIcon,
  ArrowClockwiseIcon,
  ChartLineIcon,
  CheckCircleIcon,
  GaugeIcon,
  KeyIcon,
  LockKeyIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  QuestionIcon,
  SignOutIcon,
  SlidersHorizontalIcon,
  TerminalWindowIcon,
  UserCircleIcon,
  UserPlusIcon,
  UsersIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import {
  createContext,
  FormEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Organization = {
  id: string;
  name: string;
  type?: string;
};

type OrganizationUser = {
  id: string;
  name?: string;
  email_address?: string;
  role: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_at?: string;
  expires_at?: string;
};

type Workspace = {
  id: string;
  name: string;
  archived_at?: string | null;
  display_color?: string;
};

type ApiKey = {
  id: string;
  name: string;
  status: string;
  partial_key_hint?: string;
  workspace_id?: string;
  created_at?: string;
  expires_at?: string | null;
};

type RateLimit = {
  type?: string;
  group_type?: string;
  models?: string[];
  limits?: Array<{ type: string; value: number; org_limit?: number }>;
};

type SpendLimit = {
  actor?: {
    name?: string;
    email_address?: string;
    user_id?: string;
  };
  amount?: string | null;
  currency?: string;
  period?: string;
  period_to_date_spend?: string;
  spend_limit_id?: string;
};

type IncreaseRequest = {
  id: string;
  status: string;
  actor?: {
    name?: string;
    email_address?: string;
    user_id?: string;
  };
  spend_summary?: {
    amount?: string | null;
    period_to_date_spend?: string;
  };
};

type Activity = {
  id?: string;
  type?: string;
  created_at?: string;
  actor?: { name?: string; email?: string; email_address?: string };
  organization_uuid?: string;
};

type ClaudeCodeRecord = {
  actor?: {
    email_address?: string;
    api_key_name?: string;
  };
  num_sessions?: number;
  lines_of_code?: { added?: number; removed?: number };
  commits_by_claude_code?: number;
  pull_requests_by_claude_code?: number;
};

type ListResponse<T> = {
  data: T[];
  has_more?: boolean;
  next_page?: string | null;
};

type DashboardData = {
  users: OrganizationUser[];
  invites: Invite[];
  workspaces: Workspace[];
  apiKeys: ApiKey[];
  rateLimits: RateLimit[];
  spendLimits: SpendLimit[];
  increaseRequests: IncreaseRequest[];
  activities: Activity[];
  claudeCode: ClaudeCodeRecord[];
  usage: unknown;
  cost: unknown;
};

export type Section =
  | "overview"
  | "members"
  | "invites"
  | "workspaces"
  | "keys"
  | "usage"
  | "limits"
  | "audit"
  | "explorer";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const emptyData: DashboardData = {
  users: [],
  invites: [],
  workspaces: [],
  apiKeys: [],
  rateLimits: [],
  spendLimits: [],
  increaseRequests: [],
  activities: [],
  claudeCode: [],
  usage: null,
  cost: null,
};

const navigation: Array<{
  value: Section;
  label: string;
  icon: Icon;
  group: "pilot" | "manage" | "observe";
}> = [
  { value: "overview", label: "Overview", icon: GaugeIcon, group: "pilot" },
  { value: "usage", label: "Usage & costs", icon: ChartLineIcon, group: "pilot" },
  { value: "limits", label: "Limits", icon: SlidersHorizontalIcon, group: "pilot" },
  { value: "members", label: "Members", icon: UsersIcon, group: "manage" },
  { value: "invites", label: "Invitations", icon: UserPlusIcon, group: "manage" },
  { value: "workspaces", label: "Workspaces", icon: TerminalWindowIcon, group: "manage" },
  { value: "keys", label: "API keys", icon: KeyIcon, group: "manage" },
  { value: "audit", label: "Activity", icon: ActivityIcon, group: "observe" },
  { value: "explorer", label: "API Explorer", icon: TerminalWindowIcon, group: "observe" },
];

const roleItems = {
  user: "User",
  claude_code_user: "Claude Code",
  developer: "Developer",
  billing: "Billing",
  admin: "Administrator",
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;

  if (!response.ok) {
    throw new ApiError(body.error ?? `HTTP ${response.status}`, response.status);
  }

  return body;
}

function adminFetch<T>(path: string, init?: RequestInit) {
  return jsonFetch<T>(`/api/admin/${path}`, init);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatMoneyFromCents(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "Unlimited";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100);
}

function recursiveFieldSum(value: unknown, fields: Set<string>): number {
  if (Array.isArray(value)) {
    return value.reduce((sum, child) => sum + recursiveFieldSum(child, fields), 0);
  }

  if (!value || typeof value !== "object") return 0;

  return Object.entries(value).reduce((sum, [key, child]) => {
    if (fields.has(key)) {
      const numeric = Number(child);
      return sum + (Number.isFinite(numeric) ? numeric : 0);
    }
    return sum + recursiveFieldSum(child, fields);
  }, 0);
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <Text as="h1" variant="heading1">
          {title}
        </Text>
        <Text variant="secondary">{description}</Text>
      </div>
      {action}
    </div>
  );
}

function ConfirmAction({
  label,
  title,
  description,
  onConfirm,
  destructive = true,
}: {
  label: string;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  destructive?: boolean;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        render={(props) => (
          <Button
            {...props}
            size="xs"
            variant={destructive ? "secondary-destructive" : "secondary"}
          >
            {label}
          </Button>
        )}
      />
      <Dialog className="dialog-content" size="base">
        <div className="dialog-heading">
          <div>
            <Dialog.Title>
              <Text as="h2" variant="heading3">
                {title}
              </Text>
            </Dialog.Title>
            <Dialog.Description>
              <Text variant="secondary">{description}</Text>
            </Dialog.Description>
          </div>
          <Dialog.Close
            render={(props) => (
              <Button
                {...props}
                aria-label="Close"
                icon={<XIcon size={16} />}
                shape="square"
                size="sm"
                variant="ghost"
              />
            )}
          />
        </div>
        <div className="dialog-actions">
          <Dialog.Close
            render={(props) => (
              <Button {...props} variant="secondary">
                Cancel
              </Button>
            )}
          />
          <Dialog.Close
            render={(props) => (
              <Button
                {...props}
                onClick={() => void onConfirm()}
                variant={destructive ? "destructive" : "primary"}
              >
                Confirm
              </Button>
            )}
          />
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

function Login({
  onAuthenticated,
}: {
  onAuthenticated: (organization: Organization) => void;
}) {
  const [adminKey, setAdminKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await jsonFetch<{
        organization: Organization;
      }>("/api/session", {
        method: "POST",
        body: JSON.stringify({ adminKey }),
      });
      setAdminKey("");
      onAuthenticated(result.organization);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <LayerCard className="login-card">
        <LayerCard.Secondary className="login-card-top">
          <div className="login-brand">
            <img
              alt="Logo TokAPI"
              className="tokapi-logo"
              height={32}
              src="/tokapi-logo-tight.png"
              width={32}
            />
            <Text as="span" bold>
              TokAPI
            </Text>
          </div>
          <Badge variant="beta">Admin API</Badge>
        </LayerCard.Secondary>
        <LayerCard.Primary className="login-card-main">
          <Text as="h1" variant="heading1">
            Claude Admin
          </Text>
          <Text variant="secondary">
            Connect your organization with an Anthropic Admin key.
          </Text>

          <form className="login-form" onSubmit={submit}>
            <Input
              autoComplete="off"
              description="The key is validated with Anthropic, then encrypted in an HttpOnly cookie for 8 hours."
              label="Admin key"
              onChange={(event) => setAdminKey(event.target.value)}
              passwordManagerIgnore
              placeholder="sk-ant-admin…"
              required
              type="password"
              value={adminKey}
            />
            {error ? (
              <Banner
                description={error}
                icon={<WarningCircleIcon size={18} weight="fill" />}
                size="sm"
                title="Sign-in denied"
                variant="error"
              />
            ) : null}
            <Button
              disabled={!adminKey}
              loading={loading}
              type="submit"
              variant="primary"
            >
              Open console
            </Button>
          </form>

          <Banner
            description="Use a dedicated key with the minimum required scopes. The key is never sent back to the browser after sign-in."
            icon={<LockKeyIcon size={18} weight="fill" />}
            size="sm"
            title="Secure session"
            variant="secondary"
          />
        </LayerCard.Primary>
      </LayerCard>
    </main>
  );
}

type AdminContextValue = {
  organization: Organization | null;
  data: DashboardData;
  loading: boolean;
  refreshing: boolean;
  notice: string;
  error: string;
  capabilityErrors: string[];
  authenticate: (organization: Organization) => void;
  loadData: () => Promise<void>;
  mutate: (
    path: string,
    method: "POST" | "DELETE",
    body?: unknown,
    success?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [capabilityErrors, setCapabilityErrors] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(now.getUTCDate() - 7);
    const yesterday = new Date(now);
    yesterday.setUTCDate(now.getUTCDate() - 1);
    const usageQuery = new URLSearchParams({
      starting_at: sevenDaysAgo.toISOString(),
      ending_at: now.toISOString(),
      bucket_width: "1d",
      limit: "31",
    });
    usageQuery.append("group_by[]", "model");
    const costQuery = new URLSearchParams({
      starting_at: sevenDaysAgo.toISOString(),
      ending_at: now.toISOString(),
      limit: "31",
    });

    const requests = {
      users: "organizations/users?limit=100",
      invites: "organizations/invites?limit=100",
      workspaces: "organizations/workspaces?limit=100&include_archived=true",
      apiKeys: "organizations/api_keys?limit=100",
      rateLimits: "organizations/rate_limits",
      spendLimits: "organizations/spend_limits/effective?limit=100",
      increaseRequests:
        "organizations/spend_limit_increase_requests?status[]=pending&limit=100",
      activities: "compliance/activities?limit=20",
      claudeCode: `organizations/usage_report/claude_code?starting_at=${yesterday
        .toISOString()
        .slice(0, 10)}&limit=100`,
      usage: `organizations/usage_report/messages?${usageQuery}`,
      cost: `organizations/cost_report?${costQuery}`,
    } as const;

    const results = await Promise.all(
      Object.entries(requests).map(async ([key, path]) => {
        try {
          return [key, await adminFetch<unknown>(path), null] as const;
        } catch (caught) {
          return [
            key,
            null,
            caught instanceof Error ? caught.message : "Unavailable",
          ] as const;
        }
      }),
    );

    const next = { ...emptyData };
    const unavailable: string[] = [];
    for (const [key, result, requestError] of results) {
      if (requestError) {
        unavailable.push(`${key}: ${requestError}`);
        continue;
      }

      if (key === "usage" || key === "cost") {
        next[key] = result;
      } else {
        (next[key as keyof Omit<DashboardData, "usage" | "cost">] as unknown[]) =
          ((result as { data?: unknown[] })?.data ?? []);
      }
    }

    setData(next);
    setCapabilityErrors(unavailable);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const session = await jsonFetch<{
          authenticated: boolean;
          organization: Organization;
        }>("/api/session");
        setOrganization(session.organization);
        await loadData();
      } catch {
        setOrganization(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadData]);

  async function mutate(
    path: string,
    method: "POST" | "DELETE",
    body?: unknown,
    success = "Changes saved.",
  ) {
    setError("");
    setNotice("");
    try {
      await adminFetch(path, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      setNotice(success);
      await loadData();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to complete the action.";
      setError(message);
      if (caught instanceof ApiError && caught.status === 401) {
        setOrganization(null);
      }
    }
  }

  async function logout() {
    await jsonFetch("/api/session", { method: "DELETE" });
    setOrganization(null);
    setData(emptyData);
  }

  return (
    <AdminContext.Provider
      value={{
        organization,
        data,
        loading,
        refreshing,
        notice,
        error,
        capabilityErrors,
        authenticate: (authenticatedOrganization) => {
          setOrganization(authenticatedOrganization);
          void loadData();
        },
        loadData,
        mutate,
        logout,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("AdminShell must be rendered inside AdminProvider.");
  }
  return context;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const {
    organization,
    loading,
    refreshing,
    notice,
    error,
    capabilityErrors,
    authenticate,
    loadData,
    logout,
  } = useAdmin();
  const [navigationQuery, setNavigationQuery] = useState("");
  const pathname = usePathname();
  const activeSection =
    navigation.find((item) => pathname === `/${item.value}`)?.value ?? "overview";

  if (loading) {
    return (
      <main className="loading-shell">
        <Empty
          icon={<ArrowClockwiseIcon className="spin" size={36} />}
          title="Connecting to session"
          description="Verifying the encrypted Admin key."
        />
      </main>
    );
  }

  if (!organization) {
    return (
      <Login
        onAuthenticated={authenticate}
      />
    );
  }

  return (
    <Sidebar.Provider
      collapsible="icon"
      defaultWidth={260}
      defaultOpen
      mobileBreakpoint={820}
    >
      <Sidebar className="tokapi-sidebar">
        <Sidebar.Header className="tokapi-sidebar-header">
          <div className="brand-lockup">
            <img
              alt="Logo TokAPI"
              className="tokapi-logo"
              height={32}
              src="/tokapi-logo-tight.png"
              width={32}
            />
            <Text as="span" bold>
              TokAPI
            </Text>
          </div>
          <Sidebar.Trigger aria-label="Toggle sidebar" />
        </Sidebar.Header>
        <Sidebar.Content className="tokapi-sidebar-content">
          <div className="sidebar-search">
            <MagnifyingGlassIcon aria-hidden size={15} />
            <Input
              aria-label="Search navigation"
              onChange={(event) => setNavigationQuery(event.target.value)}
              placeholder="Quick search..."
              size="sm"
              value={navigationQuery}
            />
            <span aria-hidden>⌘K</span>
          </div>
          <NavigationGroup
            active={activeSection}
            group="pilot"
            label=""
            query={navigationQuery}
          />
          <NavigationGroup
            active={activeSection}
            group="manage"
            label="Organization"
            query={navigationQuery}
          />
          <NavigationGroup
            active={activeSection}
            group="observe"
            label="System"
            query={navigationQuery}
          />
        </Sidebar.Content>
        <Sidebar.Footer className="tokapi-sidebar-footer">
          <Button
            className="account-button"
            icon={<UserCircleIcon size={17} />}
            variant="ghost"
          >
            <Text as="span" bold truncate>
              {organization.name}
            </Text>
          </Button>
          <Button
            aria-label="Sign out"
            icon={<SignOutIcon size={16} />}
            onClick={() => void logout()}
            shape="square"
            size="sm"
            variant="ghost"
          />
        </Sidebar.Footer>
      </Sidebar>

      <main className="console-main">
        <header className="console-topbar">
          <div className="mobile-sidebar-trigger">
            <Sidebar.Trigger />
          </div>
          <div className="console-topbar-status">
            <Button icon={<QuestionIcon size={16} />} size="sm" variant="ghost">
              Support
            </Button>
            <Badge appearance="dot" variant="success">
              Admin
            </Badge>
            <Button
              aria-label="Refresh"
              icon={<ArrowClockwiseIcon className={refreshing ? "spin" : ""} size={16} />}
              loading={refreshing}
              onClick={() => void loadData()}
              shape="square"
              size="sm"
              variant="ghost"
            />
          </div>
        </header>

        <div className="console-content">
          {notice ? (
            <Banner
              description={notice}
              icon={<CheckCircleIcon size={18} weight="fill" />}
              size="sm"
              title="Complete"
            />
          ) : null}
          {error ? (
            <Banner
              description={error}
              icon={<WarningCircleIcon size={18} weight="fill" />}
              size="sm"
              title="Action failed"
              variant="error"
            />
          ) : null}
          {capabilityErrors.length ? (
            <Banner
              description={`${capabilityErrors.length} data source(s) are unavailable with this key's scopes. The other modules remain available.`}
              icon={<WarningCircleIcon size={18} weight="fill" />}
              size="sm"
              title="Partial access"
              variant="secondary"
            />
          ) : null}

          {children}
        </div>
      </main>
    </Sidebar.Provider>
  );
}

export function AdminSection({ section }: { section: Section }) {
  const { organization, data, mutate } = useAdmin();

  if (!organization) return null;

  return (
    <>
      {section === "overview" ? (
        <Overview data={data} organization={organization} />
      ) : null}
      {section === "members" ? <Members data={data} mutate={mutate} /> : null}
      {section === "invites" ? <Invites data={data} mutate={mutate} /> : null}
      {section === "workspaces" ? (
        <Workspaces data={data} mutate={mutate} />
      ) : null}
      {section === "keys" ? <ApiKeys data={data} mutate={mutate} /> : null}
      {section === "usage" ? <Usage data={data} /> : null}
      {section === "limits" ? <Limits data={data} mutate={mutate} /> : null}
      {section === "audit" ? <Audit data={data} /> : null}
      {section === "explorer" ? <ApiExplorer /> : null}
    </>
  );
}

function NavigationGroup({
  group,
  label,
  active,
  query,
}: {
  group: "pilot" | "manage" | "observe";
  label: string;
  active: Section;
  query: string;
}) {
  const items = navigation.filter(
    (item) =>
      item.group === group &&
      item.label.toLocaleLowerCase("en").includes(query.trim().toLocaleLowerCase("en")),
  );

  if (!items.length) return null;

  return (
    <Sidebar.Group>
      {label ? <Sidebar.GroupLabel>{label}</Sidebar.GroupLabel> : null}
      <Sidebar.Menu>
        {items.map((item) => (
            <Sidebar.MenuButton
              active={active === item.value}
              href={`/${item.value}`}
              icon={item.icon}
              key={item.value}
              tooltip={item.label}
            >
              {item.label}
            </Sidebar.MenuButton>
          ))}
      </Sidebar.Menu>
    </Sidebar.Group>
  );
}

function Overview({
  data,
  organization,
}: {
  data: DashboardData;
  organization: Organization;
}) {
  const totalTokens = recursiveFieldSum(
    data.usage,
    new Set([
      "uncached_input_tokens",
      "cache_read_input_tokens",
      "cache_creation_input_tokens",
      "output_tokens",
    ]),
  );
  const totalCost = recursiveFieldSum(data.cost, new Set(["amount"]));
  const pendingInvites = data.invites.filter(
    (invite) => invite.status === "pending",
  ).length;

  return (
    <>
      <SectionHeader
        title={organization.name}
        description="Organization status and activity over the last seven days."
      />
      <section className="metric-grid">
        <Surface className="metric-surface">
          <Text size="sm" variant="secondary">
            Members
          </Text>
          <Text as="span" variant="heading2">
            {data.users.length}
          </Text>
          <Badge variant="neutral">{pendingInvites} pending invitation(s)</Badge>
        </Surface>
        <Surface className="metric-surface">
          <Text size="sm" variant="secondary">
            Workspaces
          </Text>
          <Text as="span" variant="heading2">
            {data.workspaces.filter((workspace) => !workspace.archived_at).length}
          </Text>
          <Badge variant="blue">active</Badge>
        </Surface>
        <Surface className="metric-surface">
          <Text size="sm" variant="secondary">
            Tokens · 7 days
          </Text>
          <Text as="span" variant="heading2">
            {new Intl.NumberFormat("en-US", {
              notation: "compact",
            }).format(totalTokens)}
          </Text>
          <Badge variant="purple">messages</Badge>
        </Surface>
        <Surface className="metric-surface">
          <Text size="sm" variant="secondary">
            Cost · 7 days
          </Text>
          <Text as="span" variant="heading2">
            {formatMoneyFromCents(totalCost)}
          </Text>
          <Badge variant="green">USD</Badge>
        </Surface>
      </section>

      <section className="two-column">
        <Surface className="panel">
          <Text as="h2" variant="heading3">
            Organization limits
          </Text>
          <Text variant="secondary">
            First rate-limit groups returned by Anthropic.
          </Text>
          <div className="meter-stack">
            {data.rateLimits.slice(0, 4).flatMap((group) =>
              (group.limits ?? []).slice(0, 1).map((limit) => (
                <Meter
                  customValue={new Intl.NumberFormat("en-US", {
                    notation: "compact",
                  }).format(limit.value)}
                  key={`${group.group_type}-${limit.type}`}
                  label={`${group.models?.join(", ") ?? group.group_type ?? "Group"} · ${limit.type}`}
                  max={limit.value}
                  value={limit.value}
                />
              )),
            )}
            {!data.rateLimits.length ? (
              <Empty
                size="sm"
                title="No limits available"
                description="The key may not have the required scope."
              />
            ) : null}
          </div>
        </Surface>

        <Surface className="panel">
          <Text as="h2" variant="heading3">
            API keys
          </Text>
          <Text variant="secondary">
            Status of the organization's application keys.
          </Text>
          <div className="key-summary">
            <div>
              <Text as="span" variant="heading2">
                {data.apiKeys.filter((key) => key.status === "active").length}
              </Text>
              <Text size="sm" variant="secondary">
                active
              </Text>
            </div>
            <div>
              <Text as="span" variant="heading2">
                {data.apiKeys.filter((key) => key.status !== "active").length}
              </Text>
              <Text size="sm" variant="secondary">
                inactive
              </Text>
            </div>
          </div>
        </Surface>
      </section>
    </>
  );
}

function Members({
  data,
  mutate,
}: {
  data: DashboardData;
  mutate: (
    path: string,
    method: "POST" | "DELETE",
    body?: unknown,
    success?: string,
  ) => Promise<void>;
}) {
  return (
    <>
      <SectionHeader
        title="Members"
        description="Organization roles and access lifecycle."
      />
      <Surface className="table-panel">
        {data.users.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Member</Table.Head>
                <Table.Head>Role</Table.Head>
                <Table.Head>ID</Table.Head>
                <Table.Head>Action</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.users.map((user) => (
                <Table.Row key={user.id}>
                  <Table.Cell>
                    <Text bold>{user.name ?? user.email_address ?? "Member"}</Text>
                    <Text size="xs" variant="secondary">
                      {user.email_address ?? "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Select
                      aria-label={`Role for ${user.email_address ?? user.id}`}
                      items={roleItems}
                      onValueChange={(role) => {
                        if (role && role !== user.role) {
                          void mutate(
                            `organizations/users/${user.id}`,
                            "POST",
                            { role },
                            "Role updated.",
                          );
                        }
                      }}
                      size="sm"
                      value={user.role}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Text variant="mono-secondary">{user.id}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <ConfirmAction
                      description="The member will immediately lose access to the organization and its workspaces."
                      label="Remove"
                      onConfirm={() =>
                        mutate(
                          `organizations/users/${user.id}`,
                          "DELETE",
                          undefined,
                          "Member removed.",
                        )
                      }
                      title={`Remove ${user.email_address ?? user.name ?? "this member"}?`}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <Empty
            icon={<UsersIcon size={36} />}
            title="No members available"
            description="Check the key's member read scope."
          />
        )}
      </Surface>
    </>
  );
}

function Invites({
  data,
  mutate,
}: {
  data: DashboardData;
  mutate: (
    path: string,
    method: "POST" | "DELETE",
    body?: unknown,
    success?: string,
  ) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("developer");

  async function invite(event: FormEvent) {
    event.preventDefault();
    await mutate(
      "organizations/invites",
      "POST",
      { email, role },
      "Invitation sent.",
    );
    setEmail("");
  }

  return (
    <>
      <SectionHeader
        title="Invitations"
        description="Invite members and track pending invitations."
      />
      <Surface className="panel">
        <Text as="h2" variant="heading3">
          New invitation
        </Text>
        <form className="inline-form" onSubmit={invite}>
          <Input
            label="Email address"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
            type="email"
            value={email}
          />
          <Select
            items={roleItems}
            label="Role"
            onValueChange={(value) => setRole(value ?? "developer")}
            value={role}
          />
          <Button
            disabled={!email}
            icon={<UserPlusIcon size={16} />}
            type="submit"
            variant="primary"
          >
            Invite
          </Button>
        </form>
      </Surface>
      <Surface className="table-panel">
        {data.invites.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>E-mail</Table.Head>
                <Table.Head>Role</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Expiration</Table.Head>
                <Table.Head>Action</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.invites.map((invite) => (
                <Table.Row key={invite.id}>
                  <Table.Cell>{invite.email}</Table.Cell>
                  <Table.Cell>{roleItems[invite.role as keyof typeof roleItems] ?? invite.role}</Table.Cell>
                  <Table.Cell>
                    <Badge
                      appearance="dot"
                      variant={invite.status === "pending" ? "warning" : "neutral"}
                    >
                      {invite.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{formatDate(invite.expires_at)}</Table.Cell>
                  <Table.Cell>
                    {invite.status === "pending" ? (
                      <ConfirmAction
                        description="The invitation link will no longer be valid."
                        label="Cancel"
                        onConfirm={() =>
                          mutate(
                            `organizations/invites/${invite.id}`,
                            "DELETE",
                            undefined,
                            "Invitation canceled.",
                          )
                        }
                        title="Cancel this invitation?"
                      />
                    ) : null}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <Empty
            title="No invitations"
            description="New invitations will appear here."
          />
        )}
      </Surface>
    </>
  );
}

function Workspaces({
  data,
  mutate,
}: {
  data: DashboardData;
  mutate: (
    path: string,
    method: "POST" | "DELETE",
    body?: unknown,
    success?: string,
  ) => Promise<void>;
}) {
  const [name, setName] = useState("");

  async function create(event: FormEvent) {
    event.preventDefault();
    await mutate(
      "organizations/workspaces",
      "POST",
      { name },
      "Workspace created.",
    );
    setName("");
  }

  return (
    <>
      <SectionHeader
        title="Workspaces"
        description="Isolate teams, keys, usage, and limits."
      />
      <Surface className="panel">
        <form className="inline-form compact" onSubmit={create}>
          <Input
            label="New workspace"
            onChange={(event) => setName(event.target.value)}
            placeholder="Production"
            required
            value={name}
          />
          <Button
            disabled={!name}
            icon={<PlusIcon size={16} />}
            type="submit"
            variant="primary"
          >
            Create
          </Button>
        </form>
      </Surface>
      <Surface className="table-panel">
        {data.workspaces.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Workspace</Table.Head>
                <Table.Head>ID</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Action</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.workspaces.map((workspace) => (
                <Table.Row key={workspace.id}>
                  <Table.Cell>
                    <Text bold>{workspace.name}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text variant="mono-secondary">{workspace.id}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      appearance="dot"
                      variant={workspace.archived_at ? "neutral" : "success"}
                    >
                      {workspace.archived_at ? "Archived" : "Active"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {!workspace.archived_at ? (
                      <ConfirmAction
                        description="This action is irreversible and immediately revokes every API key in the workspace."
                        label="Archive"
                        onConfirm={() =>
                          mutate(
                            `organizations/workspaces/${workspace.id}/archive`,
                            "POST",
                            {},
                            "Workspace archived.",
                          )
                        }
                        title={`Archive ${workspace.name}?`}
                      />
                    ) : null}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <Empty
            title="No dedicated workspace"
            description="The default workspace is not returned by the API."
          />
        )}
      </Surface>
    </>
  );
}

function ApiKeys({
  data,
  mutate,
}: {
  data: DashboardData;
  mutate: (
    path: string,
    method: "POST" | "DELETE",
    body?: unknown,
    success?: string,
  ) => Promise<void>;
}) {
  return (
    <>
      <SectionHeader
        title="API keys"
        description="Application key inventory, expiration, and deactivation."
      />
      <Banner
        description="The Admin API can list and update existing keys, but it cannot reveal their secrets or create new ones."
        icon={<KeyIcon size={18} weight="fill" />}
        size="sm"
        title="Protected secrets"
        variant="secondary"
      />
      <Surface className="table-panel">
        {data.apiKeys.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Key</Table.Head>
                <Table.Head>Hint</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Expiration</Table.Head>
                <Table.Head>Action</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.apiKeys.map((apiKey) => (
                <Table.Row key={apiKey.id}>
                  <Table.Cell>
                    <Text bold>{apiKey.name}</Text>
                    <Text variant="mono-secondary">
                      {apiKey.id}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text variant="mono">{apiKey.partial_key_hint ?? "••••"}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      appearance="dot"
                      variant={apiKey.status === "active" ? "success" : "neutral"}
                    >
                      {apiKey.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{formatDate(apiKey.expires_at)}</Table.Cell>
                  <Table.Cell>
                    {apiKey.status === "active" ? (
                      <ConfirmAction
                        description="The key will stop working immediately. Its secret cannot be recovered."
                        label="Deactivate"
                        onConfirm={() =>
                          mutate(
                            `organizations/api_keys/${apiKey.id}`,
                            "POST",
                            { status: "inactive" },
                            "Key deactivated.",
                          )
                        }
                        title={`Deactivate ${apiKey.name}?`}
                      />
                    ) : null}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <Empty
            icon={<KeyIcon size={36} />}
            title="No visible keys"
            description="The Admin key may not have the required scope."
          />
        )}
      </Surface>
    </>
  );
}

function Usage({ data }: { data: DashboardData }) {
  const totalTokens = recursiveFieldSum(
    data.usage,
    new Set([
      "uncached_input_tokens",
      "cache_read_input_tokens",
      "cache_creation_input_tokens",
      "output_tokens",
    ]),
  );
  const cacheRead = recursiveFieldSum(
    data.usage,
    new Set(["cache_read_input_tokens"]),
  );
  const totalCost = recursiveFieldSum(data.cost, new Set(["amount"]));

  return (
    <>
      <SectionHeader
        title="Usage & costs"
        description="Messages API consumption and Claude Code adoption."
      />
      <section className="metric-grid three">
        <Surface className="metric-surface">
          <Text size="sm" variant="secondary">
            Tokens · 7 days
          </Text>
          <Text as="span" variant="heading2">
            {new Intl.NumberFormat("en-US").format(totalTokens)}
          </Text>
        </Surface>
        <Surface className="metric-surface">
          <Text size="sm" variant="secondary">
            Cache read
          </Text>
          <Text as="span" variant="heading2">
            {new Intl.NumberFormat("en-US").format(cacheRead)}
          </Text>
        </Surface>
        <Surface className="metric-surface">
          <Text size="sm" variant="secondary">
            Cost · 7 days
          </Text>
          <Text as="span" variant="heading2">
            {formatMoneyFromCents(totalCost)}
          </Text>
        </Surface>
      </section>

      <Surface className="table-panel">
        <Text as="h2" variant="heading3">
          Claude Code · yesterday
        </Text>
        {data.claudeCode.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Actor</Table.Head>
                <Table.Head>Sessions</Table.Head>
                <Table.Head>Lines added</Table.Head>
                <Table.Head>Commits</Table.Head>
                <Table.Head>Pull requests</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.claudeCode.map((record, index) => (
                <Table.Row key={`${record.actor?.email_address ?? "actor"}-${index}`}>
                  <Table.Cell>
                    {record.actor?.email_address ??
                      record.actor?.api_key_name ??
                      "Unknown actor"}
                  </Table.Cell>
                  <Table.Cell>{record.num_sessions ?? 0}</Table.Cell>
                  <Table.Cell>{record.lines_of_code?.added ?? 0}</Table.Cell>
                  <Table.Cell>{record.commits_by_claude_code ?? 0}</Table.Cell>
                  <Table.Cell>{record.pull_requests_by_claude_code ?? 0}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <Empty
            size="sm"
            title="No Claude Code activity"
            description="No data was returned for the previous day."
          />
        )}
      </Surface>

      <Surface className="panel">
        <Text as="h2" variant="heading3">
          Raw analytics response
        </Text>
        <Text variant="secondary">
          Use this to inspect the detailed dimensions returned by your plan.
        </Text>
        <Code
          code={JSON.stringify({ usage: data.usage, cost: data.cost }, null, 2)}
          lang="jsonc"
        />
      </Surface>
    </>
  );
}

function Limits({
  data,
  mutate,
}: {
  data: DashboardData;
  mutate: (
    path: string,
    method: "POST" | "DELETE",
    body?: unknown,
    success?: string,
  ) => Promise<void>;
}) {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");

  async function setLimit(event: FormEvent) {
    event.preventDefault();
    await mutate(
      "organizations/spend_limits",
      "POST",
      {
        scope: { type: "user", user_id: userId },
        amount,
      },
      "Spend limit saved.",
    );
    setAmount("");
  }

  return (
    <>
      <SectionHeader
        title="Limits"
        description="Organization rate limits and member spend limits."
      />
      <Surface className="panel">
        <Text as="h2" variant="heading3">
          Set a monthly limit
        </Text>
        <Text variant="secondary">
          The amount is expressed in USD cents, as required by the Admin API.
        </Text>
        <form className="inline-form" onSubmit={setLimit}>
          <Input
            label="User ID"
            onChange={(event) => setUserId(event.target.value)}
            placeholder="user_…"
            required
            value={userId}
          />
          <Input
            label="Amount in cents"
            min="0"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="50000"
            required
            type="number"
            value={amount}
          />
          <Button disabled={!userId || !amount} type="submit" variant="primary">
            Save
          </Button>
        </form>
      </Surface>

      <Surface className="table-panel">
        <Text as="h2" variant="heading3">
          Effective limits
        </Text>
        {data.spendLimits.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Member</Table.Head>
                <Table.Head>Limit</Table.Head>
                <Table.Head>Spent</Table.Head>
                <Table.Head>Period</Table.Head>
                <Table.Head>Action</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.spendLimits.map((limit, index) => (
                <Table.Row key={limit.spend_limit_id ?? `${limit.actor?.user_id}-${index}`}>
                  <Table.Cell>
                    <Text bold>{limit.actor?.name ?? "Member"}</Text>
                    <Text size="xs" variant="secondary">
                      {limit.actor?.email_address ?? limit.actor?.user_id ?? "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>{formatMoneyFromCents(limit.amount)}</Table.Cell>
                  <Table.Cell>
                    {formatMoneyFromCents(limit.period_to_date_spend)}
                  </Table.Cell>
                  <Table.Cell>{limit.period ?? "monthly"}</Table.Cell>
                  <Table.Cell>
                    {limit.spend_limit_id ? (
                      <ConfirmAction
                        description="The member will fall back to the limit inherited from the organization or tier."
                        label="Delete"
                        onConfirm={() =>
                          mutate(
                            `organizations/spend_limits/${limit.spend_limit_id}`,
                            "DELETE",
                            undefined,
                            "Override deleted.",
                          )
                        }
                        title="Delete this override?"
                      />
                    ) : null}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <Empty
            size="sm"
            title="Spend limits unavailable"
            description="This API depends on the organization type and the key's scopes."
          />
        )}
      </Surface>

      <Surface className="table-panel">
        <Text as="h2" variant="heading3">
          Increase requests
        </Text>
        {data.increaseRequests.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Member</Table.Head>
                <Table.Head>Current spend</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Action</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.increaseRequests.map((request) => (
                <Table.Row key={request.id}>
                  <Table.Cell>
                    {request.actor?.email_address ??
                      request.actor?.name ??
                      request.actor?.user_id ??
                      "Member"}
                  </Table.Cell>
                  <Table.Cell>
                    {formatMoneyFromCents(
                      request.spend_summary?.period_to_date_spend,
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge appearance="dot" variant="warning">
                      {request.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <ConfirmAction
                      description="The request will be denied and Anthropic will notify the member."
                      label="Deny"
                      onConfirm={() =>
                        mutate(
                          `organizations/spend_limit_increase_requests/${request.id}/deny`,
                          "POST",
                          { suppress_notification: false },
                          "Request denied.",
                        )
                      }
                      title="Deny this request?"
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <Empty
            size="sm"
            title="No pending requests"
            description="Spend limit increase requests will appear here."
          />
        )}
      </Surface>
    </>
  );
}

function Audit({ data }: { data: DashboardData }) {
  return (
    <>
      <SectionHeader
        title="Activity"
        description="Recent events from the Compliance Activity Feed."
      />
      <Surface className="table-panel">
        {data.activities.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Event</Table.Head>
                <Table.Head>Actor</Table.Head>
                <Table.Head>Date</Table.Head>
                <Table.Head>ID</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.activities.map((activity, index) => (
                <Table.Row key={activity.id ?? `${activity.type}-${index}`}>
                  <Table.Cell>
                    <Badge variant="neutral">{activity.type ?? "activity"}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {activity.actor?.email_address ??
                      activity.actor?.email ??
                      activity.actor?.name ??
                      "System"}
                  </Table.Cell>
                  <Table.Cell>{formatDate(activity.created_at)}</Table.Cell>
                  <Table.Cell>
                    <Text variant="mono-secondary">{activity.id ?? "—"}</Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <Empty
            icon={<ActivityIcon size={36} />}
            title="Activity Feed unavailable"
            description="Add the read:compliance_activities scope to the Admin key."
          />
        )}
      </Surface>
    </>
  );
}

function ApiExplorer() {
  const [method, setMethod] = useState<"GET" | "POST" | "DELETE">("GET");
  const [path, setPath] = useState("organizations/me");
  const [body, setBody] = useState("{}");
  const [result, setResult] = useState("{}");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const methodItems = useMemo(
    () => ({ GET: "GET", POST: "POST", DELETE: "DELETE" }),
    [],
  );

  async function execute(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      let parsedBody: unknown;
      if (method !== "GET") parsedBody = JSON.parse(body);
      const response = await adminFetch<unknown>(path.replace(/^\/?v1\//, ""), {
        method,
        body: method === "GET" ? undefined : JSON.stringify(parsedBody),
      });
      setResult(JSON.stringify(response, null, 2));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to execute the request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SectionHeader
        title="API Explorer"
        description="Advanced access to operations explicitly allowed by the server proxy."
      />
      <Banner
        description="Destinations are restricted to api.anthropic.com and an Admin API allowlist. Keys and authentication headers remain server-side."
        icon={<LockKeyIcon size={18} weight="fill" />}
        size="sm"
        title="Secure proxy"
        variant="secondary"
      />
      <Surface className="panel explorer">
        <form className="explorer-form" onSubmit={execute}>
          <div className="explorer-endpoint">
            <Select
              aria-label="HTTP method"
              items={methodItems}
              onValueChange={(value) =>
                setMethod((value ?? "GET") as "GET" | "POST" | "DELETE")
              }
              value={method}
            />
            <Input
              label="API path after /v1/"
              onChange={(event) => setPath(event.target.value)}
              value={path}
            />
          </div>
          {method !== "GET" ? (
            <InputArea
              label="JSON body"
              onChange={(event) => setBody(event.target.value)}
              rows={8}
              value={body}
            />
          ) : null}
          {error ? (
            <Banner
              description={error}
              icon={<WarningCircleIcon size={18} weight="fill" />}
              size="sm"
              title="Request denied"
              variant="error"
            />
          ) : null}
          <Button loading={loading} type="submit" variant="primary">
            Execute
          </Button>
        </form>
        <Code code={result} lang="jsonc" />
      </Surface>
    </>
  );
}
