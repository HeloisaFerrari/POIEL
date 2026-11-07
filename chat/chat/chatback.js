// ============================================================
// POIEL — Mensagens (frontend)
// API: Node.js + Express + MySQL (server/server.js)
// ============================================================

const API_URL = 'http://localhost:3000/api';

let token = null;          // token de sessão retornado pelo login
let usuarioAtual = null;   // { nome, email }
let contatoAtivo = null;   // { id, nome, email }
let ultimaMsgId = 0;       // id da última mensagem carregada
let timerPolling = null;   // intervalo de busca por novas mensagens

const $ = id => document.getElementById(id);

// ============================================================
// 1. CAMADA DE API
// ============================================================
const api = {
  async post(rota, corpo) {
    const r = await fetch(`${API_URL}/${rota}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      body: JSON.stringify(corpo)
    });
    return r.json();
  },

  async get(rota) {
    const r = await fetch(`${API_URL}/${rota}`, {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {}
    });
    return r.json();
  }
};

// ============================================================
// 2. AUTENTICAÇÃO
// ============================================================
$('toggle-auth').addEventListener('click', () => {
  $('form-login').hidden = !$('form-login').hidden;
  $('form-cadastro').hidden = !$('form-cadastro').hidden;
  $('toggle-auth').textContent = $('form-login').hidden
    ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastre-se';
});

$('form-cadastro').addEventListener('submit', async e => {
  e.preventDefault();
  $('auth-erro').textContent = '';
  const r = await api.post('cadastro', {
    nome: $('cad-nome').value.trim(),
    email: $('cad-email').value.trim(),
    senha: $('cad-senha').value
  });
  if (r.erro) return $('auth-erro').textContent = r.erro;
  entrarNoApp(r);
});

$('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  $('auth-erro').textContent = '';
  const r = await api.post('login', {
    email: $('login-email').value.trim(),
    senha: $('login-senha').value
  });
  if (r.erro) return $('auth-erro').textContent = r.erro;
  entrarNoApp(r);
});

$('btn-sair').addEventListener('click', () => {
  clearInterval(timerPolling);
  token = null;
  usuarioAtual = null;
  contatoAtivo = null;
  location.reload();
});

function entrarNoApp(r) {
  token = r.token;
  usuarioAtual = r;
  $('auth-screen').hidden = true;
  $('app').hidden = false;
  $('usuario-logado').textContent = r.email;
  carregarContatos();
}

// ============================================================
// 3. CONTATOS
// ============================================================
$('form-contato').addEventListener('submit', async e => {
  e.preventDefault();
  const r = await api.post('contatos', { email: $('contato-email').value.trim() });
  if (r.erro) return alert(r.erro);
  $('contato-email').value = '';
  carregarContatos();
});

async function carregarContatos() {
  const r = await api.get('contatos');
  if (r.erro) return;
  $('lista-contatos').innerHTML = '';
  (r.contatos || []).forEach(c => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="avatar" style="background:${corDe(c.email)}">🐈</span>
                    <span>${c.nome || c.email}</span>`;
    li.addEventListener('click', () => abrirChat(c, li));
    $('lista-contatos').appendChild(li);
  });
}

// Cor do avatar derivada do e-mail (cada contato tem uma cor própria)
function corDe(email) {
  let h = 0;
  for (const ch of email) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 45%, 82%)`;
}

// ============================================================
// 4. CHAT COM POLLING (tempo real a cada 2,5s)
// ============================================================
async function abrirChat(contato, li) {
  document.querySelectorAll('#lista-contatos li').forEach(x => x.classList.remove('ativo'));
  li.classList.add('ativo');

  contatoAtivo = contato;
  ultimaMsgId = 0;
  $('mensagens').innerHTML = '';
  $('chat-cabecalho').textContent = `🐈 ${contato.nome || contato.email}`;
  $('campo-msg').disabled = false;
  $('form-msg').querySelector('button').disabled = false;

  clearInterval(timerPolling);
  await buscarNovasMensagens();                    // carrega histórico
  timerPolling = setInterval(buscarNovasMensagens, 2500);
}

async function buscarNovasMensagens() {
  if (!contatoAtivo) return;
  const r = await api.get(
    `mensagens?com=${encodeURIComponent(contatoAtivo.email)}&depois=${ultimaMsgId}`
  );
  if (r.erro) return;

  r.mensagens.forEach(m => {
    renderMsg(m);
    ultimaMsgId = Math.max(ultimaMsgId, m.id);
  });
  if (r.mensagens.length) {
    $('mensagens').scrollTop = $('mensagens').scrollHeight;
  }
}

function renderMsg(m) {
  const div = document.createElement('div');
  div.className = 'msg ' + (m.minha ? 'enviada' : 'recebida');
  // textContent evita injeção de HTML (XSS) na mensagem
  const spanTexto = document.createElement('span');
  spanTexto.textContent = m.texto;
  const spanHora = document.createElement('span');
  spanHora.className = 'hora';
  spanHora.textContent = m.hora;
  div.appendChild(spanTexto);
  div.appendChild(spanHora);
  $('mensagens').appendChild(div);
}

$('form-msg').addEventListener('submit', async e => {
  e.preventDefault();
  const texto = $('campo-msg').value.trim();
  if (!texto || !contatoAtivo) return;

  $('campo-msg').value = '';
  const r = await api.post('mensagens', { para: contatoAtivo.email, texto });
  if (r.erro) return alert(r.erro);
  await buscarNovasMensagens();   // exibe a própria mensagem na hora
});