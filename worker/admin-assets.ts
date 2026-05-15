export type AssetEnvironment = {
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
};

export function isAdminUiPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export async function maybeServeAdminUiAsset(request: Request, env: AssetEnvironment): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isAdminUiPath(url.pathname) || !env.ASSETS || !isAssetSafeMethod(request.method)) {
    return null;
  }

  const directResponse = await env.ASSETS.fetch(request);
  if (directResponse.status !== 404 || hasFileExtension(url.pathname)) {
    return directResponse;
  }

  if (!acceptsHtml(request)) {
    return directResponse;
  }

  const indexUrl = new URL("/admin/index.html", url.origin);
  return env.ASSETS.fetch(new Request(indexUrl, request));
}

function isAssetSafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

function hasFileExtension(pathname: string): boolean {
  const lastSegment = pathname.split("/").pop() ?? "";
  return lastSegment.includes(".");
}

function acceptsHtml(request: Request): boolean {
  const accept = request.headers.get("accept");
  return !accept || accept.includes("text/html") || accept.includes("*/*");
}
