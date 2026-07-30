import type { AnalyticsSnapshot, CatalogProject, LeadEvent } from "@b2b/domain";

export class AnalyticsService {
  buildSnapshots(projects: CatalogProject[], events: LeadEvent[]): AnalyticsSnapshot[] {
    return projects.map((project) => {
      const projectEvents = events.filter((event) => event.projectId === project.id);
      const priceRequestEvents = projectEvents.filter((event) => event.type === "price_request");
      const contactRequestEvents = projectEvents.filter((event) => event.type === "contact_request");
      const snapshot: AnalyticsSnapshot = {
        projectId: project.id,
        projectName: project.name,
        priceRequests: priceRequestEvents.length,
        contactRequests: contactRequestEvents.length
      };

      const lastRequestedAt = [...projectEvents]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.createdAt;

      if (lastRequestedAt !== undefined) {
        snapshot.lastRequestedAt = lastRequestedAt;
      }

      return snapshot;
    });
  }
}
