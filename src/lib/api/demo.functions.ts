import { createServerFn } from "@tanstack/react-start";

const DEMO_EMAIL = "demo.admin@eduerp-demo.ng";
const DEMO_PASSWORD = "DemoSchool#2026";

// Existing fictional demo only: never create accounts, grant roles or seed on request.
export const startDemo = createServerFn({ method: "POST" }).handler(async () => ({
  email: DEMO_EMAIL, password: DEMO_PASSWORD,
}));
