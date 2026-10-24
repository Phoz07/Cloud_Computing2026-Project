import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { eventClient } from "@/lib/api";
import { problemMessage } from "@/lib/auth-errors";

type DeleteTicketTypeDialogProps = {
  eventId: string;
  ticketType: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** runs after the delete, before the ticket type queries refetch (e.g. to leave the editor) */
  onDeleted?: () => unknown;
};

/** A ticket type anyone enrolled in can't go; the service says so and the toast shows it. */
export function DeleteTicketTypeDialog({ eventId, ticketType, open, onOpenChange, onDeleted }: DeleteTicketTypeDialogProps) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await eventClient.api.events({ id: eventId })["ticket-types"]({ ticketTypeId: ticketType.id }).delete();
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.add({ type: "success", title: `ลบ “${ticketType.name}” แล้ว` });
      onOpenChange(false);
      await onDeleted?.();
      await queryClient.invalidateQueries({ queryKey: ["ticket-types"] });
    },
    onError: (error) => {
      onOpenChange(false);
      toast.add({ type: "error", title: problemMessage(error) });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={(next) => !remove.isPending && onOpenChange(next)}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>ลบ “{ticketType.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            ประเภทตั๋วและแบบฟอร์มลงทะเบียนจะถูกลบถาวร ลบได้เฉพาะประเภทที่ยังไม่มีผู้ลงทะเบียน
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            <ArrowLeft data-icon="inline-start" />
            กลับ
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
            ลบประเภทตั๋ว
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
