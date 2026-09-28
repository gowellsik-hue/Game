function simulateKeyEvent(eventType, keyCode, charCode) {
    var e = document.createEventObject ? document.createEventObject() : document.createEvent("Events");
    if (e.initEvent) e.initEvent(eventType, true, true);
    e.keyCode = keyCode;
    e.which = keyCode;
    e.charCode = charCode || 0;

    if (typeof JSEvents !== 'undefined' && JSEvents.eventHandlers && JSEvents.eventHandlers.length > 0) {
        for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
            var h = JSEvents.eventHandlers[i];
            if ((h.target == Module['canvas'] || h.target == window) && h.eventTypeString == eventType) {
                h.handlerFunc(e);
            }
        }
    } else if (typeof Module !== 'undefined' && Module['canvas']) {
        Module['canvas'].dispatchEvent
            ? Module['canvas'].dispatchEvent(e)
            : Module['canvas'].fireEvent("on" + eventType, e);
    }
}

const slKeysDown = new Set();

function slKeyDown(code) {
    if (slKeysDown.has(code)) return;
    slKeysDown.add(code);
    simulateKeyEvent('keydown', code, 0);
}

function slKeyUp(code) {
    if (!slKeysDown.has(code)) return;
    slKeysDown.delete(code);
    simulateKeyEvent('keyup', code, 0);
}

function slTapKey(code) {
    slKeyDown(code);
    setTimeout(function() { slKeyUp(code); }, 90);
}

function bindKey(elem, key) {
    const node = document.getElementById(elem);
    if (!node) return;

    node.addEventListener('pointerdown', function(e) {
        e.preventDefault();
        if (node.setPointerCapture) node.setPointerCapture(e.pointerId);
        slKeyDown(key);
        node.classList.add('active');
    });

    const release = function(e) {
        if (e && e.preventDefault) e.preventDefault();
        slKeyUp(key);
        node.classList.remove('active');
    };

    node.addEventListener('pointerup', release);
    node.addEventListener('pointercancel', release);
    node.addEventListener('lostpointercapture', release);
}

function is_touch_device() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

const resize = function() {
    const el = document.getElementById('canvas');
    if (!el) return;
    if (window.innerHeight > window.innerWidth) {
        el.style.height = 'unset';
        el.style.width = '100%';
    } else {
        el.style.width = 'unset';
        el.style.height = '100%';
    }
};

window.addEventListener('resize', resize);
window.addEventListener('load', resize);

window.slSetQuickLabel = function(slot, label) {
    const node = document.getElementById('sl-q' + String(slot));
    if (!node) return;
    const text = String(label || '').trim();
    node.textContent = text.length > 8 ? text.slice(0, 8) : (text || String(slot));
    node.title = text;
};

function initSLMobileControls() {
    const ui = document.getElementById('sl-mobile-ui');
    if (!ui) return;

    if (!is_touch_device()) {
        ui.style.display = 'none';
        resize();
        return;
    }

    const joy = document.getElementById('sl-joystick');
    const knob = document.getElementById('sl-joy-knob');
    let joyPointer = null;
    const arrows = [37, 38, 39, 40];

    function setArrows(next) {
        arrows.forEach(function(code) {
            if (next.indexOf(code) >= 0) slKeyDown(code);
            else slKeyUp(code);
        });
    }

    function updateJoy(e) {
        const r = joy.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        let dx = e.clientX - cx;
        let dy = e.clientY - cy;
        const max = Math.max(34, r.width * 0.31);
        const len = Math.hypot(dx, dy) || 1;
        const scale = Math.min(1, max / len);
        dx *= scale;
        dy *= scale;
        knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';

        const nx = dx / max;
        const ny = dy / max;
        const next = [];
        if (Math.abs(nx) > 0.28) next.push(nx > 0 ? 39 : 37);
        if (Math.abs(ny) > 0.28) next.push(ny > 0 ? 40 : 38);
        setArrows(next);
    }

    joy.addEventListener('pointerdown', function(e) {
        e.preventDefault();
        joyPointer = e.pointerId;
        if (joy.setPointerCapture) joy.setPointerCapture(e.pointerId);
        updateJoy(e);
    });

    joy.addEventListener('pointermove', function(e) {
        if (e.pointerId !== joyPointer) return;
        e.preventDefault();
        updateJoy(e);
    });

    function endJoy(e) {
        if (joyPointer !== null && e && e.pointerId !== undefined && e.pointerId !== joyPointer) return;
        joyPointer = null;
        setArrows([]);
        knob.style.transform = 'translate(0px,0px)';
    }

    joy.addEventListener('pointerup', endJoy);
    joy.addEventListener('pointercancel', endJoy);
    joy.addEventListener('lostpointercapture', endJoy);

    // Existing game controls.
    bindKey('sl-confirm', 67);
    bindKey('sl-cancel', 88);
    bindKey('sl-bag', 83);
    bindKey('sl-equip', 65);

    // F5 = quick-slot setup, F6-F9 = slots 1-4.
    const config = document.getElementById('sl-config');
    if (config) {
        config.addEventListener('pointerdown', function(e) {
            e.preventDefault();
            config.classList.add('active');
            slTapKey(116);
        });
        config.addEventListener('pointerup', function() { config.classList.remove('active'); });
        config.addEventListener('pointercancel', function() { config.classList.remove('active'); });
    }

    [117, 118, 119, 120].forEach(function(code, index) {
        const button = document.getElementById('sl-q' + String(index + 1));
        if (!button) return;
        button.addEventListener('pointerdown', function(e) {
            e.preventDefault();
            button.classList.add('active');
            slTapKey(code);
        });
        button.addEventListener('pointerup', function() { button.classList.remove('active'); });
        button.addEventListener('pointercancel', function() { button.classList.remove('active'); });
    });

    resize();
}
