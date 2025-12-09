// Contador regressivo
function iniciarContador() {
  if (!window.DATA_EVENTO) return;

  const elemento = document.getElementById('contador-texto');
  if (!elemento) return;

  const dataEvento = new Date(window.DATA_EVENTO);

  function atualizar() {
    const agora = new Date();
    const diffMs = dataEvento - agora;

    if (diffMs <= 0) {
      elemento.textContent = 'O grande dia chegou!';
      return;
    }

    const segundos = Math.floor(diffMs / 1000);
    const dias = Math.floor(segundos / (3600 * 24));
    const horas = Math.floor((segundos % (3600 * 24)) / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);

    elemento.textContent = `${dias} dias, ${horas} horas e ${minutos} minutos`;
  }

  atualizar();
  setInterval(atualizar, 60000); // atualiza a cada minuto
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