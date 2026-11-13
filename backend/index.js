const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./conexaobanco');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rotas da API
app.use(require('./rotasUsuario'));
app.use(require('./rotasLivro'));
app.use(require('./rotasPerfil'));
app.use(require('./rotasTroca'));

// Serve a pasta front-end inteira (HTML, CSS, JS e imagens).
// Assim os caminhos "../JS/login.js" e "../Páginas_CSS/..." das páginas funcionam.
app.use(express.static(path.join(__dirname, '..', 'front-end')));

// Atalhos: a raiz e /cadastroLogin levam para a página de login
app.get(['/', '/cadastroLogin'], (req, res) => {
  res.redirect('/Páginas_HTML/cadastroLogin.html');
});

// O front-end chama a API em http://localhost:3000, então a porta padrão é 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});