const express = require('express');
const cors = require('cors');
const pool = require('./conexaobanco');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(require('./rotasUsuario'));
app.use(require('./rotasLivro'));
app.use(require('./rotasPerfil'));

app.listen(process.env.PORT, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT}`);
});