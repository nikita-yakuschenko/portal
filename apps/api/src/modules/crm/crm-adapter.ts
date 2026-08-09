import type { CrmConnection, CrmProvider, CrmRequestPayload, CrmSendResult } from "@b2b/domain";

export interface CrmAdapter {
  provider: CrmProvider;
  /** Хватает ли данных подключения, чтобы вообще пытаться отправлять */
  validateConnection(connection: CrmConnection): Promise<boolean>;
  sendRequest(connection: CrmConnection, payload: CrmRequestPayload): Promise<CrmSendResult>;
}
