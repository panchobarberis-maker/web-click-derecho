import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql, type Firm } from "./db";
import { currentUser, type SessionUser } from "./auth";
import { FIRM_COOKIE } from "./cookie-names";

export { FIRM_COOKIE };

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export type FirmAccess = Firm & { role: "owner" | "member" | "staff" };

/** Los estudios que este usuario puede ver. La agencia (is_staff) ve todos. */
export async function firmsFor(user: SessionUser): Promise<FirmAccess[]> {
  if (user.is_staff) {
    return sql<FirmAccess[]>`select f.*, 'staff' as role from firms f order by f.name`;
  }
  return sql<FirmAccess[]>`
    select f.*, m.role from firms f
    join memberships m on m.firm_id = f.id
    where m.user_id = ${user.id}
    order by f.name`;
}

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
  const user = await requireUser();
  const firms = await firmsFor(user);
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
  if (!user.is_staff) redirect("/");
  return user;
}

/** Para acciones que solo puede hacer quien administra el estudio. */
export async function requireOwner(): Promise<{ user: SessionUser; firm: FirmAccess }> {
  const { user, firm } = await activeFirm();
  if (firm.role === "member") redirect("/");
  return { user, firm };
}
