const express = require('express');
const pool = require('./conexaobanco');
const autenticar = require('./autenticar');
const { ErroDeNegocio, comTransacao, responderErro, avisar } = require('./transacao');

const router = express.Router();

// Estados de uma troca:
//   pendente  -> proposta enviada, esperando o dono do livro responder
//   aceita    -> em andamento (os dois livros ficam "em_negociacao")
//   concluida -> troca feita (os dois livros ficam "trocado")
//   recusada / cancelada -> encerrada; os livros voltam a ficar "disponivel"

function idDaRota(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ErroDeNegocio(400, 'Identificador inválido');
  return id;
}

// busca a troca com os nomes e títulos, travando a linha para duas pessoas não mexerem ao mesmo tempo
async function buscarTroca(client, idTroca) {
  const r = await client.query(
    `SELECT t.id_troca, t.status, t.id_solicitante, t.id_livro_desejado, t.id_livro_oferecido,
            ld.titulo AS titulo_desejado, ld.id_usuario AS id_dono, ld.status AS status_desejado,
            lo.titulo AS titulo_oferecido, lo.status AS status_oferecido,
            us.nome_completo AS nome_solicitante, ud.nome_completo AS nome_dono
       FROM troca t
       JOIN livro ld ON ld.id_livro = t.id_livro_desejado
       JOIN livro lo ON lo.id_livro = t.id_livro_oferecido
       JOIN usuario us ON us.id_usuario = t.id_solicitante
       JOIN usuario ud ON ud.id_usuario = ld.id_usuario
      WHERE t.id_troca = $1
        FOR UPDATE OF t`,
    [idTroca]
  );
  if (r.rows.length === 0) throw new ErroDeNegocio(404, 'Troca não encontrada');
  return r.rows[0];
}

// ---------- PROPOR TROCA (index.html, botão "Enviar proposta") ----------
router.post('/trocas', autenticar, async (req, res) => {
  const idDesejado = Number(req.body.idLivroDesejado);
  const idOferecido = Number(req.body.idLivroOferecido);

  try {
    if (!Number.isInteger(idDesejado) || !Number.isInteger(idOferecido)) {
      throw new ErroDeNegocio(400, 'Escolha o livro que você quer e o que vai oferecer');
    }

    await comTransacao(async (client) => {
      const r = await client.query(
        'SELECT id_livro, titulo, id_usuario, status FROM livro WHERE id_livro IN ($1, $2) FOR UPDATE',
        [idDesejado, idOferecido]
      );
      const desejado = r.rows.find((l) => l.id_livro === idDesejado);
      const oferecido = r.rows.find((l) => l.id_livro === idOferecido);

      if (!desejado || !oferecido) throw new ErroDeNegocio(404, 'Livro não encontrado');
      if (oferecido.id_usuario !== req.idUsuario) throw new ErroDeNegocio(403, 'Você só pode oferecer livros seus');
      if (desejado.id_usuario === req.idUsuario) throw new ErroDeNegocio(400, 'Você não pode propor troca pelo seu próprio livro');
      if (desejado.status !== 'disponivel') throw new ErroDeNegocio(409, 'Este livro não está mais disponível para troca');
      if (oferecido.status !== 'disponivel') throw new ErroDeNegocio(409, 'O livro que você ofereceu não está disponível');

      const repetida = await client.query(
        `SELECT 1 FROM troca
          WHERE id_livro_desejado = $1 AND id_livro_oferecido = $2 AND status IN ('pendente', 'aceita')`,
        [idDesejado, idOferecido]
      );
      if (repetida.rows.length > 0) throw new ErroDeNegocio(409, 'Você já enviou essa proposta');

      const eu = await client.query('SELECT nome_completo FROM usuario WHERE id_usuario = $1', [req.idUsuario]);

      await client.query(
        `INSERT INTO troca (id_solicitante, id_livro_desejado, id_livro_oferecido, status, data_criacao, data_atualizacao)
         VALUES ($1, $2, $3, 'pendente', NOW(), NOW())`,
        [req.idUsuario, idDesejado, idOferecido]
      );
      await avisar(
        client,
        desejado.id_usuario,
        `${eu.rows[0].nome_completo} propôs trocar "${oferecido.titulo}" pelo seu livro "${desejado.titulo}". Responda em Minhas trocas.`
      );
    });

    res.status(201).json({ ok: true });
  } catch (erro) {
    responderErro(res, erro);
  }
});

// ---------- TUDO DA PÁGINA "MINHAS TROCAS" ----------
router.get('/minhas-trocas', autenticar, async (req, res) => {
  const eu = req.idUsuario;

  // "o outro" é a pessoa do outro lado da troca; "meu" é o livro que eu ofereço (ou o que me pediram)
  const baseTroca = `
    SELECT t.id_troca, t.status, t.data_criacao, t.data_conclusao,
           (t.id_solicitante = $1) AS fui_solicitante,
           CASE WHEN t.id_solicitante = $1 THEN lo.titulo ELSE ld.titulo END AS meu_titulo,
           CASE WHEN t.id_solicitante = $1 THEN lo.capa_url ELSE ld.capa_url END AS minha_capa,
           CASE WHEN t.id_solicitante = $1 THEN ld.titulo ELSE lo.titulo END AS outro_titulo,
           o.id_usuario AS id_outro, o.nome_completo AS nome_outro, o.avaliacao AS nota_outro,
           (SELECT COUNT(*)::int FROM avaliacao_troca a WHERE a.id_avaliado = o.id_usuario) AS qtd_avaliacoes_outro,
           (SELECT a.nota FROM avaliacao_troca a WHERE a.id_troca = t.id_troca AND a.id_avaliador = $1) AS minha_nota
      FROM troca t
      JOIN livro ld ON ld.id_livro = t.id_livro_desejado
      JOIN livro lo ON lo.id_livro = t.id_livro_oferecido
      JOIN usuario o ON o.id_usuario = CASE WHEN t.id_solicitante = $1 THEN ld.id_usuario ELSE t.id_solicitante END
     WHERE (t.id_solicitante = $1 OR ld.id_usuario = $1)`;

  try {
    const [andamento, finalizadas, aguardando, avisos] = await Promise.all([
      pool.query(baseTroca + ` AND t.status IN ('pendente', 'aceita') ORDER BY t.data_atualizacao DESC`, [eu]),
      pool.query(baseTroca + ` AND t.status = 'concluida' ORDER BY t.data_conclusao DESC`, [eu]),
      pool.query(
        `SELECT id_livro, titulo, capa_url, data_cadastro
           FROM livro WHERE id_usuario = $1 AND status = 'disponivel' ORDER BY data_cadastro DESC`,
        [eu]
      ),
      pool.query(
        `SELECT id_notificacao, mensagem, data_criacao
           FROM notificacao WHERE id_usuario = $1 AND lida = FALSE ORDER BY data_criacao DESC LIMIT 20`,
        [eu]
      )
    ]);

    res.json({
      andamento: andamento.rows,
      finalizadas: finalizadas.rows,
      aguardando: aguardando.rows,
      avisos: avisos.rows
    });
  } catch (erro) {
    responderErro(res, erro);
  }
});

// ---------- ACEITAR (só o dono do livro desejado) ----------
router.post('/trocas/:id/aceitar', autenticar, async (req, res) => {
  try {
    const idTroca = idDaRota(req);
    await comTransacao(async (client) => {
      const troca = await buscarTroca(client, idTroca);

      if (troca.id_dono !== req.idUsuario) throw new ErroDeNegocio(403, 'Só o dono do livro pode aceitar a proposta');
      if (troca.status !== 'pendente') throw new ErroDeNegocio(409, 'Esta proposta não está mais pendente');
      if (troca.status_desejado !== 'disponivel' || troca.status_oferecido !== 'disponivel') {
        throw new ErroDeNegocio(409, 'Um dos livros não está mais disponível');
      }

      await client.query(`UPDATE troca SET status = 'aceita', data_atualizacao = NOW() WHERE id_troca = $1`, [idTroca]);
      await client.query(
        `UPDATE livro SET status = 'em_negociacao' WHERE id_livro IN ($1, $2)`,
        [troca.id_livro_desejado, troca.id_livro_oferecido]
      );
      await avisar(
        client,
        troca.id_solicitante,
        `${troca.nome_dono} aceitou sua proposta pelo livro "${troca.titulo_desejado}". Combinem a troca pelo chat!`
      );

      // outras propostas pendentes com esses livros não fazem mais sentido: encerra e avisa quem não participa desta troca
      const outras = await client.query(
        `SELECT t.id_troca, t.id_solicitante, ld.id_usuario AS id_dono,
                ld.titulo AS titulo_desejado, lo.titulo AS titulo_oferecido
           FROM troca t
           JOIN livro ld ON ld.id_livro = t.id_livro_desejado
           JOIN livro lo ON lo.id_livro = t.id_livro_oferecido
          WHERE t.status = 'pendente' AND t.id_troca <> $1
            AND (t.id_livro_desejado IN ($2, $3) OR t.id_livro_oferecido IN ($2, $3))`,
        [idTroca, troca.id_livro_desejado, troca.id_livro_oferecido]
      );
      for (const outra of outras.rows) {
        await client.query(`UPDATE troca SET status = 'recusada', data_atualizacao = NOW() WHERE id_troca = $1`, [outra.id_troca]);
        for (const idUsuario of new Set([outra.id_solicitante, outra.id_dono])) {
          if (idUsuario === troca.id_solicitante || idUsuario === troca.id_dono) continue;
          await avisar(
            client,
            idUsuario,
            `A proposta de "${outra.titulo_oferecido}" por "${outra.titulo_desejado}" foi encerrada, porque um dos livros entrou em outra troca.`
          );
        }
      }
    });
    res.json({ ok: true });
  } catch (erro) {
    responderErro(res, erro);
  }
});

// ---------- RECUSAR (só o dono do livro desejado) ----------
router.post('/trocas/:id/recusar', autenticar, async (req, res) => {
  try {
    const idTroca = idDaRota(req);
    await comTransacao(async (client) => {
      const troca = await buscarTroca(client, idTroca);

      if (troca.id_dono !== req.idUsuario) throw new ErroDeNegocio(403, 'Só o dono do livro pode recusar a proposta');
      if (troca.status !== 'pendente') throw new ErroDeNegocio(409, 'Esta proposta não está mais pendente');

      await client.query(`UPDATE troca SET status = 'recusada', data_atualizacao = NOW() WHERE id_troca = $1`, [idTroca]);
      await avisar(
        client,
        troca.id_solicitante,
        `${troca.nome_dono} recusou sua proposta pelo livro "${troca.titulo_desejado}". O seu livro "${troca.titulo_oferecido}" continua disponível.`
      );
    });
    res.json({ ok: true });
  } catch (erro) {
    responderErro(res, erro);
  }
});

// ---------- CANCELAR / ENCERRAR ----------
// proposta pendente: quem enviou pode cancelar. Troca aceita: qualquer um dos dois pode encerrar.
// Os dois livros voltam para "disponivel" e o outro usuário recebe um aviso.
router.post('/trocas/:id/cancelar', autenticar, async (req, res) => {
  try {
    const idTroca = idDaRota(req);
    await comTransacao(async (client) => {
      const troca = await buscarTroca(client, idTroca);

      const euSolicitante = troca.id_solicitante === req.idUsuario;
      const euDono = troca.id_dono === req.idUsuario;
      if (!euSolicitante && !euDono) throw new ErroDeNegocio(403, 'Você não participa desta troca');

      if (troca.status === 'pendente') {
        if (!euSolicitante) throw new ErroDeNegocio(400, 'Para uma proposta recebida, use "Recusar"');
      } else if (troca.status !== 'aceita') {
        throw new ErroDeNegocio(409, 'Esta troca já foi encerrada');
      }

      const estavaAceita = troca.status === 'aceita';
      await client.query(`UPDATE troca SET status = 'cancelada', data_atualizacao = NOW() WHERE id_troca = $1`, [idTroca]);

      if (estavaAceita) {
        // os dois livros voltam para a lista de "aguardando match" e para a página principal
        await client.query(
          `UPDATE livro SET status = 'disponivel' WHERE id_livro IN ($1, $2)`,
          [troca.id_livro_desejado, troca.id_livro_oferecido]
        );
      }

      const meuNome = euSolicitante ? troca.nome_solicitante : troca.nome_dono;
      const outro = euSolicitante ? troca.id_dono : troca.id_solicitante;
      const livroDoOutro = euSolicitante ? troca.titulo_desejado : troca.titulo_oferecido;

      const mensagem = estavaAceita
        ? `${meuNome} encerrou a troca de "${troca.titulo_oferecido}" por "${troca.titulo_desejado}". O seu livro "${livroDoOutro}" voltou para a lista de livros disponíveis.`
        : `${meuNome} cancelou a proposta de troca de "${troca.titulo_oferecido}" pelo seu livro "${troca.titulo_desejado}".`;
      await avisar(client, outro, mensagem);
    });
    res.json({ ok: true });
  } catch (erro) {
    responderErro(res, erro);
  }
});

// ---------- CONCLUIR (qualquer um dos dois, com a troca aceita) ----------
router.post('/trocas/:id/concluir', autenticar, async (req, res) => {
  try {
    const idTroca = idDaRota(req);
    await comTransacao(async (client) => {
      const troca = await buscarTroca(client, idTroca);

      const euSolicitante = troca.id_solicitante === req.idUsuario;
      if (!euSolicitante && troca.id_dono !== req.idUsuario) throw new ErroDeNegocio(403, 'Você não participa desta troca');
      if (troca.status !== 'aceita') throw new ErroDeNegocio(409, 'Só dá para concluir uma troca aceita');

      await client.query(
        `UPDATE troca SET status = 'concluida', data_conclusao = NOW(), data_atualizacao = NOW() WHERE id_troca = $1`,
        [idTroca]
      );
      await client.query(
        `UPDATE livro SET status = 'trocado' WHERE id_livro IN ($1, $2)`,
        [troca.id_livro_desejado, troca.id_livro_oferecido]
      );

      const meuNome = euSolicitante ? troca.nome_solicitante : troca.nome_dono;
      await avisar(
        client,
        euSolicitante ? troca.id_dono : troca.id_solicitante,
        `${meuNome} marcou a troca de "${troca.titulo_oferecido}" por "${troca.titulo_desejado}" como concluída. Que tal avaliar essa pessoa?`
      );
    });
    res.json({ ok: true });
  } catch (erro) {
    responderErro(res, erro);
  }
});

// ---------- AVALIAR O OUTRO USUÁRIO (uma vez por troca concluída) ----------
router.post('/trocas/:id/avaliar', autenticar, async (req, res) => {
  try {
    const idTroca = idDaRota(req);
    const nota = Number(req.body.nota);
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
      throw new ErroDeNegocio(400, 'A nota precisa ser um número inteiro de 1 a 5');
    }

    await comTransacao(async (client) => {
      const troca = await buscarTroca(client, idTroca);

      const euSolicitante = troca.id_solicitante === req.idUsuario;
      if (!euSolicitante && troca.id_dono !== req.idUsuario) throw new ErroDeNegocio(403, 'Você não participa desta troca');
      if (troca.status !== 'concluida') throw new ErroDeNegocio(409, 'Só dá para avaliar depois que a troca for concluída');

      const jaAvaliou = await client.query(
        'SELECT 1 FROM avaliacao_troca WHERE id_troca = $1 AND id_avaliador = $2',
        [idTroca, req.idUsuario]
      );
      if (jaAvaliou.rows.length > 0) throw new ErroDeNegocio(409, 'Você já avaliou este usuário');

      const avaliado = euSolicitante ? troca.id_dono : troca.id_solicitante;
      await client.query(
        'INSERT INTO avaliacao_troca (id_troca, id_avaliador, id_avaliado, nota) VALUES ($1, $2, $3, $4)',
        [idTroca, req.idUsuario, avaliado, nota]
      );
      // a nota que aparece no perfil é a média de todas as avaliações recebidas
      await client.query(
        `UPDATE usuario
            SET avaliacao = COALESCE((SELECT ROUND(AVG(nota)::numeric, 1) FROM avaliacao_troca WHERE id_avaliado = $1), 0)
          WHERE id_usuario = $1`,
        [avaliado]
      );
    });
    res.json({ ok: true });
  } catch (erro) {
    responderErro(res, erro);
  }
});

// ---------- MARCAR UM AVISO COMO LIDO ----------
router.post('/avisos/:id/lido', autenticar, async (req, res) => {
  try {
    const idAviso = idDaRota(req);
    await pool.query(
      'UPDATE notificacao SET lida = TRUE WHERE id_notificacao = $1 AND id_usuario = $2',
      [idAviso, req.idUsuario]
    );
    res.json({ ok: true });
  } catch (erro) {
    responderErro(res, erro);
  }
});

module.exports = router;