import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { auth } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { useSession } from "@/lib/session";
import { Section } from "./-components/section";
import { accountsQueryOptions } from "./-components/queries";

export const Route = createFileRoute("/_authed/profile/delete")({
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const guarded = Route.useRouteContext().session;
  const { data: session } = useSession();
  const { data: accounts } = useQuery(accountsQueryOptions);
  const hasPassword = Boolean(accounts?.some((account) => account.providerId === "credential"));
  return <DeleteAccountSection hasPassword={hasPassword} isAdmin={(session?.user ?? guarded.user).role === "admin"} />;
}

function DeleteAccountSection({ hasPassword, isAdmin }: { hasPassword: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await auth.deleteUser(hasPassword ? { password } : {});
      if (error) throw error;
    },
    onSuccess: () => {
      // the session is gone server-side; a hard navigation drops every cached query
      window.location.assign("/");
    },
    onError: (error) => toast.add({ type: "error", title: authErrorMessage(error) }),
  });

  return (
    <Section
      icon={Trash2}
      tone="destructive"
      title="ลบบัญชี"
      description={
        isAdmin
          ? "บัญชีผู้ดูแลระบบลบเองไม่ได้ กรุณาให้ผู้ดูแลระบบคนอื่นเปลี่ยนบทบาทก่อน"
          : "ข้อมูลบัญชี อุปกรณ์ที่เข้าสู่ระบบ และคำขอเป็นผู้จัดงานจะถูกลบถาวร และไม่สามารถกู้คืนได้"
      }
    >
      <Button variant="destructive" className="self-start" disabled={isAdmin} onClick={() => setOpen(true)}>
        <Trash2 data-icon="inline-start" />
        ลบบัญชีของฉัน
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setPassword("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบบัญชี</AlertDialogTitle>
            <AlertDialogDescription>
              การลบบัญชีไม่สามารถย้อนกลับได้
              {hasPassword ? " กรอกรหัสผ่านเพื่อยืนยัน" : " หากเข้าสู่ระบบมานานแล้ว อาจต้องเข้าสู่ระบบใหม่ก่อนลบ"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {hasPassword && (
            <Input
              type="password"
              value={password}
              autoComplete="current-password"
              placeholder="รหัสผ่านปัจจุบัน"
              aria-label="รหัสผ่านปัจจุบัน"
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending || (hasPassword && !password)}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
              ลบบัญชีถาวร
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}
