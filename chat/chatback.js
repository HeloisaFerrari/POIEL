// ============================================================
// POIEL — Mensagens (Frontend integrado ao chatapi.js)
// ============================================================

const API_URL = 'http://localhost:3000/api';

let token = sessionStorage.getItem('poiel_token') || null;
let usuarioAtual = JSON.parse(sessionStorage.getItem('poiel_usuario') || 'null');
let contatoAtivo = null;
let ultimaMsgId = 0;
let timerPolling = null;

const $ = id => document.getElementById(id);

// Menu responsivo da barra de navegação
const navBotao = $('nav-botao');
const navLinks = $('nav-links');
if (navBotao && navLinks) {
  navBotao.addEventListener('click', () => {
    const expandido = navBotao.getAttribute('aria-expanded') === 'true';
    navBotao.setAttribute('aria-expanded', String(!expandido));
    navLinks.classList.toggle('ativo');
  });
}

// ============================================================
// 1. CAMADA DE API
// ============================================================
const api = {
  async post(rota, corpo) {
    try {
      const r = await fetch(`${API_URL}/${rota}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {})
        },
        body: JSON.stringify(corpo)
      });
      return await r.json();
    } catch {
      return { erro: 'Falha ao conectar com o servidor.' };
    }
  },

  async get(rota) {
    try {
      const r = await fetch(`${API_URL}/${rota}`, {
        headers: token ? { Authorization: 'Bearer ' + token } : {}
      });
      return await r.json();
    } catch {
      return { erro: 'Falha ao conectar com o servidor.' };
    }
  }
};

// ============================================================
// 2. AUTENTICAÇÃO
// ============================================================
const btnToggleAuth = $('toggle-auth');
if (btnToggleAuth) {
  btnToggleAuth.addEventListener('click', () => {
    $('auth-erro').textContent = '';
    $('form-login').hidden = !$('form-login').hidden;
    $('form-cadastro').hidden = !$('form-cadastro').hidden;
    btnToggleAuth.textContent = $('form-login').hidden
      ? 'Já tem conta? Entrar'
      : 'Não tem conta? Cadastre-se';
  });
}

$('form-cadastro').addEventListener('submit', async e => {
  e.preventDefault();
  $('auth-erro').textContent = '';

  const r = await api.post('cadastro', {
    nome_completo: $('cad-nome').value.trim(),
    email: $('cad-email').value.trim(),
    matricula: $('cad-matricula').value.trim(),
    curso_tecnico: $('cad-curso').value.trim(),
    modulo: $('cad-modulo').value.trim(),
    senha: $('cad-senha').value
  });

  if (r.erro) {
    $('auth-erro').textContent = r.erro;
    return;
  }
  entrarNoApp(r);
});

$('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  $('auth-erro').textContent = '';

  const r = await api.post('login', {
    email: $('login-email').value.trim(),
    senha: $('login-senha').value
  });

  if (r.erro) {
    $('auth-erro').textContent = r.erro;
    return;
  }
  entrarNoApp(r);
});

$('btn-sair').addEventListener('click', () => {
  clearInterval(timerPolling);
  sessionStorage.removeItem('poiel_token');
  sessionStorage.removeItem('poiel_usuario');
  token = null;
  usuarioAtual = null;
  contatoAtivo = null;
  location.reload();
});

function entrarNoApp(r) {
  token = r.token;
  usuarioAtual = r;
  sessionStorage.setItem('poiel_token', token);
  sessionStorage.setItem('poiel_usuario', JSON.stringify(r));

  $('auth-screen').hidden = true;
  $('app').hidden = false;
  $('usuario-logado').textContent = `${r.nome || r.email}`;
  carregarContatos();
}

// Restaura sessão caso já esteja autenticado
if (token && usuarioAtual) {
  entrarNoApp(usuarioAtual);
}

// ============================================================
// 3. CONTATOS
// ============================================================
$('form-contato').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('contato-email').value.trim();
  if (!email) return;

  const r = await api.post('contatos', { email });
  if (r.erro) {
    alert(r.erro);
    return;
  }
  $('contato-email').value = '';
  await carregarContatos();
});

async function carregarContatos() {
  const r = await api.get('contatos');
  if (r.erro) {
    if (r.erro === 'Não autenticado.') $('btn-sair').click();
    return;
  }

  $('lista-contatos').innerHTML = '';
  (r.contatos || []).forEach(c => {
    const li = document.createElement('li');
    if (contatoAtivo && contatoAtivo.email === c.email) {
      li.classList.add('ativo');
    }

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.style.background = corDe(c.email);
    avatar.textContent = '🐈';

    const info = document.createElement('div');
    info.className = 'contato-info';

    const nome = document.createElement('strong');
    nome.textContent = c.nome || c.email;

    const detalhe = document.createElement('small');
    detalhe.textContent = c.curso_tecnico
      ? `${c.curso_tecnico} • ${c.modulo || ''}`
      : c.email;

    info.appendChild(nome);
    info.appendChild(detalhe);
    li.appendChild(avatar);
    li.appendChild(info);

    li.addEventListener('click', () => abrirChat(c, li));
    $('lista-contatos').appendChild(li);
  });
}

function corDe(email) {
  let h = 0;
  for (const ch of email) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 45%, 82%)`;
}

// ============================================================
// 4. CHAT COM POLLING
// ============================================================
async function abrirChat(contato, li) {
  document.querySelectorAll('#lista-contatos li').forEach(x => x.classList.remove('ativo'));
  li.classList.add('ativo');

  contatoAtivo = contato;
  ultimaMsgId = 0;
  $('mensagens').innerHTML = '';

  const subtitulo = contato.curso_tecnico ? ` (${contato.curso_tecnico})` : '';
  $('chat-cabecalho').textContent = `🐈 ${contato.nome || contato.email}${subtitulo}`;

  $('campo-msg').disabled = false;
  $('btn-enviar').disabled = false;
  $('campo-msg').focus();

  clearInterval(timerPolling);
  await buscarNovasMensagens();
  timerPolling = setInterval(buscarNovasMensagens, 2500);
}

async function buscarNovasMensagens() {
  if (!contatoAtivo) return;
  const r = await api.get(
    `mensagens?com=${encodeURIComponent(contatoAtivo.email)}&depois=${ultimaMsgId}`
  );
  if (r.erro) return;

  (r.mensagens || []).forEach(m => {
    renderMsg(m);
    ultimaMsgId = Math.max(ultimaMsgId, m.id);
  });

  if (r.mensagens && r.mensagens.length > 0) {
    $('mensagens').scrollTop = $('mensagens').scrollHeight;
  }
}

function renderMsg(m) {
  const div = document.createElement('div');
  div.className = 'msg ' + (m.minha ? 'enviada' : 'recebida');

  const spanTexto = document.createElement('span');
  spanTexto.textContent = m.texto;
  div.appendChild(spanTexto);

  if (m.hora) {
    const spanHora = document.createElement('span');
    spanHora.className = 'hora';
    spanHora.textContent = m.hora;
    div.appendChild(spanHora);
  }

  $('mensagens').appendChild(div);
}

$('form-msg').addEventListener('submit', async e => {
  e.preventDefault();
  const texto = $('campo-msg').value.trim();
  if (!texto || !contatoAtivo) return;

  $('campo-msg').value = '';
  const r = await api.post('mensagens', { para: contatoAtivo.email, texto });
  if (r.erro) {
    alert(r.erro);
    return;
  }
  await buscarNovasMensagens();
});