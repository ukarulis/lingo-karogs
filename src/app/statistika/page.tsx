import type { Metadata } from "next";
import { StatsPage } from "@/components/stats/StatsPage";

export const metadata: Metadata = {
  title: "Statistika",
  description: "Tavi Lingo un Karogs rezultāti, sērijas, sasniegumi un līderu tabula.",
};

export default function StatistikaPage() {
  return <StatsPage />;
}
