/**
 * SPS Medical Guide Module
 * Features: First aid guides, Medication tracking, Health conditions, Supply inventory
 */

// Global state
let medications = [];
let conditions = [];
let supplies = [];
let editingMedicationId = null;

// Common medications database for searchable dropdown (offline)
const commonMedications = [
    // Pain & Fever
    { name: 'Acetaminophen (Tylenol)', category: 'Pain/Fever' },
    { name: 'Ibuprofen (Advil, Motrin)', category: 'Pain/Fever' },
    { name: 'Aspirin', category: 'Pain/Fever' },
    { name: 'Naproxen (Aleve)', category: 'Pain/Fever' },
    // Allergies
    { name: 'Diphenhydramine (Benadryl)', category: 'Allergy' },
    { name: 'Cetirizine (Zyrtec)', category: 'Allergy' },
    { name: 'Loratadine (Claritin)', category: 'Allergy' },
    { name: 'Fexofenadine (Allegra)', category: 'Allergy' },
    { name: 'EpiPen (Epinephrine)', category: 'Allergy' },
    // Digestive
    { name: 'Omeprazole (Prilosec)', category: 'Digestive' },
    { name: 'Famotidine (Pepcid)', category: 'Digestive' },
    { name: 'Ranitidine (Zantac)', category: 'Digestive' },
    { name: 'Loperamide (Imodium)', category: 'Digestive' },
    { name: 'Bismuth Subsalicylate (Pepto-Bismol)', category: 'Digestive' },
    { name: 'Docusate (Colace)', category: 'Digestive' },
    { name: 'Polyethylene Glycol (Miralax)', category: 'Digestive' },
    { name: 'Ondansetron (Zofran)', category: 'Digestive' },
    // Respiratory
    { name: 'Pseudoephedrine (Sudafed)', category: 'Respiratory' },
    { name: 'Dextromethorphan (Robitussin)', category: 'Respiratory' },
    { name: 'Guaifenesin (Mucinex)', category: 'Respiratory' },
    { name: 'Albuterol Inhaler', category: 'Respiratory' },
    { name: 'Fluticasone (Flonase)', category: 'Respiratory' },
    // Blood Pressure & Heart
    { name: 'Lisinopril', category: 'Cardiovascular' },
    { name: 'Amlodipine (Norvasc)', category: 'Cardiovascular' },
    { name: 'Metoprolol', category: 'Cardiovascular' },
    { name: 'Losartan', category: 'Cardiovascular' },
    { name: 'Hydrochlorothiazide', category: 'Cardiovascular' },
    { name: 'Atorvastatin (Lipitor)', category: 'Cardiovascular' },
    { name: 'Simvastatin (Zocor)', category: 'Cardiovascular' },
    { name: 'Warfarin (Coumadin)', category: 'Cardiovascular' },
    { name: 'Clopidogrel (Plavix)', category: 'Cardiovascular' },
    // Diabetes
    { name: 'Metformin', category: 'Diabetes' },
    { name: 'Glipizide', category: 'Diabetes' },
    { name: 'Insulin (Various types)', category: 'Diabetes' },
    { name: 'Sitagliptin (Januvia)', category: 'Diabetes' },
    // Mental Health
    { name: 'Sertraline (Zoloft)', category: 'Mental Health' },
    { name: 'Fluoxetine (Prozac)', category: 'Mental Health' },
    { name: 'Escitalopram (Lexapro)', category: 'Mental Health' },
    { name: 'Alprazolam (Xanax)', category: 'Mental Health' },
    { name: 'Lorazepam (Ativan)', category: 'Mental Health' },
    { name: 'Trazodone', category: 'Mental Health' },
    { name: 'Bupropion (Wellbutrin)', category: 'Mental Health' },
    // Antibiotics
    { name: 'Amoxicillin', category: 'Antibiotic' },
    { name: 'Azithromycin (Z-Pack)', category: 'Antibiotic' },
    { name: 'Ciprofloxacin (Cipro)', category: 'Antibiotic' },
    { name: 'Doxycycline', category: 'Antibiotic' },
    { name: 'Cephalexin (Keflex)', category: 'Antibiotic' },
    { name: 'Metronidazole (Flagyl)', category: 'Antibiotic' },
    // Topical
    { name: 'Hydrocortisone Cream', category: 'Topical' },
    { name: 'Bacitracin/Neosporin', category: 'Topical' },
    { name: 'Mupirocin (Bactroban)', category: 'Topical' },
    { name: 'Clotrimazole (Lotrimin)', category: 'Topical' },
    // Thyroid
    { name: 'Levothyroxine (Synthroid)', category: 'Thyroid' },
    // Sleep
    { name: 'Melatonin', category: 'Sleep' },
    { name: 'Zolpidem (Ambien)', category: 'Sleep' },
    // Eye Care
    { name: 'Artificial Tears', category: 'Eye Care' },
    { name: 'Ketotifen Eye Drops (Zaditor)', category: 'Eye Care' },
    // Vitamins & Supplements
    { name: 'Vitamin D', category: 'Supplement' },
    { name: 'Vitamin B12', category: 'Supplement' },
    { name: 'Calcium', category: 'Supplement' },
    { name: 'Iron Supplement', category: 'Supplement' },
    { name: 'Fish Oil/Omega-3', category: 'Supplement' },
    { name: 'Multivitamin', category: 'Supplement' },
    // Other
    { name: 'Gabapentin (Neurontin)', category: 'Other' },
    { name: 'Prednisone', category: 'Other' },
    { name: 'Tramadol', category: 'Other' },
    { name: 'Cyclobenzaprine (Flexeril)', category: 'Other' },
    { name: 'Montelukast (Singulair)', category: 'Other' },
];

// First aid content database
const firstAidTopics = {
    cpr: {
        title: 'CPR - Adult',
        icon: '❤️',
        content: `
            <div class="firstaid-detail">
                <div class="warning-box">
                    <div class="icon">⚠️</div>
                    <div class="content">
                        <strong>Call 911 First!</strong>
                        <p>If alone, call 911 before starting CPR. If others are present, have someone call while you begin.</p>
                    </div>
                </div>

                <h4>Steps for Adult CPR</h4>
                <ol class="firstaid-steps">
                    <li><strong>Check responsiveness:</strong> Tap shoulders and shout "Are you okay?"</li>
                    <li><strong>Call for help:</strong> Call 911 or have someone call. Get an AED if available.</li>
                    <li><strong>Check breathing:</strong> Look for chest rise for no more than 10 seconds. Gasping is NOT normal breathing.</li>
                    <li><strong>Position:</strong> Place person on firm, flat surface on their back.</li>
                    <li><strong>Hand placement:</strong> Place heel of one hand on center of chest (between nipples). Place other hand on top, interlace fingers.</li>
                    <li><strong>Compressions:</strong> Push hard and fast - at least 2 inches deep, 100-120 compressions per minute.</li>
                    <li><strong>Breaths (if trained):</strong> After 30 compressions, give 2 rescue breaths. Tilt head back, lift chin, pinch nose, seal mouth.</li>
                    <li><strong>Continue:</strong> Repeat 30 compressions and 2 breaths until help arrives or person recovers.</li>
                </ol>

                <h4>Compression-Only CPR</h4>
                <p>If not trained in rescue breaths or uncomfortable, continuous compressions alone can be life-saving. Push hard and fast on center of chest.</p>

                <h4>Using an AED</h4>
                <ol class="firstaid-steps">
                    <li>Turn on AED and follow voice prompts</li>
                    <li>Attach pads to bare chest as shown on pads</li>
                    <li>Clear person and analyze rhythm</li>
                    <li>If shock advised, ensure no one is touching person and press shock button</li>
                    <li>Immediately resume CPR for 2 minutes, then reanalyze</li>
                </ol>
            </div>
        `
    },
    choking: {
        title: 'Choking',
        icon: '😫',
        content: `
            <div class="firstaid-detail">
                <h4>Signs of Severe Choking</h4>
                <ul>
                    <li>Unable to speak, cough, or breathe</li>
                    <li>Clutching throat (universal choking sign)</li>
                    <li>Blue lips or fingernails</li>
                    <li>Loss of consciousness</li>
                </ul>

                <h4>Heimlich Maneuver (Abdominal Thrusts)</h4>
                <ol class="firstaid-steps">
                    <li><strong>Confirm choking:</strong> Ask "Are you choking?" If they can't speak or cough forcefully, proceed.</li>
                    <li><strong>Position:</strong> Stand behind the person. If pregnant or obese, use chest thrusts instead.</li>
                    <li><strong>Hand placement:</strong> Make a fist with one hand, place thumb side against abdomen (above navel, below ribcage).</li>
                    <li><strong>Grasp:</strong> Grab your fist with your other hand.</li>
                    <li><strong>Thrust:</strong> Give quick, upward thrusts into the abdomen.</li>
                    <li><strong>Repeat:</strong> Continue until object is expelled or person becomes unconscious.</li>
                </ol>

                <h4>If Person Becomes Unconscious</h4>
                <ol class="firstaid-steps">
                    <li>Lower person to ground safely</li>
                    <li>Call 911 if not already done</li>
                    <li>Begin CPR - before giving breaths, check mouth for visible object</li>
                    <li>If you see object, sweep it out with finger</li>
                    <li>Continue CPR until help arrives</li>
                </ol>

                <h4>Self-Administered Heimlich</h4>
                <p>If alone and choking, make a fist and place above navel. Thrust upward while bending over a chair back or countertop.</p>
            </div>
        `
    },
    bleeding: {
        title: 'Severe Bleeding',
        icon: '🩸',
        content: `
            <div class="firstaid-detail">
                <div class="warning-box">
                    <div class="icon">🩸</div>
                    <div class="content">
                        <strong>Life-Threatening Bleeding</strong>
                        <p>Blood spurting, pooling on ground, or soaking through bandages requires immediate action.</p>
                    </div>
                </div>

                <h4>Stop the Bleed - Basic Steps</h4>
                <ol class="firstaid-steps">
                    <li><strong>Ensure safety:</strong> Put on gloves if available. Scene safety first.</li>
                    <li><strong>Call 911:</strong> Or have someone call while you provide care.</li>
                    <li><strong>Apply pressure:</strong> Use gauze, cloth, or even bare hands. Press HARD directly on wound.</li>
                    <li><strong>Maintain pressure:</strong> Do not remove to check - add more material on top if soaking through.</li>
                    <li><strong>Elevate:</strong> If possible, raise injured limb above heart while maintaining pressure.</li>
                </ol>

                <h4>When to Use a Tourniquet</h4>
                <ul>
                    <li>Life-threatening limb bleeding</li>
                    <li>Direct pressure is not working</li>
                    <li>Multiple casualties and limited help</li>
                    <li>Amputation or near-amputation</li>
                </ul>

                <h4>Tourniquet Application</h4>
                <ol class="firstaid-steps">
                    <li>Place tourniquet 2-3 inches above wound (NOT on a joint)</li>
                    <li>Pull strap tight and secure</li>
                    <li>Turn windlass until bleeding stops</li>
                    <li>Secure windlass in place</li>
                    <li>Note time of application</li>
                    <li>DO NOT remove - leave for medical professionals</li>
                </ol>

                <h4>Wound Packing</h4>
                <p>For deep wounds where tourniquet cannot be used (junction wounds - neck, armpit, groin), pack wound tightly with gauze while applying pressure.</p>
            </div>
        `
    },
    burns: {
        title: 'Burns',
        icon: '🔥',
        content: `
            <div class="firstaid-detail">
                <h4>Burn Classification</h4>
                <ul>
                    <li><strong>First Degree:</strong> Red, painful, no blisters (sunburn)</li>
                    <li><strong>Second Degree:</strong> Red, painful, blisters present</li>
                    <li><strong>Third Degree:</strong> White/charred, may be painless, extends through skin</li>
                </ul>

                <h4>Thermal Burns Treatment</h4>
                <ol class="firstaid-steps">
                    <li><strong>Stop the burning:</strong> Remove from heat source. Remove clothing unless stuck to burn.</li>
                    <li><strong>Cool the burn:</strong> Run cool (NOT cold or ice) water for 10-20 minutes.</li>
                    <li><strong>Cover loosely:</strong> Use clean, dry bandage or cling wrap.</li>
                    <li><strong>Pain relief:</strong> OTC pain medication if needed.</li>
                    <li><strong>Monitor:</strong> Watch for signs of infection.</li>
                </ol>

                <div class="warning-box">
                    <div class="icon">⚠️</div>
                    <div class="content">
                        <strong>Seek Emergency Care For:</strong>
                        <p>Burns larger than 3 inches, burns on face/hands/feet/groin/joints, third degree burns, electrical burns, or chemical burns.</p>
                    </div>
                </div>

                <h4>Chemical Burns</h4>
                <ol class="firstaid-steps">
                    <li>Remove contaminated clothing (protect yourself)</li>
                    <li>Brush off dry chemicals before flushing</li>
                    <li>Flush with large amounts of water for 20+ minutes</li>
                    <li>Seek medical attention</li>
                </ol>

                <h4>DO NOT:</h4>
                <ul>
                    <li>Apply ice directly to burns</li>
                    <li>Use butter, oil, or toothpaste</li>
                    <li>Break blisters</li>
                    <li>Remove stuck clothing</li>
                </ul>
            </div>
        `
    },
    shock: {
        title: 'Shock',
        icon: '⚡',
        content: `
            <div class="firstaid-detail">
                <h4>Signs of Shock</h4>
                <ul>
                    <li>Pale, cool, clammy skin</li>
                    <li>Rapid, weak pulse</li>
                    <li>Rapid, shallow breathing</li>
                    <li>Confusion or anxiety</li>
                    <li>Weakness or dizziness</li>
                    <li>Bluish lips or fingernails</li>
                    <li>Thirst</li>
                </ul>

                <h4>Treatment</h4>
                <ol class="firstaid-steps">
                    <li><strong>Call 911:</strong> Shock is a life-threatening emergency.</li>
                    <li><strong>Position:</strong> Lay person flat on back. Elevate legs 8-12 inches if no head/neck/back injury suspected.</li>
                    <li><strong>Treat the cause:</strong> Control bleeding, splint fractures, etc.</li>
                    <li><strong>Maintain body temperature:</strong> Cover with blanket or coat.</li>
                    <li><strong>Do NOT give food or water:</strong> Person may need surgery.</li>
                    <li><strong>Monitor:</strong> Check breathing and pulse. Be ready to perform CPR.</li>
                    <li><strong>Comfort:</strong> Stay calm, reassure the person.</li>
                </ol>

                <h4>Recovery Position</h4>
                <p>If person is unconscious but breathing, place in recovery position (on side) to prevent choking on vomit.</p>
            </div>
        `
    },
    fractures: {
        title: 'Fractures & Sprains',
        icon: '🦴',
        content: `
            <div class="firstaid-detail">
                <h4>Signs of Fracture</h4>
                <ul>
                    <li>Deformity or unnatural angle</li>
                    <li>Swelling and bruising</li>
                    <li>Severe pain with movement</li>
                    <li>Inability to bear weight</li>
                    <li>Grating sensation or sound</li>
                    <li>Open wound with bone visible</li>
                </ul>

                <h4>General Treatment</h4>
                <ol class="firstaid-steps">
                    <li><strong>Don't move:</strong> Keep person still if spinal injury possible.</li>
                    <li><strong>Control bleeding:</strong> If open fracture, cover wound but don't push bone back.</li>
                    <li><strong>Immobilize:</strong> Splint the injury in position found.</li>
                    <li><strong>Ice:</strong> Apply ice pack wrapped in cloth for 20 minutes.</li>
                    <li><strong>Elevate:</strong> If possible without causing more pain.</li>
                    <li><strong>Seek medical care:</strong> All suspected fractures need X-ray.</li>
                </ol>

                <h4>Basic Splinting</h4>
                <ol class="firstaid-steps">
                    <li>Immobilize the joint above and below the injury</li>
                    <li>Use rigid materials (boards, magazines, pillows)</li>
                    <li>Pad the splint for comfort</li>
                    <li>Secure with bandages - not too tight</li>
                    <li>Check circulation after - fingers/toes should be pink and warm</li>
                </ol>

                <h4>RICE for Sprains</h4>
                <ul>
                    <li><strong>R</strong>est - Avoid using injured area</li>
                    <li><strong>I</strong>ce - 20 minutes on, 20 off</li>
                    <li><strong>C</strong>ompression - Elastic bandage (not too tight)</li>
                    <li><strong>E</strong>levation - Above heart level when possible</li>
                </ul>
            </div>
        `
    },
    hypothermia: {
        title: 'Hypothermia',
        icon: '🥶',
        content: `
            <div class="firstaid-detail">
                <h4>Signs of Hypothermia</h4>
                <ul>
                    <li><strong>Mild:</strong> Shivering, cold skin, numbness</li>
                    <li><strong>Moderate:</strong> Violent shivering, slurred speech, confusion, drowsiness</li>
                    <li><strong>Severe:</strong> Shivering stops, muscle stiffness, very slow breathing, unconsciousness</li>
                </ul>

                <h4>Treatment</h4>
                <ol class="firstaid-steps">
                    <li><strong>Move to warmth:</strong> Get out of cold environment.</li>
                    <li><strong>Remove wet clothing:</strong> Replace with dry clothing and blankets.</li>
                    <li><strong>Warm the core first:</strong> Focus on chest, neck, head, groin.</li>
                    <li><strong>Use warm compresses:</strong> Apply to neck, armpits, groin (NOT arms/legs).</li>
                    <li><strong>Warm beverages:</strong> If conscious and able to swallow, give warm (not hot) drinks. No alcohol.</li>
                    <li><strong>Skin-to-skin contact:</strong> Share body heat if necessary.</li>
                </ol>

                <div class="warning-box">
                    <div class="icon">⚠️</div>
                    <div class="content">
                        <strong>Severe Hypothermia</strong>
                        <p>Handle gently - rough movement can trigger cardiac arrest. Call 911. Begin CPR if no pulse.</p>
                    </div>
                </div>

                <h4>DO NOT:</h4>
                <ul>
                    <li>Apply direct heat (heating pads, hot water)</li>
                    <li>Massage or rub limbs</li>
                    <li>Give alcohol</li>
                    <li>Place in hot bath (can cause shock)</li>
                </ul>
            </div>
        `
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initFirstAid();
    initSearch();
    initMedicationSearch();
    loadSavedData();
});

/**
 * Initialize tab navigation
 */
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            tabPanels.forEach(p => p.classList.remove('active'));
            document.getElementById(`${tabName}-panel`)?.classList.add('active');

            const url = new URL(window.location);
            url.searchParams.set('tab', tabName);
            window.history.replaceState({}, '', url);
        });
    });

    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab');
    if (initialTab) {
        const btn = document.querySelector(`.tab-btn[data-tab="${initialTab}"]`);
        if (btn) btn.click();
    }
}

/**
 * Initialize first aid cards
 */
function initFirstAid() {
    document.querySelectorAll('.firstaid-card').forEach(card => {
        card.addEventListener('click', () => {
            const topic = card.dataset.topic;
            openFirstAidModal(topic);
        });
    });
}

/**
 * Initialize search
 */
function initSearch() {
    const searchInput = document.getElementById('firstaid-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.firstaid-card').forEach(card => {
                const text = card.textContent.toLowerCase();
                card.style.display = text.includes(query) ? 'flex' : 'none';
            });
        });
    }
}

/**
 * Open first aid detail modal
 */
function openFirstAidModal(topic) {
    const data = firstAidTopics[topic];
    if (!data) return;

    document.getElementById('firstaid-modal-title').textContent = data.title;
    document.getElementById('firstaid-modal-body').innerHTML = data.content;
    document.getElementById('firstaid-modal').classList.add('active');
}

function closeFirstAidModal() {
    document.getElementById('firstaid-modal').classList.remove('active');
}

/**
 * Medication Management
 */
function openMedicationModal(editId = null) {
    editingMedicationId = editId;
    const modal = document.getElementById('medication-modal');
    const form = document.getElementById('medication-form');
    const title = modal.querySelector('.modal-header h2');

    form.reset();
    hideMedicationSuggestions();

    if (editId) {
        const med = medications.find(m => m.id === editId);
        if (med) {
            title.textContent = 'Edit Medication';
            document.getElementById('med-name').value = med.name || '';
            document.getElementById('med-dosage').value = med.dosage || '';
            document.getElementById('med-frequency').value = med.frequency || '';
            document.getElementById('med-person').value = med.person || '';
            document.getElementById('med-quantity').value = med.quantity || '';
            document.getElementById('med-expiration').value = med.expiration || '';
            document.getElementById('med-notes').value = med.notes || '';
        }
    } else {
        title.textContent = 'Add Medication';
    }

    modal.classList.add('active');
}

function closeMedicationModal() {
    document.getElementById('medication-modal').classList.remove('active');
    editingMedicationId = null;
    hideMedicationSuggestions();
}

function saveMedication(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    if (editingMedicationId) {
        // Update existing
        const index = medications.findIndex(m => m.id === editingMedicationId);
        if (index !== -1) {
            medications[index] = {
                ...medications[index],
                ...data
            };
        }
    } else {
        // Add new
        medications.push({
            id: Date.now(),
            ...data
        });
    }

    renderMedications();
    renderMedicationTotals();
    saveMedicalData();
    closeMedicationModal();
}

function deleteMedication(id) {
    if (!confirm('Are you sure you want to delete this medication?')) return;
    medications = medications.filter(m => m.id !== id);
    renderMedications();
    renderMedicationTotals();
    saveMedicalData();
}

function editMedication(id) {
    openMedicationModal(id);
}

/**
 * Searchable Medication Dropdown
 */
function initMedicationSearch() {
    const input = document.getElementById('med-name');
    if (!input) return;

    // Create suggestions container if not exists
    let suggestionsDiv = document.getElementById('med-suggestions');
    if (!suggestionsDiv) {
        suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = 'med-suggestions';
        suggestionsDiv.className = 'med-suggestions';
        input.parentNode.appendChild(suggestionsDiv);
    }

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query.length < 2) {
            hideMedicationSuggestions();
            return;
        }

        const matches = commonMedications.filter(med =>
            med.name.toLowerCase().includes(query) ||
            med.category.toLowerCase().includes(query)
        ).slice(0, 10);

        showMedicationSuggestions(matches);
    });

    input.addEventListener('blur', () => {
        // Delay hide to allow click on suggestion
        setTimeout(hideMedicationSuggestions, 200);
    });

    input.addEventListener('focus', () => {
        const query = input.value.toLowerCase().trim();
        if (query.length >= 2) {
            const matches = commonMedications.filter(med =>
                med.name.toLowerCase().includes(query)
            ).slice(0, 10);
            showMedicationSuggestions(matches);
        }
    });
}

function showMedicationSuggestions(matches) {
    const suggestionsDiv = document.getElementById('med-suggestions');
    if (!suggestionsDiv) return;

    if (matches.length === 0) {
        hideMedicationSuggestions();
        return;
    }

    suggestionsDiv.innerHTML = matches.map(med => `
        <div class="med-suggestion-item" onclick="selectMedication('${escapeHtml(med.name)}')">
            <span class="med-suggestion-name">${escapeHtml(med.name)}</span>
            <span class="med-suggestion-category">${escapeHtml(med.category)}</span>
        </div>
    `).join('');

    suggestionsDiv.style.display = 'block';
}

function hideMedicationSuggestions() {
    const suggestionsDiv = document.getElementById('med-suggestions');
    if (suggestionsDiv) {
        suggestionsDiv.style.display = 'none';
    }
}

function selectMedication(name) {
    document.getElementById('med-name').value = name;
    hideMedicationSuggestions();
}

function renderMedications() {
    const list = document.getElementById('medications-list');
    if (!list) return;

    if (medications.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">💊</span>
                <p>No medications added yet</p>
                <button class="btn btn-outline" onclick="openMedicationModal()">Add First Medication</button>
            </div>
        `;
        return;
    }

    list.innerHTML = medications.map(med => `
        <div class="list-item">
            <div class="list-item-icon">💊</div>
            <div class="list-item-info">
                <div class="list-item-name">${escapeHtml(med.name)} ${med.dosage ? `<span class="med-dosage">- ${escapeHtml(med.dosage)}</span>` : ''}</div>
                <div class="list-item-person">${med.person ? `<strong>${escapeHtml(med.person)}</strong>` : '<em>No person assigned</em>'}</div>
                <div class="list-item-details">
                    ${med.frequency ? `<span class="med-frequency">${escapeHtml(med.frequency)}</span>` : ''}
                    ${med.quantity ? `<span class="med-qty">Qty: ${med.quantity}</span>` : ''}
                    ${med.notes ? `<span class="med-notes">${escapeHtml(med.notes.substring(0, 50))}${med.notes.length > 50 ? '...' : ''}</span>` : ''}
                </div>
            </div>
            <div class="list-item-meta">
                ${med.expiration ? `<span class="list-item-badge ${isExpiringSoon(med.expiration) ? 'badge-expiring' : 'badge-good'}">${formatDate(med.expiration)}</span>` : ''}
                <button class="btn btn-secondary btn-sm" onclick="editMedication(${med.id})" title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteMedication(${med.id})" title="Delete">×</button>
            </div>
        </div>
    `).join('');
}

/**
 * Render Medication Totals by Person
 */
function renderMedicationTotals() {
    let totalsDiv = document.getElementById('medications-totals');

    // Create the totals section if it doesn't exist
    if (!totalsDiv) {
        const medsPanel = document.getElementById('medications-panel');
        if (!medsPanel) return;

        // Find where to insert (after the header, before the list)
        const header = medsPanel.querySelector('.section-header');
        if (!header) return;

        totalsDiv = document.createElement('div');
        totalsDiv.id = 'medications-totals';
        totalsDiv.className = 'medications-totals';
        header.after(totalsDiv);
    }

    if (medications.length === 0) {
        totalsDiv.innerHTML = '';
        return;
    }

    // Group medications by person
    const byPerson = {};
    let unassigned = 0;

    medications.forEach(med => {
        const person = med.person?.trim() || '';
        if (person) {
            if (!byPerson[person]) byPerson[person] = [];
            byPerson[person].push(med);
        } else {
            unassigned++;
        }
    });

    // Count expiring medications
    const expiring = medications.filter(m => m.expiration && isExpiringSoon(m.expiration)).length;

    totalsDiv.innerHTML = `
        <div class="totals-header">
            <h4>Medication Summary</h4>
        </div>
        <div class="totals-grid">
            <div class="totals-stat">
                <span class="totals-value">${medications.length}</span>
                <span class="totals-label">Total Medications</span>
            </div>
            <div class="totals-stat">
                <span class="totals-value">${Object.keys(byPerson).length}</span>
                <span class="totals-label">Family Members</span>
            </div>
            <div class="totals-stat ${expiring > 0 ? 'totals-warning' : ''}">
                <span class="totals-value">${expiring}</span>
                <span class="totals-label">Expiring Soon</span>
            </div>
        </div>
        <div class="totals-breakdown">
            ${Object.entries(byPerson).map(([person, meds]) => `
                <div class="person-meds">
                    <span class="person-name">${escapeHtml(person)}</span>
                    <span class="person-count">${meds.length} medication${meds.length !== 1 ? 's' : ''}</span>
                </div>
            `).join('')}
            ${unassigned > 0 ? `
                <div class="person-meds unassigned">
                    <span class="person-name">Unassigned</span>
                    <span class="person-count">${unassigned} medication${unassigned !== 1 ? 's' : ''}</span>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Condition Management
 */
function openConditionModal() {
    document.getElementById('condition-modal').classList.add('active');
    document.getElementById('condition-form').reset();
}

function closeConditionModal() {
    document.getElementById('condition-modal').classList.remove('active');
}

function saveCondition(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    conditions.push({
        id: Date.now(),
        ...data
    });

    renderConditions();
    saveMedicalData();
    closeConditionModal();
}

function deleteCondition(id) {
    conditions = conditions.filter(c => c.id !== id);
    renderConditions();
    saveMedicalData();
}

function renderConditions() {
    const list = document.getElementById('conditions-list');
    if (!list) return;

    if (conditions.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📋</span>
                <p>No conditions tracked yet</p>
                <p class="subtext">Track family health conditions, allergies, and special needs</p>
                <button class="btn btn-outline" onclick="openConditionModal()">Add Condition</button>
            </div>
        `;
        return;
    }

    list.innerHTML = conditions.map(cond => `
        <div class="list-item">
            <div class="list-item-info">
                <div class="list-item-name">${escapeHtml(cond.name)}</div>
                <div class="list-item-details">
                    ${cond.person ? `${escapeHtml(cond.person)}` : ''}
                    ${cond.treatment ? ` | Treatment: ${escapeHtml(cond.treatment.substring(0, 50))}...` : ''}
                </div>
            </div>
            <div class="list-item-meta">
                <span class="list-item-badge badge-${cond.severity === 'life-threatening' ? 'expiring' : cond.severity === 'severe' ? 'low' : 'good'}">${cond.severity || 'mild'}</span>
                <button class="btn btn-danger btn-sm" onclick="deleteCondition(${cond.id})">×</button>
            </div>
        </div>
    `).join('');
}

/**
 * Supply Management
 */
function openSupplyModal() {
    document.getElementById('supply-modal').classList.add('active');
    document.getElementById('supply-form').reset();
}

function closeSupplyModal() {
    document.getElementById('supply-modal').classList.remove('active');
}

function saveSupply(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    supplies.push({
        id: Date.now(),
        ...data,
        quantity: parseInt(data.quantity) || 0,
        min_quantity: parseInt(data.min_quantity) || 0
    });

    renderSupplies();
    updateSupplyStats();
    saveMedicalData();
    closeSupplyModal();
}

function deleteSupply(id) {
    supplies = supplies.filter(s => s.id !== id);
    renderSupplies();
    updateSupplyStats();
    saveMedicalData();
}

function renderSupplies() {
    const list = document.getElementById('supplies-list');
    if (!list) return;

    if (supplies.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🧰</span>
                <p>No supplies tracked yet</p>
                <button class="btn btn-outline" onclick="openSupplyModal()">Add First Aid Supplies</button>
            </div>
        `;
        return;
    }

    list.innerHTML = supplies.map(sup => {
        const isLow = sup.min_quantity && sup.quantity < sup.min_quantity;
        const isExpiring = sup.expiration && isExpiringSoon(sup.expiration);

        return `
            <div class="list-item">
                <div class="list-item-info">
                    <div class="list-item-name">${escapeHtml(sup.name)}</div>
                    <div class="list-item-details">
                        ${sup.category ? `${escapeHtml(sup.category)}` : ''}
                        ${sup.location ? ` | ${escapeHtml(sup.location)}` : ''}
                        | Qty: ${sup.quantity}${sup.min_quantity ? ` (min: ${sup.min_quantity})` : ''}
                    </div>
                </div>
                <div class="list-item-meta">
                    ${isLow ? '<span class="list-item-badge badge-low">Low Stock</span>' : ''}
                    ${isExpiring ? `<span class="list-item-badge badge-expiring">${formatDate(sup.expiration)}</span>` : ''}
                    <button class="btn btn-danger btn-sm" onclick="deleteSupply(${sup.id})">×</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateSupplyStats() {
    const total = supplies.length;
    const low = supplies.filter(s => s.min_quantity && s.quantity < s.min_quantity).length;
    const expiring = supplies.filter(s => s.expiration && isExpiringSoon(s.expiration)).length;

    document.getElementById('total-supplies').textContent = total;
    document.getElementById('low-supplies').textContent = low;
    document.getElementById('expiring-supplies').textContent = expiring;
}

/**
 * Data Persistence
 */
function saveMedicalData() {
    localStorage.setItem('sps_medical_medications', JSON.stringify(medications));
    localStorage.setItem('sps_medical_conditions', JSON.stringify(conditions));
    localStorage.setItem('sps_medical_supplies', JSON.stringify(supplies));
}

function loadSavedData() {
    try {
        const savedMeds = localStorage.getItem('sps_medical_medications');
        if (savedMeds) medications = JSON.parse(savedMeds);

        const savedConds = localStorage.getItem('sps_medical_conditions');
        if (savedConds) conditions = JSON.parse(savedConds);

        const savedSupplies = localStorage.getItem('sps_medical_supplies');
        if (savedSupplies) supplies = JSON.parse(savedSupplies);
    } catch (e) {
        console.error('[Medical] Error loading saved data:', e);
    }

    renderMedications();
    renderMedicationTotals();
    renderConditions();
    renderSupplies();
    updateSupplyStats();
}

/**
 * Utility Functions
 */
function isExpiringSoon(dateStr) {
    if (!dateStr) return false;
    const expDate = new Date(dateStr).getTime();
    const thirtyDays = Date.now() + (30 * 24 * 60 * 60 * 1000);
    return expDate <= thirtyDays;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export functions
window.openFirstAidModal = openFirstAidModal;
window.closeFirstAidModal = closeFirstAidModal;
window.openMedicationModal = openMedicationModal;
window.closeMedicationModal = closeMedicationModal;
window.saveMedication = saveMedication;
window.deleteMedication = deleteMedication;
window.editMedication = editMedication;
window.selectMedication = selectMedication;
window.openConditionModal = openConditionModal;
window.closeConditionModal = closeConditionModal;
window.saveCondition = saveCondition;
window.deleteCondition = deleteCondition;
window.openSupplyModal = openSupplyModal;
window.closeSupplyModal = closeSupplyModal;
window.saveSupply = saveSupply;
window.deleteSupply = deleteSupply;
