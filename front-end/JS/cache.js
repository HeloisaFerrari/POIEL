/* ===== MEMÓRIA DO SITE =====
   Guarda no navegador a última resposta do servidor. Assim a página abre na hora com o que já
   sabe e, em seguida, confere com o servidor e só redesenha se alguma coisa mudou. */

const cacheDoUsuario = {
    // cada pessoa tem as suas próprias chaves (poiel:<id>:<nome>)
    chave(nome) {
        let id = "anon";
        try { id = JSON.parse(localStorage.getItem("usuario")).id; } catch (e) { /* ainda sem login */ }
        return "poiel:" + id + ":" + nome;
    },
    ler(nome) {
        try {
            const texto = localStorage.getItem(this.chave(nome));
            return texto ? JSON.parse(texto) : null;
        } catch (e) { return null; }
    },
    guardar(nome, valor) {
        try { localStorage.setItem(this.chave(nome), JSON.stringify(valor)); }
        catch (e) { /* sem espaço no navegador: o site continua funcionando, só sem a memória */ }
    },
    // esquece um dado que acabou de mudar, para a próxima visita não mostrar a versão velha
    invalidar(...nomes) {
        nomes.forEach((nome) => localStorage.removeItem(this.chave(nome)));
    },
    limparTudo() {
        Object.keys(localStorage)
            .filter((k) => k.startsWith("poiel:"))
            .forEach((k) => localStorage.removeItem(k));
    }
};

/* 1) mostra o que está guardado (se houver)  2) busca no servidor  3) redesenha só se mudou.
   Se o servidor falhar mas já havia algo na tela, a tela continua como está. */
async function carregarComCache(nome, buscar, desenhar, { mostrarCache = true } = {}) {
    const antigo = cacheDoUsuario.ler(nome);
    if (mostrarCache && antigo !== null) desenhar(antigo);

    let novo;
    try {
        novo = await buscar();
    } catch (erro) {
        if (mostrarCache && antigo !== null) return antigo;
        throw erro;
    }

    if (antigo === null || JSON.stringify(novo) !== JSON.stringify(antigo)) desenhar(novo);
    cacheDoUsuario.guardar(nome, novo);
    return novo;
}