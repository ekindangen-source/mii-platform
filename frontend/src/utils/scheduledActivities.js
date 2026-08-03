export const OPEN_ACTIVITY_STATUSES = new Set([
  "planned",
  "confirmed",
]);

export function formatActivityType(value) {
  const labels = {
    meeting: "Meeting",
    visit: "Customer visit",
    call: "Scheduled call",
    follow_up: "Follow-up",
  };

  return labels[value] || value || "Activity";
}

export function formatActivityStatus(value) {
  const labels = {
    planned: "Planned",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    rescheduled: "Rescheduled",
    no_show: "No show",
  };

  return labels[value] || value || "Unknown";
}

export function formatActivityDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function statusColor(status) {
  const colors = {
    planned: "default",
    confirmed: "primary",
    completed: "success",
    cancelled: "error",
    rescheduled: "warning",
    no_show: "warning",
  };

  return colors[status] || "default";
}
