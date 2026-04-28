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
            if (target === 'section-config') loadAIConfig();
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
            allClients.forEach((c, index) => {
                const raw = c.diagnostico_final;
                const isNewFormat = raw && raw.trimStart().startsWith('{');
                let actionCell;
                if (isNewFormat) {
                    actionCell = `<button class="btn btn-secondary btn-sm" onclick="viewClientPPI(${index})">Ver PPI</button>`;
                } else if (raw) {
                    actionCell = `<span style="color:var(--text-soft);font-size:12px" title="Gerado com sistema anterior — abrir no novo visualizador não é possível">Formato legado</span>`;
                } else {
                    actionCell = `<span style="color:var(--text-soft);font-size:12px">Sem PPI</span>`;
                }
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:500">${c.nome || '—'}</td>
                        <td style="color:var(--text-muted)">${c.email || '—'}</td>
                        <td style="color:var(--text-muted)">${c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                        <td>${actionCell}</td>
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
            window.location.href = 'perfil-de-paciente-ideal.html';
        } catch (_) {
            alert('Erro ao carregar PPI deste cliente.');
        }
    };

    // --- Config IA ---
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

    window.saveAIConfig = async () => {
        const el = document.getElementById('prompt-ppi');
        const btn = document.getElementById('save-config-btn');
        if (!el) return;
        const orig = btn.textContent;
        btn.textContent = 'Salvando...';
        btn.disabled = true;
        try {
            const res = await fetch('/ai-config', {
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
});
