import { useBlocker } from "@tanstack/react-router";
import { ArrowLeft, CircleAlert, LogOut } from "lucide-react";
import { useEffect, useRef } from "react";
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

type LeaveGuardProps = {
  /** block leaving while true (unsaved input) */
  when: boolean;
  /** set to true right before leaving on purpose (after a save or delete), so the guard lets it through */
  allowLeaveRef?: React.RefObject<boolean>;
  title?: string;
  description?: string;
};

/** Asks before leaving a page with unsaved input: in-app navigation gets a dialog, closing the tab the browser's prompt. */
export function LeaveGuard({
  when,
  allowLeaveRef,
  title = "ออกจากหน้านี้โดยไม่บันทึก?",
  description = "ข้อมูลที่ยังไม่บันทึกจะหายไป",
}: LeaveGuardProps) {
  const whenRef = useRef(when);
  useEffect(() => {
    whenRef.current = when;
  }, [when]);
  const shouldBlock = () => whenRef.current && !allowLeaveRef?.current;
  const blocker = useBlocker({ shouldBlockFn: shouldBlock, enableBeforeUnload: shouldBlock, withResolver: true });

  return (
    <AlertDialog open={blocker.status === "blocked"} onOpenChange={(open) => !open && blocker.reset?.()}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/10 text-primary">
            <CircleAlert />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>
            <ArrowLeft data-icon="inline-start" />
            อยู่ต่อ
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => blocker.proceed?.()}>
            <LogOut data-icon="inline-start" />
            ออกโดยไม่บันทึก
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
