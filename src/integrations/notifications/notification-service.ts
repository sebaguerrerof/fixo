export type NotificationChannel = "in_app" | "email" | "push" | "whatsapp";

export interface NotificationMessage {
  readonly recipientId: string;
  readonly title: string;
  readonly body: string;
  readonly channel: NotificationChannel;
}

export interface NotificationService {
  send(message: NotificationMessage): Promise<NotificationReceipt>;
}
/** Provider acceptance is not proof of final delivery. */
export interface NotificationReceipt {
  readonly reference: string;
  readonly state: "captured" | "accepted";
}
