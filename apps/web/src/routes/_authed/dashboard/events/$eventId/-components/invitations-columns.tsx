import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import {
  ArrowLeft, CircleCheckBig, CircleDashed, Copy, Lock, Mail, MailCheck, MailX, MoreHorizontal, Pencil, Trash2,
} from "lucide-react";
import { useState } from "react";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { UserAvatar } from "@/components/user-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { eventClient } from "@/lib/api";
import { problemMessage } from "@/lib/auth-errors";
import { formatDateTime } from "@/lib/format";
import { invitationsKey, type Invitation } from "@/lib/invitations";
import { EditInvitationDialog } from "./invitation-dialogs";

const columnHelper = createColumnHelper<DataTableFeatures, Invitation>();

/** `locked`: the event is suspended and the viewer isn't an admin, so nothing can change. */
export const invitationColumns = (eventId: string, locked: boolean) =>
  columnHelper.columns([
    columnHelper.display({
      id: "invitee",
      header: "ผู้ได้รับเชิญ",
      cell: ({ row }) => <Invitee invitation={row.original} />,
    }),
    columnHelper.accessor("status", {
      header: "สถานะ",
      cell: ({ row }) => <InvitationStatus invitation={row.original} />,
    }),
    columnHelper.accessor("createdAt", {
      header: "เชิญเมื่อ",
      cell: ({ row }) => <InvitedAt invitation={row.original} />,
    }),
    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">จัดการ</span>,
      cell: ({ row }) => <InvitationActions eventId={eventId} invitation={row.original} locked={locked} />,
    }),
  ]);

/** The account registered with the email when there is one; otherwise just the email. */
function Invitee({ invitation }: { invitation: Invitation }) {
  const { user } = invitation;
  return (
    <div className="flex min-w-56 items-center gap-3">
      {user ? (
        <UserAvatar user={user} />
      ) : (
        <Avatar>
          <AvatarFallback>
            <Mail className="size-4" />
          </AvatarFallback>
        </Avatar>
      )}
      <div className="flex min-w-0 flex-col">
        {user ? (
          <>
            <span className="truncate font-medium">{user.name}</span>
            <span className="truncate text-sm text-muted-foreground">{invitation.email}</span>
          </>
        ) : (
          <>
            <span className="truncate font-medium">{invitation.email}</span>
            <span className="text-sm text-muted-foreground">ยังไม่มีบัญชี เข้าถึงได้เมื่อสมัครด้วยอีเมลนี้</span>
          </>
        )}
      </div>
    </div>
  );
}

function InvitationStatus({ invitation }: { invitation: Invitation }) {
  if (invitation.status === "unused") {
    return (
      <Badge variant="secondary">
        <CircleDashed data-icon="inline-start" />
        ยังไม่ใช้
      </Badge>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge>
        <CircleCheckBig data-icon="inline-start" />
        ใช้แล้ว
      </Badge>
      {invitation.usedAt && (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(invitation.usedAt)}</span>
      )}
    </div>
  );
}

/** When it was added, and whether the invitation email has gone out (it waits while the event isn't invite-only). */
function InvitedAt({ invitation }: { invitation: Invitation }) {
  return (
    <div className="flex flex-col gap-1 whitespace-nowrap">
      <span>{formatDateTime(invitation.createdAt)}</span>
      {invitation.notifiedAt ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground" title={formatDateTime(invitation.notifiedAt)}>
          <MailCheck className="size-3.5" />
          ส่งอีเมลเชิญแล้ว
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-muted-foreground" title="ส่งเมื่อเผยแพร่แบบเฉพาะผู้ได้รับเชิญ">
          <MailX className="size-3.5" />
          ยังไม่ส่งอีเมลเชิญ
        </span>
      )}
    </div>
  );
}

function InvitationActions({ eventId, invitation, locked }: { eventId: string; invitation: Invitation; locked: boolean }) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const used = invitation.status === "used";
  const frozen = locked || used;

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await eventClient.api.events({ id: eventId }).invitations({ invitationId: invitation.id }).delete();
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.add({ type: "success", title: `ยกเลิกคำเชิญ ${invitation.email} แล้ว` });
      setConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: invitationsKey(eventId) });
    },
    onError: async (error) => {
      setConfirmOpen(false);
      toast.add({ type: "error", title: problemMessage(error) });
      // e.g. it was used meanwhile: show the current state
      await queryClient.invalidateQueries({ queryKey: invitationsKey(eventId) });
    },
  });

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(invitation.email);
      toast.add({ type: "success", title: "คัดลอกอีเมลแล้ว" });
    } catch {
      toast.add({ type: "error", title: "คัดลอกไม่สำเร็จ" });
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />} aria-label={`จัดการคำเชิญ ${invitation.email}`}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {used && (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2">
                <Lock className="size-4" />
                ใช้ลงทะเบียนแล้ว แก้ไขไม่ได้
              </DropdownMenuLabel>
            </DropdownMenuGroup>
          )}
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={frozen} onClick={() => setEditOpen(true)}>
              <Pencil />
              แก้ไขอีเมล
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyEmail}>
              <Copy />
              คัดลอกอีเมล
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" disabled={frozen} onClick={() => setConfirmOpen(true)}>
              <Trash2 />
              ยกเลิกคำเชิญ
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditInvitationDialog eventId={eventId} invitation={invitation} open={editOpen} onOpenChange={setEditOpen} />
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>ยกเลิกคำเชิญ?</AlertDialogTitle>
            <AlertDialogDescription>
              {invitation.email} จะเปิดอีเวนต์นี้ไม่ได้อีก จนกว่าคุณจะเชิญใหม่
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              <ArrowLeft data-icon="inline-start" />
              กลับ
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {remove.isPending ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
              ยกเลิกคำเชิญ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
