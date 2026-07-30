import type { CrmConnection, CrmLeadPayload, CrmProvider, CrmSendResult } from "@b2b/domain";

export interface CrmAdapter {
  provider: CrmProvider;
  validateConnection(connection: CrmConnection): Promise<boolean>;
  sendLead(connection: CrmConnection, payload: CrmLeadPayload): Promise<CrmSendResult>;
  syncFields(connection: CrmConnection): Promise<string[]>;
  healthcheck(connection: CrmConnection): Promise<boolean>;
}
