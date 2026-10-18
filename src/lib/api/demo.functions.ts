import { createServerFn } from "@tanstack/react-start";
import { signParentToken } from "@/lib/parent-auth.server";

const DEMO_EMAIL = "demo.admin@eduerp-demo.ng";
const DEMO_PASSWORD = "DemoSchool#2026";
const DEMO_PARENT_ID = "d6ec3069-0809-4eba-a77a-ca441363b192";
const DEMO_SCHOOL_ID = "af91ff67-95eb-4b62-93a0-5617d23a2f1d";

// Existing fictional demo only: never create accounts, grant roles or seed on request.
export const startDemo = createServerFn({ method: "POST" }).handler(async () => ({
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
}));

export const startParentDemo = createServerFn({ method: "POST" }).handler(async () => {
  const token = signParentToken({ parent_id: DEMO_PARENT_ID, school_id: DEMO_SCHOOL_ID });
  return {
    token,
    parent: {
      id: DEMO_PARENT_ID,
      full_name: "Mrs. Hauwa Bello",
      phone: "08031000001",
      school_id: DEMO_SCHOOL_ID,
    },
  };
});

