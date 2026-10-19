import { describe, expect, it } from "vitest";
import { isPunchLocked } from "../utils/punchLock";

describe("khoá chấm công sau 22:00", () => {
  it.each([
    [7, 45, false],
    [17, 0, false],
    [17, 59, false],
    [21, 59, false],
    [22, 0, true],
    [22, 1, true],
    [23, 59, true],
  ])("lúc %i:%i thì khoá = %s", (hour, minute, locked) => {
    expect(isPunchLocked(new Date(2026, 9, 19, hour, minute))).toBe(locked);
  });
});
