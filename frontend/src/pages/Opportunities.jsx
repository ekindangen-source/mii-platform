import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import OpportunityDialog from "../components/OpportunityDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import { OPPORTUNITY_STAGES, STAGE_BY_VALUE, formatIdr, formatOpportunityDate } from "../utils/opportunities";
import { stickyActionCellSx, stickyActionHeaderSx, truncateTextSx } from "../utils/responsiveTable";

export default function Opportunities() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const presetCustomerId = searchParams.get("customerId") || "";
  const [opportunities, setOpportunities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [stage, setStage] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const canWrite = ["admin", "manager", "sales"].includes(user?.role);
  const canDelete = ["admin", "manager"].includes(user?.role);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (presetCustomerId) params.customerId = presetCustomerId;
      const [opportunityResponse, customerResponse, ownerResponse] = await Promise.all([
        api.get("/opportunities", { params }),
        api.get("/customers"),
        api.get("/opportunities/owners"),
      ]);
      setOpportunities(Array.isArray(opportunityResponse.data) ? opportunityResponse.data : []);
      setCustomers(Array.isArray(customerResponse.data) ? customerResponse.data : []);
      setOwners(Array.isArray(ownerResponse.data) ? ownerResponse.data : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to load opportunities");
    } finally {
      setLoading(false);
    }
  }, [presetCustomerId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return opportunities.filter((item) => {
      if (stage !== "all" && item.stage !== stage) return false;
      if (!term) return true;
      return [item.title, item.customer_name, item.product_interest, item.owner_name]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [opportunities, search, stage]);

  async function remove() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.delete(`/opportunities/${encodeURIComponent(deleteTarget.opportunity_id)}`);
      setDeleteTarget(null);
      setSuccess("Opportunity deleted");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to delete opportunity");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Opportunities</Typography>
          <Typography color="text.secondary">Track requirements, commercial value, next actions, and closing progress.</Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
          {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setDialogOpen(true); }}>Add opportunity</Button>}
        </Stack>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")} sx={{ mb: 2 }}>{success}</Alert>}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} gap={2}>
          <TextField fullWidth size="small" placeholder="Search customer, opportunity, product, or owner" value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} /> }} />
          <TextField select size="small" label="Stage" value={stage} onChange={(event) => setStage(event.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="all">All stages</MenuItem>
            {OPPORTUNITY_STAGES.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
          </TextField>
        </Stack>
      </Paper>
      <TableContainer component={Paper}>
        {loading ? <Box sx={{ py: 8, display: "grid", placeItems: "center" }}><CircularProgress /></Box> : (
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Opportunity / Customer</TableCell><TableCell>Stage</TableCell>
              <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Owner / Close</TableCell>
              <TableCell align="right">Value</TableCell><TableCell align="right" sx={stickyActionHeaderSx}>Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.opportunity_id} hover>
                  <TableCell><Typography variant="body2" fontWeight={700} sx={truncateTextSx}>{item.title}</Typography><Typography variant="caption" color="text.secondary" sx={truncateTextSx}>{item.customer_name} · {item.opportunity_id}{item.product_interest ? ` · ${item.product_interest}` : ""}</Typography>{(item.vessel_name || item.engine_model) && <Typography variant="caption" color="primary" sx={truncateTextSx}>{item.vessel_name || "Installed equipment"}{item.engine_model ? ` · ${item.engine_brand || ""} ${item.engine_model}` : ""}</Typography>}</TableCell>
                  <TableCell><Chip size="small" label={STAGE_BY_VALUE[item.stage]?.label || item.stage} color={STAGE_BY_VALUE[item.stage]?.color} /><Typography variant="caption" display="block" color="text.secondary">{item.probability}%</Typography></TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}><Typography variant="body2">{item.owner_name}</Typography><Typography variant="caption" color="text.secondary">Close: {formatOpportunityDate(item.expected_close_date)}</Typography></TableCell>
                  <TableCell align="right"><Typography variant="body2" fontWeight={700}>{formatIdr(item.estimated_value)}</Typography><Typography variant="caption" color="text.secondary">Weighted {formatIdr(item.weighted_value)}</Typography></TableCell>
                  <TableCell align="right" sx={stickyActionCellSx}>
                    {canWrite && <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditing(item); setDialogOpen(true); }}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                    {canDelete && <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteTarget(item)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}>No opportunities found.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </TableContainer>
      <OpportunityDialog open={dialogOpen} opportunity={editing} customers={customers} owners={owners} user={user} presetCustomerId={presetCustomerId} onClose={() => setDialogOpen(false)} onSaved={() => { setDialogOpen(false); setSuccess(editing ? "Opportunity updated" : "Opportunity created"); load(); }} />
      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete opportunity" message={deleteTarget ? `Delete ${deleteTarget.opportunity_id} - ${deleteTarget.title}?` : ""} confirmLabel="Delete" loading={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={remove} />
    </Box>
  );
}
