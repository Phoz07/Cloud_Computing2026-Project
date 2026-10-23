import { DeleteMessageCommand, ReceiveMessageCommand, type Message } from "@aws-sdk/client-sqs";
import { mailQueueUrl, parseMailMessage, sqs } from "@app/mail";
import { from, isDryRun, transporter } from "./transporter";

const shutdown = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => shutdown.abort());
}

// Failed messages are not deleted: they reappear after the visibility timeout
// and move to mail-dlq after maxReceiveCount (see infra/elasticmq/elasticmq.conf).
async function handle(message: Message) {
  const mail = parseMailMessage(message.Body);
  if (!mail) {
    console.error(`Invalid mail message ${message.MessageId}`, message.Body);
    return;
  }

  try {
    const info = await transporter.sendMail({ from, ...mail });
    if (isDryRun) console.log(`[dry-run] ${info.message}`);
    else console.log(`Sent mail ${info.messageId} to ${mail.to}`);

    await sqs.send(
      new DeleteMessageCommand({ QueueUrl: mailQueueUrl, ReceiptHandle: message.ReceiptHandle }),
    );
  } catch (error) {
    console.error(`Failed to send mail ${message.MessageId} to ${mail.to}`, error);
  }
}

async function poll() {
  while (!shutdown.signal.aborted) {
    try {
      const { Messages = [] } = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: mailQueueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 10,
        }),
        { abortSignal: shutdown.signal },
      );
      await Promise.all(Messages.map(handle));
    } catch (error) {
      if (shutdown.signal.aborted) break;
      console.error(`Failed to receive from mail queue, retrying in 5s: ${(error as Error).message}`);
      await Bun.sleep(5_000);
    }
  }
}

if (isDryRun) console.warn("GMAIL_USER / GMAIL_APP_PASSWORD not set: mail is logged, not sent");
console.log(`Mail worker is polling : ${mailQueueUrl}`);

await poll();
sqs.destroy();
transporter.close();
