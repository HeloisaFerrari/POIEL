const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Sessões em memória (token -> id_usuario)
const sessoes = new Map();

// Contatos adicionados manualmente (id_usuario -> Set<id_usuario>)
const contatosAdicionados = new Map();

// Configuração da conexão PostgreSQL / Supabase
const db = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'poiel_db'
});

// Gera um ID de sala determinístico (bigint) para qualquer par de usuários
function gerarRoomId(idA, idB) {
  const menor = Math.min(Number(idA), Number(idB));
  const maior = Math.max(Number(idA), Number(idB));
  return menor * 1000000 + maior;
}

// Extrai o ID do outro participante a partir do idchat_rooms
function extrairOutroUsuario(roomId, meuId) {
  const num = Number(roomId);
  const id1 = Math.floor(num / 1000000);
  const id2 = num % 1000000;
  if (id1 === Number(meuId)) return id2;
  if (id2 === Number(meuId)) return id1;
  return null;
}

function vincularContatoMemoria(idA, idB) {
  if (!contatosAdicionados.has(idA)) contatosAdicionados.set(idA, new Set());
  if (!contatosAdicionados.has(idB)) contatosAdicionados.set(idB, new Set());
  contatosAdicionados.get(idA).add(idB);
  contatosAdicionados.get(idB).add(idA);
}

// Garante que a sala exista na tabela public.chat_rooms
async function garantirSala(roomId) {
  const existe = await db.query(
    'SELECT idchat_rooms FROM public.chat_rooms WHERE idchat_rooms = $1 LIMIT 1',
    [roomId]
  );
  if (existe.rowCount === 0) {
    await db.query(
      `INSERT INTO public.chat_rooms (idchat_rooms, created_at)
       OVERRIDING SYSTEM VALUE
       VALUES ($1, CURRENT_DATE)`,
      [roomId]
    );
  }
}

// ---------- Middleware de Autenticação ----------
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const userId = sessoes.get(token);
  if (!userId) return res.status(401).json({ erro: 'Não autenticado.' });
  req.userId = userId;
  next();
}

// ---------- Cadastro (public.usuario) ----------
app.post('/api/cadastro', async (req, res) => {
  const nome_completo = (req.body.nome_completo || req.body.nome || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const matricula = (req.body.matricula || '').trim();
  const curso_tecnico = (req.body.curso_tecnico || '').trim();
  const modulo = (req.body.modulo || '').trim();
  const senha = req.body.senha || '';

  if (!nome_completo || !email.includes('@') || !matricula || !curso_tecnico || !modulo || senha.length < 6) {
    return res.status(400).json({
      erro: 'Preencha todos os campos obrigatórios (senha mín. 6 caracteres).'
    });
  }

  try {
    const result = await db.query(
      `INSERT INTO public.usuario (nome_completo, email, matricula, curso_tecnico, modulo, senha)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_usuario, nome_completo, email, curso_tecnico, modulo`,
      [nome_completo, email, matricula, curso_tecnico, modulo, senha]
    );

    const novoUsuario = result.rows[0];
    const token = crypto.randomUUID();
    sessoes.set(token, novoUsuario.id_usuario);

    res.json({
      ok: true,
      id_usuario: novoUsuario.id_usuario,
      nome: novoUsuario.nome_completo,
      email: novoUsuario.email,
      curso_tecnico: novoUsuario.curso_tecnico,
      modulo: novoUsuario.modulo,
      token
    });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ erro: 'E-mail ou matrícula já cadastrados.' });
    }
    res.status(500).json({ erro: e.message });
  }
});

// ---------- Login (public.usuario) ----------
app.post('/api/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const senha = req.body.senha || '';

  try {
    const result = await db.query(
      `SELECT id_usuario, nome_completo, email, curso_tecnico, modulo, foto
       FROM public.usuario
       WHERE LOWER(email) = $1 AND senha = $2`,
      [email, senha]
    );

    const u = result.rows[0];
    if (!u) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

    const token = crypto.randomUUID();
    sessoes.set(token, u.id_usuario);

    res.json({
      ok: true,
      id_usuario: u.id_usuario,
      nome: u.nome_completo,
      email: u.email,
      curso_tecnico: u.curso_tecnico,
      modulo: u.modulo,
      foto: u.foto,
      token
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ---------- Contatos (via messages, troca e adições diretas) ----------
app.get('/api/contatos', auth, async (req, res) => {
  try {
    const idsContatos = new Set(contatosAdicionados.get(req.userId) || []);

    // 1. Busca salas de chat onde o usuário participa em public.messages
    const salasResult = await db.query(
      `SELECT DISTINCT chat_rooms, idsender
       FROM public.messages
       WHERE idsender = $1
          OR FLOOR(chat_rooms / 1000000) = $1
          OR (chat_rooms % 1000000) = $1`,
      [req.userId]
    );

    for (const row of salasResult.rows) {
      const outroId = extrairOutroUsuario(row.chat_rooms, req.userId);
      if (outroId && outroId !== req.userId) idsContatos.add(outroId);
      if (row.idsender && row.idsender !== req.userId) idsContatos.add(row.idsender);
    }

    // 2. Busca usuários com quem há trocas de livros em public.troca / public.livro
    const trocasResult = await db.query(
      `SELECT DISTINCT
         CASE
           WHEN t.id_solicitante = $1 THEN l.id_usuario
           ELSE t.id_solicitante
         END AS contato_id
       FROM public.troca t
       JOIN public.livro l ON l.id_livro = t.id_livro_desejado
       WHERE t.id_solicitante = $1 OR l.id_usuario = $1`,
      [req.userId]
    );

    for (const row of trocasResult.rows) {
      if (row.contato_id && row.contato_id !== req.userId) {
        idsContatos.add(row.contato_id);
      }
    }

    if (idsContatos.size === 0) {
      return res.json({ contatos: [] });
    }

    const listaIds = Array.from(idsContatos);
    const usuariosResult = await db.query(
      `SELECT id_usuario AS id, nome_completo AS nome, email, curso_tecnico, modulo, foto
       FROM public.usuario
       WHERE id_usuario = ANY($1::int[])
       ORDER BY nome_completo ASC`,
      [listaIds]
    );

    res.json({ contatos: usuariosResult.rows });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/contatos', auth, async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();

  try {
    const result = await db.query(
      `SELECT id_usuario, nome_completo, email, curso_tecnico, modulo
       FROM public.usuario
       WHERE LOWER(email) = $1`,
      [email]
    );

    const contato = result.rows[0];
    if (!contato) {
      return res.status(404).json({ erro: 'Nenhum usuário encontrado com esse e-mail.' });
    }
    if (contato.id_usuario === req.userId) {
      return res.status(400).json({ erro: 'Esse e-mail pertence a você! 🐱' });
    }

    const roomId = gerarRoomId(req.userId, contato.id_usuario);
    await garantirSala(roomId);
    vincularContatoMemoria(req.userId, contato.id_usuario);

    res.json({
      ok: true,
      id: contato.id_usuario,
      nome: contato.nome_completo,
      email: contato.email,
      curso_tecnico: contato.curso_tecnico,
      modulo: contato.modulo
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ---------- Mensagens (public.messages e public.chat_rooms) ----------
app.get('/api/mensagens', auth, async (req, res) => {
  const email = (req.query.com || '').trim().toLowerCase();
  const depois = Number(req.query.depois || 0);

  try {
    const userResult = await db.query(
      'SELECT id_usuario FROM public.usuario WHERE LOWER(email) = $1',
      [email]
    );
    if (userResult.rowCount === 0) {
      return res.status(404).json({ erro: 'Contato não encontrado.' });
    }

    const outroId = userResult.rows[0].id_usuario;
    const roomId = gerarRoomId(req.userId, outroId);

    const msgsResult = await db.query(
      `SELECT m.idmessage, m.idsender, m.content, c.created_at
       FROM public.messages m
       LEFT JOIN public.chat_rooms c ON c.idchat_rooms = m.chat_rooms
       WHERE m.chat_rooms = $1
         AND (m."delete" IS NULL OR m."delete" = 0)
         AND m.idmessage > $2
       ORDER BY m.idmessage ASC`,
      [roomId, depois]
    );

    res.json({
      mensagens: msgsResult.rows.map(m => ({
        id: Number(m.idmessage),
        minha: m.idsender === req.userId,
        texto: m.content,
        hora: m.created_at
          ? new Date(m.created_at).toLocaleDateString('pt-BR')
          : ''
      }))
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/mensagens', auth, async (req, res) => {
  const email = (req.body.para || '').trim().toLowerCase();
  const texto = (req.body.texto || '').trim();

  if (!texto) {
    return res.status(400).json({ erro: 'A mensagem não pode estar vazia.' });
  }

  try {
    const userResult = await db.query(
      'SELECT id_usuario FROM public.usuario WHERE LOWER(email) = $1',
      [email]
    );
    if (userResult.rowCount === 0) {
      return res.status(404).json({ erro: 'Contato não encontrado.' });
    }

    const outroId = userResult.rows[0].id_usuario;
    const roomId = gerarRoomId(req.userId, outroId);

    await garantirSala(roomId);
    vincularContatoMemoria(req.userId, outroId);

    const insertResult = await db.query(
      `INSERT INTO public.messages (content, "delete", chat_rooms, idsender)
       VALUES ($1, 0, $2, $3)
       RETURNING idmessage`,
      [texto, roomId, req.userId]
    );

    res.json({ ok: true, id: Number(insertResult.rows[0].idmessage) });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.listen(3000, () => console.log('API POIEL rodando em http://localhost:3000'));