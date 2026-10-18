import { createServerFn } from "@tanstack/react-start";

const DEMO_EMAIL = "mustydawuddaura@gmail.com";
const DEMO_PASSWORD = "Mustydawud@1994";

// Existing fictional demo only: never create accounts, grant roles or seed on request.
export const startDemo = createServerFn({ method: "POST" }).handler(async () => ({
  email: DEMO_EMAIL, password: DEMO_PASSWORD,
}));
