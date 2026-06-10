import { describe, it, expect } from "vitest";
import { parseHost } from "@/lib/tenant/parse-host";

const ROOT = "localtest.me";

describe("parseHost", () => {
  it("null host is invalid", () => {
    expect(parseHost(null, ROOT)).toEqual({ kind: "invalid" });
  });

  it("root domain resolves to root", () => {
    expect(parseHost("localtest.me", ROOT)).toEqual({ kind: "root" });
    expect(parseHost("www.localtest.me", ROOT)).toEqual({ kind: "root" });
    expect(parseHost("localhost", ROOT)).toEqual({ kind: "root" });
  });

  it("strips port and lowercases", () => {
    expect(parseHost("Demo-A.LocalTest.me:3000", ROOT)).toEqual({
      kind: "subdomain",
      slug: "demo-a",
    });
  });

  it("single-level subdomain of root is a tenant slug", () => {
    expect(parseHost("demo-b.localtest.me", ROOT)).toEqual({
      kind: "subdomain",
      slug: "demo-b",
    });
  });

  it("nested subdomain is invalid", () => {
    expect(parseHost("a.b.localtest.me", ROOT)).toEqual({ kind: "invalid" });
  });

  it("any other domain is a custom tenant domain", () => {
    expect(parseHost("pizzaninja.co.il", ROOT)).toEqual({
      kind: "custom",
      domain: "pizzaninja.co.il",
    });
    expect(parseHost("www.pizzaninja.co.il", ROOT)).toEqual({
      kind: "custom",
      domain: "pizzaninja.co.il",
    });
  });
});
