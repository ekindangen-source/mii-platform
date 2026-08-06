import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, TextField,
} from "@mui/material";
import api from "../services/api";
import { OPPORTUNITY_STAGES, STAGE_BY_VALUE } from "../utils/opportunities";
import { dateInputToIsoDate, dateTimeInputToIso, formatDateInput, formatDateTimeInput } from "../utils/dateTime";

function emptyForm(userId, customerId = "") {
  return {
    CustomerID: customerId,
    ContactID: "",
    VesselID: "",
    EngineID: "",
    OwnerID: userId || "",
    Title: "",
    ProductInterest: "",
    Description: "",
    Stage: "prospecting",
    EstimatedValue: "",
    Probability: 10,
    ExpectedCloseDate: "",
    NextAction: "",
    NextActionAt: "",
    Competitor: "",
    LossReason: "",
  };
}

export default function OpportunityDialog({
  open, opportunity, customers, owners, user, presetCustomerId,
  onClose, onSaved,
}) {
  const [form, setForm] = useState(() => emptyForm(user?.userId, presetCustomerId));
  const [contacts, setContacts] = useState([]);
  const [installedBase, setInstalledBase] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canAssign = ["admin", "manager"].includes(user?.role);

  useEffect(() => {
    if (!open) return;
    if (opportunity) {
      setForm({
        CustomerID: opportunity.customer_id || "",
        ContactID: opportunity.contact_id || "",
        VesselID: opportunity.vessel_id || "",
        EngineID: opportunity.engine_id || "",
        OwnerID: opportunity.owner_id || user?.userId || "",
        Title: opportunity.title || "",
        ProductInterest: opportunity.product_interest || "",
        Description: opportunity.description || "",
        Stage: opportunity.stage || "prospecting",
        EstimatedValue: opportunity.estimated_value ?? "",
        Probability: opportunity.probability ?? 10,
        ExpectedCloseDate: opportunity.expected_close_date ? formatDateInput(opportunity.expected_close_date) : "",
        NextAction: opportunity.next_action || "",
        NextActionAt: opportunity.next_action_at ? formatDateTimeInput(opportunity.next_action_at) : "",
        Competitor: opportunity.competitor || "",
        LossReason: opportunity.loss_reason || "",
      });
    } else {
      setForm(emptyForm(user?.userId, presetCustomerId));
    }
    setError("");
  }, [open, opportunity, presetCustomerId, user?.userId]);

  useEffect(() => {
    if (!open || !form.CustomerID) {
      setContacts([]);
      return;
    }
    api.get(`/customers/${encodeURIComponent(form.CustomerID)}/contacts`)
      .then((response) => setContacts(Array.isArray(response.data) ? response.data : []))
      .catch(() => setContacts([]));
  }, [open, form.CustomerID]);

  useEffect(() => {
    if (!open || !form.CustomerID) { setInstalledBase([]); return; }
    api.get(`/opportunities/customer/${encodeURIComponent(form.CustomerID)}/installed-base`)
      .then((response) => setInstalledBase(Array.isArray(response.data) ? response.data : []))
      .catch(() => setInstalledBase([]));
  }, [open, form.CustomerID]);

  const activeContacts = useMemo(
    () => contacts.filter((contact) => contact.is_active),
    [contacts]
  );
  const selectedVessel = installedBase.find((item) => item.vessel_id === form.VesselID);
  const availableEngines = form.VesselID
    ? (selectedVessel?.engines || [])
    : installedBase.flatMap((item) => item.engines || []);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "CustomerID") { next.ContactID = ""; next.VesselID = ""; next.EngineID = ""; }
      if (name === "VesselID") next.EngineID = "";
      if (name === "Stage") {
        next.Probability = STAGE_BY_VALUE[value]?.probability ?? current.Probability;
        if (value !== "lost") next.LossReason = "";
      }
      if (name === "NextAction" && value.trim() && !current.NextActionAt) {
        next.NextActionAt = formatDateTimeInput(new Date());
      }
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const expectedCloseDate = form.ExpectedCloseDate ? dateInputToIsoDate(form.ExpectedCloseDate) : null;
      const nextActionAt = form.NextActionAt ? dateTimeInputToIso(form.NextActionAt) : null;
      if (form.ExpectedCloseDate && !expectedCloseDate) throw new Error("Expected close date must use DD/MM/YYYY");
      if (form.NextActionAt && !nextActionAt) throw new Error("Next action date/time must use DD/MM/YYYY hh:mm AM/PM");
      const payload = {
        ...form,
        EstimatedValue: Number(form.EstimatedValue || 0),
        Probability: Number(form.Probability),
        ExpectedCloseDate: expectedCloseDate,
        NextActionAt: nextActionAt,
      };
      if (opportunity) {
        await api.put(`/opportunities/${encodeURIComponent(opportunity.opportunity_id)}`, payload);
      } else {
        await api.post("/opportunities", payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to save opportunity");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <Box component="form" onSubmit={submit}>
        <DialogTitle>{opportunity ? "Edit opportunity" : "Add opportunity"}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, pt: 1 }}>
            <TextField select required label="Customer" name="CustomerID" value={form.CustomerID} onChange={change}>
              {customers.map((customer) => (
                <MenuItem key={customer.customer_id} value={customer.customer_id}>
                  {customer.company} ({customer.customer_id})
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="PIC / Contact" name="ContactID" value={form.ContactID} onChange={change}>
              <MenuItem value=""><em>Not specified</em></MenuItem>
              {activeContacts.map((contact) => (
                <MenuItem key={contact.contact_id} value={contact.contact_id}>
                  {contact.full_name}{contact.job_title ? ` - ${contact.job_title}` : ""}
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ gridColumn: "1 / -1", p: 1.5, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "action.hover" }}>
              <Box sx={{ fontWeight: 700, mb: 0.5 }}>Customer installed base</Box>
              {installedBase.length ? installedBase.map((vessel) => (
                <Box key={vessel.vessel_id} sx={{ fontSize: 14, mb: 0.5 }}>
                  {vessel.boat_name || vessel.vessel_id}
                  {vessel.engines?.length ? ` — ${vessel.engines.map((engine) => `${engine.brand || ""} ${engine.model || ""}${engine.hp ? ` ${engine.hp} HP` : ""}`).join(", ")}` : " — No engines recorded"}
                </Box>
              )) : <Box sx={{ fontSize: 14, color: "text.secondary" }}>No vessels or engines recorded for this customer.</Box>}
            </Box>
            <TextField select label="Related vessel (optional)" name="VesselID" value={form.VesselID} onChange={change}>
              <MenuItem value=""><em>Not linked</em></MenuItem>
              {installedBase.map((vessel) => <MenuItem key={vessel.vessel_id} value={vessel.vessel_id}>{vessel.boat_name || vessel.vessel_id}</MenuItem>)}
            </TextField>
            <TextField select label="Related engine (optional)" name="EngineID" value={form.EngineID} onChange={change}>
              <MenuItem value=""><em>Not linked</em></MenuItem>
              {availableEngines.map((engine) => <MenuItem key={engine.engine_id} value={engine.engine_id}>{engine.brand} {engine.model}{engine.hp ? ` · ${engine.hp} HP` : ""}{engine.serial_number ? ` · ${engine.serial_number}` : ""}</MenuItem>)}
            </TextField>
            <TextField required label="Opportunity" name="Title" value={form.Title} onChange={change} />
            <TextField label="Product / requirement" name="ProductInterest" value={form.ProductInterest} onChange={change} />
            <TextField select required label="Stage" name="Stage" value={form.Stage} onChange={change}>
              {OPPORTUNITY_STAGES.map((stage) => <MenuItem key={stage.value} value={stage.value}>{stage.label}</MenuItem>)}
            </TextField>
            <TextField select disabled={!canAssign} required label="Owner" name="OwnerID" value={form.OwnerID} onChange={change}>
              {owners.map((owner) => <MenuItem key={owner.user_id} value={owner.user_id}>{owner.full_name}</MenuItem>)}
            </TextField>
            <TextField type="number" label="Estimated value (IDR)" name="EstimatedValue" value={form.EstimatedValue} onChange={change} inputProps={{ min: 0 }} />
            <TextField type="number" required label="Probability (%)" name="Probability" value={form.Probability} onChange={change} inputProps={{ min: 0, max: 100 }} />
            <TextField label="Expected close date" name="ExpectedCloseDate" value={form.ExpectedCloseDate} onChange={change} placeholder="DD/MM/YYYY" helperText="Example: 31/12/2026" />
            <TextField label="Competitor / current supplier" name="Competitor" value={form.Competitor} onChange={change} />
            <TextField label="Next action" name="NextAction" value={form.NextAction} onChange={change} required={Boolean(form.NextActionAt)} />
            <TextField label="Next action date & time" name="NextActionAt" value={form.NextActionAt} onChange={change} required={Boolean(form.NextAction)} placeholder="DD/MM/YYYY hh:mm AM" helperText="Example: 06/08/2026 03:30 PM" />
            {form.Stage === "lost" && (
              <TextField required label="Loss reason" name="LossReason" value={form.LossReason} onChange={change} sx={{ gridColumn: "1 / -1" }} />
            )}
            <TextField multiline minRows={3} label="Description / commercial notes" name="Description" value={form.Description} onChange={change} sx={{ gridColumn: "1 / -1" }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving..." : "Save opportunity"}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
