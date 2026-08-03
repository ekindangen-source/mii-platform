import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from "@mui/material";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

function toLocalInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 16);
}

function toIso(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function defaultTimes() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const reminder = new Date(
    start.getTime() - 30 * 60 * 1000
  );

  return {
    ScheduledStart: toLocalInput(start),
    ScheduledEnd: toLocalInput(end),
    ReminderAt: toLocalInput(reminder),
  };
}

function emptyForm(userId, customer) {
  return {
    CustomerID: customer?.customer_id || "",
    ContactID: "",
    AssignedTo: userId || "",
    ActivityType: "meeting",
    Status: "planned",
    Location: "",
    Purpose: "",
    Notes: "",
    ...defaultTimes(),
  };
}

function mapActivity(activity) {
  return {
    CustomerID: activity.customer_id || "",
    ContactID: activity.contact_id || "",
    AssignedTo: activity.assigned_to || "",
    ActivityType: activity.activity_type || "meeting",
    Status: activity.status || "planned",
    ScheduledStart: toLocalInput(activity.scheduled_start),
    ScheduledEnd: toLocalInput(activity.scheduled_end),
    ReminderAt: toLocalInput(activity.reminder_at),
    Location: activity.location || "",
    Purpose: activity.purpose || "",
    Notes: activity.notes || "",
  };
}

export default function ScheduleActivityDialog({
  open,
  activity = null,
  customer = null,
  onClose,
  onSaved,
}) {
  const { user } = useAuth();
  const canAssignOthers = ["admin", "manager"].includes(
    user?.role
  );
  const [form, setForm] = useState(() =>
    emptyForm(user?.userId, customer)
  );
  const [customers, setCustomers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setError("");
    setForm(
      activity
        ? mapActivity(activity)
        : emptyForm(user?.userId, customer)
    );

    async function loadOptions() {
      try {
        setLoadingOptions(true);
        const requests = [api.get("/scheduled-activities/users")];

        if (!customer) {
          requests.push(api.get("/customers"));
        }

        const [usersResponse, customersResponse] =
          await Promise.all(requests);

        setUsers(
          Array.isArray(usersResponse.data)
            ? usersResponse.data
            : []
        );

        if (customer) {
          setCustomers([customer]);
        } else {
          setCustomers(
            Array.isArray(customersResponse?.data)
              ? customersResponse.data
              : []
          );
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Unable to load scheduling options"
        );
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, [activity, customer, open, user?.userId]);

  useEffect(() => {
    if (!open || !form.CustomerID) {
      setContacts([]);
      return;
    }

    let cancelled = false;

    api
      .get(
        `/customers/${encodeURIComponent(
          form.CustomerID
        )}/contacts`
      )
      .then((response) => {
        if (!cancelled) {
          setContacts(
            Array.isArray(response.data)
              ? response.data.filter(
                  (contact) => contact.is_active
                )
              : []
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              "Unable to load customer PICs"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [form.CustomerID, open]);

  const sortedCustomers = useMemo(
    () =>
      [...customers].sort((left, right) =>
        String(left.company || "").localeCompare(
          String(right.company || "")
        )
      ),
    [customers]
  );

  function updateField(field) {
    return (event) => {
      const value = event.target.value;
      setForm((current) => ({
        ...current,
        [field]: value,
        ...(field === "CustomerID"
          ? { ContactID: "" }
          : {}),
      }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.CustomerID || !form.Purpose.trim()) {
      setError("Customer and purpose are required.");
      return;
    }

    if (!form.ScheduledStart) {
      setError("Scheduled start is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        CustomerID: form.CustomerID,
        ContactID: form.ContactID || null,
        AssignedTo: form.AssignedTo || user?.userId,
        ActivityType: form.ActivityType,
        Status: form.Status,
        ScheduledStart: toIso(form.ScheduledStart),
        ScheduledEnd: toIso(form.ScheduledEnd),
        ReminderAt: toIso(form.ReminderAt),
        Location: form.Location,
        Purpose: form.Purpose,
        Notes: form.Notes,
      };

      const response = activity
        ? await api.put(
            `/scheduled-activities/${encodeURIComponent(
              activity.activity_id
            )}`,
            payload
          )
        : await api.post("/scheduled-activities", payload);

      if (onSaved) {
        await onSaved(response.data?.activity);
      }

      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to save scheduled activity"
      );
    } finally {
      setSaving(false);
    }
  }

  const lockedCustomer = Boolean(customer);

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="md"
    >
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>
          {activity
            ? "Edit scheduled activity"
            : "Schedule meeting or visit"}
        </DialogTitle>

        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {loadingOptions ? (
            <Box sx={{ display: "grid", placeItems: "center", py: 5 }}>
              <CircularProgress size={30} />
            </Box>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "1fr 1fr",
                },
                gap: 2,
              }}
            >
              <TextField
                select
                required
                label="Customer"
                value={form.CustomerID}
                onChange={updateField("CustomerID")}
                disabled={lockedCustomer || saving}
                sx={{ gridColumn: { md: "1 / -1" } }}
              >
                {sortedCustomers.map((item) => (
                  <MenuItem
                    key={item.customer_id}
                    value={item.customer_id}
                  >
                    {item.company} ({item.customer_id})
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="PIC"
                value={form.ContactID}
                onChange={updateField("ContactID")}
                disabled={!form.CustomerID || saving}
              >
                <MenuItem value="">No PIC selected</MenuItem>
                {contacts.map((contact) => (
                  <MenuItem
                    key={contact.contact_id}
                    value={contact.contact_id}
                  >
                    {contact.full_name}
                    {contact.job_title
                      ? ` - ${contact.job_title}`
                      : ""}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                required
                label="Assigned user"
                value={form.AssignedTo}
                onChange={updateField("AssignedTo")}
                disabled={!canAssignOthers || saving}
              >
                {users.map((item) => (
                  <MenuItem
                    key={item.user_id}
                    value={item.user_id}
                  >
                    {item.full_name} ({item.role})
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                required
                label="Activity type"
                value={form.ActivityType}
                onChange={updateField("ActivityType")}
                disabled={saving}
              >
                <MenuItem value="meeting">Meeting</MenuItem>
                <MenuItem value="visit">Customer visit</MenuItem>
                <MenuItem value="call">Scheduled call</MenuItem>
                <MenuItem value="follow_up">Follow-up</MenuItem>
              </TextField>

              <TextField
                select
                required
                label="Status"
                value={form.Status}
                onChange={updateField("Status")}
                disabled={saving}
              >
                <MenuItem value="planned">Planned</MenuItem>
                <MenuItem value="confirmed">Confirmed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
                <MenuItem value="rescheduled">Rescheduled</MenuItem>
                <MenuItem value="no_show">No show</MenuItem>
              </TextField>

              <TextField
                required
                type="datetime-local"
                label="Scheduled start"
                value={form.ScheduledStart}
                onChange={updateField("ScheduledStart")}
                disabled={saving}
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <TextField
                type="datetime-local"
                label="Scheduled end"
                value={form.ScheduledEnd}
                onChange={updateField("ScheduledEnd")}
                disabled={saving}
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <TextField
                type="datetime-local"
                label="Email reminder"
                value={form.ReminderAt}
                onChange={updateField("ReminderAt")}
                disabled={saving}
                helperText="Reminder is emailed to the assigned user."
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <TextField
                label="Location"
                value={form.Location}
                onChange={updateField("Location")}
                disabled={saving}
              />

              <TextField
                required
                label="Purpose"
                value={form.Purpose}
                onChange={updateField("Purpose")}
                disabled={saving}
                sx={{ gridColumn: { md: "1 / -1" } }}
              />

              <TextField
                multiline
                minRows={3}
                label="Preparation notes"
                value={form.Notes}
                onChange={updateField("Notes")}
                disabled={saving}
                sx={{ gridColumn: { md: "1 / -1" } }}
              />
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving || loadingOptions}
          >
            {saving ? "Saving..." : "Save activity"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
