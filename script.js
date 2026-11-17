let globalIssuesData = [];
const MEU_EMAIL = "jairo.junior@guaranisistemas.com.br";

let activeGroups = ['tipo', 'issue'];
let currentWorklogs = [];
let currentDates = [];

document.getElementById('jsonFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById('fileName').innerText = file.name;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            if (!data.issues) throw new Error("O arquivo não possui o formato esperado do Jira.");
            globalIssuesData = data.issues;
            
            initDatesAndRender();
        } catch (err) {
            alert("Erro ao ler arquivo: " + err.message);
        }
    };
    reader.readAsText(file);
});

document.getElementById('btnGenerate').addEventListener('click', applyFilters);

function renderGroupByUI() {
    const container = document.getElementById('groupByTags');
    container.innerHTML = '';
    
    activeGroups.forEach(g => {
        const label = g === 'tipo' ? 'Tipo de item' : 'Issue';
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `${label} <span onclick="removeGroup('${g}')">×</span>`;
        container.appendChild(tag);
    });
    
    const select = document.getElementById('addGroupSelect');
    select.innerHTML = '<option value="">+ Add field...</option>';
    if (!activeGroups.includes('tipo')) select.innerHTML += '<option value="tipo">Tipo de item</option>';
    if (!activeGroups.includes('issue')) select.innerHTML += '<option value="issue">Issue</option>';
    
    select.style.display = activeGroups.length === 2 ? 'none' : 'block';
}

window.removeGroup = function(g) {
    activeGroups = activeGroups.filter(x => x !== g);
    renderGroupByUI();
    if(currentWorklogs.length > 0) renderHTML();
};

document.getElementById('addGroupSelect').addEventListener('change', function(e) {
    if (e.target.value) {
        activeGroups.push(e.target.value);
        if (activeGroups.includes('tipo') && activeGroups.includes('issue')) {
            activeGroups = ['tipo', 'issue'];
        }
        renderGroupByUI();
        if(currentWorklogs.length > 0) renderHTML();
    }
});

function initDatesAndRender() {
    let minD = '9999-12-31';
    let maxD = '0000-01-01';
    let found = false;

    globalIssuesData.forEach(issue => {
        if (!issue.fields.worklog || !issue.fields.worklog.worklogs) return;
        issue.fields.worklog.worklogs.forEach(wl => {
            const email = wl.author.emailAddress ? wl.author.emailAddress.toLowerCase() : "";
            if (email === MEU_EMAIL) {
                const d = wl.started.split('T')[0];
                if (d < minD) minD = d;
                if (d > maxD) maxD = d;
                found = true;
            }
        });
    });

    if (found) {
        document.getElementById('dateFrom').value = minD;
        document.getElementById('dateTo').value = maxD;
    }
    
    applyFilters();
}

function applyFilters() {
    if (globalIssuesData.length === 0) {
        alert("Carregue o JSON primeiro.");
        return;
    }

    const fromStr = document.getElementById('dateFrom').value;
    const toStr = document.getElementById('dateTo').value;

    if (!fromStr || !toStr) {
        alert("Datas inválidas.");
        return;
    }

    currentWorklogs = [];
    globalIssuesData.forEach(issue => {
        if (!issue.fields.worklog || !issue.fields.worklog.worklogs) return;
        
        issue.fields.worklog.worklogs.forEach(wl => {
            const email = wl.author.emailAddress ? wl.author.emailAddress.toLowerCase() : "";
            if (email === MEU_EMAIL) {
                const d = wl.started.split('T')[0];
                if (d >= fromStr && d <= toStr) {
                    currentWorklogs.push({
                        issueKey: issue.key,
                        type: issue.fields.issuetype.name,
                        typeIcon: issue.fields.issuetype.iconUrl,
                        date: d,
                        sec: wl.timeSpentSeconds
                    });
                }
            }
        });
    });

    const reportContainer = document.getElementById('reportContainer');

    if (currentWorklogs.length === 0) {
        reportContainer.innerHTML = "<div class='empty-msg'>Nenhum apontamento encontrado nesse período.</div>";
        document.getElementById('groupBySection').style.display = 'none';
        return;
    }

    document.getElementById('groupBySection').style.display = 'flex';
    renderGroupByUI();

    currentDates = [];
    let curr = new Date(fromStr + 'T12:00:00');
    const end = new Date(toStr + 'T12:00:00');
    
    while (curr <= end) {
        const dateStr = curr.toISOString().split('T')[0];
        const dayOfWeek = curr.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6 || currentWorklogs.some(w => w.date === dateStr)) {
            currentDates.push(dateStr);
        }
        curr.setDate(curr.getDate() + 1);
    }

    renderHTML();
}

function renderHTML() {
    if (activeGroups.length === 0) {
        document.getElementById('reportContainer').innerHTML = "<div class='empty-msg'>Selecione pelo menos um campo no 'Group By' para visualizar a tabela.</div>";
        return;
    }

    let html = `<div class="table-wrapper"><table><thead>`;
    
    // Header 1: Mês e Labels
    html += `<tr>`;
    activeGroups.forEach(g => {
        const label = g === 'tipo' ? 'Tipo de item' : 'Issue';
        html += `<th rowspan="2" class="bg-white col-fixed">${label}</th>`;
        html += `<th rowspan="2" class="col-yellow col-fixed" style="text-align:left;">Total<br>${label}</th>`;
    });
    
    let currentMonth = "";
    let colspan = 0;
    let monthHeaders = "";
    
    currentDates.forEach((d, i) => {
        const m = getMonthYearBR(d);
        if (i === 0) { currentMonth = m; colspan = 1; } 
        else if (m === currentMonth) { colspan++; } 
        else {
            monthHeaders += `<th colspan="${colspan}" class="month-header">${currentMonth}</th>`;
            currentMonth = m; colspan = 1;
        }
    });
    monthHeaders += `<th colspan="${colspan}" class="month-header">${currentMonth}</th>`;
    
    html += monthHeaders + `<th rowspan="2" class="filler-col"></th></tr><tr>`;

    // Header 2: Dias da Semana
    currentDates.forEach(d => {
        const day = d.split('-')[2];
        const wd = getWeekdayBR(d);
        html += `<th class="bg-white day-col">${parseInt(day)}<br><span style="color:#5e6c84; font-size:11px">${wd}</span></th>`;
    });
    html += `</tr></thead><tbody>`;

    let grandTotal = 0;
    const columnTotals = {};
    currentDates.forEach(d => columnTotals[d] = 0);

    // Corpo da Tabela
    if (activeGroups.length === 2 && activeGroups[0] === 'tipo' && activeGroups[1] === 'issue') {
        const groups = {};
        currentWorklogs.forEach(wl => {
            if (!groups[wl.type]) { groups[wl.type] = { total: 0, icon: wl.typeIcon, issues: {} }; }
            const grp = groups[wl.type];
            
            if (!grp.issues[wl.issueKey]) {
                const daily = {};
                currentDates.forEach(d => daily[d] = 0);
                grp.issues[wl.issueKey] = { total: 0, daily: daily };
            }
            
            if (grp.issues[wl.issueKey].daily[wl.date] !== undefined) {
                grp.issues[wl.issueKey].daily[wl.date] += wl.sec;
            }
            grp.issues[wl.issueKey].total += wl.sec;
            grp.total += wl.sec;
        });

        Object.keys(groups).sort().forEach(typeName => {
            const grp = groups[typeName];
            const issueKeys = Object.keys(grp.issues).sort();
            
            issueKeys.forEach((key, idx) => {
                const iss = grp.issues[key];
                html += `<tr>`;
                
                if (idx === 0) {
                    html += `<td rowspan="${issueKeys.length}" class="col-fixed bg-white">
                        <div class="flex-align">
                            <img src="${grp.icon}" onerror="this.style.display='none'"> 
                            <span>${typeName}</span>
                        </div>
                    </td>`;
                    html += `<td rowspan="${issueKeys.length}" class="col-fixed col-yellow" style="font-weight:500;">
                        ${formatSeconds(grp.total)}
                    </td>`;
                }
                
                html += `<td class="col-fixed bg-white">
                    <a href="https://guaranisistemas.atlassian.net/browse/${key}" target="_blank" class="flex-align">
                        <img src="${grp.icon}" onerror="this.style.display='none'"> 
                        <span>${key}</span>
                    </a>
                </td>`;
                html += `<td class="col-fixed col-yellow" style="font-weight:500;">${formatSeconds(iss.total)}</td>`;
                
                currentDates.forEach(d => {
                    const sec = iss.daily[d];
                    columnTotals[d] += sec;
                    html += `<td class="day-col bg-white">${formatSeconds(sec)}</td>`;
                });
                
                html += `<td class="filler-col"></td></tr>`;
                grandTotal += iss.total;
            });
        });

    } else if (activeGroups.length === 1 && activeGroups[0] === 'issue') {
        const issues = {};
        currentWorklogs.forEach(wl => {
            if (!issues[wl.issueKey]) {
                const daily = {};
                currentDates.forEach(d => daily[d] = 0);
                issues[wl.issueKey] = { total: 0, icon: wl.typeIcon, daily: daily };
            }
            if (issues[wl.issueKey].daily[wl.date] !== undefined) {
                issues[wl.issueKey].daily[wl.date] += wl.sec;
            }
            issues[wl.issueKey].total += wl.sec;
        });

        Object.keys(issues).sort().forEach(key => {
            const iss = issues[key];
            html += `<tr>`;
            html += `<td class="col-fixed bg-white">
                <a href="https://guaranisistemas.atlassian.net/browse/${key}" target="_blank" class="flex-align">
                    <img src="${iss.icon}" onerror="this.style.display='none'"> 
                    <span>${key}</span>
                </a>
            </td>`;
            html += `<td class="col-fixed col-yellow" style="font-weight:500;">${formatSeconds(iss.total)}</td>`;
            currentDates.forEach(d => {
                const sec = iss.daily[d];
                columnTotals[d] += sec;
                html += `<td class="day-col bg-white">${formatSeconds(sec)}</td>`;
            });
            html += `<td class="filler-col"></td></tr>`;
            grandTotal += iss.total;
        });

    } else if (activeGroups.length === 1 && activeGroups[0] === 'tipo') {
        const types = {};
        currentWorklogs.forEach(wl => {
            if (!types[wl.type]) {
                const daily = {};
                currentDates.forEach(d => daily[d] = 0);
                types[wl.type] = { total: 0, icon: wl.typeIcon, daily: daily };
            }
            if (types[wl.type].daily[wl.date] !== undefined) {
                types[wl.type].daily[wl.date] += wl.sec;
            }
            types[wl.type].total += wl.sec;
        });

        Object.keys(types).sort().forEach(key => {
            const typ = types[key];
            html += `<tr>`;
            html += `<td class="col-fixed bg-white">
                <div class="flex-align">
                    <img src="${typ.icon}" onerror="this.style.display='none'"> 
                    <span>${key}</span>
                </div>
            </td>`;
            html += `<td class="col-fixed col-yellow" style="font-weight:500;">${formatSeconds(typ.total)}</td>`;
            currentDates.forEach(d => {
                const sec = typ.daily[d];
                columnTotals[d] += sec;
                html += `<td class="day-col bg-white">${formatSeconds(sec)}</td>`;
            });
            html += `<td class="filler-col"></td></tr>`;
            grandTotal += typ.total;
        });
    }

    // Fechamento do Corpo e Início do Footer
    html += `</tbody><tfoot><tr class="tfoot-total">`;
    
    if (activeGroups.length === 2) {
        html += `<td style="text-align:right;">Total</td>`;
        html += `<td class="col-yellow">${formatSeconds(grandTotal)}</td>`;
        html += `<td></td>`;
        html += `<td class="col-yellow">${formatSeconds(grandTotal)}</td>`;
    } else {
        html += `<td style="text-align:right;">Total</td>`;
        html += `<td class="col-yellow">${formatSeconds(grandTotal)}</td>`;
    }
    
    currentDates.forEach(d => {
        html += `<td class="day-col">${formatSeconds(columnTotals[d])}</td>`;
    });
    
    html += `<td class="filler-col"></td></tr></tfoot></table></div>`;
    document.getElementById('reportContainer').innerHTML = html;
}

function formatSeconds(sec) {
    if (!sec) return '';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `0h ${m}m`;
}

function getWeekdayBR(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    return days[d.getDay()];
}

function getMonthYearBR(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${months[d.getMonth()]}, ${d.getFullYear()}`;
}
