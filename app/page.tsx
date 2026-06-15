import { AppShell } from "@/components/app-shell";
import { seedMaterials, seedTasks } from "@/lib/seed";

export default function HomePage() {
  return <AppShell initialTasks={seedTasks} initialMaterials={seedMaterials} />;
}
