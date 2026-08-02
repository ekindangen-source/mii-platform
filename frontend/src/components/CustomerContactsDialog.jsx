import {
  useEffect,
  useState,
} from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import StarIcon from "@mui/icons-material/Star";

import api from "../services/api";

const emptyForm = {
  FullName: "",
  JobTitle: "",
  Telephone: "",
  Email: "",
  IsPrimary: false,
  IsActive: true,
  Notes: "",
};

function mapContactToForm(contact) {
  return {
    FullName: contact.full_name || "",
    JobTitle: contact.job_title || "",
    Telephone: contact.telephone || "",
    Email: contact.email || "",
    IsPrimary: Boolean(contact.is_primary),
    IsActive: Boolean(contact.is_active),
    Notes: contact.notes || "",
  };
}

export default function CustomerContactsDialog({
  open,
  customer,
  canWrite,
  onClose,
  onChanged,
}) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] =
    useState(null);
  const [form, setForm] = useState(emptyForm);

  const customerId = customer?.customer_id;

  async function loadContacts() {
    if (!customerId) {
      setContacts([]);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        `/customers/${encodeURIComponent(
          customerId
        )}/contacts`
      );

      if (!Array.isArray(response.data)) {
        throw new Error(
          "Unexpected customer contacts response"
        );
      }

      setContacts(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load customer contacts"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && customerId) {
      loadContacts();
    } else {
      setContacts([]);
      setError("");
      setSuccess("");
      setFormOpen(false);
      setEditingContact(null);
      setForm(emptyForm);
    }
  }, [open, customerId]);

  function openCreateForm() {
    setEditingContact(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEditForm(contact) {
    setEditingContact(contact);
    setForm(mapContactToForm(contact));
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingContact(null);
    setForm(emptyForm);
  }

  function changeField(event) {
    const {
      name,
      value,
      checked,
      type,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  }

  async function saveContact(event) {
    event.preventDefault();

    if (!form.FullName.trim()) {
      setError("Contact name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (editingContact) {
        await api.put(
          `/customers/${encodeURIComponent(
            customerId
          )}/contacts/${encodeURIComponent(
            editingContact.contact_id
          )}`,
          form
        );

        setSuccess("Contact updated");
      } else {
        await api.post(
          `/customers/${encodeURIComponent(
            customerId
          )}/contacts`,
          form
        );

        setSuccess("Contact added");
      }

      closeForm();
      await loadContacts();
      await onChanged?.();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to save contact"
      );
    } finally {
      setSaving(false);
    }
  }

  async function setPrimary(contact) {
    try {
      setWorkingId(contact.contact_id);
      setError("");
      setSuccess("");

      await api.post(
        `/customers/${encodeURIComponent(
          customerId
        )}/contacts/${encodeURIComponent(
          contact.contact_id
        )}/set-primary`
      );

      setSuccess(
        `${contact.full_name} is now the primary contact`
      );
      await loadContacts();
      await onChanged?.();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to set primary contact"
      );
    } finally {
      setWorkingId("");
    }
  }

  async function toggleStatus(contact) {
    const nextActive = !contact.is_active;

    try {
      setWorkingId(contact.contact_id);
      setError("");
      setSuccess("");

      await api.patch(
        `/customers/${encodeURIComponent(
          customerId
        )}/contacts/${encodeURIComponent(
          contact.contact_id
        )}/status`,
        {
          IsActive: nextActive,
        }
      );

      setSuccess(
        nextActive
          ? "Contact reactivated"
          : "Contact deactivated"
      );
      await loadContacts();
      await onChanged?.();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to change contact status"
      );
    } finally {
      setWorkingId("");
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{
              xs: "flex-start",
              sm: "center",
            }}
          >
            <Box>
              <Typography
                variant="h6"
                fontWeight={700}
              >
                Contacts / PICs
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                {customer?.company || "Customer"}
                {customerId
                  ? ` — ${customerId}`
                  : ""}
              </Typography>
            </Box>

            {canWrite && (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={openCreateForm}
              >
                Add contact
              </Button>
            )}
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
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

          {loading ? (
            <Box
              sx={{
                minHeight: 220,
                display: "grid",
                placeItems: "center",
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {contacts.map((contact) => {
                const isWorking =
                  workingId === contact.contact_id;

                return (
                  <Paper
                    key={contact.contact_id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      opacity: contact.is_active
                        ? 1
                        : 0.62,
                    }}
                  >
                    <Stack
                      direction={{
                        xs: "column",
                        md: "row",
                      }}
                      spacing={2}
                      justifyContent="space-between"
                      alignItems={{
                        xs: "stretch",
                        md: "flex-start",
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="flex-start"
                      >
                        <PersonIcon
                          color={
                            contact.is_primary
                              ? "primary"
                              : "disabled"
                          }
                          sx={{ mt: 0.25 }}
                        />

                        <Box>
                          <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            flexWrap="wrap"
                            alignItems="center"
                          >
                            <Typography
                              fontWeight={700}
                            >
                              {contact.full_name}
                            </Typography>

                            {contact.is_primary && (
                              <Chip
                                icon={<StarIcon />}
                                label="Primary"
                                color="primary"
                                size="small"
                              />
                            )}

                            <Chip
                              label={
                                contact.is_active
                                  ? "Active"
                                  : "Inactive"
                              }
                              color={
                                contact.is_active
                                  ? "success"
                                  : "default"
                              }
                              variant="outlined"
                              size="small"
                            />
                          </Stack>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5 }}
                          >
                            {contact.job_title ||
                              "Role not recorded"}
                          </Typography>

                          <Typography
                            variant="body2"
                            sx={{ mt: 1 }}
                          >
                            {contact.telephone || "—"}
                            {contact.email
                              ? ` · ${contact.email}`
                              : ""}
                          </Typography>

                          {contact.notes && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                mt: 1,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {contact.notes}
                            </Typography>
                          )}
                        </Box>
                      </Stack>

                      {canWrite && (
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent={{
                            xs: "flex-end",
                            md: "flex-start",
                          }}
                        >
                          {!contact.is_primary &&
                            contact.is_active && (
                              <Tooltip title="Set as primary">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    disabled={isWorking}
                                    onClick={() =>
                                      setPrimary(contact)
                                    }
                                  >
                                    <StarIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}

                          <Tooltip title="Edit contact">
                            <span>
                              <IconButton
                                size="small"
                                disabled={isWorking}
                                onClick={() =>
                                  openEditForm(contact)
                                }
                              >
                                <EditIcon />
                              </IconButton>
                            </span>
                          </Tooltip>

                          <Tooltip
                            title={
                              contact.is_active
                                ? "Deactivate contact"
                                : "Reactivate contact"
                            }
                          >
                            <span>
                              <IconButton
                                size="small"
                                color={
                                  contact.is_active
                                    ? "warning"
                                    : "success"
                                }
                                disabled={isWorking}
                                onClick={() =>
                                  toggleStatus(contact)
                                }
                              >
                                {contact.is_active ? (
                                  <BlockIcon />
                                ) : (
                                  <CheckCircleIcon />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                );
              })}

              {!contacts.length && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 4,
                    textAlign: "center",
                  }}
                >
                  <PersonIcon
                    color="disabled"
                    sx={{ fontSize: 42 }}
                  />
                  <Typography
                    fontWeight={700}
                    sx={{ mt: 1 }}
                  >
                    No contacts recorded
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    Add the customer’s first PIC or
                    contact person.
                  </Typography>
                </Paper>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={formOpen}
        onClose={closeForm}
        fullWidth
        maxWidth="sm"
      >
        <Box
          component="form"
          onSubmit={saveContact}
        >
          <DialogTitle>
            {editingContact
              ? "Edit contact"
              : "Add contact"}
          </DialogTitle>

          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <TextField
                label="Full name"
                name="FullName"
                value={form.FullName}
                onChange={changeField}
                required
                autoFocus
              />

              <TextField
                label="Job title / role"
                name="JobTitle"
                value={form.JobTitle}
                onChange={changeField}
              />

              <TextField
                label="Telephone"
                name="Telephone"
                value={form.Telephone}
                onChange={changeField}
              />

              <TextField
                label="Email"
                name="Email"
                type="email"
                value={form.Email}
                onChange={changeField}
              />

              <TextField
                label="Notes"
                name="Notes"
                value={form.Notes}
                onChange={changeField}
                multiline
                minRows={3}
              />

              <Stack
                direction={{
                  xs: "column",
                  sm: "row",
                }}
                spacing={1}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      name="IsPrimary"
                      checked={form.IsPrimary}
                      onChange={changeField}
                      disabled={!form.IsActive}
                    />
                  }
                  label="Primary contact"
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      name="IsActive"
                      checked={form.IsActive}
                      onChange={changeField}
                    />
                  }
                  label="Active"
                />
              </Stack>
            </Stack>
          </DialogContent>

          <DialogActions>
            <Button
              onClick={closeForm}
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
                : editingContact
                  ? "Update contact"
                  : "Add contact"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
