document.addEventListener("DOMContentLoaded", () => {
    // --- Navigation Logic ---
    const navItems = document.querySelectorAll("#nav-menu li");
    const views = document.querySelectorAll(".view-section");
    const pageTitle = document.getElementById("page-title");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navItems.forEach(nav => nav.classList.remove("active"));
            views.forEach(view => {
                view.classList.remove("active");
                view.style.display = "none";
            });

            item.classList.add("active");

            const targetId = item.getAttribute("data-target");
            const targetView = document.getElementById(targetId);
            if (targetView) {
                targetView.classList.add("active");
                targetView.style.display = "block";
            }

            pageTitle.textContent = item.textContent.replace(/[^\w\s-]/g, '').trim();
        });
    });

    // --- Helper for Smooth Number Transitions ---
    function animateValue(obj, start, end, duration, formatStr = "", isFloat = false) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);

            // easeInOutQuad
            const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            let current = start + ease * (end - start);

            if (isFloat) {
                current = current.toFixed(2);
            } else {
                current = Math.floor(current);
            }

            if (formatStr === "%") obj.innerHTML = current + '<span style="font-size:0.6em; margin-left:2px;">%</span>';
            else if (formatStr === "W") obj.innerHTML = current + ' <span style="font-size:0.6em;">W</span>';
            else if (formatStr === "C") obj.innerHTML = current + '<span style="font-size:0.6em;">°C</span>';
            else obj.innerHTML = current + formatStr;

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                // Ensure final value is exact
                obj.setAttribute("data-val", end);
            }
        };
        window.requestAnimationFrame(step);
    }

    function updateNumberElement(elementId, newValue, formatStr, isFloat = false, duration = 800) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const currentVal = parseFloat(el.getAttribute("data-val") || 0);
        if (currentVal !== newValue) {
            animateValue(el, currentVal, newValue, duration, formatStr, isFloat);
        }
    }

    // --- Chart Setups ---
    const ctx = document.getElementById('resourceChart').getContext('2d');
    const gradientCPU = ctx.createLinearGradient(0, 0, 0, 400);
    gradientCPU.addColorStop(0, 'rgba(255, 51, 51, 0.6)');
    gradientCPU.addColorStop(1, 'rgba(255, 51, 51, 0.0)');

    const gradientGPU = ctx.createLinearGradient(0, 0, 0, 400);
    gradientGPU.addColorStop(0, 'rgba(255, 102, 0, 0.6)');
    gradientGPU.addColorStop(1, 'rgba(255, 102, 0, 0.0)');

    const config = {
        type: 'line',
        data: {
            labels: Array(20).fill(''),
            datasets: [
                { label: 'CPU Usage (%)', data: Array(20).fill(0), borderColor: '#ff3333', backgroundColor: gradientCPU, borderWidth: 3, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 6 },
                { label: 'GPU Usage (%)', data: Array(20).fill(0), borderColor: '#ff6600', backgroundColor: gradientGPU, borderWidth: 3, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 6 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255, 0, 0, 0.15)' }, ticks: { color: '#ffaaaa' } }, x: { grid: { display: false }, ticks: { display: false } } },
            plugins: { legend: { labels: { color: '#ffffff', font: { family: "'Outfit', sans-serif", size: 14 } } } },
            animation: { duration: 800, easing: 'easeOutQuart' }
        }
    };
    const myChart = new Chart(ctx, config);

    // Prediction Chart Setup
    const pCtx = document.getElementById('predictionChart').getContext('2d');
    const pConfig = {
        type: 'bar',
        data: {
            labels: ['t-3', 't-2', 't-1', 'Now', 'Predicted (t+1)'],
            datasets: [
                { label: 'CPU Trend', data: [0, 0, 0, 0, 0], backgroundColor: 'rgba(255, 51, 51, 0.8)', borderColor: '#ff3333', borderWidth: 2, borderRadius: 4, hoverBackgroundColor: '#ff3333' },
                { label: 'GPU Trend', data: [0, 0, 0, 0, 0], backgroundColor: 'rgba(255, 102, 0, 0.8)', borderColor: '#ff6600', borderWidth: 2, borderRadius: 4, hoverBackgroundColor: '#ff6600' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255, 0, 0, 0.15)' }, ticks: { color: '#ffaaaa' } }, x: { grid: { color: 'rgba(255, 0, 0, 0.15)' }, ticks: { color: '#ffaaaa', font: { family: "'Outfit', sans-serif" } } } },
            plugins: { legend: { labels: { color: '#ffffff' } } },
            animation: { duration: 600, easing: 'easeOutBounce' }
        }
    };
    const predChart = new Chart(pCtx, pConfig);

    // Initial Node Render for Scheduler
    const maxNodes = 30; // More nodes for a cooler effect
    const nodeGrid = document.getElementById('node-grid');
    nodeGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(50px, 1fr))";
    for (let i = 0; i < maxNodes; i++) {
        const div = document.createElement('div');
        div.className = 'server-node standby-node';
        div.innerHTML = '<span style="font-size: 1.2rem;">⚡</span>';
        div.style.height = "50px";
        nodeGrid.appendChild(div);
    }

    const cpuHist = [0, 0, 0, 0];
    const gpuHist = [0, 0, 0, 0];

    // Main Update Function
    async function fetchSystemData() {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/system_status');
            const data = await response.json();
            updateDashboard(data);
        } catch (error) {
            console.error("Error fetching data:", error);
            const statusText = document.getElementById('system-status-text');
            if (statusText) {
                statusText.textContent = 'Disconnected - Simulating Offline Mode';
                statusText.style.color = '#ffaaaa';
            }
        }
    }

    function updateDashboard(data) {
        // Status indicator
        const statusText = document.getElementById('system-status-text');
        if (statusText) {
            statusText.textContent = 'System Active - Telemetry Locked';
            statusText.style.color = '#ff3333';
        }

        // --- DASHBOARD OVERVIEW: Number Scrolling ---
        updateNumberElement('cpu-value', data.monitoring.cpu, "%", false);
        updateNumberElement('gpu-value', data.monitoring.gpu, "%", false);
        updateNumberElement('power-value', data.monitoring.power, "W", false);
        updateNumberElement('carbon-value', data.carbon_footprint_reduction, "%", true);

        // Update Main View Line Chart Smoothly
        const cpuData = myChart.data.datasets[0].data;
        const gpuData = myChart.data.datasets[1].data;
        cpuData.shift(); cpuData.push(data.monitoring.cpu);
        gpuData.shift(); gpuData.push(data.monitoring.gpu);
        myChart.update();

        // Workload Prediction Updates
        updateNumberElement('pred-cpu', data.prediction.predicted_cpu, "%", false);
        updateNumberElement('pred-gpu', data.prediction.predicted_gpu, "%", false);

        // Scheduler Action Logic
        const statusBox = document.getElementById('scheduler-status');
        if (statusBox.textContent !== data.scheduler.status) {
            statusBox.style.transform = "scale(1.1)";
            setTimeout(() => { statusBox.style.transform = "scale(1)"; }, 300);
        }

        statusBox.textContent = data.scheduler.status;
        statusBox.className = 'status-box';
        if (data.scheduler.status.includes('Up')) statusBox.classList.add('scaling-up');
        else if (data.scheduler.status.includes('Down')) statusBox.classList.add('scaling-down');
        else statusBox.classList.add('optimal');

        document.getElementById('scheduler-action').textContent = data.scheduler.action_taken;
        updateNumberElement('active-servers', data.scheduler.servers_active, "", false);

        // Primary Model Selection Updates
        document.getElementById('selected-model').textContent = data.model_selection.model;
        document.getElementById('model-reason').textContent = data.model_selection.reason;

        const es = parseFloat(data.model_selection.energy_saved.replace('%', ''));
        if (!isNaN(es)) {
            updateNumberElement('energy-saved', es, "%", false);
        }

        // --- PREDICTIONS VIEW ---
        cpuHist.shift(); cpuHist.push(data.monitoring.cpu);
        gpuHist.shift(); gpuHist.push(data.monitoring.gpu);

        predChart.data.datasets[0].data = [...cpuHist, data.prediction.predicted_cpu];
        predChart.data.datasets[1].data = [...gpuHist, data.prediction.predicted_gpu];
        predChart.update();

        const maxDem = Math.max(data.prediction.predicted_cpu, data.prediction.predicted_gpu);
        updateNumberElement('proj-max-demand', maxDem, "%", false);

        // --- SCHEDULER VIEW ---
        // Exaggerate node animation for visual impact: Active servers = original simulated * 2 
        let visualActiveNodes = Math.min(data.scheduler.servers_active * 2, maxNodes);

        updateNumberElement('sched-active', visualActiveNodes, "", false);
        updateNumberElement('sched-standby', maxNodes - visualActiveNodes, "", false);

        const nodes = document.querySelectorAll('.server-node');
        nodes.forEach((n, idx) => {
            // Apply delay cascade effect
            setTimeout(() => {
                if (idx < visualActiveNodes) {
                    n.className = 'server-node active-node';
                } else {
                    n.className = 'server-node standby-node';
                }
            }, idx * 30);
        });

        // --- MODELS VIEW ---
        document.getElementById('models-selected').textContent = data.model_selection.model;
        document.getElementById('models-reason').textContent = data.model_selection.reason;

        document.querySelectorAll('.zoo-item').forEach(el => el.classList.remove('active-zoo'));
        if (data.model_selection.model.includes('ResNet')) document.getElementById('zoo-resnet').classList.add('active-zoo');
        else if (data.model_selection.model.includes('EfficientNet')) document.getElementById('zoo-efficientnet').classList.add('active-zoo');
        else if (data.model_selection.model.includes('MobileNet')) document.getElementById('zoo-mobilenet').classList.add('active-zoo');

        // --- THERMAL VIEW (Analytics) ---
        let throttleTemp = 30 + (data.monitoring.power / 15);
        if (isNaN(throttleTemp)) throttleTemp = 40;

        updateNumberElement('core-temp', throttleTemp, "C", true);

        const zones = document.querySelectorAll('.heat-zone');
        zones.forEach((z, i) => {
            const shift = data.monitoring.cpu * (i + 1.5) * 0.01;
            const r = Math.min(255, 120 + shift * 10);
            const g = Math.max(0, 50 - shift * 2);

            // Stagger zone updates
            setTimeout(() => {
                z.style.background = `radial-gradient(circle, rgba(${r},${g},0,0.9) 0%, rgba(139,0,0,1) 100%)`;
                z.style.boxShadow = `0 0 ${Math.max(20, shift * 2)}px var(--accent-red-glow)`;
                z.style.transform = `scale(${1 + (shift * 0.02)})`;
            }, i * 200);
        });
    }

    // Refresh every 2 seconds
    setInterval(fetchSystemData, 2000);
});
