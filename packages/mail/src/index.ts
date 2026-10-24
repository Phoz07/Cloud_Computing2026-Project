import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { MailTemplate, MailTemplates } from "./templates";

export type * from "./templates";

/** What a mail says: one of the templates in apps/mail-worker/emails, with its props. */
export type MailContent = {
  [K in MailTemplate]: { template: K; props: MailTemplates[K] };
}[MailTemplate];

export type MailMessage = { to: string } & MailContent;

export const sqs = new SQSClient({
  region: process.env.AWS_REGION,
  endpoint: process.env.SQS_ENDPOINT,
});

export const mailQueueUrl = process.env.MAIL_QUEUE_URL!;

export async function enqueueMail(message: MailMessage) {
  await sqs.send(
    new SendMessageCommand({ QueueUrl: mailQueueUrl, MessageBody: JSON.stringify(message) }),
  );
}

/** The message's shape only: whether `template` exists is up to the worker that renders it. */
export function parseMailMessage(body: string | undefined): MailMessage | null {
  try {
    const value = JSON.parse(body ?? "");
    if (typeof value?.to !== "string" || typeof value?.template !== "string") return null;
    if (typeof value.props !== "object" || value.props === null) return null;
    return value;
  } catch {
    return null;
  }
}
