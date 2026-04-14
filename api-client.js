// ═══════════════════════════════════════════════════════════════════
//  CAFÉ LUX — API Client v2.5 (MAESTRO Voice Integrated)
//  • Powered by NextaGlobal Holding
//  • Integrated LUX AI Voice Engine (Arabic/French Support)
//  • Smart Sync & POS Employee Tracking
// ═══════════════════════════════════════════════════════════════════

(function(window) {
  'use strict';

  // ── CONFIG ─────────────────────────────────────────────────────
  const API_BASE     = window.LUX_API_URL || 'https://cafeslux-api-production.up.railway.app';
  const LS_PREFIX    = 'lux_';
  const SYNC_INTERVAL = 30000; 

  // ── STATE ──────────────────────────────────────────────────────
  let _token    = localStorage.getItem('lux_auth_token') || null;
  let _isOnline = navigator.onLine;

  // ── 🎙️ LUX AI VOICE ENGINE (محرك الصوت الجديد) ──────────────────
  window.luxVoice = {
    speak: function(text, lang = 'ar-SA') {
        if (!window.speechSynthesis) return;
        
        // إيقاف أي صوت يعمل حالياً لتجنب التداخل
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9; // سرعة هادئة وفخمة
        utterance.pitch = 1.0;
        
        // محاولة اختيار صوت احترافي
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes(lang) && (v.name.includes('Google') || v.name.includes('Premium')));
        if (preferredVoice) utterance.voice = preferredVoice;

        window.speechSynthesis.speak(utterance);
    },
    
    // صوت "Beep" احترافي للعمليات الناجحة
    playBeep: function() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch(e) { console.warn('Audio feedback blocked'); }
    }
  };

  // ── LUX AI INTEGRATION ──────────────────────────────────────────
  window.LuxAI = {
    async ask(prompt, context = '') {
        try {
            // منطق طلب الذكاء الاصطناعي
            const response = await fetch(API_BASE + '/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, context })
            }).then(r => r.json());

            if (response && response.text) {
                // تفعيل النطق التلقائي بمجرد وصول الرد
                window.luxVoice.speak(response.text, 'ar-SA');
                return response.text;
            }
        } catch (e) {
            console.error('LUX AI Error:', e);
            return "عذراً، واجهت مشكلة في الاتصال بمحرك NextaGlobal.";
        }
    }
  };

  // ── API METHODS ────────────────────────────────────────────────
  window.LuxAPI = {
    async saveTransaction(data) {
        // إضافة صوت تأكيد عند البيع
        window.luxVoice.playBeep();
        
        // إضافة معرف الموظف المسجل حالياً من نظام RFID/PIN
        const activeEmp = localStorage.getItem('lux_active_employee');
        if (activeEmp) data.employeeId = activeEmp;

        if (!_isOnline) {
            this._queueSync('transaction', data);
            return { success: true, offline: true };
        }
        return fetch(API_BASE + '/api/transactions/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(r => r.json());
    },

    _queueSync(type, data) {
        let q = JSON.parse(localStorage.getItem(LS_PREFIX + 'pending_sync') || '[]');
        q.push({ type, data, ts: Date.now() });
        localStorage.setItem(LS_PREFIX + 'pending_sync', JSON.stringify(q));
    },

    async init() {
        console.log('[MAESTRO OS] API v2.5 Initialized with Voice Engine');
        // تهيئة الأصوات في المتصفح
        if (window.speechSynthesis) window.speechSynthesis.getVoices();
    }
  };

  window.LuxAPI.init();

})(window);
