// Contador regressivo
// Contador regressivo
function iniciarContador() {
  const alvoStr = window.DATA_EVENTO;
  if (!alvoStr) return;

  // Ajusta aqui o ID conforme o teu HTML: 'contador-texto' ou 'contador'
  const elemento = document.getElementById('contador-texto');
  if (!elemento) return;

  const dataEvento = new Date(alvoStr);

  function atualizar() {
    const agora = new Date();
    const diff = dataEvento - agora;

    if (diff <= 0) {
      elemento.textContent = 'É hoje! 🎉';
      clearInterval(timer);
      return;
    }

    const totalSeg = Math.floor(diff / 1000);
    const dias     = Math.floor(totalSeg / 86400);
    const horas    = Math.floor((totalSeg % 86400) / 3600);
    const minutos  = Math.floor((totalSeg % 3600) / 60);

    elemento.textContent = `${dias} dias, ${horas} horas e ${minutos} minutos`;
  }

  atualizar();                       // atualiza logo ao carregar
  const timer = setInterval(atualizar, 60000); // atualiza de minuto a minuto
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

  carregarConcelhos()
    .then(() => {
      ligarDistritoConcelho();
    })
    .catch(err => {
      console.error('Erro ao inicializar selects de concelhos:', err);
    });
});