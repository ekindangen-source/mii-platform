import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress, IconButton, LinearProgress, Paper, Stack, Tooltip, Typography } from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GroupsIcon from "@mui/icons-material/Groups";
import RefreshIcon from "@mui/icons-material/Refresh";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { STAGE_BY_VALUE, formatIdr, formatOpportunityDate } from "../utils/opportunities";

function StatCard({ title, value, subtitle, icon, path, tone = "primary" }) {
  const navigate = useNavigate();
  return <Card sx={{ height: "100%" }}><CardActionArea onClick={() => navigate(path)} sx={{ height: "100%" }}><CardContent><Stack direction="row" justifyContent="space-between" gap={2}><Box><Typography variant="body2" color="text.secondary">{title}</Typography><Typography variant="h4" fontWeight={800}>{value}</Typography><Typography variant="caption" color="text.secondary">{subtitle}</Typography></Box><Box sx={{ width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: `${tone}.light`, color: `${tone}.dark` }}>{icon}</Box></Stack></CardContent></CardActionArea></Card>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ customers: [], opportunities: [], summary: {}, agenda: { overdue: [], today: [], upcoming: [] } });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      silent ? setRefreshing(true) : setLoading(true);
      setError("");
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
      const [customers, opportunities, summary, agenda] = await Promise.all([
        api.get("/customers"), api.get("/opportunities"), api.get("/opportunities/summary"),
        api.get("/scheduled-activities/agenda", { params: { date, timeZone: "Asia/Jakarta" } }),
      ]);
      setData({
        customers: Array.isArray(customers.data) ? customers.data : [],
        opportunities: Array.isArray(opportunities.data) ? opportunities.data : [],
        summary: summary.data || {}, agenda: agenda.data || { overdue: [], today: [], upcoming: [] },
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to load CRM dashboard");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const openOpportunities = useMemo(() => data.opportunities.filter((item) => !["won", "lost"].includes(item.stage)), [data.opportunities]);
  const overdueActions = useMemo(() => openOpportunities.filter((item) => item.next_action_at && new Date(item.next_action_at) < new Date()).slice(0, 6), [openOpportunities]);
  const closingSoon = useMemo(() => [...openOpportunities].filter((item) => item.expected_close_date).sort((a, b) => String(a.expected_close_date).localeCompare(String(b.expected_close_date))).slice(0, 6), [openOpportunities]);
  const agendaCount = (data.agenda.overdue?.length || 0) + (data.agenda.today?.length || 0);

  if (loading) return <Box sx={{ minHeight: 360, display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  return <Box>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={2} sx={{ mb: 3 }}>
      <Box><Typography variant="h4" fontWeight={800}>Welcome, {user?.fullName || user?.email || "User"}</Typography><Typography color="text.secondary">Sales relationships, pipeline, and next actions requiring attention.</Typography></Box>
      <Tooltip title="Refresh dashboard"><IconButton color="primary" onClick={() => load({ silent: true })} disabled={refreshing}><RefreshIcon /></IconButton></Tooltip>
    </Stack>
    {refreshing && <LinearProgress sx={{ mb: 2 }} />}
    {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => load()}>Retry</Button>}>{error}</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(5,1fr)" }, gap: 2, mb: 3 }}>
      <StatCard title="Customers" value={data.customers.length} subtitle="Accounts in your portfolio" icon={<GroupsIcon />} path="/customers" />
      <StatCard title="Open opportunities" value={data.summary.open_count || 0} subtitle={formatIdr(data.summary.open_value)} icon={<TrendingUpIcon />} path="/opportunities" tone="info" />
      <StatCard title="Weighted pipeline" value={formatIdr(data.summary.weighted_value)} subtitle="Probability-adjusted forecast" icon={<AccountBalanceWalletIcon />} path="/pipeline" tone="secondary" />
      <StatCard title="Agenda attention" value={agendaCount} subtitle="Overdue and due today" icon={<CalendarMonthIcon />} path="/agenda" tone="warning" />
      <StatCard title="Won" value={data.summary.won_count || 0} subtitle={formatIdr(data.summary.won_value)} icon={<TaskAltIcon />} path="/opportunities" tone="success" />
    </Box>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
      <Paper sx={{ p: 2.5 }}><Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}><WarningAmberIcon color="warning" /><Typography variant="h6" fontWeight={800}>Overdue opportunity actions</Typography></Stack><Stack gap={1.25}>{overdueActions.map((item) => <Box key={item.opportunity_id} onClick={() => navigate("/opportunities")} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2, cursor: "pointer" }}><Stack direction="row" justifyContent="space-between" gap={1}><Box><Typography fontWeight={700}>{item.next_action}</Typography><Typography variant="body2" color="text.secondary">{item.customer_name} · {item.title}</Typography></Box><Chip size="small" color="error" label={formatOpportunityDate(item.next_action_at)} /></Stack></Box>)}{!overdueActions.length && <Typography color="text.secondary">No overdue opportunity actions.</Typography>}</Stack></Paper>
      <Paper sx={{ p: 2.5 }}><Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>Expected closings</Typography><Stack gap={1.25}>{closingSoon.map((item) => <Box key={item.opportunity_id} onClick={() => navigate("/pipeline")} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2, cursor: "pointer" }}><Stack direction="row" justifyContent="space-between" gap={1}><Box><Typography fontWeight={700}>{item.title}</Typography><Typography variant="body2" color="text.secondary">{item.customer_name} · {item.owner_name}</Typography></Box><Box textAlign="right"><Typography fontWeight={700}>{formatIdr(item.estimated_value)}</Typography><Chip size="small" label={STAGE_BY_VALUE[item.stage]?.label || item.stage} color={STAGE_BY_VALUE[item.stage]?.color} /></Box></Stack><Typography variant="caption" color="text.secondary">Expected close: {formatOpportunityDate(item.expected_close_date)}</Typography></Box>)}{!closingSoon.length && <Typography color="text.secondary">No expected closing dates recorded.</Typography>}</Stack></Paper>
    </Box>
  </Box>;
}
