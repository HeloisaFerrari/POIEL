const express = require('express');
const cors = require('cors');
const pool = require('./conexaobanco');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(require('./rotasUsuario'));
app.use(require('./rotasLivro'));
app.use(require('./rotasPerfil'));
app.use(require('./rotasTroca'));

app.listen(process.env.PORT, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT}`);
});

const path = require('path');

app.get('/cadastroLogin', (req, res) => {
  // O '..' volta um nível para fora da pasta backend
  res.sendFile(path.join(__dirname, '..','front-end', 'Páginas_HTML', 'cadastroLogin.html'));
});

app.get('/cadastroLogin', (req, res) => {
  // O '..' volta um nível para fora da pasta backend
  res.sendFile(path.join(__dirname, '..','front-end', 'Páginas_CSS', 'cadastroLogin.css'));
});

// Redireciona a raiz para a página de login
app.get('/', (req, res) => {
  res.redirect('/cadastroLogin');
});