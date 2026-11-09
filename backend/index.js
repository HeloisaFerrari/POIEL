const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const pool = require('./conexaobanco');

const app = express();
app.use(cors());
app.use(express.json());
app.use(require('./rotasUsuario'));

// rota de teste
app.get('/livros', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM livro');
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar livros' });
  }
});

app.post('/usuarios', async (req, res) => {
  const { nome_completo, email, matricula, curso_tecnico, modulo, senha, confirmar_senha } = req.body;

  if (!nome_completo || !email || !matricula || !curso_tecnico || !modulo || !senha) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }
  if (senha !== confirmar_senha) {
    return res.status(400).json({ erro: 'As senhas não conferem.' });
  }

  try {
    const senhaCriptografada = await bcrypt.hash(senha, 10);

    const resultado = await pool.query(
      `INSERT INTO usuario (nome_completo, email, matricula, curso_tecnico, modulo, senha)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_usuario, nome_completo, email`,
      [nome_completo, email, matricula, curso_tecnico, modulo, senhaCriptografada]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ erro: 'E-mail ou matrícula já cadastrados.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT}`);
});