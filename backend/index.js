require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./conexaobanco');

const app = express();
app.use(cors());
app.use(express.json());

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

app.listen(process.env.PORT, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT}`);
});