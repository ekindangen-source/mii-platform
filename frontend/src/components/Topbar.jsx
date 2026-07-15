import { useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import BuildIcon from "@mui/icons-material/Build";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import EngineeringIcon from "@mui/icons-material/Engineering";
import GroupsIcon from "@mui/icons-material/Groups";
import LogoutIcon from "@mui/icons-material/Logout";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import RouteIcon from "@mui/icons-material/Route";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const pageMeta = {
  "/": {
    title: "Dashboard",
    subtitle: "Fleet and operations overview",
    icon: <DashboardIcon fontSize="small" />,
  },
  "/customers": {
    title: "Customers",
    subtitle: "Customer companies and contacts",
    icon: <GroupsIcon fontSize="small" />,
  },
  "/vessels": {
    title: "Vessels",
    subtitle: "Registered vessels and fleet assignments",
    icon: <DirectionsBoatIcon fontSize="small" />,
  },
  "/engines": {
    title: "Engines",
    subtitle: "Installed propulsion and engine records",
    icon: <EngineeringIcon fontSize="small" />,
  },
  "/trips": {
    title: "Trips",
    subtitle: "Vessel activity and operating data",
    icon: <RouteIcon fontSize="small" />,
  },
  "/maintenance": {
    title: "Maintenance",
    subtitle: "Service work, costs, and schedules",
    icon: <BuildIcon fontSize="small" />,
  },
};

const searchablePages = Object.entries(pageMeta).map(
  ([path, meta]) => ({
    path,
    ...meta,
  })
);

function initialsFor(user) {
  const source =
    user?.fullName ||
    user?.email ||
    "MII User";

  const parts = source
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "MU";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function roleLabel(role) {
  if (!role) {
    return "User";
  }

  return role
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

export default function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [search, setSearch] = useState("");
  const [profileAnchor, setProfileAnchor] =
    useState(null);
  const [notificationAnchor, setNotificationAnchor] =
    useState(null);

  const currentPage =
    pageMeta[location.pathname] || {
      title: "MII Platform",
      subtitle: "Marine Intelligence Indonesia",
      icon: <DashboardIcon fontSize="small" />,
    };

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return searchablePages.filter((page) =>
      [page.title, page.subtitle].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [search]);

  function handleSearchKeyDown(event) {
    if (
      event.key === "Enter" &&
      searchResults.length
    ) {
      navigate(searchResults[0].path);
      setSearch("");
    }

    if (event.key === "Escape") {
      setSearch("");
    }
  }

  function handleLogout() {
    setProfileAnchor(null);
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 2,
        minWidth: 0,
      }}
    >
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{
          minWidth: 0,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            display: {
              xs: "none",
              sm: "grid",
            },
            placeItems: "center",
            width: 34,
            height: 34,
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.12)",
            color: "common.white",
          }}
        >
          {currentPage.icon}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            fontWeight={800}
            noWrap
            sx={{ lineHeight: 1.15 }}
          >
            {currentPage.title}
          </Typography>

          <Typography
            variant="caption"
            noWrap
            sx={{
              display: {
                xs: "none",
                sm: "block",
              },
              color: "rgba(255,255,255,0.68)",
            }}
          >
            {currentPage.subtitle}
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          flex: 1,
          display: {
            xs: "none",
            md: "flex",
          },
          justifyContent: "center",
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 460,
            position: "relative",
          }}
        >
          <TextField
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            onKeyDown={handleSearchKeyDown}
            placeholder="Search modules..."
            size="small"
            fullWidth
            autoComplete="off"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon
                    sx={{
                      color:
                        "rgba(255,255,255,0.65)",
                    }}
                  />
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "common.white",
                bgcolor:
                  "rgba(255,255,255,0.085)",
                borderRadius: 2.5,
                "& fieldset": {
                  borderColor:
                    "rgba(255,255,255,0.13)",
                },
                "&:hover fieldset": {
                  borderColor:
                    "rgba(255,255,255,0.28)",
                },
                "&.Mui-focused fieldset": {
                  borderColor:
                    "rgba(94,234,212,0.86)",
                },
              },
              "& input::placeholder": {
                color: "rgba(255,255,255,0.54)",
                opacity: 1,
              },
            }}
          />

          {searchResults.length > 0 && (
            <Box
              sx={{
                position: "absolute",
                zIndex: 20,
                top: "calc(100% + 8px)",
                left: 0,
                right: 0,
                borderRadius: 2,
                bgcolor: "background.paper",
                color: "text.primary",
                boxShadow:
                  "0 16px 42px rgba(15,23,42,0.22)",
                overflow: "hidden",
              }}
            >
              {searchResults
                .slice(0, 5)
                .map((page) => (
                  <MenuItem
                    key={page.path}
                    onClick={() => {
                      navigate(page.path);
                      setSearch("");
                    }}
                    sx={{
                      py: 1.2,
                      gap: 1.25,
                    }}
                  >
                    <ListItemIcon
                      sx={{ minWidth: 34 }}
                    >
                      {page.icon}
                    </ListItemIcon>

                    <Box>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                      >
                        {page.title}
                      </Typography>

                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        {page.subtitle}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
            </Box>
          )}
        </Box>
      </Box>

      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        sx={{
          ml: "auto",
          flexShrink: 0,
        }}
      >
        <Tooltip title="Notifications">
          <IconButton
            color="inherit"
            onClick={(event) =>
              setNotificationAnchor(
                event.currentTarget
              )
            }
          >
            <Badge
              color="error"
              variant="dot"
              invisible
            >
              <NotificationsNoneIcon />
            </Badge>
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={notificationAnchor}
          open={Boolean(notificationAnchor)}
          onClose={() =>
            setNotificationAnchor(null)
          }
          PaperProps={{
            sx: {
              mt: 1,
              width: 300,
              borderRadius: 2,
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography
              variant="subtitle2"
              fontWeight={800}
            >
              Notifications
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              You have no new notifications.
            </Typography>
          </Box>
        </Menu>

        <Tooltip title="Account menu">
          <IconButton
            color="inherit"
            onClick={(event) =>
              setProfileAnchor(event.currentTarget)
            }
            sx={{ ml: 0.5 }}
          >
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: "#0f766e",
                border:
                  "2px solid rgba(255,255,255,0.64)",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {initialsFor(user)}
            </Avatar>
          </IconButton>
        </Tooltip>

        <Box
          sx={{
            display: {
              xs: "none",
              lg: "block",
            },
            pl: 0.25,
            maxWidth: 180,
          }}
        >
          <Typography
            variant="body2"
            fontWeight={700}
            noWrap
          >
            {user?.fullName ||
              user?.email ||
              "MII User"}
          </Typography>

          <Typography
            variant="caption"
            noWrap
            sx={{
              display: "block",
              color: "rgba(255,255,255,0.68)",
            }}
          >
            {roleLabel(user?.role)}
          </Typography>
        </Box>

        <Menu
          anchorEl={profileAnchor}
          open={Boolean(profileAnchor)}
          onClose={() => setProfileAnchor(null)}
          PaperProps={{
            sx: {
              mt: 1,
              minWidth: 240,
              borderRadius: 2,
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography
              variant="body2"
              fontWeight={800}
              noWrap
            >
              {user?.fullName ||
                user?.email ||
                "MII User"}
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
            >
              {user?.email || roleLabel(user?.role)}
            </Typography>
          </Box>

          <Divider />

          <MenuItem disabled>
            <ListItemIcon>
              <AccountCircleIcon fontSize="small" />
            </ListItemIcon>
            Profile
          </MenuItem>

          <MenuItem disabled>
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            Settings
          </MenuItem>

          <Divider />

          <MenuItem
            onClick={handleLogout}
            sx={{ color: "error.main" }}
          >
            <ListItemIcon>
              <LogoutIcon
                fontSize="small"
                color="error"
              />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      </Stack>
    </Box>
  );
}
