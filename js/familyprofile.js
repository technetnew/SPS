/**
 * Family Profile Module
 * Manages family members, documents, and emergency contacts
 */

// State
let familyMembers = [];
let documents = [];
let emergencyContacts = [];
let documentCategories = [];
let editingMemberId = null;
let editingDocumentId = null;
let editingContactId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadDocumentCategories();
    loadFamilyData();
    setupFilters();
});

/**
 * Load document categories from API
 */
async function loadDocumentCategories() {
    try {
        const response = await apiClient.get('/settings/document-categories');
        if (response.success) {
            documentCategories = response.data || [];
            populateCategorySelects();
        }
    } catch (err) {
        console.error('[FamilyProfile] Failed to load categories:', err);
        // Use default categories as fallback
        documentCategories = [
            { id: 'identification', name: 'Identification', icon: '🪪' },
            { id: 'medical', name: 'Medical Records', icon: '🏥' },
            { id: 'financial', name: 'Financial', icon: '💰' },
            { id: 'legal', name: 'Legal', icon: '⚖️' },
            { id: 'emergency', name: 'Emergency Plans', icon: '🚨' },
            { id: 'other', name: 'Other', icon: '📄' }
        ];
        populateCategorySelects();
    }
}

/**
 * Populate category select dropdowns
 */
function populateCategorySelects() {
    const selects = document.querySelectorAll('#doc-category, #doc-filter-category');
    selects.forEach(select => {
        const currentVal = select.value;
        const isFilter = select.id === 'doc-filter-category';

        select.innerHTML = isFilter ? '<option value="">All Categories</option>' : '';

        documentCategories.forEach(cat => {
            const option = document.createElement('option');
            // Use name as value if no numeric id (for API-based categories)
            option.value = cat.name ? cat.name.toLowerCase().replace(/\s+/g, '_') : cat.id;
            option.textContent = `${cat.icon || '📄'} ${cat.name}`;
            select.appendChild(option);
        });

        if (currentVal) select.value = currentVal;
    });
}

/**
 * Calculate age from birth date
 */
function calculateAge(birthDate) {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

/**
 * Calculate TDEE (Total Daily Energy Expenditure)
 */
function calculateTDEE(member) {
    const age = calculateAge(member.birth_date);
    if (!age || !member.weight_lbs || !member.height_inches) return null;

    // Convert to metric
    const weightKg = member.weight_lbs * 0.453592;
    const heightCm = member.height_inches * 2.54;

    // Mifflin-St Jeor Equation for BMR
    let bmr;
    if (member.gender === 'male') {
        bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else {
        bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }

    // Activity multipliers
    const activityMultipliers = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        very_active: 1.9
    };

    let tdee = bmr * (activityMultipliers[member.activity_level] || 1.55);

    // Adjustments for pregnancy/lactation
    if (member.is_pregnant) tdee += 300;
    if (member.is_lactating) tdee += 500;

    return Math.round(tdee);
}

/**
 * Initialize tab navigation
 */
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update button states
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update panel visibility
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            document.getElementById(`tab-${tab}`)?.classList.add('active');
        });
    });
}

/**
 * Load all family data
 */
async function loadFamilyData() {
    await Promise.all([
        loadFamilyMembers(),
        loadDocuments(),
        loadEmergencyContacts()
    ]);
    updateStats();
}

/**
 * Load family members from API
 */
async function loadFamilyMembers() {
    try {
        const response = await apiClient.get('/family-profiles');
        if (response.profiles) {
            familyMembers = response.profiles || [];
            renderFamilyMembers();
            populateMemberSelects();
        } else if (response.success && response.data) {
            familyMembers = response.data || [];
            renderFamilyMembers();
            populateMemberSelects();
        }
    } catch (err) {
        console.error('[FamilyProfile] Failed to load members:', err);
        familyMembers = [];
        renderFamilyMembers();
    }
}

/**
 * Load documents from API
 */
async function loadDocuments() {
    try {
        const response = await apiClient.get('/family-profiles/documents');
        if (response.success) {
            documents = response.data || [];
            renderDocuments();
        }
    } catch (err) {
        console.error('[FamilyProfile] Failed to load documents:', err);
        documents = [];
        renderDocuments();
    }
}

/**
 * Load emergency contacts from API
 */
async function loadEmergencyContacts() {
    try {
        const response = await apiClient.get('/family-profiles/emergency-contacts');
        if (response.success) {
            emergencyContacts = response.data || [];
            renderEmergencyContacts();
        }
    } catch (err) {
        console.error('[FamilyProfile] Failed to load contacts:', err);
        emergencyContacts = [];
        renderEmergencyContacts();
    }
}

/**
 * Update summary stats
 */
function updateStats() {
    document.getElementById('total-members').textContent = familyMembers.length;
    document.getElementById('total-documents').textContent = documents.length;
    document.getElementById('emergency-contacts').textContent = emergencyContacts.length;

    // Calculate total daily calories needed
    let totalCalories = 0;
    familyMembers.forEach(member => {
        const tdee = calculateTDEE(member);
        if (tdee) totalCalories += tdee;
    });
    document.getElementById('daily-calories').textContent = totalCalories.toLocaleString();
}

/**
 * Render family members grid
 */
function renderFamilyMembers() {
    const grid = document.getElementById('family-grid');
    if (!grid) return;

    if (familyMembers.length === 0) {
        grid.innerHTML = '<div class="empty-state">No family members yet. Add your first family member above.</div>';
        return;
    }

    grid.innerHTML = familyMembers.map(member => {
        const age = calculateAge(member.birth_date);
        const tdee = calculateTDEE(member);

        return `
            <div class="family-card">
                <div class="family-card-header">
                    <div class="family-avatar">${getInitials(member.name)}</div>
                    <div class="family-info">
                        <h3>${escapeHtml(member.name)}</h3>
                        <span class="relationship-badge">${escapeHtml(member.relationship || 'Family')}</span>
                    </div>
                    <div class="family-actions">
                        <button class="btn-icon" onclick="editMember(${member.id})" title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon btn-icon-danger" onclick="deleteMember(${member.id})" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="family-card-body">
                    <div class="family-details">
                        ${age !== null ? `<div class="detail-item"><span class="label">Age:</span><span class="value">${age} years</span></div>` : ''}
                        ${member.gender ? `<div class="detail-item"><span class="label">Gender:</span><span class="value">${capitalize(member.gender)}</span></div>` : ''}
                        ${member.blood_type ? `<div class="detail-item"><span class="label">Blood Type:</span><span class="value">${member.blood_type}</span></div>` : ''}
                        ${tdee ? `<div class="detail-item"><span class="label">Daily Cal:</span><span class="value">${tdee.toLocaleString()} kcal</span></div>` : ''}
                    </div>
                    ${member.allergies ? `<div class="alert-info"><strong>Allergies:</strong> ${escapeHtml(member.allergies)}</div>` : ''}
                    ${member.medications ? `<div class="alert-warning"><strong>Medications:</strong> ${escapeHtml(member.medications)}</div>` : ''}
                    ${member.medical_conditions ? `<div class="alert-danger"><strong>Conditions:</strong> ${escapeHtml(member.medical_conditions)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Filter documents - called by search and filter inputs
 */
function filterDocuments() {
    renderDocuments();
}

/**
 * Render documents list
 */
function renderDocuments() {
    const list = document.getElementById('documents-list');
    if (!list) return;

    const searchQuery = document.getElementById('doc-search')?.value?.toLowerCase() || '';
    const categoryFilter = document.getElementById('doc-filter-category')?.value;
    const memberFilter = document.getElementById('doc-filter-member')?.value;

    let filtered = documents;

    // Search filter
    if (searchQuery) {
        filtered = filtered.filter(d =>
            d.name?.toLowerCase().includes(searchQuery) ||
            d.document_number?.toLowerCase().includes(searchQuery) ||
            d.notes?.toLowerCase().includes(searchQuery) ||
            formatCategory(d.category)?.toLowerCase().includes(searchQuery)
        );
    }

    if (categoryFilter) {
        filtered = filtered.filter(d => d.category === categoryFilter);
    }
    if (memberFilter) {
        filtered = filtered.filter(d => d.family_profile_id == memberFilter);
    }

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state">No documents found.</div>';
        return;
    }

    list.innerHTML = filtered.map(doc => {
        const member = familyMembers.find(m => m.id === doc.family_profile_id);
        const isExpiring = doc.expiration_date && new Date(doc.expiration_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const isExpired = doc.expiration_date && new Date(doc.expiration_date) < new Date();

        return `
            <div class="document-item ${isExpired ? 'expired' : isExpiring ? 'expiring' : ''}">
                <div class="document-icon">${getCategoryIcon(doc.category)}</div>
                <div class="document-info">
                    <h4>${escapeHtml(doc.name)}</h4>
                    <div class="document-meta">
                        <span class="category-tag">${escapeHtml(formatCategory(doc.category))}</span>
                        ${member ? `<span class="member-tag">${escapeHtml(member.name)}</span>` : '<span class="member-tag">Shared</span>'}
                        ${doc.document_number ? `<span class="doc-number">#${escapeHtml(doc.document_number)}</span>` : ''}
                    </div>
                    ${doc.expiration_date ? `
                        <div class="expiration ${isExpired ? 'expired' : isExpiring ? 'warning' : ''}">
                            ${isExpired ? 'Expired' : 'Expires'}: ${formatDate(doc.expiration_date)}
                        </div>
                    ` : ''}
                </div>
                <div class="document-actions">
                    ${doc.file_path ? `
                        <button class="btn-icon" onclick="viewDocument(${doc.id})" title="View">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    ` : ''}
                    <button class="btn-icon" onclick="editDocument(${doc.id})" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon btn-icon-danger" onclick="deleteDocument(${doc.id})" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render emergency contacts list
 */
function renderEmergencyContacts() {
    const list = document.getElementById('contacts-list');
    if (!list) return;

    if (emergencyContacts.length === 0) {
        list.innerHTML = '<div class="empty-state">No emergency contacts yet. Add important contacts for emergencies.</div>';
        return;
    }

    // Sort by priority
    const sorted = [...emergencyContacts].sort((a, b) => (a.priority || 9) - (b.priority || 9));

    list.innerHTML = sorted.map(contact => `
        <div class="contact-card">
            <div class="contact-priority priority-${contact.priority || 3}">
                ${contact.priority === 1 ? 'Primary' : contact.priority === 2 ? 'Secondary' : 'Tertiary'}
            </div>
            <div class="contact-info">
                <h4>${escapeHtml(contact.name)}</h4>
                ${contact.relationship ? `<span class="contact-relationship">${escapeHtml(contact.relationship)}</span>` : ''}
            </div>
            <div class="contact-details">
                <a href="tel:${contact.phone}" class="contact-phone">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    ${escapeHtml(contact.phone)}
                </a>
                ${contact.phone_alt ? `
                    <a href="tel:${contact.phone_alt}" class="contact-phone alt">
                        ${escapeHtml(contact.phone_alt)}
                    </a>
                ` : ''}
                ${contact.email ? `
                    <a href="mailto:${contact.email}" class="contact-email">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        ${escapeHtml(contact.email)}
                    </a>
                ` : ''}
            </div>
            ${contact.address ? `<div class="contact-address">${escapeHtml(contact.address)}</div>` : ''}
            ${contact.notes ? `<div class="contact-notes">${escapeHtml(contact.notes)}</div>` : ''}
            <div class="contact-actions">
                <button class="btn-icon" onclick="editContact(${contact.id})" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="btn-icon btn-icon-danger" onclick="deleteContact(${contact.id})" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}


/**
 * Populate member dropdowns
 */
function populateMemberSelects() {
    const selects = document.querySelectorAll('#doc-member, #doc-filter-member');
    selects.forEach(select => {
        const currentVal = select.value;
        // Keep first option
        const firstOption = select.querySelector('option:first-child');
        select.innerHTML = '';
        if (firstOption) select.appendChild(firstOption);

        familyMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            select.appendChild(option);
        });

        select.value = currentVal;
    });
}

/**
 * Setup filter listeners
 */
function setupFilters() {
    // Filters now use onchange in HTML, but keep this for any programmatic changes
}

// ============================================
// Modal Functions
// ============================================

function openMemberModal() {
    editingMemberId = null;
    document.getElementById('member-modal-title').textContent = 'Add Family Member';
    document.getElementById('member-form').reset();
    document.getElementById('member-id').value = '';
    document.getElementById('member-modal').classList.add('active');
}

function closeMemberModal() {
    document.getElementById('member-modal').classList.remove('active');
    editingMemberId = null;
}

function openDocumentModal() {
    editingDocumentId = null;
    document.getElementById('document-modal-title').textContent = 'Add Document';
    document.getElementById('document-form').reset();
    document.getElementById('doc-id').value = '';
    document.getElementById('document-modal').classList.add('active');
}

function closeDocumentModal() {
    document.getElementById('document-modal').classList.remove('active');
    editingDocumentId = null;
}

function openContactModal() {
    editingContactId = null;
    document.getElementById('contact-modal-title').textContent = 'Add Emergency Contact';
    document.getElementById('contact-form').reset();
    document.getElementById('contact-id').value = '';
    document.getElementById('contact-modal').classList.add('active');
}

function closeContactModal() {
    document.getElementById('contact-modal').classList.remove('active');
    editingContactId = null;
}

// ============================================
// Edit Functions
// ============================================

function editMember(id) {
    const member = familyMembers.find(m => m.id === id);
    if (!member) return;

    editingMemberId = id;
    document.getElementById('member-modal-title').textContent = 'Edit Family Member';
    document.getElementById('member-id').value = id;
    document.getElementById('member-name').value = member.name || '';
    document.getElementById('member-relationship').value = member.relationship || 'other';
    document.getElementById('member-birthdate').value = member.birth_date ? member.birth_date.split('T')[0] : '';
    document.getElementById('member-gender').value = member.gender || 'male';
    document.getElementById('member-height').value = member.height_inches || '';
    document.getElementById('member-weight').value = member.weight_lbs || '';
    document.getElementById('member-activity').value = member.activity_level || 'moderate';
    document.getElementById('member-blood-type').value = member.blood_type || '';
    document.getElementById('member-allergies').value = member.allergies || '';
    document.getElementById('member-medications').value = member.medications || '';
    document.getElementById('member-conditions').value = member.medical_conditions || '';
    document.getElementById('member-pregnant').checked = member.is_pregnant || false;
    document.getElementById('member-lactating').checked = member.is_lactating || false;
    document.getElementById('member-notes').value = member.notes || '';

    document.getElementById('member-modal').classList.add('active');
}

function editDocument(id) {
    const doc = documents.find(d => d.id === id);
    if (!doc) return;

    editingDocumentId = id;
    document.getElementById('document-modal-title').textContent = 'Edit Document';
    document.getElementById('doc-id').value = id;
    document.getElementById('doc-name').value = doc.name || '';
    document.getElementById('doc-category').value = doc.category || 'other';
    document.getElementById('doc-member').value = doc.family_profile_id || '';
    document.getElementById('doc-number').value = doc.document_number || '';
    document.getElementById('doc-expiry').value = doc.expiration_date ? doc.expiration_date.split('T')[0] : '';
    document.getElementById('doc-notes').value = doc.notes || '';

    document.getElementById('document-modal').classList.add('active');
}

function editContact(id) {
    const contact = emergencyContacts.find(c => c.id === id);
    if (!contact) return;

    editingContactId = id;
    document.getElementById('contact-modal-title').textContent = 'Edit Emergency Contact';
    document.getElementById('contact-id').value = id;
    document.getElementById('contact-name').value = contact.name || '';
    document.getElementById('contact-relationship').value = contact.relationship || '';
    document.getElementById('contact-priority').value = contact.priority || 3;
    document.getElementById('contact-phone').value = contact.phone || '';
    document.getElementById('contact-phone2').value = contact.phone_alt || '';
    document.getElementById('contact-email').value = contact.email || '';
    document.getElementById('contact-address').value = contact.address || '';
    document.getElementById('contact-notes').value = contact.notes || '';

    document.getElementById('contact-modal').classList.add('active');
}

// ============================================
// Save Functions
// ============================================

async function saveMember(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Convert checkboxes
    data.is_pregnant = document.getElementById('member-pregnant').checked;
    data.is_lactating = document.getElementById('member-lactating').checked;

    // Convert numeric fields
    if (data.height_inches) data.height_inches = parseFloat(data.height_inches);
    if (data.weight_lbs) data.weight_lbs = parseFloat(data.weight_lbs);

    try {
        let response;
        if (data.id) {
            response = await apiClient.put(`/family-profiles/${data.id}`, data);
        } else {
            response = await apiClient.post('/family-profiles', data);
        }

        if (response.success) {
            showNotification('Family member saved successfully', 'success');
            closeMemberModal();
            loadFamilyMembers();
            updateStats();
        } else {
            showNotification(response.error || 'Failed to save', 'error');
        }
    } catch (err) {
        console.error('[FamilyProfile] Save member error:', err);
        showNotification('Failed to save family member', 'error');
    }
}

async function saveDocument(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    try {
        let response;
        const id = formData.get('id');

        if (id) {
            response = await apiClient.put(`/family-profiles/documents/${id}`, Object.fromEntries(formData.entries()));
        } else {
            // For new documents with file upload, use multipart
            const fileInput = document.getElementById('doc-file');
            if (fileInput.files.length > 0) {
                response = await apiClient.upload('/family-profiles/documents', formData);
            } else {
                response = await apiClient.post('/family-profiles/documents', Object.fromEntries(formData.entries()));
            }
        }

        if (response.success) {
            showNotification('Document saved successfully', 'success');
            closeDocumentModal();
            loadDocuments();
        } else {
            showNotification(response.error || 'Failed to save', 'error');
        }
    } catch (err) {
        console.error('[FamilyProfile] Save document error:', err);
        showNotification('Failed to save document', 'error');
    }
}

async function saveContact(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Convert priority to number
    if (data.priority) data.priority = parseInt(data.priority);

    try {
        let response;
        if (data.id) {
            response = await apiClient.put(`/family-profiles/emergency-contacts/${data.id}`, data);
        } else {
            response = await apiClient.post('/family-profiles/emergency-contacts', data);
        }

        if (response.success) {
            showNotification('Contact saved successfully', 'success');
            closeContactModal();
            loadEmergencyContacts();
            updateStats();
        } else {
            showNotification(response.error || 'Failed to save', 'error');
        }
    } catch (err) {
        console.error('[FamilyProfile] Save contact error:', err);
        showNotification('Failed to save contact', 'error');
    }
}

// ============================================
// Delete Functions
// ============================================

async function deleteMember(id) {
    if (!confirm('Are you sure you want to delete this family member?')) return;

    try {
        const response = await apiClient.delete(`/family-profiles/${id}`);
        if (response.success) {
            showNotification('Family member deleted', 'success');
            loadFamilyMembers();
            updateStats();
        } else {
            showNotification(response.error || 'Failed to delete', 'error');
        }
    } catch (err) {
        console.error('[FamilyProfile] Delete member error:', err);
        showNotification('Failed to delete family member', 'error');
    }
}

async function deleteDocument(id) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
        const response = await apiClient.delete(`/family-profiles/documents/${id}`);
        if (response.success) {
            showNotification('Document deleted', 'success');
            loadDocuments();
        } else {
            showNotification(response.error || 'Failed to delete', 'error');
        }
    } catch (err) {
        console.error('[FamilyProfile] Delete document error:', err);
        showNotification('Failed to delete document', 'error');
    }
}

async function deleteContact(id) {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
        const response = await apiClient.delete(`/family-profiles/emergency-contacts/${id}`);
        if (response.success) {
            showNotification('Contact deleted', 'success');
            loadEmergencyContacts();
            updateStats();
        } else {
            showNotification(response.error || 'Failed to delete', 'error');
        }
    } catch (err) {
        console.error('[FamilyProfile] Delete contact error:', err);
        showNotification('Failed to delete contact', 'error');
    }
}

// ============================================
// View Document
// ============================================

function viewDocument(id) {
    const doc = documents.find(d => d.id === id);
    if (doc && doc.file_path) {
        // Use the direct file path - served by static file server
        window.open(doc.file_path, '_blank');
    }
}

// ============================================
// Utility Functions
// ============================================

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCategory(category) {
    // Look up from loaded categories first
    const cat = documentCategories.find(c =>
        c.name?.toLowerCase().replace(/\s+/g, '_') === category ||
        c.name?.toLowerCase() === category?.toLowerCase()
    );
    if (cat) return cat.name;

    // Fallback labels
    const labels = {
        identification: 'Identification',
        medical: 'Medical Records',
        medical_records: 'Medical Records',
        financial: 'Financial',
        legal: 'Legal',
        emergency: 'Emergency Plans',
        emergency_plans: 'Emergency Plans',
        insurance: 'Insurance',
        property: 'Property',
        other: 'Other'
    };
    return labels[category] || category;
}

function getCategoryIcon(category) {
    // Look up from loaded categories first
    const cat = documentCategories.find(c =>
        c.name?.toLowerCase().replace(/\s+/g, '_') === category ||
        c.name?.toLowerCase() === category?.toLowerCase()
    );
    if (cat && cat.icon) return cat.icon;

    // Fallback icons
    const icons = {
        identification: '🪪',
        medical: '🏥',
        medical_records: '🏥',
        financial: '💰',
        legal: '⚖️',
        emergency: '🚨',
        emergency_plans: '🚨',
        insurance: '📋',
        property: '🏠',
        other: '📄'
    };
    return icons[category] || '📄';
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Export functions to window for onclick handlers
window.openMemberModal = openMemberModal;
window.closeMemberModal = closeMemberModal;
window.openDocumentModal = openDocumentModal;
window.closeDocumentModal = closeDocumentModal;
window.openContactModal = openContactModal;
window.closeContactModal = closeContactModal;
window.saveMember = saveMember;
window.saveDocument = saveDocument;
window.saveContact = saveContact;
window.editMember = editMember;
window.editDocument = editDocument;
window.editContact = editContact;
window.deleteMember = deleteMember;
window.deleteDocument = deleteDocument;
window.deleteContact = deleteContact;
window.viewDocument = viewDocument;
window.filterDocuments = filterDocuments;
