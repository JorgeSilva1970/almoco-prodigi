// ----------------------------------------------------
// Contador regressivo (corrigido para timezone fixo)
// ----------------------------------------------------

function toZonedTimestamp(isoLocal, timeZone) {
  // isoLocal: "YYYY-MM-DDTHH:mm:ss" (sem offset)
  const [datePart, timePart] = isoLocal.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm, ss] = (timePart || "00:00:00").split(":").map(Number);

  // palpite UTC com os mesmos valores
  const utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss || 0));

  // ver o "utcGuess" no fuso pretendido e obter componentes
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcGuess);

  const get = (type) => parts.find((p) => p.type === type).value;

  const zonedAsIfUTC = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    Number(get("second"))
  );

  const offsetMs = zonedAsIfUTC - utcGuess.getTime();
  return utcGuess.getTime() - offsetMs;
}

function iniciarContador() {
  const alvoStr = window.DATA_EVENTO;
  const timeZone = window.EVENTO_TIMEZONE || "Europe/Lisbon";

  if (!alvoStr) {
    console.warn("⚠ DATA_EVENTO não definido na página.");
    return;
  }

  const elemento = document.getElementById("contador-texto");
  if (!elemento) {
    // não há contador noutras páginas — tudo bem
    return;
  }

  const eventoTs = toZonedTimestamp(alvoStr, timeZone);

  function atualizar() {
    const agora = Date.now();
    let diff = eventoTs - agora;

    if (diff <= 0) {
      elemento.textContent = "É hoje! 🎉";
      clearInterval(timer);
      return;
    }

    // calcula por segundos
    const totalSeg = Math.floor(diff / 1000);
    const dias = Math.floor(totalSeg / 86400);
    const horas = Math.floor((totalSeg % 86400) / 3600);
    const minutos = Math.floor((totalSeg % 3600) / 60);
    const segundos = totalSeg % 60;

    elemento.textContent =
      `${dias} dia(s), ${horas} hora(s), ${minutos} minuto(s) e ${segundos} segundo(s)`;
  }

  atualizar();
  const timer = setInterval(atualizar, 1000);

  console.log("⏱ Contador iniciado para:", alvoStr, "TZ:", timeZone);
}

// ----------------------------------------------------
// Distritos -> Concelhos (via API)
// ----------------------------------------------------

let concelhosPorDistrito = {};

async function carregarConcelhos() {
  try {
    const resp = await fetch("/api/concelhos");
    if (!resp.ok) throw new Error("Erro na API de concelhos");
    concelhosPorDistrito = await resp.json();
  } catch (e) {
    console.error("Erro a carregar concelhos:", e);
    concelhosPorDistrito = {};
  }
}

function ligarDistritoConcelho() {
  const distritoSelect = document.getElementById("distrito");
  const concelhoSelect = document.getElementById("concelho");

  if (!distritoSelect || !concelhoSelect) return;

  distritoSelect.addEventListener("change", () => {
    const distrito = distritoSelect.value;
    const lista = concelhosPorDistrito[distrito] || [];

    concelhoSelect.innerHTML = "";

    if (lista.length === 0) {
      concelhoSelect.innerHTML = '<option value="">Sem concelhos definidos</option>';
      return;
    }

    concelhoSelect.innerHTML = '<option value="">-- Seleciona o concelho --</option>';

    lista.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      concelhoSelect.appendChild(opt);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  iniciarContador();

  carregarConcelhos()
    .then(() => {
      ligarDistritoConcelho();
    })
    .catch((err) => {
      console.error("Erro ao inicializar selects de concelhos:", err);
    });
});