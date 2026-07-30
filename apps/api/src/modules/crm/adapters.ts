import type { CrmConnection, CrmLeadPayload, CrmSendResult } from "@b2b/domain";

import type { CrmAdapter } from "./crm-adapter.js";

function hasRequiredCredentials(connection: CrmConnection, requiredKeys: string[]): boolean {
  return requiredKeys.every((key) => Boolean(connection.credentials[key]));
}

abstract class BaseCrmAdapter implements CrmAdapter {
  abstract provider: "amocrm" | "bitrix24";
  protected abstract requiredKeys: string[];

  async validateConnection(connection: CrmConnection): Promise<boolean> {
    return hasRequiredCredentials(connection, this.requiredKeys);
  }

  async syncFields(): Promise<string[]> {
    return ["name", "phone", "email", "message", "projectName"];
  }

  async healthcheck(connection: CrmConnection): Promise<boolean> {
    return this.validateConnection(connection);
  }

  abstract sendLead(connection: CrmConnection, payload: CrmLeadPayload): Promise<CrmSendResult>;
}

export class AmoCrmAdapter extends BaseCrmAdapter {
  provider = "amocrm" as const;
  protected requiredKeys = ["clientId", "clientSecret", "refreshToken"];

  async sendLead(connection: CrmConnection, payload: CrmLeadPayload): Promise<CrmSendResult> {
    const isValid = await this.validateConnection(connection);

    if (!isValid) {
      return {
        success: false,
        errorMessage: "AmoCRM connection is not configured."
      };
    }

    return {
      success: true,
      externalLeadId: `amocrm-${payload.leadEvent.id}`
    };
  }
}

export class Bitrix24Adapter extends BaseCrmAdapter {
  provider = "bitrix24" as const;
  protected requiredKeys = ["webhookUrl"];

  async sendLead(connection: CrmConnection, payload: CrmLeadPayload): Promise<CrmSendResult> {
    const isValid = await this.validateConnection(connection);

    if (!isValid) {
      return {
        success: false,
        errorMessage: "Bitrix24 connection is not configured."
      };
    }

    return {
      success: true,
      externalLeadId: `bitrix24-${payload.leadEvent.id}`
    };
  }
}

export function createCrmAdapters(): Map<string, CrmAdapter> {
  return new Map<string, CrmAdapter>([
    ["amocrm", new AmoCrmAdapter()],
    ["bitrix24", new Bitrix24Adapter()]
  ]);
}
