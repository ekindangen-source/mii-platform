import {
  useEffect,
  useMemo,
  useState,
} from "react";
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
  Switch,
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
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const emptyForm = {
  CategoryKey: "",
  Value: "",
  SortOrder: 0,
  IsActive: true,
};

export default function Settings() {
  const { user } = useAuth();

  const [categories, setCategories] =
    useState([]);
  const [values, setValues] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("");
  const [dialogOpen, setDialogOpen] =
    useState(false);
  const [editingId, setEditingId] =
    useState(null);
  const [form, setForm] =
    useState(emptyForm);

  const isAdmin = user?.role === "admin";

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        categoriesResponse,
        valuesResponse,
      ] = await Promise.all([
        api.get(
          "/master-data/categories"
        ),
        api.get(
          "/master-data",
          {
            params: {
              includeInactive: true,
            },
          }
        ),
      ]);

      const nextCategories =
        Array.isArray(
          categoriesResponse.data
        )
          ? categoriesResponse.data
          : [];

      setCategories(nextCategories);
      setValues(
        Array.isArray(valuesResponse.data)
          ? valuesResponse.data
          : []
      );

      setSelectedCategory((current) =>
        current ||
        nextCategories[0]
          ?.category_key ||
        ""
      );
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          "Unable to load master data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const visibleValues = useMemo(
    () =>
      values.filter(
        (item) =>
          item.category_key ===
          selectedCategory
      ),
    [selectedCategory, values]
  );

  const selectedCategoryRecord =
    categories.find(
      (item) =>
        item.category_key ===
        selectedCategory
    );

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      CategoryKey: selectedCategory,
      SortOrder:
        visibleValues.length * 10 + 10,
    });
    setDialogOpen(true);
  }

  function openEdit(item) {
    setEditingId(item.value_id);
    setForm({
      CategoryKey: item.category_key,
      Value: item.value,
      SortOrder: item.sort_order,
      IsActive: item.is_active,
    });
    setDialogOpen(true);
  }

  async function save(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (editingId) {
        await api.patch(
          `/master-data/values/${editingId}`,
          {
            Value: form.Value,
            SortOrder: Number(
              form.SortOrder
            ),
            IsActive: form.IsActive,
          }
        );
        setSuccess(
          "Master-data value updated."
        );
      } else {
        await api.post(
          "/master-data/values",
          {
            CategoryKey:
              form.CategoryKey,
            Value: form.Value,
            SortOrder: Number(
              form.SortOrder
            ),
          }
        );
        setSuccess(
          "Master-data value added."
        );
      }

      setDialogOpen(false);
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          "Unable to save the value."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item) {
    try {
      setError("");
      setSuccess("");

      await api.patch(
        `/master-data/values/${item.value_id}`,
        {
          IsActive: !item.is_active,
        }
      );

      setSuccess(
        item.is_active
          ? "Value deactivated."
          : "Value activated."
      );

      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          "Unable to change the status."
      );
    }
  }

  if (!isAdmin) {
    return (
      <Alert severity="error">
        Administrator access is required.
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Paper sx={{ p: 2.5 }}>
        <Stack
          direction={{
            xs: "column",
            md: "row",
          }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{
            xs: "stretch",
            md: "center",
          }}
        >
          <Box>
            <Typography
              variant="h5"
              sx={{ fontWeight: 700 }}
            >
              Master Data
            </Typography>

            <Typography color="text.secondary">
              Maintain configurable dropdown
              values without changing code.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh">
              <span>
                <IconButton
                  onClick={loadData}
                  disabled={loading}
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreate}
              disabled={
                !selectedCategory ||
                loading
              }
            >
              Add value
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error">
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success">
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 2 }}>
        <TextField
          select
          fullWidth
          label="Dropdown list"
          value={selectedCategory}
          onChange={(event) =>
            setSelectedCategory(
              event.target.value
            )
          }
        >
          {categories.map((category) => (
            <MenuItem
              key={category.category_key}
              value={category.category_key}
            >
              {category.module_name}
              {" — "}
              {category.category_label}
            </MenuItem>
          ))}
        </TextField>

        {selectedCategoryRecord && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1 }}
          >
            {selectedCategoryRecord.description}
          </Typography>
        )}
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
                  <TableCell>Value</TableCell>
                  <TableCell>Order</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {visibleValues.map(
                  (item) => (
                    <TableRow
                      key={item.value_id}
                      hover
                    >
                      <TableCell>
                        {item.value}
                      </TableCell>

                      <TableCell>
                        {item.sort_order}
                      </TableCell>

                      <TableCell>
                        <Chip
                          size="small"
                          color={
                            item.is_active
                              ? "success"
                              : "default"
                          }
                          label={
                            item.is_active
                              ? "Active"
                              : "Inactive"
                          }
                        />
                      </TableCell>

                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() =>
                              openEdit(item)
                            }
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>

                        <Switch
                          checked={
                            item.is_active
                          }
                          onChange={() =>
                            toggle(item)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )
                )}

                {!visibleValues.length && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      align="center"
                      sx={{ py: 5 }}
                    >
                      No values found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={() =>
          !saving &&
          setDialogOpen(false)
        }
        fullWidth
        maxWidth="sm"
      >
        <Box
          component="form"
          onSubmit={save}
        >
          <DialogTitle>
            {editingId
              ? "Edit master-data value"
              : "Add master-data value"}
          </DialogTitle>

          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Value"
                value={form.Value}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    Value:
                      event.target.value,
                  }))
                }
                required
                autoFocus
              />

              <TextField
                label="Sort order"
                type="number"
                value={form.SortOrder}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    SortOrder:
                      event.target.value,
                  }))
                }
              />
            </Stack>
          </DialogContent>

          <DialogActions>
            <Button
              onClick={() =>
                setDialogOpen(false)
              }
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
                : "Save"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
