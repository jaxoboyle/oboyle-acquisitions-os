import { describe, it, expect } from "vitest";
import { analyzeRepairPhotos } from "./repair-vision";

describe("analyzeRepairPhotos", () => {
  it("returns null immediately when no images are supplied (no photos available case)", async () => {
    const result = await analyzeRepairPhotos([], { address: "123 Main St" });
    expect(result).toBeNull();
  });

  it("returns null when ANTHROPIC_API_KEY is not configured, without attempting a call", async () => {
    const prevKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const result = await analyzeRepairPhotos(
        [{ mediaType: "image/jpeg", base64: "Zm9v" }],
        { address: "123 Main St" }
      );
      expect(result).toBeNull();
    } finally {
      if (prevKey != null) process.env.ANTHROPIC_API_KEY = prevKey;
    }
  });
});
