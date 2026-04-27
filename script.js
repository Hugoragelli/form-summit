// O formulário agora envia dados para o servidor (backend) para proteger as chaves.
document.addEventListener('DOMContentLoaded', () => {
    // --- Navegação de Abas ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            
            // Ativar aba
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Ativar seção
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');

            // Carregar dados específicos se necessário
            if (target === 'section-clientes') loadClients();
            if (target === 'section-config') loadAIConfigs();
        });
    });

    // --- Lógica do Formulário (Existente + Ajustes) ---
    const form = document.getElementById('summit-form');
    const steps = document.querySelectorAll('.form-step');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const submitBtn = document.getElementById('submit-btn');
    const progressFill = document.getElementById('progress-fill');
    const progressPercent = document.getElementById('progress-percent');
    const successView = document.getElementById('success-view');
    const formCard = document.querySelector('.form-card');

    let currentStep = 1;
    const totalSteps = steps.length;

    // Inicializar Progresso
    updateProgress();

    // Navegação: Próximo
    nextBtn.addEventListener('click', () => {
        if (validateStep(currentStep)) {
            if (currentStep < totalSteps) {
                currentStep++;
                showStep(currentStep);
                updateProgress();
            }
        } else {
            alert('Por favor, preencha todos os campos obrigatórios desta etapa antes de prosseguir.');
        }
    });

    // Navegação: Anterior
    prevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            showStep(currentStep);
            updateProgress();
        }
    });

    // Mostrar Etapa específica
    function showStep(stepNumber) {
        steps.forEach(step => step.classList.remove('active'));
        document.querySelector(`.form-step[data-step="${stepNumber}"]`).classList.add('active');

        // Gerenciar visibilidade dos botões
        prevBtn.disabled = (stepNumber === 1);

        if (stepNumber === totalSteps) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'block';
        } else {
            nextBtn.style.display = 'block';
            submitBtn.style.display = 'none';
        }

        // Scroll para o topo do card
        formCard.scrollIntoView({ behavior: 'smooth' });
    }

    // Atualizar Barra de Progresso
    function updateProgress() {
        const percent = ((currentStep - 1) / (totalSteps - 1)) * 100;
        progressFill.style.width = `${percent}%`;
        progressPercent.textContent = `${Math.round(percent)}%`;
    }

    // Validação básica por etapa
    function validateStep(step) {
        const activeStep = document.querySelector(`.form-step[data-step="${step}"]`);
        const inputs = activeStep.querySelectorAll('input[required], select[required], textarea[required]');

        let isValid = true;
        inputs.forEach(input => {
            if (!input.value.trim()) {
                input.style.borderColor = '#ef4444';
                isValid = false;
            } else {
                input.style.borderColor = '#e5e7eb';
            }
        });
        return isValid;
    }

    // Lógica Condicional P2 -> P2.1
    const p2Radios = document.querySelectorAll('input[name="p2_atrair_paciente"]');
    const p2_1Group = document.getElementById('group-p2_1');

    p2Radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'Não') {
                p2_1Group.style.display = 'block';
            } else {
                p2_1Group.style.display = 'none';
            }
        });
    });

    // Submissão do Formulário
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Coletar dados
        const formData = new FormData(form);
        const data = {};

        // Processar campos especiais (arrays de checkbox)
        const entries = Array.from(formData.entries());

        // Agrupar campos que podem ter múltiplos valores (checkboxes)
        const multiValueFields = ['p4_canais_chegada', 'p6_3_barreiras', 'p7_motivo_procura', 'p12_estilo_comunicacao'];

        entries.forEach(([key, value]) => {
            if (multiValueFields.includes(key)) {
                if (!data[key]) data[key] = [];
                data[key].push(value);
            } else {
                data[key] = value;
            }
        });

        // Feedback visual de carregamento
        submitBtn.disabled = true;
        submitBtn.textContent = 'Gerando Diagnóstico de IA...';

        try {
            const response = await fetch('/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Erro na resposta do servidor');
            
            const result = await response.json();

            // Sucesso: Esconder formulário e mostrar resultados
            formCard.style.display = 'none';
            successView.style.display = 'block';
            
            // Inserir o diagnóstico da IA na tela
            const aiBox = document.querySelector('.future-ai-box');
            if (aiBox && result.diagnostico) {
                aiBox.innerHTML = `
                    <p style="color: #1e3a8a; font-weight: 700; margin-bottom: 12px;">✨ Diagnóstico Estratégico Gerado</p>
                    <div style="line-height: 1.6; color: #374151; white-space: pre-line;">
                        ${result.diagnostico}
                    </div>
                `;
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error('Erro ao enviar:', error);
            alert('Houve um erro ao enviar seus dados. Verifique a configuração do Supabase no script.js.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Respostas';
        }
    });

    // --- Gerenciamento de Clientes ---
    async function loadClients() {
        const tbody = document.getElementById('clients-table-body');
        tbody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';

        try {
            const res = await fetch('/clients');
            const clients = await res.json();
            
            tbody.innerHTML = '';
            clients.forEach(c => {
                const row = `
                    <tr>
                        <td>${c.nome}</td>
                        <td>${c.email}</td>
                        <td>${new Date(c.created_at).toLocaleDateString()}</td>
                        <td><button class="btn btn-secondary" onclick="alert('Ver diagnóstico: ' + \`${c.diagnostico_final ? 'Gerado' : 'Não disponível'}\`)">Ver</button></td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="4">Erro ao carregar clientes.</td></tr>';
        }
    }

    // --- Gerenciamento de IA ---
    async function loadAIConfigs() {
        try {
            const res = await fetch('/ai-config');
            const configs = await res.json();
            
            configs.forEach(c => {
                const el = document.getElementById(`prompt-${c.id}`);
                if (el) el.value = c.prompt;
            });
        } catch (e) {
            console.error('Erro ao carregar configurações de IA');
        }
    }

    document.getElementById('ai-prompts-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = [
            { id: 'agente1', prompt: document.getElementById('prompt-agente1').value },
            { id: 'agente2', prompt: document.getElementById('prompt-agente2').value },
            { id: 'agente3', prompt: document.getElementById('prompt-agente3').value }
        ];

        try {
            const res = await fetch('/ai-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompts: data })
            });
            if (res.ok) alert('Configurações salvas com sucesso!');
        } catch (e) {
            alert('Erro ao salvar configurações.');
        }
    });
});
