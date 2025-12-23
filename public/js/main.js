// Contador regressivo (badges)
function iniciarContador() {
  const alvoStr = window.DATA_EVENTO;
  if (!alvoStr) return;

  const dataEvento = new Date(alvoStr);

  const elSemanas = document.getElementById('c-semanas');
  const elDias = document.getElementById('c-dias');
  const elHoras = document.getElementById('c-horas');
  const elMinutos = document.getElementById('c-minutos');
  const elMsg = document.getElementById('contador-msg');

  if (!elSemanas || !elDias || !elHoras || !elMinutos) return;

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function atualizar() {
    const agora = new Date();
    let diff = dataEvento - agora;

    if (diff <= 0) {
      elSemanas.textContent = '0';
      elDias.textContent = '0';
      elHoras.textContent = '00';
      elMinutos.textContent = '00';
      if (elMsg) elMsg.textContent = 'É hoje! 🎉';
      clearInterval(timer);
      return;
    }

    const totalMin = Math.floor(diff / 60000); // minutos
    const totalHoras = Math.floor(totalMin / 60);
    const totalDias = Math.floor(totalHoras / 24);

    const semanas = Math.floor(totalDias / 7);
    const dias = totalDias % 7;
    const horas = totalHoras % 24;
    const minutos = totalMin % 60;

    elSemanas.textContent = String(semanas);
    elDias.textContent = String(dias);
    elHoras.textContent = pad2(horas);
    elMinutos.textContent = pad2(minutos);

    if (elMsg) elMsg.textContent = ''; // limpa mensagem
  }

  atualizar();
  const timer = setInterval(atualizar, 1000);
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
    .then(() => ligarDistritoConcelho())
    .catch(err => console.error('Erro ao inicializar selects de concelhos:', err));
});