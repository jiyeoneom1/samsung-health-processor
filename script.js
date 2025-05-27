console.log(`📂 Processing ${filename}:`);
                        console.log(`📊 Parsed columns:`, parsed.meta.fields);
                        console.log(`📈 Total rows:`, parsed.data.length);
                        if (parsed.data.length > 0) {
                            console.log(`🔍 First row sample:`, parsed.data[0]);
                        }// Samsung Health Data Processor
// UX-Friendly JavaScript Implementation

// Global State Management
const AppState = {
    currentMode: null,
    selectedFiles: [],
    nestedZipFiles: [],
    currentNestedZip: null,
    allProcessedData: {},
    downloadableData: {},
    isProcessing: false
};

// Data Processing Configuration
const DATA_CONFIG = {
    TARGET_COLUMNS: {
        'heart_rate': [
            'com.samsung.health.heart_rate.start_time',
            'com.samsung.health.heart_rate.end_time',
            'com.samsung.health.heart_rate.max',
            'com.samsung.health.heart_rate.min',
            'com.samsung.health.heart_rate.heart_rate'
        ],
        'stress': [
            'start_time', 'end_time', 'max', 'min', 'score'
        ],
        'step_count': [
            'com.samsung.health.step_count.start_time',
            'com.samsung.health.step_count.end_time',
            'com.samsung.health.step_count.count',
            'com.samsung.health.step_count.calorie'
        ],
        'sleep': [
            'com.samsung.health.sleep.start_time',
            'com.samsung.health.sleep.end_time',
            'sleep_score', 'sleep_duration', 'efficiency',
            'total_rem_duration', 'total_light_duration', 'sleep_cycle'
        ]
    },
    OUTPUT_COLUMNS: {
        'heart_rate': ['start_time', 'end_time', 'max', 'min', 'heart_rate'],
        'stress': ['start_time', 'end_time', 'max', 'min', 'score'],
        'step_count': ['start_time', 'end_time', 'count', 'calorie'],
        'sleep': ['start_time', 'end_time', 'sleep_score', 'sleep_duration', 'efficiency', 'total_rem_duration', 'total_light_duration', 'sleep_cycle']
    }
};

// DOM Elements Cache
const Elements = {
    // Sections
    modeSelection: document.getElementById('modeSelection'),
    uploadSection: document.getElementById('uploadSection'),
    progressSection: document.getElementById('progressSection'),
    statusSection: document.getElementById('statusSection'),
    resultsSection: document.getElementById('resultsSection'),
    
    // Mode-specific upload areas
    singleMode: document.getElementById('singleMode'),
    multiMode: document.getElementById('multiMode'),
    nestedMode: document.getElementById('nestedMode'),
    
    // File inputs
    fileInput: document.getElementById('fileInput'),
    multiFileInput: document.getElementById('multiFileInput'),
    nestedFileInput: document.getElementById('nestedFileInput'),
    
    // File lists
    selectedFiles: document.getElementById('selectedFiles'),
    fileList: document.getElementById('fileList'),
    nestedFileStructure: document.getElementById('nestedFileStructure'),
    nestedFileList: document.getElementById('nestedFileList'),
    
    // Progress elements
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    
    // Processing options
    processingOptions: document.getElementById('processingOptions'),
    
    // Results
    resultsContainer: document.getElementById('resultsContainer'),
    bulkDownloadSection: document.getElementById('bulkDownloadSection'),
    bulkDownloadContainer: document.getElementById('bulkDownloadContainer'),
    
    // Modal
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    
    // Toast container
    toastContainer: document.getElementById('toastContainer')
};

// Utility Functions
const Utils = {
    // Show toast notification
    showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: none; border: none; font-size: 18px; cursor: pointer; margin-left: 10px;">&times;</button>
            </div>
        `;
        
        Elements.toastContainer.appendChild(toast);
        
        // Auto remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
    },

    // Update progress bar
    updateProgress(percentage, text) {
        Elements.progressFill.style.width = `${percentage}%`;
        Elements.progressText.textContent = text;
        
        // Update percentage display
        const percentageEl = document.querySelector('.progress-percentage');
        if (percentageEl) {
            percentageEl.textContent = `${Math.round(percentage)}%`;
        }
    },

    // Show/hide sections with animation
    showSection(element, show = true) {
        if (show) {
            element.style.display = 'block';
            element.classList.add('fade-in');
        } else {
            element.style.display = 'none';
            element.classList.remove('fade-in');
        }
    },

    // Extract file identifier from filename
    getFileIdentifier(filename) {
        const match = filename.match(/([A-Z0-9]+)\.zip$/i);
        return match ? match[1] : filename.replace('.zip', '');
    },

    // Get data type from pattern
    getDataType(pattern) {
        if (pattern.includes('heart_rate')) return 'heart_rate';
        if (pattern.includes('stress')) return 'stress';
        if (pattern.includes('pedometer_step_count')) return 'step_count';
        if (pattern.includes('sleep')) return 'sleep';
        return 'unknown';
    },

    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    // Format number with commas
    formatNumber(num) {
        return num.toLocaleString();
    },

    // Sort data by timestamp with robust parsing
    sortByTime(data) {
        return data.sort((a, b) => {
            const timeA = this.parseTimestamp(a.start_time);
            const timeB = this.parseTimestamp(b.start_time);
            return timeA - timeB;
        });
    },

    // Debug function to check timestamp values
    debugTimestamp(timestamp, label = '') {
        console.log(`🕐 Debug ${label}:`, {
            original: timestamp,
            type: typeof timestamp,
            asNumber: parseInt(timestamp),
            asDate: new Date(parseInt(timestamp)),
            formatted: this.formatTimestamp(timestamp)
        });
    },

    // Format timestamp to readable date
    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        // Debug log for troubleshooting
        this.debugTimestamp(timestamp, 'formatTimestamp');
        
        // Handle different timestamp formats
        let date;
        
        if (typeof timestamp === 'number') {
            // Unix timestamp in milliseconds
            date = new Date(timestamp);
        } else if (typeof timestamp === 'string') {
            if (/^\d+$/.test(timestamp)) {
                // Numeric string - try different interpretations
                const num = parseInt(timestamp);
                
                // Test different timestamp formats
                console.log('🔍 Testing timestamp formats:', {
                    original: num,
                    'as_milliseconds': new Date(num),
                    'as_seconds': new Date(num * 1000),
                    'current_year': new Date().getFullYear()
                });
                
                // Check which format gives a reasonable year (2020-2030)
                const asMs = new Date(num);
                const asSec = new Date(num * 1000);
                
                if (asMs.getFullYear() >= 2020 && asMs.getFullYear() <= 2030) {
                    date = asMs;
                } else if (asSec.getFullYear() >= 2020 && asSec.getFullYear() <= 2030) {
                    date = asSec;
                } else {
                    // Default to milliseconds
                    date = asMs;
                }
            } else {
                // Try parsing as date string
                date = new Date(timestamp);
            }
        } else {
            return timestamp;
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return timestamp; // Return original if can't parse
        }
        
        console.log('✅ Final parsed date:', date);
        
        // Format like Samsung Health: 2025-02-04 1:00:00 AM
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }).replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$1-$2');
    },

    // Parse timestamp to Date object for sorting
    parseTimestamp(timestamp) {
        if (!timestamp) return new Date(0);
        
        let date;
        
        if (typeof timestamp === 'number') {
            // Unix timestamp in milliseconds
            date = new Date(timestamp);
        } else if (typeof timestamp === 'string') {
            if (/^\d+$/.test(timestamp)) {
                // Numeric string - treat as milliseconds
                const num = parseInt(timestamp);
                date = new Date(num);
            } else {
                // Try parsing as date string
                date = new Date(timestamp);
            }
        } else {
            date = new Date(timestamp);
        }
        
        return isNaN(date.getTime()) ? new Date(0) : date;
    },
};

// Mode Management
const ModeManager = {
    init() {
        // Add click handlers to mode cards
        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', () => {
                const mode = card.dataset.mode;
                this.selectMode(mode);
            });
        });

        // Add upload button handlers
        document.getElementById('singleUpload').addEventListener('click', () => {
            Elements.fileInput.click();
        });
        document.getElementById('multiUpload').addEventListener('click', () => {
            Elements.multiFileInput.click();
        });
        document.getElementById('nestedUpload').addEventListener('click', () => {
            Elements.nestedFileInput.click();
        });
    },

    selectMode(mode) {
        AppState.currentMode = mode;
        
        // Update mode card active state
        document.querySelectorAll('.mode-card').forEach(card => {
            card.classList.toggle('active', card.dataset.mode === mode);
        });

        // Show upload section
        Utils.showSection(Elements.modeSelection, false);
        Utils.showSection(Elements.uploadSection, true);

        // Show appropriate upload mode
        Utils.showSection(Elements.singleMode, mode === 'single');
        Utils.showSection(Elements.multiMode, mode === 'multi');
        Utils.showSection(Elements.nestedMode, mode === 'nested');

        // Show processing options for multi/nested modes
        Utils.showSection(Elements.processingOptions, mode !== 'single');

        // Clear previous results
        this.clearResults();

        Utils.showToast(`${this.getModeDisplayName(mode)} 모드가 선택되었습니다.`, 'info');
    },

    getModeDisplayName(mode) {
        const names = {
            single: '단일 ZIP 파일',
            multi: '다중 ZIP 파일',
            nested: '중첩 ZIP 파일'
        };
        return names[mode] || mode;
    },

    clearResults() {
        AppState.allProcessedData = {};
        AppState.downloadableData = {};
        Utils.showSection(Elements.resultsSection, false);
        Elements.statusSection.innerHTML = '';
    }
};

// File Management
const FileManager = {
    init() {
        // File input event listeners
        Elements.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleSingleFile(e.target.files[0]);
            }
        });

        Elements.multiFileInput.addEventListener('change', (e) => {
            for (let i = 0; i < e.target.files.length; i++) {
                this.addFile(e.target.files[i]);
            }
            this.updateFileList();
        });

        Elements.nestedFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleNestedFile(e.target.files[0]);
            }
        });

        // Drag and drop event listeners
        this.initDragAndDrop();
    },

    initDragAndDrop() {
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            
            const files = e.dataTransfer.files;
            const uploadArea = e.target.closest('.upload-area');
            
            if (!uploadArea || files.length === 0) return;

            if (AppState.currentMode === 'single' && uploadArea.closest('#singleMode')) {
                this.handleSingleFile(files[0]);
            } else if (AppState.currentMode === 'multi' && uploadArea.closest('#multiMode')) {
                for (let i = 0; i < files.length; i++) {
                    this.addFile(files[i]);
                }
                this.updateFileList();
            } else if (AppState.currentMode === 'nested' && uploadArea.closest('#nestedMode')) {
                this.handleNestedFile(files[0]);
            }
        });

        // Visual feedback for drag and drop
        document.querySelectorAll('.upload-area').forEach(area => {
            area.addEventListener('dragenter', () => {
                area.classList.add('dragover');
            });

            area.addEventListener('dragleave', (e) => {
                if (!area.contains(e.relatedTarget)) {
                    area.classList.remove('dragover');
                }
            });

            area.addEventListener('drop', () => {
                area.classList.remove('dragover');
            });
        });
    },

    validateFile(file) {
        if (!file.name.toLowerCase().endsWith('.zip')) {
            Utils.showToast('ZIP 파일만 업로드 가능합니다.', 'error');
            return false;
        }
        
        // File size check (100MB limit)
        if (file.size > 100 * 1024 * 1024) {
            Utils.showToast('파일 크기가 너무 큽니다. (최대 100MB)', 'error');
            return false;
        }
        
        return true;
    },

    addFile(file) {
        if (!this.validateFile(file)) return;
        
        // Check for duplicates
        const exists = AppState.selectedFiles.some(f => 
            f.name === file.name && f.size === file.size
        );
        
        if (exists) {
            Utils.showToast(`이미 추가된 파일입니다: ${file.name}`, 'warning');
            return;
        }
        
        AppState.selectedFiles.push(file);
        Utils.showToast(`파일이 추가되었습니다: ${file.name}`, 'info');
    },

    removeFile(index) {
        const removedFile = AppState.selectedFiles.splice(index, 1)[0];
        this.updateFileList();
        Utils.showToast(`파일이 제거되었습니다: ${removedFile.name}`, 'info');
    },

    updateFileList() {
        if (AppState.selectedFiles.length === 0) {
            Utils.showSection(Elements.selectedFiles, false);
            return;
        }
        
        Utils.showSection(Elements.selectedFiles, true);
        Elements.fileList.innerHTML = '';
        
        AppState.selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span class="file-name">📁 ${file.name}</span>
                <span class="file-size">${Utils.formatFileSize(file.size)}</span>
                <button class="remove-file" onclick="FileManager.removeFile(${index})">❌</button>
            `;
            Elements.fileList.appendChild(fileItem);
        });
    },

    async handleSingleFile(file) {
        if (!this.validateFile(file)) return;
        
        Utils.showSection(Elements.progressSection, true);
        Utils.updateProgress(0, '파일 처리를 시작합니다...');
        
        try {
            const fileId = Utils.getFileIdentifier(file.name);
            const data = await DataProcessor.processZipFile(file, fileId);
            
            AppState.allProcessedData = { [fileId]: data };
            ResultsManager.displaySingleResults(AppState.allProcessedData);
            
            Utils.updateProgress(100, '처리 완료!');
            Utils.showToast('파일 처리가 완료되었습니다!', 'info');
            
        } catch (error) {
            console.error('파일 처리 오류:', error);
            Utils.showToast(`파일 처리 중 오류가 발생했습니다: ${error.message}`, 'error');
        } finally {
            setTimeout(() => {
                Utils.showSection(Elements.progressSection, false);
            }, 2000);
        }
    },

    async handleNestedFile(file) {
        if (!this.validateFile(file)) return;
        
        Utils.showSection(Elements.progressSection, true);
        Utils.updateProgress(0, '중첩 ZIP 파일을 분석합니다...');
        
        try {
            const zip = await JSZip.loadAsync(file);
            Utils.updateProgress(30, 'ZIP 구조 분석 중...');
            
            AppState.nestedZipFiles = [];
            AppState.currentNestedZip = zip;
            
            // Find internal ZIP files
            Object.keys(zip.files).forEach(filename => {
                if (filename.toLowerCase().endsWith('.zip') && !zip.files[filename].dir) {
                    const fileId = Utils.getFileIdentifier(filename);
                    AppState.nestedZipFiles.push({
                        filename,
                        fileId,
                        size: zip.files[filename]._data?.uncompressedSize || 'Unknown'
                    });
                }
            });
            
            Utils.updateProgress(60, '내부 ZIP 파일 목록 생성 중...');
            
            if (AppState.nestedZipFiles.length === 0) {
                Utils.showToast('내부에 ZIP 파일이 발견되지 않았습니다.', 'warning');
                return;
            }
            
            this.updateNestedFileList();
            Utils.updateProgress(100, '완료!');
            Utils.showToast(`${AppState.nestedZipFiles.length}개의 내부 ZIP 파일을 발견했습니다!`, 'info');
            
        } catch (error) {
            console.error('중첩 파일 처리 오류:', error);
            Utils.showToast(`중첩 파일 처리 중 오류가 발생했습니다: ${error.message}`, 'error');
        } finally {
            setTimeout(() => {
                Utils.showSection(Elements.progressSection, false);
            }, 1000);
        }
    },

    updateNestedFileList() {
        Utils.showSection(Elements.nestedFileStructure, true);
        Elements.nestedFileList.innerHTML = '';
        
        AppState.nestedZipFiles.forEach(fileInfo => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span class="file-name">🗜️ ${fileInfo.filename}</span>
                <span class="file-size">ID: ${fileInfo.fileId}</span>
                <span class="file-size">${typeof fileInfo.size === 'number' ? Utils.formatFileSize(fileInfo.size) : fileInfo.size}</span>
            `;
            Elements.nestedFileList.appendChild(fileItem);
        });
    }
};

// Data Processing Engine
const DataProcessor = {
    async processZipFile(file, fileId) {
        const zip = await JSZip.loadAsync(file);
        
        // Find CSV files
        const csvFiles = {};
        const targetPatterns = [
            'com.samsung.shealth.tracker.heart_rate',
            'com.samsung.shealth.stress', 
            'com.samsung.shealth.tracker.pedometer_step_count',
            'com.samsung.shealth.sleep'
        ];

        Object.keys(zip.files).forEach(filename => {
            if (filename.endsWith('.csv')) {
                targetPatterns.forEach(pattern => {
                    if (filename.includes(pattern)) {
                        const type = Utils.getDataType(pattern);
                        if (!csvFiles[type]) csvFiles[type] = [];
                        csvFiles[type].push(filename);
                    }
                });
            }
        });
        
        const processedData = {};

        // Process each data type
        for (const dataType in csvFiles) {
            const filenames = csvFiles[dataType];
            if (filenames.length === 0) continue;
            
            let allRows = [];
            
            // Merge files of the same type
            for (const filename of filenames) {
                const csvContent = await zip.files[filename].async('text');
                
                // Remove first line (file info)
                const lines = csvContent.split('\n');
                const dataLines = lines.slice(1);
                const cleanedCsv = dataLines.join('\n');
                
                const parsed = Papa.parse(cleanedCsv, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    delimiter: ',',
                    quoteChar: '"'
                });
                
                // Extract required columns
                const filteredRows = [];
                for (const row of parsed.data) {
                    const filteredRow = {};
                    let hasValidData = false;
                    
                    for (let i = 0; i < DATA_CONFIG.TARGET_COLUMNS[dataType].length; i++) {
                        const col = DATA_CONFIG.TARGET_COLUMNS[dataType][i];
                        const outputCol = DATA_CONFIG.OUTPUT_COLUMNS[dataType][i];
                        const value = row[col] || '';
                        filteredRow[outputCol] = value;
                        if (value !== '' && value !== null && value !== undefined) {
                            hasValidData = true;
                        }
                    }
                    
                    if (hasValidData) {
                        filteredRow.source_file = fileId;
                        filteredRows.push(filteredRow);
                    }
                }
                
                allRows = allRows.concat(filteredRows);
            }
            
            // Sort by time with robust parsing
            allRows = Utils.sortByTime(allRows);
            
            processedData[dataType] = {
                data: allRows,
                fileId: fileId
            };
        }

        return processedData;
    },

    mergeAllData(allData) {
        const merged = {};
        
        for (const fileId in allData) {
            const fileData = allData[fileId];
            
            for (const dataType in fileData) {
                if (!merged[dataType]) {
                    merged[dataType] = [];
                }
                merged[dataType] = merged[dataType].concat(fileData[dataType].data);
            }
        }
        
        // Sort each type by time with robust parsing
        for (const dataType in merged) {
            merged[dataType] = Utils.sortByTime(merged[dataType]);
        }
        
        return merged;
    },

    createUnifiedData(allData) {
        const unifiedData = [];
        
        for (const fileId in allData) {
            const fileData = allData[fileId];
            
            for (const dataType in fileData) {
                const data = fileData[dataType].data;
                
                data.forEach(row => {
                    const unifiedRow = {
                        data_type: dataType,
                        source_file: row.source_file || fileId,
                        start_time: row.start_time || '',
                        end_time: row.end_time || '',
                        value1: row.heart_rate || row.score || row.count || row.sleep_score || '',
                        value2: row.max || row.calorie || row.sleep_duration || '',
                        value3: row.min || row.efficiency || '',
                        value4: row.total_rem_duration || '',
                        value5: row.total_light_duration || '',
                        value6: row.sleep_cycle || '',
                        raw_data: JSON.stringify(row)
                    };
                    unifiedData.push(unifiedRow);
                });
            }
        }
        
        // Sort by time with robust parsing
        return Utils.sortByTime(unifiedData);
    }
};

// Results Management
const ResultsManager = {
    displaySingleResults(allData) {
        Elements.resultsContainer.innerHTML = '';
        
        for (const fileId in allData) {
            const fileData = allData[fileId];
            
            for (const dataType in fileData) {
                const result = fileData[dataType];
                this.createDataCard(dataType, result.data, fileId);
            }
        }
        
        Utils.showSection(Elements.resultsSection, true);
    },

    displayMultiResults(allData, mergeMode) {
        Elements.resultsContainer.innerHTML = '';
        
        if (mergeMode === 'separate' || mergeMode === 'both') {
            // Display separated files
            for (const fileId in allData) {
                const fileData = allData[fileId];
                
                const fileSection = document.createElement('div');
                fileSection.innerHTML = `<h3 style="color: var(--gray-700); border-bottom: 2px solid var(--primary-color); padding-bottom: 10px; margin: 20px 0;">📁 ${fileId} 파일</h3>`;
                Elements.resultsContainer.appendChild(fileSection);
                
                for (const dataType in fileData) {
                    const result = fileData[dataType];
                    this.createDataCard(dataType, result.data, fileId);
                }
            }
        }
        
        if (mergeMode === 'merge' || mergeMode === 'both') {
            // Display merged data (by type)
            const mergedData = DataProcessor.mergeAllData(allData);
            
            if (mergeMode === 'both') {
                const mergeSection = document.createElement('div');
                mergeSection.innerHTML = `<h3 style="color: var(--gray-700); border-bottom: 2px solid var(--secondary-color); padding-bottom: 10px; margin: 20px 0;">🔗 데이터 타입별 병합</h3>`;
                Elements.resultsContainer.appendChild(mergeSection);
            }
            
            for (const dataType in mergedData) {
                const data = mergedData[dataType];
                this.createDataCard(dataType, data, 'merged_all');
            }
            
            this.createBulkDownloadSection(mergedData);
        }
        
        if (mergeMode === 'unified' || mergeMode === 'both') {
            // Display unified data (all types in one)
            const unifiedData = DataProcessor.createUnifiedData(allData);
            
            if (mergeMode === 'both') {
                const unifiedSection = document.createElement('div');
                unifiedSection.innerHTML = `<h3 style="color: var(--gray-700); border-bottom: 2px solid var(--accent-color); padding-bottom: 10px; margin: 20px 0;">🎯 전체 통합 데이터</h3>`;
                Elements.resultsContainer.appendChild(unifiedSection);
            }
            
            this.createDataCard('unified', unifiedData, 'all_types');
            
            // Add unified download button
            const unifiedDownloadBtn = document.createElement('button');
            unifiedDownloadBtn.className = 'download-btn';
            unifiedDownloadBtn.style.background = 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-dark) 100%)';
            unifiedDownloadBtn.style.margin = '20px auto';
            unifiedDownloadBtn.style.display = 'block';
            unifiedDownloadBtn.innerHTML = `📊 all_types_unified.csv 다운로드 (${Utils.formatNumber(unifiedData.length)}행)`;
            unifiedDownloadBtn.onclick = () => {
                AppState.downloadableData['all_types_unified'] = unifiedData;
                DownloadManager.downloadCSV('unified', unifiedData, 'all_types');
            };
            Elements.resultsContainer.appendChild(unifiedDownloadBtn);
        }
        
        Utils.showSection(Elements.resultsSection, true);
    },

    createDataCard(dataType, data, fileId) {
        // Store data for download
        const key = `${fileId}_${dataType}`;
        AppState.downloadableData[key] = data;
        
        const card = document.createElement('div');
        card.className = 'result-card';
        
        const filename = `${fileId}_${dataType}.csv`;
        const rowCount = data.length;
        
        // Calculate column count
        let columnCount;
        if (dataType === 'unified') {
            columnCount = 10; // data_type, source_file, start_time, end_time, value1-6, raw_data
        } else {
            columnCount = DATA_CONFIG.OUTPUT_COLUMNS[dataType].length + (fileId === 'merged_all' ? 1 : 0);
        }
        
        // Create preview table with raw data display
        const preview = data.slice(0, 3);
        const tableHtml = this.createPreviewTable(dataType, preview, fileId, true); // Add raw data flag
        
        // Description for unified data
        let descriptionHtml = '';
        if (dataType === 'unified') {
            const typeCounts = {};
            data.forEach(row => {
                typeCounts[row.data_type] = (typeCounts[row.data_type] || 0) + 1;
            });
            
            descriptionHtml = `
                <div style="background: rgba(52, 152, 219, 0.1); border: 1px solid var(--primary-color); border-radius: var(--border-radius-md); padding: var(--spacing-md); margin: var(--spacing-md) 0;">
                    <strong>📊 통합 데이터 구성:</strong><br>
                    ${Object.entries(typeCounts).map(([type, count]) => `• ${type}: ${Utils.formatNumber(count)}행`).join('<br>')}
                    <br><small style="color: var(--gray-600);">value1-6: 각 데이터 타입별 주요 값들이 매핑됨</small>
                </div>
            `;
        }
        
        card.innerHTML = `
            <h3>📄 ${filename}</h3>
            ${descriptionHtml}
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-value">${Utils.formatNumber(rowCount)}</span>
                    <span class="stat-label">행 수</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${columnCount}</span>
                    <span class="stat-label">컬럼 수</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${(new Blob([Papa.unparse(data)]).size / 1024).toFixed(1)}KB</span>
                    <span class="stat-label">파일 크기</span>
                </div>
            </div>
            <div class="data-preview">
                <details>
                    <summary>📋 데이터 미리보기 (처음 3행)</summary>
                    <div style="overflow-x: auto; margin-top: var(--spacing-md);">${tableHtml}</div>
                </details>
            </div>
            <button class="download-btn" onclick="DownloadManager.downloadCSVSafe('${dataType}', '${fileId}')">
                💾 ${filename} 다운로드
            </button>
        `;
        
        Elements.resultsContainer.appendChild(card);
    },

    createPreviewTable(dataType, preview, fileId, showRaw = false) {
        if (preview.length === 0) {
            return '<p style="color: var(--gray-600);">데이터가 없습니다</p>';
        }
        
        let tableHtml = '<table class="data-table"><thead><tr>';
        
        // Create headers
        if (dataType === 'unified') {
            const unifiedHeaders = ['data_type', 'source_file', 'start_time', 'end_time', 'value1', 'value2', 'value3', 'value4', 'value5', 'value6'];
            unifiedHeaders.forEach(header => {
                tableHtml += `<th>${header}</th>`;
                if (showRaw && (header === 'start_time' || header === 'end_time')) {
                    tableHtml += `<th>${header}_raw</th>`;
                }
            });
        } else {
            DATA_CONFIG.OUTPUT_COLUMNS[dataType].forEach(col => {
                tableHtml += `<th>${col}</th>`;
                if (showRaw && (col === 'start_time' || col === 'end_time')) {
                    tableHtml += `<th>${col}_raw</th>`;
                }
            });
            if (fileId === 'merged_all') {
                tableHtml += '<th>source_file</th>';
            }
        }
        tableHtml += '</tr></thead><tbody>';
        
        // Create data rows with both formatted and raw data
        preview.forEach(row => {
            tableHtml += '<tr>';
            if (dataType === 'unified') {
                const unifiedHeaders = ['data_type', 'source_file', 'start_time', 'end_time', 'value1', 'value2', 'value3', 'value4', 'value5', 'value6'];
                unifiedHeaders.forEach(header => {
                    let value = row[header] || '';
                    // Format timestamps for better readability
                    if ((header === 'start_time' || header === 'end_time') && value) {
                        const formatted = Utils.formatTimestamp ? Utils.formatTimestamp(value) : value;
                        tableHtml += `<td>${formatted}</td>`;
                        if (showRaw) {
                            tableHtml += `<td style="font-family: monospace; font-size: 11px; background: #f0f0f0;">${value}</td>`;
                        }
                    } else {
                        tableHtml += `<td>${value}</td>`;
                    }
                });
            } else {
                DATA_CONFIG.OUTPUT_COLUMNS[dataType].forEach(col => {
                    let value = row[col] || '';
                    // Format timestamps for better readability
                    if ((col === 'start_time' || col === 'end_time') && value) {
                        const formatted = Utils.formatTimestamp ? Utils.formatTimestamp(value) : value;
                        tableHtml += `<td>${formatted}</td>`;
                        if (showRaw) {
                            tableHtml += `<td style="font-family: monospace; font-size: 11px; background: #f0f0f0;">${value}</td>`;
                        }
                    } else {
                        tableHtml += `<td>${value}</td>`;
                    }
                });
                if (fileId === 'merged_all') {
                    tableHtml += `<td>${row.source_file || ''}</td>`;
                }
            }
            tableHtml += '</tr>';
        });
        
        tableHtml += '</tbody></table>';
        
        if (showRaw) {
            tableHtml += '<p style="font-size: 12px; color: var(--gray-600); margin-top: 10px;">💡 *_raw 컬럼은 원본 타임스탬프 값입니다</p>';
        }
        
        return tableHtml;
    },

    createBulkDownloadSection(mergedData) {
        Utils.showSection(Elements.bulkDownloadSection, true);
        Elements.bulkDownloadContainer.innerHTML = '';
        
        // Individual download buttons
        for (const dataType in mergedData) {
            const data = mergedData[dataType];
            const key = `merged_all_${dataType}`;
            AppState.downloadableData[key] = data;
            
            const button = document.createElement('button');
            button.className = 'download-btn';
            button.innerHTML = `💾 merged_all_${dataType}.csv (${Utils.formatNumber(data.length)}행)`;
            button.onclick = () => {
                DownloadManager.downloadCSV(dataType, data, 'merged_all');
            };
            Elements.bulkDownloadContainer.appendChild(button);
        }
        
        // ZIP download button
        const zipButton = document.createElement('button');
        zipButton.className = 'download-btn';
        zipButton.style.background = 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-dark) 100%)';
        zipButton.innerHTML = '📦 전체 CSV 파일 ZIP으로 다운로드';
        zipButton.onclick = () => DownloadManager.downloadAllAsZip(mergedData);
        Elements.bulkDownloadContainer.appendChild(zipButton);
    }
};

// Download Management
const DownloadManager = {
    downloadCSV(dataType, data, fileId) {
        try {
            const filename = `${fileId}_${dataType}.csv`;
            console.log('다운로드 시작:', filename, '데이터 행 수:', data.length);
            
            if (!data || data.length === 0) {
                Utils.showToast('다운로드할 데이터가 없습니다.', 'warning');
                return;
            }
            
            // Add BOM for Korean characters
            const csv = '\uFEFF' + Papa.unparse(data);
            
            // Try modern File System Access API first
            if (window.showSaveFilePicker) {
                this.downloadWithFilePicker(csv, filename);
                return;
            }
            
            // Fallback to traditional blob download
            this.downloadWithBlob(csv, filename);
            
        } catch (error) {
            console.error('다운로드 오류:', error);
            Utils.showToast(`다운로드 중 오류가 발생했습니다: ${error.message}`, 'error');
            this.showAlternativeDownload(Papa.unparse(data), filename);
        }
    },

    downloadCSVSafe(dataType, fileId) {
        try {
            const key = `${fileId}_${dataType}`;
            const data = AppState.downloadableData[key];
            
            if (!data) {
                console.error('다운로드 데이터를 찾을 수 없습니다:', key);
                Utils.showToast('다운로드할 데이터를 찾을 수 없습니다.', 'error');
                return;
            }
            
            this.downloadCSV(dataType, data, fileId);
        } catch (error) {
            console.error('다운로드 오류:', error);
            Utils.showToast('다운로드 중 오류가 발생했습니다.', 'error');
        }
    },

    async downloadWithFilePicker(csv, filename) {
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'CSV files',
                    accept: { 'text/csv': ['.csv'] }
                }]
            });
            
            const writable = await fileHandle.createWritable();
            await writable.write(csv);
            await writable.close();
            
            Utils.showToast(`파일이 저장되었습니다: ${filename}`, 'info');
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.log('File Picker API 실패, 기본 방법으로 전환');
                this.downloadWithBlob(csv, filename);
            }
        }
    },

    downloadWithBlob(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        
        // IE/Edge support
        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blob, filename);
            Utils.showToast(`파일이 다운로드되었습니다: ${filename}`, 'info');
            return;
        }
        
        // Standard method
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
        
        Utils.showToast(`파일 다운로드를 시작했습니다: ${filename}`, 'info');
        
        // Show alternative after 3 seconds if needed
        setTimeout(() => {
            this.showAlternativeButton(csv, filename);
        }, 3000);
    },

    showAlternativeButton(csv, filename) {
        const alternativeBtn = document.createElement('button');
        alternativeBtn.className = 'btn btn-secondary';
        alternativeBtn.style.margin = '10px';
        alternativeBtn.innerHTML = `🔄 ${filename} 대안 다운로드`;
        
        alternativeBtn.onclick = () => {
            this.showAlternativeDownload(csv, filename);
            alternativeBtn.remove();
        };
        
        Elements.statusSection.appendChild(alternativeBtn);
        
        // Auto remove after 30 seconds
        setTimeout(() => {
            if (alternativeBtn.parentElement) {
                alternativeBtn.remove();
            }
        }, 30000);
    },

    showAlternativeDownload(csv, filename) {
        const modalContent = `
            <h4>📄 ${filename} 데이터</h4>
            <p>아래 텍스트를 모두 선택(Ctrl+A)하여 복사하고, 메모장에 붙여넣어 .csv 확장자로 저장하세요.</p>
            <textarea style="width: 100%; height: 300px; font-family: monospace; margin: 10px 0;" readonly>${csv}</textarea>
            <div style="text-align: center; margin-top: 15px;">
                <button class="btn btn-primary" onclick="this.copyToClipboard('${csv.replace(/'/g, "\\'")}')">
                    📋 클립보드에 복사
                </button>
                <button class="btn btn-secondary" onclick="closeModal()" style="margin-left: 10px;">
                    닫기
                </button>
            </div>
        `;
        
        showModal('대안 다운로드', modalContent);
    },

    async downloadAllAsZip(mergedData) {
        try {
            Utils.showToast('ZIP 파일을 생성하고 있습니다...', 'info');
            
            const zip = new JSZip();
            
            for (const dataType in mergedData) {
                const data = mergedData[dataType];
                const csv = Papa.unparse(data);
                const filename = `merged_all_${dataType}.csv`;
                zip.file(filename, '\uFEFF' + csv);
            }
            
            // Add README
            const readme = this.createReadme(mergedData);
            zip.file('README.md', readme);
            
            const content = await zip.generateAsync({ type: 'blob' });
            
            const filename = `samsung_health_merged_${new Date().toISOString().slice(0, 10)}.zip`;
            this.downloadWithBlob(content, filename);
            
            Utils.showToast('ZIP 파일 다운로드가 시작되었습니다!', 'info');
            
        } catch (error) {
            console.error('ZIP 생성 오류:', error);
            Utils.showToast(`ZIP 파일 생성 중 오류가 발생했습니다: ${error.message}`, 'error');
        }
    },

    createReadme(mergedData) {
        let readme = `# Samsung Health 병합 데이터\n\n`;
        readme += `생성일: ${new Date().toLocaleString('ko-KR')}\n`;
        readme += `처리된 파일 수: ${AppState.selectedFiles.length || Object.keys(AppState.allProcessedData).length}\n`;
        readme += `포함된 데이터 타입:\n`;
        
        for (const dataType in mergedData) {
            readme += `- ${dataType}: ${Utils.formatNumber(mergedData[dataType].length)}행\n`;
        }
        
        readme += `\n## 컬럼 설명\n`;
        for (const dataType in DATA_CONFIG.OUTPUT_COLUMNS) {
            if (mergedData[dataType]) {
                readme += `\n### ${dataType}\n`;
                DATA_CONFIG.OUTPUT_COLUMNS[dataType].forEach(col => {
                    readme += `- ${col}\n`;
                });
                readme += `- source_file: 원본 파일 식별자\n`;
            }
        }
        
        return readme;
    }
};

// Processing Functions
async function processMultipleFiles() {
    if (AppState.selectedFiles.length === 0) {
        Utils.showToast('처리할 파일을 선택해주세요.', 'warning');
        return;
    }

    Utils.showSection(Elements.progressSection, true);
    Utils.updateProgress(0, '여러 ZIP 파일을 처리하고 있습니다...');

    try {
        AppState.allProcessedData = {};
        
        for (let i = 0; i < AppState.selectedFiles.length; i++) {
            const file = AppState.selectedFiles[i];
            const fileId = Utils.getFileIdentifier(file.name);
            
            Utils.updateProgress((i / AppState.selectedFiles.length) * 80, `${file.name} 처리 중... (${i + 1}/${AppState.selectedFiles.length})`);
            
            const data = await DataProcessor.processZipFile(file, fileId);
            AppState.allProcessedData[fileId] = data;
        }

        Utils.updateProgress(90, '결과 생성 중...');
        
        const mergeMode = document.querySelector('input[name="mergeMode"]:checked').value;
        ResultsManager.displayMultiResults(AppState.allProcessedData, mergeMode);
        
        Utils.updateProgress(100, '완료!');
        Utils.showToast(`${AppState.selectedFiles.length}개 파일 처리가 완료되었습니다!`, 'info');

    } catch (error) {
        console.error('다중 파일 처리 오류:', error);
        Utils.showToast(`파일 처리 중 오류가 발생했습니다: ${error.message}`, 'error');
    } finally {
        setTimeout(() => {
            Utils.showSection(Elements.progressSection, false);
        }, 2000);
    }
}

async function processNestedFiles() {
    if (AppState.nestedZipFiles.length === 0 || !AppState.currentNestedZip) {
        Utils.showToast('처리할 내부 ZIP 파일이 없습니다.', 'warning');
        return;
    }

    Utils.showSection(Elements.progressSection, true);
    Utils.updateProgress(0, '내부 ZIP 파일들을 처리하고 있습니다...');

    try {
        AppState.allProcessedData = {};
        
        for (let i = 0; i < AppState.nestedZipFiles.length; i++) {
            const fileInfo = AppState.nestedZipFiles[i];
            
            Utils.updateProgress((i / AppState.nestedZipFiles.length) * 80, `${fileInfo.filename} 처리 중... (${i + 1}/${AppState.nestedZipFiles.length})`);
            
            // Extract inner ZIP file as Blob
            const innerZipBlob = await AppState.currentNestedZip.files[fileInfo.filename].async('blob');
            const innerZipFile = new File([innerZipBlob], fileInfo.filename, { type: 'application/zip' });
            
            const data = await DataProcessor.processZipFile(innerZipFile, fileInfo.fileId);
            AppState.allProcessedData[fileInfo.fileId] = data;
        }

        Utils.updateProgress(90, '결과 생성 중...');
        
        const mergeMode = document.querySelector('input[name="mergeMode"]:checked').value;
        ResultsManager.displayMultiResults(AppState.allProcessedData, mergeMode);
        
        Utils.updateProgress(100, '완료!');
        Utils.showToast(`${AppState.nestedZipFiles.length}개 내부 파일 처리가 완료되었습니다!`, 'info');

    } catch (error) {
        console.error('중첩 파일 처리 오류:', error);
        Utils.showToast(`파일 처리 중 오류가 발생했습니다: ${error.message}`, 'error');
    } finally {
        setTimeout(() => {
            Utils.showSection(Elements.progressSection, false);
        }, 2000);
    }
}

// Global Functions
function showModeSelection() {
    Utils.showSection(Elements.uploadSection, false);
    Utils.showSection(Elements.resultsSection, false);
    Utils.showSection(Elements.progressSection, false);
    Utils.showSection(Elements.modeSelection, true);
    
    // Clear mode selection
    document.querySelectorAll('.mode-card').forEach(card => {
        card.classList.remove('active');
    });
    
    AppState.currentMode = null;
    ModeManager.clearResults();
}

function clearFiles() {
    AppState.selectedFiles = [];
    FileManager.updateFileList();
    Utils.showToast('파일 목록이 초기화되었습니다.', 'info');
}

function clearNestedFiles() {
    AppState.nestedZipFiles = [];
    AppState.currentNestedZip = null;
    Utils.showSection(Elements.nestedFileStructure, false);
    Elements.nestedFileInput.value = '';
    Utils.showToast('중첩 파일 선택이 초기화되었습니다.', 'info');
}

function showModal(title, body) {
    Elements.modalTitle.textContent = title;
    Elements.modalBody.innerHTML = body;
    Utils.showSection(Elements.modal, true);
}

function closeModal() {
    Utils.showSection(Elements.modal, false);
}

function showGuide() {
    const guideContent = `
        <h4>🎯 사용 가이드</h4>
        <div style="line-height: 1.6;">
            <h5>1. 모드 선택</h5>
            <ul>
                <li><strong>단일 ZIP 파일:</strong> 하나의 Samsung Health ZIP 파일 처리</li>
                <li><strong>다중 ZIP 파일:</strong> 여러 ZIP 파일을 한번에 처리하여 병합</li>
                <li><strong>중첩 ZIP 파일:</strong> ZIP 안에 여러 ZIP이 들어있는 파일 처리</li>
            </ul>
            
            <h5>2. 파일 업로드</h5>
            <ul>
                <li>드래그 앤 드롭 또는 클릭하여 파일 선택</li>
                <li>ZIP 파일만 지원 (최대 100MB)</li>
                <li>Samsung Health 데이터 형식 필요</li>
            </ul>
            
            <h5>3. 처리 옵션 선택</h5>
            <ul>
                <li><strong>파일별 분리:</strong> 각 파일의 데이터를 개별 처리</li>
                <li><strong>타입별 병합:</strong> 같은 데이터 타입끼리 병합 (4개 CSV)</li>
                <li><strong>전체 통합:</strong> 모든 데이터를 하나의 CSV로 통합</li>
                <li><strong>모두 제공:</strong> 위의 모든 옵션 결과 제공</li>
            </ul>
            
            <h5>4. 결과 다운로드</h5>
            <ul>
                <li>개별 CSV 파일 다운로드</li>
                <li>ZIP 파일로 일괄 다운로드</li>
                <li>다운로드가 안 될 경우 대안 다운로드 사용</li>
            </ul>
        </div>
    `;
    showModal('사용 가이드', guideContent);
}

function showAbout() {
    const aboutContent = `
        <h4>ℹ️ 프로그램 정보</h4>
        <div style="line-height: 1.6;">
            <p><strong>Samsung Health 데이터 처리기</strong>는 Samsung Health 앱에서 내보낸 ZIP 파일을 분석하여 CSV 형태로 변환하는 무료 웹 도구입니다.</p>
            
            <h5>🔒 개인정보 보호</h5>
            <ul>
                <li>모든 데이터 처리는 브라우저에서만 이루어집니다</li>
                <li>서버에 데이터가 전송되거나 저장되지 않습니다</li>
                <li>완전히 오프라인에서 작동합니다</li>
            </ul>
            
            <h5>📊 지원 데이터 타입</h5>
            <ul>
                <li><strong>심박수:</strong> 시간별 심박수 측정 데이터</li>
                <li><strong>스트레스:</strong> 스트레스 수준 측정 데이터</li>
                <li><strong>걸음수:</strong> 일일 걸음수 및 칼로리 데이터</li>
                <li><strong>수면:</strong> 수면 시간, 효율성, 수면 단계 데이터</li>
            </ul>
            
            <h5>💻 기술 스택</h5>
            <ul>
                <li>JavaScript (ES6+)</li>
                <li>Papa Parse (CSV 처리)</li>
                <li>JSZip (ZIP 파일 처리)</li>
                <li>HTML5 & CSS3</li>
            </ul>
            
            <h5>🆔 버전 정보</h5>
            <p>Version 2.0.0 - UX Friendly Edition</p>
            <p>© 2025 Samsung Health 데이터 처리기</p>
        </div>
    `;
    showModal('프로그램 정보', aboutContent);
}

// Copy to clipboard helper
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        Utils.showToast('클립보드에 복사되었습니다!', 'info');
    }).catch(() => {
        Utils.showToast('클립보드 복사에 실패했습니다.', 'error');
    });
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Samsung Health 데이터 처리기 초기화 중...');
    
    // Initialize all managers
    ModeManager.init();
    FileManager.init();
    
    // Set up global error handling
    window.addEventListener('error', (event) => {
        console.error('전역 오류:', event.error);
        Utils.showToast('예상치 못한 오류가 발생했습니다.', 'error');
    });
    
    console.log('Samsung Health 데이터 처리기가 준비되었습니다!');
    Utils.showToast('Samsung Health 데이터 처리기에 오신 것을 환영합니다!', 'info');
});