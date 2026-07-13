import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import BuildIcon from "@mui/icons-material/Build";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import EngineeringIcon from "@mui/icons-material/Engineering";
import GroupsIcon from "@mui/icons-material/Groups";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import RefreshIcon from "@mui/icons-material/Refresh";
import RouteIcon from "@mui/icons-material/Route";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SpeedIcon from "@mui/icons-material/Speed";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const initialData = {
  customers: [],
  vessels: [],
  engines: [],
  trips: [],
  maintenance: [],
};

function rowsFromResponse(response) {
  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.data)) {
    return response.data.data;
  }

  return [];
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameMonth(date, comparisonDate) {
  return (
    date &&
    date.getFullYear() === comparisonDate.getFullYear() &&
    date.getMonth() === comparisonDate.getMonth()
  );
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatNumber(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(asNumber(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(asNumber(value));
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function latestMaintenanceByEngine(records) {
  const latest = new Map();

  records.forEach((record) => {
    if (!record.engine_id) {
      return;
    }

    const current = latest.get(record.engine_id);
    const recordDate = parseDate(record.service_date)?.getTime() || 0;
    const currentDate = parseDate(current?.service_date)?.getTime() || 0;

    if (!current || recordDate >= currentDate) {
      latest.set(record.engine_id, record);
    }
  });

  return Array.from(latest.values());
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  path,
  tone = "primary",
}) {
  const navigate = useNavigate();

  return (
    <Card sx={{ height: "100%" }}>
      <CardActionArea
        onClick={() => navigate(path)}
        sx={{ height: "100%" }}
      >
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            spacing={2}
          >
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
                gutterBottom
              >
                {title}
              </Typography>

              <Typography variant="h4" fontWeight={700}>
                {value}
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
              >
                {subtitle}
              </Typography>
            </Box>

            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 44,
                height: 44,
                borderRadius: 2,
                bgcolor: `${tone}.light`,
                color: `${tone}.dark`,
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [
        customersResponse,
        vesselsResponse,
        enginesResponse,
        tripsResponse,
        maintenanceResponse,
      ] = await Promise.all([
        api.get("/customers"),
        api.get("/vessels"),
        api.get("/engines"),
        api.get("/trips"),
        api.get("/maintenance"),
      ]);

      setData({
        customers: rowsFromResponse(customersResponse),
        vessels: rowsFromResponse(vesselsResponse),
        engines: rowsFromResponse(enginesResponse),
        trips: rowsFromResponse(tripsResponse),
        maintenance: rowsFromResponse(maintenanceResponse),
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load dashboard data"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const now = new Date();
    const today = startOfToday();
    const nextThirtyDays = addDays(today, 30);

    const tripsThisMonth = data.trips.filter((trip) =>
      isSameMonth(parseDate(trip.trip_date), now)
    );

    const maintenanceThisMonth = data.maintenance.filter((record) =>
      isSameMonth(parseDate(record.service_date), now)
    );

    const latestMaintenance = latestMaintenanceByEngine(
      data.maintenance
    );

    const engineHoursById = new Map(
      data.engines.map((engine) => [
        engine.engine_id,
        asNumber(engine.engine_hours),
      ])
    );

    const dueItems = latestMaintenance
      .map((record) => {
        const nextDate = parseDate(record.next_service_date);

        if (nextDate) {
          nextDate.setHours(0, 0, 0, 0);
        }

        const nextHours =
          record.next_service_hours === null ||
          record.next_service_hours === undefined ||
          record.next_service_hours === ""
            ? null
            : asNumber(record.next_service_hours);

        const currentHours = engineHoursById.get(record.engine_id) || 0;

        const dateOverdue = Boolean(nextDate && nextDate < today);
        const dateUpcoming = Boolean(
          nextDate &&
            nextDate >= today &&
            nextDate <= nextThirtyDays
        );
        const hoursDue = Boolean(
          nextHours !== null && currentHours >= nextHours
        );

        if (!dateOverdue && !dateUpcoming && !hoursDue) {
          return null;
        }

        return {
          ...record,
          nextDate,
          currentHours,
          nextHours,
          overdue: dateOverdue || hoursDue,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.overdue !== b.overdue) {
          return a.overdue ? -1 : 1;
        }

        const aTime = a.nextDate?.getTime() || Number.MAX_SAFE_INTEGER;
        const bTime = b.nextDate?.getTime() || Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });

    const recentTrips = [...data.trips]
      .sort((a, b) => {
        const aTime = parseDate(a.trip_date)?.getTime() || 0;
        const bTime = parseDate(b.trip_date)?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 5);

    const brandCounts = data.engines.reduce((counts, engine) => {
      const brand = engine.brand || "Unknown";
      counts[brand] = (counts[brand] || 0) + 1;
      return counts;
    }, {});

    const engineBrands = Object.entries(brandCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return {
      tripsThisMonth: tripsThisMonth.length,
      operatingHoursThisMonth: tripsThisMonth.reduce(
        (total, trip) =>
          total + asNumber(trip.operating_hours),
        0
      ),
      fuelThisMonth: tripsThisMonth.reduce(
        (total, trip) => total + asNumber(trip.fuel_used_l),
        0
      ),
      maintenanceCostThisMonth: maintenanceThisMonth.reduce(
        (total, record) =>
          total +
          asNumber(record.labor_cost) +
          asNumber(record.parts_cost),
        0
      ),
      dueItems,
      recentTrips,
      engineBrands,
    };
  }, [data]);

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: 360,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">
            Loading dashboard...
          </Typography>
        </Stack>
      </Box>
    );
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
            Welcome,{" "}
            {user?.fullName || user?.email || "User"}
          </Typography>

          <Typography color="text.secondary">
            Fleet and operations overview for{" "}
            {new Intl.DateTimeFormat("en-GB", {
              month: "long",
              year: "numeric",
            }).format(new Date())}.
          </Typography>
        </Box>

        <Tooltip title="Refresh dashboard">
          <span>
            <IconButton
              color="primary"
              onClick={() =>
                loadDashboard({ silent: true })
              }
              disabled={refreshing}
            >
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {refreshing && <LinearProgress sx={{ mb: 2 }} />}

      {error && (
        <Alert
          severity="error"
          onClose={() => setError("")}
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => loadDashboard()}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(5, 1fr)",
          },
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard
          title="Customers"
          value={formatNumber(data.customers.length, 0)}
          subtitle="Active CRM records"
          icon={<GroupsIcon />}
          path="/customers"
        />

        <StatCard
          title="Vessels"
          value={formatNumber(data.vessels.length, 0)}
          subtitle="Registered fleet"
          icon={<DirectionsBoatIcon />}
          path="/vessels"
          tone="info"
        />

        <StatCard
          title="Engines"
          value={formatNumber(data.engines.length, 0)}
          subtitle="Installed propulsion"
          icon={<EngineeringIcon />}
          path="/engines"
          tone="secondary"
        />

        <StatCard
          title="Trips this month"
          value={formatNumber(metrics.tripsThisMonth, 0)}
          subtitle={`${formatNumber(
            metrics.operatingHoursThisMonth
          )} operating hours`}
          icon={<RouteIcon />}
          path="/trips"
          tone="success"
        />

        <StatCard
          title="Maintenance due"
          value={formatNumber(metrics.dueItems.length, 0)}
          subtitle="Overdue or due within 30 days"
          icon={<BuildIcon />}
          path="/maintenance"
          tone="warning"
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(3, 1fr)",
          },
          gap: 2,
          mb: 3,
        }}
      >
        <Paper sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={1.5}>
            <LocalGasStationIcon color="primary" />

            <Box>
              <Typography color="text.secondary">
                Fuel used this month
              </Typography>

              <Typography variant="h5" fontWeight={700}>
                {formatNumber(metrics.fuelThisMonth)} L
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={1.5}>
            <ScheduleIcon color="primary" />

            <Box>
              <Typography color="text.secondary">
                Operating hours this month
              </Typography>

              <Typography variant="h5" fontWeight={700}>
                {formatNumber(
                  metrics.operatingHoursThisMonth
                )}{" "}
                h
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={1.5}>
            <SpeedIcon color="primary" />

            <Box>
              <Typography color="text.secondary">
                Maintenance cost this month
              </Typography>

              <Typography variant="h5" fontWeight={700}>
                {formatCurrency(
                  metrics.maintenanceCostThisMonth
                )}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "1.25fr 1fr",
          },
          gap: 2,
          mb: 3,
        }}
      >
        <Paper sx={{ p: 2.5 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1 }}
          >
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Maintenance attention
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Latest service schedule per engine.
              </Typography>
            </Box>

            <Button
              size="small"
              onClick={() => navigate("/maintenance")}
            >
              View all
            </Button>
          </Stack>

          <Divider />

          {metrics.dueItems.length ? (
            <List disablePadding>
              {metrics.dueItems.slice(0, 5).map((item) => (
                <ListItem
                  key={item.maintenance_id}
                  disableGutters
                  divider
                  secondaryAction={
                    <Chip
                      size="small"
                      color={
                        item.overdue ? "error" : "warning"
                      }
                      label={
                        item.overdue ? "Due now" : "Upcoming"
                      }
                    />
                  }
                >
                  <ListItemText
                    primary={
                      [item.brand, item.model]
                        .filter(Boolean)
                        .join(" ") ||
                      item.engine_id
                    }
                    secondary={
                      item.nextDate
                        ? `Next date: ${formatDate(
                            item.nextDate
                          )}`
                        : item.nextHours !== null
                          ? `Due at ${formatNumber(
                              item.nextHours
                            )} hours`
                          : "Service attention required"
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography
              color="text.secondary"
              sx={{ py: 3 }}
            >
              No maintenance is due within the next 30 days.
            </Typography>
          )}
        </Paper>

        <Paper sx={{ p: 2.5 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1 }}
          >
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Recent trips
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Most recently recorded vessel activity.
              </Typography>
            </Box>

            <Button
              size="small"
              onClick={() => navigate("/trips")}
            >
              View all
            </Button>
          </Stack>

          <Divider />

          {metrics.recentTrips.length ? (
            <List disablePadding>
              {metrics.recentTrips.map((trip) => (
                <ListItem
                  key={trip.trip_id}
                  disableGutters
                  divider
                >
                  <ListItemText
                    primary={
                      trip.boat_name ||
                      trip.vessel_id ||
                      trip.trip_id
                    }
                    secondary={`${formatDate(
                      trip.trip_date
                    )} · ${formatNumber(
                      trip.operating_hours
                    )} h · ${formatNumber(
                      trip.fuel_used_l
                    )} L`}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography
              color="text.secondary"
              sx={{ py: 3 }}
            >
              No trips have been recorded.
            </Typography>
          )}
        </Paper>
      </Box>

      <Paper sx={{ p: 2.5 }}>
        <Typography variant="h6" fontWeight={700}>
          Engine brand distribution
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2 }}
        >
          Top installed engine brands in the current dataset.
        </Typography>

        {metrics.engineBrands.length ? (
          <Stack spacing={1.5}>
            {metrics.engineBrands.map(([brand, count]) => {
              const percentage = data.engines.length
                ? (count / data.engines.length) * 100
                : 0;

              return (
                <Box key={brand}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    sx={{ mb: 0.5 }}
                  >
                    <Typography>{brand}</Typography>

                    <Typography color="text.secondary">
                      {count} · {formatNumber(percentage, 0)}%
                    </Typography>
                  </Stack>

                  <LinearProgress
                    variant="determinate"
                    value={percentage}
                    sx={{ height: 8, borderRadius: 999 }}
                  />
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Typography color="text.secondary">
            No engines have been recorded.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
