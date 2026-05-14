export type StorageBridgeEnv = {
  OPERATIONAL_DB?: D1Database;
  OPERATIONAL_ARTIFACTS?: R2Bucket;
};

export function isStorageAuthorized(request: Request, token: string | undefined): boolean {
  if (!token) return false;
  const authorization = request.headers.get("Authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
  return bearer === token || request.headers.get("X-Durable-Storage-Token") === token;
}

export function storageUnavailable(): Response {
  return Response.json({ error: "storage_not_configured" }, { status: 503 });
}

export async function handleInternalStorage(
  request: Request,
  env: StorageBridgeEnv,
  url: URL,
  token: string | undefined,
): Promise<Response> {
  if (!isStorageAuthorized(request, token)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (url.pathname === "/internal/storage/sql" && request.method === "POST") {
    return handleStorageSql(request, env);
  }

  if (url.pathname === "/internal/storage/artifacts" && request.method === "POST") {
    return handleArtifactPut(request, env);
  }

  if (url.pathname.startsWith("/internal/storage/artifacts/") && request.method === "GET") {
    return handleArtifactGet(env, url.pathname.slice("/internal/storage/artifacts/".length));
  }

  return Response.json({ error: "not_found" }, { status: 404 });
}

export async function handleStorageHealth(env: StorageBridgeEnv): Promise<Response> {
  let d1Readable = false;
  if (env.OPERATIONAL_DB) {
    try {
      const result = await env.OPERATIONAL_DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
      d1Readable = result?.ok === 1;
    } catch {
      d1Readable = false;
    }
  }

  return Response.json({
    status: "ok",
    storage: {
      mode: env.OPERATIONAL_DB && env.OPERATIONAL_ARTIFACTS ? "durable-http" : "sqlite",
      durableConfigured: Boolean(env.OPERATIONAL_DB && env.OPERATIONAL_ARTIFACTS),
      d1Readable,
      r2Configured: Boolean(env.OPERATIONAL_ARTIFACTS),
    },
  });
}

async function handleStorageSql(request: Request, env: StorageBridgeEnv): Promise<Response> {
  if (!env.OPERATIONAL_DB) return storageUnavailable();

  const body = await request.json<{
    statements?: Array<{
      sql?: string;
      params?: unknown[];
    }>;
  }>();
  const statements = body.statements ?? [];
  if (statements.length === 0) {
    return Response.json({ error: "missing_statements" }, { status: 400 });
  }

  const prepared = statements.map((statement) => {
    if (!statement.sql) throw new Error("missing_sql");
    return env.OPERATIONAL_DB!.prepare(statement.sql).bind(...(statement.params ?? []));
  });
  const results = await env.OPERATIONAL_DB.batch(prepared);
  return Response.json({ results });
}

async function handleArtifactPut(request: Request, env: StorageBridgeEnv): Promise<Response> {
  if (!env.OPERATIONAL_ARTIFACTS) return storageUnavailable();

  const body = await request.json<{
    key?: string;
    contentText?: string;
    contentType?: string;
  }>();
  if (!body.key || body.contentText === undefined) {
    return Response.json({ error: "missing_artifact_body" }, { status: 400 });
  }

  await env.OPERATIONAL_ARTIFACTS.put(body.key, body.contentText, {
    httpMetadata: { contentType: body.contentType ?? "text/plain; charset=utf-8" },
  });
  return Response.json({
    key: body.key,
    byteSize: new TextEncoder().encode(body.contentText).byteLength,
  });
}

async function handleArtifactGet(env: StorageBridgeEnv, encodedKey: string): Promise<Response> {
  if (!env.OPERATIONAL_ARTIFACTS) return storageUnavailable();
  const key = decodeURIComponent(encodedKey);
  const object = await env.OPERATIONAL_ARTIFACTS.get(key);
  if (!object) {
    return Response.json({ error: "artifact_not_found" }, { status: 404 });
  }

  const contentType = object.httpMetadata?.contentType ?? "text/plain; charset=utf-8";
  return new Response(await object.text(), {
    headers: { "Content-Type": contentType },
  });
}
