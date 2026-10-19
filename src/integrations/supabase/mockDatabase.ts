// Compatibility export for imported generated clients. No offline auth or fake writes.
export async function mockPostgrestFetch(_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> {
  return new Response(JSON.stringify({
    code: "BACKEND_NOT_CONFIGURED",
    message: "The school service is not configured. No records were saved. Please contact the administrator.",
  }), { status: 503, headers: { "Content-Type": "application/json" } });
}
