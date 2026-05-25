/* ==========================================================================
   LIFE IN NUMBERS + SUPERDESIGN FRONTEND INTERACTION
   Visual reveals, local clocks, interactive ApexCharts, and projection terminals
   ========================================================================== */

// --- Global Variables & App State ---
let appData = null; 
let selectedProjTab = 0; 

// Chart Instances
let allocationChart = null;
let circadianChart = null;

// Simulator State
let simInterval = null;
let simIndex = 16; // default morning wake slot (08:00 AM)
let isSimPlaying = false;
let simHabits = [];
let simRecharge = 'solitude';

// --- Value Badges Helper ---
function updateValBadge(id, suffix = '') {
    const input = document.getElementById(id);
    const badge = document.getElementById(`${id}-val`);
    if (input && badge) {
        let val = input.value;
        if (id === 'sleep_time' || id === 'screen_time' || id === 'social_hours' || id === 'music_hours') {
            badge.innerText = `${parseFloat(val).toFixed(1)}${suffix}`;
        } else if (id === 'social_battery') {
            badge.innerText = `${val}${suffix}`;
        } else {
            badge.innerText = `${val}${suffix}`;
        }
    }
}

// Dummy toggle function to support inline html calls safely
function toggleRechargeUI() {
    // Handled perfectly via CSS input[type="radio"]:checked sibling selectors
}

// Initialize setup on page load
document.addEventListener("DOMContentLoaded", () => {
    // Badges baseline
    updateValBadge('age');
    updateValBadge('sleep_time', ' hrs');
    updateValBadge('screen_time', ' hrs');
    updateValBadge('social_battery', '/10');
    updateValBadge('social_hours', ' hrs');
    updateValBadge('music_hours', ' hrs');
    
    // Set up reveals and parallax
    initSuperdesignEffects();
    
    // Playback buttons
    setupSimulatorControls();
});

// --- SUPERDESIGN INTERACTION EFFECT SYSTEMS ---
function initSuperdesignEffects() {
    // 1. Reveal Elements on Scroll using Intersection Observer
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, {
        threshold: 0.05,
        rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // 2. Navbar Scroll Visual Effect
    const nav = document.getElementById('main-nav');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('py-4', 'bg-[#050505]/85', 'backdrop-blur-md', 'border-b', 'border-white/5');
            nav.classList.remove('py-8', 'bg-transparent');
        } else {
            nav.classList.remove('py-4', 'bg-[#050505]/85', 'backdrop-blur-md', 'border-b', 'border-white/5');
            nav.classList.add('py-8', 'bg-transparent');
        }
    });

    // 3. Simple Scroll Parallax offsets for depth
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        document.querySelectorAll('.parallax-card-up').forEach(el => {
            el.style.setProperty('--scroll-offset-up', `${scrolled * -0.04}px`);
        });
        document.querySelectorAll('.parallax-card-down').forEach(el => {
            el.style.setProperty('--scroll-offset-down', `${scrolled * 0.04}px`);
        });
    });

    // 4. Update Time Clock
    function updateTime() {
        const clockEl = document.getElementById('current-time');
        if (!clockEl) return;
        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; 
        clockEl.textContent = `${hours}:${minutes} ${ampm}`;
    }
    setInterval(updateTime, 60000);
    updateTime();

    // 5. Hero Content Parallax translation
    const heroWrapper = document.getElementById('hero-content-wrapper');
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        if (scrolled < 1000 && heroWrapper) {
            heroWrapper.style.transform = `translateY(${scrolled * 0.35}px)`;
            heroWrapper.style.opacity = Math.max(0, 1 - scrolled / 600);
        }
    });
}

// --- Trigger Analysis API ---
async function triggerAnalysis() {
    const form = document.getElementById('analytics-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    // Loading State
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="relative z-10 text-white font-mono">// CALCULATING LIFESPANS...</span>`;
    
    // Parse form values
    const age = parseFloat(document.getElementById('age').value);
    const sleep_time = parseFloat(document.getElementById('sleep_time').value);
    const screen_time = parseFloat(document.getElementById('screen_time').value);
    const social_battery = parseFloat(document.getElementById('social_battery').value);
    const social_hours = parseFloat(document.getElementById('social_hours').value);
    const recharge_method = form.querySelector('input[name="recharge_method"]:checked').value;
    const music_genre = document.getElementById('music_genre').value;
    const music_hours = parseFloat(document.getElementById('music_hours').value);
    
    // Get checked habits
    const habitsCheckboxes = form.querySelectorAll('input[name="habits"]:checked');
    const habits = Array.from(habitsCheckboxes).map(cb => cb.value);

    const payload = {
        age,
        sleep_time,
        screen_time,
        social_battery,
        social_hours,
        recharge_method,
        music_genre,
        music_hours,
        habits
    };

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const res = await response.json();
        
        if (res.success) {
            appData = res;
            
            // Hide blank panel, show dashboard panels
            document.getElementById('welcome-state').classList.add('hidden');
            document.getElementById('analytics-content').classList.remove('hidden');
            
            // 1. Populate summary stats
            populateSummary(res.summary);
            
            // 2. Render Donut Allocation
            renderAllocationChart(payload);
            
            // 3. Render Circadian metrics
            renderCircadianChart(res.simulation);
            
            // 4. Initialize Interactive Simulator
            initSimulator(res.simulation, habits, recharge_method);
            
            // 5. Render projections terminal
            renderFutureSelfTerminal();
            
            // Smoothly scroll down slightly to dashboard content so user sees output
            setTimeout(() => {
                document.getElementById('welcome-state').scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
            
            // Re-trigger scroll reveal observers to catch new graphs
            setTimeout(() => {
                document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
            }, 500);
            
        } else {
            alert("Analysis Error: " + res.error);
        }
    } catch (err) {
        console.error(err);
        alert("Failed to connect to the backend analytics engine.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// --- Populate General Stats ---
function populateSummary(summary) {
    document.getElementById('val-bio-age').innerText = summary.biological_age.toFixed(1);
    
    // Bio age difference calculation
    const diff = summary.biological_age - summary.chronological_age;
    const diffBadge = document.getElementById('val-bio-diff');
    if (diff > 0) {
        diffBadge.innerText = `+${diff.toFixed(1)}`;
        diffBadge.className = 'text-xs font-mono px-2 py-0.5 rounded-full font-bold bg-[#ff5252]/10 text-[#ff5252] border border-[#ff5252]/20'; 
    } else if (diff < 0) {
        diffBadge.innerText = `${diff.toFixed(1)}`;
        diffBadge.className = 'text-xs font-mono px-2 py-0.5 rounded-full font-bold bg-[#69f0ae]/10 text-[#69f0ae] border border-[#69f0ae]/20';
    } else {
        diffBadge.innerText = `±0.0`;
        diffBadge.className = 'text-xs font-mono px-2 py-0.5 rounded-full font-bold bg-white/5 text-white/50 border border-white/10';
    }
    
    document.getElementById('val-lifespan').innerText = summary.life_expectancy.toFixed(1);
    document.getElementById('val-vitality').innerText = summary.vitality_score;
    document.getElementById('val-screen-years').innerText = summary.remaining_screen_years.toFixed(1);
    
    // Sleep debt annual footer
    document.getElementById('stat-sleep-debt').innerText = `${summary.sleep_debt_annual.toFixed(0)} hrs/year`;
    if (summary.sleep_debt_annual > 300) {
        document.getElementById('stat-sleep-debt').className = 'font-bold text-[#ff5252]';
    } else if (summary.sleep_debt_annual > 0) {
        document.getElementById('stat-sleep-debt').className = 'font-bold text-amber-500';
    } else {
        document.getElementById('stat-sleep-debt').className = 'font-bold text-[#69f0ae]';
        document.getElementById('stat-sleep-debt').innerText = 'Optimal Baseline';
    }
}

// --- Render Time Allocation Donut Chart ---
function renderAllocationChart(inputs) {
    const sleep = inputs.sleep_time;
    const screen = inputs.screen_time;
    const music = inputs.music_hours;
    const social = inputs.social_hours / 7.0; 
    
    let habitHours = 0;
    inputs.habits.forEach(h => {
        if (h === 'exercise') habitHours += 1.0;
        if (h === 'meditation') habitHours += 0.5;
        if (h === 'reading') habitHours += 0.75;
    });
    
    const totalCrunched = sleep + screen + music + social + habitHours;
    const remaining = Math.max(0.5, 24.0 - totalCrunched);
    
    const chartData = [
        parseFloat(sleep.toFixed(1)), 
        parseFloat(screen.toFixed(1)), 
        parseFloat(social.toFixed(1)), 
        parseFloat(music.toFixed(1)), 
        parseFloat(habitHours.toFixed(1)), 
        parseFloat(remaining.toFixed(1))
    ];
    const chartLabels = ['Sleep', 'Screen Time', 'Socializing', 'Music Focus', 'Self Care Habits', 'Work & Other'];
    
    const options = {
        series: chartData,
        chart: {
            type: 'donut',
            height: '240px',
            fontFamily: 'Inter',
            foreColor: '#8b9bb4',
            background: 'transparent',
            toolbar: { show: false }
        },
        labels: chartLabels,
        colors: ['#00F2FE', '#FF4500', '#FFAB00', '#7C4DFF', '#00E676', '#53627C'],
        stroke: {
            show: true,
            colors: ['#111111'],
            width: 2
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '72%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#8b9bb4'
                        },
                        value: {
                            show: true,
                            fontSize: '18px',
                            fontWeight: 700,
                            color: '#ffffff',
                            formatter: (val) => `${val}h`
                        },
                        total: {
                            show: true,
                            label: 'Total Day',
                            color: '#8b9bb4',
                            formatter: () => '24.0h'
                        }
                    }
                }
            }
        },
        dataLabels: { enabled: false },
        legend: {
            show: true,
            position: 'bottom',
            horizontalAlign: 'center',
            fontSize: '10px',
            fontFamily: 'Inter',
            markers: { radius: 12 },
            itemMargin: { horizontal: 5, vertical: 1 }
        },
        tooltip: {
            enabled: true,
            theme: 'dark',
            y: { formatter: (val) => `${val} hours` }
        }
    };

    if (allocationChart) {
        allocationChart.updateOptions(options);
    } else {
        allocationChart = new ApexCharts(document.querySelector("#chart-allocation"), options);
        allocationChart.render();
    }
}

// --- Render Circadian Line Chart ---
function renderCircadianChart(simData) {
    const times = simData.map(d => d.time);
    const energy = simData.map(d => d.energy);
    const social = simData.map(d => d.social);
    const alertness = simData.map(d => d.alertness);

    // We filter at hourly intervals for a sleeker chart (every 2nd step)
    const filteredTimes = times.filter((_, idx) => idx % 2 === 0);
    const filteredEnergy = energy.filter((_, idx) => idx % 2 === 0);
    const filteredSocial = social.filter((_, idx) => idx % 2 === 0);
    const filteredAlertness = alertness.filter((_, idx) => idx % 2 === 0);

    const options = {
        series: [
            { name: 'Physical Energy', data: filteredEnergy },
            { name: 'Cognitive Alertness', data: filteredAlertness },
            { name: 'Social Battery', data: filteredSocial }
        ],
        chart: {
            type: 'area',
            height: '240px',
            fontFamily: 'Inter',
            foreColor: '#8b9bb4',
            background: 'transparent',
            toolbar: { show: false },
            zoom: { enabled: false }
        },
        colors: ['#FF4500', '#7C4DFF', '#00F2FE'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.20,
                opacityTo: 0.02,
                stops: [0, 95, 100]
            }
        },
        stroke: {
            curve: 'smooth',
            width: 2.5
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: filteredTimes,
            axisBorder: { show: false },
            axisTicks: { show: false },
            tooltip: { enabled: false }
        },
        yaxis: {
            min: 0,
            max: 100,
            tickAmount: 4,
            labels: { formatter: (val) => `${val}%` }
        },
        grid: {
            borderColor: 'rgba(255, 255, 255, 0.04)',
            strokeDashArray: 3
        },
        legend: {
            show: true,
            position: 'top',
            horizontalAlign: 'right',
            fontSize: '11px'
        },
        tooltip: {
            theme: 'dark',
            x: { show: true },
            y: { formatter: (val) => `${val}%` }
        }
    };

    if (circadianChart) {
        circadianChart.updateOptions(options);
    } else {
        circadianChart = new ApexCharts(document.querySelector("#chart-circadian"), options);
        circadianChart.render();
    }
}

// --- 24-HOUR INTERACTIVE TIMELAPSE SIMULATOR ---
function initSimulator(simData, habits, recharge) {
    stopSimulator();
    
    simHabits = habits;
    simRecharge = recharge;
    simIndex = 16; // default wake time (08:00 AM)
    
    updateSimulatorFrame(simData);
}

function updateSimulatorFrame(simData) {
    const current = simData[simIndex];
    
    // Update Slider Scrubber
    const scrubber = document.getElementById('sim-scrubber');
    scrubber.value = simIndex;
    
    // Update Clock and Day Phase
    const clockBadge = document.getElementById('sim-clock-val');
    const periodBadge = document.getElementById('sim-period');
    clockBadge.innerText = current.time;
    
    const [hourStr, minStr] = current.time.split(':');
    const hour = parseInt(hourStr) + (parseInt(minStr)/60);
    
    let period = 'NIGHT';
    if (hour >= 6 && hour < 12) period = 'MORNING';
    else if (hour >= 12 && hour < 17) period = 'AFTERNOON';
    else if (hour >= 17 && hour < 22) period = 'EVENING';
    
    periodBadge.innerText = period;
    
    // Update Gauge widths
    document.getElementById('sim-gauge-energy').style.width = `${current.energy}%`;
    document.getElementById('sim-gauge-alertness').style.width = `${current.alertness}%`;
    document.getElementById('sim-gauge-social').style.width = `${current.social}%`;
    
    // Update numeric percentage labels
    document.getElementById('sim-val-energy').innerText = `${current.energy}%`;
    document.getElementById('sim-val-alertness').innerText = `${current.alertness}%`;
    document.getElementById('sim-val-social').innerText = `${current.social}%`;
    
    // Formulate descriptive console logging based on active routines
    let logMsg = "";
    const isSleeping = (current.alertness <= 15);
    
    if (isSleeping) {
        logMsg = `Biological standby mode engaged. Physical energy recovering rapidly (+${(100.0 / Math.max(4.0, current.energy)).toFixed(1)}%/hr). Brain delta-wave patterns active.`;
    } else {
        if (hour >= 7 && hour < 9) {
            logMsg = `Circadian waking sequence completed. Endocrine levels stabilizing physical stamina. `;
            if (simHabits.includes('exercise')) {
                logMsg += `🏋️ Regular exercise session detected. physical fatigue spiked temporarily, endorphin floor expanding for afternoon.`;
            }
        } else if (hour >= 9 && hour < 13) {
            logMsg = `High-intensity cognitive slot active. Standard screen time fatigue is compounding. Posture support decay baseline active.`;
        } else if (hour >= 13 && hour < 16) {
            logMsg = `Post-prandial metabolic down-cycle. Natural afternoon alertness dip active. Posture slumping detected.`;
        } else if (hour >= 16 && hour < 19) {
            logMsg = `Late afternoon fatigue transition. `;
            if (simHabits.includes('meditation') && hour >= 18 && hour < 18.5) {
                logMsg += `🧘 Meditation cycle active. Stress cortisol dampened, physical and social battery levels boosted.`;
            } else {
                logMsg += `System screen time fatigue peaks. Alertness decaying.`;
            }
        } else if (hour >= 19 && hour < 22) {
            if (simRecharge === 'solitude') {
                logMsg = `Social exposure thresholds exhausted. Introverted recovery cycle initialized. Ambient solitude boosts battery.`;
            } else {
                logMsg = `Extroverted energy stimulation window. Interactive socialization raising base battery parameters.`;
            }
        } else {
            logMsg = `Pre-sleep wind-down protocol active. Melatonin index rising. Warning: Screen luminosity at this hour blocks REM depth.`;
        }
    }
    
    document.getElementById('sim-log-text').innerText = logMsg;
}

function setupSimulatorControls() {
    const playBtn = document.getElementById('sim-btn-play');
    const prevBtn = document.getElementById('sim-btn-prev');
    const nextBtn = document.getElementById('sim-btn-next');
    const scrubber = document.getElementById('sim-scrubber');
    const speedSelect = document.getElementById('sim-speed');
    
    playBtn.addEventListener('click', () => {
        if (isSimPlaying) {
            stopSimulator();
        } else {
            startSimulator();
        }
    });
    
    prevBtn.addEventListener('click', () => {
        if (!appData) return;
        stopSimulator();
        simIndex = (simIndex - 1 + 48) % 48;
        updateSimulatorFrame(appData.simulation);
    });
    
    nextBtn.addEventListener('click', () => {
        if (!appData) return;
        stopSimulator();
        simIndex = (simIndex + 1) % 48;
        updateSimulatorFrame(appData.simulation);
    });
    
    scrubber.addEventListener('input', () => {
        if (!appData) return;
        stopSimulator();
        simIndex = parseInt(scrubber.value);
        updateSimulatorFrame(appData.simulation);
    });
    
    speedSelect.addEventListener('change', () => {
        if (isSimPlaying) {
            stopSimulator();
            startSimulator();
        }
    });
}

function startSimulator() {
    if (!appData) return;
    const playBtn = document.getElementById('sim-btn-play');
    const speed = parseInt(document.getElementById('sim-speed').value);
    
    isSimPlaying = true;
    playBtn.innerText = "⏸ PAUSE";
    playBtn.style.backgroundColor = "#FF4500";
    playBtn.style.color = "#ffffff";
    
    simInterval = setInterval(() => {
        simIndex = (simIndex + 1) % 48;
        updateSimulatorFrame(appData.simulation);
    }, speed);
}

function stopSimulator() {
    const playBtn = document.getElementById('sim-btn-play');
    isSimPlaying = false;
    if (playBtn) {
        playBtn.innerText = "▶ PLAY";
        playBtn.style.backgroundColor = "";
        playBtn.style.color = "";
    }
    if (simInterval) {
        clearInterval(simInterval);
        simInterval = null;
    }
}

// --- FUTURE SELF TERMINAL PROJECTIONS ---
let textTypingTimers = [];

function switchProjTab(index) {
    if (!appData) return;
    
    const tabs = document.querySelectorAll('.term-tab');
    tabs.forEach((tab, idx) => {
        if (idx === index) {
            tab.classList.add('active', 'text-white');
            tab.classList.remove('text-gray-400');
        } else {
            tab.classList.remove('active', 'text-white');
            tab.classList.add('text-gray-400');
        }
    });
    
    selectedProjTab = index;
    renderFutureSelfTerminal();
}

function renderFutureSelfTerminal() {
    if (!appData) return;
    
    const proj = appData.projections[selectedProjTab];
    
    // Clear active typing loops
    textTypingTimers.forEach(t => clearTimeout(t));
    textTypingTimers = [];
    
    // Update ages headers
    document.getElementById('c-path-age').innerText = `Age ${proj.target_age}`;
    document.getElementById('o-path-age').innerText = `Age ${proj.target_age}`;
    
    // Trigger typing loops
    typewriter('c-path-text', proj.current_path.narrative);
    typewriter('o-path-text', proj.optimized_path.narrative);
    
    // Update tickers
    const cStats = proj.current_path;
    const oStats = proj.optimized_path;
    
    document.getElementById('c-tick-bio').innerText = cStats.bio_age.toFixed(1);
    document.getElementById('o-tick-bio').innerText = oStats.bio_age.toFixed(1);
    
    document.getElementById('c-tick-screen').innerText = `${cStats.screen_time_years.toFixed(1)} yrs`;
    document.getElementById('o-tick-screen').innerText = `${oStats.screen_time_years.toFixed(1)} yrs`;
    
    document.getElementById('c-tick-sleep').innerText = cStats.sleep_debt_hours > 0 ? `${cStats.sleep_debt_hours.toLocaleString()}h` : `0h`;
    document.getElementById('o-tick-sleep').innerText = `0h`;
    
    document.getElementById('c-tick-books').innerText = cStats.books_read;
    document.getElementById('o-tick-books').innerText = oStats.books_read;
}

function typewriter(elementId, text, charIndex = 0) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    if (charIndex === 0) {
        el.textContent = "";
    }
    
    // Print 3 letters at a time for modern speedy terminal typing feel
    const chunk = text.slice(charIndex, charIndex + 3);
    el.textContent += chunk;
    
    if (charIndex + 3 < text.length) {
        const timer = setTimeout(() => {
            typewriter(elementId, text, charIndex + 3);
        }, 12); 
        textTypingTimers.push(timer);
    }
}
