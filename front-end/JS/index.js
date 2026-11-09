const USUARIO_ID = 1;
 
        const livros = [
            { id: 1,  titulo: "O Pequeno Príncipe", autor: "Antoine de Saint-Exupéry", genero: "Fantasia", estado: "Excelente", donoId: 2, dono: "Ana Souza", nota: 5.0, capa: "img/Pequeno_Príncipe.jpg", contracapa: "" },
            { id: 2,  titulo: "Dom Casmurro", autor: "Machado de Assis", genero: "Romance", estado: "Bom", donoId: 3, dono: "Lucas Pereira", nota: 4.5, capa: "img/Dom_Casmurro.jpg", contracapa: "" },
            { id: 3,  titulo: "Capitães da Areia", autor: "Jorge Amado", genero: "Drama", estado: "Regular", donoId: 4, dono: "Marina Costa", nota: 4.0, capa: "img/Capitaes_da_areia.jpg", contracapa: "" },
            { id: 4,  titulo: "A Hora da Estrela", autor: "Clarice Lispector", genero: "Romance", estado: "Bom", donoId: 1, dono: "Você", nota: 4.8, capa: "", contracapa: "" },
            { id: 5,  titulo: "O Hobbit", autor: "J. R. R. Tolkien", genero: "Fantasia", estado: "Excelente", donoId: 5, dono: "Pedro Lima", nota: 4.7, capa: "", contracapa: "" },
            { id: 6,  titulo: "1984", autor: "George Orwell", genero: "Ficção científica", estado: "Bom", donoId: 2, dono: "Ana Souza", nota: 5.0, capa: "", contracapa: "" },
            { id: 7,  titulo: "Frankenstein", autor: "Mary Shelley", genero: "Terror", estado: "Regular", donoId: 3, dono: "Lucas Pereira", nota: 4.5, capa: "", contracapa: "" },
            { id: 8,  titulo: "Drácula", autor: "Bram Stoker", genero: "Terror", estado: "Bom", donoId: 4, dono: "Marina Costa", nota: 4.0, capa: "", contracapa: "" },
            { id: 9,  titulo: "O Cão dos Baskervilles", autor: "Arthur Conan Doyle", genero: "Suspense", estado: "Excelente", donoId: 5, dono: "Pedro Lima", nota: 4.7, capa: "", contracapa: "" },
            { id: 10, titulo: "A Ilha do Tesouro", autor: "Robert Louis Stevenson", genero: "Aventura", estado: "Novo", donoId: 2, dono: "Ana Souza", nota: 5.0, capa: "", contracapa: "" },
            { id: 11, titulo: "O Conde de Monte Cristo", autor: "Alexandre Dumas", genero: "Aventura", estado: "Bom", donoId: 3, dono: "Lucas Pereira", nota: 4.5, capa: "", contracapa: "" },
            { id: 12, titulo: "O Diário de Anne Frank", autor: "Anne Frank", genero: "Biografia", estado: "Excelente", donoId: 4, dono: "Marina Costa", nota: 4.0, capa: "", contracapa: "" },
            { id: 13, titulo: "Os Miseráveis", autor: "Victor Hugo", genero: "Drama", estado: "Regular", donoId: 5, dono: "Pedro Lima", nota: 4.7, capa: "", contracapa: "" },
            { id: 14, titulo: "Admirável Mundo Novo", autor: "Aldous Huxley", genero: "Ficção científica", estado: "Bom", donoId: 1, dono: "Você", nota: 4.8, capa: "", contracapa: "" },
            { id: 15, titulo: "Orgulho e Preconceito", autor: "Jane Austen", genero: "Romance", estado: "Excelente", donoId: 2, dono: "Ana Souza", nota: 5.0, capa: "", contracapa: "" }
        ];
 
        // Livros do usuário logado (os de "Minhas trocas"). Deixe [] para testar a mensagem de vazio.
        const meusLivros = livros.filter(l => l.donoId === USUARIO_ID);
 
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
 
        function capaHTML(src, titulo, extra = ""){
            const fallback = `<div class="capa-fallback ${extra}">${titulo}</div>`;
            if(!src) return fallback;
            return `<img src="${src}" alt="Capa do livro ${titulo}" onerror="this.outerHTML=this.dataset.fb" data-fb='${fallback.replace(/'/g, "&#39;")}'>`;
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
                    <span class="badge-estado">${l.estado}</span>
                    <div class="capa-livro">${capaHTML(l.capa, l.titulo)}</div>
                    <div class="corpo">
                        <h3>${l.titulo}</h3>
                        <p class="detalhes">${l.autor}</p>
                    </div>
                </button>`).join("");

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
                    <span><strong>${l.titulo}</strong><br><small>${l.autor}</small></span>
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
        montarGeneros();
        montarGrade();