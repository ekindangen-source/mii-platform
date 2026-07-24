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
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";

import api from "../services/api";
import ConfirmDialog from "../components/ConfirmDialog";

const emptyForm = {
  VesselID: "",
  Brand: "",
  Model: "",
  HP: "",
  SerialNumber: "",
  InstallDate: "",
  EngineHours: "",
  GearRatio: "",
  Propeller: "",
  WarrantyExpiry: "",
  FuelType: "",
};

const engineBrands = [
  "Yamaha",
  "Suzuki",
  "Mercury",
  "Honda",
  "Torqeedo",
  "Volvo Penta",
  "Cummins",
  "Caterpillar",
  "Other",
];

const fuelTypes = [
  "Gasoline",
  "Diesel",
  "Electric",
  "Hybrid",
];

const sortableColumns = [
  { id: "engine_id", label: "Engine ID" },
  { id: "engine_name", label: "Engine" },
  { id: "vessel_name", label: "Vessel" },
  { id: "hp", label: "HP", numeric: true },
  { id: "engine_hours", label: "Hours", numeric: true },
];

function formatDate(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}

function mapRowToForm(row) {
  return {
    VesselID: row.vessel_id || "",
    Brand: row.brand || "",
    Model: row.model || "",
    HP: row.hp ?? "",
    SerialNumber: row.serial_number || "",
    InstallDate: formatDate(row.install_date),
    EngineHours: row.engine_hours ?? "",
    GearRatio: row.gear_ratio || "",
    Propeller: row.propeller || "",
    WarrantyExpiry: formatDate(row.warranty_expiry),
    FuelType: row.fuel_type || "",
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

export default function Engines() {
  const [engines, setEngines] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [search, setSearch] = useState("");

  const [orderBy, setOrderBy] = useState("engine_name");
  const [order, setOrder] = useState("asc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [actionAnchor, setActionAnchor] = useState(null);
  const [actionEngine, setActionEngine] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [enginesResponse, vesselsResponse] =
        await Promise.all([
          api.get("/engines"),
          api.get("/vessels"),
        ]);

      if (!Array.isArray(enginesResponse.data)) {
        throw new Error("Unexpected engines response");
      }

      if (!Array.isArray(vesselsResponse.data)) {
        throw new Error("Unexpected vessels response");
      }

      setEngines(enginesResponse.data);
      setVessels(vesselsResponse.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load engine data"
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

  const vesselNameById = useMemo(() => {
    const map = new Map();

    vessels.forEach((vessel) => {
      map.set(
        vessel.vessel_id,
        vessel.boat_name || vessel.vessel_id
      );
    });

    return map;
  }, [vessels]);

  const enrichedEngines = useMemo(
    () =>
      engines.map((engine) => ({
        ...engine,
        engine_name:
          [engine.brand, engine.model]
            .filter(Boolean)
            .join(" ") || "Unnamed engine",
        vessel_name:
          engine.boat_name ||
          vesselNameById.get(engine.vessel_id) ||
          engine.vessel_id ||
          "",
      })),
    [engines, vesselNameById]
  );

  const filteredEngines = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return enrichedEngines;
    }

    return enrichedEngines.filter((engine) =>
      [
        engine.engine_id,
        engine.vessel_id,
        engine.vessel_name,
        engine.brand,
        engine.model,
        engine.engine_name,
        engine.serial_number,
        engine.fuel_type,
        engine.company,
        engine.propeller,
        engine.gear_ratio,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query)
      )
    );
  }, [enrichedEngines, search]);

  const sortedEngines = useMemo(() => {
    const selectedColumn = sortableColumns.find(
      (column) => column.id === orderBy
    );

    return [...filteredEngines].sort((left, right) => {
      const comparison = compareValues(
        left[orderBy],
        right[orderBy],
        selectedColumn?.numeric
      );

      return order === "asc" ? comparison : -comparison;
    });
  }, [filteredEngines, order, orderBy]);

  const visibleEngines = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedEngines.slice(start, start + rowsPerPage);
  }, [page, rowsPerPage, sortedEngines]);

  function handleSort(columnId) {
    const isAscending =
      orderBy === columnId && order === "asc";

    setOrder(isAscending ? "desc" : "asc");
    setOrderBy(columnId);
  }

  function openCreateDialog() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setFormOpen(true);
  }

  function openEditDialog(engine) {
    setEditingId(engine.engine_id);
    setForm(mapRowToForm(engine));
    setError("");
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

  function validateForm() {
    if (!form.VesselID.trim()) {
      return "Vessel is required";
    }

    if (!form.Brand.trim()) {
      return "Brand is required";
    }

    if (!form.Model.trim()) {
      return "Model is required";
    }

    if (form.HP !== "" && Number(form.HP) <= 0) {
      return "HP must be greater than zero";
    }

    if (
      form.EngineHours !== "" &&
      Number(form.EngineHours) < 0
    ) {
      return "Engine hours cannot be negative";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      ...form,
      HP:
        form.HP === ""
          ? null
          : Number(form.HP),
      EngineHours:
        form.EngineHours === ""
          ? null
          : Number(form.EngineHours),
      InstallDate: form.InstallDate || null,
      WarrantyExpiry: form.WarrantyExpiry || null,
    };

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (editingId) {
        await api.put(
          `/engines/${encodeURIComponent(editingId)}`,
          payload
        );

        setSuccess("Engine updated successfully");
      } else {
        const response = await api.post("/engines", payload);
        const generatedId =
          response.data?.engine?.engine_id;

        setSuccess(
          generatedId
            ? `Engine ${generatedId} created successfully`
            : "Engine created successfully"
        );
      }

      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to save engine"
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
      setSuccess("");

      await api.delete(
        `/engines/${encodeURIComponent(
          deleteTarget.engine_id
        )}`
      );

      setSuccess("Engine deleted successfully");
      setDeleteTarget(null);

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to delete engine"
      );
    } finally {
      setDeleting(false);
    }
  }

  function openActionMenu(event, engine) {
    setActionAnchor(event.currentTarget);
    setActionEngine(engine);
  }

  function closeActionMenu() {
    setActionAnchor(null);
    setActionEngine(null);
  }

  function handleEditFromMenu() {
    if (actionEngine) {
      openEditDialog(actionEngine);
    }

    closeActionMenu();
  }

  function handleDeleteFromMenu() {
    if (actionEngine) {
      setDeleteTarget(actionEngine);
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
            Engines
          </Typography>

          <Typography color="text.secondary">
            Manage engines and their assigned vessels.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
        >
          Add engine
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
            placeholder="Search engine, vessel, brand, model, serial number..."
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
          Showing {filteredEngines.length} of{" "}
          {engines.length} engines
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
            <Table size="small">
              <TableHead>
                <TableRow>
                  {sortableColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.numeric ? "right" : "left"}
                      sx={{
                        display:
                          column.id === "vessel_name"
                            ? {
                                xs: "none",
                                sm: "table-cell",
                              }
                            : column.id === "engine_hours"
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

                  <TableCell
                    sx={{
                      display: {
                        xs: "none",
                        md: "table-cell",
                      },
                    }}
                  >
                    Customer
                  </TableCell>

                  <TableCell
                    sx={{
                      display: {
                        xs: "none",
                        lg: "table-cell",
                      },
                    }}
                  >
                    Serial number
                  </TableCell>

                  <TableCell
                    sx={{
                      display: {
                        xs: "none",
                        lg: "table-cell",
                      },
                    }}
                  >
                    Fuel type
                  </TableCell>

                  <TableCell align="right">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {visibleEngines.map((engine) => (
                  <TableRow
                    key={engine.engine_id}
                    hover
                  >
                    <TableCell>
                      {engine.engine_id}
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600 }}
                      >
                        {engine.engine_name}
                      </Typography>

                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        {engine.install_date
                          ? `Installed ${formatDate(
                              engine.install_date
                            )}`
                          : "Installation date not recorded"}
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
                      {engine.vessel_name || "—"}
                    </TableCell>

                    <TableCell align="right">
                      {engine.hp ?? "—"}
                    </TableCell>

                    <TableCell
                      align="right"
                      sx={{
                        display: {
                          xs: "none",
                          md: "table-cell",
                        },
                      }}
                    >
                      {engine.engine_hours ?? "—"}
                    </TableCell>

                    <TableCell
                      sx={{
                        display: {
                          xs: "none",
                          md: "table-cell",
                        },
                      }}
                    >
                      {engine.company || "—"}
                    </TableCell>

                    <TableCell
                      sx={{
                        display: {
                          xs: "none",
                          lg: "table-cell",
                        },
                      }}
                    >
                      {engine.serial_number || "—"}
                    </TableCell>

                    <TableCell
                      sx={{
                        display: {
                          xs: "none",
                          lg: "table-cell",
                        },
                      }}
                    >
                      {engine.fuel_type || "—"}
                    </TableCell>

                    <TableCell align="right">
                      <Tooltip title="Engine actions">
                        <IconButton
                          size="small"
                          onClick={(event) =>
                            openActionMenu(event, engine)
                          }
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}

                {!visibleEngines.length && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      align="center"
                      sx={{ py: 5 }}
                    >
                      No engines found.
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
            count={sortedEngines.length}
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
        <MenuItem onClick={handleEditFromMenu}>
          <EditIcon
            fontSize="small"
            sx={{ mr: 1.25 }}
          />
          Edit
        </MenuItem>

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
      </Menu>

      <Dialog
        open={formOpen}
        onClose={closeFormDialog}
        fullWidth
        maxWidth="md"
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
        >
          <DialogTitle>
            {editingId ? "Edit engine" : "Add engine"}
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
                label="Vessel"
                name="VesselID"
                value={form.VesselID}
                onChange={handleChange}
                required
              >
                {vessels.map((vessel) => (
                  <MenuItem
                    key={vessel.vessel_id}
                    value={vessel.vessel_id}
                  >
                    {vessel.boat_name || vessel.vessel_id}
                    {" — "}
                    {vessel.vessel_id}
                    {vessel.company
                      ? ` — ${vessel.company}`
                      : ""}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Brand"
                name="Brand"
                value={form.Brand}
                onChange={handleChange}
                required
              >
                <MenuItem value="">
                  <em>Select brand</em>
                </MenuItem>

                {engineBrands.map((brand) => (
                  <MenuItem
                    key={brand}
                    value={brand}
                  >
                    {brand}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Model"
                name="Model"
                value={form.Model}
                onChange={handleChange}
                required
              />

              <TextField
                label="Horsepower"
                name="HP"
                type="number"
                value={form.HP}
                onChange={handleChange}
                required
                slotProps={{
                  htmlInput: {
                    min: 0,
                    step: "any",
                  },
                }}
              />

              <TextField
                label="Serial number"
                name="SerialNumber"
                value={form.SerialNumber}
                onChange={handleChange}
              />

              <TextField
                label="Install date"
                name="InstallDate"
                type="date"
                value={form.InstallDate}
                onChange={handleChange}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
              />

              <TextField
                label="Engine hours"
                name="EngineHours"
                type="number"
                value={form.EngineHours}
                onChange={handleChange}
                slotProps={{
                  htmlInput: {
                    min: 0,
                    step: "any",
                  },
                }}
              />

              <TextField
                label="Gear ratio"
                name="GearRatio"
                value={form.GearRatio}
                onChange={handleChange}
              />

              <TextField
                label="Propeller"
                name="Propeller"
                value={form.Propeller}
                onChange={handleChange}
              />

              <TextField
                label="Warranty expiry"
                name="WarrantyExpiry"
                type="date"
                value={form.WarrantyExpiry}
                onChange={handleChange}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
              />

              <TextField
                select
                label="Fuel type"
                name="FuelType"
                value={form.FuelType}
                onChange={handleChange}
              >
                <MenuItem value="">
                  <em>Select fuel type</em>
                </MenuItem>

                {fuelTypes.map((fuelType) => (
                  <MenuItem
                    key={fuelType}
                    value={fuelType}
                  >
                    {fuelType}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
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
                  ? "Update engine"
                  : "Create engine"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete engine"
        message={
          deleteTarget
            ? `Delete ${deleteTarget.brand || ""} ${
                deleteTarget.model || ""
              } (${deleteTarget.engine_id})? This action cannot be undone.`
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
