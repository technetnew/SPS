/**
 * SPS Scenario Simulation Frontend
 */

// State
let currentScenario = 'power_outage_24h';
let currentMode = 'baseline';
let baselineResults = null;
let whatIfResults = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadUserInfo();
});

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
    }
}

function loadUserInfo() {
    const userInfo = document.getElementById('user-info');
    const username = localStorage.getItem('username') || 'User';
    if (userInfo) {
        userInfo.textContent = username;
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = 'login.html';
}

/**
 * Select scenario
 */
function selectScenario(scenario) {
    currentScenario = scenario;

    // Update UI
    document.querySelectorAll('.scenario-card').forEach(card => {
        card.classList.remove('active');
    });
    document.querySelector(`.scenario-card[data-scenario="${scenario}"]`)?.classList.add('active');

    // Clear previous results
    document.getElementById('results-section').style.display = 'none';
}

/**
 * Set mode (baseline or what-if)
 */
function setMode(mode) {
    currentMode = mode;

    document.getElementById('mode-baseline').classList.toggle('active', mode === 'baseline');
    document.getElementById('mode-whatif').classList.toggle('active', mode === 'whatif');
    document.getElementById('whatif-panel').style.display = mode === 'whatif' ? 'block' : 'none';
    document.getElementById('comparison-panel').style.display = 'none';

    // Clear what-if results when switching to baseline mode to prevent stale data
    if (mode === 'baseline') {
        whatIfResults = null;
    }

    // Hide results section when mode changes - user needs to re-run simulation
    document.getElementById('results-section').style.display = 'none';

    // Update button text
    const btn = document.getElementById('run-simulation-btn');
    if (mode === 'whatif') {
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Run What-If Simulation
        `;
    } else {
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Run Simulation
        `;
    }
}

/**
 * Run simulation
 */
async function runSimulation() {
    if (currentMode === 'whatif') {
        await runWhatIfSimulation();
    } else {
        await runBaselineSimulation();
    }
}

/**
 * Run baseline simulation
 */
async function runBaselineSimulation() {
    showLoading(true);

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/simulation/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ scenario: currentScenario })
        });

        if (!response.ok) {
            throw new Error('Simulation failed');
        }

        const data = await response.json();
        baselineResults = data.results;

        displayResults(baselineResults);
        showNotification('Simulation complete', 'success');

    } catch (error) {
        console.error('Simulation error:', error);
        showNotification('Failed to run simulation', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Run what-if simulation
 */
async function runWhatIfSimulation() {
    showLoading(true);

    try {
        const token = localStorage.getItem('token');
        const adjustments = getWhatIfAdjustments();

        const response = await fetch('/api/simulation/whatif', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                scenario: currentScenario,
                adjustments
            })
        });

        if (!response.ok) {
            throw new Error('Simulation failed');
        }

        const data = await response.json();
        baselineResults = data.baseline;
        whatIfResults = data.whatif;

        displayResults(whatIfResults, data.delta);
        showNotification('What-If simulation complete', 'success');

    } catch (error) {
        console.error('What-If simulation error:', error);
        showNotification('Failed to run what-if simulation', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Get what-if adjustments from form
 */
function getWhatIfAdjustments() {
    return {
        calories: parseInt(document.getElementById('whatif-calories').value) || 0,
        mreDays: parseInt(document.getElementById('whatif-mre-days').value) || 0,
        water: parseFloat(document.getElementById('whatif-water').value) || 0,
        filters: parseInt(document.getElementById('whatif-filters').value) || 0,
        propane: parseFloat(document.getElementById('whatif-propane').value) || 0,
        gasoline: parseFloat(document.getElementById('whatif-gasoline').value) || 0,
        solar: parseInt(document.getElementById('whatif-solar').value) || 0,
        battery: parseInt(document.getElementById('whatif-battery').value) || 0,
        firstaid: parseInt(document.getElementById('whatif-firstaid').value) || 0,
        prescriptions: parseInt(document.getElementById('whatif-prescriptions').value) || 0,
        adults: parseInt(document.getElementById('whatif-adults').value) || 0,
        children: parseInt(document.getElementById('whatif-children').value) || 0,
        cash: parseInt(document.getElementById('whatif-cash').value) || 0,
        docs: parseInt(document.getElementById('whatif-docs').value) || 0
    };
}

/**
 * Reset what-if adjustments
 */
function resetWhatIf() {
    document.querySelectorAll('.whatif-panel input, .whatif-panel select').forEach(el => {
        if (el.type === 'number') {
            el.value = '0';
        } else if (el.tagName === 'SELECT') {
            el.selectedIndex = 0;
        }
    });
}

/**
 * Display simulation results
 */
function displayResults(results, delta = null) {
    const section = document.getElementById('results-section');
    section.style.display = 'block';

    // Scroll to results
    section.scrollIntoView({ behavior: 'smooth' });

    // Update readiness score
    updateReadinessScore(results.readinessScore);

    // Update scenario title and status
    document.getElementById('scenario-title').textContent = results.scenario;
    document.getElementById('survival-days').textContent =
        results.survivalDays >= 365 ? '365+' : results.survivalDays;

    const statusEl = document.getElementById('score-status');
    if (results.readinessScore >= 80) {
        statusEl.textContent = 'Well Prepared';
        statusEl.className = 'score-status good';
    } else if (results.readinessScore >= 60) {
        statusEl.textContent = 'Moderately Prepared';
        statusEl.className = 'score-status moderate';
    } else if (results.readinessScore >= 40) {
        statusEl.textContent = 'Partially Prepared';
        statusEl.className = 'score-status warning';
    } else {
        statusEl.textContent = 'Critical Gaps';
        statusEl.className = 'score-status critical';
    }

    // Render category scores
    renderCategoryScores(results.categoryScores);

    // Render comparison only if what-if mode AND we have delta data AND baseline exists
    const comparisonPanel = document.getElementById('comparison-panel');
    if (delta && currentMode === 'whatif' && baselineResults && whatIfResults) {
        renderComparison(delta);
        comparisonPanel.style.display = 'block';
    } else {
        // Explicitly hide comparison panel for baseline mode
        comparisonPanel.style.display = 'none';
    }

    // Render timeline
    renderTimeline(results.timeline);

    // Render failure points
    renderFailurePoints(results.failurePoints);

    // Render shortages
    renderShortages(results.shortages);

    // Render recommendations
    renderRecommendations(results.recommendations);

    // Render narrative
    renderNarrative(results.narrative);
}

/**
 * Update readiness score circle
 */
function updateReadinessScore(score) {
    const scoreEl = document.getElementById('readiness-score');
    const progressEl = document.getElementById('score-progress');
    const circleEl = document.getElementById('readiness-circle');

    // Animate the number
    animateValue(scoreEl, 0, score, 1000);

    // Update circle progress
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (score / 100) * circumference;
    progressEl.style.strokeDasharray = circumference;
    progressEl.style.strokeDashoffset = offset;

    // Update color based on score
    let color;
    if (score >= 80) {
        color = '#22c55e';
    } else if (score >= 60) {
        color = '#eab308';
    } else if (score >= 40) {
        color = '#f97316';
    } else {
        color = '#ef4444';
    }
    progressEl.style.stroke = color;
    circleEl.style.setProperty('--score-color', color);
}

/**
 * Animate number value
 */
function animateValue(el, start, end, duration) {
    const range = end - start;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const value = Math.round(start + range * easeOutQuart(progress));
        el.textContent = value;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

function easeOutQuart(x) {
    return 1 - Math.pow(1 - x, 4);
}

/**
 * Render category scores
 */
function renderCategoryScores(scores) {
    const grid = document.getElementById('category-grid');
    const categories = [
        { key: 'food', label: 'Food', icon: '&#127857;' },
        { key: 'water', label: 'Water', icon: '&#128167;' },
        { key: 'energy', label: 'Energy', icon: '&#9889;' },
        { key: 'fuel', label: 'Fuel', icon: '&#128293;' },
        { key: 'medical', label: 'Medical', icon: '&#127973;' },
        { key: 'communications', label: 'Comms', icon: '&#128225;' },
        { key: 'documents', label: 'Documents', icon: '&#128196;' }
    ];

    grid.innerHTML = categories.map(cat => {
        const score = Math.round(scores[cat.key] || 0);
        const statusClass = score >= 80 ? 'good' : score >= 60 ? 'moderate' : score >= 40 ? 'warning' : 'critical';

        return `
            <div class="category-card ${statusClass}">
                <div class="category-icon">${cat.icon}</div>
                <div class="category-info">
                    <span class="category-label">${cat.label}</span>
                    <span class="category-score">${score}%</span>
                </div>
                <div class="category-bar">
                    <div class="category-progress" style="width: ${score}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render comparison panel
 */
function renderComparison(delta) {
    const panel = document.getElementById('comparison-panel');
    const grid = document.getElementById('comparison-grid');
    panel.style.display = 'block';

    const formatDelta = (val) => {
        if (val > 0) return `<span class="delta positive">+${Math.round(val)}</span>`;
        if (val < 0) return `<span class="delta negative">${Math.round(val)}</span>`;
        return `<span class="delta neutral">0</span>`;
    };

    grid.innerHTML = `
        <div class="comparison-item main">
            <span class="comparison-label">Overall Readiness</span>
            <div class="comparison-values">
                <span class="baseline-value">${baselineResults.readinessScore}%</span>
                <span class="arrow">&rarr;</span>
                <span class="whatif-value">${whatIfResults.readinessScore}%</span>
                ${formatDelta(delta.readinessChange)}
            </div>
        </div>
        <div class="comparison-item main">
            <span class="comparison-label">Survival Days</span>
            <div class="comparison-values">
                <span class="baseline-value">${baselineResults.survivalDays}</span>
                <span class="arrow">&rarr;</span>
                <span class="whatif-value">${whatIfResults.survivalDays}</span>
                ${formatDelta(delta.survivalDaysChange)}
            </div>
        </div>
        ${Object.entries(delta.categoryChanges).map(([key, change]) => `
            <div class="comparison-item">
                <span class="comparison-label">${key.charAt(0).toUpperCase() + key.slice(1)}</span>
                <div class="comparison-values">
                    <span class="baseline-value">${Math.round(baselineResults.categoryScores[key])}%</span>
                    <span class="arrow">&rarr;</span>
                    <span class="whatif-value">${Math.round(whatIfResults.categoryScores[key])}%</span>
                    ${formatDelta(change)}
                </div>
            </div>
        `).join('')}
    `;
}

/**
 * Render timeline
 */
function renderTimeline(timeline) {
    const container = document.getElementById('timeline');

    if (!timeline || timeline.length === 0) {
        container.innerHTML = '<p class="empty-text">No critical events during this scenario</p>';
        return;
    }

    container.innerHTML = timeline.map(event => `
        <div class="timeline-event ${event.severity}">
            <div class="timeline-day">Day ${event.day}</div>
            <div class="timeline-content">
                <span class="timeline-icon ${event.category}">${getCategoryIcon(event.category)}</span>
                <span class="timeline-text">${event.event}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Get category icon
 */
function getCategoryIcon(category) {
    const icons = {
        food: '&#127857;',
        water: '&#128167;',
        energy: '&#9889;',
        fuel: '&#128293;',
        medical: '&#127973;'
    };
    return icons[category] || '&#8226;';
}

/**
 * Render failure points
 */
function renderFailurePoints(failures) {
    const container = document.getElementById('failure-points');

    if (!failures || failures.length === 0) {
        container.innerHTML = '<p class="empty-text">No critical failure points identified</p>';
        return;
    }

    container.innerHTML = failures.map(failure => `
        <div class="alert-item ${failure.severity}">
            <span class="alert-category">${failure.category}</span>
            <span class="alert-message">${failure.message}</span>
        </div>
    `).join('');
}

/**
 * Render shortages
 */
function renderShortages(shortages) {
    const container = document.getElementById('shortages');

    if (!shortages || shortages.length === 0) {
        container.innerHTML = '<p class="empty-text">No shortages identified</p>';
        return;
    }

    container.innerHTML = shortages.map(shortage => `
        <div class="shortage-item">
            <div class="shortage-header">
                <span class="shortage-name">${shortage.item}</span>
                <span class="shortage-deficit">-${formatNumber(shortage.deficit)} ${shortage.unit}</span>
            </div>
            <div class="shortage-details">
                <span>Have: ${formatNumber(shortage.have)} ${shortage.unit}</span>
                <span>Need: ${formatNumber(shortage.need)} ${shortage.unit}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Render recommendations
 */
function renderRecommendations(recommendations) {
    const container = document.getElementById('recommendations');

    if (!recommendations || recommendations.length === 0) {
        container.innerHTML = '<p class="empty-text">No recommendations at this time</p>';
        return;
    }

    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item ${rec.priority}">
            <div class="recommendation-header">
                <span class="recommendation-priority">${rec.priority.toUpperCase()}</span>
                <span class="recommendation-category">${rec.category}</span>
            </div>
            <div class="recommendation-action">${rec.action}</div>
            <div class="recommendation-details">${rec.details}</div>
        </div>
    `).join('');
}

/**
 * Render narrative
 */
function renderNarrative(narrative) {
    const container = document.getElementById('narrative');

    // Convert markdown-style formatting
    let html = narrative
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n- /g, '</p><ul><li>')
        .replace(/\n/g, '<br>');

    // Clean up list formatting
    if (html.includes('<ul>')) {
        html = html.replace(/<br><li>/g, '</li><li>');
        html += '</li></ul>';
    }

    container.innerHTML = `<p>${html}</p>`;
}

/**
 * Export results as PDF
 */
function exportResults() {
    if (!baselineResults) {
        showNotification('Run a simulation first', 'warning');
        return;
    }

    const results = currentMode === 'whatif' && whatIfResults ? whatIfResults : baselineResults;
    const isWhatIf = currentMode === 'whatif' && whatIfResults;

    // Initialize jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    // Helper functions
    const addNewPageIfNeeded = (neededSpace = 30) => {
        if (y + neededSpace > pageHeight - margin) {
            doc.addPage();
            y = margin;
            return true;
        }
        return false;
    };

    const getScoreColor = (score) => {
        if (score >= 80) return [34, 197, 94];     // green
        if (score >= 60) return [234, 179, 8];     // yellow
        if (score >= 40) return [249, 115, 22];    // orange
        return [239, 68, 68];                       // red
    };

    const drawProgressBar = (x, yPos, width, score) => {
        const height = 4;
        // Background
        doc.setFillColor(200, 200, 200);
        doc.rect(x, yPos, width, height, 'F');
        // Progress
        const color = getScoreColor(score);
        doc.setFillColor(...color);
        doc.rect(x, yPos, width * (score / 100), height, 'F');
    };

    // ===== HEADER =====
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('SPS Scenario Simulation Report', margin, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 28);
    doc.text(isWhatIf ? 'MODE: What-If Analysis' : 'MODE: Baseline Assessment', margin, 34);

    y = 50;

    // ===== SCENARIO INFO =====
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Scenario Overview', margin, y);
    y += 8;

    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Scenario: ${results.scenario}`, margin, y);
    y += 6;
    doc.text(`Duration: ${results.duration} days`, margin, y);
    y += 10;

    // ===== READINESS SCORE BOX =====
    const scoreBoxWidth = pageWidth - margin * 2;
    const scoreBoxHeight = 35;
    const scoreColor = getScoreColor(results.readinessScore);

    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, y, scoreBoxWidth, scoreBoxHeight, 3, 3, 'F');

    // Score circle
    const circleX = margin + 25;
    const circleY = y + scoreBoxHeight / 2;
    doc.setFillColor(...scoreColor);
    doc.circle(circleX, circleY, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${results.readinessScore}%`, circleX, circleY + 1, { align: 'center' });

    // Score text
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Overall Readiness Score', margin + 45, y + 12);

    let status = 'Critical Gaps';
    if (results.readinessScore >= 80) status = 'Well Prepared';
    else if (results.readinessScore >= 60) status = 'Moderately Prepared';
    else if (results.readinessScore >= 40) status = 'Partially Prepared';

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...scoreColor);
    doc.text(status, margin + 45, y + 20);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.text(`Estimated Survival: ${results.survivalDays >= 365 ? '365+' : results.survivalDays} days`, margin + 45, y + 28);

    y += scoreBoxHeight + 12;

    // ===== CATEGORY SCORES =====
    addNewPageIfNeeded(60);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Category Breakdown', margin, y);
    y += 8;

    const categories = [
        { key: 'food', label: 'Food Supply' },
        { key: 'water', label: 'Water' },
        { key: 'energy', label: 'Energy' },
        { key: 'fuel', label: 'Fuel' },
        { key: 'medical', label: 'Medical' },
        { key: 'communications', label: 'Communications' },
        { key: 'documents', label: 'Documents' }
    ];

    const catData = categories.map(cat => {
        const score = Math.round(results.categoryScores[cat.key] || 0);
        return [cat.label, `${score}%`];
    });

    doc.autoTable({
        startY: y,
        head: [['Category', 'Score']],
        body: catData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 30, halign: 'center' }
        },
        margin: { left: margin, right: margin },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 1) {
                const score = parseInt(data.cell.raw);
                const barX = data.cell.x + 35;
                const barY = data.cell.y + 4;
                drawProgressBar(barX, barY, 50, score);
            }
        }
    });

    y = doc.lastAutoTable.finalY + 12;

    // ===== WHAT-IF COMPARISON (if applicable) =====
    if (isWhatIf && baselineResults) {
        addNewPageIfNeeded(60);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('What-If Comparison: Baseline vs Adjusted', margin, y);
        y += 8;

        const compData = [
            ['Overall Readiness', `${baselineResults.readinessScore}%`, `${whatIfResults.readinessScore}%`, `${whatIfResults.readinessScore - baselineResults.readinessScore > 0 ? '+' : ''}${whatIfResults.readinessScore - baselineResults.readinessScore}%`],
            ['Survival Days', baselineResults.survivalDays.toString(), whatIfResults.survivalDays.toString(), `${whatIfResults.survivalDays - baselineResults.survivalDays > 0 ? '+' : ''}${whatIfResults.survivalDays - baselineResults.survivalDays}`],
        ];

        categories.forEach(cat => {
            const baseScore = Math.round(baselineResults.categoryScores[cat.key] || 0);
            const whatIfScore = Math.round(whatIfResults.categoryScores[cat.key] || 0);
            const diff = whatIfScore - baseScore;
            compData.push([cat.label, `${baseScore}%`, `${whatIfScore}%`, `${diff > 0 ? '+' : ''}${diff}%`]);
        });

        doc.autoTable({
            startY: y,
            head: [['Metric', 'Baseline', 'What-If', 'Change']],
            body: compData,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246], textColor: 255 },
            columnStyles: {
                0: { cellWidth: 60 },
                1: { cellWidth: 35, halign: 'center' },
                2: { cellWidth: 35, halign: 'center' },
                3: { cellWidth: 30, halign: 'center' }
            },
            margin: { left: margin, right: margin },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 3) {
                    const val = parseFloat(data.cell.raw);
                    if (val > 0) data.cell.styles.textColor = [34, 197, 94];
                    else if (val < 0) data.cell.styles.textColor = [239, 68, 68];
                }
            }
        });

        y = doc.lastAutoTable.finalY + 12;
    }

    // ===== TIMELINE =====
    if (results.timeline && results.timeline.length > 0) {
        addNewPageIfNeeded(50);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Event Timeline', margin, y);
        y += 8;

        const timelineData = results.timeline.map(event => [
            `Day ${event.day}`,
            event.category.charAt(0).toUpperCase() + event.category.slice(1),
            event.event,
            event.severity.toUpperCase()
        ]);

        doc.autoTable({
            startY: y,
            head: [['Day', 'Category', 'Event', 'Severity']],
            body: timelineData,
            theme: 'striped',
            headStyles: { fillColor: [100, 100, 100], textColor: 255 },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 30 },
                2: { cellWidth: 90 },
                3: { cellWidth: 25, halign: 'center' }
            },
            margin: { left: margin, right: margin },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 3) {
                    if (data.cell.raw === 'CRITICAL') data.cell.styles.textColor = [239, 68, 68];
                    else if (data.cell.raw === 'WARNING') data.cell.styles.textColor = [249, 115, 22];
                }
            }
        });

        y = doc.lastAutoTable.finalY + 12;
    }

    // ===== FAILURE POINTS =====
    if (results.failurePoints && results.failurePoints.length > 0) {
        addNewPageIfNeeded(50);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(239, 68, 68);
        doc.text('Critical Failure Points', margin, y);
        y += 8;

        const failureData = results.failurePoints.map(f => [
            f.severity.toUpperCase(),
            f.category,
            f.message
        ]);

        doc.autoTable({
            startY: y,
            head: [['Severity', 'Category', 'Issue']],
            body: failureData,
            theme: 'striped',
            headStyles: { fillColor: [239, 68, 68], textColor: 255 },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 30 },
                2: { cellWidth: 'auto' }
            },
            margin: { left: margin, right: margin }
        });

        y = doc.lastAutoTable.finalY + 12;
    }

    // ===== SHORTAGES =====
    if (results.shortages && results.shortages.length > 0) {
        addNewPageIfNeeded(50);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(249, 115, 22);
        doc.text('Supply Shortages', margin, y);
        y += 8;

        const shortageData = results.shortages.map(s => [
            s.item,
            `${formatNumber(s.have)} ${s.unit}`,
            `${formatNumber(s.need)} ${s.unit}`,
            `-${formatNumber(s.deficit)} ${s.unit}`
        ]);

        doc.autoTable({
            startY: y,
            head: [['Item', 'Have', 'Need', 'Deficit']],
            body: shortageData,
            theme: 'striped',
            headStyles: { fillColor: [249, 115, 22], textColor: 255 },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 35, halign: 'right' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 35, halign: 'right', textColor: [239, 68, 68] }
            },
            margin: { left: margin, right: margin }
        });

        y = doc.lastAutoTable.finalY + 12;
    }

    // ===== RECOMMENDATIONS =====
    if (results.recommendations && results.recommendations.length > 0) {
        addNewPageIfNeeded(50);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(34, 197, 94);
        doc.text('Recommendations', margin, y);
        y += 8;

        const recData = results.recommendations.map(r => [
            r.priority.toUpperCase(),
            r.category,
            r.action,
            r.details
        ]);

        doc.autoTable({
            startY: y,
            head: [['Priority', 'Category', 'Action', 'Details']],
            body: recData,
            theme: 'striped',
            headStyles: { fillColor: [34, 197, 94], textColor: 255 },
            columnStyles: {
                0: { cellWidth: 20, halign: 'center' },
                1: { cellWidth: 25 },
                2: { cellWidth: 50 },
                3: { cellWidth: 'auto' }
            },
            margin: { left: margin, right: margin },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 0) {
                    if (data.cell.raw === 'HIGH') data.cell.styles.textColor = [239, 68, 68];
                    else if (data.cell.raw === 'MEDIUM') data.cell.styles.textColor = [249, 115, 22];
                    else data.cell.styles.textColor = [34, 197, 94];
                }
            }
        });

        y = doc.lastAutoTable.finalY + 12;
    }

    // ===== NARRATIVE =====
    addNewPageIfNeeded(40);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Simulation Narrative', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);

    // Clean and wrap narrative text
    const narrativeClean = results.narrative
        .replace(/\*\*/g, '')
        .replace(/\n- /g, '\n• ');

    const splitNarrative = doc.splitTextToSize(narrativeClean, pageWidth - margin * 2);
    for (const line of splitNarrative) {
        if (addNewPageIfNeeded(7)) {
            // Add continuation header on new page
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 100, 100);
            doc.text('Simulation Narrative (continued)', margin, y);
            y += 7;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
        }
        doc.text(line, margin, y);
        y += 5;
    }

    // ===== FOOTER =====
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text('SPS - Survival Preparedness System', margin, pageHeight - 10);
        doc.text(new Date().toLocaleDateString(), pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    // Save PDF
    const filename = isWhatIf
        ? `sps-whatif-simulation-${results.scenarioKey}-${new Date().toISOString().split('T')[0]}.pdf`
        : `sps-simulation-${results.scenarioKey}-${new Date().toISOString().split('T')[0]}.pdf`;

    doc.save(filename);
    showNotification('PDF report exported successfully', 'success');
}

/**
 * Show loading overlay
 */
function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = 'position: fixed; top: 1rem; right: 1rem; z-index: 9999;';
        document.body.appendChild(container);
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        padding: 1rem 1.5rem;
        margin-bottom: 0.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
        background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    `;
    notification.textContent = message;

    container.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Export functions
window.selectScenario = selectScenario;
window.setMode = setMode;
window.runSimulation = runSimulation;
window.runWhatIfSimulation = runWhatIfSimulation;
window.resetWhatIf = resetWhatIf;
window.exportResults = exportResults;
window.logout = logout;
