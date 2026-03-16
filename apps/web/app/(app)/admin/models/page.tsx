import { prisma } from "@octopus/db";
import { ModelManager } from "../model-manager";

export default async function AdminModelsPage() {
  const models = await prisma.availableModel.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { displayName: "asc" }],
  });

  return <ModelManager models={models} />;
}
