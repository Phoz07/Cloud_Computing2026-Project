import type { ReactNode } from "react";
import type { MailEvent } from "@app/mail";
import { Button, Section, Text } from "react-email";
import { formatMailTime } from "./format";

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text className="m-0 mb-4 text-base leading-7 text-foreground">{children}</Text>;
}

/** Small print under the content, e.g. "ignore this if it wasn't you". */
export function Fineprint({ children }: { children: ReactNode }) {
  return <Text className="m-0 mt-4 text-sm leading-6 text-muted-foreground">{children}</Text>;
}

export function Greeting({ name }: { name: string | null }) {
  return <Paragraph>{name ? `สวัสดีคุณ ${name}` : "สวัสดี"}</Paragraph>;
}

export function CtaButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section className="my-6">
      <Button
        href={href}
        className="box-border rounded-[8px] bg-primary px-6 py-3 text-center text-base font-semibold text-primary-foreground"
      >
        {children}
      </Button>
    </Section>
  );
}

export type Detail = [label: string, value: ReactNode];

/**
 * A label/value list on a muted panel. One table, not a Row per line (each Row is its own table),
 * so the values line up; dataTable keeps them in columns in the plain text too.
 */
export function Details({ rows }: { rows: Detail[] }) {
  return (
    <Section className="my-6 rounded-[8px] bg-muted px-5 py-4">
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} data-text-format="dataTable">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td width={96} className="py-1 pr-3 align-top text-sm leading-6 text-muted-foreground">
                {label}
              </td>
              <td className="py-1 align-top text-sm font-medium leading-6 text-foreground">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

/** The event (and the tickets, when there are any), followed by `extra` rows such as an amount. */
export function EventDetails({
  event,
  ticketType,
  quantity,
  extra = [],
}: {
  event: MailEvent;
  ticketType?: string;
  quantity?: number;
  extra?: Detail[];
}) {
  const rows: Detail[] = [["อีเวนต์", event.title]];
  if (ticketType) rows.push(["ตั๋ว", quantity ? `${ticketType} × ${quantity}` : ticketType]);
  rows.push(["วันเวลา", formatMailTime(event.startsAt)], ["สถานที่", event.venue], ...extra);
  return <Details rows={rows} />;
}

/** A message someone wrote to the recipient, e.g. the organizer's reason. */
export function Note({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Section className="my-6 rounded-r-[8px] border-0 border-l-4 border-solid border-primary bg-muted px-5 py-4">
      <Text className="m-0 text-xs font-medium leading-5 text-muted-foreground">{label}</Text>
      <Text className="m-0 mt-1 whitespace-pre-line text-base leading-7 text-foreground">{children}</Text>
    </Section>
  );
}

export function TicketCode({ code }: { code: string }) {
  return (
    <Section className="my-6 rounded-[8px] border border-solid border-border px-5 py-4 text-center">
      <Text className="m-0 text-xs leading-5 text-muted-foreground">รหัสตั๋ว</Text>
      <Text className="m-0 mt-1 font-mono text-[28px] font-semibold leading-10 tracking-[4px] text-foreground">{code}</Text>
    </Section>
  );
}
