import { useEffect, useMemo, useState } from "react";
import imageCompression from "browser-image-compression";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";

import api, {
  apiAssetUrl,
} from "../services/api";
import useMasterData from "../hooks/useMasterData";
import ConfirmDialog from "../components/ConfirmDialog";
import RecordDetailsDialog from "../components/RecordDetailsDialog";
import { useAuth } from "../context/AuthContext";
import {
  canDeleteModule,
  canWriteModule,
} from "../utils/permissions";
import {
  primaryCellSx,
  responsiveTableSx,
  stickyActionCellSx,
  stickyActionHeaderSx,
  truncateTextSx,
} from "../utils/responsiveTable";

const emptyForm = {
  CustomerID: "",
  BoatName: "",
  Builder: "",
  YearBuilt: "",
  LengthM: "",
  BeamM: "",
  HullMaterial: "",
  HullType: "",
  PassengerCapacity: "",
  FuelTankL: "",
  HomePort: "",
  TypicalRoute: "",
};

const sortableColumns = [
  { id: "boat_name", label: "Vessel" },
  { id: "customer_name", label: "Customer" },
  { id: "year_built", label: "Year", numeric: true },
  { id: "length_m", label: "Length (m)", numeric: true },
];

const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_SOURCE_PHOTO_BYTES =
  25 * 1024 * 1024;

const MAX_COMPRESSED_PHOTO_BYTES =
  1024 * 1024;

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(0)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

async function compressVesselPhoto(file) {
  if (file.size <= MAX_COMPRESSED_PHOTO_BYTES) {
    return file;
  }

  const attempts = [
    {
      maxSizeMB: 0.95,
      maxWidthOrHeight: 1920,
      initialQuality: 0.85,
    },
    {
      maxSizeMB: 0.85,
      maxWidthOrHeight: 1600,
      initialQuality: 0.75,
    },
    {
      maxSizeMB: 0.75,
      maxWidthOrHeight: 1280,
      initialQuality: 0.65,
    },
  ];

  for (const options of attempts) {
    const compressed = await imageCompression(
      file,
      {
        ...options,
        useWebWorker: true,
        fileType: "image/webp",
        preserveExif: false,
      }
    );

    if (
      compressed.size <=
      MAX_COMPRESSED_PHOTO_BYTES
    ) {
      const baseName =
        file.name.replace(/\.[^.]+$/, "") ||
        "vessel-photo";

      return new File(
        [compressed],
        `${baseName}.webp`,
        {
          type:
            compressed.type ||
            "image/webp",
          lastModified: Date.now(),
        }
      );
    }
  }

  throw new Error(
    "The photo could not be compressed below 1 MB. Choose a smaller image."
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () =>
      resolve(String(reader.result || ""));

    reader.onerror = () =>
      reject(
        new Error("Unable to read photo")
      );

    reader.readAsDataURL(file);
  });
}

function vesselPhotoUrl(
  photoPath,
  photoUrl
) {
  if (photoUrl) {
    return photoUrl;
  }

  // Legacy EC2-hosted photos use an API path.
  if (
    String(photoPath || "").startsWith(
      "/uploads/"
    )
  ) {
    return apiAssetUrl(photoPath);
  }

  // S3 object keys require a signed photo_url
  // returned by the backend.
  return "";
}

function mapRow(row) {
  return {
    CustomerID: row.customer_id || "",
    BoatName: row.boat_name || "",
    Builder: row.builder || "",
    YearBuilt: row.year_built ?? "",
    LengthM: row.length_m ?? "",
    BeamM: row.beam_m ?? "",
    HullMaterial: row.hull_material || "",
    HullType: row.hull_type || "",
    PassengerCapacity: row.passenger_capacity ?? "",
    FuelTankL: row.fuel_tank_l ?? "",
    HomePort: row.home_port || "",
    TypicalRoute: row.typical_route || "",
  };
}

function compareValues(left, right, numeric = false) {
  if (numeric) {
    return Number(left ?? 0) - Number(right ?? 0);
  }

  return String(left ?? "").localeCompare(
    String(right ?? ""),
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    }
  );
}

export default function Vessels() {
  const { valuesByCategory } = useMasterData([
    "vessel_boat_builder",
    "vessel_material",
    "vessel_type",
  ]);

  const { user } = useAuth();
  const canWrite = canWriteModule(
    user?.role,
    "vessels"
  );
  const canDelete = canDeleteModule(
    user?.role,
    "vessels"
  );

  const [vessels, setVessels] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");

  const [orderBy, setOrderBy] = useState("boat_name");
  const [order, setOrder] = useState("asc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const boatBuilders = [
    ...new Set(
      [
        ...(valuesByCategory.vessel_boat_builder || []),
        form.Builder,
      ].filter(Boolean)
    ),
  ];
  const hullMaterials = [
    ...new Set(
      [
        ...(valuesByCategory.vessel_material || []),
        form.HullMaterial,
      ].filter(Boolean)
    ),
  ];
  const hullTypes = [
    ...new Set(
      [
        ...(valuesByCategory.vessel_type || []),
        form.HullType,
      ].filter(Boolean)
    ),
  ];

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [actionAnchor, setActionAnchor] = useState(null);
  const [actionVessel, setActionVessel] = useState(null);

  const [selectedVessel, setSelectedVessel] = useState(null);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoCompressionInfo, setPhotoCompressionInfo] =
    useState("");
  const [compressingPhoto, setCompressingPhoto] =
    useState(false);
  const [removePhoto, setRemovePhoto] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [vesselsResponse, customersResponse] =
        await Promise.all([
          api.get("/vessels"),
          api.get("/customers"),
        ]);

      if (
        !Array.isArray(vesselsResponse.data) ||
        !Array.isArray(customersResponse.data)
      ) {
        throw new Error("Unexpected API response");
      }

      setVessels(vesselsResponse.data);
      setCustomers(customersResponse.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load vessel data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [search, rowsPerPage]);

  const customerMap = useMemo(() => {
    const map = new Map();

    customers.forEach((customer) => {
      map.set(
        customer.customer_id,
        customer.company || customer.customer_id
      );
    });

    return map;
  }, [customers]);

  const enrichedVessels = useMemo(
    () =>
      vessels.map((vessel) => ({
        ...vessel,
        customer_name:
          vessel.company ||
          customerMap.get(vessel.customer_id) ||
          vessel.customer_id ||
          "",
      })),
    [customerMap, vessels]
  );

  const filteredVessels = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return enrichedVessels;
    }

    return enrichedVessels.filter((vessel) =>
      [
        vessel.vessel_id,
        vessel.boat_name,
        vessel.builder,
        vessel.customer_name,
        vessel.customer_id,
        vessel.home_port,
        vessel.hull_material,
        vessel.hull_type,
        vessel.typical_route,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      )
    );
  }, [enrichedVessels, search]);

  const sortedVessels = useMemo(() => {
    const selectedColumn = sortableColumns.find(
      (column) => column.id === orderBy
    );

    return [...filteredVessels].sort((left, right) => {
      const comparison = compareValues(
        left[orderBy],
        right[orderBy],
        selectedColumn?.numeric
      );

      return order === "asc" ? comparison : -comparison;
    });
  }, [filteredVessels, order, orderBy]);

  const visibleVessels = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedVessels.slice(start, start + rowsPerPage);
  }, [page, rowsPerPage, sortedVessels]);

  function handleSort(columnId) {
    const isAscending =
      orderBy === columnId && order === "asc";

    setOrder(isAscending ? "desc" : "asc");
    setOrderBy(columnId);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setPhotoFile(null);
    setPhotoPreview("");
    setPhotoCompressionInfo("");
    setCompressingPhoto(false);
    setRemovePhoto(false);
    setFormOpen(true);
  }

  function openEdit(vessel) {
    setEditingId(vessel.vessel_id);
    setForm(mapRow(vessel));
    setPhotoFile(null);
    setPhotoPreview(
      vesselPhotoUrl(
        vessel.photo_path,
        vessel.photo_url
      )
    );
    setPhotoCompressionInfo("");
    setCompressingPhoto(false);
    setRemovePhoto(false);
    setFormOpen(true);
  }

  function closeForm() {
    if (saving || compressingPhoto) {
      return;
    }

    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setPhotoFile(null);
    setPhotoPreview("");
    setPhotoCompressionInfo("");
    setRemovePhoto(false);
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (
      !ALLOWED_PHOTO_TYPES.includes(
        file.type
      )
    ) {
      setError(
        "Only JPG, PNG, and WebP photos are allowed"
      );
      return;
    }

    if (
      file.size >
      MAX_SOURCE_PHOTO_BYTES
    ) {
      setError(
        "The original photo must not exceed 25 MB"
      );
      return;
    }

    try {
      setCompressingPhoto(true);
      setError("");
      setPhotoCompressionInfo("");

      const compressedFile =
        await compressVesselPhoto(file);

      if (
        compressedFile.size >
        MAX_COMPRESSED_PHOTO_BYTES
      ) {
        throw new Error(
          "Compressed vessel photo must not exceed 1 MB"
        );
      }

      const preview =
        await fileToDataUrl(
          compressedFile
        );

      setPhotoFile(compressedFile);
      setPhotoPreview(preview);
      setRemovePhoto(false);
      setPhotoCompressionInfo(
        file.size === compressedFile.size
          ? `${formatFileSize(
              compressedFile.size
            )} — already within the 1 MB limit`
          : `${formatFileSize(
              file.size
            )} → ${formatFileSize(
              compressedFile.size
            )}`
      );
    } catch (compressionError) {
      setPhotoFile(null);
      setPhotoPreview("");
      setPhotoCompressionInfo("");
      setError(
        compressionError.message ||
          "Unable to compress vessel photo"
      );
    } finally {
      setCompressingPhoto(false);
    }
  }

  function clearPhoto() {
    setPhotoFile(null);
    setPhotoPreview("");
    setPhotoCompressionInfo("");
    setRemovePhoto(Boolean(editingId));
  }

  async function saveVesselPhoto(
    vesselId
  ) {
    if (photoFile) {
      const dataUrl =
        await fileToDataUrl(photoFile);

      const base64 =
        dataUrl.split(",")[1] || "";

      await api.put(
        `/vessels/${encodeURIComponent(
          vesselId
        )}/photo`,
        {
          FileName: photoFile.name,
          MimeType: photoFile.type,
          DataBase64: base64,
        }
      );

      return;
    }

    if (removePhoto && editingId) {
      await api.delete(
        `/vessels/${encodeURIComponent(
          vesselId
        )}/photo`
      );
    }
  }

  function change(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();

    if (compressingPhoto) {
      setError(
        "Photo compression is still in progress"
      );
      return;
    }

    if (!form.CustomerID.trim()) {
      setError("Customer is required");
      return;
    }

    const payload = {
      ...form,
      YearBuilt:
        form.YearBuilt === ""
          ? null
          : Number(form.YearBuilt),
      LengthM:
        form.LengthM === ""
          ? null
          : Number(form.LengthM),
      BeamM:
        form.BeamM === ""
          ? null
          : Number(form.BeamM),
      PassengerCapacity:
        form.PassengerCapacity === ""
          ? null
          : Number(form.PassengerCapacity),
      FuelTankL:
        form.FuelTankL === ""
          ? null
          : Number(form.FuelTankL),
    };

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      let savedVesselId = editingId;
      let successMessage =
        "Vessel updated successfully";

      if (editingId) {
        await api.put(
          `/vessels/${encodeURIComponent(editingId)}`,
          payload
        );
      } else {
        const response = await api.post(
          "/vessels",
          payload
        );

        savedVesselId =
          response.data?.vessel?.vessel_id;

        successMessage = savedVesselId
          ? `Vessel ${savedVesselId} created successfully`
          : "Vessel created successfully";
      }

      if (!savedVesselId) {
        throw new Error(
          "Vessel was saved but no vessel ID was returned"
        );
      }

      try {
        await saveVesselPhoto(
          savedVesselId
        );
      } catch (photoError) {
        await loadData();

        setEditingId(savedVesselId);
        setError(
          `Vessel saved, but the photo could not be updated: ${
            photoError.response?.data?.message ||
            photoError.message
          }`
        );
        return;
      }

      setSuccess(successMessage);
      closeForm();
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to save vessel"
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      setError("");

      await api.delete(
        `/vessels/${encodeURIComponent(
          deleteTarget.vessel_id
        )}`
      );

      setSuccess("Vessel deleted successfully");
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to delete vessel"
      );
    } finally {
      setDeleting(false);
    }
  }

  function openActionMenu(event, vessel) {
    event.stopPropagation();
    setActionAnchor(event.currentTarget);
    setActionVessel(vessel);
  }

  function closeActionMenu() {
    setActionAnchor(null);
    setActionVessel(null);
  }

  function handleEditFromMenu() {
    if (actionVessel) {
      openEdit(actionVessel);
    }

    closeActionMenu();
  }

  function handleDeleteFromMenu() {
    if (actionVessel) {
      setDeleteTarget(actionVessel);
    }

    closeActionMenu();
  }

  function editSelectedVessel() {
    if (!selectedVessel) {
      return;
    }

    const vessel = selectedVessel;
    setSelectedVessel(null);
    openEdit(vessel);
  }

  function deleteSelectedVessel() {
    if (!selectedVessel) {
      return;
    }

    setDeleteTarget(selectedVessel);
    setSelectedVessel(null);
  }

  const vesselDetailSections = selectedVessel
    ? [
        {
          title: "Vessel",
          fields: [
            {
              label: "Vessel ID",
              value: selectedVessel.vessel_id,
              emphasize: true,
            },
            {
              label: "Boat name",
              value: selectedVessel.boat_name,
              emphasize: true,
            },
            {
              label: "Customer",
              value: selectedVessel.customer_name,
            },
            {
              label: "Customer ID",
              value: selectedVessel.customer_id,
            },
          ],
        },
        {
          title: "Construction",
          fields: [
            {
              label: "Builder",
              value: selectedVessel.builder,
            },
            {
              label: "Year built",
              value: selectedVessel.year_built,
              type: "number",
            },
            {
              label: "Hull material",
              value: selectedVessel.hull_material,
            },
            {
              label: "Hull type",
              value: selectedVessel.hull_type,
            },
          ],
        },
        {
          title: "Dimensions and capacity",
          fields: [
            {
              label: "Length",
              value: selectedVessel.length_m,
              type: "number",
              suffix: "m",
            },
            {
              label: "Beam",
              value: selectedVessel.beam_m,
              type: "number",
              suffix: "m",
            },
            {
              label: "Passenger capacity",
              value: selectedVessel.passenger_capacity,
              type: "number",
            },
            {
              label: "Fuel tank",
              value: selectedVessel.fuel_tank_l,
              type: "number",
              suffix: "L",
            },
          ],
        },
        {
          title: "Operations",
          fields: [
            {
              label: "Home port",
              value: selectedVessel.home_port,
            },
            {
              label: "Typical route",
              value: selectedVessel.typical_route,
              fullWidth: true,
              multiline: true,
            },
          ],
        },
        {
          title: "System",
          fields: [
            {
              label: "Created",
              value: selectedVessel.created_at,
              type: "dateTime",
            },
            {
              label: "Last updated",
              value: selectedVessel.updated_at,
              type: "dateTime",
            },
          ],
        },
      ]
    : [];

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
            Installed Vessels
          </Typography>

          <Typography color="text.secondary">
            Record customer assets as installed-base intelligence for sales and service follow-up.
          </Typography>
        </Box>

        {canWrite && (
          <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={openCreate}
                  >
                    Add vessel
                  </Button>
        )}
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
            fullWidth
            size="small"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search vessel, customer, builder, port..."
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
                onClick={loadData}
                disabled={loading}
                color="primary"
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "block",
            mt: 1.25,
          }}
        >
          Showing {filteredVessels.length} of{" "}
          {vessels.length} vessels
        </Typography>
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
            <Table size="small" sx={responsiveTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      width: 76,
                    }}
                  >
                    Photo
                  </TableCell>

                  {sortableColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.numeric ? "right" : "left"}
                      sx={{
                        display:
                          column.id === "customer_name"
                            ? {
                                xs: "none",
                                sm: "table-cell",
                              }
                            : column.id === "year_built"
                              ? {
                                  xs: "none",
                                  md: "table-cell",
                                }
                              : "table-cell",
                      }}
                    >
                      <TableSortLabel
                        active={orderBy === column.id}
                        direction={
                          orderBy === column.id
                            ? order
                            : "asc"
                        }
                        onClick={() =>
                          handleSort(column.id)
                        }
                      >
                        {column.label}
                      </TableSortLabel>
                    </TableCell>
                  ))}

                  <TableCell align="right" sx={stickyActionHeaderSx}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {visibleVessels.map((vessel) => (
                  <TableRow
                    key={vessel.vessel_id}
                    hover
                    tabIndex={0}
                    onClick={() =>
                      setSelectedVessel(vessel)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        setSelectedVessel(vessel)
                      }
                    }}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      {vesselPhotoUrl(
                        vessel.photo_path,
                        vessel.photo_url
                      ) ? (
                        <Box
                          component="img"
                          src={vesselPhotoUrl(
                            vessel.photo_path,
                            vessel.photo_url
                          )}
                          alt={
                            vessel.boat_name ||
                            vessel.vessel_id
                          }
                          sx={{
                            display: "block",
                            width: 56,
                            height: 42,
                            objectFit: "cover",
                            borderRadius: 1.5,
                            bgcolor: "grey.100",
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            display: "grid",
                            placeItems: "center",
                            width: 56,
                            height: 42,
                            borderRadius: 1.5,
                            bgcolor: "grey.100",
                            color: "text.disabled",
                          }}
                        >
                          <PhotoCameraIcon
                            fontSize="small"
                          />
                        </Box>
                      )}
                    </TableCell>

                    <TableCell sx={primaryCellSx}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, ...truncateTextSx }}
                      >
                        {vessel.boat_name ||
                          "Unnamed vessel"}
                      </Typography>

                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={truncateTextSx}
                      >
                        {[vessel.vessel_id, vessel.hull_type]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </Typography>
                    </TableCell>

                    <TableCell
                      sx={{
                        display: {
                          xs: "none",
                          sm: "table-cell",
                        },
                      }}
                    >
                      <Typography variant="body2" sx={truncateTextSx}>
                        {vessel.customer_name || "—"}
                      </Typography>
                    </TableCell>

                    <TableCell
                      sx={{
                        display: {
                          xs: "none",
                          md: "table-cell",
                        },
                      }}
                    >
                      {vessel.year_built ?? "—"}
                    </TableCell>

                    <TableCell align="right">
                      {vessel.length_m ?? "—"}
                    </TableCell>

                    <TableCell align="right" sx={stickyActionCellSx}>
                      {(canWrite || canDelete) && (
                        <Tooltip title="Vessel actions">
                                                <IconButton
                                                  size="small"
                                                  onClick={(event) =>
                                                    openActionMenu(event, vessel)
                                                  }
                                                >
                                                  <MoreVertIcon />
                                                </IconButton>
                                              </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {!visibleVessels.length && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      align="center"
                      sx={{ py: 5 }}
                    >
                      No vessels found.
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
            count={sortedVessels.length}
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
        {canWrite && (
          <MenuItem onClick={handleEditFromMenu}>
            <EditIcon
              fontSize="small"
              sx={{ mr: 1.25 }}
            />
            Edit
          </MenuItem>
        )}

        {canDelete && (
          <MenuItem
            onClick={handleDeleteFromMenu}
            sx={{ color: "error.main" }}
          >
            <DeleteIcon
              fontSize="small"
              sx={{ mr: 1.25 }}
            />
            Delete
          </MenuItem>
        )}
      </Menu>

      <RecordDetailsDialog
        open={Boolean(selectedVessel)}
        onClose={() => setSelectedVessel(null)}
        title={
          selectedVessel?.boat_name ||
          "Vessel details"
        }
        subtitle={selectedVessel?.vessel_id}
        imageSrc={vesselPhotoUrl(
          selectedVessel?.photo_path,
          selectedVessel?.photo_url
        )}
        imageAlt={
          selectedVessel?.boat_name ||
          selectedVessel?.vessel_id
        }
        sections={vesselDetailSections}
        canEdit={canWrite}
        canDelete={canDelete}
        onEdit={editSelectedVessel}
        onDelete={deleteSelectedVessel}
      />

      <Dialog
        open={formOpen}
        onClose={closeForm}
        fullWidth
        maxWidth="md"
      >
        <Box
          component="form"
          onSubmit={submit}
        >
          <DialogTitle>
            {editingId ? "Edit vessel" : "Add vessel"}
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
              <Box
                sx={{
                  gridColumn: {
                    sm: "1 / -1",
                  },
                  display: "flex",
                  flexDirection: {
                    xs: "column",
                    sm: "row",
                  },
                  alignItems: {
                    xs: "stretch",
                    sm: "center",
                  },
                  gap: 2,
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                {photoPreview ? (
                  <Box
                    component="img"
                    src={photoPreview}
                    alt="Vessel preview"
                    sx={{
                      width: {
                        xs: "100%",
                        sm: 180,
                      },
                      height: 120,
                      objectFit: "cover",
                      borderRadius: 1.5,
                      bgcolor: "grey.100",
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      display: "grid",
                      placeItems: "center",
                      width: {
                        xs: "100%",
                        sm: 180,
                      },
                      height: 120,
                      borderRadius: 1.5,
                      bgcolor: "grey.100",
                      color: "text.disabled",
                    }}
                  >
                    <PhotoCameraIcon
                      sx={{ fontSize: 42 }}
                    />
                  </Box>
                )}

                <Stack sx={{ gap: 1 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700 }}
                  >
                    Vessel photo
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    JPG, PNG, or WebP. Photos are
                    compressed to a maximum of 1 MB
                    before upload.
                  </Typography>

                  {photoCompressionInfo && (
                    <Typography
                      variant="caption"
                      color="success.main"
                      sx={{ fontWeight: 700 }}
                    >
                      {photoCompressionInfo}
                    </Typography>
                  )}

                  <Stack
                    sx={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    <Button
                      component="label"
                      variant="outlined"
                      disabled={compressingPhoto}
                      startIcon={
                        compressingPhoto ? (
                          <CircularProgress
                            size={16}
                          />
                        ) : (
                          <PhotoCameraIcon />
                        )
                      }
                    >
                      {compressingPhoto
                        ? "Compressing..."
                        : photoPreview
                          ? "Replace photo"
                          : "Choose photo"}

                      <input
                        hidden
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={compressingPhoto}
                        onChange={
                          handlePhotoChange
                        }
                      />
                    </Button>

                    {photoPreview && (
                      <Button
                        color="error"
                        startIcon={
                          <DeleteIcon />
                        }
                        disabled={compressingPhoto}
                        onClick={clearPhoto}
                      >
                        Remove
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Box>

              <TextField
                select
                label="Customer"
                name="CustomerID"
                value={form.CustomerID}
                onChange={change}
                required
              >
                {customers.map((customer) => (
                  <MenuItem
                    key={customer.customer_id}
                    value={customer.customer_id}
                  >
                    {customer.company ||
                      customer.customer_id}{" "}
                    — {customer.customer_id}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Boat name"
                name="BoatName"
                value={form.BoatName}
                onChange={change}
              />

              <TextField
                select
                label="Builder"
                name="Builder"
                value={form.Builder}
                onChange={change}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>

                {boatBuilders.map((builder) => (
                  <MenuItem
                    key={builder}
                    value={builder}
                  >
                    {builder}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Year built"
                name="YearBuilt"
                type="number"
                value={form.YearBuilt}
                onChange={change}
              />

              <TextField
                label="Length (m)"
                name="LengthM"
                type="number"
                value={form.LengthM}
                onChange={change}
                slotProps={{
                  htmlInput: {
                    min: 0,
                    step: "any",
                  },
                }}
              />

              <TextField
                label="Beam (m)"
                name="BeamM"
                type="number"
                value={form.BeamM}
                onChange={change}
                slotProps={{
                  htmlInput: {
                    min: 0,
                    step: "any",
                  },
                }}
              />

              <TextField
                select
                label="Hull material"
                name="HullMaterial"
                value={form.HullMaterial}
                onChange={change}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>

                {hullMaterials.map((material) => (
                  <MenuItem
                    key={material}
                    value={material}
                  >
                    {material}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Hull type"
                name="HullType"
                value={form.HullType}
                onChange={change}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>

                {hullTypes.map((type) => (
                  <MenuItem
                    key={type}
                    value={type}
                  >
                    {type}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Passenger capacity"
                name="PassengerCapacity"
                type="number"
                value={form.PassengerCapacity}
                onChange={change}
              />

              <TextField
                label="Fuel tank (L)"
                name="FuelTankL"
                type="number"
                value={form.FuelTankL}
                onChange={change}
              />

              <TextField
                label="Home port"
                name="HomePort"
                value={form.HomePort}
                onChange={change}
              />

              <TextField
                label="Typical route"
                name="TypicalRoute"
                value={form.TypicalRoute}
                onChange={change}
                multiline
                minRows={3}
                sx={{
                  gridColumn: {
                    sm: "1 / -1",
                  },
                }}
              />
            </Box>
          </DialogContent>

          <DialogActions>
            <Button
              onClick={closeForm}
              disabled={saving || compressingPhoto}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="contained"
              disabled={saving || compressingPhoto}
            >
              {compressingPhoto
                ? "Compressing photo..."
                : saving
                  ? "Saving..."
                  : editingId
                    ? "Update vessel"
                    : "Create vessel"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete vessel"
        message={
          deleteTarget
            ? `Delete ${
                deleteTarget.boat_name ||
                deleteTarget.vessel_id
              } (${deleteTarget.vessel_id})? This action cannot be undone.`
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
