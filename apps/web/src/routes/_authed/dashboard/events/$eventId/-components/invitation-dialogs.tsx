import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, MailPlus, Mails, Save } from "lucide-react";
import { z } from "zod";
import { SubmitButton, TextField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { eventClient } from "@/lib/api";
import { problemMessage } from "@/lib/auth-errors";
import { invitationsKey, isEmail, MAX_EMAILS_PER_INVITE, parseEmails, type Invitation } from "@/lib/invitations";

type DialogProps = { eventId: string; open: boolean; onOpenChange: (open: boolean) => void };

const inviteSchema = z.object({
  emails: z.string().superRefine((value, ctx) => {
    const emails = parseEmails(value);
    if (emails.length === 0) {
      ctx.addIssue({ code: "custom", message: "กรุณากรอกอีเมลอย่างน้อย 1 อีเมล" });
      return;
    }
    const invalid = emails.filter((email) => !isEmail(email));
    if (invalid.length > 0) {
      const more = invalid.length > 3 ? ` และอีก ${invalid.length - 3} รายการ` : "";
      ctx.addIssue({ code: "custom", message: `อีเมลไม่ถูกต้อง: ${invalid.slice(0, 3).join(", ")}${more}` });
    }
    if (emails.length > MAX_EMAILS_PER_INVITE) {
      ctx.addIssue({ code: "custom", message: `เชิญได้ครั้งละไม่เกิน ${MAX_EMAILS_PER_INVITE} อีเมล` });
    }
  }),
});

/** What happened to the invitation emails of a new batch, for the toast. */
function mailSummary(invited: Invitation[], inviteOnly: boolean) {
  if (!inviteOnly) return "จะส่งอีเมลเชิญเมื่อเผยแพร่แบบเฉพาะผู้ได้รับเชิญ";
  const unsent = invited.filter((invitation) => !invitation.notifiedAt).length;
  return unsent === 0 ? "ส่งอีเมลเชิญแล้ว" : `ส่งอีเมลเชิญไม่สำเร็จ ${unsent} อีเมล จะลองส่งใหม่เมื่อคุณเชิญหรือแก้ไขครั้งถัดไป`;
}

/**
 * Invites one or many emails at once, pasted from anywhere; emails already invited are skipped.
 * `inviteOnly`: the event is published invite-only, so the service emails the invitees right away.
 */
export function InviteDialog({ eventId, inviteOnly, open, onOpenChange }: DialogProps & { inviteOnly: boolean }) {
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: { emails: "" },
    validators: { onSubmit: inviteSchema },
    onSubmit: async ({ value }) => {
      const { data, error } = await eventClient.api.events({ id: eventId }).invitations.post({
        emails: parseEmails(value.emails),
      });
      if (error) return void toast.add({ type: "error", title: problemMessage(error) });
      const skipped = data.skipped.length > 0 ? ` · ข้าม ${data.skipped.length} อีเมลที่เชิญไว้แล้ว` : "";
      toast.add(
        data.invited.length > 0
          ? {
              type: data.invited.some((invitation) => !invitation.notifiedAt) && inviteOnly ? "warning" : "success",
              title: `เชิญแล้ว ${data.invited.length} อีเมล`,
              description: mailSummary(data.invited, inviteOnly) + skipped,
            }
          : { type: "info", title: "อีเมลทั้งหมดได้รับเชิญไว้แล้ว" },
      );
      form.reset();
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: invitationsKey(eventId) });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailPlus className="size-5" />
              เชิญผู้เข้าร่วม
            </DialogTitle>
            <DialogDescription>
              เชิญได้ทั้งคนที่มีบัญชีแล้วและยังไม่ได้สมัคร{" "}
              {inviteOnly
                ? "ผู้ได้รับเชิญจะได้รับอีเมลพร้อมลิงก์อีเวนต์ทันที"
                : "อีเมลเชิญจะถูกส่งเมื่อเปลี่ยนการเผยแพร่เป็น “เฉพาะผู้ได้รับเชิญ”"}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <form.Field name="emails">
              {(field) => {
                const found = parseEmails(field.state.value).length;
                return (
                  <TextField
                    field={field}
                    label="อีเมล"
                    icon={Mails}
                    multiline
                    autoFocus
                    placeholder={"somchai@example.com\nsomying@example.com"}
                    description={
                      found > 0
                        ? `พบ ${found} อีเมล`
                        : `คั่นแต่ละอีเมลด้วยการขึ้นบรรทัดใหม่ เว้นวรรค หรือจุลภาค (ครั้งละไม่เกิน ${MAX_EMAILS_PER_INVITE} อีเมล)`
                    }
                  />
                );
              }}
            </form.Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>ยกเลิก</DialogClose>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <SubmitButton pending={isSubmitting} icon={MailPlus}>
                  เชิญ
                </SubmitButton>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const editSchema = z.object({ email: z.email("กรุณากรอกอีเมลให้ถูกต้อง") });

/** Fixes a typo in an invitation that hasn't been used yet. */
export function EditInvitationDialog({ eventId, invitation, open, onOpenChange }: DialogProps & { invitation: Invitation }) {
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: { email: invitation.email },
    validators: { onSubmit: editSchema },
    onSubmit: async ({ value }) => {
      const email = value.email.trim().toLowerCase();
      if (email === invitation.email) return onOpenChange(false);
      const { error } = await eventClient.api.events({ id: eventId }).invitations({ invitationId: invitation.id }).patch({ email });
      if (error) return void toast.add({ type: "error", title: problemMessage(error) });
      toast.add({ type: "success", title: "บันทึกอีเมลแล้ว" });
      form.reset({ email });
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: invitationsKey(eventId) });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // reopening starts from the saved email, not an abandoned edit
        if (!next && !form.state.isSubmitting) form.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-5" />
              แก้ไขอีเมลที่เชิญ
            </DialogTitle>
            <DialogDescription>อีเมลเดิมจะเปิดอีเวนต์ไม่ได้อีก อีเมลใหม่จะเปิดได้และได้รับอีเมลเชิญแทน</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <form.Field name="email">
              {(field) => <TextField field={field} label="อีเมล" icon={Mail} type="email" autoComplete="off" autoFocus />}
            </form.Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>ยกเลิก</DialogClose>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <SubmitButton pending={isSubmitting} icon={Save}>
                  บันทึก
                </SubmitButton>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
