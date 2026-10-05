import type { Metadata } from "next";
import { ContactLine, LEGAL_OWNER, LegalPage } from "@/components/legal/legal-page";
import { PRO_MONTH_EUR, PRO_YEAR_EUR } from "@/lib/billing/paypal-me";
import { getPaymentsOpen } from "@/lib/billing/payments";

export const metadata: Metadata = { title: "Términos de uso", robots: { index: true, follow: true } };

export const revalidate = 600;

export default async function TermsPage() {
  const PAYMENTS_OPEN = await getPaymentsOpen();
  return (
    <LegalPage title="Términos de uso">
      <p>
        Year Arc es una app para seguir tus hábitos y tu entrenamiento, ofrecida por {LEGAL_OWNER}. Al crear una cuenta aceptas estos términos.
      </p>

      <h2>1. Cuenta</h2>
      <ul>
        <li>Necesitas al menos 14 años, o el consentimiento de tu madre, padre o tutor.</li>
        <li>Eres responsable de tu contraseña y de lo que se haga con tu cuenta.</li>
        <li>No uses la app para molestar a otros ni para publicar contenido ofensivo o ilegal en nombres de grupos, hábitos u opiniones.</li>
      </ul>

      <h2>2. Plan gratis y Pro</h2>
      <ul>
        <li>El plan gratis incluye tus hábitos, tu racha, tu línea del año y los grupos.</li>
        <li>
          {PAYMENTS_OPEN ? `Pro cuesta ${PRO_MONTH_EUR} €/mes o ${PRO_YEAR_EUR} €/año (IVA incluido) e incluye` : "Pro todavía no está a la venta: antes de cobrar nada avisaremos del precio. Incluye"} el plan de entreno, el registro de entrenos y las
          estadísticas avanzadas. {PAYMENTS_OPEN ? "Las cuentas nuevas tienen 1 mes de Pro gratis, sin tarjeta." : "Mientras no esté a la venta, Pro es gratis para todos."}
        </li>
        <li>Pagas por adelantado. No hay renovación automática salvo que contrates una suscripción de PayPal, que puedes cancelar cuando quieras.</li>
        <li>
          Derecho de desistimiento: tienes 14 días desde el pago para pedir la devolución. Al empezar a usar Pro tras el pago, aceptas que el
          servicio empieza en ese momento; aun así, si no estás conforme, escríbenos y lo estudiamos.
        </li>
      </ul>

      <h2>3. Salud</h2>
      <p>
        El plan de entreno y las cifras de nutrición son orientativos y se generan automáticamente a partir de tus datos. No son consejo médico ni
        sustituyen a un médico, fisioterapeuta, nutricionista o entrenador. Si tienes alguna lesión o condición médica, consúltalo antes de empezar.
        Si algo te produce dolor, para.
      </p>

      <h2>4. Disponibilidad</h2>
      <p>Hacemos lo posible para que la app funcione siempre, pero puede haber cortes o cambios. Podemos mejorar, cambiar o retirar funciones.</p>

      <h2>5. Baja</h2>
      <p>
        Puedes eliminar tu cuenta cuando quieras desde Perfil. Podemos suspender cuentas que incumplan estos términos.
      </p>

      <h2>6. Contacto y ley aplicable</h2>
      <p>
        Escríbenos <ContactLine />. Se aplica la ley española; como consumidor, conservas los derechos que te da la normativa de tu país de
        residencia.
      </p>
    </LegalPage>
  );
}
