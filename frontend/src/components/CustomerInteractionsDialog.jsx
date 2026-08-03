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
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ImageIcon from "@mui/icons-material/Image";
import RefreshIcon from "@mui/icons-material/Refresh";

import api from "../services/api";
import ConfirmDialog from "./ConfirmDialog";

const INTERACTION_TYPES = [
  ["call", "Call"],
  ["email", "Email"],
  ["meeting", "Meeting"],
  ["visit", "Visit"],
  ["whatsapp", "WhatsApp"],
  ["other", "Other"],
];
const TYPE_LABELS = Object.fromEntries(INTERACTION_TYPES);
const ACCEPTED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_PHOTO_BYTES = 1024 * 1024;
const MAX_NEW_PHOTOS = 5;

function localDateTimeInput(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number) => String(number).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

function emptyForm() {
  return {
    InteractionType: "call",
    InteractionAt: localDateTimeInput(),
    ContactID: "",
    Participants: "",
    Notes: "",
    NextAction: "",
    NextActionAt: "",
  };
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const rawValue = String(value);
  const isoDate = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoDate) {
    return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return rawValue;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}/${date.getFullYear()}`;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const pad = (number) => String(number).padStart(2, "0");

  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/` +
    `${date.getFullYear()} ${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Unable to read ${file.name}`));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Unable to compress photo"));
        }
      },
      mimeType,
      quality
    );
  });
}

async function preparePhoto(file) {
  if (!ACCEPTED_PHOTO_TYPES.has(file.type)) {
    throw new Error(
      `${file.name}: only JPG, PNG, and WebP photos are allowed`
    );
  }

  const image = await loadImage(file);
  const maxDimension = 1600;
  const initialScale = Math.min(
    1,
    maxDimension / Math.max(image.width, image.height)
  );
  let width = Math.max(1, Math.round(image.width * initialScale));
  let height = Math.max(1, Math.round(image.height * initialScale));
  let quality = 0.86;
  const outputType =
    file.type === "image/png" ? "image/webp" : file.type;
  let blob = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", {
      alpha: outputType !== "image/jpeg",
    });

    if (!context) {
      throw new Error("Photo compression is unavailable");
    }

    context.drawImage(image, 0, 0, width, height);
    blob = await canvasToBlob(canvas, outputType, quality);

    if (blob.size <= MAX_PHOTO_BYTES) {
      break;
    }

    if (quality > 0.52) {
      quality -= 0.1;
    } else {
      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }
  }

  if (!blob || blob.size > MAX_PHOTO_BYTES) {
    throw new Error(
      `${file.name}: unable to compress the photo below 1 MB`
    );
  }

  const dataUrl = await readAsDataUrl(blob);

  return {
    OriginalName: file.name,
    MimeType: blob.type || outputType,
    DataBase64: dataUrl.split(",")[1] || "",
  };
}

function mapInteractionToForm(interaction) {
  return {
    InteractionType: interaction.interaction_type || "other",
    InteractionAt: localDateTimeInput(
      interaction.interaction_at
    ),
    ContactID: interaction.contact_id || "",
    Participants: interaction.participants || "",
    Notes: interaction.notes || "",
    NextAction:
      interaction.next_action_scheduled_purpose ||
      interaction.next_action ||
      "",
    NextActionAt: localDateTimeInput(
      interaction.next_action_scheduled_at ||
        interaction.next_action_at ||
        interaction.next_action_date
    ),
  };
}

export default function CustomerInteractionsDialog({
  open,
  customer,
  canWrite,
  canDelete,
  onClose,
}) {
  const customerId = customer?.customer_id || "";
  const [interactions, setInteractions] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingInteraction, setEditingInteraction] =
    useState(null);
  const [form, setForm] = useState(emptyForm);
  const [newPhotos, setNewPhotos] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [photoDeleteTarget, setPhotoDeleteTarget] =
    useState(null);

  const basePath = useMemo(
    () =>
      customerId
        ? `/customers/${encodeURIComponent(
            customerId
          )}/interactions`
        : "",
    [customerId]
  );

  async function loadData() {
    if (!customerId) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [interactionResponse, contactResponse] =
        await Promise.all([
          api.get(basePath),
          api.get(
            `/customers/${encodeURIComponent(
              customerId
            )}/contacts`
          ),
        ]);

      if (!Array.isArray(interactionResponse.data)) {
        throw new Error("Unexpected interactions response");
      }

      if (!Array.isArray(contactResponse.data)) {
        throw new Error("Unexpected contacts response");
      }

      setInteractions(interactionResponse.data);
      setContacts(contactResponse.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to load customer interactions"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && customerId) {
      loadData();
    }
  }, [open, customerId]);

  function openCreateForm() {
    setEditingInteraction(null);
    setForm(emptyForm());
    setNewPhotos([]);
    setFormOpen(true);
  }

  function openEditForm(interaction) {
    setEditingInteraction(interaction);
    setForm(mapInteractionToForm(interaction));
    setNewPhotos([]);
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingInteraction(null);
    setForm(emptyForm());
    setNewPhotos([]);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handlePhotoSelection(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (files.length > MAX_NEW_PHOTOS) {
      setError(
        `Select no more than ${MAX_NEW_PHOTOS} photos per save`
      );
      return;
    }

    const invalid = files.find(
      (file) => !ACCEPTED_PHOTO_TYPES.has(file.type)
    );

    if (invalid) {
      setError(
        `${invalid.name}: only JPG, PNG, and WebP photos are allowed`
      );
      return;
    }

    setNewPhotos(files);
    setError("");
  }

  async function uploadSelectedPhotos(interactionId) {
    for (const file of newPhotos) {
      const payload = await preparePhoto(file);
      await api.post(
        `${basePath}/${encodeURIComponent(
          interactionId
        )}/photos`,
        payload
      );
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.Notes.trim()) {
      setError("Interaction notes are required");
      return;
    }

    if (Boolean(form.NextAction.trim()) !== Boolean(form.NextActionAt)) {
      setError(
        "Next action and next action date and time must both be provided"
      );
      return;
    }

    let interactionSaved = false;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        ...form,
        InteractionAt: new Date(
          form.InteractionAt
        ).toISOString(),
        NextActionAt: form.NextActionAt
          ? new Date(form.NextActionAt).toISOString()
          : null,
      };
      let interactionId =
        editingInteraction?.interaction_id;

      if (interactionId) {
        await api.put(
          `${basePath}/${encodeURIComponent(
            interactionId
          )}`,
          payload
        );
      } else {
        const response = await api.post(basePath, payload);
        interactionId =
          response.data?.interaction?.interaction_id;
      }

      if (!interactionId) {
        throw new Error(
          "The interaction was saved without an interaction ID"
        );
      }

      interactionSaved = true;

      if (newPhotos.length) {
        await uploadSelectedPhotos(interactionId);
      }

      setSuccess(
        editingInteraction
          ? "Interaction updated successfully"
          : "Unscheduled interaction logged successfully"
      );
      setFormOpen(false);
      setEditingInteraction(null);
      setForm(emptyForm());
      setNewPhotos([]);
      await loadData();
    } catch (requestError) {
      const message =
        requestError.response?.data?.message ||
        requestError.message ||
        "Unable to save interaction";

      setError(
        interactionSaved
          ? `Interaction saved, but a photo could not be uploaded: ${message}`
          : message
      );

      if (interactionSaved) {
        await loadData();
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteInteraction() {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      await api.delete(
        `${basePath}/${encodeURIComponent(
          deleteTarget.interaction_id
        )}`
      );
      setDeleteTarget(null);
      setSuccess("Interaction deleted successfully");
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to delete interaction"
      );
    } finally {
      setDeleting(false);
    }
  }

  async function confirmDeletePhoto() {
    if (!photoDeleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      await api.delete(
        `${basePath}/${encodeURIComponent(
          photoDeleteTarget.interactionId
        )}/photos/${encodeURIComponent(
          photoDeleteTarget.photo.photo_id
        )}`
      );
      setPhotoDeleteTarget(null);
      setSuccess("Photo deleted successfully");
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to delete photo"
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            gap={1}
          >
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Interaction history
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                {customer?.company || "Customer"} - {customerId}
              </Typography>
            </Box>

            <Stack direction="row" gap={1}>
              <Tooltip title="Refresh interactions">
                <span>
                  <IconButton
                    onClick={loadData}
                    disabled={loading}
                  >
                    <RefreshIcon />
                  </IconButton>
                </span>
              </Tooltip>

              {canWrite && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={openCreateForm}
                >
                  Log unscheduled interaction
                </Button>
              )}
            </Stack>
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
                minHeight: 280,
                display: "grid",
                placeItems: "center",
              }}
            >
              <CircularProgress />
            </Box>
          ) : interactions.length ? (
            <Stack spacing={2}>
              {interactions.map((interaction) => (
                <Paper
                  key={interaction.interaction_id}
                  variant="outlined"
                  sx={{ p: { xs: 1.5, sm: 2 } }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{
                      xs: "flex-start",
                      sm: "flex-start",
                    }}
                    gap={1.5}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        flexWrap="wrap"
                        gap={1}
                      >
                        <Chip
                          size="small"
                          label={
                            TYPE_LABELS[
                              interaction.interaction_type
                            ] || "Other"
                          }
                        />
                        <Typography
                          variant="subtitle2"
                          fontWeight={700}
                        >
                          {formatDate(interaction.interaction_at)} -{" "}
                          {interaction.interaction_id}
                        </Typography>
                      </Stack>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.75 }}
                      >
                        PIC: {interaction.contact_name || "Not specified"}
                        {interaction.contact_job_title
                          ? ` - ${interaction.contact_job_title}`
                          : ""}
                      </Typography>

                      {interaction.participants && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          Participants: {interaction.participants}
                        </Typography>
                      )}
                    </Box>

                    {(canWrite || canDelete) && (
                      <Stack direction="row" gap={0.5}>
                        {canWrite && (
                          <Tooltip title="Edit interaction">
                            <IconButton
                              size="small"
                              onClick={() =>
                                openEditForm(interaction)
                              }
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip title="Delete interaction">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() =>
                                setDeleteTarget(interaction)
                              }
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    )}
                  </Stack>

                  <Divider sx={{ my: 1.5 }} />

                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: "pre-wrap" }}
                  >
                    {interaction.notes}
                  </Typography>

                  {(interaction.next_action ||
                    interaction.next_action_scheduled_purpose ||
                    interaction.next_action_at ||
                    interaction.next_action_scheduled_at) && (
                    <Box
                      sx={{
                        mt: 1.5,
                        p: 1.25,
                        bgcolor: "action.hover",
                        borderRadius: 1,
                      }}
                    >
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        color="text.secondary"
                      >
                        NEXT ACTION
                      </Typography>
                      <Typography variant="body2">
                        {interaction.next_action_scheduled_purpose ||
                          interaction.next_action ||
                          "Follow up"}
                        {(interaction.next_action_scheduled_at ||
                          interaction.next_action_at)
                          ? ` - ${formatDateTime(
                              interaction.next_action_scheduled_at ||
                                interaction.next_action_at
                            )}`
                          : ""}
                        {interaction.next_action_activity_id
                          ? ` - Agenda ${interaction.next_action_activity_id}`
                          : ""}
                      </Typography>
                    </Box>
                  )}

                  {interaction.photos?.length > 0 && (
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      gap={1}
                      sx={{ mt: 1.5 }}
                    >
                      {interaction.photos.map((photo) => (
                        <Box
                          key={photo.photo_id}
                          sx={{
                            width: 112,
                            position: "relative",
                          }}
                        >
                          {photo.photo_url ? (
                            <Box
                              component="a"
                              href={photo.photo_url}
                              target="_blank"
                              rel="noreferrer"
                              sx={{ display: "block" }}
                            >
                              <Box
                                component="img"
                                src={photo.photo_url}
                                alt={
                                  photo.original_name ||
                                  "Interaction photo"
                                }
                                sx={{
                                  width: 112,
                                  height: 84,
                                  objectFit: "cover",
                                  borderRadius: 1,
                                  border: 1,
                                  borderColor: "divider",
                                }}
                              />
                            </Box>
                          ) : (
                            <Box
                              sx={{
                                width: 112,
                                height: 84,
                                display: "grid",
                                placeItems: "center",
                                borderRadius: 1,
                                border: 1,
                                borderColor: "divider",
                              }}
                            >
                              <ImageIcon color="disabled" />
                            </Box>
                          )}

                          {canWrite && (
                            <Tooltip title="Delete photo">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  setPhotoDeleteTarget({
                                    interactionId:
                                      interaction.interaction_id,
                                    photo,
                                  })
                                }
                                sx={{
                                  position: "absolute",
                                  top: 2,
                                  right: 2,
                                  bgcolor: "background.paper",
                                  "&:hover": {
                                    bgcolor: "background.paper",
                                  },
                                }}
                              >
                                <DeleteIcon fontSize="inherit" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  )}

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1.5 }}
                  >
                    Recorded by {interaction.created_by_name || "Unknown user"}
                    {interaction.updated_at &&
                    interaction.updated_at !== interaction.created_at
                      ? ` - Updated ${formatDate(
                          interaction.updated_at
                        )}`
                      : ""}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Box sx={{ py: 8, textAlign: "center" }}>
              <Typography fontWeight={700}>
                No interactions recorded
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                Scheduled activities are logged automatically when completed.
                Use this action only for unscheduled calls, emails, WhatsApp
                messages, meetings, or visits.
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={formOpen}
        onClose={closeForm}
        fullWidth
        maxWidth="md"
      >
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>
            {editingInteraction
              ? "Edit interaction"
              : "Log unscheduled interaction"}
          </DialogTitle>

          <DialogContent dividers>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "1fr 1fr",
                },
                gap: 2,
                pt: 1,
              }}
            >
              <TextField
                select
                label="Interaction type"
                name="InteractionType"
                value={form.InteractionType}
                onChange={handleChange}
                required
              >
                {INTERACTION_TYPES.map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Date and time"
                name="InteractionAt"
                type="datetime-local"
                value={form.InteractionAt}
                onChange={handleChange}
                required
                slotProps={{
                  inputLabel: { shrink: true },
                }}
              />

              <TextField
                select
                label="PIC / Contact"
                name="ContactID"
                value={form.ContactID}
                onChange={handleChange}
              >
                <MenuItem value="">
                  <em>Not specified</em>
                </MenuItem>
                {contacts.map((contact) => (
                  <MenuItem
                    key={contact.contact_id}
                    value={contact.contact_id}
                  >
                    {contact.full_name}
                    {contact.job_title
                      ? ` - ${contact.job_title}`
                      : ""}
                    {!contact.is_active ? " (Inactive)" : ""}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Other participants"
                name="Participants"
                value={form.Participants}
                onChange={handleChange}
                placeholder="Names or teams not listed as the PIC"
              />

              <TextField
                label="Interaction notes"
                name="Notes"
                value={form.Notes}
                onChange={handleChange}
                required
                multiline
                minRows={4}
                sx={{ gridColumn: { sm: "1 / -1" } }}
              />

              <TextField
                label="Next action"
                name="NextAction"
                value={form.NextAction}
                onChange={handleChange}
                placeholder="Example: Send quotation"
              />

              <TextField
                label="Next action date and time"
                name="NextActionAt"
                type="datetime-local"
                value={form.NextActionAt}
                onChange={handleChange}
                slotProps={{
                  inputLabel: { shrink: true },
                }}
              />

              <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<ImageIcon />}
                >
                  Select photos
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handlePhotoSelection}
                  />
                </Button>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.75 }}
                >
                  Up to {MAX_NEW_PHOTOS} new photos per save. Photos
                  are compressed in the browser to a maximum of 1 MB
                  each and stored privately in S3.
                </Typography>

                {newPhotos.length > 0 && (
                  <Stack
                    direction="row"
                    flexWrap="wrap"
                    gap={0.75}
                    sx={{ mt: 1 }}
                  >
                    {newPhotos.map((file) => (
                      <Chip
                        key={`${file.name}-${file.lastModified}`}
                        size="small"
                        label={file.name}
                        onDelete={() =>
                          setNewPhotos((current) =>
                            current.filter(
                              (candidate) => candidate !== file
                            )
                          )
                        }
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>
          </DialogContent>

          <DialogActions>
            <Button onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingInteraction
                  ? "Update interaction"
                  : "Create interaction"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete interaction"
        message={
          deleteTarget
            ? `Delete ${deleteTarget.interaction_id}? Its photos will also be removed. This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteInteraction}
      />

      <ConfirmDialog
        open={Boolean(photoDeleteTarget)}
        title="Delete interaction photo"
        message="Delete this photo? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setPhotoDeleteTarget(null)}
        onConfirm={confirmDeletePhoto}
      />
    </>
  );
}
