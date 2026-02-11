import { NextResponse, type NextRequest } from "next/server";

function getBackendBaseUrl() {
  return (
    process.env.API_PROXY_TARGET?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "http://localhost:5000"
  );
}

export async function proxyToBackend(req: NextRequest, backendPath: string) {
  const backendBaseUrl = getBackendBaseUrl();
  const targetUrl = `${backendBaseUrl}${backendPath}`;

  const incomingCookie = req.headers.get("cookie");
  const contentType = req.headers.get("content-type");

  const headers: Record<string, string> = {
    accept: req.headers.get("accept") ?? "application/json",
  };

  if (incomingCookie) headers.cookie = incomingCookie;
  if (contentType) headers["content-type"] = contentType;

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await req.text() : undefined;

  const backendRes = await fetch(targetUrl, {
    method,
    headers,
    body,
    redirect: "manual",
  });

  const resBody = await backendRes.text();

  const out = new NextResponse(resBody, {
    status: backendRes.status,
  });

  const setCookie = backendRes.headers.get("set-cookie");
  if (setCookie) out.headers.append("set-cookie", setCookie);

  const outContentType = backendRes.headers.get("content-type");
  if (outContentType) out.headers.set("content-type", outContentType);

  return out;
}
