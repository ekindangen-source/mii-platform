export const LEAD_STATUSES = [
  { value: "new", label: "New", color: "default" },
  { value: "contacted", label: "Contacted", color: "info" },
  { value: "qualified", label: "Qualified", color: "success" },
  { value: "converted", label: "Converted", color: "primary" },
  { value: "disqualified", label: "Disqualified", color: "error" },
];
export const LEAD_STATUS_BY_VALUE = Object.fromEntries(LEAD_STATUSES.map((item) => [item.value, item]));
