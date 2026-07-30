const ANTHROPIC_API = "https://api.anthropic.com";

export async function anthropicAdminRequest(
  resource: string,
  adminKey: string,
  init: RequestInit = {},
) {
  const url = new URL(`/v1/${resource}`, ANTHROPIC_API);

  return fetch(url, {
    ...init,
    cache: "no-store",
    redirect: "error",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "user-agent": "Northstar-Admin/0.2.0",
      "x-api-key": adminKey,
      ...init.headers,
    },
  });
}

export async function anthropicError(response: Response) {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
      message?: string;
      request_id?: string;
    };

    return {
      error:
        body.error?.message ??
        body.message ??
        `Anthropic API returned HTTP ${response.status}.`,
      requestId: body.request_id,
    };
  } catch {
    return {
      error: `Anthropic API returned HTTP ${response.status}.`,
    };
  }
}
