import {
  assertSessionConfigured,
  clearSessionCookie,
  decryptAdminKey,
  encryptAdminKey,
  hasSameOrigin,
  readAdminSession,
  sessionCookie,
} from "@/lib/admin-session";
import {
  anthropicAdminRequest,
  anthropicError,
} from "@/lib/anthropic-admin";

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json",
};

export async function GET(request: Request) {
  const encrypted = readAdminSession(request);
  if (!encrypted) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  const adminKey = await decryptAdminKey(encrypted);
  if (!adminKey) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 401,
      headers: {
        ...JSON_HEADERS,
        "set-cookie": clearSessionCookie(),
      },
    });
  }

  const response = await anthropicAdminRequest("organizations/me", adminKey);
  if (!response.ok) {
    const error = await anthropicError(response);
    return new Response(JSON.stringify(error), {
      status: response.status,
      headers: {
        ...JSON_HEADERS,
        ...(response.status === 401
          ? { "set-cookie": clearSessionCookie() }
          : {}),
      },
    });
  }

  return new Response(
    JSON.stringify({
      authenticated: true,
      organization: await response.json(),
    }),
    { headers: JSON_HEADERS },
  );
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    assertSessionConfigured();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Session unavailable." },
      { status: 503 },
    );
  }

  let adminKey = "";
  try {
    const body = (await request.json()) as { adminKey?: string };
    adminKey = body.adminKey?.trim() ?? "";
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!adminKey.startsWith("sk-ant-admin")) {
    return Response.json(
      { error: "The key must be an Admin key starting with sk-ant-admin." },
      { status: 400 },
    );
  }

  const response = await anthropicAdminRequest("organizations/me", adminKey);
  if (!response.ok) {
    return Response.json(await anthropicError(response), {
      status: response.status,
    });
  }

  const organization = await response.json();
  const encrypted = await encryptAdminKey(adminKey);

  return new Response(
    JSON.stringify({ authenticated: true, organization }),
    {
      headers: {
        ...JSON_HEADERS,
        "set-cookie": sessionCookie(encrypted),
      },
    },
  );
}

export async function DELETE(request: Request) {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  return new Response(JSON.stringify({ authenticated: false }), {
    headers: {
      ...JSON_HEADERS,
      "set-cookie": clearSessionCookie(),
    },
  });
}
