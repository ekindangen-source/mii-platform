import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import SettingsIcon from "@mui/icons-material/Settings";
import RouteIcon from "@mui/icons-material/Route";
import BuildIcon from "@mui/icons-material/Build";

import { NavLink } from "react-router-dom";

const menuItems = [
  {
    label: "Dashboard",
    path: "/",
    icon: <DashboardIcon />,
  },
  {
    label: "Customers",
    path: "/customers",
    icon: <PeopleIcon />,
  },
  {
    label: "Vessels",
    path: "/vessels",
    icon: <DirectionsBoatIcon />,
  },
  {
    label: "Engines",
    path: "/engines",
    icon: <SettingsIcon />,
  },
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
];

export default function Sidebar({ onNavigate }) {
  return (
    <Box sx={{ height: "100%" }}>
      <Toolbar>
        <Typography variant="h6" fontWeight={700}>
          MII CRM
        </Typography>
      </Toolbar>

      <Divider />

      <List>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            onClick={onNavigate}
            sx={{
              "&.active": {
                bgcolor: "primary.main",
                color: "primary.contrastText",
                "& .MuiListItemIcon-root": {
                  color: "primary.contrastText",
                },
              },
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>

            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
