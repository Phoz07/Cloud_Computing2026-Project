import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { IdCard, Mail, Pencil, Save, UserRound } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { SubmitButton, TextField } from "@/components/form-field";
import { RoleBadge } from "@/components/role-badge";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { auth, type SessionUser } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { formatDate } from "@/lib/format";
import { refreshSession, useSession } from "@/lib/session";
import { AvatarPicker } from "./-components/avatar-picker";
import { Section } from "./-components/section";

export const Route = createFileRoute("/_authed/profile/")({
  component: AccountPage,
});

function AccountPage() {
  const guarded = Route.useRouteContext().session;
  const { data: session } = useSession();
  // the route guard guarantees a session; fall back to the guard's copy while refetching
  return <AccountSection user={session?.user ?? guarded.user} />;
}

const nameSchema = z.object({
  name: z.string().trim().min(2, "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร").max(100, "ชื่อยาวเกินไป"),
  firstName: z.string().trim().max(100, "ชื่อยาวเกินไป"),
  lastName: z.string().trim().max(100, "นามสกุลยาวเกินไป"),
});

function AccountSection({ user }: { user: SessionUser }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  const form = useForm({
    defaultValues: { name: user.name, firstName: user.firstName ?? "", lastName: user.lastName ?? "" },
    validators: { onSubmit: nameSchema },
    onSubmit: async ({ value }) => {
      const { error } = await auth.updateUser({
        name: value.name.trim(),
        firstName: value.firstName.trim() || null,
        lastName: value.lastName.trim() || null,
      });
      if (error) return void toast.add({ type: "error", title: authErrorMessage(error) });
      await refreshSession(queryClient);
      toast.add({ type: "success", title: "บันทึกชื่อเรียบร้อย" });
      setEditing(false);
    },
  });

  return (
    <Section icon={UserRound} title="ข้อมูลบัญชี" description={`สมาชิกตั้งแต่ ${formatDate(user.createdAt)}`}>
      <div className="flex items-center gap-4">
        <AvatarPicker user={user} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-lg font-medium">{user.name}</span>
            <RoleBadge role={user.role} />
          </span>
          <span className="flex items-center gap-1 truncate text-sm text-muted-foreground">
            <Mail className="size-4" />
            {user.email}
          </span>
          <span className="flex items-center gap-1 truncate text-sm text-muted-foreground">
            <IdCard className="size-4" />
            {fullName || "ยังไม่ได้ระบุชื่อจริงและนามสกุล"}
          </span>
        </div>
        {!editing && (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setEditing(true)}>
            <Pencil data-icon="inline-start" />
            แก้ไขชื่อ
          </Button>
        )}
      </div>
      {editing && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="name">
              {(field) => <TextField field={field} label="ชื่อที่แสดง" icon={UserRound} autoComplete="name" autoFocus />}
            </form.Field>
            <div className="grid gap-6 sm:grid-cols-2">
              <form.Field name="firstName">
                {(field) => (
                  <TextField field={field} label="ชื่อจริง" icon={IdCard} autoComplete="given-name" maxLength={100} />
                )}
              </form.Field>
              <form.Field name="lastName">
                {(field) => (
                  <TextField field={field} label="นามสกุล" icon={IdCard} autoComplete="family-name" maxLength={100} />
                )}
              </form.Field>
            </div>
            <FieldDescription>ชื่อจริงและนามสกุลจะถูกกรอกให้อัตโนมัติเมื่อคุณลงทะเบียนรับตั๋ว</FieldDescription>
            <div className="flex gap-2">
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <SubmitButton pending={isSubmitting} icon={Save}>
                    บันทึก
                  </SubmitButton>
                )}
              </form.Subscribe>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  form.reset();
                  setEditing(false);
                }}
              >
                ยกเลิก
              </Button>
            </div>
          </FieldGroup>
        </form>
      )}
    </Section>
  );
}
