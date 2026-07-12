import {
  Button, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle
} from "@mui/material";

export default function ConfirmDialog({
  open, title, message, confirmLabel = "Confirm",
  cancelLabel = "Cancel", loading = false, onConfirm, onCancel
}) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><DialogContentText>{message}</DialogContentText></DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
        <Button onClick={onConfirm} variant="contained" color="error" disabled={loading}>
          {loading ? "Deleting..." : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
