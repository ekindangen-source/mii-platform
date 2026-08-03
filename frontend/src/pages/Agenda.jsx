import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import ScheduleActivityDialog from "../components/ScheduleActivityDialog";
import CompleteScheduledActivityDialog from "../components/CompleteScheduledActivityDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  OPEN_ACTIVITY_STATUSES,
  formatActivityDateTime,
  formatActivityStatus,
  formatActivityType,
  statusColor,
} from "../utils/scheduledActivities";

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ActivityCard({
  activity,
  canWrite,
  canDelete,
  onEdit,
  onComplete,
  onDelete,
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        justifyContent="space-between"
      >
        <Stack spacing={0.65} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
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
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {activity.customer_name}
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
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {activity.purpose}
          </Typography>
          {activity.completed_interaction_id && (
            <Typography variant="caption" color="success.main">
              Interaction: {activity.completed_interaction_id}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={0.5} alignItems="flex-start">
          {canWrite && OPEN_ACTIVITY_STATUSES.has(activity.status) && (
            <Tooltip title="Complete and create interaction">
              <IconButton color="success" onClick={() => onComplete(activity)}>
                <CheckCircleIcon />
              </IconButton>
            </Tooltip>
          )}
          {canWrite && activity.status !== "completed" && (
            <Tooltip title="Edit">
              <IconButton onClick={() => onEdit(activity)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
          )}
          {canDelete && activity.status !== "completed" && (
            <Tooltip title="Delete">
              <IconButton color="error" onClick={() => onDelete(activity)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function AgendaSection({
  title,
  subtitle,
  icon,
  rows,
  emptyText,
  ...actions
}) {
  return (
    <Paper sx={{ p: 2.5, borderRadius: 3 }}>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
        {icon}
        <Box>
          <Typography variant="h6" fontWeight={800}>
            {title} ({rows.length})
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>

      {rows.length ? (
        <Stack spacing={1.25}>
          {rows.map((activity) => (
            <ActivityCard
              key={activity.activity_id}
              activity={activity}
              {...actions}
            />
          ))}
        </Stack>
      ) : (
        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
          {emptyText}
        </Typography>
      )}
    </Paper>
  );
}

export default function Agenda() {
  const { user } = useAuth();
  const canWrite = ["admin", "manager", "sales", "technician"].includes(
    user?.role
  );
  const canDelete = ["admin", "manager"].includes(user?.role);
  const canViewAll = ["admin", "manager"].includes(user?.role);

  const [date, setDate] = useState(localDateValue());
  const [assignedTo, setAssignedTo] = useState("all");
  const [users, setUsers] = useState([]);
  const [agenda, setAgenda] = useState({
    overdue: [],
    today: [],
    upcoming: [],
    counts: { overdue: 0, today: 0, upcoming: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const assignedName = useMemo(() => {
    if (!canViewAll || assignedTo === "all") {
      return canViewAll ? "All users" : user?.fullName || "My agenda";
    }

    return (
      users.find((item) => item.user_id === assignedTo)?.full_name ||
      assignedTo
    );
  }, [assignedTo, canViewAll, user?.fullName, users]);

  async function loadAgenda() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/scheduled-activities/agenda", {
        params: {
          date,
          timeZone: "Asia/Jakarta",
          ...(canViewAll ? { assignedTo } : {}),
        },
      });
      setAgenda({
        overdue: response.data?.overdue || [],
        today: response.data?.today || [],
        upcoming: response.data?.upcoming || [],
        counts: response.data?.counts || {},
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load agenda"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .get("/scheduled-activities/users")
      .then((response) => {
        setUsers(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAgenda();
  }, [date, assignedTo]);

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      await api.delete(
        `/scheduled-activities/${encodeURIComponent(
          deleteTarget.activity_id
        )}`
      );
      setDeleteTarget(null);
      await loadAgenda();
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
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={900}>
            Meeting & Visit Agenda
          </Typography>
          <Typography color="text.secondary">
            {assignedName} · Jakarta time
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
          <TextField
            type="date"
            size="small"
            label="Agenda date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {canViewAll && (
            <TextField
              select
              size="small"
              label="Assigned user"
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
              sx={{ minWidth: 210 }}
            >
              <MenuItem value="all">All users</MenuItem>
              {users.map((item) => (
                <MenuItem key={item.user_id} value={item.user_id}>
                  {item.full_name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={loadAgenda}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              Schedule
            </Button>
          )}
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", py: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2.5}>
          <AgendaSection
            title="Overdue"
            subtitle="Open activities scheduled before the selected date."
            icon={<WarningAmberIcon color="error" />}
            rows={agenda.overdue}
            emptyText="No overdue activities."
            canWrite={canWrite}
            canDelete={canDelete}
            onEdit={(activity) => {
              setEditing(activity);
              setEditorOpen(true);
            }}
            onComplete={setCompleting}
            onDelete={setDeleteTarget}
          />
          <AgendaSection
            title="Selected day"
            subtitle={date}
            icon={<CalendarMonthIcon color="primary" />}
            rows={agenda.today}
            emptyText="Nothing scheduled for this date."
            canWrite={canWrite}
            canDelete={canDelete}
            onEdit={(activity) => {
              setEditing(activity);
              setEditorOpen(true);
            }}
            onComplete={setCompleting}
            onDelete={setDeleteTarget}
          />
          <AgendaSection
            title="Upcoming 7 days"
            subtitle="Activities after the selected date."
            icon={<CalendarMonthIcon color="action" />}
            rows={agenda.upcoming}
            emptyText="No upcoming activities in the next seven days."
            canWrite={canWrite}
            canDelete={canDelete}
            onEdit={(activity) => {
              setEditing(activity);
              setEditorOpen(true);
            }}
            onComplete={setCompleting}
            onDelete={setDeleteTarget}
          />
        </Stack>
      )}

      <ScheduleActivityDialog
        open={editorOpen}
        activity={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSaved={loadAgenda}
      />

      <CompleteScheduledActivityDialog
        open={Boolean(completing)}
        activity={completing}
        onClose={() => setCompleting(null)}
        onCompleted={loadAgenda}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete scheduled activity?"
        message={
          deleteTarget
            ? `${deleteTarget.activity_id} will be permanently deleted.`
            : ""
        }
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
}
