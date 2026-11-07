import type { Metadata } from "next";
import { KarogsApp } from "@/components/karogs/KarogsApp";

export const metadata: Metadata = {
  title: "Pievienoties Karogs spēlei",
  robots: { index: false, follow: false },
};

export default async function KarogsJoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <KarogsApp initialCode={code.toUpperCase()} />;
}
