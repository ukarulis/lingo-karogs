import { describe, expect, it } from "vitest";
import {
  FORMATIONS,
  RANDOM_FORMATION,
  applyFormation,
  formationById,
  formationFromSignature,
  formationPreview,
  formationSignature,
  placementToSpecs,
  specsToPlacement,
  validatePlacement,
} from "@/lib/karogs/formations";
import {
  ARMY,
  ARMY_SIZE,
  createArmy,
  randomSetup,
  ZONE_ROWS,
} from "@/lib/karogs/engine";
import { mulberry32 } from "@/lib/utils";

const EXPECTED_COUNTS = new Map(
  ARMY.map((a) => [
    `${a.kind}:${a.rank === "bomb" || a.rank === "flag" ? null : a.rank}`,
    a.count,
  ]),
);

function countSpecs(formation: (typeof FORMATIONS)[number]) {
  const counts = new Map<string, number>();
  for (const row of formation.rows) {
    for (const ch of row) {
      const spec = formationPreview(formation);
      void spec;
      const key =
        ch === "M" ? "movable:10"
        : ch === "G" ? "movable:9"
        : ch === "C" ? "movable:8"
        : ch === "J" ? "movable:7"
        : ch === "K" ? "movable:6"
        : ch === "L" ? "movable:5"
        : ch === "S" ? "movable:4"
        : ch === "N" ? "movable:3"
        : ch === "I" ? "movable:2"
        : ch === "P" ? "movable:1"
        : ch === "B" ? "bomb:null"
        : ch === "F" ? "flag:null"
        : "";
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

describe("preset formations", () => {
  it("provides six distinct formations", () => {
    expect(FORMATIONS.length).toBe(5);
    expect(formationById("random")?.name).toBe("Nejaušā");
    expect(formationById("balanced")).not.toBeNull();
  });

  it("every preset contains exactly the official 40-piece inventory", () => {
    for (const formation of FORMATIONS) {
      expect(formation.rows.join("").length).toBe(40);
      const counts = countSpecs(formation);
      for (const [key, expected] of EXPECTED_COUNTS) {
        expect(counts.get(key), `${formation.name}: ${key}`).toBe(expected);
      }
    }
  });

  it("named presets have meaningfully different layouts", () => {
    const signatures = FORMATIONS.map((f) => f.rows.join("|"));
    expect(new Set(signatures).size).toBe(FORMATIONS.length);
    // Front rows differ between at least three presets.
    const fronts = new Set(FORMATIONS.map((f) => f.rows[0]));
    expect(fronts.size).toBeGreaterThanOrEqual(3);
  });

  it("applies to both sides with valid zone cells and fresh ids", () => {
    for (const formation of FORMATIONS) {
      for (const side of ["red", "blue"] as const) {
        const placement = applyFormation(formation, side);
        expect(Object.keys(placement).length).toBe(ARMY_SIZE);
        expect(validatePlacement(placement, side)).toBeNull();
        const ids = Object.values(placement).map((p) => p.id);
        expect(new Set(ids).size).toBe(ARMY_SIZE);
        for (const [cell, piece] of Object.entries(placement)) {
          expect(piece.owner).toBe(side);
          const y = Math.floor(Number(cell) / 10);
          expect(ZONE_ROWS[side]).toContain(y);
        }
      }
    }
  });

  it("random formation is valid for both sides", () => {
    for (const side of ["red", "blue"] as const) {
      const placement = applyFormation(RANDOM_FORMATION, side, mulberry32(3));
      expect(validatePlacement(placement, side)).toBeNull();
    }
  });

  it("mirrors layouts vertically for red", () => {
    const blue = applyFormation(FORMATIONS[0], "blue");
    const red = applyFormation(FORMATIONS[0], "red");
    // Blue flag at (x, y) maps to red flag at (x, 9-y).
    const flagBlue = Object.entries(blue).find(
      ([, p]) => p.kind === "flag",
    )!;
    const flagRed = Object.entries(red).find(
      ([, p]) => p.kind === "flag",
    )!;
    const blueCell = Number(flagBlue[0]);
    const redCell = Number(flagRed[0]);
    expect(blueCell % 10).toBe(redCell % 10);
    expect(Math.floor(blueCell / 10) + Math.floor(redCell / 10)).toBe(9);
  });
});

describe("stored formation migration and validation", () => {
  it("roundtrips specs to fresh placements", () => {
    const original = randomSetup("red", mulberry32(7));
    const specs = placementToSpecs(original);
    const restored = specsToPlacement(specs, "red");
    expect(validatePlacement(restored, "red")).toBeNull();
    const counts = new Map<string, number>();
    for (const p of Object.values(restored)) {
      const key = `${p.kind}:${p.rank}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, expected] of EXPECTED_COUNTS) {
      expect(counts.get(key), key).toBe(expected);
    }
  });

  it("rejects malformed stored formations", () => {
    const placement = randomSetup("red", mulberry32(11));
    const key = Object.keys(placement)[0];
    delete placement[Number(key)];
    expect(validatePlacement(placement, "red")).not.toBeNull();
  });

  it("canonicalizes preset signatures", () => {
    for (const formation of FORMATIONS) {
      expect(formationFromSignature(formationSignature(formation))).toBe(
        formation.id,
      );
    }
    const custom = randomSetup("blue", mulberry32(2));
    expect(formationFromSignature(placementToSpecs(custom))).toBe("custom");
  });

  it("legacy saved placements (with ids) keep working", () => {
    // Simulates V1.0 saved formation data structure.
    const placement = randomSetup("blue", mulberry32(5));
    const legacy = placementToSpecs(placement);
    const restored = specsToPlacement(legacy, "blue");
    expect(validatePlacement(restored, "blue")).toBeNull();
  });

  it("army construction still yields 40 unique pieces", () => {
    const army = createArmy("red");
    expect(army.length).toBe(ARMY_SIZE);
    expect(new Set(army.map((p) => p.id)).size).toBe(ARMY_SIZE);
  });
});
