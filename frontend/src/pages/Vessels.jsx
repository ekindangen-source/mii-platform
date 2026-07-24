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

const hullMaterials = [
  "Fiberglass",
  "Aluminum",
  "Wood",
  "Steel",
  "HDPE",
  "Other",
];

const hullTypes = [
  "Monohull",
  "Catamaran",
  "Trimaran",
  "RIB",
  "Other",
];

const sortableColumns = [
  { id: "vessel_id", label: "Vessel ID" },
  { id: "boat_name", label: "Boat name" },
  { id: "customer_name", label: "Customer" },
  { id: "year_built", label: "Year", numeric: true },
  { id: "length_m", label: "Length (m)", numeric: true },
];

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

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [actionAnchor, setActionAnchor] = useState(null);
  const [actionVessel, setActionVessel] = useState(null);

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
    setFormOpen(true);
  }

  function openEdit(vessel) {
    setEditingId(vessel.vessel_id);
    setForm(mapRow(vessel));
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
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

      if (editingId) {
        await api.put(
          `/vessels/${encodeURIComponent(editingId)}`,
          payload
        );
        setSuccess("Vessel updated successfully");
      } else {
        const response = await api.post("/vessels", payload);
        const generatedId =
          response.data?.vessel?.vessel_id;

        setSuccess(
          generatedId
            ? `Vessel ${generatedId} created successfully`
            : "Vessel created successfully"
        );
      }

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
            Vessels
          </Typography>

          <Typography color="text.secondary">
            Manage vessels and customer fleet assignments.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
        >
          Add vessel
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
            <Table size="small">
              <TableHead>
                <TableRow>
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

                  <TableCell
                    sx={{
                      display: {
                        xs: "none",
                        lg: "table-cell",
                      },
                    }}
                  >
                    Builder
                  </TableCell>

                  <TableCell
                    sx={{
                      display: {
                        xs: "none",
                        lg: "table-cell",
                      },
                    }}
                  >
                    Hull
                  </TableCell>

                  <TableCell
                    sx={{
                      display: {
                        xs: "none",
                        md: "table-cell",
                      },
                    }}
                  >
                    Home port
                  </TableCell>

                  <TableCell align="right">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {visibleVessels.map((vessel) => (
                  <TableRow
                    key={vessel.vessel_id}
                    hover
                  >
                    <TableCell>
                      {vessel.vessel_id}
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600 }}
                      >
                        {vessel.boat_name ||
                          "Unnamed vessel"}
                      </Typography>

                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        {vessel.hull_type || "—"}
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
                      {vessel.customer_name || "—"}
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

                    <TableCell
                      sx={{
                        display: {
                          xs: "none",
                          lg: "table-cell",
                        },
                      }}
                    >
                      {vessel.builder || "—"}
                    </TableCell>

                    <TableCell
                      sx={{
                        display: {
                          xs: "none",
                          lg: "table-cell",
                        },
                      }}
                    >
                      {[vessel.hull_material, vessel.hull_type]
                        .filter(Boolean)
                        .join(" / ") || "—"}
                    </TableCell>

                    <TableCell
                      sx={{
                        display: {
                          xs: "none",
                          md: "table-cell",
                        },
                      }}
                    >
                      {vessel.home_port || "—"}
                    </TableCell>

                    <TableCell align="right">
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
                    </TableCell>
                  </TableRow>
                ))}

                {!visibleVessels.length && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
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
                label="Builder"
                name="Builder"
                value={form.Builder}
                onChange={change}
              />

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
