const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./conexaobanco');

const router = express.Router();

// ---------- CADASTRO (cadastrousuario.html) ----------
router.post('/cadastro', async (req, res) => {
  const { nome, email, matricula, curso, modulo, senha } = req.body;

  if (!nome || !email || !matricula || !curso || !modulo || !senha) {
    return res.status(400).json({ erro: 'Preencha todos os campos' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres' });
  }

  try {
    const emailLimpo = email.trim().toLowerCase();
    const matriculaLimpa = matricula.trim();

    // impede e-mail ou matrícula repetidos
    const existente = await pool.query(
      'SELECT 1 FROM usuario WHERE email = $1 OR matricula = $2',
      [emailLimpo, matriculaLimpa]
    );
    if (existente.rows.length > 0) {
      return res.status(409).json({ erro: 'E-mail ou matrícula já cadastrados' });
    }

    // a senha nunca é salva como o usuário digitou: guardamos só o hash
    const senhaHash = await bcrypt.hash(senha, 10);

    const resultado = await pool.query(
      `INSERT INTO usuario (nome_completo, email, matricula, curso_tecnico, modulo, senha)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_usuario, nome_completo, email`,
      [nome.trim(), emailLimpo, matriculaLimpa, curso, modulo, senhaHash]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao cadastrar usuário' });
  }
});

// ---------- LOGIN (cadastroLogin.html) ----------
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe e-mail e senha' });
  }

  try {
    const resultado = await pool.query(
      'SELECT id_usuario, nome_completo, email, senha FROM usuario WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    const usuario = resultado.rows[0];

    // compara a senha digitada com o hash salvo
    const senhaCorreta = usuario && (await bcrypt.compare(senha, usuario.senha));
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }

    // o token é a "pulseira" que prova que a pessoa fez login
    const token = jwt.sign({ id: usuario.id_usuario }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      usuario: { id: usuario.id_usuario, nome: usuario.nome_completo, email: usuario.email }
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

module.exports = router;