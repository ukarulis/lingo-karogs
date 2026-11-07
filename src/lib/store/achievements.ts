import { storageGet, storageSet } from "./storage";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: "lingo-first-win", title: "Pirmais vārds", description: "Atmini savu pirmo Lingo vārdu", icon: "Sparkles" },
  { id: "lingo-first-try", title: "Ideālais minējums", description: "Atmini vārdu ar pirmo mēģinājumu", icon: "Target" },
  { id: "lingo-daily-5", title: "Nedēļas ritms", description: "5 dienas pēc kārtas uzmini dienas vārdu", icon: "CalendarCheck" },
  { id: "lingo-arcade-1000", title: "Spēļu zāle", description: "Klasiskajā režīmā sasniedz 1000 punktus", icon: "Gamepad2" },
  { id: "karogs-first-win", title: "Pirmā uzvara", description: "Uzvari savu pirmo Karogs spēli", icon: "Flag" },
  { id: "karogs-hard-ai", title: "Ģenerālmajors", description: "Uzvari pret spēcīgu datoru", icon: "Medal" },
  { id: "karogs-spy", title: "Slepenā operācija", description: "Uzveic maršalu ar spiegu", icon: "EyeOff" },
  { id: "karogs-defuse", title: "Sapieris", description: "Atbruņo bumbu ar mīnētāju", icon: "Zap" },
  { id: "karogs-online", title: "Tiešsaistes ģenerālis", description: "Uzvari tiešsaistes spēli", icon: "Globe" },
];

export type AchievementsState = Record<string, number>;

export function loadAchievements(): AchievementsState {
  return storageGet<AchievementsState>("achievements") ?? {};
}

export function unlock(id: string): AchievementsState {
  const state = loadAchievements();
  if (state[id]) return state;
  const next = { ...state, [id]: Date.now() };
  storageSet("achievements", next);
  return next;
}

export type GameEvent =
  | { kind: "lingo-won"; attempts: number; mode: string }
  | { kind: "lingo-daily-won"; streak: number }
  | { kind: "lingo-arcade-score"; score: number }
  | { kind: "karogs-won"; opponent: string }
  | { kind: "karogs-spy-kill" }
  | { kind: "karogs-defuse" };

export function recordGameEvent(event: GameEvent): string[] {
  const unlockedIds: string[] = [];
  const push = (id: string) => {
    if (!loadAchievements()[id]) {
      unlock(id);
      unlockedIds.push(id);
    }
  };
  switch (event.kind) {
    case "lingo-won":
      push("lingo-first-win");
      if (event.attempts === 1) push("lingo-first-try");
      break;
    case "lingo-daily-won":
      if (event.streak >= 5) push("lingo-daily-5");
      break;
    case "lingo-arcade-score":
      if (event.score >= 1000) push("lingo-arcade-1000");
      break;
    case "karogs-won":
      push("karogs-first-win");
      if (event.opponent === "ai-hard") push("karogs-hard-ai");
      if (event.opponent === "online") push("karogs-online");
      break;
    case "karogs-spy-kill":
      push("karogs-spy");
      break;
    case "karogs-defuse":
      push("karogs-defuse");
      break;
  }
  return unlockedIds;
}
