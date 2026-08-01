import { Nav } from "@/components/Nav";
import { currentFirm } from "@/lib/db";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let firmName = "—";
  try {
    firmName = (await currentFirm()).name;
  } catch {
    // Sin base cargada, la home muestra las instrucciones de setup.
  }

  return (
    <div className="shell">
      <Nav firmName={firmName} />
      <main className="main">{children}</main>
    </div>
  );
}
