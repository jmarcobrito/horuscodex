export function createMockRequest(routes) {
  const calls = [];
  async function request(path, init = {}) {
    if (typeof path !== "string" || !path.startsWith("/api/")) throw new Error("Endereço externo proibido no ensaio");
    const url = new URL(path, "https://horus.invalid");
    const method = (init.method || "GET").toUpperCase();
    const route = routes[method + " " + url.pathname];
    if (!route) throw new Error("Rota não simulada: " + method + " " + url.pathname);
    calls.push({ method, path, body: init.body ?? null });
    return route(url, init);
  }
  return { request, calls };
}
