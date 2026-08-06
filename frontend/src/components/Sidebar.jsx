import {
  Box,
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
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import EngineeringIcon from "@mui/icons-material/Engineering";
import GroupsIcon from "@mui/icons-material/Groups";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import SettingsIcon from "@mui/icons-material/Settings";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";

import { NavLink } from "react-router-dom";

import {
  APP_RELEASE_NAME,
  APP_VERSION_LABEL,
} from "../config/appVersion";
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
    label: "Sales CRM",
    items: [
      {
        label: "Customers",
        path: "/customers",
        icon: <GroupsIcon />,
      },
      {
        label: "Opportunities",
        path: "/opportunities",
        icon: <TrendingUpIcon />,
        allowedRoles: ["admin", "manager", "sales", "technician", "viewer"],
      },
      {
        label: "Pipeline",
        path: "/pipeline",
        icon: <ViewKanbanIcon />,
        allowedRoles: ["admin", "manager", "sales", "technician", "viewer"],
      },
      {
        label: "Agenda",
        path: "/agenda",
        icon: <CalendarMonthIcon />,
      },
    ],
  },
  {
    label: "Customer Intelligence",
    items: [
      { label: "Installed Vessels", path: "/vessels", icon: <DirectionsBoatIcon /> },
      { label: "Installed Engines", path: "/engines", icon: <EngineeringIcon /> },
      {
        label: "Service History",
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
        path: "/users",
        icon: <ManageAccountsIcon />,
        adminOnly: true,
      },
      {
        label: "Settings",
        path: "/settings",
        icon: <SettingsIcon />,
        adminOnly: true,
      },
    ],
  },
];

export default function Sidebar({ onNavigate }) {
  const { user } = useAuth();

  function handleNavigate() {
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
          sx={{
            flexDirection: "row",
            gap: 1.5,
            alignItems: "center",
          }}
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
              sx={{
                fontWeight: 800,
                lineHeight: 1.15,
              }}
            >
              MII Platform
            </Typography>

            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.58)" }}
            >
              Sales CRM
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
              {group.items
                .filter(
                  (item) =>
                    (!item.adminOnly || user?.role === "admin") &&
                    (!item.allowedRoles || item.allowedRoles.includes(user?.role))
                )
                .map((item) => {
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
                          slotProps={{
                            primary: {
                              sx: {
                                fontSize: 14,
                              },
                            },
                            secondary: {
                              sx: {
                                fontSize: 10,
                                color:
                                  "rgba(255,255,255,0.22)",
                              },
                            },
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
                        slotProps={{
                          primary: {
                            sx: {
                              fontSize: 14,
                              fontWeight: 500,
                            },
                          },
                        }}
                      />
                    </ListItemButton>
                  );
                })}
            </List>
          </Box>
        ))}
      </Box>

      <Divider
        sx={{
          borderColor: "rgba(255,255,255,0.08)",
        }}
      />

      <Box sx={{ px: 2.25, py: 1.5 }}>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            color: "rgba(255,255,255,0.68)",
            fontWeight: 700,
          }}
        >
          MII Platform {APP_VERSION_LABEL}
        </Typography>

        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 0.25,
            color: "rgba(255,255,255,0.34)",
            fontSize: 10,
          }}
        >
          {APP_RELEASE_NAME}
        </Typography>
      </Box>
    </Box>
  );
}
