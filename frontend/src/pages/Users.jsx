import { useEffect, useMemo, useState } from "react";
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
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import EditIcon from "@mui/icons-material/Edit";
import EmailIcon from "@mui/icons-material/Email";
import RefreshIcon from "@mui/icons-material/Refresh";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  primaryCellSx,
  responsiveTableSx,
  stickyActionCellSx,
  stickyActionHeaderSx,
  truncateTextSx,
} from "../utils/responsiveTable";

const roles = ["admin", "manager", "sales", "technician", "viewer"];
const empty = { UserID: "", FullName: "", Email: "", Role: "viewer" };
const color = (status) =>
  status === "active"
    ? "success"
    : status === "invited"
      ? "info"
      : status === "expired"
        ? "warning"
        : "default";
const when = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

export default function Users() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [editRole, setEditRole] = useState("viewer");
  const admin = user?.role === "admin";

  async function load() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/admin/users");
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (admin) load();
    else setLoading(false);
  }, [admin]);

  const sorted = useMemo(
    () =>
      [...rows].sort((left, right) =>
        String(left.full_name || left.email).localeCompare(
          String(right.full_name || right.email)
        )
      ),
    [rows]
  );

  function change(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function invite(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const response = await api.post("/admin/users/invite", form);
      setSuccess(response.data.message || "Invitation sent.");
      setOpen(false);
      setForm(empty);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to send invitation.");
    } finally {
      setSaving(false);
    }
  }

  async function resend(row) {
    try {
      setSaving(true);
      setError("");
      const response = await api.post(
        `/admin/users/${encodeURIComponent(row.user_id)}/resend-invitation`
      );
      setSuccess(response.data.message || "Invitation resent.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to resend invitation.");
    } finally {
      setSaving(false);
    }
  }

  async function saveRole() {
    try {
      setSaving(true);
      await api.patch(`/admin/users/${encodeURIComponent(editing.user_id)}`, {
        Role: editRole,
      });
      setSuccess("User role updated.");
      setEditing(null);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update user.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(row) {
    try {
      setSaving(true);
      await api.patch(`/admin/users/${encodeURIComponent(row.user_id)}`, {
        IsActive: false,
      });
      setSuccess("User deactivated.");
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to deactivate user.");
    } finally {
      setSaving(false);
    }
  }

  if (!admin) {
    return <Alert severity="error">Administrator access is required.</Alert>;
  }

  return (
    <Stack spacing={2.5}>
      <Paper sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Users
            </Typography>
            <Typography color="text.secondary">
              Invite users by email and manage their roles.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh">
              <span>
                <IconButton onClick={load} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
              Invite user
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Paper>
        <TableContainer>
          {loading ? (
            <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table size="small" sx={responsiveTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                    Invitation expiry
                  </TableCell>
                  <TableCell align="right" sx={stickyActionHeaderSx}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={row.user_id} hover>
                    <TableCell sx={primaryCellSx}>
                      <Typography variant="body2" sx={{ fontWeight: 700, ...truncateTextSx }}>
                        {row.full_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={truncateTextSx}>
                        {row.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={truncateTextSx}>
                        {row.user_id}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      {row.role}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.invitation_status}
                        color={color(row.invitation_status)}
                      />
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                      {when(row.invitation_expires_at)}
                    </TableCell>
                    <TableCell align="right" sx={stickyActionCellSx}>
                      <Tooltip title="Edit role">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditing(row);
                            setEditRole(row.role);
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      {!row.is_active && (
                        <Tooltip title="Resend invitation">
                          <span>
                            <IconButton size="small" disabled={saving} onClick={() => resend(row)}>
                              <EmailIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      {row.is_active && row.user_id !== user?.userId && (
                        <Tooltip title="Deactivate user">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={saving}
                              onClick={() => deactivate(row)}
                            >
                              <BlockIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!sorted.length && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={invite}>
          <DialogTitle>Invite user</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="info">
                The user receives a one-time link and creates their own password.
              </Alert>
              <TextField label="User ID" name="UserID" value={form.UserID} onChange={change} required autoFocus />
              <TextField label="Full name" name="FullName" value={form.FullName} onChange={change} required />
              <TextField label="Email" name="Email" type="email" value={form.Email} onChange={change} required />
              <TextField select label="Role" name="Role" value={form.Role} onChange={change}>
                {roles.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Sending..." : "Send invitation"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(editing)} onClose={() => !saving && setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Edit user role</DialogTitle>
        <DialogContent dividers>
          <TextField
            select
            fullWidth
            label="Role"
            value={editRole}
            onChange={(event) => setEditRole(event.target.value)}
          >
            {roles.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={saveRole} disabled={saving}>Save</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
