import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, InputAdornment, Menu,
  MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow,
  TableSortLabel, TextField, Tooltip, Typography
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
  VesselID: "", Date: "", Captain: "",
  OperatingHours: "", DistanceNM: "", AverageSpeedKn: "",
  FuelUsedL: "", FuelPricePerL: "", ElectricityKWh: "",
  Weather: "", SeaState: "", Payload: ""
};

const seaStates = ["Calm", "Slight", "Moderate", "Rough", "Very Rough"];

const sortableColumns = [
  { id: "trip_id", label: "Trip ID" },
  { id: "trip_date", label: "Date" },
  { id: "vessel_name", label: "Vessel" },
  { id: "operating_hours", label: "Hours", numeric: true },
  { id: "distance_nm", label: "Distance (NM)", numeric: true },
];

function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function mapRowToForm(row) {
  return {
    VesselID: row.vessel_id || "",
    Date: formatDate(row.trip_date),
    Captain: row.captain || "",
    OperatingHours: row.operating_hours ?? "",
    DistanceNM: row.distance_nm ?? "",
    AverageSpeedKn: row.average_speed_kn ?? "",
    FuelUsedL: row.fuel_used_l ?? "",
    FuelPricePerL: row.fuel_price_per_l ?? "",
    ElectricityKWh: row.electricity_kwh ?? "",
    Weather: row.weather || "",
    SeaState: row.sea_state || "",
    Payload: row.payload || "",
  };
}

function numberOrNull(value) {
  return value === "" ? null : Number(value);
}

function compareValues(left, right, numeric = false) {
  if (numeric) return Number(left ?? 0) - Number(right ?? 0);
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export default function Trips() {
  const [trips, setTrips] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [search, setSearch] = useState("");
  const [orderBy, setOrderBy] = useState("trip_date");
  const [order, setOrder] = useState("desc");
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
  const [actionTrip, setActionTrip] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [tripsResponse, vesselsResponse] = await Promise.all([
        api.get("/trips"),
        api.get("/vessels"),
      ]);
      if (!Array.isArray(tripsResponse.data)) {
        throw new Error("Unexpected trips response");
      }
      if (!Array.isArray(vesselsResponse.data)) {
        throw new Error("Unexpected vessels response");
      }
      setTrips(tripsResponse.data);
      setVessels(vesselsResponse.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to load trip data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => { setPage(0); }, [search, rowsPerPage]);

  const vesselNameById = useMemo(() => {
    const map = new Map();
    vessels.forEach((vessel) => {
      map.set(vessel.vessel_id, vessel.boat_name || vessel.vessel_id);
    });
    return map;
  }, [vessels]);

  const enrichedTrips = useMemo(
    () => trips.map((trip) => ({
      ...trip,
      vessel_name:
        trip.boat_name ||
        vesselNameById.get(trip.vessel_id) ||
        trip.vessel_id ||
        "",
    })),
    [trips, vesselNameById]
  );

  const filteredTrips = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return enrichedTrips;

    return enrichedTrips.filter((trip) =>
      [
        trip.trip_id, trip.vessel_id, trip.vessel_name,
        trip.company, trip.captain, trip.weather,
        trip.sea_state, trip.payload, formatDate(trip.trip_date)
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      )
    );
  }, [enrichedTrips, search]);

  const sortedTrips = useMemo(() => {
    const selected = sortableColumns.find((column) => column.id === orderBy);
    return [...filteredTrips].sort((left, right) => {
      const comparison = compareValues(
        left[orderBy],
        right[orderBy],
        selected?.numeric
      );
      return order === "asc" ? comparison : -comparison;
    });
  }, [filteredTrips, order, orderBy]);

  const visibleTrips = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedTrips.slice(start, start + rowsPerPage);
  }, [page, rowsPerPage, sortedTrips]);

  function handleSort(columnId) {
    const isAscending = orderBy === columnId && order === "asc";
    setOrder(isAscending ? "desc" : "asc");
    setOrderBy(columnId);
  }

  function openCreateDialog() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setFormOpen(true);
  }

  function openEditDialog(trip) {
    setEditingId(trip.trip_id);
    setForm(mapRowToForm(trip));
    setError("");
    setFormOpen(true);
  }

  function closeFormDialog() {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validateForm() {
    if (!form.VesselID.trim()) return "Vessel is required";
    if (!form.Date) return "Trip date is required";
    if (form.OperatingHours !== "" && Number(form.OperatingHours) <= 0) {
      return "Operating hours must be greater than zero";
    }

    const nonNegativeFields = [
      ["DistanceNM", "Distance"],
      ["AverageSpeedKn", "Average speed"],
      ["FuelUsedL", "Fuel used"],
      ["FuelPricePerL", "Fuel price"],
      ["ElectricityKWh", "Electricity"],
    ];

    for (const [field, label] of nonNegativeFields) {
      if (form[field] !== "" && Number(form[field]) < 0) {
        return `${label} cannot be negative`;
      }
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
      OperatingHours: numberOrNull(form.OperatingHours),
      DistanceNM: numberOrNull(form.DistanceNM),
      AverageSpeedKn: numberOrNull(form.AverageSpeedKn),
      FuelUsedL: numberOrNull(form.FuelUsedL),
      FuelPricePerL: numberOrNull(form.FuelPricePerL),
      ElectricityKWh: numberOrNull(form.ElectricityKWh),
    };

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (editingId) {
        await api.put(`/trips/${encodeURIComponent(editingId)}`, payload);
        setSuccess("Trip updated successfully");
      } else {
        const response = await api.post("/trips", payload);
        const generatedId =
          response.data?.trip?.trip_id;

        setSuccess(
          generatedId
            ? `Trip ${generatedId} created successfully`
            : "Trip created successfully"
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
        "Unable to save trip"
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setError("");
      setSuccess("");
      await api.delete(
        `/trips/${encodeURIComponent(deleteTarget.trip_id)}`
      );
      setSuccess("Trip deleted successfully");
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to delete trip"
      );
    } finally {
      setDeleting(false);
    }
  }

  function openActionMenu(event, trip) {
    setActionAnchor(event.currentTarget);
    setActionTrip(trip);
  }

  function closeActionMenu() {
    setActionAnchor(null);
    setActionTrip(null);
  }

  function handleEditFromMenu() {
    if (actionTrip) openEditDialog(actionTrip);
    closeActionMenu();
  }

  function handleDeleteFromMenu() {
    if (actionTrip) setDeleteTarget(actionTrip);
    closeActionMenu();
  }

  return (
    <Box>
      <Stack sx={{
        flexDirection: { xs: "column", sm: "row" },
        justifyContent: "space-between",
        alignItems: { xs: "stretch", sm: "center" },
        gap: 2,
        mb: 3,
      }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Trips
          </Typography>
          <Typography color="text.secondary">
            Record vessel activity, operating hours, distance, and energy use.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
        >
          Add trip
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess("")} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack sx={{
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          gap: 2,
        }}>
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search trip, vessel, captain, customer, weather..."
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
              <IconButton onClick={loadData} disabled={loading} color="primary">
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1.25 }}
        >
          Showing {filteredTrips.length} of {trips.length} trips
        </Typography>
      </Paper>

      <Paper>
        <TableContainer>
          {loading ? (
            <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}>
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
                            ? { xs: "none", sm: "table-cell" }
                            : column.id === "distance_nm"
                              ? { xs: "none", md: "table-cell" }
                              : "table-cell",
                      }}
                    >
                      <TableSortLabel
                        active={orderBy === column.id}
                        direction={orderBy === column.id ? order : "asc"}
                        onClick={() => handleSort(column.id)}
                      >
                        {column.label}
                      </TableSortLabel>
                    </TableCell>
                  ))}

                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    Captain
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ display: { xs: "none", lg: "table-cell" } }}
                  >
                    Fuel (L)
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                    Sea state
                  </TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {visibleTrips.map((trip) => (
                  <TableRow key={trip.trip_id} hover>
                    <TableCell>{trip.trip_id}</TableCell>
                    <TableCell>{formatDate(trip.trip_date) || "—"}</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {trip.vessel_name || "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {trip.company || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {trip.operating_hours ?? "—"}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ display: { xs: "none", md: "table-cell" } }}
                    >
                      {trip.distance_nm ?? "—"}
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      {trip.captain || "—"}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ display: { xs: "none", lg: "table-cell" } }}
                    >
                      {trip.fuel_used_l ?? "—"}
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                      {trip.sea_state || "—"}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Trip actions">
                        <IconButton
                          size="small"
                          onClick={(event) => openActionMenu(event, trip)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}

                {!visibleTrips.length && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                      No trips found.
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
            count={sortedTrips.length}
            page={page}
            onPageChange={(_event, nextPage) => setPage(nextPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value));
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
          <EditIcon fontSize="small" sx={{ mr: 1.25 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteFromMenu} sx={{ color: "error.main" }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1.25 }} />
          Delete
        </MenuItem>
      </Menu>

      <Dialog open={formOpen} onClose={closeFormDialog} fullWidth maxWidth="md">
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{editingId ? "Edit trip" : "Add trip"}</DialogTitle>
          <DialogContent dividers>
            <Box sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
              pt: 1,
            }}>

              <TextField
                select
                label="Vessel"
                name="VesselID"
                value={form.VesselID}
                onChange={handleChange}
                required
              >
                {vessels.map((vessel) => (
                  <MenuItem key={vessel.vessel_id} value={vessel.vessel_id}>
                    {vessel.boat_name || vessel.vessel_id}
                    {" — "}
                    {vessel.vessel_id}
                    {vessel.company ? ` — ${vessel.company}` : ""}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Trip date"
                name="Date"
                type="date"
                value={form.Date}
                onChange={handleChange}
                required
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <TextField
                label="Captain"
                name="Captain"
                value={form.Captain}
                onChange={handleChange}
              />

              {[
                ["OperatingHours", "Operating hours"],
                ["DistanceNM", "Distance (NM)"],
                ["AverageSpeedKn", "Average speed (kn)"],
                ["FuelUsedL", "Fuel used (L)"],
                ["FuelPricePerL", "Fuel price per L"],
                ["ElectricityKWh", "Electricity (kWh)"],
              ].map(([name, label]) => (
                <TextField
                  key={name}
                  label={label}
                  name={name}
                  type="number"
                  value={form[name]}
                  onChange={handleChange}
                  required={name === "OperatingHours"}
                  slotProps={{ htmlInput: { min: 0, step: "any" } }}
                />
              ))}

              <TextField
                label="Weather"
                name="Weather"
                value={form.Weather}
                onChange={handleChange}
              />

              <TextField
                select
                label="Sea state"
                name="SeaState"
                value={form.SeaState}
                onChange={handleChange}
              >
                <MenuItem value=""><em>Select sea state</em></MenuItem>
                {seaStates.map((seaState) => (
                  <MenuItem key={seaState} value={seaState}>
                    {seaState}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Payload"
                name="Payload"
                value={form.Payload}
                onChange={handleChange}
                multiline
                minRows={3}
                sx={{ gridColumn: { sm: "1 / -1" } }}
              />
            </Box>
          </DialogContent>

          <DialogActions>
            <Button onClick={closeFormDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update trip" : "Create trip"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete trip"
        message={
          deleteTarget
            ? `Delete trip ${deleteTarget.trip_id}? This action cannot be undone.`
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
