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

interface Props {
  /** Ilang pagbabago ang hindi pa naipapadala; null = sarado */
  pending: number | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Babala bago mag-logout kapag may hindi pa naipapadala */
export function LogoutDialog({ pending, busy, onConfirm, onCancel }: Props) {
  const n = pending ?? 0;
  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{n} change{n === 1 ? " hasn't" : "s haven't"} synced</AlertDialogTitle>
          <AlertDialogDescription>
            If you log out now, {n === 1 ? "it" : "they"} will be deleted from this device and won't reach your account.
            Stay logged in and open the Sync center while online to send {n === 1 ? "it" : "them"} first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Stay and sync</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={onConfirm}>
            {busy ? "Logging out..." : "Log out and delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
