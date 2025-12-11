import express from 'express';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import session from 'express-session';
import { MailerSend, EmailParams, Sender, Recipient } from "@mailersend/mailersend";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,         // smtp.mailersend.net
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // Mailjet usa TLS STARTTLS em 587
  auth: {
    user: process.env.SMTP_USER,      // API Key mailersend
    pass: process.env.SMTP_PASS       // Secret Key mailersend
  }
});

const FROM_EMAIL  = process.env.FROM_EMAIL || process.env.ADMIN_EMAIL;
const BASE_URL    = process.env.BASE_URL || `http://localhost:${PORT}`;

const app = express();
const PORT = 3000;


//----------- CONFIG MAILERSEND TOKEN API ---------------
const mailersend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_TOKEN,
});

const defaultFrom = new Sender("noreply@jorge-silva.com", "mail@jorge-silva.com", "jorge.28.silva.sam@jorge-silva.com");

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

// --------- CONFIG SESSION (para login admin) ----------
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

// --------- "BASE DE DADOS" EM MEMÓRIA (por agora) ----------

// Cada inscrição será um objeto:
// { id, nome, telefone, email, distrito, concelho, menu, cancelado }
//const inscricoes = [];
//let proximoId = 1;

const DB_FILE = './inscricoes.json';
const DIST_CONC_FILE = './Lista_distrito_concelho.json';

let inscricoes = [];
let proximoId = 1;

let distritosConcelhos = [];
let concelhosPorDistrito = {};

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

// Data/hora do evento (para o contador regressivo)
const EVENTO_DATA = '2026-01-10T13:00:00'; // 10 Janeiro 2026, 13h00

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }
  next();
}

// ---------- ROTAS ----------

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
    // usa segundo o FROM_EMAIL (noreply@jorge-silva.com), se existir
    emailOrganizador: process.env.ADMIN_EMAIL || process.env.FROM_EMAIL || 'jorge.28.silva.sam@gmail.com',
    telemovelOrganizador: '+351 917 039 719'
  });
});

app.get('/api/concelhos', (req, res) => {
  // devolve algo como { "Aveiro": ["Águeda", ...], "Beja": [...] }
  res.json(concelhosPorDistrito);
});

// Form de login admin
// Painel admin protegido por login
app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin', {
    titulo: 'Painel de Administração',
    inscricoes
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

// Logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/admin/export-csv', requireAdmin, (req, res) => {
  const ativos = inscricoes.filter(i => !i.cancelado);

  const header = 'Nome;Email;Telefone;Distrito;Concelho;Menu\n';

  const linhas = ativos.map(i =>
    `${i.nome};${i.email};${i.telefone};${i.distrito};${i.concelho};${i.menu}`
  );

  const csv = header + linhas.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="inscricoes_prodigi.csv"');
  res.send(csv);
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
  // 1) Organizador(es) – podes adicionar mais entradas a este array
  const organizadores = [
    {
      nome: 'Jorge Silva',
      email: process.env.ADMIN_EMAIL || 'jorge.28.silva.sam@gmail.com',
      telefone: '+351 917 039 719'
    }
    // Se quiseres mais:
    // { nome: 'Outro Organizador', email: '...', telefone: '...' }
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

// Receber dados do formulário de inscrição (POST)
// Receber dados do formulário de inscrição (POST)
// Receber dados do formulário de inscrição (POST)
app.post('/inscricao', async (req, res) => {
  const { nome, telefone, email, distrito, concelho, menu } = req.body;

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
    cancelado: false,
    criadoEm: new Date()
  };

  // Guarda em memória
  inscricoes.push(novaInscricao);

  // Guarda no ficheiro JSON
  await guardarInscricoes();

  // ----- EMAILS -----
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  const cancelLink = `${baseUrl}/anular/${novaInscricao.id}`;

  // Email para o participante
  const mailParaParticipante = {
    from: `"Almoço Prodigi" <${FROM_EMAIL}>`,
    to: novaInscricao.email,
    subject: 'Confirmação de inscrição - Almoço Prodigi 2025',
    text: `Olá ${novaInscricao.nome},

A tua inscrição para o Almoço/Jantar de Turma Prodigi 2025 foi registada com sucesso.

Se, por algum motivo, precisares de anular a tua presença, usa o link seguinte:
${cancelLink}

Obrigado e até breve!`,
    html: `
      <p>Olá <strong>${novaInscricao.nome}</strong>,</p>
      <p>A tua inscrição para o <strong>Almoço/Jantar de Turma Prodigi 2025</strong> foi registada com sucesso.</p>
      <p>Se precisares de anular a tua presença, clica neste link:</p>
      <p><a href="${cancelLink}">${cancelLink}</a></p>
      <p>Obrigado e até breve!</p>
    `
  };

  // Email para o admin
  const mailParaAdmin = {
    from: `"Almoço Prodigi" <${FROM_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,   // no .env: ADMIN_EMAIL=jorge.28.silva.sam@gmail.com
    subject: 'Nova inscrição - Almoço Prodigi 2025',
    text: `Nova inscrição registada:

Nome: ${novaInscricao.nome}
Email: ${novaInscricao.email}
Telefone: ${novaInscricao.telefone}
Distrito: ${novaInscricao.distrito}
Concelho: ${novaInscricao.concelho}
Menu escolhido: ${novaInscricao.menu}
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
      <p><strong>ID:</strong> ${novaInscricao.id}</p>
    `
  };

  
  try {
    // Envia os dois emails em paralelo
    await Promise.all([
  enviarEmail(
    novaInscricao.email,
    novaInscricao.nome,
    'Confirmação de inscrição - Almoço Prodigi 2025',
    mailParaParticipante.text,
    mailParaParticipante.html
  ),
  enviarEmail(
    process.env.ADMIN_EMAIL,
    'Organizador',
    'Nova inscrição - Almoço Prodigi 2025',
    mailParaAdmin.text,
    mailParaAdmin.html
  )
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

  // 🔹 ponto 1.4: guardar alteração (marca como cancelado no JSON)
  await guardarInscricoes();

  res.render('cancelar', {
    titulo: 'Anulação de Inscrição',
    mensagem: `Inscrição de ${inscricao.nome} foi anulada com sucesso.`
  });
});

// Anular inscrição usando o email (a partir do formulário na própria página)
app.post('/anular-por-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).render('cancelar', {
      titulo: 'Anulação de Inscrição',
      erro: 'Tens de indicar o email utilizado na inscrição.'
    });
  }

  // procura a primeira inscrição ativa com esse email
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
    mensagem: `A inscrição de ${inscricao.nome} ( ${inscricao.email} ) foi anulada com sucesso.`
  });
});

// "Painel" admin simples (sem autenticação, só para testar)
app.get('/admin', (req, res) => {
  res.render('admin', {
    titulo: 'Painel de Administração',
    inscricoes
  });
});

// ---------- ARRANCAR SERVIDOR ----------
//app.listen(PORT, () => {
//  console.log(`Servidor a correr em http://localhost:${PORT}`);
//});

async function start() {
  await carregarInscricoes();
  await carregarDistritosConcelhos();
  app.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
  });
}

app.get('/test-email', async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: `"Almoço Prodigi" <${FROM_EMAIL}>`,
      to: process.env.ADMIN_EMAIL, // envia para ti
      subject: 'Teste de email - Almoço Prodigi',
      text: 'Este é um email de teste vindo do servidor Node + Mailjet.',
      html: '<p>Este é um <strong>email de teste</strong> vindo do servidor Node + Mailjet.</p>'
    });

    console.log('Email de teste enviado:', info.messageId || info);
    res.send('Email de teste enviado. Verifica a tua caixa de entrada.');
  } catch (err) {
    console.error('Erro ao enviar email de teste:', err);
    res.status(500).send('Erro ao enviar email de teste. Vê o terminal para detalhes.');
  }
});

start().catch(err => {
  console.error('Erro a iniciar servidor:', err);
});