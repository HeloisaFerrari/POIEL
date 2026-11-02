/* ===== GLOBAL: monta a navbar e o footer em todas as páginas =====
   Para mudar um link ou o texto do footer, mude AQUI e vale para o site todo. */

const NAV_POIEL = `
<nav class="nav-poiel" aria-label="Navegação principal">
    <div class="nav-conteudo">
        <a class="nav-marca" href="index.html">POIEL</a>
        <button class="nav-botao" id="nav-botao" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="nav-links">
            <span></span><span></span><span></span>
        </button>
        <ul class="nav-links" id="nav-links">
            <li><a href="index.html">Principal</a></li>
            <li><a href="paginadetroca.html">Minhas Trocas</a></li>
            <li><a href="cadastrousuario.html">Cadastro</a></li>
            <li><a href="sobrenos.html">Sobre nós</a></li>
        </ul>
    </div>
</nav>`;

const FOOTER_POIEL = `
<footer class="footer-poiel">
    <p>Sua próxima história pode estar na estante de alguém.</p>
</footer>`;

const slotNav = document.getElementById('poiel-navbar');
const slotFooter = document.getElementById('poiel-footer');
if (slotNav) slotNav.outerHTML = NAV_POIEL;
if (slotFooter) slotFooter.outerHTML = FOOTER_POIEL;

/* Menu "hambúrguer" no celular */
const navBotao = document.getElementById('nav-botao');
const navLinks = document.getElementById('nav-links');
if (navBotao && navLinks) {
    navBotao.addEventListener('click', () => {
        const aberto = navLinks.classList.toggle('aberto');
        navBotao.setAttribute('aria-expanded', aberto);
    });
}