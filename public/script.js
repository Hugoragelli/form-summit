document.addEventListener('DOMContentLoaded', () => {

    // --- Navegação de Abas (sidebar) ---
    const navItems = document.querySelectorAll('.bc-sidebar-item[data-target]');
    const sections = document.querySelectorAll('.content-section');
    const topbarCrumbs = document.getElementById('topbar-crumbs');

    const sectionLabels = {
        'section-form': { section: 'Operação', label: 'Formulário' },
        'section-clientes': { section: 'Operação', label: 'Clientes' },
        'section-config': { section: 'Configurações', label: 'Agente IA' }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');

            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');

            const meta = sectionLabels[target];
            if (meta && topbarCrumbs) {
                topbarCrumbs.innerHTML = `${meta.section} · <strong>${meta.label}</strong>`;
            }

            if (target === 'section-clientes') loadClients();
    if (target === 'section-config') { loadProvider(); loadAIConfig(); loadPersonasConfig(); loadAnaliseConfig(); loadMCSConfig(); loadComparadorConfig(); }
        });
    });

    // --- Lógica do Formulário multi-step ---
    const form = document.getElementById('summit-form');
    const steps = document.querySelectorAll('.form-step');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const submitBtn = document.getElementById('submit-btn');
    const formCard = document.getElementById('form-card');
    const successView = document.getElementById('success-view');
    const stepLabel = document.getElementById('step-label');
    const progressNum = document.getElementById('progress-num');
    const progressSteps = document.getElementById('progress-steps');

    let currentStep = 1;
    const totalSteps = steps.length;

    // Build progress dots
    if (progressSteps) {
        for (let i = 0; i < totalSteps; i++) {
            const dot = document.createElement('div');
            dot.className = 'progress-step' + (i === 0 ? ' active' : '');
            progressSteps.appendChild(dot);
        }
    }

    updateProgress();

    nextBtn.addEventListener('click', () => {
        if (validateStep(currentStep)) {
            if (currentStep < totalSteps) {
                currentStep++;
                showStep(currentStep);
            }
        } else {
            highlightInvalidFields(currentStep);
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            showStep(currentStep);
        }
    });

    function showStep(n) {
        steps.forEach(s => s.classList.remove('active'));
        document.querySelector(`.form-step[data-step="${n}"]`).classList.add('active');
        prevBtn.disabled = (n === 1);
        nextBtn.style.display = (n === totalSteps) ? 'none' : 'inline-flex';
        submitBtn.style.display = (n === totalSteps) ? 'inline-flex' : 'none';
        updateProgress();
        formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function updateProgress() {
        if (stepLabel) stepLabel.textContent = `${currentStep} de ${totalSteps}`;
        if (progressNum) progressNum.textContent = currentStep;
        document.querySelectorAll('.progress-step').forEach((dot, i) => {
            dot.className = 'progress-step' + (i < currentStep ? ' active' : '');
        });
    }

    function validateStep(step) {
        const activeStep = document.querySelector(`.form-step[data-step="${step}"]`);
        const required = activeStep.querySelectorAll('input[required], select[required], textarea[required]');
        return Array.from(required).every(el => el.value.trim() !== '');
    }

    function highlightInvalidFields(step) {
        const activeStep = document.querySelector(`.form-step[data-step="${step}"]`);
        const required = activeStep.querySelectorAll('input[required], select[required], textarea[required]');
        required.forEach(el => {
            if (!el.value.trim()) {
                el.style.borderColor = '#EF4444';
                el.addEventListener('input', () => { el.style.borderColor = ''; }, { once: true });
            }
        });
    }

    // Lógica condicional P2.1
    const p2Radios = document.querySelectorAll('input[name="p2_atrair_paciente"]');
    const p2_1Group = document.getElementById('group-p2_1');
    p2Radios.forEach(radio => {
        radio.addEventListener('change', e => {
            if (p2_1Group) p2_1Group.style.display = (e.target.value === 'Não') ? 'block' : 'none';
        });
    });

    // Submissão do formulário
    form.addEventListener('submit', async e => {
        e.preventDefault();

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M8 2a6 6 0 110 12A6 6 0 018 2z" stroke-dasharray="18" stroke-dashoffset="6"/></svg> Gerando PPI...`;
        submitBtn.style.background = '#374151';

        const formData = new FormData(form);
        const data = {};
        const multi = ['p4_canais_chegada', 'p6_3_barreiras', 'p7_motivo_procura', 'p12_estilo_comunicacao'];

        Array.from(formData.entries()).forEach(([key, value]) => {
            if (multi.includes(key)) {
                if (!data[key]) data[key] = [];
                data[key].push(value);
            } else {
                data[key] = value;
            }
        });

        try {
            const response = await fetch('/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Erro no servidor');
            const result = await response.json();

            if (result.ppi) {
                localStorage.setItem('ppi_current', JSON.stringify(result.ppi));
                localStorage.setItem('ppi_nutri_nome', data.nome || '');
                localStorage.setItem('ppi_date', new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }));
                if (result.id) localStorage.setItem('ppi_submission_id', result.id);
                showSuccessView(result.ppi, data.nome);
            }
        } catch (err) {
            alert('Erro ao gerar diagnóstico: ' + err.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 8l4 4 8-8"/></svg> Gerar PPI`;
            submitBtn.style.background = '';
        }
    });

    function showSuccessView(ppi, nome) {
        formCard.style.display = 'none';
        successView.style.display = 'block';

        const dateEl = document.getElementById('success-date');
        if (dateEl) dateEl.textContent = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

        const resumoEl = document.getElementById('success-resumo');
        if (resumoEl && ppi.resumo) resumoEl.textContent = ppi.resumo;

        const quemEl = document.getElementById('success-quem');
        if (quemEl && ppi.quem_e) {
            quemEl.textContent = `${ppi.quem_e.faixa_etaria} · ${ppi.quem_e.genero_predominante} · ${ppi.quem_e.estrato_e_profissao}`;
        }

        const dorEl = document.getElementById('success-dor');
        if (dorEl && ppi.eixo_de_dor) dorEl.textContent = ppi.eixo_de_dor.frase_eixo;

        const emocaoEl = document.getElementById('success-emocao');
        if (emocaoEl && ppi.eixo_de_transformacao) emocaoEl.textContent = ppi.eixo_de_transformacao.resultado_emocional_raiz;

        const nivelEl = document.getElementById('success-nivel');
        if (nivelEl && ppi.como_pensa) {
            const labels = {
                inconsciente: 'Inconsciente',
                dor_consciente: 'Dor consciente',
                solucao_consciente: 'Solução consciente',
                produto_consciente: 'Produto consciente',
                mais_consciente: 'Mais consciente',
                insuficiente: 'Insuficiente'
            };
            nivelEl.textContent = labels[ppi.como_pensa.nivel_consciencia_predominante] || ppi.como_pensa.nivel_consciencia_predominante;
        }

        successView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    window.resetForm = () => {
        form.reset();
        currentStep = 1;
        formCard.style.display = 'block';
        successView.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 8l4 4 8-8"/></svg> Gerar PPI`;
        submitBtn.style.background = '';
        showStep(1);
    };

    // --- Clientes ---
    let allClients = [];

    async function loadClients() {
        const tbody = document.getElementById('clients-table-body');
        const countEl = document.getElementById('clients-count');
        tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);text-align:center;padding:24px">Carregando...</td></tr>';
        try {
            const res = await fetch('/clients');
            allClients = await res.json();
            if (countEl) countEl.innerHTML = `<strong>${allClients.length}</strong> ${allClients.length === 1 ? 'resposta' : 'respostas'}`;
            tbody.innerHTML = '';
            if (allClients.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);text-align:center;padding:24px">Nenhum cliente ainda.</td></tr>';
                return;
            }
            allClients.forEach((c) => {
                const id = c.id;
                const hasPPI = c.diagnostico_final && c.diagnostico_final.trimStart().startsWith('{');

                const pages = [
                    { label: 'PPI',        url: `perfil-de-paciente-ideal.html?cliente=${id}`, enabled: hasPPI },
                    { label: 'Personas',   url: `3-personas.html?cliente=${id}`,               enabled: hasPPI },
                    { label: 'Bússola',    url: `bussola-do-perfil.html?cliente=${id}`,        enabled: hasPPI },
                    { label: 'Scraping',   url: `scraping-instagram.html?cliente=${id}`,       enabled: true   },
                    { label: 'Análise IG', url: `analise-instagram.html?cliente=${id}`,        enabled: true   },
                    { label: 'MCS',        url: `modelo-de-comunicacao.html?cliente=${id}`,    enabled: hasPPI },
                ];

                const buttons = pages.map(p =>
                    p.enabled
                        ? `<a href="${p.url}" class="client-nav-btn">${p.label}</a>`
                        : `<span class="client-nav-btn" style="opacity:0.35;cursor:default" title="PPI ainda não gerado">${p.label}</span>`
                ).join('');

                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:500">${c.nome || '—'}</td>
                        <td style="color:var(--text-muted)">${c.email || '—'}</td>
                        <td style="color:var(--text-muted);white-space:nowrap">${c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                        <td><div class="client-actions">${buttons}</div></td>
                    </tr>
                `;
            });
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="4" style="color:var(--critical);text-align:center;padding:24px">Erro ao carregar clientes.</td></tr>';
        }
    }

    window.viewClientPPI = (index) => {
        const client = allClients[index];
        if (!client.diagnostico_final) return;
        try {
            const ppi = JSON.parse(client.diagnostico_final);
            localStorage.setItem('ppi_current', JSON.stringify(ppi));
            localStorage.setItem('ppi_nutri_nome', client.nome || '');
            localStorage.setItem('ppi_date', client.created_at
                ? new Date(client.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
                : '');
            window.location.href = `perfil-de-paciente-ideal.html?cliente=${client.id}`;
        } catch (_) {
            alert('Erro ao carregar PPI deste cliente.');
        }
    };

    // --- Config IA ---
    // Tab switching
    const lazyLoaders = {
        analise:    () => loadAnaliseConfig(),
        mcs:        () => loadMCSConfig(),
        comparador: () => loadComparadorConfig(),
    };

    document.querySelectorAll('.config-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.config-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.config-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById(`config-panel-${tab.dataset.tab}`);
            if (panel) panel.classList.add('active');
            if (lazyLoaders[tab.dataset.tab]) lazyLoaders[tab.dataset.tab]();
        });
    });

    async function loadProvider() {
        try {
            const res = await fetch('/ai-config');
            const data = await res.json();
            const provider = data.provider || 'openai';
            const radio = document.querySelector(`input[name="ai_provider"][value="${provider}"]`);
            if (radio) { radio.checked = true; updateProviderLabels(provider); }
        } catch (_) {}
    }

    async function loadAIConfig() {
        const el = document.getElementById('prompt-ppi');
        if (!el) return;
        try {
            const res = await fetch('/ai-config');
            const data = await res.json();
            el.value = data.prompt || '';
        } catch (_) {
            el.value = '';
        }
    }

    async function loadPersonasConfig() {
        const el = document.getElementById('prompt-personas');
        if (!el || el.value) return; // já carregado
        try {
            const res = await fetch('/personas-config');
            const data = await res.json();
            el.value = data.prompt || '';
        } catch (_) {
            el.value = '';
        }
    }

    function updateProviderLabels(provider) {
        ['openai', 'deepseek', 'deepseek-r1'].forEach(p => {
            const lbl = document.getElementById(`provider-label-${p}`);
            if (lbl) lbl.style.borderColor = (p === provider) ? 'var(--accent)' : 'var(--border)';
        });
    }

    document.querySelectorAll('input[name="ai_provider"]').forEach(radio => {
        radio.addEventListener('change', e => updateProviderLabels(e.target.value));
    });

    window.saveProvider = async () => {
        const btn = document.getElementById('save-provider-btn');
        const providerRadio = document.querySelector('input[name="ai_provider"]:checked');
        if (!btn) return;
        const orig = btn.textContent;
        btn.textContent = 'Salvando...';
        btn.disabled = true;
        try {
            // reutiliza /ai-config enviando apenas o provider (prompt em branco é ignorado pelo backend se vazio)
            const promptEl = document.getElementById('prompt-ppi');
            const res = await fetch('/ai-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: providerRadio?.value || 'openai', prompt: promptEl?.value || undefined })
            });
            if (res.ok) {
                btn.textContent = 'Salvo!';
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
            } else throw new Error();
        } catch (_) {
            btn.textContent = 'Erro ao salvar';
            btn.disabled = false;
        }
    };

    window.saveAIConfig = async () => {
        const el = document.getElementById('prompt-ppi');
        const btn = document.getElementById('save-ppi-btn');
        if (!el) return;
        const orig = btn.textContent;
        btn.textContent = 'Salvando...';
        btn.disabled = true;
        try {
            const providerRadio = document.querySelector('input[name="ai_provider"]:checked');
            const res = await fetch('/ai-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: el.value, provider: providerRadio?.value || 'openai' })
            });
            if (res.ok) {
                btn.textContent = 'Salvo!';
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
            } else throw new Error();
        } catch (_) {
            btn.textContent = 'Erro ao salvar';
            btn.disabled = false;
        }
    };

    window.savePersonasConfig = async () => {
        const el = document.getElementById('prompt-personas');
        const btn = document.getElementById('save-personas-btn');
        if (!el) return;
        const orig = btn.textContent;
        btn.textContent = 'Salvando...';
        btn.disabled = true;
        try {
            const res = await fetch('/personas-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: el.value })
            });
            if (res.ok) {
                btn.textContent = 'Salvo!';
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
            } else throw new Error();
        } catch (_) {
            btn.textContent = 'Erro ao salvar';
            btn.disabled = false;
        }
    };

    // --- helpers genéricos para agentes simples (só prompt) ---
    function makeSimpleAgentConfig({ loadFnName, endpoint, textareaId }) {
        window[loadFnName] = async function () {
            const el = document.getElementById(textareaId);
            if (!el || el.value) return;
            try {
                const res = await fetch(endpoint);
                const data = await res.json();
                el.value = data.prompt || '';
            } catch (_) { el.value = ''; }
        };
    }

    makeSimpleAgentConfig({ loadFnName: 'loadAnaliseConfig',    endpoint: '/analise-instagram-config', textareaId: 'prompt-analise' });
    makeSimpleAgentConfig({ loadFnName: 'loadMCSConfig',        endpoint: '/mcs-config',               textareaId: 'prompt-mcs' });
    makeSimpleAgentConfig({ loadFnName: 'loadComparadorConfig', endpoint: '/comparador-config',        textareaId: 'prompt-comparador' });

    function makeSimpleSaveFn({ saveFnName, endpoint, textareaId, btnId }) {
        window[saveFnName] = async function () {
            const el  = document.getElementById(textareaId);
            const btn = document.getElementById(btnId);
            if (!el) return;
            const orig = btn.textContent;
            btn.textContent = 'Salvando...';
            btn.disabled = true;
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: el.value })
                });
                if (res.ok) {
                    btn.textContent = 'Salvo!';
                    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
                } else throw new Error();
            } catch (_) {
                btn.textContent = 'Erro ao salvar';
                btn.disabled = false;
            }
        };
    }

    makeSimpleSaveFn({ saveFnName: 'saveAnaliseConfig',    endpoint: '/analise-instagram-config', textareaId: 'prompt-analise',    btnId: 'save-analise-btn' });
    makeSimpleSaveFn({ saveFnName: 'saveMCSConfig',        endpoint: '/mcs-config',               textareaId: 'prompt-mcs',        btnId: 'save-mcs-btn' });
    makeSimpleSaveFn({ saveFnName: 'saveComparadorConfig', endpoint: '/comparador-config',        textareaId: 'prompt-comparador', btnId: 'save-comparador-btn' });

    // --- Roteamento por hash (ex: index.html#clientes, index.html#config) ---
    const hashMap = { clientes: 'section-clientes', config: 'section-config', form: 'section-form' };
    const initHash = window.location.hash.replace('#', '');
    if (initHash && hashMap[initHash]) {
        const targetItem = document.querySelector(`.bc-sidebar-item[data-target="${hashMap[initHash]}"]`);
        if (targetItem) targetItem.click();
    }
});
