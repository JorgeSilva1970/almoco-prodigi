// app.js
// ----------------------------------------------------
// Aplicação Almoço Prodigi 2025/2026
// Express + Handlebars + MailerSend (API HTTP, sem SMTP)
// ----------------------------------------------------

import express from 'express';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import session from 'express-session';
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';

// ----------------------------------------------------
// VARIÁVEIS DE AMBIENTE
// ----------------------------------------------------

dotenv.config();

const PORT = process.env.PORT || 3000;

// email de origem usado nos envios (tem de existir no MailerSend)
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.ADMIN_EMAIL;

// URL base do site (produção ou localhost)
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ----------------------------------------------------
// CRIAR APP EXPRESS
// ----------------------------------------------------

const app = express();

// ----------------------------------------------------
// CONFIGURAÇÃO DO MAILERSEND (API TOKEN HTTP)
// ----------------------------------------------------

const mailersend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_TOKEN, // definir no .env / Render
});

const defaultFrom = new Sender(FROM_EMAIL, 'Almoço Prodigi');

// Função utilitária para enviar um email via MailerSend
async function enviarEmail(toEmail, toNome, assunto, textBody, htmlBody) {
  const recipients = [new Recipient(toEmail, toNome)];

  const emailParams = new EmailParams()
    .setFrom(defaultFrom)
    .setTo(recipients)
    .setSubject(assunto)
    .setText(textBody)
    .setHtml(htmlBody);

  await mailersend.email.send(emailParams);
}

// ----------------------------------------------------
// CONFIG SESSION (para login admin)
// ----------------------------------------------------

app.use(session({
  secret: process.env.SESSION_SECRET || 'muda-este-segredo-em-producao',
  resave: false,
  saveUninitialized: false
}));

// ----------------------------------------------------
// CONFIGURAÇÃO DO EXPRESS
// ----------------------------------------------------

app.set('view engine', 'hbs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ----------------------------------------------------
// "BASE DE DADOS" EM FICHEIROS JSON
// ----------------------------------------------------

const DB_FILE = './inscricoes.json';
const DIST_CONC_FILE = './Lista_distrito_concelho.json';

let inscricoes = [];
let proximoId = 1;

let distritosConcelhos = [];
let concelhosPorDistrito = {};

// Carrega lista de distritos/concelhos
async function carregarDistritosConcelhos() {
  try {
    const data = await fs.readFile(DIST_CONC_FILE, 'utf-8');
    distritosConcelhos = JSON.parse(data);

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

// Carrega inscrições do ficheiro JSON
async function carregarInscricoes() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    inscricoes = JSON.parse(data);

    const maxId = inscricoes.reduce((max, i) => i.id > max ? i.id : max, 0);
    proximoId = maxId + 1;
  } catch (err) {
    console.log('A iniciar BD de inscrições:', err.message);
    inscricoes = [];
    proximoId = 1;
    await guardarInscricoes();
  }
}

// Guarda inscrições no ficheiro JSON
async function guardarInscricoes() {
  await fs.writeFile(DB_FILE, JSON.stringify(inscricoes, null, 2), 'utf-8');
}

// Data/hora do evento (para o contador regressivo)
const EVENTO_DATA = '2026-02-21T13:00:00'; // ajusta aqui se muda a data

// Middleware simples para proteger rotas admin
function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }
  next();
}

// ----------------------------------------------------
// ROTAS PÚBLICAS
// ----------------------------------------------------

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
    titulo: 'Onde e Quando',
  });
});

// Menus e Preços
app.get('/menus', (req, res) => {
  res.render('menus', {
    titulo: 'Menus e Preços',
  });
});

// Formulário de inscrição
app.get('/inscricao', (req, res) => {
  const distritos = distritosConcelhos.map(dc => dc.distrito);

  res.render('inscricao', {
    titulo: 'Inscrição',
    distritos,
    emailOrganizador: FROM_EMAIL,
    telemovelOrganizador: '+351 917 039 719'
  });
});

// Página para mostrar formulário de anulação por email
app.get('/anular', (req, res) => {
  res.render('cancelar', {
    titulo: 'Anulação de Inscrição'
  });
});

// API para popular concelhos por distrito (AJAX)
app.get('/api/concelhos', (req, res) => {
  res.json(concelhosPorDistrito);
});

// Galeria "Relembrar os bons momentos"
app.get('/galeria', (req, res) => {
  const fotos = [
    {
      url: '/img/Aula_1.jpg',
      legenda: 'Primeiros dias na Prodigi – nervos, expectativas e muitos sonhos'
    },
    {
      url: '/img/Aula_2.jpg',
      legenda: 'Momentos de aprendizagem intensa e entreajuda'
    },
    {
      url: '/img/Aula_3.jpg',
      legenda: 'Trabalhos, desafios e conquistas partilhadas'
    },
    {
      url: '/img/Aula_4.jpg',
      legenda: 'Uma turma que fica para a vida'
    }
  ];

  res.render('galeria', {
    titulo: 'Galeria – Relembrar os Bons Momentos Académicos',
    fotos
  });
});

// Contacto do organizador
app.get('/contacto', (req, res) => {

  const organizadores = [
    {
      nome: 'Jorge Silva',
      email: process.env.ADMIN_EMAIL || 'jorge.28.silva.sam@gmail.com',
      telefone: '+351 917 039 719'
    },
    {
      nome: 'Jorge Luis',
      email: 'jpluis2@gmail.com',
      telefone: '+351 965 879 695'
    }
  ];

  // Apenas inscritos ativos
  let contactosInscritos = inscricoes.filter(i => !i.cancelado);

  // Ordenar alfabeticamente por nome
  contactosInscritos.sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' })
  );

  res.render('contacto', {
    titulo: 'Contactos',
    organizadores,
    contactosInscritos
  });
});

// Alojamento
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

// Lista pública de inscritos (sem detalhes de menus)
app.get('/lista', (req, res) => {
  const ativos = inscricoes.filter(i => !i.cancelado);
  const contador = ativos.length;

  res.render('lista', {
    titulo: 'Lista de Inscritos',
    inscritos: ativos,
    contador
  });
});

// ----------------------------------------------------
// ROTAS DE INSCRIÇÃO (POST + ANULAÇÃO)
// ----------------------------------------------------

// Receber dados do formulário de inscrição (POST)
app.post('/inscricao', async (req, res) => {
  const {
    nome,
    telefone,
    email,
    distrito,
    concelho,
    menu,          // geral (ex: "Menu Adulto")
    pratoPeixe,
    pratoCarne,
    sobremesa
  } = req.body;

  if (!nome || !telefone || !email || !distrito || !concelho || !menu ||
      !pratoPeixe || !pratoCarne || !sobremesa) {
    return res.status(400).render('confirmacao', {
      titulo: 'Erro na Inscrição',
      erro: 'Por favor preenche todos os campos obrigatórios (incluindo as escolhas do menu).'
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

  inscricoes.push(novaInscricao);
  await guardarInscricoes();

  const cancelLink = `${BASE_URL}/anular/${novaInscricao.id}`;

  const resumoMenu = `
Menu escolhido: ${novaInscricao.menu}
Peixe: ${novaInscricao.pratoPeixe}
Carne: ${novaInscricao.pratoCarne}
Sobremesa: ${novaInscricao.sobremesa}
`.trim();

  const textoParticipante = `Olá ${novaInscricao.nome},

A tua inscrição para o Almoço/Jantar de Turma Prodigi 2025 foi registada com sucesso.

${resumoMenu}

Se, por algum motivo, precisares de anular a tua presença, usa o link seguinte:
${cancelLink}

Obrigado e até breve!`;

  const htmlParticipante = `
    <p>Olá <strong>${novaInscricao.nome}</strong>,</p>
    <p>A tua inscrição para o <strong>Almoço/Jantar de Turma Prodigi 2025</strong> foi registada com sucesso.</p>
    <h4>Resumo do menu escolhido</h4>
    <ul>
      <li><strong>Menu:</strong> ${novaInscricao.menu}</li>
      <li><strong>Peixe:</strong> ${novaInscricao.pratoPeixe}</li>
      <li><strong>Carne:</strong> ${novaInscricao.pratoCarne}</li>
      <li><strong>Sobremesa:</strong> ${novaInscricao.sobremesa}</li>
    </ul>
    <p>Se precisares de anular a tua presença, clica neste link:</p>
    <p><a href="${cancelLink}">${cancelLink}</a></p>
    <p>Obrigado e até breve!</p>
  `;

  const textoAdmin = `Nova inscrição registada:

Nome: ${novaInscricao.nome}
Email: ${novaInscricao.email}
Telefone: ${novaInscricao.telefone}
Distrito: ${novaInscricao.distrito}
Concelho: ${novaInscricao.concelho}

${resumoMenu}

ID: ${novaInscricao.id}
`;

  const htmlAdmin = `
    <h3>Nova inscrição registada</h3>
    <p><strong>Nome:</strong> ${novaInscricao.nome}</p>
    <p><strong>Email:</strong> ${novaInscricao.email}</p>
    <p><strong>Telefone:</strong> ${novaInscricao.telefone}</p>
    <p><strong>Distrito:</strong> ${novaInscricao.distrito}</p>
    <p><strong>Concelho:</strong> ${novaInscricao.concelho}</p>
    <h4>Menu</h4>
    <ul>
      <li><strong>Menu:</strong> ${novaInscricao.menu}</li>
      <li><strong>Peixe:</strong> ${novaInscricao.pratoPeixe}</li>
      <li><strong>Carne:</strong> ${novaInscricao.pratoCarne}</li>
      <li><strong>Sobremesa:</strong> ${novaInscricao.sobremesa}</li>
    </ul>
    <p><strong>ID:</strong> ${novaInscricao.id}</p>
  `;

  try {
    await Promise.all([
      enviarEmail(
        novaInscricao.email,
        novaInscricao.nome,
        'Confirmação de inscrição - Almoço Prodigi 2025',
        textoParticipante,
        htmlParticipante
      ),
      enviarEmail(
        process.env.ADMIN_EMAIL,
        'Organizador',
        'Nova inscrição - Almoço Prodigi 2025',
        textoAdmin,
        htmlAdmin
      )
    ]);
  } catch (err) {
    console.error('Erro ao enviar email(s):', err);
  }

  res.render('confirmacao', {
    titulo: 'Inscrição Confirmada',
    nome: novaInscricao.nome,
    email: novaInscricao.email,
    id: novaInscricao.id
  });
});

// Cancelar inscrição via link com ID
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

// Anular inscrição usando o email
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

// ----------------------------------------------------
// ROTAS ADMIN (PROTEGIDAS COM LOGIN)
// ----------------------------------------------------

// Painel admin
app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin', {
    titulo: 'Painel de Administração',
    inscricoes
  });
});

// Login admin
app.get('/admin/login', (req, res) => {
  res.render('admin-login', {
    titulo: 'Login de Administração'
  });
});

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

// Logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Exportar CSV com menus detalhados
app.get('/admin/export-csv', requireAdmin, (req, res) => {
  const ativos = inscricoes.filter(i => !i.cancelado);

  const header = 'Nome;Email;Telefone;Distrito;Concelho;Menu;Peixe;Carne;Sobremesa\n';
  const linhas = ativos.map(i =>
    `${i.nome};${i.email};${i.telefone};${i.distrito};${i.concelho};${i.menu};${i.pratoPeixe};${i.pratoCarne};${i.sobremesa}`
  );
  const csv = header + linhas.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="inscricoes_prodigi.csv"');
  res.send(csv);
});

// Enviar email de recordatório para todos os inscritos ativos
app.post('/admin/enviar-recordatorio', requireAdmin, async (req, res) => {
  const { mensagemExtra } = req.body || {};

  const ativos = inscricoes.filter(i => !i.cancelado);

  if (ativos.length === 0) {
    return res.render('admin', {
      titulo: 'Painel de Administração',
      inscricoes,
      erro: 'Não há inscritos ativos para enviar o recordatório.'
    });
  }

  const dataEvento = new Date(EVENTO_DATA);
  const dataFormatada = dataEvento.toLocaleDateString('pt-PT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const horaFormatada = dataEvento.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const envios = ativos.map((inscricao) => {
    const cancelLink = `${BASE_URL}/anular/${inscricao.id}`;

    const textoExtra = mensagemExtra
      ? `\n\nMensagem do organizador:\n${mensagemExtra}`
      : '';

    const textBody = `Olá ${inscricao.nome},

O nosso Almoço da Turma Prodigi aproxima-se!

📅 Data: ${dataFormatada}
🕒 Hora: ${horaFormatada}

Contamos contigo!

Se, por algum motivo, precisares de anular a tua presença, podes usar este link:
${cancelLink}${textoExtra}

Um abraço,
A organização`;

    const htmlBody = `
      <p>Olá <strong>${inscricao.nome}</strong>,</p>
      <p>O nosso <strong>Almoço da Turma Prodigi</strong> está a aproximar-se!</p>
      <p>
        📅 <strong>Data:</strong> ${dataFormatada}<br>
        🕒 <strong>Hora:</strong> ${horaFormatada}
      </p>
      <p>Contamos contigo!</p>
      <p>Se precisares de anular a tua presença, podes usar este link:</p>
      <p><a href="${cancelLink}">${cancelLink}</a></p>
      ${mensagemExtra ? `<hr><p><strong>Mensagem do organizador:</strong><br>${mensagemExtra}</p>` : ''}
      <p>Um abraço,<br>A organização</p>
    `;

    return enviarEmail(
      inscricao.email,
      inscricao.nome,
      'Recordatório - Almoço Prodigi 2025',
      textBody,
      htmlBody
    );
  });

  try {
    await Promise.all(envios);

    res.render('admin', {
      titulo: 'Painel de Administração',
      inscricoes,
      msg: `Recordatório enviado para ${ativos.length} inscrito(s).`
    });
  } catch (err) {
    console.error('Erro a enviar recordatórios:', err);
    res.render('admin', {
      titulo: 'Painel de Administração',
      inscricoes,
      erro: 'Ocorreu um erro ao enviar alguns emails de recordatório. Vê o log do servidor.'
    });
  }
});

// ----------------------------------------------------
// ROTA /test-email (para testar MailerSend API)
// ----------------------------------------------------

app.get('/test-email', async (req, res) => {
  try {
    await enviarEmail(
      process.env.ADMIN_EMAIL,
      'Organizador',
      'Teste de email - Almoço Prodigi',
      'Este é um email de teste vindo do servidor Node + MailerSend.',
      '<p>Este é um <strong>email de teste</strong> vindo do servidor Node + MailerSend.</p>'
    );

    console.log('Email de teste enviado com sucesso.');
    res.send('Email de teste enviado. Verifica a tua caixa de entrada.');
  } catch (err) {
    console.error('Erro ao enviar email de teste:', err);
    res.status(500).send('Erro ao enviar email de teste. Vê o terminal para detalhes.');
  }
});

// ----------------------------------------------------
// ARRANCAR SERVIDOR
// ----------------------------------------------------

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