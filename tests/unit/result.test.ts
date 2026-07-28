import { describe, expect, it } from "vitest";
import { err, isErr, isOk, ok } from "@zero/shared";

describe("Result", () => {
  it("discriminates ok and err", () => {
    const success = ok(42);
    const failure = err(new Error("nope"));
    expect(isOk(success)).toBe(true);
    expect(isErr(failure)).toBe(true);
    if (isOk(success)) expect(success.value).toBe(42);
  });
});
