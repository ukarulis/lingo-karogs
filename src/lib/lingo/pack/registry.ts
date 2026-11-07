import type { LanguagePack } from "./types";
import { latvianPack } from "./latvian";

const packs = new Map<string, LanguagePack>([[latvianPack.id, latvianPack]]);

export function registerPack(pack: LanguagePack): void {
  packs.set(pack.id, pack);
}

export function getPack(id: string): LanguagePack | undefined {
  return packs.get(id);
}

/**
 * Resolve a pack id to a pack, falling back to Latvian for unknown or
 * legacy (missing) identifiers.
 */
export function resolvePack(id: string | undefined | null): LanguagePack {
  return (id ? packs.get(id) : undefined) ?? latvianPack;
}

export const DEFAULT_PACK_ID = latvianPack.id;
