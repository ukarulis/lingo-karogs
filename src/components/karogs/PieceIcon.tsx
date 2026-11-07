"use client";

import { memo, useId } from "react";
import type { HiddenPiece, Piece } from "@/lib/karogs/engine";

const SIDE_MAIN: Record<string, string> = { red: "#dc2626", blue: "#2563eb" };
const SIDE_EDGE: Record<string, string> = { red: "#7f1d1d", blue: "#1e3a8a" };
const SIDE_SOFT: Record<string, string> = { red: "#fee2e2", blue: "#dbeafe" };

const EMBLEM = "#ffffff";

/**
 * Military unit artwork. Each piece shares a round medallion base with the
 * army colour; the emblem (stars, chevrons, tools) encodes the rank, and the
 * rank number stays visible for quick identification.
 */
export const PieceIcon = memo(function PieceIcon({
  piece,
  size = "100%",
}: {
  piece: Piece | HiddenPiece | null;
  size?: number | string;
}) {
  const gradientId = useId();
  if (!piece) return null;

  if ("hidden" in piece) {
    const main = SIDE_MAIN[piece.owner] ?? "#57534e";
    const edge = SIDE_EDGE[piece.owner] ?? "#292524";
    return (
      <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden>
        <defs>
          <radialGradient id={gradientId} cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor={main} />
            <stop offset="100%" stopColor={edge} />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="15" fill={`url(#${gradientId})`} stroke={edge} strokeWidth="2" />
        <circle cx="18" cy="18" r="11.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeDasharray="3 2" />
        <text
          x="18"
          y="24"
          textAnchor="middle"
          fontSize="15"
          fontWeight="800"
          fill="#ffffff"
          fontFamily="Arial, sans-serif"
        >
          ?
        </text>
      </svg>
    );
  }

  const main = SIDE_MAIN[piece.owner] ?? "#57534e";
  const edge = SIDE_EDGE[piece.owner] ?? "#292524";
  const soft = SIDE_SOFT[piece.owner] ?? "#e7e5e4";

  if (piece.kind === "flag") {
    return (
      <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden>
        <defs>
          <radialGradient id={gradientId} cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="100%" stopColor="#f5f5f4" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="15" fill={`url(#${gradientId})`} stroke={edge} strokeWidth="2" />
        <line x1="14" y1="8" x2="14" y2="28" stroke="#44403c" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M15 10 L25.5 13.2 L15 16.6 Z" fill={main} />
        <path d="M15 11.2 L23.5 13.4 L15 15.6 Z" fill="#ffffff" opacity="0.35" />
      </svg>
    );
  }

  if (piece.kind === "bomb") {
    return (
      <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden>
        <defs>
          <radialGradient id={gradientId} cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#44403c" />
            <stop offset="100%" stopColor="#0c0a09" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="15" fill={`url(#${gradientId})`} stroke="#0c0a09" strokeWidth="2" />
        <path d="M24.5 5.5 C23.4 9.2 20.4 10.8 17.8 11.4" fill="none" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" />
        <circle cx="25" cy="4.2" r="2.3" fill="#f59e0b">
          <animate attributeName="opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <text
          x="18"
          y="24"
          textAnchor="middle"
          fontSize="12"
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
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="30%" r="85%">
          <stop offset="0%" stopColor={main} />
          <stop offset="100%" stopColor={edge} />
        </radialGradient>
      </defs>
      <circle cx="18" cy="18" r="15" fill={`url(#${gradientId})`} stroke={edge} strokeWidth="1.6" />
      <circle cx="18" cy="18" r="12.4" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
      {piece.kind === "movable" ? <MovableEmblem rank={rank} main={main} soft={soft} /> : null}
      <text
        x="18"
        y="31"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="800"
        fill={EMBLEM}
        opacity="0.9"
        fontFamily="Arial, sans-serif"
      >
        {rank}
      </text>
    </svg>
  );
});

function MovableEmblem({ rank, main, soft }: { rank: number; main: string; soft: string }) {
  // Scout: binoculars
  if (rank === 2) {
    return (
      <g>
        <circle cx="13.5" cy="15" r="3.4" fill={EMBLEM} />
        <circle cx="22.5" cy="15" r="3.4" fill={EMBLEM} />
        <circle cx="13.5" cy="15" r="1.4" fill={main} />
        <circle cx="22.5" cy="15" r="1.4" fill={main} />
        <path
          d="M16.9 15 L19.1 15 M16.9 15 L15.4 21 L20.6 21 L19.1 15"
          stroke={EMBLEM}
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    );
  }
  // Miner: crossed pickaxe and shovel
  if (rank === 3) {
    return (
      <g>
        <path d="M11 23 L21.5 12" stroke={EMBLEM} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M20.2 11 C19.8 9.2 18 8.8 17.2 9.6 C16.4 10.4 16.8 12.2 18.6 12.6 Z" fill={EMBLEM} />
        <path d="M25 23 L14.5 12" stroke={soft} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M14.2 11.2 L18 13.8 L16.4 15.4 Z" fill={soft} />
      </g>
    );
  }
  // Spy: shaded profile
  if (rank === 1) {
    return (
      <g>
        <circle cx="18" cy="12.5" r="4" fill={EMBLEM} />
        <path d="M11.5 24 C12 19.5 14.5 16.5 18 16.5 C21.5 16.5 24 19.5 24.5 24 Z" fill={EMBLEM} />
        <path d="M12.5 12.5 C15.5 11.5 20.5 11.5 23.5 12.5" stroke={main} strokeWidth="1.1" fill="none" />
        <circle cx="15.5" cy="12.5" r="0.9" fill={main} />
        <circle cx="20.5" cy="12.5" r="0.9" fill={main} />
      </g>
    );
  }
  // Sergeants and lieutenants: chevrons
  if (rank <= 5) {
    const chevrons = rank <= 4 ? rank - 1 : 2;
    return (
      <g>
        {[0, 1].slice(0, chevrons).map((i) => (
          <path
            key={i}
            d={`M12 ${17 + i * 3.4} L18 ${13 + i * 3.4} L24 ${17 + i * 3.4}`}
            stroke={EMBLEM}
            strokeWidth="1.9"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
    );
  }
  // Marshal (10): single large star with wreath
  if (rank === 10) {
    return (
      <g>
        <Star cx={18} cy={15} r={8.2} fill={EMBLEM} />
        <path
          d="M18 23.5 C15 20.5 13 18.5 11 15.5 C13 12.5 15 10.5 18 7.5 C21 10.5 23 12.5 25 15.5 C23 18.5 21 20.5 18 23.5 Z"
          fill="none"
          stroke={soft}
          strokeWidth="1.1"
        />
      </g>
    );
  }
  // Captains and above: stars by rank
  const stars = rank - 5;
  const positions: Array<[number, number]> =
    stars === 4
      ? [[13, 12.5], [23, 12.5], [13, 20], [23, 20]]
      : stars === 3
        ? [[13, 11.5], [23, 11.5], [18, 20.5]]
        : stars === 2
          ? [[13, 13.5], [23, 19.5]]
          : [[18, 16]];
  return (
    <g>
      {positions.map(([cx, cy], i) => (
        <Star key={i} cx={cx} cy={cy} r={stars === 1 ? 7 : 4.6} fill={EMBLEM} />
      ))}
    </g>
  );
}

function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? r : r * 0.45;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
  return <polygon points={points} fill={fill} />;
}

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
