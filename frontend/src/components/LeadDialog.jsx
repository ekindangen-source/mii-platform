import { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from "@mui/material";
import api from "../services/api";
import { LEAD_STATUSES } from "../utils/leads";
import { dateTimeInputToIso, formatDateTimeInput } from "../utils/dateTime";

const empty = (userId) => ({ AccountType: "organization", Name: "", ContactName: "",
  ContactTitle: "", ContactPhone: "", ContactEmail: "", Industry: "", Province: "",
  Address: "", Source: "", ProductInterest: "", EstimatedValue: "", Status: "new",
  OwnerID: userId || "", NextAction: "", NextActionAt: "", Notes: "", DisqualifiedReason: "" });

export default function LeadDialog({ open, lead, owners, user, onClose, onSaved }) {
  const [form, setForm] = useState(() => empty(user?.userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canAssign = ["admin", "manager"].includes(user?.role);
  useEffect(() => {
    if (!open) return;
    setForm(lead ? { AccountType: lead.account_type, Name: lead.name, ContactName: lead.contact_name,
      ContactTitle: lead.contact_title || "", ContactPhone: lead.contact_phone,
      ContactEmail: lead.contact_email || "", Industry: lead.industry || "", Province: lead.province || "",
      Address: lead.address || "", Source: lead.source || "", ProductInterest: lead.product_interest || "",
      EstimatedValue: lead.estimated_value ?? "", Status: lead.status, OwnerID: lead.owner_id,
      NextAction: lead.next_action || "", NextActionAt: lead.next_action_at ? formatDateTimeInput(lead.next_action_at) : "",
      Notes: lead.notes || "", DisqualifiedReason: lead.disqualified_reason || "" } : empty(user?.userId));
    setError("");
  }, [open, lead, user?.userId]);
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value,
    ...(event.target.name === "Status" && event.target.value !== "disqualified" ? { DisqualifiedReason: "" } : {}),
    ...(event.target.name === "NextAction" && event.target.value.trim() && !current.NextActionAt
      ? { NextActionAt: formatDateTimeInput(new Date()) } : {}) }));
  async function submit(event) {
    event.preventDefault();
    try {
      setSaving(true); setError("");
      const nextActionAt = form.NextActionAt ? dateTimeInputToIso(form.NextActionAt) : null;
      if (form.NextActionAt && !nextActionAt) throw new Error("Next action date/time must use DD/MM/YYYY hh:mm AM/PM");
      const payload = { ...form, EstimatedValue: Number(form.EstimatedValue || 0), NextActionAt: nextActionAt };
      if (lead) await api.put(`/leads/${encodeURIComponent(lead.lead_id)}`, payload);
      else await api.post("/leads", payload);
      onSaved();
    } catch (err) { setError(err.response?.data?.message || err.message || "Unable to save lead"); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
    <Box component="form" onSubmit={submit}><DialogTitle>{lead ? "Edit lead" : "Add lead"}</DialogTitle>
      <DialogContent dividers>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, pt: 1 }}>
          <TextField select required label="Lead type" name="AccountType" value={form.AccountType} onChange={change}><MenuItem value="organization">Organization</MenuItem><MenuItem value="individual">Individual</MenuItem></TextField>
          <TextField required label="Organization / person" name="Name" value={form.Name} onChange={change} />
          <TextField required label="PIC name" name="ContactName" value={form.ContactName} onChange={change} />
          <TextField label="PIC title" name="ContactTitle" value={form.ContactTitle} onChange={change} />
          <TextField required label="PIC phone" name="ContactPhone" value={form.ContactPhone} onChange={change} />
          <TextField type="email" label="PIC email" name="ContactEmail" value={form.ContactEmail} onChange={change} />
          <TextField label="Industry" name="Industry" value={form.Industry} onChange={change} />
          <TextField label="Province" name="Province" value={form.Province} onChange={change} />
          <TextField label="Lead source" name="Source" value={form.Source} onChange={change} />
          <TextField label="Product interest" name="ProductInterest" value={form.ProductInterest} onChange={change} />
          <TextField type="number" label="Estimated value (IDR)" name="EstimatedValue" value={form.EstimatedValue} onChange={change} inputProps={{ min: 0 }} />
          <TextField select required label="Status" name="Status" value={form.Status} onChange={change}>{LEAD_STATUSES.filter((item) => item.value !== "converted").map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}</TextField>
          <TextField select required disabled={!canAssign} label="Owner" name="OwnerID" value={form.OwnerID} onChange={change}>{owners.map((owner) => <MenuItem key={owner.user_id} value={owner.user_id}>{owner.full_name}</MenuItem>)}</TextField>
          <TextField label="Next action" name="NextAction" value={form.NextAction} onChange={change} required={Boolean(form.NextActionAt)} />
          <TextField label="Next action date & time" name="NextActionAt" value={form.NextActionAt} onChange={change} required={Boolean(form.NextAction)} placeholder="DD/MM/YYYY hh:mm AM" helperText="Example: 06/08/2026 03:30 PM" />
          {form.Status === "disqualified" && <TextField required label="Disqualification reason" name="DisqualifiedReason" value={form.DisqualifiedReason} onChange={change} sx={{ gridColumn: "1 / -1" }} />}
          <TextField label="Address" name="Address" value={form.Address} onChange={change} sx={{ gridColumn: "1 / -1" }} />
          <TextField multiline minRows={3} label="Notes" name="Notes" value={form.Notes} onChange={change} sx={{ gridColumn: "1 / -1" }} />
        </Box></DialogContent><DialogActions><Button onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving..." : "Save lead"}</Button></DialogActions>
    </Box></Dialog>;
}
