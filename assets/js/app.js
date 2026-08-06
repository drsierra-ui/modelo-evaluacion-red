(() => {
  'use strict';

  const DIMENSIONS = [
    { id:'pedagogica', name:'Calidad pedagógica', weight:30, criteria:[
      ['coherencia','Coherencia curricular','Objetivos, contenidos, actividades y evaluación guardan correspondencia.'],
      ['contenido','Calidad del contenido','La información es correcta, actual, pertinente y comprensible.'],
      ['retroalimentacion','Retroalimentación','El RED orienta al estudiante y ofrece oportunidades de mejora.']
    ]},
    { id:'usabilidad', name:'Usabilidad y experiencia', weight:20, criteria:[
      ['navegacion','Navegación','El usuario reconoce dónde está, qué puede hacer y cómo regresar.'],
      ['consistencia','Consistencia','Los controles, patrones visuales y mensajes son uniformes.']
    ]},
    { id:'accesibilidad', name:'Accesibilidad e inclusión', weight:20, criteria:[
      ['percepcion','Percepción y contraste','Textos, imágenes y controles pueden percibirse en distintas condiciones.'],
      ['operacion','Operación inclusiva','Las funciones principales pueden utilizarse con teclado y tecnologías de apoyo.']
    ]},
    { id:'diseno', name:'Diseño e interactividad', weight:15, criteria:[
      ['visual','Diseño visual','La jerarquía, tipografía, color y composición facilitan la comprensión.'],
      ['interactividad','Interactividad','Las actividades exigen acciones significativas y ofrecen respuestas comprensibles.']
    ]},
    { id:'tecnica', name:'Calidad técnica y reutilización', weight:15, criteria:[
      ['funcionamiento','Funcionamiento','El recurso carga, responde y conserva su integridad en los entornos previstos.'],
      ['reutilizacion','Reutilización','El RED cuenta con metadatos, licencia y condiciones de adaptación o integración.']
    ]}
  ];

  const storageKey = 'miered-v4-evaluation';
  const byId = (id) => document.getElementById(id);
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

  function level(score){
    if(score >= 90) return {name:'Excelente', className:'excellent'};
    if(score >= 80) return {name:'Alto', className:'high'};
    if(score >= 70) return {name:'Aceptable', className:'acceptable'};
    if(score >= 60) return {name:'Bajo', className:'low'};
    return {name:'Insuficiente', className:'insufficient'};
  }

  function readState(){
    try { return JSON.parse(localStorage.getItem(storageKey)) || {}; }
    catch { return {}; }
  }
  function saveState(state){ localStorage.setItem(storageKey, JSON.stringify(state)); }

  function initEvaluator(){
    const root = byId('evaluation-form');
    if(!root) return;
    const state = readState();
    const metadata = state.metadata || {};
    ['resource-name','resource-type','resource-audience','evaluator-name'].forEach(id => {
      const el = byId(id); if(el) el.value = metadata[id] || '';
    });

    const criteriaRoot = byId('criteria-root');
    DIMENSIONS.forEach((dimension, dIndex) => {
      const section = document.createElement('section');
      section.className = 'eval-dimension';
      section.innerHTML = `<div class="eval-dimension-head"><div><span class="eyebrow">Dimensión ${dIndex+1}</span><h2>${dimension.name}</h2></div><span class="dimension-weight">${dimension.weight} %</span></div>`;
      const rows = document.createElement('div'); rows.className = 'criteria-list';
      dimension.criteria.forEach(([id,name,description], cIndex) => {
        const saved = (state.scores && state.scores[id]) || {};
        const row = document.createElement('article'); row.className = 'criterion-row';
        row.innerHTML = `
          <div class="criterion-copy"><h3>${name}</h3><p>${description}</p></div>
          <div class="criterion-control">
            <label for="score-${id}">Nivel</label>
            <select id="score-${id}" name="${id}" data-dimension="${dimension.id}" required>
              <option value="">Seleccione</option>
              ${[1,2,3,4,5].map(v=>`<option value="${v}" ${String(saved.score)===String(v)?'selected':''}>${v} — ${['Insuficiente','Bajo','Aceptable','Alto','Excelente'][v-1]}</option>`).join('')}
            </select>
          </div>
          <div class="criterion-evidence"><label for="evidence-${id}">Evidencia / observación</label><textarea id="evidence-${id}" data-evidence="${id}" rows="2" placeholder="Registre la evidencia que sustenta la valoración.">${saved.evidence || ''}</textarea></div>`;
        rows.appendChild(row);
      });
      section.appendChild(rows); criteriaRoot.appendChild(section);
    });

    root.addEventListener('input', updatePreview);
    root.addEventListener('change', updatePreview);
    root.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = collectState();
      if(!result.complete){
        byId('form-message').textContent = 'Complete todos los niveles antes de finalizar la evaluación.';
        byId('form-message').focus();
        return;
      }
      saveState(result.state);
      byId('form-message').textContent = 'Evaluación guardada correctamente. Puede consultar el tablero de resultados.';
      byId('open-dashboard').hidden = false;
    });
    byId('clear-evaluation').addEventListener('click', () => {
      if(confirm('¿Desea borrar la evaluación guardada y reiniciar el formulario?')){
        localStorage.removeItem(storageKey); location.reload();
      }
    });
    byId('save-draft').addEventListener('click', () => {
      const result = collectState(); saveState(result.state);
      byId('form-message').textContent = 'Borrador guardado en este navegador.';
    });
    updatePreview();
  }

  function collectState(){
    const scores = {}; let complete = true;
    DIMENSIONS.forEach(d => d.criteria.forEach(([id]) => {
      const scoreEl = byId(`score-${id}`); const evidenceEl = byId(`evidence-${id}`);
      const score = Number(scoreEl.value); if(!score) complete = false;
      scores[id] = {score: score || 0, evidence: evidenceEl.value.trim()};
    }));
    const dimensionResults = {};
    DIMENSIONS.forEach(d => {
      const values = d.criteria.map(([id])=>scores[id].score).filter(Boolean);
      const avg = values.length ? values.reduce((a,b)=>a+b,0)/d.criteria.length : 0;
      const percent = avg * 20;
      dimensionResults[d.id] = {name:d.name, weight:d.weight, average:avg, percent, contribution:percent*(d.weight/100)};
    });
    const total = Object.values(dimensionResults).reduce((sum,d)=>sum+d.contribution,0);
    const metadata = {};
    ['resource-name','resource-type','resource-audience','evaluator-name'].forEach(id => metadata[id] = (byId(id)?.value || '').trim());
    return {complete, state:{metadata,scores,dimensionResults,total,date:new Date().toISOString()}};
  }

  function updatePreview(){
    const result = collectState();
    const total = Math.round(result.state.total * 10)/10;
    const ring = byId('live-score-ring');
    if(ring){ ring.style.setProperty('--score',clamp(total,0,100)); ring.querySelector('strong').textContent = total.toFixed(1); }
    const lvl = level(total); const label = byId('live-score-label'); if(label) label.textContent = lvl.name;
    const progress = byId('completion-progress');
    const selected = Object.values(result.state.scores).filter(v=>v.score>0).length;
    const count = DIMENSIONS.reduce((n,d)=>n+d.criteria.length,0);
    if(progress){ progress.value = selected; progress.max = count; byId('completion-copy').textContent = `${selected} de ${count} criterios valorados`; }
  }

  function initDashboard(){
    const root = byId('dashboard-root'); if(!root) return;
    const state = readState();
    if(!state.dimensionResults){ byId('empty-dashboard').hidden = false; root.hidden = true; return; }
    byId('empty-dashboard').hidden = true; root.hidden = false;
    const total = Math.round((state.total || 0)*10)/10;
    byId('dashboard-score').textContent = total.toFixed(1);
    byId('dashboard-ring').style.setProperty('--score',clamp(total,0,100));
    byId('dashboard-level').textContent = level(total).name;
    byId('dashboard-resource').textContent = state.metadata?.['resource-name'] || 'Recurso sin nombre';
    byId('dashboard-meta').textContent = [state.metadata?.['resource-type'],state.metadata?.['resource-audience']].filter(Boolean).join(' · ') || 'Datos generales no registrados';
    const tbody = byId('dashboard-table'); const bars = byId('dashboard-bars');
    DIMENSIONS.forEach(d => {
      const r = state.dimensionResults[d.id];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${d.name}</td><td>${r.percent.toFixed(1)}</td><td>${d.weight}%</td><td>${r.contribution.toFixed(1)}</td>`;
      tbody.appendChild(tr);
      const bar = document.createElement('div');
      bar.innerHTML = `<div class="bar-label"><span>${d.name}</span><b>${r.percent.toFixed(0)}%</b></div><div class="meter"><i style="width:${clamp(r.percent,0,100)}%"></i></div>`;
      bars.appendChild(bar);
    });
    const strengths = [], improvements = [];
    DIMENSIONS.forEach(d => d.criteria.forEach(([id,name]) => {
      const s = state.scores[id]?.score || 0;
      if(s >= 4) strengths.push(name);
      if(s > 0 && s <= 2) improvements.push(name);
    }));
    fillList('strength-list', strengths, 'No se registraron criterios en nivel alto o excelente.');
    fillList('improvement-list', improvements, 'No se registraron criterios en nivel bajo o insuficiente.');
    byId('print-report').addEventListener('click',()=>window.print());
  }

  function fillList(id, items, fallback){
    const ul = byId(id); ul.innerHTML = '';
    (items.length ? items : [fallback]).forEach(item => { const li=document.createElement('li'); li.textContent=item; ul.appendChild(li); });
  }

  document.addEventListener('DOMContentLoaded', () => { initEvaluator(); initDashboard(); });
})();
