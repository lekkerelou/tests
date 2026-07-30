import {
  clearSessionCookie,
  decryptAdminKey,
  hasSameOrigin,
  readAdminSession,
} from "@/lib/admin-session";
import {
  anthropicAdminRequest,
  anthropicError,
} from "@/lib/anthropic-admin";

const ID = "[A-Za-z0-9_-]+";
const RULES: Record<string, RegExp[]> = {
  GET: [
    /^organizations\/me$/,
    new RegExp(`^organizations/(users|invites|workspaces|api_keys)(/${ID})?$`),
    new RegExp(
      `^organizations/workspaces/${ID}/members(/${ID})?$`,
    ),
    new RegExp(`^organizations/workspaces/${ID}/rate_limits$`),
    /^organizations\/rate_limits$/,
    /^organizations\/usage_report\/(messages|claude_code)$/,
    /^organizations\/cost_report$/,
    /^organizations\/analytics\/(user_cost_report|user_usage_report)$/,
    /^organizations\/spend_limits\/effective$/,
    new RegExp(`^organizations/spend_limits/${ID}$`),
    new RegExp(
      `^organizations/spend_limit_increase_requests(/${ID})?$`,
    ),
    /^compliance\/activities$/,
  ],
  POST: [
    /^organizations\/invites$/,
    /^organizations\/workspaces$/,
    new RegExp(`^organizations/workspaces/${ID}(/archive)?$`),
    new RegExp(`^organizations/users/${ID}$`),
    new RegExp(
      `^organizations/workspaces/${ID}/members(/${ID})?$`,
    ),
    new RegExp(`^organizations/api_keys/${ID}$`),
    /^organizations\/spend_limits$/,
    new RegExp(
      `^organizations/spend_limit_increase_requests/${ID}/(approve|deny)$`,
    ),
  ],
  DELETE: [
    new RegExp(`^organizations/(users|invites)/${ID}$`),
    new RegExp(`^organizations/workspaces/${ID}/members/${ID}$`),
    new RegExp(`^organizations/spend_limits/${ID}$`),
  ],
};

function resourceFromRequest(request: Request) {
  const url = new URL(request.url);
  const prefix = "/api/admin/";
  if (!url.pathname.startsWith(prefix)) return null;

  try {
    const resource = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!resource || resource.includes("..") || resource.includes("//")) {
      return null;
    }

    return `${resource}${url.search}`;
  } catch {
    return null;
  }
}

async function proxy(request: Request) {
  const encrypted = readAdminSession(request);
  if (!encrypted) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const adminKey = await decryptAdminKey(encrypted);
  if (!adminKey) {
    return new Response(JSON.stringify({ error: "Session expired." }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "set-cookie": clearSessionCookie(),
      },
    });
  }

  if (request.method !== "GET" && !hasSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const resourceWithQuery = resourceFromRequest(request);
  const resource = resourceWithQuery?.split("?")[0] ?? "";
  const allowed = RULES[request.method]?.some((rule) => rule.test(resource));
  if (!resourceWithQuery || !allowed) {
    return Response.json(
      { error: "This Admin API operation is not allowed by the proxy." },
      { status: 403 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 65_536) {
    return Response.json({ error: "Request body is too large." }, { status: 413 });
  }

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
    if (body) {
      try {
        JSON.parse(body);
      } catch {
        return Response.json({ error: "Invalid JSON body." }, { status: 400 });
      }
    }
  }

  const response = await anthropicAdminRequest(resourceWithQuery, adminKey, {
    method: request.method,
    body,
  });

  if (!response.ok) {
    return Response.json(await anthropicError(response), {
      status: response.status,
      headers:
        response.status === 401
          ? { "set-cookie": clearSessionCookie() }
          : undefined,
    });
  }

  const responseBody = await response.text();
  return new Response(responseBody || null, {
    status: response.status,
    headers: {
      "cache-control": "no-store",
      "content-type":
        response.headers.get("content-type") ?? "application/json",
      ...(response.headers.get("request-id")
        ? { "x-anthropic-request-id": response.headers.get("request-id")! }
        : {}),
    },
  });
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
