const pool = require('./conexaobanco');

// Dados do perfil de uma pessoa (a senha nunca entra aqui).
// É usada na rota GET /perfil e também no login, para o site já saber quem você é logo na entrada.
async function buscarPerfil(idUsuario) {
  const resultado = await pool.query(
    `SELECT u.id_usuario, u.nome_completo, u.email, u.curso_tecnico, u.modulo,
            u.avaliacao, u.bio, u.foto,
            (SELECT COUNT(*) FROM livro l WHERE l.id_usuario = u.id_usuario)::int AS total_livros,
            (SELECT COUNT(*) FROM troca t JOIN livro ld ON ld.id_livro = t.id_livro_desejado
              WHERE t.status = 'concluida' AND (t.id_solicitante = u.id_usuario OR ld.id_usuario = u.id_usuario))::int AS trocas_realizadas,
            (SELECT COUNT(*) FROM troca t JOIN livro ld ON ld.id_livro = t.id_livro_desejado
              WHERE t.status = 'pendente' AND ld.id_usuario = u.id_usuario)::int AS propostas_pendentes
       FROM usuario u
      WHERE u.id_usuario = $1`,
    [idUsuario]
  );
  return resultado.rows[0] || null;
}

module.exports = { buscarPerfil };