import HospitalPortalExperience from "@/components/hospital-portal-preview/HospitalPortalExperience";

type LoginPageProps = {
  searchParams?: Promise<{ logout?: string }>;
};

export default async function LoginRoutePage({ searchParams }: LoginPageProps) {
  const sp = searchParams ? await searchParams : {};
  const freshKey =
    sp.logout === "1"
      ? `logout-${Date.now()}`
      : "login";

  return (
    <HospitalPortalExperience key={freshKey} initialShowLogin />
  );
}
