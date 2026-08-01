/** La sesion vive por estudio, no por formulario: la persona puede pasar por el
 *  menu de areas, elegir un caso y volver atras, y sigue siendo una sola visita. */
export const sessionKey = (firmSlug: string) => `intake:${firmSlug}`;
