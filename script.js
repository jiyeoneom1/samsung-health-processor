// 상수 정의
const TARGET_COLUMNS = {
    'heart_rate': ['com.samsung.health.heart_rate.start_time', 'com.samsung.health.heart_rate.end_time', 'com.samsung.health.heart_rate.heart_rate', 'com.samsung.health.heart_rate.confidence'],
    'stress': ['com.samsung.health.stress.start_time', 'com.samsung.health.stress.end_time', 'com.samsung.health.stress.score', 'com.samsung.health.stress.level'],
    'step_count': ['com.samsung.health.step_count.start_time', 'com.samsung.health.step_count.end_time', 'com.samsung.health.step_count.count', 'com.samsung.health.step_count.distance'],
    'sleep': ['com.samsung.health.sleep.start_time', 'com.samsung.health.sleep.end_time', 'com.samsung.health.sleep.stage', 'com.samsung.health.sleep.duration']
};

const OUTPUT_COLUMNS = {
    'heart_rate': ['start_time', 'end_time', 'heart_rate', 'confidence'],
    'stress': ['start_time', 'end_time', 'score', 'level'],
    'step_count': ['start_time', 'end_time', 'count', 'distance'],
    'sleep': ['start_time', 'end_time', 'stage', 'duration']
};

// 전역 변수
let selectedFiles = [];
let nestedZipFiles = [];
let currentNestedZip = null;
let currentMode = 'single';
let allProcessedData = {};
let downloadableData = {};

// DOM 요소
const elements = {
    fileInput: document.getElementById('fileInput'),
    multiFileInput: document.getElementById('multiFileInput'),
    nestedFileInput: document.getElementById('nestedFileInput'),
    singleMode: document.getElementById('singleMode'),
    multiMode: document.getElementById('multiMode'),
    nestedMode: document.getElementById('nestedMode'),
    selectedFilesDiv: document.getElementById('selectedFiles'),
    fileList: document.getElementById('fileList'),
    nestedFileStructure: document.getElementById('nestedFileStructure'),
    nestedFileList: document.getElementById('nestedFileList'),
    processingMode: document.getElementById('processingMode'),
    progressContainer: document.querySelector('.progress-container'),
    progressFill: document.querySelector('.progress-fill'),
    progressText: document.getElementById('progressText'),
    status: document.getElementById('status'),
    results: document.getElementById('results'),
    fileResults: document.getElementById('fileResults'),
    downloadSection: document.getElementById('downloadSection'),
    bulkDownload: document.getElementById('bulkDownload')
};

// 유틸리티 함수
function showStatus(message, type = 'info') {
    elements.status.innerHTML = `<div class="status ${type}">${message}</div>`;
}

function updateProgress(percent, text) {
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = text;
}

function showProgress() {
    elements.progressContainer.style.display = 'block';
    updateProgress(0, '처리 시작...');
}

function hideProgress() {
    elements.progressContainer.style.display = 'none';
}

function getDataType(pattern) {
    if (pattern.includes('heart_rate')) return 'heart_rate';
    if (pattern.includes('stress')) return 'stress';
    if (pattern.includes('pedometer_step_count')) return 'step_count';
    if (pattern.includes('sleep')) return 'sleep';
    return 'unknown';
}

function getFileIdentifier(filename) {
    const match = filename.match(/([A-Z0-9]+)\.zip$/i);
    return match ? match[1] : filename.replace('.zip', '');
}

// 파일 처리 함수
async function processZipFile(file, fileId) {
    try {
        const zip = await JSZip.loadAsync(file);
        const csvFiles = {};
        const targetPatterns = [
            'com.samsung.shealth.tracker.heart_rate',
            'com.samsung.shealth.stress',
            'com.samsung.shealth.tracker.pedometer_step_count',
            'com.samsung.shealth.sleep'
        ];

        // CSV 파일 분류
        Object.keys(zip.files).forEach(filename => {
            if (filename.endsWith('.csv')) {
                targetPatterns.forEach(pattern => {
                    if (filename.includes(pattern)) {
                        const type = getDataType(pattern);
                        if (!csvFiles[type]) csvFiles[type] = [];
                        csvFiles[type].push(filename);
                    }
                });
            }
        });

        const processedData = {};

        // 각 데이터 타입별 처리
        for (const dataType in csvFiles) {
            const filenames = csvFiles[dataType];
            if (filenames.length === 0) continue;

            let allRows = [];

            for (const filename of filenames) {
                const csvContent = await zip.files[filename].async('text');
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

                const filteredRows = parsed.data.map(row => {
                    const filteredRow = {};
                    let hasValidData = false;

                    for (let i = 0; i < TARGET_COLUMNS[dataType].length; i++) {
                        const targetCol = TARGET_COLUMNS[dataType][i];
                        const outputCol = OUTPUT_COLUMNS[dataType][i];
                        const value = row[targetCol];

                        if (value !== undefined && value !== null && value !== '') {
                            filteredRow[outputCol] = value;
                            hasValidData = true;
                        } else {
                            filteredRow[outputCol] = null;
                        }
                    }

                    if (hasValidData) {
                        filteredRow.source_file = fileId;
                        return filteredRow;
                    }
                    return null;
                }).filter(Boolean);

                allRows = allRows.concat(filteredRows);
            }

            // 날짜 기준 정렬
            allRows.sort((a, b) => {
                const timeA = new Date(a.start_time || 0);
                const timeB = new Date(b.start_time || 0);
                return timeA - timeB;
            });

            processedData[dataType] = {
                data: allRows,
                fileId: fileId
            };
        }

        return processedData;
    } catch (error) {
        console.error('ZIP 파일 처리 중 오류:', error);
        throw new Error('ZIP 파일 처리 중 오류가 발생했습니다: ' + error.message);
    }
}

// UI 관련 함수
function createDataCard(dataType, data, fileId) {
    const key = `${fileId}_${dataType}`;
    downloadableData[key] = data;

    const card = document.createElement('div');
    card.className = 'file-card';

    const filename = `${fileId}_${dataType}.csv`;
    const rowCount = data.length;
    const fileSize = (new Blob([Papa.unparse(data)]).size / 1024).toFixed(1);

    card.innerHTML = `
        <h3>📄 ${filename}</h3>
        <div class="stats">
            <div class="stat-item">
                <div class="stat-value">${rowCount.toLocaleString()}</div>
                <div>행 수</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${fileSize}KB</div>
                <div>파일 크기</div>
            </div>
        </div>
        <div style="text-align: center; margin: 15px 0;">
            <button class="btn download-btn" onclick="downloadCSV('${dataType}', '${fileId}')" style="margin: 5px;">
                💾 ${filename} 다운로드
            </button>
        </div>
    `;

    elements.fileResults.appendChild(card);
}

function displayResults(allData) {
    elements.fileResults.innerHTML = '';

    for (const fileId in allData) {
        const fileData = allData[fileId];
        for (const dataType in fileData) {
            const data = fileData[dataType].data;
            createDataCard(dataType, data, fileId);
        }
    }

    elements.results.style.display = 'block';
}

// 파일 다운로드 함수
function downloadCSV(dataType, fileId) {
    try {
        const key = `${fileId}_${dataType}`;
        const data = downloadableData[key];

        if (!data) {
            showStatus('다운로드할 데이터를 찾을 수 없습니다.', 'error');
            return;
        }

        const filename = `${fileId}_${dataType}.csv`;
        const csv = '\uFEFF' + Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showStatus('파일 다운로드를 시작했습니다: ' + filename, 'info');
    } catch (error) {
        showStatus('다운로드 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 모드 설정 함수
function setSingleMode() {
    currentMode = 'single';
    elements.singleMode.style.display = 'block';
    elements.multiMode.style.display = 'none';
    elements.nestedMode.style.display = 'none';
    elements.processingMode.style.display = 'none';
    updateModeButtons(0);
    clearResults();
}

function setMultiMode() {
    currentMode = 'multi';
    elements.singleMode.style.display = 'none';
    elements.multiMode.style.display = 'block';
    elements.nestedMode.style.display = 'none';
    elements.processingMode.style.display = 'block';
    updateModeButtons(1);
    clearResults();
}

function setNestedMode() {
    currentMode = 'nested';
    elements.singleMode.style.display = 'none';
    elements.multiMode.style.display = 'none';
    elements.nestedMode.style.display = 'block';
    elements.processingMode.style.display = 'block';
    updateModeButtons(2);
    clearResults();
}

function updateModeButtons(activeIndex) {
    const modes = document.querySelectorAll('.upload-mode');
    modes.forEach((mode, index) => {
        mode.classList.toggle('active', index === activeIndex);
    });
}

function clearResults() {
    elements.results.style.display = 'none';
    elements.fileResults.innerHTML = '';
    elements.downloadSection.style.display = 'none';
    allProcessedData = {};
    downloadableData = {};
    elements.status.innerHTML = '';
}

// 파일 처리 핸들러
async function handleSingleFile(file) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
        showStatus('ZIP 파일만 업로드 가능합니다.', 'error');
        return;
    }

    showProgress();
    showStatus('ZIP 파일을 분석하고 있습니다...', 'info');

    try {
        const fileId = getFileIdentifier(file.name);
        const data = await processZipFile(file, fileId);
        displayResults({[fileId]: data});
        hideProgress();
        showStatus('데이터 처리가 완료되었습니다!', 'info');
    } catch (error) {
        hideProgress();
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    elements.fileInput.addEventListener('change', e => {
        if (e.target.files.length > 0) handleSingleFile(e.target.files[0]);
    });

    elements.multiFileInput.addEventListener('change', e => {
        for (let i = 0; i < e.target.files.length; i++) {
            addFile(e.target.files[i]);
        }
        updateFileList();
    });

    elements.nestedFileInput.addEventListener('change', e => {
        if (e.target.files.length > 0) handleNestedFile(e.target.files[0]);
    });

    // 드래그 앤 드롭 이벤트
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
        e.preventDefault();
        const uploadArea = e.target.closest('.upload-area');
        if (!uploadArea) return;

        const files = e.dataTransfer.files;
        if (currentMode === 'single' && e.target.closest('#singleMode')) {
            if (files.length > 0) handleSingleFile(files[0]);
        } else if (currentMode === 'multi' && e.target.closest('#multiMode')) {
            for (let i = 0; i < files.length; i++) {
                addFile(files[i]);
            }
            updateFileList();
        } else if (currentMode === 'nested' && e.target.closest('#nestedMode')) {
            if (files.length > 0) handleNestedFile(files[0]);
        }
    });
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    setSingleMode();
    setupEventListeners();
}); 