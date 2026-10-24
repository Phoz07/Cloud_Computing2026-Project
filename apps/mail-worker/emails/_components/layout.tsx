import { useContext, type ReactNode } from "react";
import { Body, Column, Container, Head, Heading, Html, Img, Link, Preview, Row, Section, Tailwind, Text } from "react-email";
import { MailAssets } from "./assets";
import { appUrl } from "./format";
import { theme } from "./theme";

/**
 * The frame every mail shares: the logo, a white card with the heading and `children`, and the
 * footer. `preview` is the line inboxes show after the subject.
 */
export function MailLayout({ preview, heading, children }: { preview: string; heading: string; children: ReactNode }) {
  // read here, above <Tailwind>, which walks its children's elements
  const { logo } = useContext(MailAssets);
  return (
    <Html lang="th">
      <Tailwind config={theme}>
        <Head />
        <Preview>{preview}</Preview>
        <Body lang="th" className="m-0 bg-muted px-3 py-8 font-sans text-foreground">
          <Container className="mx-auto max-w-[560px]">
            <Section className="mb-5 px-1" data-skip-in-text>
              <Row>
                <Column className="w-[48px]">
                  <Link href={appUrl}>
                    <Img src={logo} width="36" height="36" alt="Eventide" className="block rounded-[9px]" />
                  </Link>
                </Column>
                <Column>
                  <Link href={appUrl} className="text-xl font-semibold text-primary no-underline">
                    Eventide
                  </Link>
                </Column>
              </Row>
            </Section>
            <Section className="rounded-[12px] border border-solid border-border bg-background px-8 py-8">
              <Heading as="h1" className="m-0 mb-6 text-2xl font-semibold leading-9 text-foreground">
                {heading}
              </Heading>
              {children}
            </Section>
            <Section className="mt-6 px-1">
              <Text className="m-0 text-xs leading-5 text-muted-foreground">
                อีเมลฉบับนี้ส่งโดยอัตโนมัติจาก{" "}
                <Link href={appUrl} className="text-muted-foreground underline">
                  Eventide
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
