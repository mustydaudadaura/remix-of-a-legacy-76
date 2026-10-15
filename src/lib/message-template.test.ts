import { describe, expect, test } from "./test-compat";
import { fillTemplate, isMuted } from "./message-template";

describe("fillTemplate", () => {
  test("fills parent and school names", () => {
    expect(fillTemplate("Dear {parent_name}, {school_name} resumes Monday.", { parent_name: "Mrs Bello", school_name: "Markazul Huda" }))
      .toBe("Dear Mrs Bello, Markazul Huda resumes Monday.");
  });
  test("missing parent name falls back to Parent", () => {
    expect(fillTemplate("Dear {parent_name}", {})).toBe("Dear Parent");
  });
});

describe("isMuted", () => {
  test("muted newsletter is skipped", () => expect(isMuted("news", ["news"])).toBe(true));
  test("direct messages can never be muted", () => expect(isMuted("message", ["message"])).toBe(false));
  test("fee reminders can never be muted", () => expect(isMuted("fee_reminder", ["fee_reminder"])).toBe(false));
});
