// O formulário agora envia dados para o servidor (backend) para proteger as chaves.
document.addEventListener('DOMContentLoaded', () => {
    // --- Navegação de Abas ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');

            if (target === 'section-clientes') loadClients();
            if (target === 'section-config') loadAIConfigs();
        });
    });

    // --- Lógica do Formulário ---
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

    updateProgress();

    nextBtn.addEventListener('click', () => {
        if (validateStep(currentStep)) {
            if (currentStep < totalSteps) {
                currentStep++;
                showStep(currentStep);
                updateProgress();
            }
        } else {
            alert('Por favor, preencha todos os campos obrigatórios desta etapa.');
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            showStep(currentStep);
            updateProgress();
        }
    });

    function showStep(stepNumber) {
        steps.forEach(step => step.classList.remove('active'));
        document.querySelector(`.form-step[data-step="${stepNumber}"]`).classList.add('active');
        prevBtn.disabled = (stepNumber === 1);
        if (stepNumber === totalSteps) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'block';
        } else {
            nextBtn.style.display = 'block';
            submitBtn.style.display = 'none';
        }
        formCard.scrollIntoView({ behavior: 'smooth' });
    }

    function updateProgress() {
        const percent = ((currentStep - 1) / (totalSteps - 1)) * 100;
        progressFill.style.width = `${percent}%`;
        progressPercent.textContent = `${Math.round(percent)}%`;
    }

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

    // Lógica Condicional
    const p2Radios = document.querySelectorAll('input[name="p2_atrair_paciente"]');
    const p2_1Group = document.getElementById('group-p2_1');
    p2Radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            p2_1Group.style.display = (e.target.value === 'Não') ? 'block' : 'none';
        });
    });

    // Submissão
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = {};
        const multiValueFields = ['p4_canais_chegada', 'p6_3_barreiras', 'p7_motivo_procura', 'p12_estilo_comunicacao'];
        
        Array.from(formData.entries()).forEach(([key, value]) => {
            if (multiValueFields.includes(key)) {
                if (!data[key]) data[key] = [];
                data[key].push(value);
            } else { data[key] = value; }
        });

        submitBtn.disabled = true;
        submitBtn.textContent = 'Gerando Diagnóstico de IA...';

        try {
            const response = await fetch('/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Erro no servidor');
            const result = await response.json();

            formCard.style.display = 'none';
            successView.style.display = 'block';
            
            const aiBox = document.querySelector('.future-ai-box');
            if (aiBox && result.diagnostico) {
                aiBox.innerHTML = `
                    <p style="color: #1e3a8a; font-weight: 700; margin-bottom: 12px;">✨ Diagnóstico Gerado</p>
                    <div style="white-space: pre-line;">${result.diagnostico}</div>
                `;
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            alert('Erro ao processar diagnóstico.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Respostas';
        }
    });

    // --- Clientes e Modal ---
    let allClients = [];

    async function loadClients() {
        const tbody = document.getElementById('clients-table-body');
        tbody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
        try {
            const res = await fetch('/clients');
            allClients = await res.json();
            tbody.innerHTML = '';
            allClients.forEach((c, index) => {
                tbody.innerHTML += `
                    <tr>
                        <td>${c.nome}</td>
                        <td>${c.email}</td>
                        <td>${new Date(c.created_at).toLocaleDateString()}</td>
                        <td><button class="btn btn-secondary btn-sm" onclick="openClientModal(${index})">Ver</button></td>
                    </tr>
                `;
            });
        } catch (e) { tbody.innerHTML = '<tr><td colspan="4">Erro ao carregar.</td></tr>'; }
    }

    window.openClientModal = (index) => {
        const client = allClients[index];
        const modal = document.getElementById('diagnostico-modal');
        const modalBody = document.getElementById('modal-corpo');
        const modalTitle = document.getElementById('modal-cliente-nome');

        modalTitle.textContent = `Diagnóstico: ${client.nome}`;
        modalBody.innerHTML = client.diagnostico_final 
            ? `<div>${client.diagnostico_final}</div>` 
            : '<p>Diagnóstico ainda não gerado para este cliente.</p>';
        
        modal.style.display = 'block';
    };

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('diagnostico-modal').style.display = 'none';
        });
    });

    window.onclick = (event) => {
        const modal = document.getElementById('diagnostico-modal');
        if (event.target == modal) modal.style.display = 'none';
    };

    // --- IA Config ---
    async function loadAIConfigs() {
        try {
            const res = await fetch('/ai-config');
            (await res.json()).forEach(c => {
                const el = document.getElementById(`prompt-${c.id}`);
                if (el) el.value = c.prompt;
            });
        } catch (e) { console.error('Erro ao carregar IA'); }
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
            if (res.ok) alert('Configurações salvas!');
        } catch (e) { alert('Erro ao salvar.'); }
    });
});
