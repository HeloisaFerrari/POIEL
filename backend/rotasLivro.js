const express = require('express');
const pool = require('./conexaobanco');
const autenticar = require('./autenticar');

const router = express.Router();

// as imagens chegam como texto (base64), então conferimos o formato e o tamanho
function imagemValida(texto) {
  if (texto === null || texto === undefined || texto === '') return true; // imagem é opcional
  return (
    typeof texto === 'string' &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(texto) &&
    texto.length <= 1500000
  );
}

// ---------- LISTAR LIVROS (index.html: busca e filtro por gênero) ----------
// exemplos: /livros   /livros?busca=principe   /livros?genero=Romance
router.get('/livros', async (req, res) => {
  const busca = req.query.busca || null;
  const genero = req.query.genero || null;

  try {
    const resultado = await pool.query(
      `SELECT l.id_livro, l.titulo, l.autor, l.genero, l.estado_conservacao,
              l.capa_url, l.contracapa_url, l.id_usuario,
              u.nome_completo AS dono, u.avaliacao AS avaliacao_dono
         FROM livro l
         JOIN usuario u ON u.id_usuario = l.id_usuario
        WHERE ($1::text IS NULL OR l.titulo ILIKE '%' || $1 || '%' OR l.autor ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR l.genero = $2)
        ORDER BY l.data_cadastro DESC`,
      [busca, genero]
    );
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar livros' });
  }
});

// ---------- MEUS LIVROS (cadastrolivro.html: estante de quem está logado) ----------
router.get('/meus-livros', autenticar, async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id_livro, titulo, autor, genero, estado_conservacao, capa_url, contracapa_url
         FROM livro
        WHERE id_usuario = $1
        ORDER BY data_cadastro DESC`,
      [req.idUsuario]
    );
    res.json(resultado.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar seus livros' });
  }
});

// ---------- CADASTRAR LIVRO (cadastrolivro.html) ----------
router.post('/livros', autenticar, async (req, res) => {
  const { titulo, autor, genero, estado, capa, contracapa } = req.body;

  if (!titulo || !autor || !genero || !estado) {
    return res.status(400).json({ erro: 'Preencha título, autor, gênero e estado' });
  }
  if (!imagemValida(capa) || !imagemValida(contracapa)) {
    return res.status(400).json({ erro: 'Imagem inválida ou grande demais' });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO livro (id_usuario, titulo, autor, genero, estado_conservacao, capa_url, contracapa_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_livro, titulo`,
      [req.idUsuario, titulo.trim(), autor.trim(), genero, estado, capa || null, contracapa || null]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao cadastrar livro' });
  }
});

// ---------- REMOVER LIVRO (só o dono consegue) ----------
router.delete('/livros/:id', autenticar, async (req, res) => {
  const idLivro = Number(req.params.id);
  if (!Number.isInteger(idLivro)) {
    return res.status(400).json({ erro: 'Livro inválido' });
  }

  try {
    const resultado = await pool.query(
      'DELETE FROM livro WHERE id_livro = $1 AND id_usuario = $2 RETURNING id_livro',
      [idLivro, req.idUsuario]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Livro não encontrado' });
    }
    res.json({ ok: true });
  } catch (erro) {
    if (erro.code === '23503') { // o livro já aparece em alguma troca
      return res.status(409).json({ erro: 'Este livro está em uma troca e não pode ser removido' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao remover livro' });
  }
});

module.exports = router;