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
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import KeyIcon from "@mui/icons-material/Key";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const roles = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "sales", label: "Sales" },
  {
    value: "technician",
    label: "Technician",
  },
  { value: "viewer", label: "Viewer" },
];

const emptyForm = {
  UserID: "",
  FullName: "",
  Email: "",
  Password: "",
  Role: "viewer",
};

function mapUserToForm(user) {
  return {
    UserID: user.user_id || "",
    FullName: user.full_name || "",
    Email: user.email || "",
    Password: "",
    Role: user.role || "viewer",
  };
}

function roleColor(role) {
  switch (role) {
    case "admin":
      return "error";
    case "manager":
      return "warning";
    case "user":
      return "primary";
    default:
      return "default";
  }
}

export default function Users() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] =
    useState(10);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [passwordOpen, setPasswordOpen] =
    useState(false);
  const [passwordUser, setPasswordUser] =
    useState(null);
  const [newPassword, setNewPassword] =
    useState("");

  const [actionAnchor, setActionAnchor] =
    useState(null);
  const [actionUser, setActionUser] =
    useState(null);

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/auth/users");

      if (!Array.isArray(response.data)) {
        throw new Error("Unexpected users response");
      }

      setUsers(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load users"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [search, rowsPerPage]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) =>
      [
        user.user_id,
        user.full_name,
        user.email,
        user.role,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query)
      )
    );
  }, [search, users]);

  const visibleUsers = useMemo(() => {
    const start = page * rowsPerPage;

    return filteredUsers.slice(
      start,
      start + rowsPerPage
    );
  }, [filteredUsers, page, rowsPerPage]);

  function openCreateDialog() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEditDialog(user) {
    setEditingId(user.user_id);
    setForm(mapUserToForm(user));
    setFormOpen(true);
  }

  function closeFormDialog() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.UserID.trim()) {
      setError("User ID is required");
      return;
    }

    if (!form.FullName.trim()) {
      setError("Full name is required");
      return;
    }

    if (!form.Email.trim()) {
      setError("Email is required");
      return;
    }

    if (
      !editingId &&
      form.Password.length < 8
    ) {
      setError(
        "Password must contain at least 8 characters"
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (editingId) {
        await api.put(
          `/auth/users/${encodeURIComponent(
            editingId
          )}`,
          {
            FullName: form.FullName,
            Email: form.Email,
            Role: form.Role,
          }
        );

        setSuccess("User updated successfully");
      } else {
        await api.post("/auth/users", form);
        setSuccess("User created successfully");
      }

      closeFormDialog();
      await loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to save user"
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user) {
    try {
      setError("");
      setSuccess("");

      await api.patch(
        `/auth/users/${encodeURIComponent(
          user.user_id
        )}/active`,
        {
          IsActive: !user.is_active,
        }
      );

      setSuccess(
        user.is_active
          ? "User deactivated successfully"
          : "User activated successfully"
      );

      await loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update account status"
      );
    }
  }

  function openPasswordDialog(user) {
    setPasswordUser(user);
    setNewPassword("");
    setPasswordOpen(true);
  }

  async function resetPassword() {
    if (!passwordUser) {
      return;
    }

    if (newPassword.length < 8) {
      setError(
        "Password must contain at least 8 characters"
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.patch(
        `/auth/users/${encodeURIComponent(
          passwordUser.user_id
        )}/password`,
        {
          Password: newPassword,
        }
      );

      setSuccess("Password updated successfully");
      setPasswordOpen(false);
      setPasswordUser(null);
      setNewPassword("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update password"
      );
    } finally {
      setSaving(false);
    }
  }

  function openActionMenu(event, user) {
    setActionAnchor(event.currentTarget);
    setActionUser(user);
  }

  function closeActionMenu() {
    setActionAnchor(null);
    setActionUser(null);
  }

  function editFromMenu() {
    if (actionUser) {
      openEditDialog(actionUser);
    }

    closeActionMenu();
  }

  function passwordFromMenu() {
    if (actionUser) {
      openPasswordDialog(actionUser);
    }

    closeActionMenu();
  }

  return (
    <Box>
      <Stack
        sx={{
          flexDirection: {
            xs: "column",
            sm: "row",
          },
          justifyContent: "space-between",
          alignItems: {
            xs: "stretch",
            sm: "center",
          },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700 }}
          >
            Users
          </Typography>

          <Typography color="text.secondary">
            Manage platform accounts, permissions,
            and access status.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
        >
          Add user
        </Button>
      </Stack>

      {error && (
        <Alert
          severity="error"
          onClose={() => setError("")}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity="success"
          onClose={() => setSuccess("")}
          sx={{ mb: 2 }}
        >
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack
          sx={{
            flexDirection: {
              xs: "column",
              sm: "row",
            },
            alignItems: {
              xs: "stretch",
              sm: "center",
            },
            gap: 2,
          }}
        >
          <TextField
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search user, email, or role..."
            fullWidth
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              },
            }}
          />

          <Tooltip title="Refresh">
            <span>
              <IconButton
                onClick={loadUsers}
                disabled={loading}
                color="primary"
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Paper>

      <Paper>
        <TableContainer>
          {loading ? (
            <Box
              sx={{
                minHeight: 260,
                display: "grid",
                placeItems: "center",
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {visibleUsers.map((user) => (
                  <TableRow
                    key={user.user_id}
                    hover
                  >
                    <TableCell>
                      {user.user_id}
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600 }}
                      >
                        {user.full_name}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      {user.email}
                    </TableCell>

                    <TableCell>
                      <Chip
                        size="small"
                        label={user.role}
                        color={roleColor(user.role)}
                      />
                    </TableCell>

                    <TableCell>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(
                              user.is_active
                            )}
                            onChange={() =>
                              toggleActive(user)
                            }
                            disabled={
                              currentUser?.userId ===
                              user.user_id
                            }
                          />
                        }
                        label={
                          user.is_active
                            ? "Active"
                            : "Inactive"
                        }
                      />
                    </TableCell>

                    <TableCell align="right">
                      <Tooltip title="User actions">
                        <IconButton
                          size="small"
                          onClick={(event) =>
                            openActionMenu(
                              event,
                              user
                            )
                          }
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}

                {!visibleUsers.length && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      align="center"
                      sx={{ py: 5 }}
                    >
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>

        {!loading && (
          <TablePagination
            component="div"
            count={filteredUsers.length}
            page={page}
            onPageChange={(_event, nextPage) =>
              setPage(nextPage)
            }
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(
                Number(event.target.value)
              );
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        )}
      </Paper>

      <Menu
        anchorEl={actionAnchor}
        open={Boolean(actionAnchor)}
        onClose={closeActionMenu}
      >
        <MenuItem onClick={editFromMenu}>
          <EditIcon
            fontSize="small"
            sx={{ mr: 1.25 }}
          />
          Edit
        </MenuItem>

        <MenuItem onClick={passwordFromMenu}>
          <KeyIcon
            fontSize="small"
            sx={{ mr: 1.25 }}
          />
          Reset password
        </MenuItem>
      </Menu>

      <Dialog
        open={formOpen}
        onClose={closeFormDialog}
        fullWidth
        maxWidth="sm"
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
        >
          <DialogTitle>
            {editingId
              ? "Edit user"
              : "Add user"}
          </DialogTitle>

          <DialogContent dividers>
            <Stack sx={{ gap: 2, pt: 1 }}>
              <TextField
                label="User ID"
                name="UserID"
                value={form.UserID}
                onChange={handleChange}
                required
                disabled={Boolean(editingId)}
              />

              <TextField
                label="Full name"
                name="FullName"
                value={form.FullName}
                onChange={handleChange}
                required
              />

              <TextField
                label="Email"
                name="Email"
                type="email"
                value={form.Email}
                onChange={handleChange}
                required
              />

              {!editingId && (
                <TextField
                  label="Temporary password"
                  name="Password"
                  type="password"
                  value={form.Password}
                  onChange={handleChange}
                  required
                  helperText="Minimum 8 characters"
                />
              )}

              <TextField
                select
                label="Role"
                name="Role"
                value={form.Role}
                onChange={handleChange}
                required
                disabled={
                  Boolean(editingId) &&
                  editingId === currentUser?.userId
                }
                helperText={
                  Boolean(editingId) &&
                  editingId === currentUser?.userId
                    ? "Your own admin role is protected"
                    : ""
                }
              >
                {roles.map((role) => (
                  <MenuItem
                    key={role.value}
                    value={role.value}
                  >
                    {role.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </DialogContent>

          <DialogActions>
            <Button
              onClick={closeFormDialog}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="contained"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update user"
                  : "Create user"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={passwordOpen}
        onClose={() => {
          if (!saving) {
            setPasswordOpen(false);
          }
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          Reset password
        </DialogTitle>

        <DialogContent dividers>
          <TextField
            label="New temporary password"
            type="password"
            value={newPassword}
            onChange={(event) =>
              setNewPassword(event.target.value)
            }
            fullWidth
            helperText="Minimum 8 characters"
            sx={{ mt: 1 }}
          />
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() =>
              setPasswordOpen(false)
            }
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={resetPassword}
            disabled={saving}
          >
            {saving
              ? "Updating..."
              : "Update password"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
