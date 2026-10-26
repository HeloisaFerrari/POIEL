const form = document.getElementById("formCadastro");
const msg = document.getElementById("mensagem");

form.addEventListener("submit", (e) => {
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

  msg.textContent = "Cadastro realizado com sucesso!";
  msg.className = "mensagem ok";
});