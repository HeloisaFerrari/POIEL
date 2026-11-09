const URL_API = "http://localhost:3000";

const form = document.getElementById("formCadastro");
const msg = document.getElementById("mensagem");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const senha = document.getElementById("inputSenha").value;
  const confirma = document.getElementById("inputConfirmaSenha").value;

  if (!form.checkValidity()) {
    msg.textContent = "Preencha todos os campos corretamente.";
    msg.className = "mensagem erro";
    return;
  }
  if (senha !== confirma) {
    msg.textContent = "As senhas não são iguais.";
    msg.className = "mensagem erro";
    return;
  }

  try {
    const resposta = await fetch(`${URL_API}/cadastro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: document.getElementById("inputNome").value,
        email: document.getElementById("inputEmail").value,
        matricula: document.getElementById("inputMatricula").value,
        curso: document.getElementById("selectCurso").value,
        modulo: document.getElementById("selectModulo").value,
        senha: senha
      })
    });
    const dados = await resposta.json();

    if (!resposta.ok) {
      msg.textContent = dados.erro || "Erro ao cadastrar.";
      msg.className = "mensagem erro";
      return;
    }

    msg.textContent = "Cadastro realizado com sucesso! Redirecionando para o login...";
    msg.className = "mensagem ok";
    setTimeout(() => { window.location.href = "cadastroLogin.html"; }, 1500);
  } catch (erro) {
    msg.textContent = "Não foi possível conectar ao servidor.";
    msg.className = "mensagem erro";
  }
});