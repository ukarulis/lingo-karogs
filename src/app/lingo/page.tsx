import type { Metadata } from "next";
import { LingoApp } from "@/components/lingo/LingoApp";

export const metadata: Metadata = {
  title: "Lingo",
  description:
    "Atmini latviešu piecu burtu vārdus. Dienas vārds, neierobežotā spēle un klasiskais Lingo ar dzīvībām un palīdzībām.",
};

export default function LingoPage() {
  return <LingoApp />;
}
