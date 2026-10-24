import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

export type MailMessage = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

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

export function parseMailMessage(body: string | undefined): MailMessage | null {
  try {
    const value = JSON.parse(body ?? "");
    if (typeof value?.to !== "string" || typeof value?.subject !== "string") return null;
    if (typeof value.html !== "string" && typeof value.text !== "string") return null;
    return value;
  } catch {
    return null;
  }
}
