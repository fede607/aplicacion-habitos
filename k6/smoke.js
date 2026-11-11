// Prueba de carga suave de Year Arc en Grafana Cloud k6.
// Sólo visita páginas públicas: no crea cuentas, no envía formularios ni escribe en la base de datos.
// Ejecutar: k6 cloud run k6/smoke.js
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://winterarc-2026.vercel.app";

const PAGES = ["/", "/login", "/register", "/privacidad", "/terminos"];

export const options = {
  cloud: {
    projectID: 8501122,
    name: "Year Arc - smoke público",
    distribution: {
      ashburn: { loadZone: "amazon:us:ashburn", percent: 100 },
    },
  },
  // ~2 min y como mucho 10 usuarios virtuales (cabe de sobra en el plan gratuito).
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 10 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"], // menos de un 1 % de errores
    http_req_duration: ["p(95)<1500"], // el 95 % por debajo de 1,5 s (incluye el viaje EE. UU.–Dublín)
  },
};

export default function () {
  for (const path of PAGES) {
    const res = http.get(`${BASE_URL}${path}`, { tags: { page: path }, redirects: 0 });
    check(res, {
      [`${path} responde 200`]: (r) => r.status === 200,
    });
    sleep(1 + Math.random() * 2); // pausa de 1-3 s, como una persona leyendo
  }
}
