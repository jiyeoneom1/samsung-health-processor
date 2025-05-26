function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
}

function clearFiles() {
    selectedFiles = [];
    updateFileList();
}

function clearNestedFiles() {
    nestedZipFiles = [];
    currentNestedZip = null;
    nestedFileStructure.style.display = 'none';
    nestedFileInput.value = '';
}

function updateFileList() {
    if (selectedFiles.length === 0) {
        selectedFilesDiv.style.display = 'none';
        return;
    }
    
    selectedFilesDiv.style.display = 'block';
    fileList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-name">📁 ${file.name}</span>
            <span class="file-size">${(file.size / 1024 / 1024).toFixed(1)}MB</span>
            <button class="remove-file" onclick="removeFile(${index})">❌</button>
        `;
        fileList.appendChild(fileItem);
    });
}

// 유틸리티 함수들
function showStatus(message, type = 'info') {
    status.innerHTML = `<div class="status ${type}">${message}</div>`;
}

function updateProgress(percent, text) {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
}

function showProgress() {
    progressContainer.style.display = 'block';
    updateProgress(0, '처리 시작...');
}

function hideProgress() {
    progressContainer.style.display = 'none';
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

// 중첩 ZIP 파일 처리
async function handleNestedFile(file) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
        showStatus('ZIP 파일만 업로드 가능합니다.', 'error');
        return;
    }

    showProgress();
    showStatus('중첩 ZIP 파일을 분석하고 있습니다...', 'info');

    try {
        const zip = await JSZip.loadAsync(file);
        updateProgress(30, 'ZIP 구조 분석 중...');

        nestedZipFiles = [];
        currentNestedZip = zip;

        Object.keys(zip.files).forEach(function(filename) {
            if (filename.toLowerCase().endsWith('.zip') && !zip.files[filename].dir) {
                const fileId = getFileIdentifier(filename);
                nestedZipFiles.push({
                    filename: filename,
                    fileId: fileId,
                    size: zip.files[filename]._data ? zip.files[filename]._data.uncompressedSize : 'Unknown'
                });
            }
        });

        updateProgress(60, '내부 ZIP 파일 목록 생성 중...');
        
        if (nestedZipFiles.length === 0) {
            hideProgress();
            showStatus('내부에 ZIP 파일이 발견되지 않았습니다. 일반 ZIP 파일로 처리해보세요.', 'warning');
            return;
        }

        updateNestedFileList();
        updateProgress(100, '완료!');
        setTimeout(hideProgress, 1000);
        
        showStatus(`${nestedZipFiles.length}개의 내부 ZIP 파일을 발견했습니다!`, 'info');

    } catch (error) {
        console.error('중첩 ZIP 처리 중 오류:', error);
        hideProgress();
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    }
}

function updateNestedFileList() {
    nestedFileStructure.style.display = 'block';
    nestedFileList.innerHTML = '';
    
    nestedZipFiles.forEach((fileInfo, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-name">🗜️ ${fileInfo.filename}</span>
            <span class="file-size">ID: ${fileInfo.fileId}</span>
            <span class="file-size">${typeof fileInfo.size === 'number' ? (fileInfo.size / 1024).toFixed(1) + 'KB' : fileInfo.size}</span>
        `;
        nestedFileList.appendChild(fileItem);
    });
}

// 중첩 파일들 처리
async function processNestedFiles() {
    if (nestedZipFiles.length === 0 || !currentNestedZip) {
        showStatus('처리할 내부 ZIP 파일이 없습니다.', 'warning');
        return;
    }

    showProgress();
    showStatus('내부 ZIP 파일들을 처리하고 있습니다...', 'info');

    try {
        allProcessedData = {};
        
        for (let i = 0; i < nestedZipFiles.length; i++) {
            const fileInfo = nestedZipFiles[i];
            
            updateProgress((i / nestedZipFiles.length) * 80, `${fileInfo.filename} 처리 중... (${i + 1}/${nestedZipFiles.length})`);
            
            const innerZipBlob = await currentNestedZip.files[fileInfo.filename].async('blob');
            const innerZipFile = new File([innerZipBlob], fileInfo.filename, { type: 'application/zip' });
            
            const data = await processZipFile(innerZipFile, fileInfo.fileId);
            allProcessedData[fileInfo.fileId] = data;
        }

        updateProgress(90, '결과 생성 중...');
        
        const mergeMode = document.querySelector('input[name="mergeMode"]:checked').value;
        displayMultiResults(allProcessedData, mergeMode);
        
        updateProgress(100, '완료!');
        setTimeout(hideProgress, 2000);
        showStatus(`${nestedZipFiles.length}개 내부 파일 처리가 완료되었습니다!`, 'info');

    } catch (error) {
        console.error('중첩 파일 처리 중 오류:', error);
        hideProgress();
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 단일 파일 처리
async function handleSingleFile(file) {
    showProgress();
    showStatus('ZIP 파일을 분석하고 있습니다...', 'info');

    try {
        const fileId = getFileIdentifier(file.name);
        
        updateProgress(30, '원본 데이터 분석 중...');
        const data = await processZipFileWithValidation(file, fileId);  // 이 줄이 핵심!
        
        updateProgress(90, '검증 완료, 결과 표시 중...');
        displayResults({[fileId]: data});
        
        hideProgress();
        
        // 검증 결과에 따른 상태 메시지
        const validation = data._validation;
        if (validation && validation.summary.validationPassed) {
            showStatus('✅ 데이터 처리 및 검증이 완료되었습니다!', 'info');
        } else {
            showStatus('⚠️ 데이터 처리는 완료되었으나 일부 문제가 발견되었습니다. 검증 보고서를 확인하세요.', 'warning');
        }
        
    } catch (error) {
        hideProgress();
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    }
}
// 다중 파일 처리
async function processMultipleFiles() {
    if (selectedFiles.length === 0) {
        showStatus('처리할 파일을 선택해주세요.', 'warning');
        return;
    }

    showProgress();
    showStatus('여러 ZIP 파일을 처리하고 있습니다...', 'info');

    try {
        allProcessedData = {};
        
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const fileId = getFileIdentifier(file.name);
            
            updateProgress((i / selectedFiles.length) * 80, `${file.name} 처리 중... (${i + 1}/${selectedFiles.length})`);
            
            // 검증 시스템과 함께 처리
            const data = await processZipFileWithValidation(file, fileId);
            allProcessedData[fileId] = data;
        }

        updateProgress(90, '검증 완료, 결과 표시 중...');
        const mergeMode = document.querySelector('input[name="mergeMode"]:checked').value;
        displayMultiResults(allProcessedData, mergeMode);
        
        hideProgress();
        
        // 전체 검증 결과 요약
        let totalIssues = 0;
        let allPassed = true;
        
        for (const fileId in allProcessedData) {
            const validation = allProcessedData[fileId]._validation;
            if (validation && !validation.summary.validationPassed) {
                allPassed = false;
                totalIssues += validation.summary.issues.length;
            }
        }
        
        if (allPassed) {
            showStatus(`✅ ${selectedFiles.length}개 파일 처리 및 검증이 모두 완료되었습니다!`, 'info');
        } else {
            showStatus(`⚠️ ${selectedFiles.length}개 파일 처리는 완료되었으나 ${totalIssues}개의 문제가 발견되었습니다.`, 'warning');
        }
        
    } catch (error) {
        hideProgress();
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    }
}
// ZIP 파일 처리 핵심 함수
async function processZipFile(file, fileId) {
    const zip = await JSZip.loadAsync(file);
    
    var csvFiles = {};
    var targetPatterns = [
        'com.samsung.shealth.tracker.heart_rate',
        'com.samsung.shealth.stress', 
        'com.samsung.shealth.tracker.pedometer_step_count',
        'com.samsung.shealth.sleep'
    ];

    Object.keys(zip.files).forEach(function(filename) {
        if (filename.endsWith('.csv')) {
            targetPatterns.forEach(function(pattern) {
                if (filename.includes(pattern)) {
                    var type = getDataType(pattern);
                    if (!csvFiles[type]) csvFiles[type] = [];
                    csvFiles[type].push(filename);
                }
            });
        }
    });
    
    var processedData = {};

    for (var dataType in csvFiles) {
        var filenames = csvFiles[dataType];
        if (filenames.length === 0) continue;
        
        var allRows = [];
        
        for (var f = 0; f < filenames.length; f++) {
            var filename = filenames[f];
            var csvContent = await zip.files[filename].async('text');
            
            var lines = csvContent.split('\n');
            var dataLines = lines.slice(1);
            var cleanedCsv = dataLines.join('\n');
            
            var parsed = Papa.parse(cleanedCsv, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                delimiter: ',',
                quoteChar: '"'
            });
            
            var filteredRows = [];
            for (var r = 0; r < parsed.data.length; r++) {
                var row = parsed.data[r];
                var filteredRow = {};
                var hasValidData = false;
                
                for (var c = 0; c < TARGET_COLUMNS[dataType].length; c++) {
                    var col = TARGET_COLUMNS[dataType][c];
                    var outputCol = OUTPUT_COLUMNS[dataType][c];
                    var value = row[col] || '';
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
        
        allRows.sort(function(a, b) {
            var timeA = new Date(a.start_time);
            var timeB = new Date(b.start_time);
            return timeA - timeB;
        });
        
        processedData[dataType] = {
            data: allRows,
            fileId: fileId
        };
    }

    return processedData;
}

// 단일 결과 표시
function displayResults(allData) {
    fileResults.innerHTML = '';
    
    for (var fileId in allData) {
        var fileData = allData[fileId];
        
        for (var dataType in fileData) {
            var result = fileData[dataType];
            var data = result.data;
            createDataCard(dataType, data, fileId);
        }
    }
    
    results.style.display = 'block';
}

// 다중 결과 표시
function displayMultiResults(allData, mergeMode) {
    fileResults.innerHTML = '';
    
    if (mergeMode === 'separate' || mergeMode === 'both') {
        for (var fileId in allData) {
            var fileData = allData[fileId];
            
            const fileSection = document.createElement('div');
            fileSection.innerHTML = `<h3 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">📁 ${fileId} 파일</h3>`;
            fileResults.appendChild(fileSection);
            
            for (var dataType in fileData) {
                var result = fileData[dataType];
                var data = result.data;
                createDataCard(dataType, data, fileId);
            }
        }
    }
    
    if (mergeMode === 'merge' || mergeMode === 'both') {
        const mergedData = mergeAllData(allData);
        
        if (mergeMode === 'both') {
            const mergeSection = document.createElement('div');
            mergeSection.innerHTML = `<h3 style="color: #2c3e50; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">🔗 데이터 타입별 병합</h3>`;
            fileResults.appendChild(mergeSection);
        }
        
        for (var dataType in mergedData) {
            var data = mergedData[dataType];
            createDataCard(dataType, data, 'merged_all');
        }
        
        createBulkDownloadSection(mergedData);
    }
    
    if (mergeMode === 'unified' || mergeMode === 'both') {
        const unifiedData = createUnifiedData(allData);
        
        if (mergeMode === 'both') {
            const unifiedSection = document.createElement('div');
            unifiedSection.innerHTML = `<h3 style="color: #2c3e50; border-bottom: 2px solid #9b59b6; padding-bottom: 10px;">🎯 전체 통합 데이터</h3>`;
            fileResults.appendChild(unifiedSection);
        }
        
        createDataCard('unified', unifiedData, 'all_types');
        
        const unifiedDownloadBtn = document.createElement('button');
        unifiedDownloadBtn.className = 'btn download-btn';
        unifiedDownloadBtn.style.margin = '20px auto';
        unifiedDownloadBtn.style.display = 'block';
        unifiedDownloadBtn.innerHTML = '📊 all_types_unified.csv 다운로드 (' + unifiedData.length.toLocaleString() + '행)';
        unifiedDownloadBtn.onclick = function() { 
            downloadableData['all_types_unified'] = unifiedData;
            downloadCSVSafe('unified', 'all_types'); 
        };
        fileResults.appendChild(unifiedDownloadBtn);
    }
    
    results.style.display = 'block';
}

// 모든 데이터 병합
function mergeAllData(allData) {
    var merged = {};
    
    for (var fileId in allData) {
        var fileData = allData[fileId];
        
        for (var dataType in fileData) {
            if (!merged[dataType]) {
                merged[dataType] = [];
            }
            merged[dataType] = merged[dataType].concat(fileData[dataType].data);
        }
    }
    
    for (var dataType in merged) {
        merged[dataType].sort(function(a, b) {
            var timeA = new Date(a.start_time);
            var timeB = new Date(b.start_time);
            return timeA - timeB;
        });
    }
    
    return merged;
}

// 모든 타입을 하나의 통합 데이터로 생성
function createUnifiedData(allData) {
    var unifiedData = [];
    
    for (var fileId in allData) {
        var fileData = allData[fileId];
        
        for (var dataType in fileData) {
            var data = fileData[dataType].data;
            
            data.forEach(function(row) {
                var unifiedRow = {
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
    
    unifiedData.sort(function(a, b) {
        var timeA = new Date(a.start_time);
        var timeB = new Date(b.start_time);
        return timeA - timeB;
    });
    
    return unifiedData;
}

// 데이터 카드 생성
function createDataCard(dataType, data, fileId) {
    var key = fileId + '_' + dataType;
    downloadableData[key] = data;
    
    var card = document.createElement('div');
    card.className = 'file-card';
    
    var filename = fileId + '_' + dataType + '.csv';
    var rowCount = data.length;
    
    var columnCount;
    if (dataType === 'unified') {
        columnCount = 9;
    } else {
        columnCount = OUTPUT_COLUMNS[dataType].length + (fileId !== 'merged_all' ? 1 : 0);
    }
    
    var preview = data.slice(0, 3);
    
    var tableHtml = '';
    if (data.length > 0) {
        tableHtml = '<table><thead><tr>';
        
        if (dataType === 'unified') {
            var unifiedHeaders = ['data_type', 'source_file', 'start_time', 'end_time', 'value1', 'value2', 'value3', 'value4', 'value5', 'value6'];
            unifiedHeaders.forEach(function(header) {
                tableHtml += '<th>' + header + '</th>';
            });
        } else {
            for (var c = 0; c < OUTPUT_COLUMNS[dataType].length; c++) {
                tableHtml += '<th>' + OUTPUT_COLUMNS[dataType][c] + '</th>';
            }
            if (fileId === 'merged_all') {
                tableHtml += '<th>source_file</th>';
            }
        }
        tableHtml += '</tr></thead><tbody>';
        
        for (var r = 0; r < preview.length; r++) {
            tableHtml += '<tr>';
            if (dataType === 'unified') {
                var unifiedHeaders = ['data_type', 'source_file', 'start_time', 'end_time', 'value1', 'value2', 'value3', 'value4', 'value5', 'value6'];
                unifiedHeaders.forEach(function(header) {
                    tableHtml += '<td>' + (preview[r][header] || '') + '</td>';
                });
            } else {
                for (var c = 0; c < OUTPUT_COLUMNS[dataType].length; c++) {
                    var col = OUTPUT_COLUMNS[dataType][c];
                    tableHtml += '<td>' + (preview[r][col] || '') + '</td>';
                }
                if (fileId === 'merged_all') {
                    tableHtml += '<td>' + (preview[r].source_file || '') + '</td>';
                }
            }
            tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table>';
    }
    
    var descriptionHtml = '';
    if (dataType === 'unified') {
        var typeCounts = {};
        data.forEach(function(row) {
            typeCounts[row.data_type] = (typeCounts[row.data_type] || 0) + 1;
        });
        
        descriptionHtml = '<div style="background: #e8f4fd; border: 1px solid #0984e3; border-radius: 5px; padding: 10px; margin: 10px 0;">' +
            '<strong>📊 통합 데이터 구성:</strong><br>';
        for (var type in typeCounts) {
            descriptionHtml += '• ' + type + ': ' + typeCounts[type].toLocaleString() + '행<br>';
        }
        descriptionHtml += '<small style="color: #666;">value1-6: 각 데이터 타입별 주요 값들이 매핑됨</small></div>';
    }
    
    card.innerHTML = 
        '<h3>📄 ' + filename + '</h3>' +
        descriptionHtml +
        '<div class="stats">' +
            '<div class="stat-item"><div class="stat-value">' + rowCount.toLocaleString() + '</div><div>행 수</div></div>' +
            '<div class="stat-item"><div class="stat-value">' + columnCount + '</div><div>컬럼 수</div></div>' +
            '<div class="stat-item"><div class="stat-value">' + (new Blob([Papa.unparse(data)]).size / 1024).toFixed(1) + 'KB</div><div>파일 크기</div></div>' +
        '</div>' +
        '<details><summary>📋 데이터 미리보기 (처음 3행)</summary>' +
            '<div style="overflow-x: auto; margin-top: 10px;">' + tableHtml + '</div>' +
        '</details>' +
        '<button class="btn download-btn" onclick="downloadCSVSafe(\'' + dataType + '\', \'' + fileId + '\')">' +
            '💾 ' + filename + ' 다운로드' +
        '</button>';
    
    fileResults.appendChild(card);
}

// 일괄 다운로드 섹션 생성
function createBulkDownloadSection(mergedData) {
    downloadSection.style.display = 'block';
    bulkDownload.innerHTML = '';
    
    for (var dataType in mergedData) {
        var data = mergedData[dataType];
        var key = 'merged_all_' + dataType;
        downloadableData[key] = data;
        
        var button = document.createElement('button');
        button.className = 'btn download-btn';
        button.innerHTML = '💾 merged_all_' + dataType + '.csv (' + data.length.toLocaleString() + '행)';
        button.onclick = function(dt, k) {
            return function() { 
                downloadCSV(dt, downloadableData[k], 'merged_all'); 
            };
        }(dataType, key);
        bulkDownload.appendChild(button);
    }
    
    var zipButton = document.createElement('button');
    zipButton.className = 'btn';
    zipButton.style.background = 'linear-gradient(45deg, #9b59b6, #8e44ad)';
    zipButton.innerHTML = '📦 전체 CSV 파일 ZIP으로 다운로드';
    zipButton.onclick = function() { downloadAllAsZip(mergedData); };
    bulkDownload.appendChild(zipButton);
}

// CSV 다운로드 함수 (개선된 버전)
function downloadCSV(dataType, data, fileId) {
    try {
        var filename = fileId + '_' + dataType + '.csv';
        console.log('다운로드 시작:', filename);
        
        if (!data || data.length === 0) {
            showStatus('다운로드할 데이터가 없습니다.', 'warning');
            return;
        }
        
        // CSV 데이터 생성 (BOM 추가로 한글 지원)
        var csv = '\uFEFF' + Papa.unparse(data);
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        
        // 다운로드 링크 생성
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        showStatus('파일 다운로드를 시작했습니다: ' + filename, 'info');
        
        // 브라우저에서 다운로드가 차단된 경우를 위한 대안
        setTimeout(() => {
            showAlternativeDownload(csv, filename);
        }, 2000);
        
    } catch (error) {
        console.error('다운로드 오류:', error);
        showStatus('다운로드 중 오류가 발생했습니다: ' + error.message, 'error');
        showAlternativeDownload(Papa.unparse(data), filename);
    }
}

// 안전한 CSV 다운로드 함수
function downloadCSVSafe(dataType, fileId) {
    try {
        var key = fileId + '_' + dataType;
        var data = downloadableData[key];
        
        if (!data) {
            console.error('다운로드 데이터를 찾을 수 없습니다:', key);
            showStatus('다운로드할 데이터를 찾을 수 없습니다.', 'error');
            return;
        }
        
        downloadCSV(dataType, data, fileId);
    } catch (error) {
        console.error('다운로드 오류:', error);
        showStatus('다운로드 중 오류가 발생했습니다.', 'error');
    }
}

// 대안 다운로드 방법
function showAlternativeDownload(csv, filename) {
    var modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
        align-items: center; justify-content: center;
    `;
    
    var content = document.createElement('div');
    content.style.cssText = `
        background: white; padding: 30px; border-radius: 15px;
        max-width: 90%; max-height: 80%; overflow: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    `;
    
    content.innerHTML = `
        <h3 style="color: #2c3e50; margin-bottom: 15px;">📄 ${filename} 데이터</h3>
        <p style="color: #666; margin-bottom: 15px;">다운로드가 차단된 경우, 아래 방법을 이용하세요:</p>
        <div style="margin: 20px 0;">
            <button onclick="copyToClipboard('${csv.replace(/'/g, "\\'")}'); showStatus('클립보드에 복사되었습니다!', 'info');" 
                    style="padding: 12px 20px; background: #27ae60; color: white; border: none; border-radius: 8px; margin-right: 10px; cursor: pointer;">
                📋 클립보드에 복사
            </button>
            <button onclick="downloadAsDataURL('${csv.replace(/'/g, "\\'")}', '${filename}');" 
                    style="padding: 12px 20px; background: #3498db; color: white; border: none; border-radius: 8px; margin-right: 10px; cursor: pointer;">
                💾 강제 다운로드
            </button>
            <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                    style="padding: 12px 20px; background: #95a5a6; color: white; border: none; border-radius: 8px; cursor: pointer;">
                ❌ 닫기
            </button>
        </div>
        <details>
            <summary style="cursor: pointer; color: #666;">📝 수동 복사 (클릭하여 펼치기)</summary>
            <textarea readonly style="width: 100%; height: 200px; margin-top: 10px; font-family: monospace; font-size: 12px; border: 2px solid #dee2e6; border-radius: 5px; padding: 10px;">${csv}</textarea>
        </details>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    };
}

// 클립보드 복사 함수
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log('클립보드에 복사됨');
    }).catch(() => {
        // 폴백: 임시 텍스트 영역 생성
        var textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    });
}

// 데이터 URL 다운로드
function downloadAsDataURL(csv, filename) {
    var dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    var link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
}

// 전체 ZIP 다운로드 함수
async function downloadAllAsZip(mergedData) {
    try {
        showStatus('ZIP 파일을 생성하고 있습니다...', 'info');
        
        var zip = new JSZip();
        
        for (var dataType in mergedData) {
            var data = mergedData[dataType];
            var csv = '\uFEFF' + Papa.unparse(data);
            var filename = 'merged_all_' + dataType + '.csv';
            zip.file(filename, csv);
        }
        
        // README 파일 추가
        var readme = '# Samsung Health 병합 데이터\n\n' +
                   '생성일: ' + new Date().toLocaleString('ko-KR') + '\n' +
                   '처리된 파일 수: ' + Object.keys(allProcessedData).length + '\n' +
                   '포함된 데이터 타입:\n';
        
        for (var dataType in mergedData) {
            readme += '- ' + dataType + ': ' + mergedData[dataType].length.toLocaleString() + '행\n';
        }
        
        readme += '\n## 컬럼 설명\n';
        for (var dataType in OUTPUT_COLUMNS) {
            if (mergedData[dataType]) {
                readme += '\n### ' + dataType + '\n';
                for (var i = 0; i < OUTPUT_COLUMNS[dataType].length; i++) {
                    readme += '- ' + OUTPUT_COLUMNS[dataType][i] + '\n';
                }
                readme += '- source_file: 원본 파일 식별자\n';
            }
        }
        
        zip.file('README.md', readme);
        
        var content = await zip.generateAsync({type: 'blob'});
        
        var link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'samsung_health_merged_' + new Date().toISOString().slice(0,10) + '.zip';
        link.click();
        
        showStatus('ZIP 파일 다운로드가 시작되었습니다!', 'info');
        
    } catch (error) {
        console.error('ZIP 생성 오류:', error);
        showStatus('ZIP 파일 생성 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 드래그 앤 드롭 이벤트 리스너
document.addEventListener('DOMContentLoaded', function() {
    // 초기 모드 설정
    setSingleMode();
    
    // 드래그 앤 드롭 설정
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
    });

    document.addEventListener('drop', function(e) {
        e.preventDefault();
        
        var uploadArea = e.target.closest('.upload-area');
        if (!uploadArea) return;
        
        var files = e.dataTransfer.files;
        
        if (currentMode === 'single' && e.target.closest('#singleMode')) {
            if (files.length > 0) {
                handleSingleFile(files[0]);
            }
        } else if (currentMode === 'multi' && e.target.closest('#multiMode')) {
            for (var i = 0; i < files.length; i++) {
                addFile(files[i]);
            }
            updateFileList();
        } else if (currentMode === 'nested' && e.target.closest('#nestedMode')) {
            if (files.length > 0) {
                handleNestedFile(files[0]);
            }
        }
    });
    
    // 드래그 오버 효과
    document.addEventListener('dragenter', function(e) {
        var uploadArea = e.target.closest('.upload-area');
        if (uploadArea) {
            uploadArea.classList.add('dragover');
        }
    });
    
    document.addEventListener('dragleave', function(e) {
        var uploadArea = e.target.closest('.upload-area');
        if (uploadArea && !uploadArea.contains(e.relatedTarget)) {
            uploadArea.classList.remove('dragover');
        }
    });
})

// 전역 변수들
const TARGET_COLUMNS = {
    'heart_rate': ['com.samsung.health.heart_rate.start_time', 'com.samsung.health.heart_rate.end_time', 'com.samsung.health.heart_rate.max', 'com.samsung.health.heart_rate.min', 'com.samsung.health.heart_rate.heart_rate'],
    'stress': ['start_time', 'end_time', 'max', 'min', 'score'],
    'step_count': ['com.samsung.health.step_count.start_time', 'com.samsung.health.step_count.end_time', 'com.samsung.health.step_count.count', 'com.samsung.health.step_count.calorie'],
    'sleep': ['com.samsung.health.sleep.start_time', 'com.samsung.health.sleep.end_time', 'sleep_score', 'sleep_duration', 'efficiency', 'total_rem_duration', 'total_light_duration', 'sleep_cycle']
};

const OUTPUT_COLUMNS = {
    'heart_rate': ['start_time', 'end_time', 'max', 'min', 'heart_rate'],
    'stress': ['start_time', 'end_time', 'max', 'min', 'score'],
    'step_count': ['start_time', 'end_time', 'count', 'calorie'],
    'sleep': ['start_time', 'end_time', 'sleep_score', 'sleep_duration', 'efficiency', 'total_rem_duration', 'total_light_duration', 'sleep_cycle']
};

let selectedFiles = [];
let nestedZipFiles = [];
let currentNestedZip = null;
let currentMode = null;
let allProcessedData = {};
let downloadableData = {};

// DOM 요소들
const fileInput = document.getElementById('fileInput');
const multiFileInput = document.getElementById('multiFileInput');
const nestedFileInput = document.getElementById('nestedFileInput');
const singleMode = document.getElementById('singleMode');
const multiMode = document.getElementById('multiMode');
const nestedMode = document.getElementById('nestedMode');
const selectedFilesDiv = document.getElementById('selectedFiles');
const fileList = document.getElementById('fileList');
const nestedFileStructure = document.getElementById('nestedFileStructure');
const nestedFileList = document.getElementById('nestedFileList');
const processingMode = document.getElementById('processingMode');
const progressContainer = document.querySelector('.progress-container');
const progressFill = document.querySelector('.progress-fill');
const progressText = document.getElementById('progressText');
const status = document.getElementById('status');
const results = document.getElementById('results');
const fileResults = document.getElementById('fileResults');
const downloadSection = document.getElementById('downloadSection');
const bulkDownload = document.getElementById('bulkDownload');

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    setSingleMode();
    setupEventListeners();
});

// 이벤트 리스너 설정
function setupEventListeners() {
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) handleSingleFile(e.target.files[0]);
    });

    multiFileInput.addEventListener('change', function(e) {
        for (let i = 0; i < e.target.files.length; i++) {
            addFile(e.target.files[i]);
        }
        updateFileList();
    });

    nestedFileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) handleNestedFile(e.target.files[0]);
    });
}

// 모드 설정 함수들
function setSingleMode() {
    currentMode = 'single';
    singleMode.style.display = 'block';
    multiMode.style.display = 'none';
    nestedMode.style.display = 'none';
    processingMode.style.display = 'none';
    updateModeButtons(0);
    clearResults();
}

function setMultiMode() {
    currentMode = 'multi';
    singleMode.style.display = 'none';
    multiMode.style.display = 'block';
    nestedMode.style.display = 'none';
    processingMode.style.display = 'block';
    updateModeButtons(1);
    clearResults();
}

function setNestedMode() {
    currentMode = 'nested';
    singleMode.style.display = 'none';
    multiMode.style.display = 'none';
    nestedMode.style.display = 'block';
    processingMode.style.display = 'block';
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
    results.style.display = 'none';
    fileResults.innerHTML = '';
    downloadSection.style.display = 'none';
    allProcessedData = {};
    downloadableData = {};
    status.innerHTML = '';
}

// 파일 관리
function addFile(file) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
        showStatus('ZIP 파일만 업로드 가능합니다: ' + file.name, 'error');
        return;
    }
    
    const exists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
    if (exists) {
        showStatus('이미 추가된 파일입니다: ' + file.name, 'warning');
        return;
    }
    
    selectedFiles.push(file);
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
}

function clearFiles() {
    selectedFiles = [];
    updateFileList();
}

function updateFileList() {
    if (selectedFiles.length === 0) {
        selectedFilesDiv.style.display = 'none';
        return;
    }
    
    selectedFilesDiv.style.display = 'block';
    fileList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-name">📁 ${file.name}</span>
            <span class="file-size">${(file.size / 1024 / 1024).toFixed(1)}MB</span>
            <button class="remove-file" onclick="removeFile(${index})">❌</button>
        `;
        fileList.appendChild(fileItem);
    });
}

// 유틸리티 함수들
function showStatus(message, type = 'info') {
    status.innerHTML = `<div class="status ${type}">${message}</div>`;
}

function updateProgress(percent, text) {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
}

function showProgress() {
    progressContainer.style.display = 'block';
    updateProgress(0, '처리 시작...');
}

function hideProgress() {
    progressContainer.style.display = 'none';
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

// 중첩 ZIP 파일 처리
async function handleNestedFile(file) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
        showStatus('ZIP 파일만 업로드 가능합니다.', 'error');
        return;
    }

    showProgress();
    showStatus('중첩 ZIP 파일을 분석하고 있습니다...', 'info');

    try {
        const zip = await JSZip.loadAsync(file);
        nestedZipFiles = [];
        currentNestedZip = zip;

        Object.keys(zip.files).forEach(function(filename) {
            if (filename.toLowerCase().endsWith('.zip') && !zip.files[filename].dir) {
                const fileId = getFileIdentifier(filename);
                nestedZipFiles.push({
                    filename: filename,
                    fileId: fileId,
                    size: 'Unknown'
                });
            }
        });

        if (nestedZipFiles.length === 0) {
            hideProgress();
            showStatus('내부에 ZIP 파일이 발견되지 않았습니다.', 'warning');
            return;
        }

        updateNestedFileList();
        hideProgress();
        showStatus(`${nestedZipFiles.length}개의 내부 ZIP 파일을 발견했습니다!`, 'info');

    } catch (error) {
        hideProgress();
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    }
}

function updateNestedFileList() {
    nestedFileStructure.style.display = 'block';
    nestedFileList.innerHTML = '';
    
    nestedZipFiles.forEach((fileInfo) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-name">🗜️ ${fileInfo.filename}</span>
            <span class="file-size">ID: ${fileInfo.fileId}</span>
        `;
        nestedFileList.appendChild(fileItem);
    });
}

function clearNestedFiles() {
    nestedZipFiles = [];
    currentNestedZip = null;
    nestedFileStructure.style.display = 'none';
    nestedFileInput.value = '';
}

// 파일 처리 함수들
async function handleSingleFile(file) {
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

async function processMultipleFiles() {
    if (selectedFiles.length === 0) {
        showStatus('처리할 파일을 선택해주세요.', 'warning');
        return;
    }

    showProgress();
    showStatus('여러 ZIP 파일을 처리하고 있습니다...', 'info');

    try {
        allProcessedData = {};
        
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const fileId = getFileIdentifier(file.name);
            
            updateProgress((i / selectedFiles.length) * 80, `${file.name} 처리 중... (${i + 1}/${selectedFiles.length})`);
            
            const data = await processZipFile(file, fileId);
            allProcessedData[fileId] = data;
        }

        const mergeMode = document.querySelector('input[name="mergeMode"]:checked').value;
        displayMultiResults(allProcessedData, mergeMode);
        
        hideProgress();
        showStatus(`${selectedFiles.length}개 파일 처리가 완료되었습니다!`, 'info');
    } catch (error) {
        hideProgress();
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    }
}

async function processNestedFiles() {
    if (nestedZipFiles.length === 0) {
        showStatus('처리할 내부 ZIP 파일이 없습니다.', 'warning');
        return;
    }

    showProgress();
    showStatus('내부 ZIP 파일들을 처리하고 있습니다...', 'info');

    try {
        allProcessedData = {};
        
        for (let i = 0; i < nestedZipFiles.length; i++) {
            const fileInfo = nestedZipFiles[i];
            
            updateProgress((i / nestedZipFiles.length) * 80, `${fileInfo.filename} 처리 중... (${i + 1}/${nestedZipFiles.length})`);
            
            const innerZipBlob = await currentNestedZip.files[fileInfo.filename].async('blob');
            const innerZipFile = new File([innerZipBlob], fileInfo.filename, { type: 'application/zip' });
            
            // 검증 시스템과 함께 처리
            const data = await processZipFileWithValidation(innerZipFile, fileInfo.fileId);
            allProcessedData[fileInfo.fileId] = data;
        }

        updateProgress(90, '검증 완료, 결과 표시 중...');
        const mergeMode = document.querySelector('input[name="mergeMode"]:checked').value;
        displayMultiResults(allProcessedData, mergeMode);
        
        hideProgress();
        
        // 전체 검증 결과 요약
        let totalIssues = 0;
        let allPassed = true;
        
        for (const fileId in allProcessedData) {
            const validation = allProcessedData[fileId]._validation;
            if (validation && !validation.summary.validationPassed) {
                allPassed = false;
                totalIssues += validation.summary.issues.length;
            }
        }
        
        if (allPassed) {
            showStatus(`✅ ${nestedZipFiles.length}개 내부 파일 처리 및 검증이 모두 완료되었습니다!`, 'info');
        } else {
            showStatus(`⚠️ ${nestedZipFiles.length}개 내부 파일 처리는 완료되었으나 ${totalIssues}개의 문제가 발견되었습니다.`, 'warning');
        }
        
    } catch (error) {
        hideProgress();
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    }
}


// ZIP 파일 처리 핵심 함수
async function processZipFile(file, fileId) {
    const zip = await JSZip.loadAsync(file);
    
    const csvFiles = {};
    const targetPatterns = [
        'com.samsung.shealth.tracker.heart_rate',
        'com.samsung.shealth.stress', 
        'com.samsung.shealth.tracker.pedometer_step_count',
        'com.samsung.shealth.sleep'
    ];

    Object.keys(zip.files).forEach(function(filename) {
        if (filename.endsWith('.csv')) {
            targetPatterns.forEach(function(pattern) {
                if (filename.includes(pattern)) {
                    const type = getDataType(pattern);
                    if (!csvFiles[type]) csvFiles[type] = [];
                    csvFiles[type].push(filename);
                }
            });
        }
    });
    
    const processedData = {};

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
            
            const filteredRows = [];
            for (const row of parsed.data) {
                const filteredRow = {};
                let hasValidData = false;
                
                for (let c = 0; c < TARGET_COLUMNS[dataType].length; c++) {
                    const col = TARGET_COLUMNS[dataType][c];
                    const outputCol = OUTPUT_COLUMNS[dataType][c];
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
        
        allRows.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
        processedData[dataType] = {
            data: allRows,
            fileId: fileId
        };
    }

    return processedData;
}

// 결과 표시
function displayResults(allData) {
    fileResults.innerHTML = '';
    
    for (const fileId in allData) {
        const fileData = allData[fileId];
        
        for (const dataType in fileData) {
            const data = fileData[dataType].data;
            createDataCard(dataType, data, fileId);
        }
    }
    
    results.style.display = 'block';
}

function displayMultiResults(allData, mergeMode) {
    fileResults.innerHTML = '';
    
    if (mergeMode === 'separate' || mergeMode === 'both') {
        for (const fileId in allData) {
            const fileData = allData[fileId];
            
            const fileSection = document.createElement('div');
            fileSection.innerHTML = `<h3 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">📁 ${fileId} 파일</h3>`;
            fileResults.appendChild(fileSection);
            
            for (const dataType in fileData) {
                const data = fileData[dataType].data;
                createDataCard(dataType, data, fileId);
            }
        }
    }
    
    if (mergeMode === 'merge' || mergeMode === 'both' || mergeMode === 'unified') {
        const mergedData = mergeAllData(allData);
        
        if (mergeMode === 'unified') {
            const unifiedData = createUnifiedData(allData);
            createDataCard('unified', unifiedData, 'all_types');
        } else {
            for (const dataType in mergedData) {
                const data = mergedData[dataType];
                createDataCard(dataType, data, 'merged_all');
            }
        }
    }
    
    results.style.display = 'block';
}

function mergeAllData(allData) {
    const merged = {};
    
    for (const fileId in allData) {
        const fileData = allData[fileId];
        
        for (const dataType in fileData) {
            if (!merged[dataType]) merged[dataType] = [];
            merged[dataType] = merged[dataType].concat(fileData[dataType].data);
        }
    }
    
    for (const dataType in merged) {
        merged[dataType].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    }
    
    return merged;
}

function createUnifiedData(allData) {
    const unifiedData = [];
    
    for (const fileId in allData) {
        const fileData = allData[fileId];
        
        for (const dataType in fileData) {
            const data = fileData[dataType].data;
            
            data.forEach(function(row) {
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
                    value6: row.sleep_cycle || ''
                };
                unifiedData.push(unifiedRow);
            });
        }
    }
    
    unifiedData.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    return unifiedData;
}

// 데이터 카드 생성

function createDataCard(dataType, data, fileId) {
    const key = fileId + '_' + dataType;
    downloadableData[key] = data;
    
    const card = document.createElement('div');
    card.className = 'file-card';
    
    const filename = fileId + '_' + dataType + '.csv';
    const rowCount = data.length;
    
    // 검증 정보 표시 (만약 있다면)
    let validationHtml = '';
    if (allProcessedData[fileId] && allProcessedData[fileId]._validation) {
        const validation = allProcessedData[fileId]._validation.detailedResults[dataType];
        if (validation) {
            const statusIcon = validation.passed ? '✅' : '⚠️';
            const statusColor = validation.passed ? '#27ae60' : '#f39c12';
            const statusText = validation.passed ? '검증 통과' : '문제 발견';
            
            validationHtml = `
                <div style="background: ${statusColor}20; border: 1px solid ${statusColor}; border-radius: 5px; padding: 10px; margin: 10px 0;">
                    <strong>${statusIcon} ${statusText}</strong>
                    ${validation.issues.length > 0 ? `<br><small>문제: ${validation.issues.join(', ')}</small>` : ''}
                    <br><small>원본: ${validation.originalRows}행 → 처리: ${validation.processedRows}행</small>
                    ${validation.duplicateCheck.duplicateCount > 0 ? `<br><small>⚠️ 중복 데이터: ${validation.duplicateCheck.duplicateCount}개</small>` : ''}
                </div>
            `;
        }
    }
    
    card.innerHTML = `
        <h3>📄 ${filename}</h3>
        ${validationHtml}
        <div class="stats">
            <div class="stat-item">
                <div class="stat-value">${rowCount.toLocaleString()}</div>
                <div>행 수</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${(new Blob([Papa.unparse(data)]).size / 1024).toFixed(1)}KB</div>
                <div>파일 크기</div>
            </div>
        </div>
        <div style="text-align: center; margin: 15px 0;">
            <button class="btn download-btn" onclick="downloadCSV('${dataType}', '${fileId}')" style="margin: 5px;">
                💾 ${filename} 다운로드
            </button>
            ${fileId !== 'merged_all' && fileId !== 'all_types' ? `
                <button class="btn" onclick="displayValidationReport('${fileId}')" style="background: linear-gradient(45deg, #9b59b6, #8e44ad); margin: 5px;">
                    📊 검증 보고서
                </button>
            ` : ''}
        </div>
    `;
    
    fileResults.appendChild(card);
}
// 다운로드 함수
function downloadCSV(dataType, fileId) {
    try {
        const key = fileId + '_' + dataType;
        const data = downloadableData[key];
        
        if (!data) {
            showStatus('다운로드할 데이터를 찾을 수 없습니다.', 'error');
            return;
        }
        
        const filename = fileId + '_' + dataType + '.csv';
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


// 데이터 검증 시스템
class DataValidationSystem {
    constructor() {
        this.originalData = {};
        this.validationResults = {};
    }

    // 원본 데이터 저장 및 기본 통계 생성
    async storeOriginalData(zipFile, fileId) {
        const stats = {
            fileId: fileId,
            totalFiles: 0,
            csvFiles: {},
            rawStats: {},
            timestamp: new Date().toISOString()
        };

        const zip = await JSZip.loadAsync(zipFile);
        stats.totalFiles = Object.keys(zip.files).length;
        
        // CSV 파일별 원본 통계
        for (const filename in zip.files) {
            if (filename.endsWith('.csv')) {
                const csvContent = await zip.files[filename].async('text');
                const lines = csvContent.split('\n');
                
                let dataType = 'unknown';
                if (filename.includes('heart_rate')) dataType = 'heart_rate';
                else if (filename.includes('stress')) dataType = 'stress';
                else if (filename.includes('pedometer_step_count')) dataType = 'step_count';
                else if (filename.includes('sleep')) dataType = 'sleep';
                
                if (dataType !== 'unknown') {
                    if (!stats.csvFiles[dataType]) stats.csvFiles[dataType] = [];
                    
                    const fileStats = {
                        filename: filename,
                        totalLines: lines.length,
                        dataLines: lines.length - 1,
                        fileSize: csvContent.length
                    };
                    
                    stats.csvFiles[dataType].push(fileStats);
                    
                    if (!stats.rawStats[dataType]) {
                        stats.rawStats[dataType] = {
                            totalFiles: 0,
                            totalRows: 0,
                            totalSize: 0
                        };
                    }
                    
                    stats.rawStats[dataType].totalFiles++;
                    stats.rawStats[dataType].totalRows += fileStats.dataLines;
                    stats.rawStats[dataType].totalSize += fileStats.fileSize;
                }
            }
        }
        
        this.originalData[fileId] = stats;
        return stats;
    }

    // 처리된 데이터 검증
    validateProcessedData(processedData, fileId) {
        const validation = {
            fileId: fileId,
            timestamp: new Date().toISOString(),
            summary: {
                totalDataTypes: 0,
                totalProcessedRows: 0,
                validationPassed: true,
                issues: []
            },
            detailedResults: {}
        };

        const originalStats = this.originalData[fileId];
        
        if (!originalStats) {
            validation.summary.validationPassed = false;
            validation.summary.issues.push('원본 데이터 통계를 찾을 수 없습니다.');
            return validation;
        }

        // 각 데이터 타입별 검증
        for (const dataType in processedData) {
            if (dataType === '_validation') continue;
            
            const data = processedData[dataType].data;
            const originalStat = originalStats.rawStats[dataType];
            
            validation.summary.totalDataTypes++;
            validation.summary.totalProcessedRows += data.length;
            
            const typeValidation = {
                dataType: dataType,
                originalRows: originalStat ? originalStat.totalRows : 0,
                processedRows: data.length,
                rowDifference: 0,
                dataIntegrity: this.checkDataIntegrity(data, dataType),
                duplicateCheck: this.checkDuplicates(data),
                passed: true,
                issues: []
            };

            // 행 수 비교
            typeValidation.rowDifference = typeValidation.processedRows - typeValidation.originalRows;
            
            // 10% 이상 차이 시 경고
            if (Math.abs(typeValidation.rowDifference) > typeValidation.originalRows * 0.1) {
                typeValidation.passed = false;
                typeValidation.issues.push(`행 수 차이가 10% 이상입니다. (원본: ${typeValidation.originalRows}, 처리: ${typeValidation.processedRows})`);
            }

            // 데이터 무결성 검사
            if (!typeValidation.dataIntegrity.passed) {
                typeValidation.passed = false;
                typeValidation.issues = typeValidation.issues.concat(typeValidation.dataIntegrity.issues);
            }

            // 중복 체크
            if (typeValidation.duplicateCheck.duplicateCount > 0) {
                typeValidation.issues.push(`중복 데이터 ${typeValidation.duplicateCheck.duplicateCount}개 발견`);
            }

            validation.detailedResults[dataType] = typeValidation;
            
            if (!typeValidation.passed) {
                validation.summary.validationPassed = false;
                validation.summary.issues = validation.summary.issues.concat(typeValidation.issues);
            }
        }

        this.validationResults[fileId] = validation;
        return validation;
    }

    // 데이터 무결성 검사
    checkDataIntegrity(data, dataType) {
        const result = {
            passed: true,
            issues: [],
            stats: {
                nullValues: 0,
                invalidDates: 0,
                outOfRangeValues: 0,
                totalRows: data.length
            }
        };

        const expectedColumns = OUTPUT_COLUMNS[dataType];
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            
            // Null 값 체크
            for (const col of expectedColumns) {
                if (row[col] === null || row[col] === undefined || row[col] === '') {
                    result.stats.nullValues++;
                }
            }
            
            // 날짜 형식 체크
            if (row.start_time && !this.isValidDate(row.start_time)) {
                result.stats.invalidDates++;
            }
            
            // 값 범위 체크
            if (dataType === 'heart_rate') {
                if (row.heart_rate && (row.heart_rate < 30 || row.heart_rate > 250)) {
                    result.stats.outOfRangeValues++;
                }
            } else if (dataType === 'stress') {
                if (row.score && (row.score < 0 || row.score > 100)) {
                    result.stats.outOfRangeValues++;
                }
            } else if (dataType === 'step_count') {
                if (row.count && row.count < 0) {
                    result.stats.outOfRangeValues++;
                }
            }
        }

        // 임계값 체크
        const nullPercentage = (result.stats.nullValues / (data.length * expectedColumns.length)) * 100;
        
        if (nullPercentage > 50) {
            result.passed = false;
            result.issues.push(`NULL 값이 ${nullPercentage.toFixed(1)}%로 과도하게 많습니다.`);
        }
        
        if (result.stats.outOfRangeValues > data.length * 0.05) {
            result.passed = false;
            result.issues.push(`비정상적인 값이 ${result.stats.outOfRangeValues}개 발견되었습니다.`);
        }

        return result;
    }

    // 중복 체크
    checkDuplicates(data) {
        const result = {
            duplicateCount: 0,
            uniqueCount: 0,
            duplicateRows: []
        };

        const seen = new Set();
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const key = `${row.start_time}_${row.end_time}_${row.source_file}`;
            
            if (seen.has(key)) {
                result.duplicateRows.push(i);
            } else {
                seen.add(key);
            }
        }

        result.duplicateCount = result.duplicateRows.length;
        result.uniqueCount = data.length - result.duplicateCount;

        return result;
    }

    // 검증 보고서 생성
    generateValidationReport(fileId) {
        const original = this.originalData[fileId];
        const validation = this.validationResults[fileId];
        
        if (!original || !validation) {
            return null;
        }

        return {
            fileId: fileId,
            timestamp: new Date().toISOString(),
            summary: {
                overallStatus: validation.summary.validationPassed ? 'PASSED' : 'FAILED',
                totalIssues: validation.summary.issues.length,
                dataTypes: validation.summary.totalDataTypes,
                processedRows: validation.summary.totalProcessedRows
            },
            originalStats: original.rawStats,
            validationResults: validation.detailedResults
        };
    }

    // 유틸리티 함수
    isValidDate(dateString) {
        const date = new Date(dateString);
        return !isNaN(date.getTime()) && date.getFullYear() > 2000 && date.getFullYear() < 2030;
    }
}

// 전역 검증 시스템 인스턴스
const validationSystem = new DataValidationSystem();

// 검증과 함께 ZIP 파일 처리
async function processZipFileWithValidation(file, fileId) {
    // 1. 원본 데이터 통계 저장
    await validationSystem.storeOriginalData(file, fileId);
    
    // 2. 기존 처리 로직 실행
    const processedData = await processZipFile(file, fileId);
    
    // 3. 처리된 데이터 검증
    const validationResult = validationSystem.validateProcessedData(processedData, fileId);
    
    // 4. 검증 결과를 처리된 데이터에 추가
    processedData._validation = validationResult;
    
    return processedData;
}

// 기존 handleSingleFile 함수를 검증 버전으로 교체
async function handleSingleFileWithValidation(file) {
    showProgress();
    showStatus('ZIP 파일을 분석하고 있습니다...', 'info');

    try {
        const fileId = getFileIdentifier(file.name);
        
        updateProgress(30, '원본 데이터 분석 중...');
        const data = await processZipFileWithValidation(file, fileId);
        
        updateProgress(90, '검증 완료, 결과 표시 중...');
        displayResults({[fileId]: data});
        
        hideProgress();
        
        // 검증 결과에 따른 상태 메시지
        const validation = data._validation;
        if (validation && validation.summary.validationPassed) {
            showStatus('✅ 데이터 처리 및 검증이 완료되었습니다!', 'info');
        } else {
            showStatus('⚠️ 데이터 처리는 완료되었으나 일부 문제가 발견되었습니다. 검증 보고서를 확인하세요.', 'warning');
        }
        
    } catch (error) {
        hideProgress();
        showStatus('오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 검증 보고서 표시 함수
function displayValidationReport(fileId) {
    const report = validationSystem.generateValidationReport(fileId);
    
    if (!report) {
        showStatus('검증 보고서를 생성할 수 없습니다.', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
        align-items: center; justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white; padding: 30px; border-radius: 15px;
        max-width: 90%; max-height: 80%; overflow: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    `;
    
    const statusColor = report.summary.overallStatus === 'PASSED' ? '#27ae60' : '#e74c3c';
    const statusIcon = report.summary.overallStatus === 'PASSED' ? '✅' : '❌';
    
    content.innerHTML = `
        <h3 style="color: #2c3e50; margin-bottom: 20px;">📊 데이터 검증 보고서 - ${fileId}</h3>
        
        <div style="background: ${statusColor}20; border: 2px solid ${statusColor}; border-radius: 10px; padding: 15px; margin-bottom: 20px;">
            <h4 style="color: ${statusColor}; margin-bottom: 10px;">${statusIcon} 전체 상태: ${report.summary.overallStatus}</h4>
            <p style="margin: 5px 0;">처리된 데이터 타입: ${report.summary.dataTypes}개</p>
            <p style="margin: 5px 0;">총 처리된 행: ${report.summary.processedRows.toLocaleString()}개</p>
            <p style="margin: 5px 0;">발견된 문제: ${report.summary.totalIssues}개</p>
        </div>
        
        <div style="max-height: 300px; overflow-y: auto;">
            ${Object.keys(report.validationResults).map(dataType => {
                const result = report.validationResults[dataType];
                const typeStatus = result.passed ? '✅' : '❌';
                const typeColor = result.passed ? '#27ae60' : '#e74c3c';
                
                return `
                    <details style="margin: 10px 0; border: 1px solid #dee2e6; border-radius: 5px;">
                        <summary style="padding: 10px; background: ${typeColor}10; cursor: pointer;">
                            ${typeStatus} ${dataType} (${result.processedRows}행)
                        </summary>
                        <div style="padding: 15px;">
                            <p><strong>원본 행 수:</strong> ${result.originalRows}</p>
                            <p><strong>처리된 행 수:</strong> ${result.processedRows}</p>
                            <p><strong>차이:</strong> ${result.rowDifference}</p>
                            <p><strong>중복 데이터:</strong> ${result.duplicateCheck.duplicateCount}개</p>
                            ${result.issues.length > 0 ? `
                                <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin-top: 10px;">
                                    <strong>발견된 문제:</strong>
                                    <ul style="margin: 5px 0; padding-left: 20px;">
                                        ${result.issues.map(issue => `<li>${issue}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    </details>
                `;
            }).join('')}
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
            <button onclick="downloadValidationReport('${fileId}')" 
                    style="padding: 12px 20px; background: #3498db; color: white; border: none; border-radius: 8px; margin: 5px; cursor: pointer;">
                📄 보고서 다운로드
            </button>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="padding: 12px 20px; background: #95a5a6; color: white; border: none; border-radius: 8px; margin: 5px; cursor: pointer;">
                ❌ 닫기
            </button>
        </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
}

// 검증 보고서 다운로드
function downloadValidationReport(fileId) {
    const report = validationSystem.generateValidationReport(fileId);
    
    if (!report) return;
    
    const reportText = `# Samsung Health 데이터 검증 보고서

## 기본 정보
- 파일 ID: ${report.fileId}
- 생성 시간: ${report.timestamp}
- 전체 상태: ${report.summary.overallStatus}
- 처리된 데이터 타입: ${report.summary.dataTypes}개
- 총 처리된 행: ${report.summary.processedRows}개
- 발견된 문제: ${report.summary.totalIssues}개

## 상세 검증 결과

${Object.keys(report.validationResults).map(dataType => {
    const result = report.validationResults[dataType];
    return `### ${dataType}
- 상태: ${result.passed ? 'PASSED' : 'FAILED'}
- 원본 행 수: ${result.originalRows}
- 처리된 행 수: ${result.processedRows}
- 차이: ${result.rowDifference}
- 중복 데이터: ${result.duplicateCheck.duplicateCount}개
- 문제점: ${result.issues.join(', ') || '없음'}
`;
}).join('\n')}

---
보고서 생성 시간: ${new Date().toLocaleString('ko-KR')}
`;
    
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `validation_report_${fileId}_${new Date().toISOString().slice(0,10)}.txt`;
    link.click();
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// createDataCard 함수를 검증 정보 포함 버전으로 교체
function createDataCardWithValidation(dataType, data, fileId) {
    const key = fileId + '_' + dataType;
    downloadableData[key] = data;
    
    const card = document.createElement('div');
    card.className = 'file-card';
    
    const filename = fileId + '_' + dataType + '.csv';
    const rowCount = data.length;
    
    // 검증 정보 표시 (만약 있다면)
    let validationHtml = '';
    if (allProcessedData[fileId] && allProcessedData[fileId]._validation) {
        const validation = allProcessedData[fileId]._validation.detailedResults[dataType];
        if (validation) {
            const statusIcon = validation.passed ? '✅' : '⚠️';
            const statusColor = validation.passed ? '#27ae60' : '#f39c12';
            const statusText = validation.passed ? '검증 통과' : '문제 발견';
            
            validationHtml = `
                <div style="background: ${statusColor}20; border: 1px solid ${statusColor}; border-radius: 5px; padding: 10px; margin: 10px 0;">
                    <strong>${statusIcon} ${statusText}</strong>
                    ${validation.issues.length > 0 ? `<br><small>문제: ${validation.issues.join(', ')}</small>` : ''}
                    <br><small>원본: ${validation.originalRows}행 → 처리: ${validation.processedRows}행</small>
                    ${validation.duplicateCheck.duplicateCount > 0 ? `<br><small>⚠️ 중복 데이터: ${validation.duplicateCheck.duplicateCount}개</small>` : ''}
                </div>
            `;
        }
    }
    
    card.innerHTML = `
        <h3>📄 ${filename}</h3>
        ${validationHtml}
        <div class="stats">
            <div class="stat-item">
                <div class="stat-value">${rowCount.toLocaleString()}</div>
                <div>행 수</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${(new Blob([Papa.unparse(data)]).size / 1024).toFixed(1)}KB</div>
                <div>파일 크기</div>
            </div>
        </div>
        <div style="text-align: center; margin: 15px 0;">
            <button class="btn download-btn" onclick="downloadCSV('${dataType}', '${fileId}')" style="margin: 5px;">
                💾 ${filename} 다운로드
            </button>
            ${fileId !== 'merged_all' && fileId !== 'all_types' ? `
                <button class="btn" onclick="displayValidationReport('${fileId}')" style="background: linear-gradient(45deg, #9b59b6, #8e44ad); margin: 5px;">
                    📊 검증 보고서
                </button>
            ` : ''}
        </div>
    `;
    
    fileResults.appendChild(card);
}

// ==================== 기존 함수들 업데이트 ====================

// handleSingleFile 함수를 검증 버전으로 교체
const originalHandleSingleFile = handleSingleFile;
handleSingleFile = handleSingleFileWithValidation;

// createDataCard 함수를 검증 버전으로 교체  
const originalCreateDataCard = createDataCard;
createDataCard = createDataCardWithValidation;
