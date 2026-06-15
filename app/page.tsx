import { AppShell } from "@/components/app-shell";
import { seedConfigColumns, seedMaterials, seedMembers, seedTasks } from "@/lib/seed";

export default function HomePage() {
  return (
    <AppShell
      initialTasks={seedTasks}
      initialMaterials={seedMaterials}
      initialMembers={seedMembers}
      initialConfigColumns={seedConfigColumns}
    />
  );
}
