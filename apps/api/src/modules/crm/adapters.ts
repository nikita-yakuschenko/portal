import type { CrmConnection, CrmRequestPayload, CrmSendResult } from "@b2b/domain";

import type { CrmAdapter } from "./crm-adapter.js";

/**
 * Адаптеры площадок. Отправка ещё не реализована: sendRequest честно
 * возвращает отказ, чтобы заявка не помечалась доставленной. Настоящие
 * вызовы появятся, когда будет доступ к реальным порталам — см. README.
 */

const NOT_IMPLEMENTED = "Передача заявок в CRM ещё не подключена.";

function hasRequiredCredentials(connection: CrmConnection, requiredKeys: string[]): boolean {
  return requiredKeys.every((key) => Boolean(connection.credentials[key]));
}

abstract class BaseCrmAdapter implements CrmAdapter {
  abstract provider: "amocrm" | "bitrix24";
  protected abstract requiredKeys: string[];

  async validateConnection(connection: CrmConnection): Promise<boolean> {
    return hasRequiredCredentials(connection, this.requiredKeys);
  }

  async sendRequest(
    connection: CrmConnection,
    _payload: CrmRequestPayload
  ): Promise<CrmSendResult> {
    if (!(await this.validateConnection(connection))) {
      return { success: false, errorMessage: "Подключение заполнено не полностью." };
    }
    return { success: false, errorMessage: NOT_IMPLEMENTED };
  }
}

export class AmoCrmAdapter extends BaseCrmAdapter {
  provider = "amocrm" as const;
  protected requiredKeys = ["clientId", "clientSecret", "refreshToken"];
}

export class Bitrix24Adapter extends BaseCrmAdapter {
  provider = "bitrix24" as const;
  protected requiredKeys = ["webhookUrl"];
}

export function createCrmAdapters(): Map<string, CrmAdapter> {
  return new Map<string, CrmAdapter>([
    ["amocrm", new AmoCrmAdapter()],
    ["bitrix24", new Bitrix24Adapter()]
  ]);
}
