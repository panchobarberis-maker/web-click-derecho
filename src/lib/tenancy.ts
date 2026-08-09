import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql, type Firm } from "./db";
import { currentUser, sesionConEstudios, type SessionUser } from "./auth";
import { FIRM_COOKIE } from "./cookie-names";

export { FIRM_COOKIE };

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export type FirmAccess = Firm & { role: "owner" | "member" | "staff" };

/**
 * El estudio sobre el que se esta trabajando.
 *
 * La cookie solo elige entre los estudios a los que el usuario ya tiene acceso:
 * el permiso se resuelve siempre contra la base, nunca contra la cookie.
 */
export const activeFirm = cache(async function activeFirm(): Promise<{
  user: SessionUser;
  firm: FirmAccess;
  firms: FirmAccess[];
}> {
  // Una sola consulta trae la sesion y los estudios: encadenarlas costaba dos
  // latencias contra Supabase antes de que la pantalla pidiera nada.
  const filas = await sesionConEstudios();
  if (filas.length === 0) redirect("/login");

  const p = filas[0];
  const user: SessionUser = {
    id: p.u_id, email: p.u_email, name: p.u_name, image: p.u_image, is_staff: p.u_is_staff,
  };

  const firms = filas
    .filter((f) => f.f_id !== null)
    .map(({ u_id, u_email, u_name, u_image, u_is_staff, f_id, ...resto }) => {
      void u_id; void u_email; void u_name; void u_image; void u_is_staff;
      return { ...resto, id: f_id as string } as FirmAccess;
    });
  if (firms.length === 0) redirect("/sin-acceso");

  const elegido = (await cookies()).get(FIRM_COOKIE)?.value;
  const firm = firms.find((f) => f.id === elegido) ?? firms[0];
  return { user, firm, firms };
});

/**
 * Para lo que es de la agencia y no del estudio: crear estudios nuevos,
 * verlos todos. El flag vive en users.is_staff y no se puede pedir desde la
 * aplicacion; se marca a mano en la base.
 */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.is_staff) redirect("/panel");
  return user;
}

/** Para acciones que solo puede hacer quien administra el estudio. */
export async function requireOwner(): Promise<{ user: SessionUser; firm: FirmAccess }> {
  const { user, firm } = await activeFirm();
  if (firm.role === "member") redirect("/panel");
  return { user, firm };
}
