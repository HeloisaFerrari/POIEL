const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Sessão em memória (suficiente para aula)
const sessoes = new Map(); // token -> usuario_id

const db = await mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'poiel_db',
  charset: 'utf8mb4'
});

// ---------- helpers ----------
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const userId = sessoes.get(token);
  if (!userId) return res.status(401).json({ erro: 'Não autenticado' });
  req.userId = userId;
  next();
}

// ---------- cadastro ----------
app.post('/api/cadastro', async (req, res) => {
  const { nome, email, senha } = req.body;
  const mail = (email || '').trim().toLowerCase();
  if (!nome || !mail.includes('@') || (senha || '').length < 6)
    return res.status(400).json({ erro: 'Dados inválidos (senha mín. 6 caracteres).' });

  try {
    const [r] = await db.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)',
      [nome, mail, senha] // hash: veja nota de segurança no fim
    );
    const token = crypto.randomUUID();
    sessoes.set(token, r.insertId);
    res.json({ ok: true, nome, email: mail, token });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ erro: 'Este e-mail já possui conta.' });
    res.status(500).json({ erro: e.message });
  }
});

// ---------- login ----------
app.post('/api/login', async (req, res) => {
  const mail = (req.body.email || '').trim().toLowerCase();
  const [rows] = await db.query(
    'SELECT id, nome, email FROM usuarios WHERE email = ? AND senha = ?',
    [mail, req.body.senha || '']
  );
  const u = rows[0];
  if (!u) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  const token = crypto.randomUUID();
  sessoes.set(token, u.id);
  res.json({ ok: true, nome: u.nome, email: u.email, token });
});

// ---------- contatos ----------
app.get('/api/contatos', auth, async (req, res) => {
  const [rows] = await db.query(
    `SELECT u.id, u.nome, u.email
     FROM contatos c JOIN usuarios u ON u.id = c.contato_id
     WHERE c.usuario_id = ? ORDER BY u.nome`,
    [req.userId]
  );
  res.json({ contatos: rows });
});

app.post('/api/contatos', auth, async (req, res) => {
  const mail = (req.body.email || '').trim().toLowerCase();
  const [rows] = await db.query('SELECT id, nome FROM usuarios WHERE email = ?', [mail]);
  const contato = rows[0];
  if (!contato) return res.status(404).json({ erro: 'Ninguém com esse e-mail está cadastrado.' });
  if (contato.id === req.userId) return res.status(400).json({ erro: 'Esse é você mesmo! 🐱' });

  await db.query(
    'INSERT IGNORE INTO contatos (usuario_id, contato_id) VALUES (?, ?)',
    [req.userId, contato.id]
  );
  res.json({ ok: true, nome: contato.nome, email: mail });
});

// ---------- mensagens ----------
app.get('/api/mensagens', auth, async (req, res) => {
  const mail = (req.query.com || '').toLowerCase();
  const depois = parseInt(req.query.depois || 0);

  const [rows] = await db.query('SELECT id FROM usuarios WHERE email = ?', [mail]);
  if (!rows[0]) return res.status(404).json({ erro: 'Contato não encontrado.' });
  const outroId = rows[0].id;

  const [msgs] = await db.query(
    `SELECT id, remetente_id, texto, data_envio
     FROM mensagens
     WHERE ((remetente_id = ? AND destinatario_id = ?)
         OR (remetente_id = ? AND destinatario_id = ?))
       AND id > ?
     ORDER BY id`,
    [req.userId, outroId, outroId, req.userId, depois]
  );
  res.json({
    mensagens: msgs.map(m => ({
      id: m.id,
      minha: m.remetente_id === req.userId,
      texto: m.texto,
      hora: new Date(m.data_envio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }))
  });
});

app.post('/api/mensagens', auth, async (req, res) => {
  const mail = (req.body.para || '').toLowerCase();
  const [rows] = await db.query('SELECT id FROM usuarios WHERE email = ?', [mail]);
  if (!rows[0]) return res.status(404).json({ erro: 'Contato não encontrado.' });

  const [r] = await db.query(
    'INSERT INTO mensagens (remetente_id, destinatario_id, texto) VALUES (?, ?, ?)',
    [req.userId, rows[0].id, req.body.texto || '']
  );
  res.json({ ok: true, id: r.insertId });
});

app.listen(3000, () => console.log('API POIEL em http://localhost:3000'));