import { describe, it } from "node:test";
import assert from "node:assert/strict";

export { describe, it, it as test };

export function expect<T>(actual: T) {
  return {
    toBe(expected: unknown) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected: unknown) {
      assert.deepStrictEqual(actual, expected);
    },
    toContain(expected: any) {
      if (typeof actual === "string") {
        assert.ok(actual.includes(expected), `Expected "${actual}" to contain "${expected}"`);
      } else if (Array.isArray(actual)) {
        assert.ok((actual as any[]).includes(expected), `Expected array to contain item`);
      }
    },
    toHaveLength(expected: number) {
      assert.strictEqual((actual as any).length, expected);
    },
    toBeLessThanOrEqual(expected: number) {
      assert.ok((actual as any) <= expected, `Expected ${actual} <= ${expected}`);
    },
    toThrow(msg?: string) {
      if (msg) {
        assert.throws(actual as any, new RegExp(msg));
      } else {
        assert.throws(actual as any);
      }
    },
    not: {
      toContain(expected: any) {
        if (typeof actual === "string") {
          assert.ok(!actual.includes(expected), `Expected "${actual}" not to contain "${expected}"`);
        } else if (Array.isArray(actual)) {
          assert.ok(!(actual as any[]).includes(expected), `Expected array not to contain item`);
        }
      },
    },
  };
}
