import type { Metadata } from "next";
import { ContactLine, LEGAL_OWNER, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Política de privacidad", robots: { index: true, follow: true } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad">
      <p>
        En Year Arc tus datos son tuyos. Aquí explicamos, sin letra pequeña, qué datos usamos, para qué y qué derechos tienes, conforme al Reglamento
        General de Protección de Datos (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).
      </p>

      <h2>1. Responsable</h2>
      <p>
        {LEGAL_OWNER}, responsable de Year Arc. Contacto para cualquier tema de privacidad: <ContactLine />.
      </p>

      <h2>2. Qué datos tratamos y para qué</h2>
      <ul>
        <li>
          <b>Cuenta:</b> email, nombre, nombre de usuario, contraseña y clave de recuperación (ambas cifradas, nunca las vemos) y zona horaria. Para crear y proteger tu cuenta.
        </li>
        <li>
          <b>Uso de la app:</b> tus hábitos, lo que marcas cada día, notas, entrenamientos y grupos. Para darte el servicio (racha, gráficos,
          estadísticas).
        </li>
        <li>
          <b>Datos físicos, que son datos de salud (opcional, sólo Pro):</b> año de nacimiento, sexo, altura, peso, objetivo y molestias (rodilla,
          lumbar, hombro). Sólo si rellenas tu plan de entreno y con tu consentimiento expreso (art. 9.2.a RGPD), únicamente para calcular tu plan.
          Nunca se comparten con tu grupo ni con nadie. Puedes retirarlo cuando quieras en Plan › Cambiar mis datos › Borrar mis datos físicos.
        </li>
        <li>
          <b>Pagos:</b> los gestiona PayPal. Nosotros no vemos ni guardamos tu tarjeta ni tu cuenta; sólo si tu Pro está activo y hasta cuándo.
        </li>
        <li>
          <b>Avisos:</b> si los activas, la suscripción de notificaciones de tu navegador o móvil, para enviarte recordatorios. Se desactivan en un
          toque. Sólo si activas «Novedades y ofertas» (al registrarte o en tu perfil) te enviaremos, como mucho una vez a la semana, avisos de funciones nuevas o
          descuentos de Year Arc (nunca de terceros), marcados como «Publi»; puedes quitarlo cuando quieras. Guardamos cuándo diste o retiraste ese
          consentimiento. Con la suscripción guardamos también el tipo de navegador, para saber a qué dispositivo enviar el aviso. No te enviamos publicidad ni recordatorios por correo: el único
          email que te enviamos es tu clave de recuperación, cuando la creas.
        </li>
        <li>
          <b>Origen del registro:</b> si llegaste desde un enlace de campaña (p. ej. WhatsApp), guardamos ese origen para saber qué funciona. Viaja
          en el propio enlace, sin cookies.
        </li>
        <li>
          <b>Opiniones:</b> tu valoración y tu texto. Sólo se publican en la web, con tu nombre de pila y tu avatar, si marcas la casilla para ello.
        </li>
        <li>
          <b>Seguridad:</b> tu dirección IP, de forma temporal (se borra a los 2 días), para limitar intentos de registro y de acceso, y una
          comprobación anti-bots de Cloudflare al registrarte.
        </li>
        <li>
          <b>Estadísticas de visitas:</b> Vercel Analytics, sin cookies y sin datos que te identifiquen.
        </li>
      </ul>

      <h2>3. Base legal</h2>
      <p>
        La ejecución del servicio que pides al registrarte (art. 6.1.b RGPD), tu consentimiento para los datos físicos y los avisos (arts. 6.1.a y
        9.2.a), que puedes retirar cuando quieras, y nuestro interés legítimo en mantener la app segura y medir qué campañas funcionan (art. 6.1.f).
      </p>

      <h2>4. Edad mínima</h2>
      <p>
        Para registrarte necesitas tener al menos 14 años (art. 7 LOPDGDD). Si tienes menos de 14 no puedes registrarte. Si detectamos una cuenta
        de un menor de 14, la eliminaremos.
      </p>

      <h2>5. Con quién se comparten</h2>
      <p>No vendemos ni cedemos tus datos. Sólo los procesan los proveedores que hacen funcionar la app, con contrato de encargo y garantías del RGPD:</p>
      <ul>
        <li>Supabase (base de datos y cuentas): servidores en la UE (Irlanda).</li>
        <li>Vercel (alojamiento de la web y estadísticas de visitas sin cookies): funciones en la UE (Dublín); empresa de EE. UU. adherida al Marco de Privacidad de Datos UE-EE. UU.</li>
        <li>Cloudflare (comprobación anti-bots al registrarte): EE. UU., adherida al Marco de Privacidad de Datos UE-EE. UU.</li>
        <li>Google (envío del email con tu clave de recuperación): EE. UU., adherida al Marco de Privacidad de Datos UE-EE. UU.</li>
        <li>PayPal (pagos): sólo si pagas Pro.</li>
      </ul>
      <p>
        Dentro de un grupo, los demás miembros sólo ven lo que tú permites en Perfil › Privacidad (por ejemplo, tu porcentaje o tus hábitos). Tus
        notas y datos físicos nunca son visibles para nadie.
      </p>

      <h2>6. Cookies</h2>
      <p>Sólo usamos cookies y almacenamiento técnicos, imprescindibles para que la app funcione. No usamos cookies de publicidad ni de seguimiento:</p>
      <ul>
        <li>Sesión de Supabase: mantener tu sesión iniciada mientras no la cierres.</li>
        <li>«ya_acceso»: recordar durante 14 días la invitación personal que te mandaron, para no perderla si sales del registro. Se borra al entrar.</li>
        <li>Almacenamiento del navegador: recordar que ya cerraste el aviso de instalar la app, el de valorar Year Arc, el de subida de rango ya vista y tu tema claro u oscuro.</li>
      </ul>

      <h2>7. Cuánto tiempo</h2>
      <p>
        Mientras tengas cuenta. Si la eliminas (Perfil › Eliminar cuenta), borramos tus datos de forma permanente; las copias de seguridad del
        proveedor se renuevan solas en unos días. Las IP de seguridad se borran a los 2 días. Si has pagado Pro, el registro del pago se conserva el
        tiempo que exige la ley fiscal.
      </p>

      <h2>8. Tus derechos</h2>
      <p>
        Puedes acceder, rectificar, descargar (Perfil › Tus datos), oponerte, limitar y suprimir tus datos, y retirar tu consentimiento, escribiendo{" "}
        <ContactLine />. Si crees que no lo hemos hecho bien, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).
      </p>
    </LegalPage>
  );
}
