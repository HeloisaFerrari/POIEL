const pool = require('./conexaobanco');

// erro "esperado" (ex.: livro indisponível): vira uma resposta com mensagem clara para a pessoa
class ErroDeNegocio extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// roda várias consultas como uma coisa só: ou todas dão certo, ou nenhuma é salva
async function comTransacao(trabalho) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await trabalho(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

function responderErro(res, erro) {
  if (erro instanceof ErroDeNegocio) {
    return res.status(erro.status).json({ erro: erro.message });
  }
  console.error(erro);
  res.status(500).json({ erro: 'Erro no servidor' });
}

// cria um aviso para o outro usuário (aparece em Minhas trocas)
async function avisar(client, idUsuario, mensagem) {
  await client.query('INSERT INTO notificacao (id_usuario, mensagem) VALUES ($1, $2)', [idUsuario, mensagem]);
}

module.exports = { ErroDeNegocio, comTransacao, responderErro, avisar };