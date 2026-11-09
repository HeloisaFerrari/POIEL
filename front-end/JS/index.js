/* ===== LOGIN E CONEXÃO COM O BACK-END ===== */
        const URL_API = "http://localhost:3000";
        const tokenLogin = localStorage.getItem("token");
        const usuarioLogado = JSON.parse(localStorage.getItem("usuario") || "null");
        if(!tokenLogin || !usuarioLogado){
            window.location.href = "cadastroLogin.html"; // sem login, volta para a página de login
        }
        const USUARIO_ID = usuarioLogado ? usuarioLogado.id : null;

        // as duas listas vêm do banco (função carregarDados, lá embaixo)
        let livros = [];
        let meusLivros = []; // livros do usuário logado: aparecem no passo "Realizar troca"

        async function chamarApi(rota, opcoes = {}){
            const resposta = await fetch(`${URL_API}${rota}`, {
                ...opcoes,
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tokenLogin }
            });
            if(resposta.status === 401){
                localStorage.removeItem("token");
                window.location.href = "cadastroLogin.html";
                throw new Error("Sessão expirada. Faça login novamente.");
            }
            const dados = await resposta.json();
            if(!resposta.ok) throw new Error(dados.erro || "Erro no servidor");
            return dados;
        }

        /* evita que um título com símbolos HTML quebre a página */
        function escapeHtml(texto){
            return String(texto).replace(/[&<>"']/g, c =>
                ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        }

        /* ===== ELEMENTOS ===== */
        const $ = id => document.getElementById(id);
        const grade = $("grade");
        const GENEROS = ["Romance", "Fantasia", "Ficção científica", "Suspense", "Terror", "Aventura", "Drama", "Biografia"];
        const LIVROS_POR_PAGINA = 10; // 2 linhas de 5 livros
        let paginaAtual = 1;
        const modal = new bootstrap.Modal($("modalLivro"));
        let generoAtual = "Todos";
        let livroAberto = null;
 
        /* ===== UTILIDADES ===== */
        function estrelas(n){
            const cheias = Math.round(n);
            return "★".repeat(cheias) + "☆".repeat(5 - cheias);
        }
 
        function capaHTML(src, titulo){
            const t = escapeHtml(titulo);
            if(!src) return `<div class="capa-fallback">${t}</div>`;
            // se a imagem não carregar, troca por um quadro com o título
            return `<img src="${escapeHtml(src)}" alt="Capa do livro ${t}" data-t="${t}" onerror="const d=document.createElement('div');d.className='capa-fallback';d.textContent=this.dataset.t;this.replaceWith(d)">`;
        }

        /* ===== GÊNEROS ===== */
        function montarGeneros(){
            const lista = ["Todos", ...GENEROS];
            $("generos").innerHTML = lista.map(g =>
                `<button class="chip ${g === generoAtual ? "ativo" : ""}" data-g="${g}">${g}</button>`
            ).join("");
        }
        $("generos").addEventListener("click", e => {
            const b = e.target.closest(".chip");
            if(!b) return;
            generoAtual = b.dataset.g;
            paginaAtual = 1;
            montarGeneros();
            montarGrade();
        });
 
        /* ===== GRADE DE LIVROS ===== */
        function montarGrade(){
            const termo = $("campoBusca").value.trim().toLowerCase();
            // busca e gênero funcionam juntos
            const filtrados = livros.filter(l =>
                (generoAtual === "Todos" || l.genero === generoAtual) &&
                (l.titulo.toLowerCase().includes(termo) || l.autor.toLowerCase().includes(termo))
            );

            const totalPaginas = Math.max(1, Math.ceil(filtrados.length / LIVROS_POR_PAGINA));
            if(paginaAtual > totalPaginas) paginaAtual = totalPaginas;
            const inicio = (paginaAtual - 1) * LIVROS_POR_PAGINA;
            const daPagina = filtrados.slice(inicio, inicio + LIVROS_POR_PAGINA);

            grade.innerHTML = daPagina.map(l => `
                <button class="card-livro" data-id="${l.id}">
                    <span class="badge-estado">${escapeHtml(l.estado)}</span>
                    <div class="capa-livro">${capaHTML(l.capa, l.titulo)}</div>
                    <div class="corpo">
                        <h3>${escapeHtml(l.titulo)}</h3>
                        <p class="detalhes">${escapeHtml(l.autor)}</p>
                    </div>
                </button>`).join("");

            $("semResultado").textContent = livros.length === 0
                ? "Ainda não há livros cadastrados. Cadastre o primeiro!"
                : "Nenhum livro encontrado. Tente outro nome ou gênero.";
            $("semResultado").classList.toggle("d-none", filtrados.length > 0);
            montarPaginacao(totalPaginas);
        }

        /* ===== PAGINAÇÃO ===== */
        function montarPaginacao(total){
            const nav = $("paginacao");
            if(total <= 1){ nav.innerHTML = ""; return; }

            // com muitas páginas mostra: 1 … 4 5 6 … 12
            const itens = [];
            for(let p = 1; p <= total; p++){
                if(total <= 7 || p === 1 || p === total || Math.abs(p - paginaAtual) <= 1) itens.push(p);
                else if(itens[itens.length - 1] !== "...") itens.push("...");
            }

            nav.innerHTML =
                `<button class="pag-btn" data-p="${paginaAtual - 1}" aria-label="Página anterior" ${paginaAtual === 1 ? "disabled" : ""}>‹</button>` +
                itens.map(p => p === "..."
                    ? `<span class="pag-pontos">…</span>`
                    : `<button class="pag-btn ${p === paginaAtual ? "ativo" : ""}" data-p="${p}" ${p === paginaAtual ? 'aria-current="page"' : ""}>${p}</button>`
                ).join("") +
                `<button class="pag-btn" data-p="${paginaAtual + 1}" aria-label="Próxima página" ${paginaAtual === total ? "disabled" : ""}>›</button>`;
        }

        $("paginacao").addEventListener("click", e => {
            const b = e.target.closest(".pag-btn");
            if(!b || b.disabled) return;
            paginaAtual = Number(b.dataset.p);
            montarGrade();
            $("biblioteca").scrollIntoView({ behavior: "smooth" }); // volta para o começo da lista
        });

        $("formBusca").addEventListener("submit", e => { e.preventDefault(); paginaAtual = 1; montarGrade(); });

        /* ===== MODAL ===== */
        grade.addEventListener("click", e => {
            const card = e.target.closest(".card-livro");
            if(card) abrirModal(Number(card.dataset.id));
        });
 
        function abrirModal(id){
            livroAberto = livros.find(l => l.id === id);
            const l = livroAberto;
            const meu = l.donoId === USUARIO_ID;
 
            $("mTitulo").textContent = l.titulo;
            $("mCapas").innerHTML = capaHTML(l.capa, l.titulo) + capaHTML(l.contracapa, "Contracapa");
            $("mGenero").textContent = l.genero;
            $("mAutor").textContent = l.autor;
            $("mEstado").textContent = l.estado;
            $("mDono").textContent = l.dono;
            $("mEstrelas").textContent = estrelas(l.nota);
            $("mNota").textContent = l.nota.toFixed(1).replace(".", ",");
 
            $("avisoMeu").classList.toggle("d-none", !meu);
            $("btnTrocar").disabled = meu;
            mostrarPasso("detalhes");
            modal.show();
        }
 
        function mostrarPasso(passo){
            const troca = passo === "troca";
            $("passoDetalhes").classList.toggle("d-none", troca);
            $("passoTroca").classList.toggle("d-none", !troca);
            $("btnTrocar").classList.toggle("d-none", troca);
            $("btnVoltar").classList.toggle("d-none", !troca);
            $("btnEnviar").classList.toggle("d-none", !troca);
            $("btnEnviar").disabled = true;
        }
 
        $("btnTrocar").addEventListener("click", () => {
            const lista = $("meusLivros");
            lista.innerHTML = meusLivros.map(l => `
                <label class="livro-opcao">
                    <input type="radio" name="oferta" value="${l.id}">
                    <span><strong>${escapeHtml(l.titulo)}</strong><br><small>${escapeHtml(l.autor)}</small></span>
                </label>`).join("");
            $("semLivros").classList.toggle("d-none", meusLivros.length > 0);
            mostrarPasso("troca");
        });
 
        $("btnVoltar").addEventListener("click", () => mostrarPasso("detalhes"));
 
        $("meusLivros").addEventListener("change", () => { $("btnEnviar").disabled = false; });
 
        $("btnEnviar").addEventListener("click", () => {
            const oferta = document.querySelector("input[name='oferta']:checked");
            if(!oferta) return;
            /* Aqui o back-end deve criar o registro em "troca":
               { livroDesejadoId: livroAberto.id, livroOferecidoId: Number(oferta.value) } */
            console.log("Proposta:", livroAberto.id, "em troca de", oferta.value);
            modal.hide();
            alert("Proposta enviada! Acompanhe em Minhas trocas.");
        });
 
        /* ===== INÍCIO ===== */
        /* busca os livros no banco e desenha a página */
        async function carregarDados(){
            try{
                const lista = await chamarApi("/livros");
                livros = lista.map(l => ({
                    id: l.id_livro,
                    titulo: l.titulo,
                    autor: l.autor,
                    genero: l.genero,
                    estado: l.estado_conservacao,
                    donoId: l.id_usuario,
                    dono: l.dono,
                    nota: Number(l.avaliacao_dono) || 0,
                    capa: l.capa_url || "",
                    contracapa: l.contracapa_url || ""
                }));
                meusLivros = livros.filter(l => l.donoId === USUARIO_ID);
            }catch(erro){
                $("semResultado").textContent = "Não foi possível carregar os livros. O servidor está ligado?";
                $("semResultado").classList.remove("d-none");
                return;
            }
            montarGrade();
        }

        montarGeneros();
        carregarDados();