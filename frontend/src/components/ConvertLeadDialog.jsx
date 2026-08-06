import { useEffect, useState } from "react";
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, Stack, TextField, Typography,
} from "@mui/material";
import api from "../services/api";
import { dateInputToIsoDate } from "../utils/dateTime";

export default function ConvertLeadDialog({ open, lead, onClose, onConverted }) {
  const [createOpportunity, setCreateOpportunity] = useState(true);
  const [title, setTitle] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !lead) return;
    setCreateOpportunity(true);
    setTitle(lead.product_interest || `Opportunity - ${lead.name}`);
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
        CreateOpportunity: createOpportunity,
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
    <DialogTitle>Convert qualified lead</DialogTitle>
    <DialogContent dividers><Stack gap={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <Typography>Convert <strong>{lead?.name}</strong> into a Customer and primary PIC. This is transactional and the lead cannot be converted twice.</Typography>
      <FormControlLabel control={<Checkbox checked={createOpportunity} onChange={(event) => setCreateOpportunity(event.target.checked)} />} label="Create the first opportunity" />
      {createOpportunity && <>
        <TextField required label="Opportunity title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <TextField label="Expected close date" value={closeDate} onChange={(event) => setCloseDate(event.target.value)} placeholder="DD/MM/YYYY" helperText="Example: 31/12/2026" />
      </>}
    </Stack></DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={saving}>Cancel</Button>
      <Button variant="contained" onClick={convert} disabled={saving || (createOpportunity && !title.trim())}>{saving ? "Converting..." : "Convert lead"}</Button>
    </DialogActions>
  </Dialog>;
}
