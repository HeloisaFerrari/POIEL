const express = require('express');
const pool = require('./conexaobanco');
const autenticar = require('./autenticar');
const { ErroDeNegocio, comTransacao, responderErro, avisar } = require('./transacao');

const router = express.Router();

// mesmas opções do formulário de cadastro de livro
const GENEROS = ['Romance', 'Fantasia', 'Ficção científica', 'Suspense', 'Terror', 'Aventura', 'Drama', 'Biografia'];
const ESTADOS = ['Novo', 'Excelente', 'Bom', 'Regular', 'Desgastado'];

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
        WHERE l.status = 'disponivel'
          AND ($1::text IS NULL OR l.titulo ILIKE '%' || $1 || '%' OR l.autor ILIKE '%' || $1 || '%')
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
      `SELECT id_livro, titulo, autor, genero, estado_conservacao, capa_url, contracapa_url, status
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

// ---------- EDITAR LIVRO (só o dono consegue) ----------
// alterarCapa / alterarContracapa dizem se a imagem mudou: se for false, a que já está salva continua
router.put('/livros/:id', autenticar, async (req, res) => {
  const idLivro = Number(req.params.id);
  if (!Number.isInteger(idLivro)) {
    return res.status(400).json({ erro: 'Livro inválido' });
  }

  const { titulo, autor, genero, estado, alterarCapa, capa, alterarContracapa, contracapa } = req.body;

  if (!titulo || !autor || !genero || !estado) {
    return res.status(400).json({ erro: 'Preencha título, autor, gênero e estado' });
  }
  if (!GENEROS.includes(genero) || !ESTADOS.includes(estado)) {
    return res.status(400).json({ erro: 'Gênero ou estado inválido' });
  }

  const mudouCapa = alterarCapa === true;
  const mudouContracapa = alterarContracapa === true;
  if ((mudouCapa && !imagemValida(capa)) || (mudouContracapa && !imagemValida(contracapa))) {
    return res.status(400).json({ erro: 'Imagem inválida ou grande demais' });
  }

  try {
    const resultado = await pool.query(
      `UPDATE livro
          SET titulo = $1,
              autor = $2,
              genero = $3,
              estado_conservacao = $4,
              capa_url = CASE WHEN $5::boolean THEN $6::text ELSE capa_url END,
              contracapa_url = CASE WHEN $7::boolean THEN $8::text ELSE contracapa_url END
        WHERE id_livro = $9 AND id_usuario = $10
        RETURNING id_livro`,
      [
        titulo.trim(), autor.trim(), genero, estado,
        mudouCapa, mudouCapa ? (capa || null) : null,
        mudouContracapa, mudouContracapa ? (contracapa || null) : null,
        idLivro, req.idUsuario
      ]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Livro não encontrado' });
    }
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao salvar o livro' });
  }
});

// ---------- REMOVER LIVRO (só o dono consegue) ----------
// - livro em troca em andamento: não pode (é preciso encerrar a troca antes)
// - livro já trocado: não pode
// - propostas pendentes com esse livro são encerradas e a outra pessoa é avisada
router.delete('/livros/:id', autenticar, async (req, res) => {
  const idLivro = Number(req.params.id);

  try {
    if (!Number.isInteger(idLivro)) throw new ErroDeNegocio(400, 'Livro inválido');

    await comTransacao(async (client) => {
      const r = await client.query(
        'SELECT id_livro, titulo, status FROM livro WHERE id_livro = $1 AND id_usuario = $2 FOR UPDATE',
        [idLivro, req.idUsuario]
      );
      const livro = r.rows[0];
      if (!livro) throw new ErroDeNegocio(404, 'Livro não encontrado');
      if (livro.status === 'em_negociacao') {
        throw new ErroDeNegocio(409, 'Este livro está em uma troca em andamento. Encerre a troca antes de excluir.');
      }
      if (livro.status === 'trocado') {
        throw new ErroDeNegocio(409, 'Este livro já foi trocado e não pode ser excluído.');
      }

      const pendentes = await client.query(
        `SELECT t.id_solicitante, ld.id_usuario AS id_dono, ld.titulo AS titulo_desejado, lo.titulo AS titulo_oferecido
           FROM troca t
           JOIN livro ld ON ld.id_livro = t.id_livro_desejado
           JOIN livro lo ON lo.id_livro = t.id_livro_oferecido
          WHERE t.status = 'pendente' AND (t.id_livro_desejado = $1 OR t.id_livro_oferecido = $1)`,
        [idLivro]
      );
      for (const p of pendentes.rows) {
        const outro = p.id_solicitante === req.idUsuario ? p.id_dono : p.id_solicitante;
        await avisar(
          client,
          outro,
          `A proposta de troca de "${p.titulo_oferecido}" por "${p.titulo_desejado}" foi encerrada, porque o livro "${livro.titulo}" foi removido.`
        );
      }

      // propostas já encerradas (recusadas ou canceladas) só guardam histórico: saem junto com o livro
      await client.query('DELETE FROM troca WHERE id_livro_desejado = $1 OR id_livro_oferecido = $1', [idLivro]);
      await client.query('DELETE FROM livro WHERE id_livro = $1', [idLivro]);
    });

    res.json({ ok: true });
  } catch (erro) {
    responderErro(res, erro);
  }
});

module.exports = router;