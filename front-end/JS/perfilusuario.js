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
                </div>
            </div>
        </article>`;
}

async function carregarPerfil() {
    try {
        const [perfil, livros] = await Promise.all([
            chamarApi("/perfil"),
            chamarApi("/meus-livros")
        ]);

        perfilAtual = perfil;
        desenharCartao(perfil);
        $("stat-livros").textContent = perfil.total_livros;

        $("meus-livros-grade").innerHTML = livros.length > 0
            ? livros.map(cardLivro).join("")
            : `<p class="perfil-subtitulo">Você ainda não cadastrou nenhum livro.</p>`;
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

carregarPerfil();