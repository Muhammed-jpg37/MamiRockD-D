const fs = require('fs');

function fixFeatureViewJS(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Target the renderFeaturesView function block and update quote handling
  const oldRenderView = `function renderFeaturesView(){
  initDefaultFeatures();
  const container = document.getElementById('features-list-content');
  if(!container) return;

  const items = state.features.items || [];
  const bg = state.features.backgroundInfo || {};

  let html = '';

  // Render Background & Alignment section if tab is ALL or BG
  if(activeFeaturesTab === 'ALL' || activeFeaturesTab === 'BG'){
    html += '<div style="background:rgba(0,0,0,0.3); border:1px solid var(--border-bright); border-radius:8px; padding:16px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
          '<div style="font-family:Cinzel,serif; font-size:16px; font-weight:700; color:var(--gold-bright);">📜 Background & Alignment</div>' +
          '<button class="btn ghost small" onclick="openEditBackgroundModal()">⚙️ Edit</button>' +
        '</div>' +
        '<div class="form-grid" style="grid-template-columns:1fr 1fr; gap:12px; font-size:13px;">' +
          '<div><b>Background:</b> ' + escapeHtml(bg.name || 'Entertainer') + (bg.featureName ? ' (' + escapeHtml(bg.featureName) + ')' : '') + '</div>' +
          '<div><b>Alignment:</b> <span style="color:var(--gold-bright); font-weight:bold;">' + escapeHtml(bg.alignment || 'Chaotic Good') + '</span></div>' +
        '</div>' +
        (bg.ideals ? '<div style="font-size:12px; margin-top:8px; color:var(--text-dim);"><b>Ideals:</b> ' + escapeHtml(bg.ideals) + '</div>' : '') +
        (bg.bonds ? '<div style="font-size:12px; margin-top:4px; color:var(--text-dim);"><b>Bonds:</b> ' + escapeHtml(bg.bonds) + '</div>' : '') +
        (bg.flaws ? '<div style="font-size:12px; margin-top:4px; color:var(--text-dim);"><b>Flaws:</b> ' + escapeHtml(bg.flaws) + '</div>' : '') +
      '</div>';
  }

  // Filter items based on active tab
  let filteredItems = items;
  if(activeFeaturesTab !== 'ALL' && activeFeaturesTab !== 'BG'){
    filteredItems = items.filter(function(i){ return i.category === activeFeaturesTab; });
  }

  // Group items by Section Title
  const groups = {};
  filteredItems.forEach(function(item){
    const grpTitle = item.title || (item.category === 'CLASS' ? 'Class Features' : item.category === 'SPECIES' ? 'Species Traits' : 'Feats');
    if(!groups[grpTitle]) groups[grpTitle] = [];
    groups[grpTitle].push(item);
  });

  Object.keys(groups).forEach(function(groupTitle){
    html += '<div style="background:rgba(0,0,0,0.25); border:1px solid var(--border); border-radius:8px; padding:16px;">' +
        '<div style="font-family:Cinzel,serif; font-size:18px; font-weight:700; color:#ef4444; border-bottom:1px solid rgba(239,68,68,0.3); padding-bottom:6px; margin-bottom:12px;">' + escapeHtml(groupTitle) + '</div>' +
        '<div style="display:flex; flex-direction:column; gap:14px;">';

    groups[groupTitle].forEach(function(f){
      const fid = escapeJs(f.id);
      let pipsHtml = '';
      if(f.maxUses > 0){
        let pips = '';
        for(let u = 0; u < f.maxUses; u++){
          const isUsed = u < (f.usedUses || 0);
          pips += '<button type="button" class="slot-pip' + (isUsed ? ' used' : '') + '" style="width:16px; height:16px; font-size:10px;" onclick="toggleFeatureUse(\\\'' + fid + '\\\', ' + u + ')">' + (isUsed ? '✕' : '■') + '</button>';
        }
        pipsHtml = '<div style="display:inline-flex; align-items:center; gap:6px; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px; border:1px solid var(--border); margin-top:6px; font-size:11px;">' +
            '<span style="font-weight:bold;">' + escapeHtml(f.name) + ': ' + (f.maxUses - (f.usedUses || 0)) + '/' + f.maxUses + ' Uses</span> ' +
            '<div style="display:flex; gap:3px;">' + pips + '</div>' +
            '<span style="color:var(--text-muted);">/ ' + escapeHtml(f.resetType || 'Long Rest') + '</span>' +
          '</div>';
      }

      const descFormatted = escapeHtml(f.desc || '').replace(/\\n/g, '<br>');

      html += '<div style="border-left:3px solid var(--gold-bright); padding-left:10px; position:relative;">' +
          '<div style="display:flex; justify-content:space-between; align-items:baseline;">' +
            '<div style="font-weight:bold; font-size:14px; color:var(--text);">' + escapeHtml(f.name) + (f.source ? ' <span style="font-weight:normal; font-size:11px; color:var(--text-muted); font-style:italic;">· ' + escapeHtml(f.source) + '</span>' : '') + '</div>' +
            '<div style="display:flex; gap:4px;">' +
              '<button class="btn ghost small" style="padding:1px 6px; font-size:11px;" onclick="editFeatureItem(\\\'' + fid + '\\\')">Edit</button>' +
              '<button class="btn danger small" style="padding:1px 6px; font-size:11px;" onclick="deleteFeatureItem(\\\'' + fid + '\\\')">✕</button>' +
            '</div>' +
          '</div>' +
          '<div style="font-size:12px; color:var(--text-dim); margin-top:4px; line-height:1.4;">' + descFormatted + '</div>' +
          pipsHtml +
        '</div>';
    });

    html += '</div></div>';
  });

  if(!filteredItems.length && activeFeaturesTab !== 'BG'){
    html += '<div class="spell-empty">No features found in this category. Click "+ Add Feature / Trait" above to create one.</div>';
  }

  container.innerHTML = html;
}`;

  // Replace from function renderFeaturesView(){ down to container.innerHTML = html;\n}
  const funcStartIdx = content.indexOf('function renderFeaturesView(){');
  if (funcStartIdx !== -1) {
    const funcEndIdx = content.indexOf('container.innerHTML = html;\n}', funcStartIdx);
    if (funcEndIdx !== -1) {
      const fullEndIdx = funcEndIdx + 'container.innerHTML = html;\n}'.length;
      content = content.substring(0, funcStartIdx) + oldRenderView + content.substring(fullEndIdx);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Cleaned up renderFeaturesView in ${filePath}`);
    }
  }
}

fixFeatureViewJS('bg3-inventory_13.html');
fixFeatureViewJS('bg3-inventory.html');
