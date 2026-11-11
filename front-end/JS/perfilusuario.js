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

/* "Heloisa Rosa Ferrari" -> "HF" (primeira letra do primeiro e do último nome) */
function iniciais(nome) {
    const partes = nome.trim().split(/\s+/);
    const primeira = partes[0][0];
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
    return (primeira + ultima).toUpperCase();
}

const $ = (id) => document.getElementById(id);

const GENEROS = ["Romance", "Fantasia", "Ficção científica", "Suspense", "Terror", "Aventura", "Drama", "Biografia"];
const ESTADOS = ["Novo", "Excelente", "Bom", "Regular", "Desgastado"];
let livrosAtuais = []; // livros que estão na tela
const SITUACOES = { em_negociacao: "Em troca", trocado: "Trocado" };

let perfilAtual = null;   // dados do perfil que estão na tela
let fotoNova;             // undefined = não mexeu na foto | null = remover | texto = foto nova

/* ===== DESENHAR A PÁGINA ===== */
function fotoOuIniciais(foto, nome) {
    return foto
        ? `<img src="${escapeHtml(foto)}" alt="Foto de perfil">`
        : escapeHtml(iniciais(nome));
}

function desenharCartao(perfil) {
    $("perfil-avatar").innerHTML = fotoOuIniciais(perfil.foto, perfil.nome_completo);
    $("perfil-nome").textContent = perfil.nome_completo;
    $("perfil-modulo").textContent = perfil.modulo;
    $("perfil-curso").textContent = perfil.curso_tecnico;
    $("perfil-email").textContent = perfil.email;
    $("perfil-bio").textContent = perfil.bio ? `"${perfil.bio}"` : "";
    $("perfil-bio").hidden = !perfil.bio;
}

function cardLivro(livro) {
    const titulo = escapeHtml(livro.titulo);
    const capa = livro.capa_url
        ? `<img src="${escapeHtml(livro.capa_url)}" alt="Capa do livro ${titulo}">`
        : titulo;

    return `
        <article class="livro-card">
            <div class="livro-capa-area">
                <div class="livro-capa">${capa}</div>
            </div>
            <div class="livro-corpo">
                <h3>${titulo}</h3>
                <p class="livro-autor">${escapeHtml(livro.autor)}</p>
                <div class="livro-etiquetas">
                    <span class="etiqueta">${escapeHtml(livro.genero)}</span>
                    <span class="etiqueta">${escapeHtml(livro.estado_conservacao)}</span>
                    ${SITUACOES[livro.status] ? `<span class="etiqueta">${SITUACOES[livro.status]}</span>` : ""}
                </div>
                <div class="livro-acoes">
                    <button type="button" class="botao-contorno botao-pequeno" data-acao="editar" data-id="${livro.id_livro}">Editar</button>
                    ${livro.status === "disponivel" ? `<button type="button" class="botao-contorno botao-pequeno botao-perigo" data-acao="excluir" data-id="${livro.id_livro}">Excluir</button>` : ""}
                </div>
            </div>
        </article>`;
}

function desenharLivros(livros) {
    livrosAtuais = livros;
    $("stat-livros").textContent = livros.length;
    $("meus-livros-grade").innerHTML = livros.length > 0
        ? livros.map(cardLivro).join("")
        : `<p class="perfil-subtitulo">Você ainda não cadastrou nenhum livro.</p>`;
}

async function recarregarLivros() {
    desenharLivros(await chamarApi("/meus-livros"));
}

async function carregarPerfil() {
    try {
        const [perfil, livros] = await Promise.all([
            chamarApi("/perfil"),
            chamarApi("/meus-livros")
        ]);

        perfilAtual = perfil;
        desenharCartao(perfil);
        desenharLivros(livros);
        $("stat-trocas").textContent = perfil.trocas_realizadas;
        $("stat-propostas").textContent = perfil.propostas_pendentes;
    } catch (erro) {
        $("perfil-nome").textContent = "Não foi possível carregar o perfil";
        $("meus-livros-grade").innerHTML =
            `<p class="perfil-subtitulo">${escapeHtml(erro.message)} O servidor está ligado?</p>`;
    }
}

/* ===== EDITAR PERFIL (módulo, bio e foto) ===== */
const dialogo = $("dialogo-editar");

function atualizarPrevia(foto) {
    $("foto-previa").innerHTML = fotoOuIniciais(foto, perfilAtual.nome_completo);
}

function atualizarContador() {
    $("bio-contador").textContent = $("edit-bio").value.length + "/200";
}

/* corta a foto em quadrado (pelo centro) e reduz, para o banco não ficar pesado */
function fotoQuadrada(dataUrl, lado = 300) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const menor = Math.min(img.width, img.height);
            const origemX = (img.width - menor) / 2;
            const origemY = (img.height - menor) / 2;
            const canvas = document.createElement("canvas");
            canvas.width = lado;
            canvas.height = lado;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, lado, lado);
            ctx.drawImage(img, origemX, origemY, menor, menor, 0, 0, lado, lado);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

$("btn-editar").addEventListener("click", (e) => {
    e.preventDefault();
    if (!perfilAtual) return; // o perfil ainda não carregou
    fotoNova = undefined;
    $("edit-modulo").value = perfilAtual.modulo;
    $("edit-bio").value = perfilAtual.bio || "";
    $("editar-msg").textContent = "";
    atualizarContador();
    atualizarPrevia(perfilAtual.foto);
    dialogo.showModal();
});

$("btn-cancelar").addEventListener("click", () => dialogo.close());
$("edit-bio").addEventListener("input", atualizarContador);

$("foto-arquivo").addEventListener("change", (e) => {
    const arquivo = e.target.files[0];
    e.target.value = ""; // deixa escolher o mesmo arquivo de novo, se quiser
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
        $("editar-msg").textContent = "Escolha um arquivo de imagem.";
        return;
    }
    const leitor = new FileReader();
    leitor.onload = async () => {
        const reduzida = await fotoQuadrada(leitor.result);
        if (!reduzida) {
            $("editar-msg").textContent = "Não foi possível usar essa imagem.";
            return;
        }
        $("editar-msg").textContent = "";
        fotoNova = reduzida;
        atualizarPrevia(reduzida);
    };
    leitor.readAsDataURL(arquivo);
});

$("foto-remover").addEventListener("click", () => {
    fotoNova = null;
    atualizarPrevia(null);
});

$("form-editar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = $("btn-salvar");
    botao.disabled = true;
    try {
        const atualizado = await chamarApi("/perfil", {
            method: "PUT",
            body: JSON.stringify({
                modulo: $("edit-modulo").value,
                bio: $("edit-bio").value.trim(),
                alterarFoto: fotoNova !== undefined,
                foto: fotoNova === undefined ? null : fotoNova
            })
        });
        perfilAtual = { ...perfilAtual, ...atualizado };
        desenharCartao(perfilAtual);
        dialogo.close();
    } catch (erro) {
        $("editar-msg").textContent = erro.message;
    } finally {
        botao.disabled = false;
    }
});

/* ===== EDITAR E EXCLUIR LIVROS ===== */
$("meus-livros-grade").addEventListener("click", (e) => {
    const botao = e.target.closest("button[data-acao]");
    if (!botao) return;
    const livro = livrosAtuais.find(l => l.id_livro === Number(botao.dataset.id));
    if (!livro) return;
    if (botao.dataset.acao === "editar") abrirEdicaoLivro(livro);
    else abrirExclusao(livro);
});

/* --- excluir --- */
let livroParaExcluir = null;

function abrirExclusao(livro) {
    livroParaExcluir = livro;
    $("excluir-titulo").textContent = livro.titulo; // textContent: seguro contra símbolos HTML
    $("excluir-msg").textContent = "";
    $("dialogo-excluir").showModal();
}

$("btn-excluir-cancelar").addEventListener("click", () => $("dialogo-excluir").close());

$("btn-excluir-confirmar").addEventListener("click", async () => {
    const botao = $("btn-excluir-confirmar");
    botao.disabled = true;
    try {
        await chamarApi("/livros/" + livroParaExcluir.id_livro, { method: "DELETE" });
        $("dialogo-excluir").close();
        await recarregarLivros();
    } catch (erro) {
        $("excluir-msg").textContent = erro.message; // ex.: livro que já está em uma troca
    } finally {
        botao.disabled = false;
    }
});

/* --- editar --- */
let livroEditando = null;
let capaNova;        // undefined = não mexeu | null = remover | texto = imagem nova
let contracapaNova;

function preencherOpcoes(select, lista, atual) {
    const todas = lista.includes(atual) ? lista : [...lista, atual]; // mantém um valor antigo que não está na lista
    select.innerHTML = todas.map(v => `<option>${escapeHtml(v)}</option>`).join("");
    select.value = atual;
}

function mostrarPreviaCapa(idElemento, src) {
    $(idElemento).innerHTML = src ? `<img src="${escapeHtml(src)}" alt="">` : "Sem foto";
}

/* reduz a imagem mantendo a proporção, para o banco não ficar pesado */
function reduzirImagem(dataUrl, ladoMaximo = 700) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const escala = Math.min(1, ladoMaximo / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * escala);
            canvas.height = Math.round(img.height * escala);
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.75));
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

function abrirEdicaoLivro(livro) {
    livroEditando = livro;
    capaNova = undefined;
    contracapaNova = undefined;
    $("livro-titulo").value = livro.titulo;
    $("livro-autor").value = livro.autor;
    preencherOpcoes($("livro-genero"), GENEROS, livro.genero);
    preencherOpcoes($("livro-estado"), ESTADOS, livro.estado_conservacao);
    mostrarPreviaCapa("capa-previa", livro.capa_url);
    mostrarPreviaCapa("contracapa-previa", livro.contracapa_url);
    $("livro-msg").textContent = "";
    $("dialogo-livro").showModal();
}

function ligarCampoFoto(idArquivo, idRemover, idPrevia, definir) {
    $(idArquivo).addEventListener("change", (e) => {
        const arquivo = e.target.files[0];
        e.target.value = ""; // deixa escolher o mesmo arquivo de novo, se quiser
        if (!arquivo) return;
        if (!arquivo.type.startsWith("image/")) {
            $("livro-msg").textContent = "Escolha um arquivo de imagem.";
            return;
        }
        const leitor = new FileReader();
        leitor.onload = async () => {
            const reduzida = await reduzirImagem(leitor.result);
            if (!reduzida) {
                $("livro-msg").textContent = "Não foi possível usar essa imagem.";
                return;
            }
            $("livro-msg").textContent = "";
            definir(reduzida);
            mostrarPreviaCapa(idPrevia, reduzida);
        };
        leitor.readAsDataURL(arquivo);
    });
    $(idRemover).addEventListener("click", () => {
        definir(null);
        mostrarPreviaCapa(idPrevia, null);
    });
}

ligarCampoFoto("capa-arquivo", "capa-remover", "capa-previa", (v) => { capaNova = v; });
ligarCampoFoto("contracapa-arquivo", "contracapa-remover", "contracapa-previa", (v) => { contracapaNova = v; });

$("btn-livro-cancelar").addEventListener("click", () => $("dialogo-livro").close());

$("form-livro").addEventListener("submit", async (e) => {
    e.preventDefault();
    const titulo = $("livro-titulo").value.trim();
    const autor = $("livro-autor").value.trim();
    if (!titulo || !autor) {
        $("livro-msg").textContent = "Preencha o título e o autor.";
        return;
    }

    const botao = $("btn-livro-salvar");
    botao.disabled = true;
    try {
        await chamarApi("/livros/" + livroEditando.id_livro, {
            method: "PUT",
            body: JSON.stringify({
                titulo,
                autor,
                genero: $("livro-genero").value,
                estado: $("livro-estado").value,
                alterarCapa: capaNova !== undefined,
                capa: capaNova === undefined ? null : capaNova,
                alterarContracapa: contracapaNova !== undefined,
                contracapa: contracapaNova === undefined ? null : contracapaNova
            })
        });
        $("dialogo-livro").close();
        await recarregarLivros();
    } catch (erro) {
        $("livro-msg").textContent = erro.message;
    } finally {
        botao.disabled = false;
    }
});

carregarPerfil();