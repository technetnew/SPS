/**
 * QR Data Encoder/Decoder Utility
 * Handles compression, encoding, and decoding of item data for QR codes
 * Designed for offline-first operation
 */

const QRData = (function() {
    'use strict';

    // Short key mappings for compression
    const KEY_MAP = {
        // Common fields
        id: 'i',
        name: 'n',
        quantity: 'q',
        unit: 'u',
        category: 'c',
        location: 'l',
        notes: 'o',

        // Pantry-specific
        calories_per_unit: 'cal',
        protein_per_unit: 'pro',
        carbs_per_unit: 'crb',
        fat_per_unit: 'fat',
        expiration_date: 'exp',
        purchase_date: 'pur',

        // Inventory-specific
        min_quantity: 'min',
        par_level: 'par',
        model_number: 'mod',
        serial_number: 'ser',
        purchase_price: 'pri',
        condition: 'con',

        // Meta fields
        type: 't',           // 'p' for pantry, 'i' for inventory
        version: 'v',        // QR data version
        created: 'cr',       // Timestamp when QR was generated
        updated_at: 'upd',   // Last update timestamp from DB

        // Group fields
        items: 'its',        // Array of items for group QR
        group_name: 'gn',
        group_category: 'gc'
    };

    // Reverse mapping for decoding
    const REVERSE_KEY_MAP = Object.fromEntries(
        Object.entries(KEY_MAP).map(([k, v]) => [v, k])
    );

    // Essential fields that trigger QR regeneration when changed
    const ESSENTIAL_FIELDS = {
        pantry: ['name', 'quantity', 'unit', 'category', 'expiration_date', 'calories_per_unit'],
        inventory: ['name', 'quantity', 'unit', 'category', 'location', 'min_quantity', 'serial_number']
    };

    // Current QR data version
    const QR_VERSION = 1;

    /**
     * Compress keys in an object using short key mappings
     */
    function compressKeys(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => compressKeys(item));
        }
        if (obj && typeof obj === 'object') {
            const compressed = {};
            for (const [key, value] of Object.entries(obj)) {
                const shortKey = KEY_MAP[key] || key;
                compressed[shortKey] = compressKeys(value);
            }
            return compressed;
        }
        return obj;
    }

    /**
     * Expand short keys back to full keys
     */
    function expandKeys(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => expandKeys(item));
        }
        if (obj && typeof obj === 'object') {
            const expanded = {};
            for (const [key, value] of Object.entries(obj)) {
                const fullKey = REVERSE_KEY_MAP[key] || key;
                expanded[fullKey] = expandKeys(value);
            }
            return expanded;
        }
        return obj;
    }

    /**
     * Remove null, undefined, empty strings, and zero values to reduce size
     */
    function removeEmptyValues(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => removeEmptyValues(item));
        }
        if (obj && typeof obj === 'object') {
            const cleaned = {};
            for (const [key, value] of Object.entries(obj)) {
                // Keep the value if it's meaningful
                if (value !== null && value !== undefined && value !== '' && value !== 0) {
                    cleaned[key] = removeEmptyValues(value);
                }
            }
            return cleaned;
        }
        return obj;
    }

    /**
     * Encode item data for QR code
     * @param {Object} item - The item data
     * @param {string} type - 'pantry' or 'inventory'
     * @returns {string} Encoded string for QR code
     */
    function encode(item, type) {
        // Create QR data object with metadata
        const qrData = {
            ...item,
            type: type === 'pantry' ? 'p' : 'i',
            version: QR_VERSION,
            created: Date.now()
        };

        // Remove empty values and compress keys
        const cleaned = removeEmptyValues(qrData);
        const compressed = compressKeys(cleaned);

        // Convert to JSON and encode as base64
        const json = JSON.stringify(compressed);
        const base64 = btoa(unescape(encodeURIComponent(json)));

        // Add prefix for identification
        return 'SPS:' + base64;
    }

    /**
     * Encode multiple items as a group QR code
     * @param {Array} items - Array of item data
     * @param {string} type - 'pantry' or 'inventory'
     * @param {Object} groupInfo - Optional group metadata
     * @returns {string} Encoded string for QR code
     */
    function encodeGroup(items, type, groupInfo = {}) {
        const qrData = {
            type: type === 'pantry' ? 'p' : 'i',
            version: QR_VERSION,
            created: Date.now(),
            group_name: groupInfo.name || 'Group',
            group_category: groupInfo.category || '',
            items: items.map(item => removeEmptyValues(item))
        };

        const compressed = compressKeys(qrData);
        const json = JSON.stringify(compressed);
        const base64 = btoa(unescape(encodeURIComponent(json)));

        return 'SPSG:' + base64; // SPSG = SPS Group
    }

    /**
     * Decode QR code data
     * @param {string} encoded - The encoded QR string
     * @returns {Object|null} Decoded data or null if invalid
     */
    function decode(encoded) {
        try {
            // Check for valid prefix
            if (!encoded) return null;

            let base64, isGroup = false;

            if (encoded.startsWith('SPS:')) {
                base64 = encoded.substring(4);
            } else if (encoded.startsWith('SPSG:')) {
                base64 = encoded.substring(5);
                isGroup = true;
            } else {
                // Try to decode anyway (might be legacy format)
                base64 = encoded;
            }

            // Decode base64 and parse JSON
            const json = decodeURIComponent(escape(atob(base64)));
            const compressed = JSON.parse(json);

            // Expand keys back to full names
            const expanded = expandKeys(compressed);

            // Convert type back to full name
            if (expanded.type === 'p') expanded.type = 'pantry';
            else if (expanded.type === 'i') expanded.type = 'inventory';

            expanded.isGroup = isGroup;

            return expanded;
        } catch (e) {
            console.error('QR decode error:', e);
            return null;
        }
    }

    /**
     * Validate decoded QR data
     * @param {Object} data - Decoded QR data
     * @returns {Object} Validation result with isValid and errors
     */
    function validate(data) {
        const errors = [];

        if (!data) {
            return { isValid: false, errors: ['Invalid or corrupted QR data'] };
        }

        if (!data.type || !['pantry', 'inventory'].includes(data.type)) {
            errors.push('Unknown item type');
        }

        if (!data.name) {
            errors.push('Missing item name');
        }

        if (data.quantity === undefined || data.quantity === null) {
            errors.push('Missing quantity');
        }

        // Check for group data
        if (data.isGroup && (!Array.isArray(data.items) || data.items.length === 0)) {
            errors.push('Group QR has no items');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Check if essential fields have changed between two versions
     * @param {Object} oldData - Previous item data
     * @param {Object} newData - New item data
     * @param {string} type - 'pantry' or 'inventory'
     * @returns {boolean} True if regeneration is needed
     */
    function needsRegeneration(oldData, newData, type) {
        const fields = ESSENTIAL_FIELDS[type] || [];

        for (const field of fields) {
            const oldVal = oldData[field];
            const newVal = newData[field];

            // Compare as strings to handle type differences
            if (String(oldVal || '') !== String(newVal || '')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Compare QR data with database record and determine sync action
     * @param {Object} qrData - Data from QR code
     * @param {Object} dbData - Data from database (or null if not found)
     * @returns {Object} Sync recommendation
     */
    function compareSyncData(qrData, dbData) {
        if (!dbData) {
            return {
                action: 'create',
                message: 'Item not found in database. Create new entry?',
                qrData,
                dbData: null
            };
        }

        const qrUpdated = qrData.updated_at || qrData.created;
        const dbUpdated = new Date(dbData.updated_at).getTime();

        // Check if data matches
        const fieldsToCompare = ['name', 'quantity', 'unit', 'category', 'location'];
        const differences = [];

        for (const field of fieldsToCompare) {
            if (String(qrData[field] || '') !== String(dbData[field] || '')) {
                differences.push({
                    field,
                    qrValue: qrData[field],
                    dbValue: dbData[field]
                });
            }
        }

        if (differences.length === 0) {
            return {
                action: 'none',
                message: 'QR data matches database',
                qrData,
                dbData
            };
        }

        // Determine which is newer
        if (qrUpdated > dbUpdated) {
            return {
                action: 'update_db',
                message: 'QR data is newer. Update database?',
                differences,
                qrData,
                dbData
            };
        } else {
            return {
                action: 'update_qr',
                message: 'Database is newer. QR code may be outdated.',
                differences,
                qrData,
                dbData
            };
        }
    }

    /**
     * Get estimated QR code size for data
     * @param {string} encoded - Encoded QR string
     * @returns {Object} Size information
     */
    function getQRSize(encoded) {
        const bytes = new Blob([encoded]).size;

        // QR code capacity varies by version and error correction
        // Using medium error correction (M)
        let version, modules;

        if (bytes <= 134) { version = 5; modules = 37; }
        else if (bytes <= 270) { version = 10; modules = 57; }
        else if (bytes <= 461) { version = 15; modules = 77; }
        else if (bytes <= 718) { version = 20; modules = 97; }
        else if (bytes <= 1042) { version = 25; modules = 117; }
        else if (bytes <= 1435) { version = 30; modules = 137; }
        else if (bytes <= 1897) { version = 35; modules = 145; }
        else if (bytes <= 2430) { version = 40; modules = 177; }
        else { version = -1; modules = 0; } // Too large

        return {
            bytes,
            version,
            modules,
            tooLarge: version === -1,
            recommendation: version === -1
                ? 'Data too large for QR code. Consider splitting into multiple codes.'
                : version > 25
                    ? 'Large QR code. May be difficult to scan from labels.'
                    : 'OK'
        };
    }

    /**
     * Format item data for display from QR
     * @param {Object} data - Decoded QR data
     * @returns {string} HTML formatted display
     */
    function formatForDisplay(data) {
        if (!data) return '<p>Invalid QR data</p>';

        const type = data.type === 'pantry' ? 'Pantry Item' : 'Inventory Item';
        const created = data.created ? new Date(data.created).toLocaleString() : 'Unknown';

        let html = `
            <div class="qr-item-display">
                <div class="qr-item-header">
                    <span class="qr-item-type">${type}</span>
                    <span class="qr-item-date">QR Generated: ${created}</span>
                </div>
                <h3 class="qr-item-name">${escapeHtml(data.name || 'Unknown')}</h3>
                <div class="qr-item-details">
                    <div class="qr-detail"><strong>Quantity:</strong> ${data.quantity || 0} ${data.unit || ''}</div>
                    <div class="qr-detail"><strong>Category:</strong> ${escapeHtml(data.category || 'N/A')}</div>
                    <div class="qr-detail"><strong>Location:</strong> ${escapeHtml(data.location || 'N/A')}</div>
        `;

        if (data.type === 'pantry') {
            if (data.expiration_date) {
                html += `<div class="qr-detail"><strong>Expires:</strong> ${data.expiration_date}</div>`;
            }
            if (data.calories_per_unit) {
                html += `<div class="qr-detail"><strong>Calories/Unit:</strong> ${data.calories_per_unit}</div>`;
            }
        } else {
            if (data.serial_number) {
                html += `<div class="qr-detail"><strong>Serial:</strong> ${escapeHtml(data.serial_number)}</div>`;
            }
            if (data.min_quantity) {
                html += `<div class="qr-detail"><strong>Min Qty:</strong> ${data.min_quantity}</div>`;
            }
        }

        if (data.notes) {
            html += `<div class="qr-detail qr-notes"><strong>Notes:</strong> ${escapeHtml(data.notes)}</div>`;
        }

        html += '</div></div>';

        return html;
    }

    /**
     * Format group data for display
     * @param {Object} data - Decoded group QR data
     * @returns {string} HTML formatted display
     */
    function formatGroupForDisplay(data) {
        if (!data || !data.items) return '<p>Invalid group QR data</p>';

        const type = data.type === 'pantry' ? 'Pantry' : 'Inventory';
        const itemCount = data.items.length;

        let html = `
            <div class="qr-group-display">
                <div class="qr-group-header">
                    <h3>${escapeHtml(data.group_name || 'Item Group')}</h3>
                    <span class="qr-group-meta">${itemCount} ${type} Items</span>
                </div>
                <div class="qr-group-items">
        `;

        for (const item of data.items) {
            html += `
                <div class="qr-group-item">
                    <span class="item-name">${escapeHtml(item.name || 'Unknown')}</span>
                    <span class="item-qty">${item.quantity || 0} ${item.unit || ''}</span>
                </div>
            `;
        }

        html += '</div></div>';

        return html;
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Generate print-ready label data
     * @param {Object} item - Item data
     * @param {string} type - 'pantry' or 'inventory'
     * @param {string} qrDataUrl - QR code as data URL
     * @returns {Object} Label data for printing
     */
    function generateLabelData(item, type, qrDataUrl) {
        return {
            qrCode: qrDataUrl,
            name: item.name || 'Unknown',
            quantity: `${item.quantity || 0} ${item.unit || ''}`,
            category: item.category || '',
            location: item.location || '',
            expiration: type === 'pantry' ? (item.expiration_date || '') : '',
            serial: type === 'inventory' ? (item.serial_number || '') : '',
            id: item.id,
            type: type,
            printDate: new Date().toLocaleDateString()
        };
    }

    // Public API
    return {
        encode,
        encodeGroup,
        decode,
        validate,
        needsRegeneration,
        compareSyncData,
        getQRSize,
        formatForDisplay,
        formatGroupForDisplay,
        generateLabelData,
        ESSENTIAL_FIELDS,
        QR_VERSION
    };
})();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QRData;
}
