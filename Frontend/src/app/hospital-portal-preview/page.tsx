import { redirect } from "next/navigation";

/** Legacy preview URL — portal now lives at `/` and `/login` */
export default function HospitalPortalPreviewRedirectPage() {
  redirect("/");
}
