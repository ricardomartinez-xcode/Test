import { AppShellV2 } from "@/components/app-shell-v2";
import { seedConfigColumns, seedMaterials, seedMembers, seedTasks } from "@/lib/seed";

export default function HomePage() {
  return (
    <AppShellV2
      initialTasks={seedTasks}
      initialMaterials={seedMaterials}
      initialMembers={seedMembers}
      initialConfigColumns={seedConfigColumns}
    />
  );
}
