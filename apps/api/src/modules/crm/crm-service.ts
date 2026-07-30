import type { CrmConnection, CrmProvider } from "@b2b/domain";

import { createId } from "../../lib/ids.js";
import type { CrmAdapter } from "./crm-adapter.js";

export class CrmService {
  private readonly connections = new Map<string, CrmConnection>();

  constructor(private readonly adapters: Map<string, CrmAdapter>) {}

  createConnection(input: {
    partnerId: string;
    provider: CrmProvider;
    portalUrl: string;
    credentials: Record<string, string>;
  }): CrmConnection {
    const connection: CrmConnection = {
      id: createId(),
      partnerId: input.partnerId,
      provider: input.provider,
      portalUrl: input.portalUrl,
      credentials: input.credentials,
      isEnabled: true,
      createdAt: new Date().toISOString()
    };

    this.connections.set(connection.id, connection);
    return connection;
  }

  listConnections(partnerId: string): CrmConnection[] {
    return [...this.connections.values()].filter((connection) => connection.partnerId === partnerId);
  }

  getPrimaryConnection(partnerId: string): CrmConnection | undefined {
    return [...this.connections.values()].find(
      (connection) => connection.partnerId === partnerId && connection.isEnabled
    );
  }

  getAdapter(provider: CrmProvider): CrmAdapter {
    const adapter = this.adapters.get(provider);

    if (!adapter) {
      throw new Error(`Unsupported CRM provider: ${provider}`);
    }

    return adapter;
  }
}
