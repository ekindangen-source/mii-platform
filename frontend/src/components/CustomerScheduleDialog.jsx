import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import EventIcon from "@mui/icons-material/Event";

import api from "../services/api";
import ScheduleActivityDialog from "./ScheduleActivityDialog";
import CompleteScheduledActivityDialog from "./CompleteScheduledActivityDialog";
import ConfirmDialog from "./ConfirmDialog";
import {
  OPEN_ACTIVITY_STATUSES,
  formatActivityDateTime,
  formatActivityStatus,
  formatActivityType,
  statusColor,
} from "../utils/scheduledActivities";

export default function CustomerScheduleDialog({
  open,
  customer,
  canWrite,
  canDelete,
  onClose,
}) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function loadActivities() {
    if (!customer?.customer_id) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await api.get("/scheduled-activities", {
        params: { customerId: customer.customer_id },
      });
      setActivities(
        Array.isArray(response.data) ? response.data : []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load scheduled activities"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      loadActivities();
    } else {
      setActivities([]);
      setError("");
      setEditing(null);
      setCompleting(null);
    }
  }, [open, customer?.customer_id]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(activity) {
    setEditing(activity);
    setEditorOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      await api.delete(
        `/scheduled-activities/${encodeURIComponent(
          deleteTarget.activity_id
        )}`
      );
      setDeleteTarget(null);
      await loadActivities();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to delete scheduled activity"
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
        <DialogTitle>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h6" fontWeight={800}>
                Meetings & Visits
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {customer?.company} Ã‚Â· {customer?.customer_id}
              </Typography>
            </Box>
            {canWrite && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openCreate}
              >
                Schedule meeting / visit
              </Button>
            )}
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : activities.length ? (
            <Stack spacing={1.5}>
              {activities.map((activity) => (
                <Paper
                  key={activity.activity_id}
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 2 }}
                >
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    justifyContent="space-between"
                  >
                    <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <EventIcon fontSize="small" color="action" />
                        <Typography fontWeight={800}>
                          {formatActivityType(activity.activity_type)}
                        </Typography>
                        <Chip
                          size="small"
                          label={formatActivityStatus(activity.status)}
                          color={statusColor(activity.status)}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {activity.activity_id}
                        </Typography>
                      </Stack>
                      <Typography variant="body2">
                        <strong>{formatActivityDateTime(activity.scheduled_start)}</strong>
                        {activity.scheduled_end
                          ? ` - ${formatActivityDateTime(activity.scheduled_end)}`
                          : ""}
                      </Typography>
                      <Typography variant="body2">
                        Assigned to: {activity.assigned_to_name}
                      </Typography>
                      {activity.contact_name && (
                        <Typography variant="body2">
                          PIC: {activity.contact_name}
                        </Typography>
                      )}
                      {activity.location && (
                        <Typography variant="body2">
                          Location: {activity.location}
                        </Typography>
                      )}
                      <Divider sx={{ my: 0.5 }} />
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {activity.purpose}
                      </Typography>
                      {activity.completed_interaction_id && (
                        <Typography variant="caption" color="success.main">
                          Interaction created: {activity.completed_interaction_id}
                        </Typography>
                      )}
                    </Stack>

                    <Stack direction="row" spacing={0.5} alignItems="flex-start">
                      {canWrite && OPEN_ACTIVITY_STATUSES.has(activity.status) && (
                        <Tooltip title="Complete and log interaction">
                          <IconButton
                            color="success"
                            onClick={() => setCompleting(activity)}
                          >
                            <CheckCircleIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canWrite && activity.status !== "completed" && (
                        <Tooltip title="Edit">
                          <IconButton onClick={() => openEdit(activity)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canDelete && activity.status !== "completed" && (
                        <Tooltip title="Delete">
                          <IconButton
                            color="error"
                            onClick={() => setDeleteTarget(activity)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Box sx={{ py: 7, textAlign: "center" }}>
              <EventIcon sx={{ fontSize: 44, color: "text.disabled", mb: 1 }} />
              <Typography color="text.secondary">
                No scheduled meetings, visits, calls, or follow-ups.
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <ScheduleActivityDialog
        open={editorOpen}
        activity={editing}
        customer={customer}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSaved={loadActivities}
      />

      <CompleteScheduledActivityDialog
        open={Boolean(completing)}
        activity={completing}
        onClose={() => setCompleting(null)}
        onCompleted={loadActivities}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete scheduled activity?"
        message={
          deleteTarget
            ? `${deleteTarget.activity_id} will be permanently deleted.`
            : ""
        }
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        confirmColor="error"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </>
  );
}
