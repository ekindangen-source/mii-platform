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
import {
  dateTimeInputToIso,
  formatDateTimeInput,
} from "../utils/dateTime";

export default function CompleteScheduledActivityDialog({
  open,
  activity,
  onClose,
  onCompleted,
}) {
  const [form, setForm] = useState({
    InteractionAt: formatDateTimeInput(),
    Participants: "",
    OutcomeNotes: "",
    NextAction: "",
    NextActionAt: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setError("");
    setForm({
      InteractionAt: formatDateTimeInput(),
      Participants: "",
      OutcomeNotes:
        activity?.notes ||
        activity?.purpose ||
        "",
      NextAction: "",
      NextActionAt: "",
    });
  }, [activity, open]);

  function updateField(field) {
    return (event) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
        ...(field === "NextAction" && event.target.value.trim() && !current.NextActionAt
          ? { NextActionAt: formatDateTimeInput() }
          : {}),
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
      const interactionAt = dateTimeInputToIso(form.InteractionAt);
      const nextActionAt = form.NextActionAt
        ? dateTimeInputToIso(form.NextActionAt)
        : null;

      if (!interactionAt || (form.NextActionAt && !nextActionAt)) {
        setError("Use DD/MM/YYYY hh:mm AM/PM for date and time fields.");
        return;
      }
      const response = await api.post(
        `/scheduled-activities/${encodeURIComponent(
          activity.activity_id
        )}/complete`,
        {
          InteractionAt: interactionAt,
          Participants: form.Participants,
          OutcomeNotes: form.OutcomeNotes,
          NextAction: form.NextAction,
          NextActionAt: nextActionAt,
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
              required
              label="Interaction date and time"
              value={form.InteractionAt}
              onChange={updateField("InteractionAt")}
              placeholder="DD/MM/YYYY hh:mm AM"
              helperText="Format: DD/MM/YYYY hh:mm AM/PM"
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
              label="Next action date and time"
              value={form.NextActionAt}
              onChange={updateField("NextActionAt")}
              placeholder="DD/MM/YYYY hh:mm AM"
              helperText="Defaults to the current time when Next Action is entered."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? "Completing..." : "Complete and log interaction"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
