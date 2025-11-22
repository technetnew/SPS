/**
 * SPS Smart Scanner Module
 * Barcode scanning with html5-qrcode and OCR with Tesseract.js
 * Works with desktop webcam and mobile front/back cameras
 */

class SPSScanner {
    constructor() {
        this.html5QrCode = null;
        this.isScanning = false;
        this.currentCamera = 'environment'; // 'environment' (back) or 'user' (front)
        this.availableCameras = [];
        this.currentCameraIndex = 0;
        this.tesseractWorker = null;
        this.scanMode = 'barcode'; // 'barcode' or 'ocr'
        this.onResultCallback = null;
        this.libraryLoaded = false;
    }

    /**
     * Check if Html5Qrcode library is loaded
     */
    checkLibrary() {
        if (typeof Html5Qrcode === 'undefined') {
            console.error('[Scanner] Html5Qrcode library not loaded');
            return false;
        }
        this.libraryLoaded = true;
        return true;
    }

    /**
     * Initialize the scanner
     */
    async init() {
        console.log('[Scanner] Initializing...');

        // Check if Html5Qrcode is loaded
        this.checkLibrary();

        // Load Tesseract worker for OCR
        if (typeof Tesseract !== 'undefined') {
            try {
                this.tesseractWorker = await Tesseract.createWorker('eng');
                console.log('[Scanner] Tesseract OCR initialized');
            } catch (err) {
                console.warn('[Scanner] Failed to initialize Tesseract:', err);
            }
        }

        console.log('[Scanner] Initialization complete, library loaded:', this.libraryLoaded);
    }

    /**
     * Open the scanner modal
     */
    openModal(mode = 'barcode', onResult = null) {
        console.log('[Scanner] Opening modal, mode:', mode);

        // Re-check library on each open
        if (!this.checkLibrary()) {
            alert('Scanner library not loaded. Please refresh the page and try again.');
            return;
        }

        this.scanMode = mode;
        this.onResultCallback = onResult;

        const modal = document.getElementById('smart-scanner-modal');
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex'; // Ensure display is set
            this.updateModeUI();
            // Small delay to ensure modal is visible before starting camera
            setTimeout(() => {
                this.startScanning();
            }, 100);
        } else {
            console.error('[Scanner] Modal element not found: smart-scanner-modal');
            alert('Scanner modal not found. Please check the page structure.');
        }
    }

    /**
     * Close the scanner modal
     */
    closeModal() {
        console.log('[Scanner] Closing modal');
        const modal = document.getElementById('smart-scanner-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
        this.stopScanning();
    }

    /**
     * Start barcode/QR scanning
     */
    async startScanning() {
        console.log('[Scanner] Starting camera scan...');
        const container = document.getElementById('scanner-video-container');

        if (!container) {
            console.error('[Scanner] Container not found: scanner-video-container');
            this.updateStatus('Scanner container not found.', 'error');
            return;
        }

        // Clear container
        container.innerHTML = '';

        // Stop any existing scanner
        await this.stopScanning();

        // Check if library is available
        if (typeof Html5Qrcode === 'undefined') {
            console.error('[Scanner] Html5Qrcode not available');
            this.updateStatus('Scanner library not loaded. Refresh page.', 'error');
            return;
        }

        // Check for HTTPS (required for camera access except localhost)
        const isSecureContext = location.protocol === 'https:' ||
                               location.hostname === 'localhost' ||
                               location.hostname === '127.0.0.1';

        if (!isSecureContext) {
            console.warn('[Scanner] Camera requires HTTPS. Current protocol:', location.protocol);
            this.updateStatus('⚠️ Camera requires HTTPS. Use manual barcode entry below.', 'warning');
            // Show additional help message
            const helpDiv = document.createElement('div');
            helpDiv.className = 'scanner-https-warning';
            helpDiv.innerHTML = `
                <p><strong>Camera access requires HTTPS</strong></p>
                <p>You're accessing this site via HTTP (${location.protocol}//).
                   Modern browsers require HTTPS for camera access.</p>
                <p>Options:</p>
                <ul>
                    <li>Use manual barcode entry below</li>
                    <li>Access via https:// if available</li>
                    <li>Use localhost for development</li>
                </ul>
            `;
            container.appendChild(helpDiv);
            return;
        }

        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('[Scanner] mediaDevices API not available');
            this.updateStatus('Camera API not available. Use manual barcode entry.', 'error');
            return;
        }

        try {
            this.updateStatus('Requesting camera access...', 'info');

            // First, explicitly request camera permission with specific constraints
            console.log('[Scanner] Requesting camera permission...');
            try {
                // Try with more specific constraints for better compatibility
                const constraints = {
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };
                console.log('[Scanner] Requesting with constraints:', JSON.stringify(constraints));
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                // Stop the stream immediately - we just needed permission
                stream.getTracks().forEach(track => {
                    console.log('[Scanner] Got track:', track.label, track.kind);
                    track.stop();
                });
                console.log('[Scanner] Camera permission granted');
            } catch (permErr) {
                console.error('[Scanner] Camera permission denied:', permErr);
                let errorMsg = 'Camera access denied.';
                if (permErr.name === 'NotAllowedError') {
                    errorMsg = 'Camera blocked. Click the camera icon in browser address bar to allow.';
                } else if (permErr.name === 'NotFoundError') {
                    errorMsg = 'No camera found on this device.';
                } else if (permErr.name === 'NotReadableError') {
                    errorMsg = 'Camera in use by another app. Close other apps and try again.';
                } else if (permErr.name === 'OverconstrainedError') {
                    errorMsg = 'Camera constraints not supported. Trying fallback...';
                    // Try with simpler constraints
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                        stream.getTracks().forEach(track => track.stop());
                        console.log('[Scanner] Fallback camera permission granted');
                    } catch (fallbackErr) {
                        console.error('[Scanner] Fallback also failed:', fallbackErr);
                        this.updateStatus('Camera access failed. Use manual entry below.', 'error');
                        return;
                    }
                }
                if (permErr.name !== 'OverconstrainedError') {
                    this.updateStatus(errorMsg + ' Use manual entry below.', 'error');
                    return;
                }
            }

            // Get available cameras
            console.log('[Scanner] Getting available cameras...');
            this.availableCameras = await Html5Qrcode.getCameras();
            console.log('[Scanner] Found cameras:', this.availableCameras);

            if (this.availableCameras.length === 0) {
                this.updateStatus('No cameras found. Please allow camera access and try again.', 'error');
                return;
            }

            // Show camera switch button if multiple cameras
            const switchBtn = document.getElementById('scanner-switch-camera');
            if (switchBtn) {
                switchBtn.style.display = this.availableCameras.length > 1 ? 'inline-flex' : 'none';
            }

            // Create scanner instance
            this.html5QrCode = new Html5Qrcode('scanner-video-container');

            // Configure scanning
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 150 },
                aspectRatio: 1.777,
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.QR_CODE
                ]
            };

            // Determine camera to use
            let cameraId;
            if (this.currentCamera === 'environment') {
                // Try to find back camera
                const backCamera = this.availableCameras.find(c =>
                    c.label.toLowerCase().includes('back') ||
                    c.label.toLowerCase().includes('rear') ||
                    c.label.toLowerCase().includes('environment')
                );
                cameraId = backCamera ? backCamera.id : this.availableCameras[0].id;
            } else {
                // Try to find front camera
                const frontCamera = this.availableCameras.find(c =>
                    c.label.toLowerCase().includes('front') ||
                    c.label.toLowerCase().includes('user')
                );
                cameraId = frontCamera ? frontCamera.id : this.availableCameras[0].id;
            }

            this.updateStatus('Starting camera...', 'info');

            // Start scanning
            await this.html5QrCode.start(
                cameraId,
                config,
                (decodedText, decodedResult) => {
                    this.onBarcodeDetected(decodedText, decodedResult);
                },
                (errorMessage) => {
                    // Ignore scanning errors (normal when no barcode in view)
                }
            );

            this.isScanning = true;
            this.updateStatus('Point camera at barcode or label', 'success');

            // Add scan line animation
            const frame = document.querySelector('.scanner-frame');
            if (frame && !frame.querySelector('.scan-line')) {
                const scanLine = document.createElement('div');
                scanLine.className = 'scan-line';
                frame.appendChild(scanLine);
            }

        } catch (err) {
            console.error('[Scanner] Failed to start:', err);
            let errorMsg = 'Camera access denied or unavailable.';

            if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
                errorMsg = 'Camera access denied. Please allow camera permissions in your browser settings.';
            } else if (err.name === 'NotFoundError') {
                errorMsg = 'No camera found on this device.';
            } else if (err.name === 'NotReadableError') {
                errorMsg = 'Camera is in use by another application.';
            } else if (err.name === 'OverconstrainedError') {
                errorMsg = 'Camera does not support requested settings.';
            } else if (err.message) {
                errorMsg = err.message;
            }

            this.updateStatus(`${errorMsg} Use manual entry below.`, 'error');
        }
    }

    /**
     * Stop scanning
     */
    async stopScanning() {
        console.log('[Scanner] Stopping scanner...');
        if (this.html5QrCode) {
            try {
                if (this.isScanning) {
                    await this.html5QrCode.stop();
                }
                this.html5QrCode.clear();
            } catch (err) {
                console.warn('[Scanner] Error stopping scanner:', err);
            }
            this.html5QrCode = null;
        }
        this.isScanning = false;
    }

    /**
     * Switch between front and back camera
     */
    async switchCamera() {
        this.currentCamera = this.currentCamera === 'environment' ? 'user' : 'environment';
        await this.startScanning();
    }

    /**
     * Handle barcode detection
     */
    async onBarcodeDetected(code, result) {
        // Vibrate on detection (mobile)
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }

        // Play success sound
        this.playBeep();

        // Show detected code
        document.getElementById('scanner-detected-code').value = code;
        this.updateStatus(`Barcode detected: ${code}`, 'success');

        // Look up product info
        await this.lookupProduct(code);
    }

    /**
     * Capture image for OCR
     */
    async captureForOCR() {
        if (!this.html5QrCode || !this.isScanning) {
            this.updateStatus('Camera not active', 'error');
            return;
        }

        this.updateStatus('Capturing image for text recognition...', 'info');

        try {
            // Get current frame from video
            const videoElement = document.querySelector('#scanner-video-container video');
            if (!videoElement) {
                throw new Error('Video element not found');
            }

            // Create canvas to capture frame
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0);

            // Run OCR
            await this.runOCR(canvas);

        } catch (err) {
            console.error('[Scanner] OCR capture error:', err);
            this.updateStatus('Failed to capture image', 'error');
        }
    }

    /**
     * Run OCR on image
     */
    async runOCR(imageSource) {
        if (!this.tesseractWorker) {
            // Try to initialize Tesseract
            if (typeof Tesseract !== 'undefined') {
                this.updateStatus('Initializing OCR engine...', 'info');
                try {
                    this.tesseractWorker = await Tesseract.createWorker('eng');
                } catch (err) {
                    this.updateStatus('OCR not available. Enter text manually.', 'error');
                    return;
                }
            } else {
                this.updateStatus('OCR library not loaded', 'error');
                return;
            }
        }

        this.updateStatus('Reading text...', 'info');

        try {
            const { data: { text } } = await this.tesseractWorker.recognize(imageSource);

            if (text && text.trim()) {
                // Parse the OCR text for product info
                const extractedData = this.parseOCRText(text);
                this.showOCRResults(text, extractedData);
            } else {
                this.updateStatus('No text detected. Try better lighting.', 'warning');
            }
        } catch (err) {
            console.error('[Scanner] OCR error:', err);
            this.updateStatus('OCR failed. Try again.', 'error');
        }
    }

    /**
     * Parse OCR text to extract product info
     */
    parseOCRText(text) {
        const data = {
            name: null,
            calories: null,
            protein: null,
            carbs: null,
            fat: null,
            servingSize: null,
            weight: null
        };

        const lines = text.split('\n').map(l => l.trim()).filter(l => l);

        // Extract nutrition facts
        lines.forEach(line => {
            const lowerLine = line.toLowerCase();

            // Calories
            if (lowerLine.includes('calorie')) {
                const match = line.match(/(\d+)\s*(cal|kcal)?/i);
                if (match) data.calories = parseInt(match[1]);
            }

            // Protein
            if (lowerLine.includes('protein')) {
                const match = line.match(/(\d+\.?\d*)\s*g/i);
                if (match) data.protein = parseFloat(match[1]);
            }

            // Carbohydrates
            if (lowerLine.includes('carb') || lowerLine.includes('total carb')) {
                const match = line.match(/(\d+\.?\d*)\s*g/i);
                if (match) data.carbs = parseFloat(match[1]);
            }

            // Fat
            if (lowerLine.includes('total fat') || (lowerLine.includes('fat') && !lowerLine.includes('trans'))) {
                const match = line.match(/(\d+\.?\d*)\s*g/i);
                if (match) data.fat = parseFloat(match[1]);
            }

            // Serving size
            if (lowerLine.includes('serving size')) {
                const match = line.match(/serving size[:\s]*(.+)/i);
                if (match) data.servingSize = match[1].trim();
            }

            // Weight (net weight, net wt)
            if (lowerLine.includes('net w')) {
                const match = line.match(/(\d+\.?\d*)\s*(oz|g|lb|kg)/i);
                if (match) data.weight = `${match[1]} ${match[2]}`;
            }
        });

        // Try to extract product name (usually first non-nutrition line)
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            if (!lowerLine.includes('calorie') &&
                !lowerLine.includes('protein') &&
                !lowerLine.includes('fat') &&
                !lowerLine.includes('carb') &&
                !lowerLine.includes('serving') &&
                !lowerLine.includes('nutrition') &&
                !lowerLine.includes('facts') &&
                !lowerLine.includes('ingredient') &&
                line.length > 3 && line.length < 50) {
                data.name = line;
                break;
            }
        }

        return data;
    }

    /**
     * Show OCR results in modal
     */
    showOCRResults(rawText, extractedData) {
        const resultsContainer = document.getElementById('scanner-ocr-results');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="ocr-results">
                <h4>Extracted Information</h4>
                <div class="ocr-fields">
                    ${extractedData.name ? `<div class="ocr-field"><label>Product Name:</label><span>${extractedData.name}</span></div>` : ''}
                    ${extractedData.calories ? `<div class="ocr-field"><label>Calories:</label><span>${extractedData.calories}</span></div>` : ''}
                    ${extractedData.protein ? `<div class="ocr-field"><label>Protein:</label><span>${extractedData.protein}g</span></div>` : ''}
                    ${extractedData.carbs ? `<div class="ocr-field"><label>Carbs:</label><span>${extractedData.carbs}g</span></div>` : ''}
                    ${extractedData.fat ? `<div class="ocr-field"><label>Fat:</label><span>${extractedData.fat}g</span></div>` : ''}
                    ${extractedData.servingSize ? `<div class="ocr-field"><label>Serving:</label><span>${extractedData.servingSize}</span></div>` : ''}
                </div>
                <details class="ocr-raw-text">
                    <summary>Raw Text</summary>
                    <pre>${rawText}</pre>
                </details>
                <button class="btn btn-primary btn-sm" onclick="spsScanner.useOCRData()">Use This Data</button>
            </div>
        `;
        resultsContainer.style.display = 'block';

        // Store extracted data
        this.lastOCRData = extractedData;
        this.updateStatus('Text extracted! Review and use data.', 'success');
    }

    /**
     * Use OCR data to fill form
     */
    useOCRData() {
        if (this.lastOCRData && this.onResultCallback) {
            this.onResultCallback(this.lastOCRData);
        } else if (this.lastOCRData) {
            this.fillFoodForm(this.lastOCRData);
        }
        this.closeModal();
    }

    /**
     * Look up product from barcode using Open Food Facts
     */
    async lookupProduct(barcode) {
        this.updateStatus('Looking up product...', 'info');

        try {
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
            const data = await response.json();

            if (data.status === 1 && data.product) {
                const product = data.product;
                const productData = {
                    name: product.product_name || product.product_name_en || null,
                    brand: product.brands || null,
                    barcode: barcode,
                    calories: product.nutriments?.['energy-kcal_100g'] || product.nutriments?.['energy-kcal'] || null,
                    protein: product.nutriments?.proteins_100g || product.nutriments?.proteins || null,
                    carbs: product.nutriments?.carbohydrates_100g || product.nutriments?.carbohydrates || null,
                    fat: product.nutriments?.fat_100g || product.nutriments?.fat || null,
                    servingSize: product.serving_size || null,
                    imageUrl: product.image_url || product.image_front_url || null,
                    category: product.categories_tags?.[0]?.replace('en:', '') || null
                };

                this.showProductResults(productData);
                this.updateStatus(`Found: ${productData.name || 'Unknown product'}`, 'success');

            } else {
                this.updateStatus('Product not in database. Try OCR or manual entry.', 'warning');
            }

        } catch (err) {
            console.error('[Scanner] Product lookup error:', err);
            this.updateStatus('Lookup failed. Try OCR or manual entry.', 'error');
        }
    }

    /**
     * Show product lookup results
     */
    showProductResults(productData) {
        const resultsContainer = document.getElementById('scanner-product-results');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="product-results">
                ${productData.imageUrl ? `<img src="${productData.imageUrl}" alt="Product" class="product-image">` : ''}
                <div class="product-info">
                    <h4>${productData.name || 'Unknown Product'}</h4>
                    ${productData.brand ? `<p class="product-brand">${productData.brand}</p>` : ''}
                    <div class="product-nutrition">
                        ${productData.calories ? `<span>Cal: ${Math.round(productData.calories)}</span>` : ''}
                        ${productData.protein ? `<span>Protein: ${Math.round(productData.protein)}g</span>` : ''}
                        ${productData.carbs ? `<span>Carbs: ${Math.round(productData.carbs)}g</span>` : ''}
                        ${productData.fat ? `<span>Fat: ${Math.round(productData.fat)}g</span>` : ''}
                    </div>
                </div>
                <button class="btn btn-primary" onclick="spsScanner.useProductData()">Add to Pantry</button>
            </div>
        `;
        resultsContainer.style.display = 'block';

        // Store for later use
        this.lastProductData = productData;
    }

    /**
     * Use product data to fill form
     */
    useProductData() {
        if (this.lastProductData && this.onResultCallback) {
            this.onResultCallback(this.lastProductData);
        } else if (this.lastProductData) {
            this.fillFoodForm(this.lastProductData);
        }
        this.closeModal();
    }

    /**
     * Fill the food/inventory form with scanned data
     */
    fillFoodForm(data) {
        // Detect which page we're on
        const isPantryPage = window.location.pathname.includes('pantry');
        const isInventoryPage = window.location.pathname.includes('inventory');

        // Try pantry form fields first
        if (data.name) {
            const nameEl = document.getElementById('food-name') || document.getElementById('item-name');
            if (nameEl) nameEl.value = data.name;
        }

        if (data.barcode) {
            const barcodeEl = document.getElementById('food-barcode') || document.getElementById('item-barcode');
            if (barcodeEl) barcodeEl.value = data.barcode;
        }

        if (data.calories) {
            const caloriesEl = document.getElementById('food-calories') || document.getElementById('item-calories');
            if (caloriesEl) caloriesEl.value = Math.round(data.calories);
        }

        if (data.protein) {
            const proteinEl = document.getElementById('food-protein');
            if (proteinEl) proteinEl.value = Math.round(data.protein * 10) / 10;
        }

        if (data.carbs) {
            const carbsEl = document.getElementById('food-carbs');
            if (carbsEl) carbsEl.value = Math.round(data.carbs * 10) / 10;
        }

        if (data.fat) {
            const fatEl = document.getElementById('food-fat');
            if (fatEl) fatEl.value = Math.round(data.fat * 10) / 10;
        }

        // Show notification
        if (typeof showNotification === 'function') {
            showNotification('Product data loaded! Review and save.', 'success');
        }

        // Open the appropriate modal
        if (typeof openAddItemModal === 'function') {
            openAddItemModal();
        }
    }

    /**
     * Manual barcode entry
     */
    useManualCode() {
        const code = document.getElementById('scanner-detected-code')?.value;
        if (code && code.trim()) {
            this.lookupProduct(code.trim());
        } else {
            this.updateStatus('Please enter a barcode', 'warning');
        }
    }

    /**
     * Update status message
     */
    updateStatus(message, type = 'info') {
        const statusEl = document.getElementById('scanner-status-text');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `scanner-status scanner-status-${type}`;
        }
    }

    /**
     * Update mode UI (barcode vs OCR)
     */
    updateModeUI() {
        const barcodeBtn = document.getElementById('scanner-mode-barcode');
        const ocrBtn = document.getElementById('scanner-mode-ocr');

        if (barcodeBtn) barcodeBtn.classList.toggle('active', this.scanMode === 'barcode');
        if (ocrBtn) ocrBtn.classList.toggle('active', this.scanMode === 'ocr');
    }

    /**
     * Set scan mode
     */
    setMode(mode) {
        this.scanMode = mode;
        this.updateModeUI();

        if (mode === 'barcode') {
            this.updateStatus('Point camera at barcode', 'info');
        } else {
            this.updateStatus('Position nutrition label in view, then tap Capture', 'info');
        }
    }

    /**
     * Play beep sound for successful scan
     */
    playBeep() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.frequency.value = 1000;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch (err) {
            // Ignore audio errors
        }
    }

    /**
     * Clean up resources
     */
    async destroy() {
        await this.stopScanning();
        if (this.tesseractWorker) {
            await this.tesseractWorker.terminate();
        }
    }
}

// Create global instance
const spsScanner = new SPSScanner();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Scanner] DOM loaded, initializing scanner...');
    spsScanner.init();
});

// Also try to initialize immediately if DOM is already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('[Scanner] DOM already ready, initializing scanner...');
    setTimeout(() => spsScanner.init(), 0);
}

// Override the existing openBarcodeScanner function
window.openBarcodeScanner = function() {
    console.log('[Scanner] openBarcodeScanner called');
    if (typeof spsScanner === 'undefined') {
        console.error('[Scanner] spsScanner not initialized');
        alert('Scanner not initialized. Please refresh the page.');
        return;
    }
    spsScanner.openModal('barcode');
};

// Close scanner function
window.closeBarcodeScanner = function() {
    console.log('[Scanner] closeBarcodeScanner called');
    if (typeof spsScanner !== 'undefined') {
        spsScanner.closeModal();
    }
};

// Export functions
window.spsScanner = spsScanner;

console.log('[Scanner] Scanner script loaded');
