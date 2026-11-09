const URL_API = "http://localhost:3000";

const formLogin = document.getElementById("formLogin");
const msg = document.getElementById("mensagem");

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const senha = document.getElementById("loginSenha").value;

  if (!email || !senha) {
    msg.textContent = "Informe e-mail e senha.";
    msg.className = "mensagem erro";
    return;
  }

  try {
    const resposta = await fetch(`${URL_API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });
    const dados = await resposta.json();

    if (!resposta.ok) {
      msg.textContent = dados.erro || "Erro ao fazer login.";
      msg.className = "mensagem erro";
      return;
    }

    // guarda o token e os dados do usuário no navegador para as outras páginas usarem
    localStorage.setItem("token", dados.token);
    localStorage.setItem("usuario", JSON.stringify(dados.usuario));

    window.location.href = "index.html";
  } catch (erro) {
    msg.textContent = "Não foi possível conectar ao servidor.";
    msg.className = "mensagem erro";
  }
});