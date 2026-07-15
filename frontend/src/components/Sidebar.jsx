import {
  Avatar,
  Box,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";

import BuildIcon from "@mui/icons-material/Build";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import EngineeringIcon from "@mui/icons-material/Engineering";
import GroupsIcon from "@mui/icons-material/Groups";
import LogoutIcon from "@mui/icons-material/Logout";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import RouteIcon from "@mui/icons-material/Route";
import SettingsIcon from "@mui/icons-material/Settings";

import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const navigationGroups = [
  {
    label: null,
    items: [
      {
        label: "Dashboard",
        path: "/",
        icon: <DashboardIcon />,
      },
    ],
  },
  {
    label: "Fleet",
    items: [
      {
        label: "Customers",
        path: "/customers",
        icon: <GroupsIcon />,
      },
      {
        label: "Vessels",
        path: "/vessels",
        icon: <DirectionsBoatIcon />,
      },
      {
        label: "Engines",
        path: "/engines",
        icon: <EngineeringIcon />,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Trips",
        path: "/trips",
        icon: <RouteIcon />,
      },
      {
        label: "Maintenance",
        path: "/maintenance",
        icon: <BuildIcon />,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Users",
        icon: <ManageAccountsIcon />,
        disabled: true,
      },
      {
        label: "Settings",
        icon: <SettingsIcon />,
        disabled: true,
      },
    ],
  },
];

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

export default function Sidebar({ onNavigate }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  function handleNavigate() {
    if (onNavigate) {
      onNavigate();
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });

    if (onNavigate) {
      onNavigate();
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#0f172a",
        color: "common.white",
      }}
    >
      <Toolbar
        sx={{
          minHeight: "76px !important",
          px: 2.25,
          alignItems: "center",
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              display: "grid",
              placeItems: "center",
              borderRadius: 2,
              bgcolor: "primary.main",
              boxShadow:
                "0 8px 18px rgba(15, 118, 110, 0.34)",
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            MII
          </Box>

          <Box>
            <Typography
              variant="subtitle1"
              fontWeight={800}
              lineHeight={1.15}
            >
              MII Platform
            </Typography>

            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.58)" }}
            >
              Marine Intelligence
            </Typography>
          </Box>
        </Stack>
      </Toolbar>

      <Divider
        sx={{
          borderColor: "rgba(255,255,255,0.08)",
        }}
      />

      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          py: 1.5,
          px: 1.25,
        }}
      >
        {navigationGroups.map((group, groupIndex) => (
          <Box
            key={group.label || `root-${groupIndex}`}
            sx={{ mb: groupIndex === 0 ? 1.25 : 2 }}
          >
            {group.label && (
              <Typography
                variant="overline"
                sx={{
                  display: "block",
                  px: 1.5,
                  mb: 0.5,
                  color: "rgba(255,255,255,0.38)",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.13em",
                  lineHeight: 2.4,
                }}
              >
                {group.label}
              </Typography>
            )}

            <List disablePadding>
              {group.items.map((item) => {
                const commonSx = {
                  minHeight: 44,
                  px: 1.5,
                  mb: 0.5,
                  borderRadius: 2,
                  color: "rgba(255,255,255,0.72)",
                  transition:
                    "background-color 150ms ease, color 150ms ease, transform 150ms ease",
                  "& .MuiListItemIcon-root": {
                    minWidth: 38,
                    color: "rgba(255,255,255,0.48)",
                    transition: "color 150ms ease",
                  },
                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.075)",
                    color: "common.white",
                    transform: "translateX(2px)",
                    "& .MuiListItemIcon-root": {
                      color: "primary.light",
                    },
                  },
                  "&.active": {
                    bgcolor: "rgba(15,118,110,0.28)",
                    color: "common.white",
                    boxShadow:
                      "inset 3px 0 0 #2dd4bf",
                    "& .MuiListItemIcon-root": {
                      color: "#5eead4",
                    },
                    "& .MuiListItemText-primary": {
                      fontWeight: 700,
                    },
                  },
                  "&.Mui-disabled": {
                    color: "rgba(255,255,255,0.26)",
                    "& .MuiListItemIcon-root": {
                      color: "rgba(255,255,255,0.20)",
                    },
                  },
                };

                if (item.disabled) {
                  return (
                    <ListItemButton
                      key={item.label}
                      disabled
                      sx={commonSx}
                    >
                      <ListItemIcon>
                        {item.icon}
                      </ListItemIcon>

                      <ListItemText
                        primary={item.label}
                        secondary="Coming soon"
                        primaryTypographyProps={{
                          fontSize: 14,
                        }}
                        secondaryTypographyProps={{
                          fontSize: 10,
                          color:
                            "rgba(255,255,255,0.22)",
                        }}
                      />
                    </ListItemButton>
                  );
                }

                return (
                  <ListItemButton
                    key={item.path}
                    component={NavLink}
                    to={item.path}
                    end={item.path === "/"}
                    onClick={handleNavigate}
                    sx={commonSx}
                  >
                    <ListItemIcon>
                      {item.icon}
                    </ListItemIcon>

                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          p: 1.5,
          borderTop:
            "1px solid rgba(255,255,255,0.08)",
          bgcolor: "rgba(2,6,23,0.34)",
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          sx={{
            px: 1,
            py: 1,
            mb: 1,
          }}
        >
          <Avatar
            sx={{
              width: 38,
              height: 38,
              bgcolor: "primary.main",
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            {initialsFor(user)}
          </Avatar>

          <Box sx={{ minWidth: 0, flex: 1 }}>
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
                color: "rgba(255,255,255,0.48)",
              }}
            >
              {roleLabel(user?.role)}
            </Typography>
          </Box>
        </Stack>

        <Button
          fullWidth
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{
            justifyContent: "flex-start",
            color: "rgba(255,255,255,0.76)",
            borderColor: "rgba(255,255,255,0.14)",
            textTransform: "none",
            "&:hover": {
              color: "common.white",
              borderColor: "rgba(255,255,255,0.30)",
              bgcolor: "rgba(255,255,255,0.06)",
            },
          }}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );
}
