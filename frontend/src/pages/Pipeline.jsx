import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, IconButton, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import OpportunityDialog from "../components/OpportunityDialog";
import { OPPORTUNITY_STAGES, formatIdr, formatOpportunityDate } from "../utils/opportunities";

export default function Pipeline() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const canWrite = ["admin", "manager", "sales"].includes(user?.role);
  const canViewAll = ["admin", "manager"].includes(user?.role);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const params = canViewAll && ownerFilter !== "all" ? { ownerId: ownerFilter } : {};
      const [opps, customerRows, ownerRows] = await Promise.all([
        api.get("/opportunities", { params }), api.get("/customers"), api.get("/opportunities/owners"),
      ]);
      setItems(Array.isArray(opps.data) ? opps.data : []);
      setCustomers(Array.isArray(customerRows.data) ? customerRows.data : []);
      setOwners(Array.isArray(ownerRows.data) ? ownerRows.data : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to load pipeline");
    } finally { setLoading(false); }
  }, [canViewAll, ownerFilter]);

  useEffect(() => { load(); }, [load]);
  const grouped = useMemo(() => Object.fromEntries(OPPORTUNITY_STAGES.map((stage) => [stage.value, items.filter((item) => item.stage === stage.value)])), [items]);

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2} sx={{ mb: 3 }}>
        <Box><Typography variant="h4" fontWeight={700}>Sales Pipeline</Typography><Typography color="text.secondary">Commercial opportunities from prospecting through win or loss.</Typography></Box>
        <Stack direction="row" gap={1}>
          {canViewAll && <TextField select size="small" label="Owner" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} sx={{ minWidth: 170 }}><MenuItem value="all">All owners</MenuItem>{owners.map((owner) => <MenuItem key={owner.user_id} value={owner.user_id}>{owner.full_name}</MenuItem>)}</TextField>}
          <Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
          {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setDialogOpen(true); }}>Add</Button>}
        </Stack>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ py: 10, display: "grid", placeItems: "center" }}><CircularProgress /></Box> : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(260px, 1fr))", xl: "repeat(6, minmax(220px, 1fr))" }, gap: 2, alignItems: "start" }}>
          {OPPORTUNITY_STAGES.map((stage) => {
            const stageItems = grouped[stage.value] || [];
            const total = stageItems.reduce((sum, item) => sum + Number(item.estimated_value || 0), 0);
            return <Paper key={stage.value} variant="outlined" sx={{ p: 1.5, bgcolor: "grey.50", minHeight: 220 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}><Box><Typography fontWeight={800}>{stage.label}</Typography><Typography variant="caption" color="text.secondary">{stageItems.length} · {formatIdr(total)}</Typography></Box><Chip size="small" label={`${stage.probability}%`} color={stage.color} /></Stack>
              <Stack gap={1.25}>{stageItems.map((item) => <Card key={item.opportunity_id} variant="outlined"><CardContent sx={{ p: "12px !important" }}><Stack direction="row" justifyContent="space-between" gap={1}><Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={800} noWrap>{item.title}</Typography><Typography variant="caption" color="text.secondary" display="block" noWrap>{item.customer_name}</Typography>{(item.vessel_name || item.engine_model) && <Typography variant="caption" color="primary" display="block" noWrap>{item.vessel_name || "Installed equipment"}{item.engine_model ? ` · ${item.engine_brand || ""} ${item.engine_model}` : ""}</Typography>}</Box>{canWrite && <IconButton size="small" onClick={() => { setEditing(item); setDialogOpen(true); }}><EditIcon fontSize="small" /></IconButton>}</Stack><Typography variant="body2" fontWeight={700} sx={{ mt: 1 }}>{formatIdr(item.estimated_value)}</Typography><Typography variant="caption" color="text.secondary">{item.owner_name} · Close {formatOpportunityDate(item.expected_close_date)}</Typography>{item.next_action && <Box sx={{ mt: 1, p: 1, borderRadius: 1, bgcolor: "action.hover" }}><Typography variant="caption" fontWeight={700}>NEXT ACTION</Typography><Typography variant="caption" display="block">{item.next_action}</Typography></Box>}</CardContent></Card>)}</Stack>
            </Paper>;
          })}
        </Box>
      )}
      <OpportunityDialog open={dialogOpen} opportunity={editing} customers={customers} owners={owners} user={user} onClose={() => setDialogOpen(false)} onSaved={() => { setDialogOpen(false); load(); }} />
    </Box>
  );
}
