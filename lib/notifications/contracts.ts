import type { Notification } from "@/lib/types";

export interface NotificationSender {
  send(notification: Notification): Promise<Notification>;
}
