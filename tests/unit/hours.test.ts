import { describe, it, expect } from "vitest";
import { isOpenNow } from "@/lib/hours";

// 2026-06-10 is a Wednesday. Israel is UTC+3 (IDT) in June.
const WED_11AM_IL = new Date("2026-06-10T08:00:00Z"); // 11:00 IL
const WED_11PM_IL = new Date("2026-06-10T20:00:00Z"); // 23:00 IL
const WED_1AM_IL = new Date("2026-06-09T22:00:00Z"); // Wed 01:00 IL

const HOURS = {
  sunday: "10:00-22:00",
  monday: "10:00-22:00",
  tuesday: "10:00-22:00",
  wednesday: "10:00-22:00",
  thursday: "10:00-22:00",
  friday: "10:00-15:00",
  saturday: "closed",
};

describe("isOpenNow (Asia/Jerusalem)", () => {
  it("open within hours", () => {
    expect(isOpenNow(HOURS, WED_11AM_IL)).toBe(true);
  });
  it("closed after hours", () => {
    expect(isOpenNow(HOURS, WED_11PM_IL)).toBe(false);
  });
  it("closed day returns false", () => {
    const sat = new Date("2026-06-13T08:00:00Z"); // Saturday 11:00 IL
    expect(isOpenNow(HOURS, sat)).toBe(false);
  });
  it("overnight range wraps past midnight", () => {
    const hours = { ...HOURS, tuesday: "18:00-02:00" };
    // Wednesday 01:00 IL belongs to Tuesday's overnight window
    expect(isOpenNow(hours, WED_1AM_IL)).toBe(true);
  });
  it("missing day treated as closed", () => {
    expect(isOpenNow({ wednesday: "" }, WED_11AM_IL)).toBe(false);
  });
});
