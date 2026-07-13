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
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";

import api from "../services/api";
import ConfirmDialog from "../components/ConfirmDialog";

const emptyForm = {
  TripID: "",
  VesselID: "",
  Date: "",
  Captain: "",
  OperatingHours: "",
  DistanceNM: "",
  AverageSpeedKn: "",
  FuelUsedL: "",
  FuelPricePerL: "",
  ElectricityKWh: "",
  Weather: "",
  SeaState: "",
  Payload: "",
};

const seaStates = [
  "Calm",
  "Slight",
  "Moderate",
  "Rough",
  "Very Rough",
];

function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function mapRowToForm(row) {
  return {
    TripID: row.trip_id || "",
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

export default function Trips() {
  const [trips, setTrips] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  useEffect(() => {
    loadData();
  }, []);

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

  const filteredTrips = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return trips;

    return trips.filter((trip) =>
      [
        trip.trip_id,
        trip.vessel_id,
        trip.boat_name,
        trip.company,
        trip.captain,
        trip.weather,
        trip.sea_state,
        trip.payload,
        formatDate(trip.trip_date),
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query)
      )
    );
  }, [trips, search]);

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

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function validateForm() {
    if (!form.TripID.trim()) return "Trip ID is required";
    if (!form.VesselID.trim()) return "Vessel is required";
    if (!form.Date) return "Trip date is required";

    if (
      form.OperatingHours !== "" &&
      Number(form.OperatingHours) <= 0
    ) {
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
        await api.put(
          `/trips/${encodeURIComponent(editingId)}`,
          payload
        );

        setSuccess("Trip updated successfully");
      } else {
        await api.post("/trips", payload);
        setSuccess("Trip created successfully");
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

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
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
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems="center"
        >
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search trip, vessel, captain, customer, weather..."
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
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
      </Paper>

      <TableContainer component={Paper}>
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
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Trip ID</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Vessel</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Captain</TableCell>
                <TableCell align="right">Hours</TableCell>
                <TableCell align="right">Distance (NM)</TableCell>
                <TableCell align="right">Fuel (L)</TableCell>
                <TableCell>Sea state</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filteredTrips.map((trip) => (
                <TableRow key={trip.trip_id} hover>
                  <TableCell>{trip.trip_id}</TableCell>
                  <TableCell>{formatDate(trip.trip_date) || "—"}</TableCell>

                  <TableCell>
                    <Typography fontWeight={600}>
                      {trip.boat_name ||
                        vesselNameById.get(trip.vessel_id) ||
                        trip.vessel_id ||
                        "—"}
                    </Typography>
                  </TableCell>

                  <TableCell>{trip.company || "—"}</TableCell>
                  <TableCell>{trip.captain || "—"}</TableCell>
                  <TableCell align="right">
                    {trip.operating_hours ?? "—"}
                  </TableCell>
                  <TableCell align="right">
                    {trip.distance_nm ?? "—"}
                  </TableCell>
                  <TableCell align="right">
                    {trip.fuel_used_l ?? "—"}
                  </TableCell>
                  <TableCell>{trip.sea_state || "—"}</TableCell>

                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton
                        color="primary"
                        onClick={() => openEditDialog(trip)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Delete">
                      <IconButton
                        color="error"
                        onClick={() => setDeleteTarget(trip)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}

              {!filteredTrips.length && (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    No trips found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      <Dialog
        open={formOpen}
        onClose={closeFormDialog}
        fullWidth
        maxWidth="md"
      >
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>
            {editingId ? "Edit trip" : "Add trip"}
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
                label="Trip ID"
                name="TripID"
                value={form.TripID}
                onChange={handleChange}
                required
                disabled={Boolean(editingId)}
              />

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
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                label="Captain"
                name="Captain"
                value={form.Captain}
                onChange={handleChange}
              />

              <TextField
                label="Operating hours"
                name="OperatingHours"
                type="number"
                value={form.OperatingHours}
                onChange={handleChange}
                required
                inputProps={{ min: 0, step: "any" }}
              />

              <TextField
                label="Distance (NM)"
                name="DistanceNM"
                type="number"
                value={form.DistanceNM}
                onChange={handleChange}
                inputProps={{ min: 0, step: "any" }}
              />

              <TextField
                label="Average speed (kn)"
                name="AverageSpeedKn"
                type="number"
                value={form.AverageSpeedKn}
                onChange={handleChange}
                inputProps={{ min: 0, step: "any" }}
              />

              <TextField
                label="Fuel used (L)"
                name="FuelUsedL"
                type="number"
                value={form.FuelUsedL}
                onChange={handleChange}
                inputProps={{ min: 0, step: "any" }}
              />

              <TextField
                label="Fuel price per L"
                name="FuelPricePerL"
                type="number"
                value={form.FuelPricePerL}
                onChange={handleChange}
                inputProps={{ min: 0, step: "any" }}
              />

              <TextField
                label="Electricity (kWh)"
                name="ElectricityKWh"
                type="number"
                value={form.ElectricityKWh}
                onChange={handleChange}
                inputProps={{ min: 0, step: "any" }}
              />

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
                <MenuItem value="">
                  <em>Select sea state</em>
                </MenuItem>

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
                  ? "Update trip"
                  : "Create trip"}
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
