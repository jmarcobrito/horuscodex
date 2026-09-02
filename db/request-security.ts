const forbiddenOrigin = () => Response.json(
  { error: "Origem da solicitação não autorizada." },
  { status: 403 },
);

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

export function sameOriginFailure(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return forbiddenOrigin();

  const url = new URL(request.url);
  const host = firstHeaderValue(request.headers.get("x-forwarded-host"))
    || request.headers.get("host")
    || url.host;
  const protocol = firstHeaderValue(request.headers.get("x-forwarded-proto"))
    || url.protocol.replace(":", "");
  const expectedOrigin = `${protocol}://${host}`;

  return origin === expectedOrigin || origin === url.origin ? null : forbiddenOrigin();
}
