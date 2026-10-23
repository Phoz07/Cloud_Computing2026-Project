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
import { eventsKey } from "@/lib/events";

type DeleteEventDialogProps = {
  event: { id: string; title: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** runs after the delete, before the event queries refetch (e.g. to leave the editor) */
  onDeleted?: () => unknown;
};

export function DeleteEventDialog({ event, open, onOpenChange, onDeleted }: DeleteEventDialogProps) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await eventClient.api.events({ id: event.id }).delete();
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.add({ type: "success", title: `ลบ “${event.title}” แล้ว` });
      onOpenChange(false);
      await onDeleted?.();
      await queryClient.invalidateQueries({ queryKey: eventsKey });
    },
    onError: (error) => toast.add({ type: "error", title: problemMessage(error) }),
  });

  return (
    <AlertDialog open={open} onOpenChange={(next) => !remove.isPending && onOpenChange(next)}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>ลบ “{event.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            รายละเอียด ภาพปก และรูปภาพทั้งหมดของอีเวนต์จะถูกลบถาวร และลิงก์ของอีเวนต์จะใช้ไม่ได้อีก
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            <ArrowLeft data-icon="inline-start" />
            กลับ
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
            ลบอีเวนต์
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
