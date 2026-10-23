import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Ban, MessageSquareText, MoreHorizontal, ShieldCheck, UserRoundCog } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { roleNames, type Role } from "@app/auth-guard/permissions";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { SubmitButton, TextField } from "@/components/form-field";
import { RoleBadge } from "@/components/role-badge";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldGroup } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { adminUsersKey, type AdminUser } from "@/lib/admin-users";
import { auth } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { formatDate } from "@/lib/format";
import { roleLabels } from "@/lib/roles";

const columnHelper = createColumnHelper<DataTableFeatures, AdminUser>();

/** `currentUserId` hides the actions on the admin's own row, so they can't ban or demote themselves. */
export const userColumns = (currentUserId: string | undefined) =>
  columnHelper.columns([
    columnHelper.display({
      id: "user",
      header: "ผู้ใช้",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <UserAvatar user={row.original} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{row.original.name}</span>
            <span className="truncate text-sm text-muted-foreground">{row.original.email}</span>
          </div>
        </div>
      ),
    }),
    columnHelper.accessor("role", {
      header: "บทบาท",
      cell: ({ getValue }) => <RoleBadge role={getValue()} />,
    }),
    columnHelper.accessor("banned", {
      header: "สถานะ",
      cell: ({ row }) =>
        row.original.banned ? (
          <Badge variant="destructive" title={row.original.banReason ?? undefined}>
            <Ban data-icon="inline-start" />
            ถูกระงับ
          </Badge>
        ) : (
          <Badge variant="secondary">
            <ShieldCheck data-icon="inline-start" />
            ใช้งานได้
          </Badge>
        ),
    }),
    columnHelper.accessor("createdAt", {
      header: "สมัครเมื่อ",
      cell: ({ getValue }) => formatDate(getValue()),
    }),
    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">จัดการ</span>,
      cell: ({ row }) =>
        row.original.id === currentUserId ? (
          <span className="text-sm text-muted-foreground">บัญชีของคุณ</span>
        ) : (
          <UserRowActions user={row.original} />
        ),
    }),
  ]);

function UserRowActions({ user }: { user: AdminUser }) {
  const queryClient = useQueryClient();
  const [banOpen, setBanOpen] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: adminUsersKey });

  const setRole = useMutation({
    mutationFn: async (role: Role) => {
      const { error } = await auth.admin.setRole({ userId: user.id, role });
      if (error) throw error;
      return role;
    },
    onSuccess: (role) => {
      toast.add({ type: "success", title: `เปลี่ยน ${user.name} เป็น${roleLabels[role]}แล้ว` });
      return refresh();
    },
    onError: (error) => toast.add({ type: "error", title: authErrorMessage(error) }),
  });

  const unban = useMutation({
    mutationFn: async () => {
      const { error } = await auth.admin.unbanUser({ userId: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.add({ type: "success", title: `ยกเลิกการระงับ ${user.name} แล้ว` });
      return refresh();
    },
    onError: (error) => toast.add({ type: "error", title: authErrorMessage(error) }),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />} aria-label={`จัดการ ${user.name}`}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-2">
              <UserRoundCog className="size-4" />
              เปลี่ยนบทบาท
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={user.role ?? "user"}
              onValueChange={(role: Role) => role !== user.role && setRole.mutate(role)}
            >
              {roleNames.map((role) => (
                <DropdownMenuRadioItem key={role} value={role} disabled={setRole.isPending}>
                  {roleLabels[role]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {user.banned ? (
              <DropdownMenuItem disabled={unban.isPending} onClick={() => unban.mutate()}>
                <ShieldCheck />
                ยกเลิกการระงับ
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" onClick={() => setBanOpen(true)}>
                <Ban />
                ระงับบัญชี
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <BanUserDialog user={user} open={banOpen} onOpenChange={setBanOpen} onBanned={refresh} />
    </>
  );
}

const banSchema = z.object({ reason: z.string().trim().max(300, "ยาวเกินไป") });

function BanUserDialog({
  user,
  open,
  onOpenChange,
  onBanned,
}: {
  user: AdminUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBanned: () => Promise<unknown>;
}) {
  const form = useForm({
    defaultValues: { reason: "" },
    validators: { onSubmit: banSchema },
    onSubmit: async ({ value }) => {
      const { error } = await auth.admin.banUser({
        userId: user.id,
        banReason: value.reason.trim() || undefined,
      });
      if (error) return void toast.add({ type: "error", title: authErrorMessage(error) });
      toast.add({ type: "success", title: `ระงับบัญชี ${user.name} แล้ว`, description: "ผู้ใช้ถูกออกจากระบบทุกอุปกรณ์ทันที" });
      form.reset();
      onOpenChange(false);
      await onBanned();
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
            form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="size-5 text-destructive" />
              ระงับบัญชี {user.name}
            </DialogTitle>
            <DialogDescription>
              ผู้ใช้จะถูกออกจากระบบทุกอุปกรณ์และเข้าสู่ระบบไม่ได้จนกว่าจะยกเลิกการระงับ
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <form.Field name="reason">
              {(field) => (
                <TextField
                  field={field}
                  label="เหตุผล (ไม่บังคับ)"
                  icon={MessageSquareText}
                  multiline
                  placeholder="เช่น ละเมิดข้อกำหนดการใช้งาน"
                />
              )}
            </form.Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>ยกเลิก</DialogClose>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <SubmitButton pending={isSubmitting} icon={Ban} variant="destructive">
                  ระงับบัญชี
                </SubmitButton>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
