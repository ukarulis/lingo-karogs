// Preset army formations for instant play. Formations are stored in blue
// orientation (rows 0-3, top of the board) and mirrored for red at apply time,
// so a single definition serves both sides.

import {
  type Piece,
  type Side,
  ARMY_SIZE,
  BOARD_SIZE,
  createArmy,
  createGame,
  randomSetup,
  setSetup,
} from "./engine";

export type PieceSpec =
  | { kind: "movable"; rank: number }
  | { kind: "bomb" }
  | { kind: "flag" };

export interface Formation {
  id: string;
  name: string;
  description: string;
  strength: string;
  tradeoff: string;
  /** 4 rows x 10 columns, blue orientation (row 0 is the enemy-facing row). */
  rows: [string, string, string, string];
}

const CHAR_TO_SPEC: Record<string, PieceSpec> = {
  M: { kind: "movable", rank: 10 },
  G: { kind: "movable", rank: 9 },
  C: { kind: "movable", rank: 8 },
  J: { kind: "movable", rank: 7 },
  K: { kind: "movable", rank: 6 },
  L: { kind: "movable", rank: 5 },
  S: { kind: "movable", rank: 4 },
  N: { kind: "movable", rank: 3 },
  I: { kind: "movable", rank: 2 },
  P: { kind: "movable", rank: 1 },
  B: { kind: "bomb" },
  F: { kind: "flag" },
};

const SPEC_TO_CHAR: Record<string, string> = {
  "10": "M",
  "9": "G",
  "8": "C",
  "7": "J",
  "6": "K",
  "5": "L",
  "4": "S",
  "3": "N",
  "2": "I",
  "1": "P",
  bomb: "B",
  flag: "F",
};

export const RANDOM_FORMATION_ID = "random";

export const FORMATIONS: readonly Formation[] = [
  {
    id: "balanced",
    name: "Sabalansētā",
    description: "Vienmērīgs spēks visā frontē — piemērota pirmajai spēlei.",
    strength: "Nav acīmredzamu vājo vietu",
    tradeoff: "Neviena zona nav izcili stipra",
    rows: [
      "ISLKKLSIMP",
      "CJJNICGNLK",
      "INBFBNIJIN",
      "BBISLBIKSB",
    ],
  },
  {
    id: "aggressive",
    name: "Agresīvā",
    description: "Spēcīgas figūras priekšējā rindā ātram uzbrukumam.",
    strength: "Spēcīga pirmā rinda",
    tradeoff: "Karogs atrodas tuvāk frontei",
    rows: [
      "MGCCJJJKKK",
      "KSILLNSNPI",
      "NNSIILINBB",
      "BBBBFILSII",
    ],
  },
  {
    id: "defensive",
    name: "Aizsardzības",
    description: "Karogs dziļi aizmugurē, bumbu siena priekšā.",
    strength: "Droši pasargāts karogs",
    tradeoff: "Lēnāks uzbrukums",
    rows: [
      "IISSLLISSI",
      "NNIINKLKIN",
      "BBBBFBBGJJ",
      "CCMJKKLPIN",
    ],
  },
  {
    id: "scouts",
    name: "Izlūku uzbrukums",
    description: "Daudz izlūku priekšā — ātra izpēte un spiediens.",
    strength: "Augsta mobilitāte un izlūkošana",
    tradeoff: "Izlūki ir vāji tiešā kaujā",
    rows: [
      "IIIISSIILL",
      "NPNKKLNLSS",
      "INJJCCGNMK",
      "BBBBFBKJBI",
    ],
  },
  {
    id: "flanks",
    name: "Flangu uzbrukums",
    description: "Spēks koncentrēts malējās kolonnās, vidus atstāts vieglāks.",
    strength: "Spēcīgi sāni",
    tradeoff: "Vājāks centrs",
    rows: [
      "MCJKINKJCG",
      "SLIINLSNKP",
      "INJILNISBB",
      "BBBBFLIKSI",
    ],
  },
];

export const RANDOM_FORMATION: Formation = {
  id: RANDOM_FORMATION_ID,
  name: "Nejaušā",
  description: "Katru reizi jauns, derīgs nejaušs izvietojums.",
  strength: "Neparedzams pretiniekam",
  tradeoff: "Bez īpašas struktūras",
  rows: ["", "", "", ""],
};

export function formationById(id: string): Formation | null {
  if (id === RANDOM_FORMATION_ID) return RANDOM_FORMATION;
  return FORMATIONS.find((f) => f.id === id) ?? null;
}

/** 4x10 matrix of specs for preview rendering (blue orientation). */
export function formationPreview(
  formation: Formation,
): (PieceSpec | null)[][] {
  if (formation.id === RANDOM_FORMATION_ID) {
    return Array.from({ length: 4 }, () =>
      Array.from({ length: BOARD_SIZE }, () => null),
    );
  }
  return formation.rows.map((row) =>
    [...row].map((ch) => CHAR_TO_SPEC[ch] ?? null),
  );
}

function cellForBlue(y: number, x: number): number {
  return y * BOARD_SIZE + x;
}

function cellForRed(y: number, x: number): number {
  return (9 - y) * BOARD_SIZE + x; // mirror vertically
}

/** Fresh piece ids generated per side. */
function pieceFromSpec(side: Side, spec: PieceSpec, index: number): Piece {
  const rank = spec.kind === "movable" ? spec.rank : null;
  return {
    id: `${side}-${rank ?? spec.kind}-${index}`,
    owner: side,
    kind: spec.kind,
    rank,
    redSees: side === "red",
    blueSees: side === "blue",
  };
}

export function applyFormation(
  formation: Formation,
  side: Side,
  rng: () => number = Math.random,
): Record<number, Piece> {
  if (formation.id === RANDOM_FORMATION_ID) {
    return randomSetup(side, rng);
  }
  const placement: Record<number, Piece> = {};
  const counters: Record<string, number> = {};
  formation.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const spec = CHAR_TO_SPEC[ch];
      if (!spec) return;
      const prefix = `${side}-${spec.kind === "movable" ? spec.rank : spec.kind}`;
      const index = counters[prefix] ?? 0;
      counters[prefix] = index + 1;
      const cell = side === "red" ? cellForRed(y, x) : cellForBlue(y, x);
      placement[cell] = pieceFromSpec(side, spec, index);
    });
  });
  return placement;
}

/**
 * Validates a placement against the classic inventory and deployment rules.
 * Returns a Latvian error message, or null when valid.
 */
export function validatePlacement(
  placement: Record<number, Piece>,
  side: Side,
): string | null {
  try {
    setSetup(createGame(), side, placement);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Nederīgs izvietojums";
  }
}

export function placementToSpecs(
  placement: Record<number, Piece>,
): Record<number, { kind: Piece["kind"]; rank: number | null }> {
  const specs: Record<number, { kind: Piece["kind"]; rank: number | null }> = {};
  for (const [cell, piece] of Object.entries(placement)) {
    specs[Number(cell)] = { kind: piece.kind, rank: piece.rank };
  }
  return specs;
}

export function specsToPlacement(
  specs: Record<number, { kind: Piece["kind"]; rank: number | null }>,
  side: Side,
): Record<number, Piece> {
  const army = createArmy(side);
  const byKey = new Map<string, Piece[]>();
  for (const p of army) {
    const key = `${p.kind}:${p.rank}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(p);
  }
  const placement: Record<number, Piece> = {};
  const used = new Set<string>();
  for (const [cellStr, spec] of Object.entries(specs)) {
    const cell = Number(cellStr);
    const key = `${spec.kind}:${spec.rank}`;
    const pool = byKey.get(key) ?? [];
    const piece = pool.find((p) => !used.has(p.id));
    if (!piece) continue;
    used.add(piece.id);
    placement[cell] = { ...piece, owner: side };
  }
  return placement;
}

/** Serializes a formation for saving (mirrors the engine's zone for blue). */
export function formationSignature(
  formation: Formation,
): Record<number, { kind: Piece["kind"]; rank: number | null }> {
  if (formation.id === RANDOM_FORMATION_ID) return {};
  const signature: Record<number, { kind: Piece["kind"]; rank: number | null }> =
    {};
  formation.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const spec = CHAR_TO_SPEC[ch];
      if (!spec) return;
      signature[cellForBlue(y, x)] = {
        kind: spec.kind,
        rank: spec.kind === "movable" ? spec.rank : null,
      };
    });
  });
  return signature;
}

export function formationFromSignature(
  signature: Record<number, { kind: Piece["kind"]; rank: number | null }>,
): string {
  // Rebuilds the canonical row-string id if the signature matches a preset.
  for (const formation of FORMATIONS) {
    const canonical = formationSignature(formation);
    if (JSON.stringify(canonical) === JSON.stringify(signature)) {
      return formation.id;
    }
  }
  return "custom";
}

export const FORMATION_BLUEPRINT_KEYS = Object.keys(CHAR_TO_SPEC);

export function specLabel(spec: PieceSpec | null): string {
  if (!spec) return "";
  if (spec.kind === "flag") return "Karogs";
  if (spec.kind === "bomb") return "Bumba";
  return `${spec.rank}`;
}

export function specChar(spec: PieceSpec | null): string {
  if (!spec) return "";
  return SPEC_TO_CHAR[spec.kind === "movable" ? String(spec.rank) : spec.kind] ?? "";
}

export const ARMY_SIZE_CONST = ARMY_SIZE;
