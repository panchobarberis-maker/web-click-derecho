import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { activeFirm } from "@/lib/tenancy";
import "./preview.css";

export const dynamic = "force-dynamic";

/**
 * Vista previa de un pop-up o un clip.
 *
 * Es una pagina de estudio juridico de mentira con el widget real corriendo
 * encima: el mismo /w.js que se pega en el sitio del cliente, con la misma
 * configuracion guardada. No es una maqueta que imita al widget —eso se
 * desincroniza al primer cambio— sino el widget de verdad sobre un decorado.
 *
 * Va con preview=1, que le dice al formulario que no registre la visita ni
 * mande la consulta: mirar como quedo un pop-up no puede ensuciarle las
 * estadisticas al estudio ni mandarle un mail con datos inventados.
 */
export default async function Preview({
  params,
}: {
  params: Promise<{ tipo: string; id: string }>;
}) {
  const { tipo, id } = await params;
  if (tipo !== "popup" && tipo !== "clip") notFound();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { firm } = await activeFirm();

  // El widget se identifica solo con su id, asi que hay que comprobar acá que
  // sea de este estudio: si no, con el id a mano se veria el de otro.
  const tabla = tipo === "popup" ? "popups" : "clips";
  const [w] = await sql<{ name: string; active: boolean }[]>`
    select name, active from ${sql(tabla)} where id = ${id} and firm_id = ${firm.id}`;
  if (!w) notFound();

  const volver = tipo === "popup" ? "/popups" : "/clips";

  return (
    <div className="pv">
      <div className="pv-barra">
        <div>
          <strong>{w.name}</strong>
          <span>
            Vista previa sobre un sitio de ejemplo. Nada de lo que hagas acá se registra ni le llega
            al estudio.
          </span>
        </div>
        <div className="pv-acciones">
          {!w.active && <span className="pv-pausado">Está pausado: en el sitio real no se vería</span>}
          <a href={volver}>← Volver</a>
        </div>
      </div>

      {/* Decorado: un sitio de estudio cualquiera, para ver el widget en contexto. */}
      <div className="pv-sitio" aria-hidden="true">
        <header>
          <span className="pv-logo">Estudio Jurídico</span>
          <nav><span>Inicio</span><span>El estudio</span><span>Áreas</span><span>Contacto</span></nav>
        </header>

        <section className="pv-hero">
          <h1>Defendemos tus derechos</h1>
          <p>Más de 20 años acompañando a personas y empresas en toda la Ciudad de Buenos Aires.</p>
          <span className="pv-btn">Conocenos</span>
        </section>

        <section className="pv-areas">
          {["Derecho Laboral", "Familia", "Sucesiones", "Accidentes"].map((a) => (
            <div key={a}><h3>{a}</h3><p>Asesoramiento integral y representación judicial.</p></div>
          ))}
        </section>

        <section className="pv-texto">
          <h2>Cómo trabajamos</h2>
          {[0, 1, 2].map((i) => (
            <p key={i}>
              Analizamos cada caso en detalle antes de recomendar un curso de acción. La primera
              entrevista es sin cargo y sirve para entender la situación y estimar plazos.
            </p>
          ))}
        </section>

        <footer>Estudio Jurídico · Av. Corrientes 1234, CABA · (011) 4000-0000</footer>
      </div>

      {/* El widget real, con la configuración guardada. */}
      {/*
        El w.js se cachea un minuto y lleva la configuracion adentro. En la
        vista previa eso es inaceptable: cambiar un ajuste y ver el anterior
        hace pensar que no se guardo. El parametro suelta el cache.
      */}
      <script async src={`/w.js?${tipo}=${id}&preview=1&t=${Date.now()}`} />
    </div>
  );
}
