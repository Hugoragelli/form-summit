// O formulário agora envia dados para o servidor (backend) para proteger as chaves.
document.addEventListener('DOMContentLoaded', () => {
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
        submitBtn.textContent = 'Enviando...';

        try {
            const response = await fetch('/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Erro na resposta do servidor');

            // Sucesso
            formCard.style.display = 'none';
            successView.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error('Erro ao enviar:', error);
            alert('Houve um erro ao enviar seus dados. Verifique a configuração do Supabase no script.js.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Respostas';
        }
    });
});
