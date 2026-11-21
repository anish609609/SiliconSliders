/**
 * logic-state.js - PMOS CAD Viewer
 * Electrical state machine for discrete PMOS transistor (Active-Low):
 * Toggles Gate voltage VG between 0V (ON / Inversion), 1.0V (OFF / Cutoff), and Floating High-Z.
 * Updates 3D hole channel luminescence and the HUD status telemetry badge.
 */

var currentIn = 0; // Default to ON (VG = 0V) for PMOS active-low conduction
var stateBadge = document.getElementById('state-badge');
var inSeg = document.getElementById('in-seg');

function applyLogicState() {
  var badgeVg = document.getElementById('badge-vg') || document.getElementById('badge-in');
  var badgeState = document.getElementById('badge-state') || document.getElementById('badge-pmos');
  var badgeChan = document.getElementById('badge-chan') || document.getElementById('badge-nmos');
  var badgeIsd = document.getElementById('badge-isd') || document.getElementById('badge-out');

  var isOn = currentIn === 0;
  var isFloating = currentIn === 'off';

  if (isFloating) {
    if (badgeVg) { badgeVg.textContent = 'FLOATING'; badgeVg.className = 'v floating'; }
    if (badgeState) { badgeState.textContent = 'HIGH-Z / UNBIASED'; badgeState.className = 'v warn'; }
    if (badgeChan) { badgeChan.textContent = 'WEAK INVERSION'; badgeChan.className = 'v warn'; }
    if (badgeIsd) { badgeIsd.textContent = '≈ 0 (LEAKAGE)'; badgeIsd.className = 'v floating'; }

    if (typeof channelMesh !== 'undefined' && channelMesh && channelMesh.material) {
      channelMesh.material.opacity = 0.15;
      channelMesh.material.emissiveIntensity = 0.05;
    }
  } else if (isOn) {
    // PMOS is ON when VG = 0V (VGS = -1.0V)
    if (badgeVg) { badgeVg.textContent = '0.0 V (LOW)'; badgeVg.className = 'v on'; }
    if (badgeState) { badgeState.textContent = 'ON (INVERSION)'; badgeState.className = 'v on'; }
    if (badgeChan) { badgeChan.textContent = 'HOLE INVERSION LAYER'; badgeChan.className = 'v on'; }
    if (badgeIsd) { badgeIsd.textContent = 'PULL-UP TO VDD (ISD > 0)'; badgeIsd.className = 'v on'; }

    if (typeof channelMesh !== 'undefined' && channelMesh && channelMesh.material) {
      channelMesh.material.opacity = 0.85;
      channelMesh.material.emissiveIntensity = 0.65;
    }
  } else {
    // PMOS is OFF when VG = 1.0V (VGS = 0V)
    if (badgeVg) { badgeVg.textContent = '1.0 V (VDD)'; badgeVg.className = 'v off'; }
    if (badgeState) { badgeState.textContent = 'OFF (CUTOFF)'; badgeState.className = 'v off'; }
    if (badgeChan) { badgeChan.textContent = 'DEPLETION LAYER'; badgeChan.className = 'v off'; }
    if (badgeIsd) { badgeIsd.textContent = '0.0 µA (CUTOFF)'; badgeIsd.className = 'v off'; }

    if (typeof channelMesh !== 'undefined' && channelMesh && channelMesh.material) {
      channelMesh.material.opacity = 0.08;
      channelMesh.material.emissiveIntensity = 0.0;
    }
  }

  // Update SVG schematic indicators if present
  var schVg = document.getElementById('sch-vg-val');
  if (schVg) schVg.textContent = isFloating ? 'FLT' : (isOn ? '0.0V' : '1.0V');
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
