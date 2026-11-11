const express = require('express');
const pool = require('./conexaobanco');
const autenticar = require('./autenticar');

const router = express.Router();

// mesmos módulos do formulário de cadastro
const MODULOS = ['1º módulo', '2º módulo', '3º módulo', '4º módulo', '5º módulo', '6º módulo', '7º módulo', '8º módulo'];

// a foto chega como texto (base64): conferimos o formato e o tamanho
function fotoValida(texto) {
  return (
    typeof texto === 'string' &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(texto) &&
    texto.length <= 400000
  );
}

// ---------- VER PERFIL (perfilusuario.html) ----------
router.get('/perfil', autenticar, async (req, res) => {
  try {
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
      [req.idUsuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }
    res.json(resultado.rows[0]); // a senha nunca é enviada
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar o perfil' });
  }
});

// ---------- EDITAR PERFIL ----------
// só dá para mudar módulo, bio e foto. Nome, e-mail, matrícula e curso ficam como estão.
router.put('/perfil', autenticar, async (req, res) => {
  const { modulo, bio, alterarFoto, foto } = req.body;

  if (!MODULOS.includes(modulo)) {
    return res.status(400).json({ erro: 'Módulo inválido' });
  }

  const bioLimpa = typeof bio === 'string' ? bio.trim() : '';
  if (bioLimpa.length > 200) {
    return res.status(400).json({ erro: 'A bio pode ter no máximo 200 caracteres' });
  }

  const mudouFoto = alterarFoto === true;
  if (mudouFoto && foto !== null && !fotoValida(foto)) {
    return res.status(400).json({ erro: 'Foto inválida ou grande demais' });
  }

  try {
    // se alterarFoto for falso, a foto que já está salva continua igual
    const resultado = await pool.query(
      `UPDATE usuario
          SET modulo = $1,
              bio = $2,
              foto = CASE WHEN $3::boolean THEN $4::text ELSE foto END
        WHERE id_usuario = $5
        RETURNING modulo, bio, foto`,
      [modulo, bioLimpa || null, mudouFoto, mudouFoto ? foto : null, req.idUsuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }
    res.json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao salvar o perfil' });
  }
});

module.exports = router;