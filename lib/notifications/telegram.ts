export type TelegramDelivery = { delivered: boolean; reason?: string };

export type TelegramClientOptions = {
  token?: string;
  chatId?: string;
  fetchImpl?: typeof fetch;
};

export class TelegramClient {
  private readonly token?: string;
  private readonly chatId?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TelegramClientOptions) {
    this.token = options.token;
    this.chatId = options.chatId;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async sendMessage(text: string): Promise<TelegramDelivery> {
    if (!this.token || !this.chatId) return { delivered: false, reason: "not configured" };
    const response = await this.fetchImpl(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: this.chatId, text }),
    });
    if (!response.ok) return { delivered: false, reason: `Telegram returned HTTP ${response.status}.` };
    return { delivered: true };
  }
}

export function createTelegramClientFromEnv(): TelegramClient {
  return new TelegramClient({ token: process.env.TELEGRAM_BOT_TOKEN, chatId: process.env.TELEGRAM_CHAT_ID });
}
