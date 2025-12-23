// Contador regressivo com semanas
function iniciarContador() {
  const alvoStr = window.DATA_EVENTO;
  if (!alvoStr) {
    console.warn('⚠ DATA_EVENTO não definido na página.');
    return;
  }

  const elemento = document.getElementById('contador-texto');
  if (!elemento) {
    console.warn('⚠ Elemento #contador-texto não encontrado.');
    return;
  }

  // Garantir data correta (ISO)
  const dataEvento = new Date(alvoStr);

  function atualizar() {
    const agora = new Date();
    const diff = dataEvento - agora;

    if (diff <= 0) {
      elemento.textContent = 'É hoje! 🎉';
      clearInterval(timer);
      return;
    }

    const totalSegundos = Math.floor(diff / 1000);

    const totalDias = Math.floor(totalSegundos / 86400);
    const semanas = Math.floor(totalDias / 7);
    const dias = totalDias % 7;

    const horas = Math.floor((totalSegundos % 86400) / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    let texto = '';

    if (semanas > 0) texto += `${semanas} semana(s), `;
    texto += `${dias} dia(s), ${horas} hora(s), ${minutos} minuto(s) e ${segundos} segundo(s)`;

    elemento.textContent = texto;
  }

  atualizar();
  const timer = setInterval(atualizar, 1000);

  console.log('⏱ Contador iniciado para:', dataEvento.toISOString());
}

// ---------- Distritos -> Concelhos (via API) ----------
let concelhosPorDistrito = {};

async function carregarConcelhos() {
  try {
    const resp = await fetch('/api/concelhos');
    if (!resp.ok) throw new Error('Erro na API de concelhos');
    concelhosPorDistrito = await resp.json();
  } catch (e) {
    console.error('Erro a carregar concelhos:', e);
    concelhosPorDistrito = {};
  }
}

function ligarDistritoConcelho() {
  const distritoSelect = document.getElementById('distrito');
  const concelhoSelect = document.getElementById('concelho');

  if (!distritoSelect || !concelhoSelect) return;

  distritoSelect.addEventListener('change', () => {
    const distrito = distritoSelect.value;
    const lista = concelhosPorDistrito[distrito] || [];

    concelhoSelect.innerHTML = '';

    if (lista.length === 0) {
      concelhoSelect.innerHTML = '<option value="">Sem concelhos definidos</option>';
      return;
    }

    concelhoSelect.innerHTML = '<option value="">-- Seleciona o concelho --</option>';

    lista.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      concelhoSelect.appendChild(opt);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  iniciarContador();
  carregarConcelhos().then(ligarDistritoConcelho);
});