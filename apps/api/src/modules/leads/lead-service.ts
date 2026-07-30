import type {
  CatalogProject,
  LeadDelivery,
  LeadEvent,
  Partner,
  PartnerSite
} from "@b2b/domain";

import { createId } from "../../lib/ids.js";
import { CrmService } from "../crm/crm-service.js";

export class LeadService {
  private readonly events = new Map<string, LeadEvent>();
  private readonly deliveries = new Map<string, LeadDelivery>();

  constructor(private readonly crmService: CrmService) {}

  async createLead(input: {
    partner: Partner;
    site: PartnerSite;
    project?: CatalogProject;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    message?: string;
  }): Promise<{ event: LeadEvent; delivery?: LeadDelivery }> {
    const event: LeadEvent = {
      id: createId(),
      partnerId: input.partner.id,
      siteId: input.site.id,
      type: input.project ? "price_request" : "contact_request",
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      metadata: {
        projectName: input.project?.name ?? ""
      },
      createdAt: new Date().toISOString()
    };

    if (input.project) {
      event.projectId = input.project.id;
    }
    if (input.customerEmail !== undefined) {
      event.customerEmail = input.customerEmail;
    }
    if (input.message !== undefined) {
      event.message = input.message;
    }

    this.events.set(event.id, event);

    const connection = this.crmService.getPrimaryConnection(input.partner.id);
    if (!connection) {
      return { event };
    }

    const adapter = this.crmService.getAdapter(connection.provider);
    const payload = {
      leadEvent: event,
      partner: input.partner,
      site: input.site
    } as const;
    const sendResult = await adapter.sendLead(
      connection,
      input.project ? { ...payload, project: input.project } : payload
    );

    const delivery: LeadDelivery = {
      id: createId(),
      leadEventId: event.id,
      crmConnectionId: connection.id,
      status: sendResult.success ? "sent" : "failed",
      attemptedAt: new Date().toISOString()
    };

    if (sendResult.externalLeadId !== undefined) {
      delivery.externalLeadId = sendResult.externalLeadId;
    }
    if (sendResult.errorMessage !== undefined) {
      delivery.errorMessage = sendResult.errorMessage;
    }

    this.deliveries.set(delivery.id, delivery);
    return { event, delivery };
  }

  listEvents(partnerId?: string): LeadEvent[] {
    const events = [...this.events.values()];
    return partnerId ? events.filter((event) => event.partnerId === partnerId) : events;
  }

  listDeliveries(partnerId: string): LeadDelivery[] {
    const partnerEvents = new Set(this.listEvents(partnerId).map((event) => event.id));
    return [...this.deliveries.values()].filter((delivery) => partnerEvents.has(delivery.leadEventId));
  }
}
