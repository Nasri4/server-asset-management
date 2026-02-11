"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ConfirmDialogProps = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: React.ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
  onConfirm: () => Promise<void> | void;
  trigger: React.ReactNode;
};

export function ConfirmDialog({
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
  disabled,
  onConfirm,
  trigger,
}: ConfirmDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const getErrorMessage = (err: unknown, fallback: string) => {
    const maybe = err as {
      response?: { data?: { error?: { message?: string } } };
      message?: string;
    };
    return maybe?.response?.data?.error?.message || maybe?.message || fallback;
  };

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm();
      setOpen(false);
    } catch (e) {
      toast.error(getErrorMessage(e, "Action failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            {cancelText}
          </Button>
          <Button variant={confirmVariant} onClick={() => void handleConfirm()} disabled={disabled || busy}>
            {busy ? "Working…" : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
