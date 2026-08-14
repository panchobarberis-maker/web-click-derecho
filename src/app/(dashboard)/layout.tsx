import { Nav } from "@/components/Nav";
import { activeFirm } from "@/lib/tenancy";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, firm, firms } = await activeFirm();

  return (
    <div className="shell">
      <Nav
        firm={{ id: firm.id, name: firm.name, role: firm.role }}
        firms={firms.map((f) => ({ id: f.id, name: f.name, role: f.role }))}
        user={{ name: user.name, email: user.email, is_staff: user.is_staff }}
        lang={firm.lang}
      />
      <main className="main">{children}</main>
    </div>
  );
}
