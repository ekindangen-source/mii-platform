import { useEffect, useState } from "react";
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, Stack, TextField, Typography,
} from "@mui/material";
import api from "../services/api";
import { dateInputToIsoDate } from "../utils/dateTime";

export default function ConvertLeadDialog({ open, lead, onClose, onConverted }) {
  const [saleConfirmed, setSaleConfirmed] = useState(false);
  const [title, setTitle] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !lead) return;
    setSaleConfirmed(false);
    setTitle(lead.product_interest || `Sale - ${lead.name}`);
    setCloseDate("");
    setError("");
  }, [open, lead]);

  async function convert() {
    try {
      setSaving(true);
      setError("");
      const expectedCloseDate = closeDate ? dateInputToIsoDate(closeDate) : null;
      if (closeDate && !expectedCloseDate) {
        throw new Error("Expected close date must use DD/MM/YYYY");
      }
      await api.post(`/leads/${encodeURIComponent(lead.lead_id)}/convert`, {
        SaleConfirmed: saleConfirmed,
        OpportunityTitle: title,
        ExpectedCloseDate: expectedCloseDate,
      });
      onConverted();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to convert lead");
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>Confirm sale and create customer</DialogTitle>
    <DialogContent dividers><Stack gap={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <Typography>A Customer is created only after a sale is confirmed. This creates the Customer, primary PIC, ownership history, and a Won opportunity in one transaction.</Typography>
      <TextField required label="Won opportunity / sale" value={title} onChange={(event) => setTitle(event.target.value)} />
      <TextField label="Expected close date" value={closeDate} onChange={(event) => setCloseDate(event.target.value)} placeholder="DD/MM/YYYY" helperText="Example: 31/12/2026" />
      <FormControlLabel control={<Checkbox checked={saleConfirmed} onChange={(event) => setSaleConfirmed(event.target.checked)} />} label={<>I confirm that <strong>{lead?.name}</strong> has completed a sale and should become a Customer.</>} />
    </Stack></DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={saving}>Cancel</Button>
      <Button variant="contained" onClick={convert} disabled={saving || !saleConfirmed || !title.trim()}>{saving ? "Creating customer..." : "Confirm sale"}</Button>
    </DialogActions>
  </Dialog>;
}
