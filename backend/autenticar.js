const jwt = require('jsonwebtoken');

// Use nas rotas que exigem login: app.get('/rota', autenticar, (req, res) => { ... })
// Depois dele, req.idUsuario tem o id de quem está logado.
function autenticar(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');

  try {
    const dados = jwt.verify(token, process.env.JWT_SECRET);
    req.idUsuario = dados.id;
    next();
  } catch (erro) {
    res.status(401).json({ erro: 'Faça login para continuar' });
  }
}

module.exports = autenticar;