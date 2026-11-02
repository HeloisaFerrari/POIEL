/* ===== NAVBAR (menu no celular) ===== */
const navBotao = document.getElementById('nav-botao');
const navLinks = document.getElementById('nav-links');
navBotao.addEventListener('click', () => {
    const aberto = navLinks.classList.toggle('aberto');
    navBotao.setAttribute('aria-expanded', aberto);
});

/* ===== ESTADO ===== */
let currentFrontCover = null;
let currentBackCover = null;

function createDefaultCoverSVG(title, subtitle, bgHex, accentHex) {
    const safeTitle = (title || 'Livro').substring(0, 24);
    const safeSub = (subtitle || 'Capa').substring(0, 24);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
        <rect width="300" height="400" fill="${bgHex}"/>
        <rect x="18" y="18" width="264" height="364" rx="12" fill="none" stroke="${accentHex}" stroke-width="3"/>
        <rect x="26" y="26" width="248" height="348" rx="8" fill="none" stroke="${accentHex}" stroke-width="1" stroke-dasharray="6 4"/>
        <circle cx="150" cy="155" r="46" fill="${accentHex}" opacity="0.2"/>
        <path d="M128 165 L122 135 L142 148 L150 145 L158 148 L178 135 L172 165 Z" fill="${accentHex}"/>
        <text x="150" y="245" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="#314938" text-anchor="middle">${safeTitle}</text>
        <text x="150" y="275" font-family="sans-serif" font-size="13" fill="#4a5f5a" text-anchor="middle">${safeSub}</text>
        <text x="150" y="345" font-family="sans-serif" font-size="11" fill="#4a5f5a" text-anchor="middle">Edição Felina</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* Livro de exemplo. Quando o back-end estiver pronto, esta lista virá do banco (tabela livro). */
const registeredBooks = [
    {
        id: 1,
        title: 'Eu Sou um Gato',
        author: 'Natsume Sōseki',
        genre: 'Clássicos da Literatura',
        state: 'Excelente',
        frontCover: createDefaultCoverSVG('Eu Sou um Gato', 'Capa Frontal • Sōseki', '#e8e6df', '#4a5f5a'),
        backCover: createDefaultCoverSVG('Sinopse na Contracapa', 'Verso • Edição Verde', '#f4f3ee', '#9cb6ad'),
        showingBack: false
    }
];

/* ===== ELEMENTOS ===== */
const frontDropzone = document.getElementById('front-dropzone');
const frontInput = document.getElementById('front-cover-input');
const frontPreview = document.getElementById('front-preview');
const frontPlaceholder = document.getElementById('front-placeholder');
const removeFrontBtn = document.getElementById('remove-front-btn');

const backDropzone = document.getElementById('back-dropzone');
const backInput = document.getElementById('back-cover-input');
const backPreview = document.getElementById('back-preview');
const backPlaceholder = document.getElementById('back-placeholder');
const removeBackBtn = document.getElementById('remove-back-btn');

const bookForm = document.getElementById('book-form');
const clearFormBtn = document.getElementById('clear-form-btn');
const bookshelfGrid = document.getElementById('bookshelf-grid');
const booksCountEl = document.getElementById('books-count');

/* ===== UPLOAD DAS CAPAS ===== */
function setupImageUploader(dropzone, fileInput, previewImg, placeholder, removeBtn, onImageLoaded) {
    dropzone.addEventListener('click', (e) => {
        if (e.target === removeBtn) return;
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) readAndPreviewFile(file, previewImg, placeholder, removeBtn, onImageLoaded);
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('ring-4', 'ring-botanical-300', 'bg-botanical-100');
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('ring-4', 'ring-botanical-300', 'bg-botanical-100');
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('ring-4', 'ring-botanical-300', 'bg-botanical-100');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            readAndPreviewFile(file, previewImg, placeholder, removeBtn, onImageLoaded);
        }
    });

    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.value = '';
        previewImg.src = '';
        previewImg.classList.add('hidden');
        removeBtn.classList.add('hidden');
        placeholder.classList.remove('hidden');
        onImageLoaded(null);
    });
}

function readAndPreviewFile(file, previewImg, placeholder, removeBtn, callback) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const dataUrl = event.target.result;
        previewImg.src = dataUrl;
        previewImg.classList.remove('hidden');
        removeBtn.classList.remove('hidden');
        placeholder.classList.add('hidden');
        callback(dataUrl);
    };
    reader.readAsDataURL(file);
}

setupImageUploader(frontDropzone, frontInput, frontPreview, frontPlaceholder, removeFrontBtn,
    (dataUrl) => { currentFrontCover = dataUrl; });
setupImageUploader(backDropzone, backInput, backPreview, backPlaceholder, removeBackBtn,
    (dataUrl) => { currentBackCover = dataUrl; });

/* ===== DICA DO ESTADO DE CONSERVAÇÃO ===== */
const stateSelect = document.getElementById('book-state');
const stateHint = document.getElementById('state-hint');
const defaultStateHint = 'Escolha a opção que melhor descreve as condições físicas do livro.';
function updateStateHint() {
    const opt = stateSelect.options[stateSelect.selectedIndex];
    stateHint.textContent = (opt && opt.dataset.desc) ? opt.dataset.desc : defaultStateHint;
}
stateSelect.addEventListener('change', updateStateHint);

/* ===== AVISO (TOAST) ===== */
function showToast(title, message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-msg').textContent = message;
    toast.classList.remove('translate-y-[-150%]', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-[-150%]', 'opacity-0'), 3400);
}

/* ===== FORMULÁRIO ===== */
function resetBookForm() {
    bookForm.reset();
    updateStateHint();
    removeFrontBtn.click();
    removeBackBtn.click();
}

clearFormBtn.addEventListener('click', () => {
    resetBookForm();
    showToast('Página Limpa', 'Os campos foram reiniciados.');
});

bookForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();
    const genre = document.getElementById('book-genre').value;
    const state = document.getElementById('book-state').value;

    if (!title || !author || !genre || !state) {
        showToast('Atenção', 'Por favor, preencha todos os campos obrigatórios.');
        return;
    }

    const newBook = {
        id: Date.now(),
        title, author, genre, state,
        frontCover: currentFrontCover || createDefaultCoverSVG(title, 'Capa Frontal • ' + author, '#e8e6df', '#4a5f5a'),
        backCover: currentBackCover || createDefaultCoverSVG(title, 'Contracapa • ' + genre, '#f4f3ee', '#9cb6ad'),
        showingBack: false
    };

    /* Aqui o back-end deve salvar o livro (POST na tabela livro). */
    registeredBooks.unshift(newBook);
    renderBookshelf();
    resetBookForm();
    showToast('Livro Cadastrado!', `"${title}" foi adicionado à lista de livros para troca.`);
});

/* ===== LISTA DE LIVROS ===== */
window.toggleBookCover = function (bookId) {
    const book = registeredBooks.find(b => b.id === bookId);
    if (book) {
        book.showingBack = !book.showingBack;
        renderBookshelf();
    }
};

window.deleteBook = function (bookId) {
    const idx = registeredBooks.findIndex(b => b.id === bookId);
    if (idx !== -1) {
        const removed = registeredBooks.splice(idx, 1)[0];
        renderBookshelf();
        showToast('Livro Removido', `"${removed.title}" foi removido da lista de troca.`);
    }
};

function renderBookshelf() {
    booksCountEl.textContent = registeredBooks.length;

    if (registeredBooks.length === 0) {
        bookshelfGrid.innerHTML = `
            <div class="col-span-full py-12 text-center bg-botanical-50/60 rounded-2xl border-2 border-dashed border-botanical-200">
                <p class="font-serif text-xl font-bold text-botanical-800">Nenhum livro disponível para troca</p>
                <p class="text-xs text-botanical-600 mt-1">Cadastre seu primeiro livro para troca nas páginas acima.</p>
            </div>`;
        return;
    }

    bookshelfGrid.innerHTML = registeredBooks.map(book => {
        const activeImage = book.showingBack ? book.backCover : book.frontCover;
        const badgeLabel = book.showingBack ? 'Contracapa (Verso)' : 'Capa do Livro (Frente)';

        return `
            <article class="bg-paper rounded-2xl border-2 border-botanical-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group">
                <div>
                    <div class="relative aspect-[3/4] w-full bg-botanical-100 overflow-hidden border-b border-botanical-200">
                        <img src="${activeImage}" alt="Imagem de ${book.title}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        <span class="absolute top-3 left-3 bg-botanical-900/80 backdrop-blur-sm text-botanical-50 text-[11px] font-semibold px-3 py-1 rounded-full">${badgeLabel}</span>
                        <button type="button" onclick="toggleBookCover(${book.id})"
                            class="absolute bottom-3 right-3 bg-botanical-50/95 hover:bg-botanical-600 hover:text-botanical-50 text-botanical-900 text-xs font-bold px-3.5 py-2 rounded-xl shadow-md border border-botanical-300 transition-colors cursor-pointer">
                            Ver ${book.showingBack ? 'Capa' : 'Contracapa'}
                        </button>
                    </div>
                    <div class="p-4">
                        <div class="flex items-center justify-between gap-2 mb-1.5">
                            <span class="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-botanical-100 text-botanical-700">${book.genre}</span>
                            <button type="button" onclick="deleteBook(${book.id})" class="text-botanical-500 hover:underline text-xs font-medium p-1 transition-colors cursor-pointer" title="Remover livro">Remover</button>
                        </div>
                        <h3 class="font-serif text-xl font-bold text-botanical-900 leading-snug line-clamp-1">${book.title}</h3>
                        <p class="text-xs text-botanical-600 font-medium mb-3">por ${book.author}</p>
                        <div class="pt-2.5 border-t border-botanical-200/70 flex items-center justify-between gap-2 text-xs">
                            <span class="text-botanical-500 font-medium">Estado de conservação:</span>
                            <span class="font-semibold text-botanical-800 bg-botanical-50 px-2.5 py-1 rounded-lg border border-botanical-200">${book.state}</span>
                        </div>
                    </div>
                </div>
            </article>`;
    }).join('');
}

/* ===== CAMPOS DE SELEÇÃO PERSONALIZADOS (acessíveis, na paleta do site) ===== */
function enhanceSelect(select, floating = false) {
    const wrap = select.parentElement;
    const label = document.querySelector(`label[for="${select.id}"]`);
    if (label && !label.id) label.id = select.id + '-label';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = select.id + '-button';
    btn.className = select.className.replace('appearance-none', '') + ' text-left flex items-center';
    btn.setAttribute('role', 'combobox');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', select.id + '-listbox');
    if (label) btn.setAttribute('aria-labelledby', label.id + ' ' + btn.id);
    if (select.required) btn.setAttribute('aria-required', 'true');
    const btnText = document.createElement('span');
    btnText.className = 'block truncate';
    btn.appendChild(btnText);

    const list = document.createElement('ul');
    list.id = select.id + '-listbox';
    list.setAttribute('role', 'listbox');
    if (label) list.setAttribute('aria-labelledby', label.id);
    list.hidden = true;
    /* Modo flutuante: position:fixed para o menu não ser cortado pelo overflow-hidden do livro */
    list.className = (floating ? 'fixed z-50 ' : 'absolute left-0 right-0 top-full mt-1.5 z-40 ') +
        'max-h-64 overflow-auto rounded-xl bg-botanical-50 border-2 border-botanical-200 shadow-xl py-1';

    const opts = [...select.options].filter(o => !o.disabled && o.value !== '');
    const placeholder = select.options[0] ? select.options[0].textContent : '';
    const check = '<svg class="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>';
    let active = -1, isOpen = false, typed = '', typedTimer;

    const items = opts.map((o, i) => {
        const li = document.createElement('li');
        li.id = `${select.id}-opt-${i}`;
        li.setAttribute('role', 'option');
        li.innerHTML = `<span><span class="block font-medium">${o.textContent}</span>` +
            (o.dataset.desc ? `<span class="block text-xs mt-0.5 font-normal">${o.dataset.desc}</span>` : '') +
            `</span><span class="chk">${check}</span>`;
        li.addEventListener('mousemove', () => { if (active !== i) { active = i; paint(); } });
        li.addEventListener('click', () => choose(i));
        list.appendChild(li);
        return li;
    });

    const chevron = wrap.querySelector('svg');
    if (chevron) chevron.classList.add('transition-transform', 'duration-200');

    function selectedIndex() { return opts.findIndex(o => o.value === select.value); }

    function paint() {
        items.forEach((li, i) => {
            const sel = i === selectedIndex(), act = i === active;
            li.setAttribute('aria-selected', sel ? 'true' : 'false');
            const bg = sel ? (act ? 'bg-botanical-600' : 'bg-botanical-500') : (act ? 'bg-botanical-100' : '');
            li.className = `cursor-pointer px-4 py-2.5 text-sm flex items-start justify-between gap-3 ${bg} ` +
                (sel ? 'text-botanical-50 font-semibold ' : 'text-botanical-900 ') +
                (act ? 'ring-2 ring-inset ring-botanical-500' : '');
            li.querySelector('.chk').style.visibility = sel ? 'visible' : 'hidden';
        });
        if (isOpen && active >= 0) {
            btn.setAttribute('aria-activedescendant', items[active].id);
            items[active].scrollIntoView({ block: 'nearest' });
        } else btn.removeAttribute('aria-activedescendant');
    }

    function sync() {
        const idx = selectedIndex();
        btnText.textContent = idx >= 0 ? opts[idx].textContent : placeholder;
        btnText.classList.toggle('text-botanical-500', idx < 0);
        paint();
    }

    /* Posiciona o menu flutuante junto ao botão; abre para cima se faltar espaço embaixo */
    function place() {
        if (!floating || !isOpen) return;
        const r = btn.getBoundingClientRect(), gap = 6, margin = 12;
        list.style.left = r.left + 'px';
        list.style.width = r.width + 'px';
        const keepScroll = list.scrollTop;
        list.style.maxHeight = 'none';
        const want = Math.min(list.scrollHeight + 4, 400);
        const below = window.innerHeight - r.bottom - gap - margin;
        const above = r.top - gap - margin;
        const down = below >= want || below >= above;
        const h = Math.max(Math.min(want, down ? below : above), 120);
        list.style.maxHeight = h + 'px';
        list.scrollTop = keepScroll;
        if (down) { list.style.top = (r.bottom + gap) + 'px'; list.style.bottom = 'auto'; }
        else { list.style.bottom = (window.innerHeight - r.top + gap) + 'px'; list.style.top = 'auto'; }
    }
    if (floating) {
        window.addEventListener('resize', place);
        window.addEventListener('scroll', (e) => { if (e.target !== list) place(); }, true);
    }

    function open() {
        isOpen = true; list.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        btn.classList.add('border-botanical-600');
        if (chevron) chevron.classList.add('rotate-180');
        active = Math.max(selectedIndex(), 0); place(); paint();
    }
    function close() {
        isOpen = false; list.hidden = true; active = -1;
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('border-botanical-600');
        if (chevron) chevron.classList.remove('rotate-180');
        paint();
    }
    function choose(i) {
        select.value = opts[i].value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync(); close(); btn.focus();
    }

    btn.addEventListener('click', () => (isOpen ? close() : open()));
    btn.addEventListener('keydown', (e) => {
        const k = e.key;
        if (!isOpen) {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(k)) { e.preventDefault(); open(); }
            return;
        }
        if (k === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); paint(); }
        else if (k === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); paint(); }
        else if (k === 'Home') { e.preventDefault(); active = 0; paint(); }
        else if (k === 'End') { e.preventDefault(); active = items.length - 1; paint(); }
        else if (k === 'Enter' || k === ' ') { e.preventDefault(); if (active >= 0) choose(active); }
        else if (k === 'Escape') { e.preventDefault(); close(); }
        else if (k === 'Tab') { close(); }
        else if (k.length === 1) {
            typed += k.toLowerCase(); clearTimeout(typedTimer); typedTimer = setTimeout(() => typed = '', 600);
            const found = opts.findIndex(o => o.textContent.toLowerCase().startsWith(typed));
            if (found >= 0) { active = found; paint(); }
        }
    });
    list.addEventListener('mousedown', (e) => e.preventDefault());
    document.addEventListener('click', (e) => { if (isOpen && !wrap.contains(e.target)) close(); });
    btn.addEventListener('blur', () => { if (isOpen) close(); });
    if (label) label.addEventListener('click', (e) => { e.preventDefault(); btn.focus(); });
    select.addEventListener('invalid', () => btn.focus());
    select.addEventListener('change', sync);
    if (select.form) select.form.addEventListener('reset', () => setTimeout(sync, 0));

    select.className = 'native-select';
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    wrap.insertBefore(btn, select.nextSibling);
    wrap.insertBefore(list, btn.nextSibling);
    sync();
}

document.querySelectorAll('#book-form select').forEach(s => enhanceSelect(s, s.id === 'book-state'));

/* ===== INÍCIO ===== */
renderBookshelf();