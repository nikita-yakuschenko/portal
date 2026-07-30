import type { CatalogAsset, CatalogProject, TildaSyncResult } from "@b2b/domain";

import { createId } from "../../lib/ids.js";
import { slugify } from "../../lib/slug.js";
import type { TildaClient, TildaProduct } from "./tilda-client.js";

function mapAssets(projectId: string, product: TildaProduct): CatalogAsset[] {
  return product.images.map((sourceUrl, index) => ({
    id: createId(),
    projectId,
    sourceUrl,
    localPath: "",
    type: index === 1 ? "floor_plan" : "exterior",
    sortOrder: index,
    isPrimary: index === 0
  }));
}

export function mapTildaProduct(product: TildaProduct, now: string): CatalogProject {
  const projectId = createId();

  const project: CatalogProject = {
    id: projectId,
    source: "tilda",
    sourceUid: product.id,
    name: product.title,
    slug: slugify(product.title),
    description: product.description,
    currency: "RUB",
    projectUrl: product.url,
    active: true,
    sourcePayload: product as unknown as Record<string, unknown>,
    lastSyncedAt: now,
    assets: mapAssets(projectId, product)
  };

  if (product.area !== undefined) {
    project.area = product.area;
  }
  if (product.floors !== undefined) {
    project.floors = product.floors;
  }
  if (product.bedrooms !== undefined) {
    project.bedrooms = product.bedrooms;
  }
  if (product.bathrooms !== undefined) {
    project.bathrooms = product.bathrooms;
  }
  if (product.price !== undefined) {
    project.basePrice = product.price;
  }

  return project;
}

export class CatalogService {
  private readonly projects = new Map<string, CatalogProject>();

  constructor(private readonly tildaClient: TildaClient) {}

  async syncFromTilda(): Promise<TildaSyncResult> {
    const products = await this.tildaClient.fetchProducts();
    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;
    let assetsDiscovered = 0;

    for (const product of products) {
      const existing = [...this.projects.values()].find(
        (project) => project.source === "tilda" && project.sourceUid === product.id
      );
      const nextProject = mapTildaProduct(product, now);
      assetsDiscovered += nextProject.assets.length;

      if (existing) {
        this.projects.set(existing.id, { ...nextProject, id: existing.id });
        updated += 1;
        continue;
      }

      this.projects.set(nextProject.id, nextProject);
      created += 1;
    }

    return {
      created,
      updated,
      assetsDiscovered,
      errors: []
    };
  }

  listProjects(): CatalogProject[] {
    return [...this.projects.values()];
  }

  getProject(projectId: string): CatalogProject | undefined {
    return this.projects.get(projectId);
  }
}
