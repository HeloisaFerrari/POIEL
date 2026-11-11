/* ===== LOGIN E CONEXÃO COM O BACK-END ===== */
const URL_API = "http://localhost:3000";
const tokenLogin = localStorage.getItem("token");
if (!tokenLogin) {
    window.location.href = "cadastroLogin.html"; // sem login, volta para a página de login
}

async function chamarApi(rota, opcoes = {}) {
    const resposta = await fetch(`${URL_API}${rota}`, {
        ...opcoes,
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tokenLogin }
    });
    if (resposta.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "cadastroLogin.html";
        throw new Error("Sessão expirada. Faça login novamente.");
    }
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || "Erro no servidor");
    return dados;
}

/* evita que um título com símbolos HTML quebre a página */
function escapeHtml(texto) {
    return String(texto).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const $ = (id) => document.getElementById(id);
const data = (d) => new Date(d).toLocaleDateString("pt-BR");

/* ===== PEDAÇOS DOS CARDS ===== */
function capaHTML(capa, titulo) {
    return capa
        ? `<img src="${escapeHtml(capa)}" alt="Capa do livro ${escapeHtml(titulo)}">`
        : `<div class="sem-capa">${escapeHtml(titulo)}</div>`;
}

function linhaNota(nota, qtd) {
    if (!qtd) return `<p class="detalhes"><span class="estrelas">☆☆☆☆☆</span> Ainda sem avaliações</p>`;
    const n = Number(nota);
    const cheias = Math.round(n);
    return `<p class="detalhes"><span class="estrelas">${"★".repeat(cheias)}${"☆".repeat(5 - cheias)}</span> ` +
           `${n.toFixed(1).replace(".", ",")} · ${qtd} ${qtd === 1 ? "avaliação" : "avaliações"}</p>`;
}

function card(capa, titulo, corpo) {
    return `
        <div class="col-12 col-md-6 col-lg-4">
            <article class="card-troca">
                <div class="capa-livro">${capaHTML(capa, titulo)}</div>
                <div class="corpo">
                    ${corpo}
                </div>
            </article>
        </div>`;
}

const botaoChat = `<a class="btn btn-chat" href="chat.html"><i class="bi bi-chat-dots"></i> Abrir chat</a>`;
const botao = (classe, acao, id, texto) =>
    `<button class="btn ${classe}" data-acao="${acao}" data-id="${id}">${texto}</button>`;

/* ===== OS TRÊS TIPOS DE CARD ===== */
function cardAndamento(t) {
    const titulo = `<h2>${escapeHtml(t.meu_titulo)}</h2>`;
    const outro = `<strong>${escapeHtml(t.nome_outro)}</strong>`;
    const quer = `<strong>${escapeHtml(t.outro_titulo)}</strong>`;
    const nota = linhaNota(t.nota_outro, t.qtd_avaliacoes_outro);

    if (t.status === "aceita") {
        return card(t.minha_capa, t.meu_titulo, `
            <span class="status status-combinada">Troca aceita</span>
            ${titulo}
            <p class="detalhes"><i class="bi bi-arrow-left-right"></i> Você oferece este livro · recebe ${quer}</p>
            <p class="detalhes">Conversando com ${outro}</p>
            ${nota}
            <div class="d-flex gap-2 mt-3 flex-wrap">
                ${botaoChat}
                ${botao("btn-avaliar", "concluir", t.id_troca, "Marcar como concluída")}
                ${botao("btn-avaliar", "encerrar", t.id_troca, "Encerrar troca")}
            </div>`);
    }

    if (t.fui_solicitante) { // proposta que eu enviei
        return card(t.minha_capa, t.meu_titulo, `
            <span class="status status-aguardando">Proposta enviada</span>
            ${titulo}
            <p class="detalhes"><i class="bi bi-arrow-left-right"></i> Você oferece este livro · quer ${quer}</p>
            <p class="detalhes">Aguardando a resposta de ${outro}</p>
            ${nota}
            <p class="detalhes"><i class="bi bi-calendar3"></i> Enviada em ${data(t.data_criacao)}</p>
            <div class="d-flex gap-2 mt-3 flex-wrap">
                ${botao("btn-avaliar", "cancelar", t.id_troca, "Cancelar proposta")}
            </div>`);
    }

    // proposta que eu recebi
    return card(t.minha_capa, t.meu_titulo, `
        <span class="status status-pendente">Aguardando sua resposta</span>
        ${titulo}
        <p class="detalhes">Proposta recebida de ${outro}</p>
        <p class="detalhes"><i class="bi bi-arrow-left-right"></i> Oferece ${quer} por este livro</p>
        ${nota}
        <div class="d-flex gap-2 mt-3 flex-wrap">
            ${botao("btn-chat", "aceitar", t.id_troca, "Aceitar")}
            ${botao("btn-avaliar", "recusar", t.id_troca, "Recusar")}
            ${botaoChat}
        </div>`);
}

function cardAguardando(l) {
    return card(l.capa_url, l.titulo, `
        <span class="status status-aguardando">Aguardando match</span>
        <h2>${escapeHtml(l.titulo)}</h2>
        <p class="detalhes"><i class="bi bi-calendar3"></i> Cadastrado em ${data(l.data_cadastro)}</p>
        <div class="d-flex gap-2 mt-3 flex-wrap">
            <a class="btn btn-chat" href="perfilusuario.html"><i class="bi bi-pencil"></i> Editar</a>
            ${botao("btn-avaliar", "remover", l.id_livro, '<i class="bi bi-trash"></i> Remover')}
        </div>`);
}

function cardFinalizada(t) {
    const acaoFinal = t.minha_nota
        ? `<span class="status status-concluida">Usuário avaliado! (${"★".repeat(t.minha_nota)})</span>`
        : botao("btn-avaliar", "avaliar", t.id_troca, "★ Avaliar usuário");
    return card(t.minha_capa, t.meu_titulo, `
        <span class="status status-concluida">Concluída</span>
        <h2>${escapeHtml(t.meu_titulo)}</h2>
        <p class="detalhes">Troca feita com <strong>${escapeHtml(t.nome_outro)}</strong></p>
        <p class="detalhes"><i class="bi bi-arrow-left-right"></i> Você deu este livro · recebeu <strong>${escapeHtml(t.outro_titulo)}</strong></p>
        <p class="detalhes"><i class="bi bi-calendar-check"></i> Concluída em ${data(t.data_conclusao)}</p>
        ${linhaNota(t.nota_outro, t.qtd_avaliacoes_outro)}
        <div class="d-flex gap-2 mt-3 flex-wrap">
            ${acaoFinal}
        </div>`);
}

/* ===== DESENHAR A PÁGINA ===== */
function desenharSecao(nome, cards) {
    const secao = $(`secao-${nome}`);
    const titulo = secao.querySelector(".titulo-secao");
    if (!titulo.dataset.nome) {
        titulo.dataset.nome = titulo.textContent.replace(/\s*\(\d+\)\s*$/, "").trim();
    }
    titulo.textContent = `${titulo.dataset.nome} (${cards.length})`;
    secao.querySelector(".row").innerHTML = cards.join("");
    secao.querySelector(".vazio").hidden = cards.length !== 0;
}

function desenharAvisos(avisos) {
    $("avisos").innerHTML = avisos.map(a => `
        <div class="aviso" role="status">
            <span>${escapeHtml(a.mensagem)}</span>
            <button type="button" class="btn btn-avaliar" data-acao="aviso" data-id="${a.id_notificacao}">Entendi</button>
        </div>`).join("");
}

async function carregar() {
    try {
        const dados = await chamarApi("/minhas-trocas");
        desenharAvisos(dados.avisos);
        desenharSecao("andamento", dados.andamento.map(cardAndamento));
        desenharSecao("aguardando", dados.aguardando.map(cardAguardando));
        desenharSecao("finalizadas", dados.finalizadas.map(cardFinalizada));
    } catch (erro) {
        $("avisos").innerHTML = `<div class="aviso" role="alert"><span>Não foi possível carregar suas trocas. O servidor está ligado?</span></div>`;
    }
}

/* ===== BOTÕES ===== */
async function pedir(rota, opcoes) {
    try {
        await chamarApi(rota, opcoes);
    } catch (erro) {
        alert(erro.message); // ex.: "Um dos livros não está mais disponível"
    }
    await carregar();
}

const acoes = {
    aceitar: (id) => confirm("Deseja aceitar esta proposta?") && pedir(`/trocas/${id}/aceitar`, { method: "POST" }),
    recusar: (id) => confirm("Deseja recusar esta proposta?") && pedir(`/trocas/${id}/recusar`, { method: "POST" }),
    cancelar: (id) => confirm("Deseja cancelar esta proposta?") && pedir(`/trocas/${id}/cancelar`, { method: "POST" }),
    encerrar: (id) => confirm("Deseja encerrar esta troca? O outro usuário será avisado e os dois livros voltam para a lista de disponíveis.") &&
        pedir(`/trocas/${id}/cancelar`, { method: "POST" }),
    concluir: (id) => confirm("Confirma que a troca foi realizada?") && pedir(`/trocas/${id}/concluir`, { method: "POST" }),
    remover: (id) => confirm("Deseja remover este livro? Propostas pendentes com ele serão encerradas.") &&
        pedir(`/livros/${id}`, { method: "DELETE" }),
    avaliar: (id) => {
        const resposta = prompt("Digite uma nota de 1 a 5:");
        if (resposta === null) return;
        const nota = Number(resposta);
        if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
            alert("Digite uma nota inteira entre 1 e 5.");
            return;
        }
        return pedir(`/trocas/${id}/avaliar`, { method: "POST", body: JSON.stringify({ nota }) });
    },
    aviso: (id) => pedir(`/avisos/${id}/lido`, { method: "POST" })
};

document.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-acao]");
    if (!botao) return;
    acoes[botao.dataset.acao]?.(Number(botao.dataset.id));
});

carregar();
// confere de tempos em tempos se chegou algum aviso novo (outra pessoa aceitou, encerrou a troca...)
setInterval(() => { if (!document.hidden) carregar(); }, 30000);