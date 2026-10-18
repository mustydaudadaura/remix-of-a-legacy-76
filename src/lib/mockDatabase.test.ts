import test from "node:test";
import assert from "node:assert/strict";
import { mockPostgrestFetch } from "../integrations/supabase/mockDatabase";

test("mock database: GET /rest/v1/schools returns default seed school", async () => {
  const res = await mockPostgrestFetch("https://placeholder.supabase.co/rest/v1/schools?select=*");
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
  assert.ok(data.length >= 1);
  assert.equal(data[0].code, "RAA-101");
});

test("mock database: POST /rest/v1/schools inserts and persists a new school", async () => {
  const newSchool = {
    name: "Daura Community Grammar School",
    code: "DCG-555",
    current_session: "2025/2026",
  };

  const postRes = await mockPostgrestFetch("https://placeholder.supabase.co/rest/v1/schools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newSchool),
  });
  assert.equal(postRes.status, 201);
  const created = await postRes.json();
  assert.ok(Array.isArray(created));
  assert.equal(created[0].code, "DCG-555");
  assert.ok(created[0].id);

  // Verify retrieval
  const getRes = await mockPostgrestFetch("https://placeholder.supabase.co/rest/v1/schools?select=*");
  const list = await getRes.json();
  const found = list.find((s: any) => s.code === "DCG-555");
  assert.ok(found);
  assert.equal(found.name, "Daura Community Grammar School");
});

test("mock database: POST /rest/v1/students with single() returns created object", async () => {
  const student = {
    first_name: "Aliyu",
    last_name: "Umar",
    admission_no: "ADM/2025/999",
    gender: "male",
    class_id: "c1",
  };

  const postRes = await mockPostgrestFetch("https://placeholder.supabase.co/rest/v1/students", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/vnd.pgrst.object+json",
    },
    body: JSON.stringify(student),
  });
  assert.equal(postRes.status, 201);
  const created = await postRes.json();
  assert.equal(created.admission_no, "ADM/2025/999");
  assert.ok(created.id);

  // Retrieve students with embedded class name
  const getRes = await mockPostgrestFetch(
    "https://placeholder.supabase.co/rest/v1/students?select=id,admission_no,first_name,last_name,class_id,classes(name)"
  );
  assert.equal(getRes.status, 200);
  const list = await getRes.json();
  const found = list.find((s: any) => s.admission_no === "ADM/2025/999");
  assert.ok(found);
  assert.equal(found.classes?.name, "JSS 1 Gold");
});
