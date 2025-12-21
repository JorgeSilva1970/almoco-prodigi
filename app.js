import express from 'express';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import session from 'express-session';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- CONFIG SMTP (MailerSend) ----------

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,         // smtp.mailersend.net
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,                       // STARTTLS em 587
  auth: {
    user: process.env.SMTP_USER,       // API Key MailerSend
    pass: process.env.SMTP_PASS        // Secret Key MailerSend
  }
});

const FROM_EMAIL = process.env.FROM_EMAIL || process.env.ADMIN_EMAIL;
const BASE_URL   = process.env.BASE_URL || `http://localhost:${PORT}`;

// ---------- CONFIG SESSION (para login admin) ----------

app.use(session({
  secret: process.env.SESSION_SECRET || 'muda-este-segredo-em-producao',
  resave: false,
  saveUninitialized: false
}));

// ---------- CONFIGURAÇÃO DO EXPRESS ----------

// motor de views (hbs -> Handlebars)
app.set('view engine', 'hbs');

// para ler dados de formulários (POST)
app.use(express.urlencoded({ extended: true }));

// para servir ficheiros estáticos (CSS, JS, imagens)
app.use(express.static('public'));

// --------- "BASE DE DADOS" EM FICHEIRO JSON ----------

const DB_FILE = './inscricoes.json';
const DIST_CONC_FILE = './Lista_distrito_concelho.json';

let inscricoes = [];
let proximoId = 1;

let distritosConcelhos = [];
let concelhosPorDistrito = {};

// Data/hora do evento (para o contador e recordatório)
const EVENTO_DATA = '2026-02-21T13:00:00'; // 21 Fevereiro 2026, 13h00

// Menu completo (para página de menus + selects da inscrição)
const MENU_COMPLETO = {
  entradas: [
    'Pão, azeitonas temperadas, tábua de queijos e enchidos',
    'Rissóis de camarão, rolinhos de linguiça'
  ],
  sopa: 'Sopa de legumes',
  peixe: [
    'Bacalhau à Dona São',
    'Bacalhau com broa de milho e batata a murro',
    'Arroz de tamboril com marisco (+3€ por pessoa)'
  ],
  carne: [
    'Lombinhos de porco com pêssego e ameixa com molho de cogumelos',
    'Lombinhos de porco fritos com castanhas',
    'Vitela assada no forno com legumes'
  ],
  sobremesas: [
    'Pijaminha de frutas com gelado e chocolate quente',
    'Semi-frio de frutos silvestres',
    'Crepe com gelado de nata e chocolate quente',
    'Profiteroles com gelado e chocolate quente'
  ],
  precoPorPessoa: '35,00 €',
  criancas4a10: '50%',
  criancasAte4: 'Grátis'
};

// ---------- FUNÇÕES AUXILIARES ----------

async function carregarDistritosConcelhos() {
  try {
    const data = await fs.readFile(DIST_CONC_FILE, 'utf-8');
    distritosConcelhos = JSON.parse(data);

    // construir um mapa { "Aveiro": [ "Águeda", ... ], ... }
    concelhosPorDistrito = {};
    distritosConcelhos.forEach(entry => {
      concelhosPorDistrito[entry.distrito] = entry.concelhos;
    });
  } catch (err) {
    console.error('Erro a ler lista de distritos/concelhos:', err.message);
    distritosConcelhos = [];
    concelhosPorDistrito = {};
  }
}

async function carregarInscricoes() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    inscricoes = JSON.parse(data);

    // calcular próximo ID
    const maxId = inscricoes.reduce((max, i) => i.id > max ? i.id : max, 0);
    proximoId = maxId + 1;
  } catch (err) {
    // se ficheiro não existir ou estiver vazio, começamos do zero
    console.log('A iniciar BD de inscrições:', err.message);
    inscricoes = [];
    proximoId = 1;
    await guardarInscricoes();
  }
}

async function guardarInscricoes() {
  await fs.writeFile(DB_FILE, JSON.stringify(inscricoes, null, 2), 'utf-8');
}

// resumo de menus para o restaurante (apenas inscrições ativas)
function gerarResumoMenus(lista) {
  const ativos = lista.filter(i => !i.cancelado);

  const contar = (campo) => {
    const mapa = {};
    ativos.forEach(i => {
      const valor = i[campo];
      if (!valor) return;
      mapa[valor] = (mapa[valor] || 0) + 1;
    });
    return mapa;
  };

  return {
    peixe: contar('pratoPeixe'),
    carne: contar('pratoCarne'),
    sobremesa: contar('sobremesa')
  };
}

// middleware de proteção de rotas admin
function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }
  next();
}

// ---------- ROTAS PÚBLICAS ----------

// Página inicial
app.get('/', (req, res) => {
  res.render('home', {
    titulo: 'Almoço de Turma Prodigi 2025',
    dataEvento: EVENTO_DATA
  });
});

// Onde e quando
app.get('/onde-quando', (req, res) => {
  res.render('onde-quando', {
    titulo: 'Onde e Quando'
  });
});

// Menus e Preços
app.get('/menus', (req, res) => {
  res.render('menus', {
    titulo: 'Menus & Preços',
    menu: MENU_COMPLETO
  });
});

// Formulário de inscrição
app.get('/inscricao', (req, res) => {
  const distritos = distritosConcelhos.map(dc => dc.distrito);

  res.render('inscricao', {
    titulo: 'Inscrição',
    distritos,
    opcoesPeixe: MENU_COMPLETO.peixe,
    opcoesCarne: MENU_COMPLETO.carne,
    opcoesSobremesa: MENU_COMPLETO.sobremesas,
    emailOrganizador: process.env.ADMIN_EMAIL || process.env.FROM_EMAIL || 'jorge.28.silva.sam@gmail.com',
    telemovelOrganizador: '+351 917 039 719'
  });
});

app.get('/api/concelhos', (req, res) => {
  // devolve algo como { "Aveiro": ["Águeda", ...], "Beja": [...] }
  res.json(concelhosPorDistrito);
});

// Galeria "Relembrar os velhos tempos"
app.get('/galeria', (req, res) => {
  const fotos = [
    { url: 'https://via.placeholder.com/300x200?text=Turma+1', legenda: 'Primeiro dia de aulas' },
    { url: 'https://via.placeholder.com/300x200?text=Turma+2', legenda: 'Projeto final' },
    { url: 'https://via.placeholder.com/300x200?text=Turma+3', legenda: 'Momentos Prodigi' }
  ];

  res.render('galeria', {
    titulo: 'Relembrar os Velhos Tempos',
    fotos
  });
});

// Contacto do organizador
app.get('/contacto', (req, res) => {
  // 1) Organizador(es)
  const organizadores = [
    {
      nome: 'Jorge Silva',
      email: process.env.ADMIN_EMAIL || 'jorge.28.silva.sam@gmail.com',
      telefone: '+351 917 039 719'
    }
  ];

  // 2) Contactos dos inscritos (só os ativos, não cancelados)
  const contactosInscritos = inscricoes.filter(i => !i.cancelado);

  res.render('contacto', {
    titulo: 'Contactos',
    organizadores,
    contactosInscritos
  });
});

// Sugestão de alojamento
app.get('/alojamento', (req, res) => {
  const hoteis = [
    {
      nome: 'Promar - Eco Beach & Spa Hotel',
      distancia: '15 minutos de carro',
      link: 'https://www.booking.com/hotel/pt/promarportonovohotelarialda.pt-pt.html'
    },
    {
      nome: 'Hotel Golf Mar',
      distancia: '12 minutos de carro',
      link: 'https://www.booking.com/hotel/pt/golf-mar.pt-pt.html'
    },
    {
      nome: 'Areias do Seixo Hotel',
      distancia: '20 minutos de carro',
      link: 'https://www.booking.com/hotel/pt/areias-do-seixo.pt-pt.html'
    }
  ];

  res.render('alojamento', {
    titulo: 'Sugestões de Alojamento',
    hoteis
  });
});

// ---------- ROTAS DE INSCRIÇÃO (POST / CANCELAR) ----------

app.post('/inscricao', async (req, res) => {
  const {
    nome,
    telefone,
    email,
    distrito,
    concelho,
    menu,
    pratoPeixe,
    pratoCarne,
    sobremesa
  } = req.body;

  if (!nome || !telefone || !email || !distrito || !concelho || !menu) {
    return res.status(400).render('confirmacao', {
      titulo: 'Erro na Inscrição',
      erro: 'Por favor preenche todos os campos obrigatórios.'
    });
  }

  const novaInscricao = {
    id: proximoId++,
    nome,
    telefone,
    email,
    distrito,
    concelho,
    menu,
    pratoPeixe,
    pratoCarne,
    sobremesa,
    cancelado: false,
    criadoEm: new Date()
  };

  // Guarda em memória
  inscricoes.push(novaInscricao);

  // Guarda no ficheiro JSON
  await guardarInscricoes();

  // ----- EMAILS -----
  const cancelLink = `${BASE_URL}/anular/${novaInscricao.id}`;

  // Email para o participante
  const mailParaParticipante = {
    from: `"Almoço Prodigi" <${FROM_EMAIL}>`,
    to: novaInscricao.email,
    subject: 'Confirmação de inscrição - Almoço Prodigi 2025',
    text: `Olá ${novaInscricao.nome},

A tua inscrição para o Almoço/Jantar de Turma Prodigi 2025 foi registada com sucesso.

Resumo da tua escolha de menu:
- Prato de peixe:   ${novaInscricao.pratoPeixe || 'n/d'}
- Prato de carne:   ${novaInscricao.pratoCarne || 'n/d'}
- Sobremesa:        ${novaInscricao.sobremesa || 'n/d'}

Se, por algum motivo, precisares de anular a tua presença, usa o link seguinte:
${cancelLink}

Obrigado e até breve!`,
    html: `
      <p>Olá <strong>${novaInscricao.nome}</strong>,</p>
      <p>A tua inscrição para o <strong>Almoço/Jantar de Turma Prodigi 2025</strong> foi registada com sucesso.</p>

      <h4>Resumo da tua escolha de menu:</h4>
      <ul>
        <li><strong>Prato de peixe:</strong> ${novaInscricao.pratoPeixe || 'n/d'}</li>
        <li><strong>Prato de carne:</strong> ${novaInscricao.pratoCarne || 'n/d'}</li>
        <li><strong>Sobremesa:</strong> ${novaInscricao.sobremesa || 'n/d'}</li>
      </ul>

      <p>Se precisares de anular a tua presença, clica neste link:</p>
      <p><a href="${cancelLink}">${cancelLink}</a></p>
      <p>Obrigado e até breve!</p>
    `
  };

  // Email para o admin
  const mailParaAdmin = {
    from: `"Almoço Prodigi" <${FROM_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: 'Nova inscrição - Almoço Prodigi 2025',
    text: `Nova inscrição registada:

Nome: ${novaInscricao.nome}
Email: ${novaInscricao.email}
Telefone: ${novaInscricao.telefone}
Distrito: ${novaInscricao.distrito}
Concelho: ${novaInscricao.concelho}
Menu escolhido: ${novaInscricao.menu}
Prato de peixe: ${novaInscricao.pratoPeixe || 'n/d'}
Prato de carne: ${novaInscricao.pratoCarne || 'n/d'}
Sobremesa: ${novaInscricao.sobremesa || 'n/d'}
ID: ${novaInscricao.id}
`,
    html: `
      <h3>Nova inscrição registada</h3>
      <p><strong>Nome:</strong> ${novaInscricao.nome}</p>
      <p><strong>Email:</strong> ${novaInscricao.email}</p>
      <p><strong>Telefone:</strong> ${novaInscricao.telefone}</p>
      <p><strong>Distrito:</strong> ${novaInscricao.distrito}</p>
      <p><strong>Concelho:</strong> ${novaInscricao.concelho}</p>
      <p><strong>Menu escolhido:</strong> ${novaInscricao.menu}</p>
      <p><strong>Prato de peixe:</strong> ${novaInscricao.pratoPeixe || 'n/d'}</p>
      <p><strong>Prato de carne:</strong> ${novaInscricao.pratoCarne || 'n/d'}</p>
      <p><strong>Sobremesa:</strong> ${novaInscricao.sobremesa || 'n/d'}</p>
      <p><strong>ID:</strong> ${novaInscricao.id}</p>
    `
  };

  try {
    await Promise.all([
      transporter.sendMail(mailParaParticipante),
      transporter.sendMail(mailParaAdmin)
    ]);
  } catch (err) {
    console.error('Erro ao enviar email(s):', err);
    // Não bloqueia a inscrição; apenas regista o erro
  }

  // Página de confirmação
  res.render('confirmacao', {
    titulo: 'Inscrição Confirmada',
    nome: novaInscricao.nome,
    email: novaInscricao.email,
    id: novaInscricao.id
  });
});

// Lista pública de inscritos
app.get('/lista', (req, res) => {
  const ativos = inscricoes.filter(i => !i.cancelado);
  const contador = ativos.length;

  res.render('lista', {
    titulo: 'Lista de Inscritos',
    inscritos: ativos,
    contador
  });
});

// Página para cancelar inscrição (via link com ID)
app.get('/anular/:id', async (req, res) => {
  const id = Number(req.params.id);
  const inscricao = inscricoes.find(i => i.id === id);

  if (!inscricao) {
    return res.status(404).render('cancelar', {
      titulo: 'Anulação de Inscrição',
      erro: 'Inscrição não encontrada.'
    });
  }

  if (inscricao.cancelado) {
    return res.render('cancelar', {
      titulo: 'Anulação de Inscrição',
      mensagem: 'Esta inscrição já tinha sido anulada anteriormente.'
    });
  }

  inscricao.cancelado = true;
  await guardarInscricoes();

  res.render('cancelar', {
    titulo: 'Anulação de Inscrição',
    mensagem: `Inscrição de ${inscricao.nome} foi anulada com sucesso.`
  });
});

// Anular inscrição usando o email (form na página de cancelamento)
app.post('/anular-por-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).render('cancelar', {
      titulo: 'Anulação de Inscrição',
      erro: 'Tens de indicar o email utilizado na inscrição.'
    });
  }

  const inscricao = inscricoes.find(
    i => i.email.toLowerCase() === email.toLowerCase() && !i.cancelado
  );

  if (!inscricao) {
    return res.status(404).render('cancelar', {
      titulo: 'Anulação de Inscrição',
      erro: 'Não foi encontrada inscrição ativa com esse email.'
    });
  }

  inscricao.cancelado = true;
  await guardarInscricoes();

  res.render('cancelar', {
    titulo: 'Anulação de Inscrição',
    mensagem: `A inscrição de ${inscricao.nome} (${inscricao.email}) foi anulada com sucesso.`
  });
});

// ---------- ROTAS ADMIN (LOGIN, PAINEL, CSV, RECORDATÓRIO) ----------

// Form de login admin
app.get('/admin/login', (req, res) => {
  res.render('admin-login', {
    titulo: 'Login de Administração'
  });
});

// Submeter login admin
app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || 'prodigi2025';

  if (password === adminPass) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }

  res.status(401).render('admin-login', {
    titulo: 'Login de Administração',
    erro: 'Password incorreta.'
  });
});

// Painel admin protegido por login
app.get('/admin', requireAdmin, (req, res) => {
  const resumoMenus = gerarResumoMenus(inscricoes);

  res.render('admin', {
    titulo: 'Painel de Administração',
    inscricoes,
    resumoMenus
  });
});

// Logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Exportar CSV
app.get('/admin/export-csv', requireAdmin, (req, res) => {
  const ativos = inscricoes.filter(i => !i.cancelado);

  const header = 'Nome;Email;Telefone;Distrito;Concelho;Menu;PratoPeixe;PratoCarne;Sobremesa\n';

  const linhas = ativos.map(i =>
    `${i.nome};${i.email};${i.telefone};${i.distrito};${i.concelho};${i.menu};${i.pratoPeixe || ''};${i.pratoCarne || ''};${i.sobremesa || ''}`
  );

  const csv = header + linhas.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="inscricoes_prodigi.csv"');
  res.send(csv);
});

// Enviar recordatório para todos os inscritos ativos
app.post('/admin/enviar-recordatorio', requireAdmin, async (req, res) => {
  try {
    const { mensagemExtra } = req.body || {};
    const ativos = inscricoes.filter(i => !i.cancelado);

    if (ativos.length === 0) {
      return res.render('admin', {
        titulo: 'Painel de Administração',
        inscricoes,
        resumoMenus: gerarResumoMenus(inscricoes),
        erro: 'Não há inscritos ativos para enviar o recordatório.'
      });
    }

    const agora = new Date();
    const dataEvento = new Date(EVENTO_DATA);
    const diffMs = dataEvento - agora;
    const diasFaltam = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    const dataFormatada = dataEvento.toLocaleDateString('pt-PT', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const horaFormatada = dataEvento.toLocaleTimeString('pt-PT', {
      hour: '2-digit', minute: '2-digit'
    });

    const envios = ativos.map(i => {
      const cancelLink = `${BASE_URL}/anular/${i.id}`;

      const textoExtra = mensagemExtra
        ? `\n\nMensagem do organizador:\n${mensagemExtra}`
        : '';

      return transporter.sendMail({
        from: `"Almoço Prodigi" <${FROM_EMAIL}>`,
        to: i.email,
        subject: 'Recordatório - Almoço Prodigi 2025',
        text: `Olá ${i.nome},

O nosso almoço da Turma Prodigi está a aproximar-se!

Faltam aproximadamente ${diasFaltam} dia(s).

📅 Data: ${dataFormatada}
🕒 Hora: ${horaFormatada}

Se precisares de desmarcar a tua presença, podes:
- usar este link: ${cancelLink}
- ou contactar diretamente um dos organizadores.

${textoExtra}

Um abraço,
A organização`,
        html: `
          <p>Olá <strong>${i.nome}</strong>,</p>
          <p>O nosso <strong>almoço da Turma Prodigi</strong> está a aproximar-se!</p>
          <p><strong>Faltam aproximadamente ${diasFaltam} dia(s).</strong></p>
          <p>
            📅 <strong>Data:</strong> ${dataFormatada}<br>
            🕒 <strong>Hora:</strong> ${horaFormatada}
          </p>
          <p>Se precisares de desmarcar a tua presença, podes:</p>
          <ul>
            <li>usar este link: <a href="${cancelLink}">${cancelLink}</a></li>
            <li>ou contactar diretamente um dos organizadores.</li>
          </ul>
          ${mensagemExtra ? `<hr><p><strong>Mensagem do organizador:</strong><br>${mensagemExtra}</p>` : ''}
          <p>Um abraço,<br>A organização</p>
        `
      });
    });

    await Promise.all(envios);

    res.render('admin', {
      titulo: 'Painel de Administração',
      inscricoes,
      resumoMenus: gerarResumoMenus(inscricoes),
      msg: `Recordatório enviado para ${ativos.length} inscrito(s).`
    });
  } catch (err) {
    console.error('Erro a enviar recordatórios:', err);
    res.status(500).render('admin', {
      titulo: 'Painel de Administração',
      inscricoes,
      resumoMenus: gerarResumoMenus(inscricoes),
      erro: 'Ocorreu um erro ao enviar os emails de recordatório.'
    });
  }
});

// ---------- ROTA DE TESTE DE EMAIL ----------

app.get('/test-email', async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: `"Almoço Prodigi" <${FROM_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: 'Teste de email - Almoço Prodigi',
      text: 'Este é um email de teste vindo do servidor Node + MailerSend.',
      html: '<p>Este é um <strong>email de teste</strong> vindo do servidor Node + MailerSend.</p>'
    });

    console.log('Email de teste enviado:', info.messageId || info);
    res.send('Email de teste enviado. Verifica a tua caixa de entrada.');
  } catch (err) {
    console.error('Erro ao enviar email de teste:', err);
    res.status(500).send('Erro ao enviar email de teste. Vê o terminal para detalhes.');
  }
});

// ---------- ARRANCAR SERVIDOR ----------

async function start() {
  await carregarInscricoes();
  await carregarDistritosConcelhos();
  app.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Erro a iniciar servidor:', err);
});