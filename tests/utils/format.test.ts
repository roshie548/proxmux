import { describe, expect, test } from "bun:test";
import {
  formatBytes,
  formatPercent,
  formatUptime,
  formatCPU,
  formatMemory,
  truncate,
  padRight,
  padLeft,
} from "../../src/utils/format";

describe("formatBytes", () => {
  test("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  test("formats bytes", () => {
    expect(formatBytes(500)).toBe("500.0 B");
  });

  test("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  test("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
  });

  test("formats gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1.0 GB");
    expect(formatBytes(5368709120)).toBe("5.0 GB");
  });

  test("formats terabytes", () => {
    expect(formatBytes(1099511627776)).toBe("1.0 TB");
  });
});

describe("formatPercent", () => {
  test("formats decimal as percentage", () => {
    expect(formatPercent(0.5)).toBe("50.0%");
    expect(formatPercent(1)).toBe("100.0%");
    expect(formatPercent(0)).toBe("0.0%");
  });

  test("respects decimal precision", () => {
    expect(formatPercent(0.1234, 2)).toBe("12.34%");
    expect(formatPercent(0.1234, 0)).toBe("12%");
  });
});

describe("formatUptime", () => {
  test("formats minutes only", () => {
    expect(formatUptime(60)).toBe("1m");
    expect(formatUptime(300)).toBe("5m");
  });

  test("formats hours and minutes", () => {
    expect(formatUptime(3660)).toBe("1h 1m");
    expect(formatUptime(7200)).toBe("2h");
  });

  test("formats days, hours, and minutes", () => {
    expect(formatUptime(90061)).toBe("1d 1h 1m");
    expect(formatUptime(86400)).toBe("1d");
  });

  test("handles zero seconds", () => {
    expect(formatUptime(0)).toBe("0m");
  });

  test("handles large uptimes", () => {
    // 30 days
    expect(formatUptime(2592000)).toBe("30d");
  });
});

describe("formatCPU", () => {
  test("formats CPU usage as percentage with core count", () => {
    expect(formatCPU(0.5, 4)).toBe("12.5% (4 cores)");
    expect(formatCPU(2, 4)).toBe("50.0% (4 cores)");
  });

  test("handles zero cores", () => {
    expect(formatCPU(1, 0)).toBe("0.0% (0 cores)");
  });
});

describe("formatMemory", () => {
  test("formats memory usage with percentage", () => {
    const result = formatMemory(536870912, 1073741824); // 512MB / 1GB
    expect(result).toBe("512.0 MB / 1.0 GB (50.0%)");
  });

  test("handles zero max memory", () => {
    const result = formatMemory(0, 0);
    expect(result).toBe("0 B / 0 B (0.0%)");
  });
});

describe("truncate", () => {
  test("returns original string if shorter than length", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  test("truncates long strings with ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello w…");
  });

  test("handles exact length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  test("handles length of 1", () => {
    expect(truncate("hello", 1)).toBe("…");
  });
});

describe("padRight", () => {
  test("pads string to specified length", () => {
    expect(padRight("hi", 5)).toBe("hi   ");
  });

  test("returns original if already long enough", () => {
    expect(padRight("hello", 3)).toBe("hello");
  });
});

describe("padLeft", () => {
  test("pads string to specified length", () => {
    expect(padLeft("hi", 5)).toBe("   hi");
  });

  test("returns original if already long enough", () => {
    expect(padLeft("hello", 3)).toBe("hello");
  });
});
