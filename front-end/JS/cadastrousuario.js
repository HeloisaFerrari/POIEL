
const form = document.getElementById("formCadastro");
const msg = document.getElementById("mensagem");
const botao = form.querySelector('button[type="submit"]');
let enviando = false;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  // impede que um segundo clique envie o cadastro de novo enquanto o primeiro ainda está esperando
  if (enviando) return;

  const senha = document.getElementById("inputSenha").value;
  const confirma = document.getElementById("inputConfirmaSenha").value;

  if (!form.reportValidity()) {
    msg.textContent = "Preencha todos os campos corretamente.";
    msg.className = "mensagem erro";
    return;
  }
  if (senha !== confirma) {
    msg.textContent = "As senhas não são iguais.";
    msg.className = "mensagem erro";
    return;
  }

  enviando = true;
  botao.disabled = true;
  botao.textContent = "Cadastrando...";
  msg.textContent = "Enviando... o servidor pode levar até 1 minuto para responder na primeira vez.";
  msg.className = "mensagem";

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
    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      msg.textContent = dados.erro || "Erro ao cadastrar.";
      msg.className = "mensagem erro";
      liberarBotao();
      return;
    }

    // deu certo: o botão continua desativado até ir para a tela de login
    msg.textContent = "Cadastro realizado com sucesso! Redirecionando para o login...";
    msg.className = "mensagem ok";
    setTimeout(() => { window.location.href = "cadastroLogin.html"; }, 1500);
  } catch (erro) {
    msg.textContent = "Não foi possível conectar ao servidor.";
    msg.className = "mensagem erro";
    liberarBotao();
  }
});

function liberarBotao() {
  enviando = false;
  botao.disabled = false;
  botao.textContent = "Cadastrar";
}