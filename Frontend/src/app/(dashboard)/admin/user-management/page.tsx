import { redirect } from "next/navigation";

/**
 * User Management page lives at /admin/staff.
 * This redirects /admin/user-management -> /admin/staff so both URLs work.
 */
export default function UserManagementRedirect() {
  redirect("/admin/staff");
}
