# Leads and Customer Conversion

Leads are prospects that have not yet purchased. Customers are established
accounts. A lead moves through New, Contacted, Qualified, and then either
Converted or Disqualified.

CRM leads are stored in `crm_leads`, separate from the legacy Mobile Sales
module's `sales_leads` data.

Only a Qualified lead with an explicitly confirmed sale can be converted.
Conversion runs in one database transaction and creates the Customer, primary
PIC, assignment history, and mandatory Won Opportunity. The original Lead remains as immutable
conversion history and cannot be converted twice or deleted afterward.

Normal direct Customer creation is disabled in both the user interface and API.
Exceptional historical imports are restricted to administrators, require an
import reason, and are recorded separately from Lead conversions.

Sales users see their own leads. Administrators, managers, and viewers see all
leads; only administrators and managers can delete non-converted leads or
assign a different owner.

When a Customer is selected in an Opportunity, the form displays that
customer's vessels and the engines installed on each vessel. A vessel and
engine can be linked to the Opportunity when the sale concerns a specific
repower, replacement, parts, or service requirement. The API validates that
the selected equipment belongs to the Customer.
