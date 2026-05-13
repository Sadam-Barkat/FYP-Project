/**
 * Maps API user.role + email rules to the canonical role strings used across the dashboard.
 */
export function resolveEffectiveRole(
  apiRole: unknown,
  email: string,
): string {
  const userEmail = email.trim().toLowerCase();
  let raw = String(apiRole ?? "admin")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  // Synonyms from backends / legacy values → frontend keys
  const synonyms: Record<string, string> = {
    reception: "receptionist",
    reception_staff: "receptionist",
    front_desk: "receptionist",
    receptionist: "receptionist",
    lab: "laboratorian",
    laboratory: "laboratorian",
    lab_technician: "laboratorian",
    laboratory_technician: "laboratorian",
    laboratorian: "laboratorian",
    technician: "laboratorian",
    billing: "finance",
    accountant: "finance",
    finance: "finance",
    physician: "doctor",
    doctor: "doctor",
    nurse: "nurse",
    registered_nurse: "nurse",
    admin: "admin",
    administrator: "admin",
    superadmin: "admin",
    super_admin: "admin",
  };

  let role = synonyms[raw] ?? raw;

  // Demo / fixed accounts (same rules as legacy login)
  if (userEmail === "reception@hospital.com") role = "receptionist";
  else if (userEmail === "lab@hospital.com") role = "laboratorian";
  else if (
    role === "finance" ||
    userEmail === "finance@hospital.com"
  )
    role = "finance";

  const allowed = new Set([
    "admin",
    "doctor",
    "nurse",
    "receptionist",
    "laboratorian",
    "finance",
  ]);
  return allowed.has(role) ? role : "admin";
}

/** Default dashboard path for each canonical role */
export function getDashboardPathForRole(role: string): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "doctor":
      return "/doctor";
    case "nurse":
      return "/nurse";
    case "receptionist":
      return "/reception";
    case "laboratorian":
      return "/laboratory-entry";
    case "finance":
      return "/admin/billing-finance";
    default:
      return "/admin";
  }
}
