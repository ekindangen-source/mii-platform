import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

import api from "../services/api";

function toLocalInput(value) {
  const date = value ? new Date(value) : new Date();
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 16);
}

export default function CompleteScheduledActivityDialog({
  open,
  activity,
  onClose,
  onCompleted,
}) {
  const [form, setForm] = useState({
    InteractionAt: toLocalInput(),
    Participants: "",
    OutcomeNotes: "",
    NextAction: "",
    NextActionDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setError("");
    setForm({
      InteractionAt: toLocalInput(),
      Participants: "",
      OutcomeNotes:
        activity?.notes ||
        activity?.purpose ||
        "",
      NextAction: "",
      NextActionDate: "",
    });
  }, [activity, open]);

  function updateField(field) {
    return (event) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.OutcomeNotes.trim()) {
      setError("Outcome notes are required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const interactionAt = new Date(form.InteractionAt);
      const response = await api.post(
        `/scheduled-activities/${encodeURIComponent(
          activity.activity_id
        )}/complete`,
        {
          InteractionAt: interactionAt.toISOString(),
          Participants: form.Participants,
          OutcomeNotes: form.OutcomeNotes,
          NextAction: form.NextAction,
          NextActionDate: form.NextActionDate || null,
        }
      );

      if (onCompleted) {
        await onCompleted(response.data);
      }

      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to complete the scheduled activity"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>
          Complete {activity?.activity_id || "activity"}
        </DialogTitle>
        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box sx={{ display: "grid", gap: 2 }}>
            <TextField
              type="datetime-local"
              required
              label="Interaction date and time"
              value={form.InteractionAt}
              onChange={updateField("InteractionAt")}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Participants"
              value={form.Participants}
              onChange={updateField("Participants")}
            />
            <TextField
              required
              multiline
              minRows={4}
              label="Outcome notes"
              value={form.OutcomeNotes}
              onChange={updateField("OutcomeNotes")}
            />
            <TextField
              label="Next action"
              value={form.NextAction}
              onChange={updateField("NextAction")}
            />
            <TextField
              type="date"
              label="Next action date"
              value={form.NextActionDate}
              onChange={updateField("NextActionDate")}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? "Completing..." : "Complete and create interaction"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
