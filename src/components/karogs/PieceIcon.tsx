"use client";

import { memo } from "react";
import type { HiddenPiece, Piece } from "@/lib/karogs/engine";

const SIDE_COLOR: Record<string, string> = { red: "#dc2626", blue: "#2563eb" };
const SIDE_DARK: Record<string, string> = { red: "#7f1d1d", blue: "#1e3a8a" };

export const PieceIcon = memo(function PieceIcon({
  piece,
  size = "100%",
}: {
  piece: Piece | HiddenPiece | null;
  size?: number | string;
}) {
  if (!piece) return null;
  if ("hidden" in piece) {
    return (
      <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden>
        <circle cx="18" cy="18" r="15" fill="#57534e" stroke="#292524" strokeWidth="2" />
        <circle cx="18" cy="18" r="11.5" fill="none" stroke="#a8a29e" strokeWidth="1.2" strokeDasharray="3 2" />
        <text
          x="18"
          y="24"
          textAnchor="middle"
          fontSize="15"
          fontWeight="800"
          fill="#e7e5e4"
          fontFamily="Arial, sans-serif"
        >
          ?
        </text>
      </svg>
    );
  }
  const color = SIDE_COLOR[piece.owner];
  const dark = SIDE_DARK[piece.owner];

  if (piece.kind === "flag") {
    return (
      <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden>
        <circle cx="18" cy="18" r="15" fill="#f5f5f4" stroke={dark} strokeWidth="2" />
        <line x1="13" y1="9" x2="13" y2="28" stroke="#44403c" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M14 10 L25 13 L14 17 Z" fill={color} />
      </svg>
    );
  }
  if (piece.kind === "bomb") {
    return (
      <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden>
        <circle cx="18" cy="18" r="15" fill="#1c1917" stroke="#0c0a09" strokeWidth="2" />
        <path
          d="M24 5 C23 9 20 10 18 11"
          fill="none"
          stroke="#a8a29e"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="24.5" cy="4" r="2.2" fill="#f59e0b" />
        <text
          x="18"
          y="24"
          textAnchor="middle"
          fontSize="13"
          fontWeight="800"
          fill="#f5f5f4"
          fontFamily="Arial, sans-serif"
        >
          B
        </text>
      </svg>
    );
  }

  const rank = piece.rank ?? 0;
  const isSpy = rank === 1;
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden>
      <circle cx="18" cy="18" r="15" fill={color} stroke={dark} strokeWidth="2" />
      {isSpy ? (
        <path
          d="M13 23 C14 18 16 16 18 16 C20 16 22 18 23 23 Z"
          fill="#111827"
          opacity="0.85"
        />
      ) : (
        <circle cx="18" cy="18" r="11.5" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.3" />
      )}
      <text
        x="18"
        y="24"
        textAnchor="middle"
        fontSize={isSpy ? "11" : "15"}
        fontWeight="800"
        fill="#ffffff"
        fontFamily="Arial, sans-serif"
      >
        {isSpy ? "S" : rank}
      </text>
    </svg>
  );
});

export function pieceAriaLabel(piece: Piece | HiddenPiece | null): string {
  if (!piece) return "Tukšs lauciņš";
  if ("hidden" in piece) return "Nezināma pretinieka figūra";
  const owner = piece.owner === "red" ? "sarkanā" : "zilā";
  if (piece.kind === "flag") return `${owner} karogs`;
  if (piece.kind === "bomb") return `${owner} bumba`;
  const names: Record<number, string> = {
    10: "maršals",
    9: "ģenerālis",
    8: "pulkvedis",
    7: "majors",
    6: "kapteinis",
    5: "leitnants",
    4: "seržants",
    3: "mīnētājs",
    2: "izlūks",
    1: "spiegs",
  };
  return `${owner} ${names[piece.rank ?? 0]}`;
}
