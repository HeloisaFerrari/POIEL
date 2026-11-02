const USUARIO_ID = 1;
 
        const livros = [
            { id: 1, titulo: "O Pequeno Príncipe", autor: "Antoine de Saint-Exupéry", genero: "Fábula", estado: "Ótimo", donoId: 2, dono: "Ana Souza", nota: 5.0, capa: "img/Pequeno_Príncipe.jpg", contracapa: "" },
            { id: 2, titulo: "Dom Casmurro", autor: "Machado de Assis", genero: "Romance", estado: "Bom", donoId: 3, dono: "Lucas Pereira", nota: 4.5, capa: "img/Dom_Casmurro.jpg", contracapa: "" },
            { id: 3, titulo: "Capitães da Areia", autor: "Jorge Amado", genero: "Romance", estado: "Regular", donoId: 4, dono: "Marina Costa", nota: 4.0, capa: "img/Capitaes_da_areia.jpg", contracapa: "" },
            { id: 4, titulo: "A Hora da Estrela", autor: "Clarice Lispector", genero: "Romance", estado: "Bom", donoId: 1, dono: "Você", nota: 4.8, capa: "", contracapa: "" },
            { id: 5, titulo: "O Hobbit", autor: "J. R. R. Tolkien", genero: "Fantasia", estado: "Ótimo", donoId: 5, dono: "Pedro Lima", nota: 4.7, capa: "", contracapa: "" }
        ];
 
        // Livros do usuário logado (os de "Minhas trocas"). Deixe [] para testar a mensagem de vazio.
        const meusLivros = livros.filter(l => l.donoId === USUARIO_ID);
 
        /* ===== ELEMENTOS ===== */
        const $ = id => document.getElementById(id);
        const carrossel = $("carrossel");
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
            const lista = ["Todos", ...new Set(livros.map(l => l.genero))];
            $("generos").innerHTML = lista.map(g =>
                `<button class="chip ${g === generoAtual ? "ativo" : ""}" data-g="${g}">${g}</button>`
            ).join("");
        }
        $("generos").addEventListener("click", e => {
            const b = e.target.closest(".chip");
            if(!b) return;
            generoAtual = b.dataset.g;
            montarGeneros();
            montarCarrossel();
        });
 
        /* ===== CARROSSEL ===== */
        function montarCarrossel(){
            const termo = $("campoBusca").value.trim().toLowerCase();
            const filtrados = livros.filter(l =>
                (generoAtual === "Todos" || l.genero === generoAtual) &&
                (l.titulo.toLowerCase().includes(termo) || l.autor.toLowerCase().includes(termo))
            );
 
            carrossel.innerHTML = filtrados.map(l => `
                <button class="card-livro" data-id="${l.id}">
                    <div class="capa-livro">${capaHTML(l.capa, l.titulo)}</div>
                    <div class="corpo">
                        <h3>${l.titulo}</h3>
                        <p class="detalhes">${l.autor}</p>
                    </div>
                </button>`).join("");
 
            $("semResultado").classList.toggle("d-none", filtrados.length > 0);
        }
 
        $("formBusca").addEventListener("submit", e => { e.preventDefault(); montarCarrossel(); });
        $("setaEsq").addEventListener("click", () => carrossel.scrollBy({ left: -420 }));
        $("setaDir").addEventListener("click", () => carrossel.scrollBy({ left: 420 }));
 
        /* ===== MODAL ===== */
        carrossel.addEventListener("click", e => {
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
        montarCarrossel();