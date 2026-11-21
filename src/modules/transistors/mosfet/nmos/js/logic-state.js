/**
 * logic-state.js - NMOS CAD Viewer
 * Electrical state machine for discrete NMOS transistor:
 * Toggles Gate bias VGS between 0V (Cutoff), 1.0V (Inversion / Conduction), and Floating High-Z.
 * Updates 3D channel luminescence and the HUD status telemetry badge.
 */

var currentIn = 1; // Default to ON (VGS = 1.0V) to show active channel, or 0 / 'off'
var stateBadge = document.getElementById('state-badge');
var inSeg = document.getElementById('in-seg');

function applyLogicState() {
  var badgeVgs = document.getElementById('badge-vgs') || document.getElementById('badge-in');
  var badgeState = document.getElementById('badge-state') || document.getElementById('badge-pmos');
  var badgeChan = document.getElementById('badge-chan') || document.getElementById('badge-nmos');
  var badgeIds = document.getElementById('badge-ids') || document.getElementById('badge-out');

  var isOn = currentIn === 1;
  var isFloating = currentIn === 'off';

  if (isFloating) {
    if (badgeVgs) { badgeVgs.textContent = 'FLOATING'; badgeVgs.className = 'v floating'; }
    if (badgeState) { badgeState.textContent = 'HIGH-Z / UNBIASED'; badgeState.className = 'v warn'; }
    if (badgeChan) { badgeChan.textContent = 'WEAK INVERSION'; badgeChan.className = 'v warn'; }
    if (badgeIds) { badgeIds.textContent = '≈ 0 (LEAKAGE)'; badgeIds.className = 'v floating'; }

    if (typeof channelMesh !== 'undefined' && channelMesh && channelMesh.material) {
      channelMesh.material.opacity = 0.15;
      channelMesh.material.emissiveIntensity = 0.05;
    }
  } else if (isOn) {
    if (badgeVgs) { badgeVgs.textContent = '1.0 V (HIGH)'; badgeVgs.className = 'v on'; }
    if (badgeState) { badgeState.textContent = 'ON (INVERSION)'; badgeState.className = 'v on'; }
    if (badgeChan) { badgeChan.textContent = 'CONDUCTION CHANNEL'; badgeChan.className = 'v on'; }
    if (badgeIds) { badgeIds.textContent = 'CONDUCTING (IDS > 0)'; badgeIds.className = 'v on'; }

    if (typeof channelMesh !== 'undefined' && channelMesh && channelMesh.material) {
      channelMesh.material.opacity = 0.85;
      channelMesh.material.emissiveIntensity = 0.65;
    }
  } else {
    // Cutoff / OFF
    if (badgeVgs) { badgeVgs.textContent = '0.0 V (GND)'; badgeVgs.className = 'v off'; }
    if (badgeState) { badgeState.textContent = 'OFF (CUTOFF)'; badgeState.className = 'v off'; }
    if (badgeChan) { badgeChan.textContent = 'DEPLETION LAYER'; badgeChan.className = 'v off'; }
    if (badgeIds) { badgeIds.textContent = '0.0 µA (CUTOFF)'; badgeIds.className = 'v off'; }

    if (typeof channelMesh !== 'undefined' && channelMesh && channelMesh.material) {
      channelMesh.material.opacity = 0.08;
      channelMesh.material.emissiveIntensity = 0.0;
    }
  }

  // Update SVG schematic indicators if present
  var schVgs = document.getElementById('sch-vgs-val');
  if (schVgs) schVgs.textContent = isFloating ? 'FLT' : (isOn ? '1.0V' : '0.0V');
  var schChan = document.getElementById('sch-channel-state');
  if (schChan) schChan.textContent = isFloating ? 'HIGH-Z' : (isOn ? 'ON (INVERTED)' : 'OFF (CUTOFF)');

  if (typeof rebuildFlowCurves === 'function') {
    rebuildFlowCurves();
  }

  if (typeof lastSelectedId !== 'undefined' && lastSelectedId && typeof window.updateVoiceAssistantContext === 'function') {
    window.updateVoiceAssistantContext(lastSelectedId, idToInfo(lastSelectedId));
  }
}

if (inSeg) {
  inSeg.querySelectorAll('button').forEach(function(b) {
    b.addEventListener('click', function() {
      var v = b.dataset.in;
      currentIn = v === 'off' ? 'off' : parseInt(v, 10);
      inSeg.querySelectorAll('button').forEach(function(btn) { btn.classList.remove('active'); });
      b.classList.add('active');
      applyLogicState();
    });
  });
}
