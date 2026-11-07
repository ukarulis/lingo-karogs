import type { Metadata } from "next";
import { KarogsApp } from "@/components/karogs/KarogsApp";

export const metadata: Metadata = {
  title: "Karogs",
  description:
    "Stratēģijas spēle ar slepenām armijām: izvieto 40 figūras, aizsargā savu karogu un sagrāb pretinieka karogu. Pret datoru, divatā vai tiešsaistē.",
};

export default function KarogsPage() {
  return <KarogsApp />;
}
