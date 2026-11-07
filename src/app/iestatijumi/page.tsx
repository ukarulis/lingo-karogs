import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

export const metadata: Metadata = {
  title: "Iestatījumi",
  description: "Tēma, Lingo krāsu shēma, skaņas, segvārds un vietējo datu pārvaldība.",
};

export default function IestatijumiPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-black tracking-tight sm:text-3xl">Iestatījumi</h1>
      <SettingsPanel />
    </div>
  );
}
