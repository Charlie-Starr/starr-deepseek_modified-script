// ==UserScript==
// @name          Starr (User API Key Edition) - Abacha Edition
// @namespace     http://tampermonkey.net/
// @version       8.6.0 // Split-Architecture Edition (Client)
// @description   Starr: A real human woman. Seductive, witty, naughty, cheeky, flirty. Now powered by your own OpenRouter API Key and a subscription backend.
// @match         *://*/*
// @downloadURL   https://charlie-starr.github.io/starr-deepseek_modified-script/Starr1Res.js
// @updateURL     https://charlie-starr.github.io/starr-deepseek_modified-script/Starr1Res.js
// @grant         GM_setValue
// @grant         GM_getValue
// @grant         GM_notification
// @grant         GM_xmlhttpRequest
// @grant         GM_setClipboard
// @connect       cqkezhynvlrzhwklxdtv.supabase.co
// @connect       charlie-starr.github.io
// @connect       api.paystack.co
// @connect       *
// ==/UserScript==

(function () {
    'use strict';

    // --- CONFIGURATION ---
    const REPLY_INPUT_SELECTOR = '#reply-textarea';
    const CONE_ID_UI_SELECTOR = '#app > main > div.flex-shrink-1 > nav > div:nth-child(3) > div > div.col-auto.navbar-text.fw-bold';
    const ALL_CUSTOMER_MESSAGES_SELECTOR = 'p[style="word-wrap: break-word"]';
    const CUSTOMER_INFO_SELECTORS = {
        customerId: 'div.d-flex.align-items-center > h5.fw-bold.mb-0',
        location: 'h6.text-black-50.mb-1',
        age: 'td.p-1.ps-3:not(.bg-light-subtle)',
        status: 'td.p-1.ps-3.bg-light-subtle',
        gender: null,
        localTime: '#memberTime',
        aboutUser: '#about-user'
    };
    
    // --- BACKEND & ASSET URLS ---
    const STARR_BACKEND_URL = "https://cqkezhynvlrzhwklxdtv.supabase.co/functions/v1/starr_backend";
    const VALIDATE_URL = "https://cqkezhynvlrzhwklxdtv.supabase.co/functions/v1/validate-cone";
    const CREATE_PAYMENT_URL = "https://cqkezhynvlrzhwklxdtv.supabase.co/functions/v1/create-payment";

    const PI_SOUND_URL = 'https://charlie-starr.github.io/starr-sound-assets/mixkit-elevator-tone-2863.wav';
    const VIOLATION_SOUND_URL = 'https://charlie-starr.github.io/starr-sound-assets/mixkit-interface-option-select-2573.wav';
    const TIMER_WARNING_CONFIG = {
        selector: '#timeoutTimer',
        sounds: {
            warning: 'https://charlie-starr.github.io/starr-sound-assets/mixkit-classic-alarm-995.wav',
            emergency: 'https://charlie-starr.github.io/starr-sound-assets/mixkit-facility-alarm-sound-999.wav'
        }
    };
    const SUMMARIZER_CONFIG = {
        longMessageChars: 300,
    };
    const AUTO_THEME_MAP = {
        night: 'theme-midnight',
        morning: 'bubblegum',
        afternoon: 'theme-valentine',
        evening: 'theme-halloween'
    };

    let isAuthorized = false, storedUserConeId = null,
        idMismatchActive = false,
        accessDeniedPermanent = false,
        isAutoThemeEnabled = false, textUnderScrutiny = '', isUIPopulated = false,
        isTimerWarningEnabled = true, isAudioUnlocked = false,
        lastProcessedMessageText = '',
        currentCustomerId = null;

    // --- All CSS, UI elements, and other script logic remains below ---
    const style = document.createElement("style");
    style.textContent = `
        /* Base styles for the popup and its elements */
        #starr-button {
            position: fixed; bottom: 20px; right: 20px;
            background: linear-gradient(135deg, #ff66cc 0%, #cc66ff 100%, #66ccff 200%);
            color: white; padding: 12px 20px; font-size: 16px; font-weight: bold;
            border: none; border-radius: 30px; cursor: pointer; z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); display: block;
        }
        #starr-button.animated {
            background-size: 400% 400%;
            animation:
                glow-border 8s ease-in-out infinite,
                change-color 10s ease-in-out infinite;
        }
        @keyframes glow-border {
            0%   { box-shadow: 0 0 20px #ff4da6; }
            20%  { box-shadow: 0 0 20px #4dffdb; }
            40%  { box-shadow: 0 0 20px #ffdb4d; }
            60%  { box-shadow: 0 0 20px #4d7bff; }
            80%  { box-shadow: 0 0 20px #a64dff; }
            100% { box-shadow: 0 0 20px #ff4da6; }
        }
        @keyframes change-color {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        #starr-popup {
            position: fixed; top: 50%; left: 50%;
            width: 840px; max-height: 90vh; background: var(--starr-popup-background);
            border: 2px solid var(--starr-border-color); border-radius: 20px; padding: 20px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2); z-index: 10001; display: none !important;
            flex-direction: column; font-family: Arial, sans-serif;
            justify-content: space-between; color: var(--starr-text-color);
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.98);
            transition: opacity 0.3s ease-out, transform 0.3s ease-out;
        }
        #starr-popup.visible {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        #starr-popup.settings-open { overflow-y: auto; }
        #chat-section {
            display: none; /* Initially hidden, JS will toggle to 'flex' */
            flex: 1; /* Allows this section to grow and shrink */
            flex-direction: column;
            min-height: 0; /* Prevents flexbox from overflowing its container */
        }
        #starr-minimize-button {
            position: absolute; top: 15px; right: 15px; background: #e0e0e0; color: #555;
            border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 20px;
            font-weight: bold; line-height: 24px; text-align: center; cursor: pointer; z-index: 10002;
            transition: transform 0.2s ease, background-color 0.2s ease;
        }
        #starr-minimize-button:hover { transform: scale(1.1); background-color: #d0d0d0; }
        .dark-mode #starr-minimize-button { background: #5a5a5a; color: #e0e0e0; }
        .dark-mode #starr-minimize-button:hover { background-color: #6a6a6a; }
        .starr-reply.selected-reply { border-color: var(--starr-send-button-bg); box-shadow: 0 0 5px var(--starr-send-button-bg); }
        .starr-reply.checking { opacity: 0.6; cursor: wait; position: relative; }
        .starr-reply.checking::after {
            content: '🧐'; position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%); font-size: 24px; animation: pulse 1s infinite;
        }
        @keyframes pulse {
            0% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.2); }
            100% { transform: translate(-50%, -50%) scale(1); }
        }
        #summary-and-pi-wrapper { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        #summary-and-pi-wrapper #starr-summary-container { flex-grow: 1; margin-bottom: 0; }
        #starr-summary-container { display: none; align-items: center; gap: 10px; margin-bottom: 10px; }
        #starr-summary-box {
            flex-grow: 1; padding: 8px; background-color: #f0f0f0; border-left: 3px solid #ccc;
            font-style: italic; color: #555; font-size: 0.9em; border-radius: 4px;
        }
        .dark-mode #starr-summary-box { background-color: #3a3a3a; border-left-color: #555; color: #ccc; }
        #starr-pi-scan-button {
            background: var(--starr-regenerate-button-bg); color: white; border: none;
            border-radius: 50%; width: 36px; height: 36px; font-size: 18px; cursor: pointer;
            flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 0;
            transition: transform 0.2s ease, background-color 0.3s ease;
        }
        #starr-pi-scan-button:hover { transform: scale(1.1) rotate(90deg); }
        #starr-pi-scan-button:disabled { cursor: not-allowed; filter: brightness(0.7); }
        #starr-input-container { display: flex; align-items: center; gap: 10px; }
        .spicy-regen-dropdown { position: relative; display: inline-block; }
        .spicy-regen-dropdown-content {
            display: none; position: absolute; bottom: 100%; right: 0;
            background-color: var(--starr-popup-background); min-width: 160px;
            box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2); z-index: 10002;
            border-radius: 4px; border: 1px solid var(--starr-border-color); overflow: hidden;
        }
        .spicy-regen-dropdown-content a { color: var(--starr-text-color); padding: 12px 16px; text-decoration: none; display: block; text-align: left; }
        .spicy-regen-dropdown-content a:hover { background-color: var(--starr-reply-background); }
        #starr-popup h3 {
            font-family: 'Georgia', serif; font-size: 26px; color: var(--starr-header-color);
            text-align: center; margin-bottom: 20px; padding-bottom: 10px;
            border-bottom: 2px solid var(--starr-header-border);
            font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
            transition: color 0.3s ease, border-color 0.3s ease, all 0.5s ease;
        }
        #starr-input, #cone-id-input {
            width: 100%; padding: 10px; margin-top: 10px; border-radius: 8px;
            border: 1px solid var(--starr-input-border); resize: vertical; min-height: 80px;
            font-size: 14px; margin-bottom: 15px; box-sizing: border-box; order: 1;
            background-color: var(--starr-input-background); color: var(--starr-input-text);
            transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
        }
        #starr-input { flex-grow: 1; }
        #cone-id-input { min-height: unset; }
        .starr-replies {
            margin-top: 0; display: flex; flex-direction: column; gap: 12px; width: 100%;
            flex-grow: 1; overflow-y: auto; padding-right: 5px; order: 2;
        }
        .starr-reply {
            background: var(--starr-reply-background); padding: 12px; border-radius: 12px;
            border: 1px solid var(--starr-reply-border); color: var(--starr-reply-text);
            white-space: pre-wrap; position: relative; font-size: 14px; cursor: pointer;
            transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease, opacity 0.3s ease;
        }
        #starr-buttons, #mismatch-section button {
            display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;
            margin-top: 15px; width: 100%; gap: 5px; order: 3;
        }
        #mismatch-section button { justify-content: center; }
        .starr-std-button, #starr-send, #starr-close, #starr-regenerate, #starr-force-key, #submit-cone-id, #starr-settings-button, .theme-button, .spicy-regen-main-button, #mismatch-retry-button {
            padding: 8px 12px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer;
            flex-grow: 1; flex-shrink: 1; flex-basis: auto; min-width: 70px; max-width: 100px;
            text-align: center; font-size: 12px;
            transition: background-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;
        }
        #mismatch-retry-button { background: var(--starr-send-button-bg); color: white; max-width: 120px; }
        .spicy-regen-main-button { max-width: 40px; min-width: 40px; padding: 8px 0; }
        #starr-send { background: var(--starr-send-button-bg); color: white; position: relative; overflow: hidden; }
        #starr-send.glow::before {
            content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
            background: radial-gradient(circle, var(--starr-send-button-glow-color) 0%, transparent 70%);
            animation: heatGlow 1.5s infinite alternate; z-index: 0; opacity: 0.7;
        }
        @keyframes heatGlow { 0% { transform: scale(0.8); opacity: 0.7; } 100% { transform: scale(1.2); opacity: 1; } }
        #starr-close { background: var(--starr-close-button-bg); color: var(--starr-close-button-text); }
        #starr-regenerate, .spicy-regen-main-button { background: var(--starr-regenerate-button-bg); color: white; }
        #starr-force-key { background: var(--starr-force-key-button-bg); color: white; }
        #submit-cone-id { background: var(--starr-submit-cone-id-button-bg); color: white; }
        .starr-loading {
            text-align: center; margin-top: 15px; font-size: 30px; color: var(--starr-loading-color);
            height: 40px; display: flex; justify-content: center; align-items: center; gap: 5px; order: 4;
            transition: color 0.3s ease;
        }
        .starr-loading .emoji { display: inline-block; animation: bounceEmoji 1s infinite alternate; }
        .starr-loading .emoji:nth-child(2) { animation-delay: 0.2s; }
        .starr-loading .emoji:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounceEmoji { from { transform: translateY(0); } to { transform: translateY(-5px); } }
        #starr-pi-editor-popup {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 450px; background: var(--starr-popup-background); border: 2px solid var(--starr-border-color);
            border-radius: 15px; padding: 20px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            z-index: 10003; display: none; flex-direction: column; gap: 10px; color: var(--starr-text-color);
            max-height: 80vh;
        }
        #starr-pi-editor-popup h4 { text-align: center; margin: 0 0 5px 0; color: var(--starr-header-color); }
        #starr-pi-editor-popup p { text-align: center; margin: 0 0 10px 0; font-size: 14px; }
        #starr-pi-editor-list {
            flex-grow: 1; overflow-y: auto; margin-bottom: 10px; display: flex;
            flex-direction: column; gap: 5px; padding-right: 5px;
        }
        .starr-pi-item { display: flex; align-items: center; gap: 8px; }
        .starr-pi-item input[type="checkbox"] { flex-shrink: 0; width: 16px; height: 16px; }
        .starr-pi-item input[type="text"] {
            flex-grow: 1; border: 1px solid var(--starr-input-border);
            background-color: var(--starr-input-background); color: var(--starr-input-text);
            padding: 4px; border-radius: 4px; font-size: 14px;
        }
        .pi-editor-buttons { display: flex; justify-content: flex-end; gap: 10px; margin-top: 5px; }
        .pi-editor-buttons button { padding: 8px 15px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; transition: background-color 0.3s ease, color 0.3s ease, content 0.3s ease; }
        #starr-pi-log-close { background: var(--starr-send-button-bg); color: white; }
        #starr-pi-close { background: var(--starr-close-button-bg); color: var(--starr-close-button-text); }
        #starr-violation-warning-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); z-index: 10003;
            display: none; justify-content: center; align-items: center;
        }
        #starr-violation-warning {
            width: 450px; background: #fff; border: 3px solid #d32f2f;
            border-radius: 15px; padding: 25px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
            display: flex; flex-direction: column; align-items: center; text-align: center;
            font-family: Arial, sans-serif;
        }
        .dark-mode #starr-violation-warning { background: #3c2f2f; border-color: #ff5252; color: #f2f2f2; }
        #violation-title { font-size: 24px; color: #d32f2f; margin: 0 0 10px 0; font-weight: bold; }
        .dark-mode #violation-title { color: #ff5252; }
        #violation-reason { font-size: 15px; margin: 0 0 20px 0; line-height: 1.4; }
        #violation-buttons { display: flex; justify-content: center; gap: 10px; width: 100%; }
        #violation-buttons button { padding: 10px 20px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; font-size: 14px; transition: transform 0.2s ease; flex-grow: 1; }
        #violation-buttons button:hover { transform: scale(1.05); }
        #violation-edit-anyway { background: #ffc107; color: #000; }
        #violation-el-vio { background: #0dcaf0; color: #000; }
        #violation-regenerate { background: #4caf50; color: #fff; }
        :root {
            --starr-popup-background: #ffffff; --starr-border-color: #ff66cc;
            --starr-header-color: #d10082; --starr-header-border: #ff99cc;
            --starr-input-border: #ff99cc; --starr-input-background: #ffffff; --starr-input-text: #333333;
            --starr-reply-background: #ffe6f2; --starr-reply-border: #ff99cc; --starr-reply-text: #b10082;
            --starr-send-button-bg: #cc66ff; --starr-send-button-glow-color: #ff3399;
            --starr-close-button-bg: #ffd6f5; --starr-close-button-text: #b10082;
            --starr-regenerate-button-bg: #66ccff; --starr-force-key-button-bg: #ff5e5e;
            --starr-submit-cone-id-button-bg: #cc66ff; --starr-loading-color: #ff66cc;
            --starr-auth-message-color: red; --starr-waiting-message-color: #d10082;
            --starr-settings-button-bg: #8844ee; --starr-settings-button-text: white;
            --starr-settings-panel-background: #f8f8f8; --starr-settings-panel-border: #cccccc;
            /* New Theme-aware variables for Pay/Auth UI */
            --starr-modal-bg: #ffffff;
            --starr-modal-text: #333333;
            --starr-modal-header: var(--starr-header-color);
            --starr-modal-input-bg: var(--starr-input-background);
            --starr-modal-input-border: var(--starr-input-border);
            --starr-modal-input-text: var(--starr-input-text);
            --starr-modal-button-primary-bg: var(--starr-send-button-bg);
            --starr-modal-button-secondary-bg: var(--starr-close-button-bg);
            --starr-modal-button-primary-text: white;
            --starr-modal-button-secondary-text: var(--starr-close-button-text);
            --starr-warning-bar-bg: linear-gradient(90deg, #ff0033, #cc0000);
            --starr-warning-bar-text: white;
            --starr-warning-bar-button-bg: white;
            --starr-warning-bar-button-text: #cc0000;
        }
        .dark-mode {
            --starr-popup-background: #2b2b2b; --starr-border-color: #6a0572;
            --starr-header-color: #e0b0ff; --starr-header-border: #a13d99;
            --starr-input-border: #a13d99; --starr-input-background: #3a3a3a; --starr-input-text: #e0e0e0;
            --starr-reply-background: #4a4a4a; --starr-reply-border: #6a0572; --starr-reply-text: #e0b0ff;
            --starr-send-button-bg: #7f00ff; --starr-send-button-glow-color: #e0b0ff;
            --starr-close-button-bg: #5a1c8f; --starr-close-button-text: #e0b0ff;
            --starr-regenerate-button-bg: #007bff; --starr-force-key-button-bg: #cc0000;
            --starr-submit-cone-id-button-bg: #7f00ff; --starr-loading-color: #e0b0ff;
            --starr-auth-message-color: #ff6666; --starr-waiting-message-color: #e0b0ff;
            --starr-settings-panel-background: #3a3a3a; --starr-settings-panel-border: #555555;
            --starr-modal-bg: #2b2b2b;
            --starr-modal-text: #e0e0e0;
            --starr-modal-input-bg: #3a3a3a;
            --starr-modal-input-text: #e0e0e0;
        }
        .theme-midnight {
            --starr-popup-background: #1a1a2e; --starr-border-color: #0f3460;
            --starr-header-color: #e0f2f7; --starr-header-border: #2e6099;
            --starr-input-border: #2e6099; --starr-input-background: #0f3460; --starr-input-text: #e0f2f7;
            --starr-reply-background: #2e6099; --starr-reply-border: #0f3460; --starr-reply-text: #e0f2f7;
            --starr-send-button-bg: #007bff; --starr-send-button-glow-color: #6495ed;
            --starr-close-button-bg: #16213e; --starr-close-button-text: #e0f2f7;
            --starr-regenerate-button-bg: #00bcd4; --starr-force-key-button-bg: #dc3545;
            --starr-submit-cone-id-button-bg: #007bff; --starr-loading-color: #6495ed;
            --starr-settings-panel-background: #16213e; --starr-settings-panel-border: #0f3460;
            --starr-modal-bg: #1a1a2e;
            --starr-modal-text: #e0f2f7;
            --starr-modal-input-bg: #0f3460;
            --starr-modal-input-text: #e0f2f7;
        }
        .theme-halloween {
            --starr-popup-background: #1a1a1a; --starr-border-color: #8b0000;
            --starr-header-color: #ff4500; --starr-header-border: #cc0000;
            --starr-input-border: #cc0000; --starr-input-background: #330000; --starr-input-text: #ff8c00;
            --starr-reply-background: #440000; --starr-reply-border: #8b0000; --starr-reply-text: #ff4500;
            --starr-send-button-bg: #ff4500; --starr-send-button-glow-color: #ffa500;
            --starr-close-button-bg: #660000; --starr-close-button-text: #ff8c00;
            --starr-regenerate-button-bg: #4b0082; --starr-force-key-button-bg: #8b0000;
            --starr-submit-cone-id-button-bg: #ff4500; --starr-loading-color: #ffa500;
            --starr-settings-panel-background: #333333; --starr-settings-panel-border: #444444;
            --starr-modal-bg: #1a1a1a;
            --starr-modal-text: #ff8c00;
            --starr-modal-input-bg: #330000;
            --starr-modal-input-text: #ff8c00;
        }
        .theme-valentine {
            --starr-popup-background: #ffe6f2; --starr-border-color: #e04482;
            --starr-header-color: #a02040; --starr-header-border: #ff69b4;
            --starr-input-border: #ff69b4; --starr-input-background: #ffffff; --starr-input-text: #333333;
            --starr-reply-background: #fbc2eb; --starr-reply-border: #e04482; --starr-reply-text: #a02040;
            --starr-send-button-bg: #ff1493; --starr-send-button-glow-color: #ff69b4;
            --starr-close-button-bg: #f7a2d6; --starr-close-button-text: #a02040;
            --starr-regenerate-button-bg: #b364e7; --starr-force-key-button-bg: #cc3333;
            --starr-submit-cone-id-button-bg: #ff1493; --starr-loading-color: #ff69b4;
            --starr-settings-panel-background: #fff0f5; --starr-settings-panel-border: #e04482;
            --starr-modal-bg: #ffe6f2;
            --starr-modal-text: #a02040;
            --starr-modal-input-bg: #ffffff;
            --starr-modal-input-text: #333333;
        }
        .theme-warning-orange {
            --starr-popup-background: #3d2c20; --starr-border-color: #ff8c00;
            --starr-header-color: #ffae42; --starr-header-border: #e67e22;
            --starr-input-border: #e67e22; --starr-input-background: #4d3625; --starr-input-text: #ffd3a1;
            --starr-reply-background: #5a3f2a; --starr-reply-border: #ff8c00; --starr-reply-text: #ffae42;
            --starr-send-button-bg: #ff8c00; --starr-send-button-glow-color: #ffa500;
            --starr-close-button-bg: #6b4b32; --starr-close-button-text: #ffae42;
            --starr-regenerate-button-bg: #e67e22;
        }
        .theme-warning-orange #starr-popup { animation: pulseGlowOrange 2s infinite alternate; }
        .theme-warning-orange #starr-popup h3 { animation: blinkOrangeText 1.5s infinite; }
        @keyframes pulseGlowOrange {
            from { box-shadow: 0 0 15px rgba(255, 140, 0, 0.4), 0 8px 20px rgba(0, 0, 0, 0.2); }
            to { box-shadow: 0 0 30px rgba(255, 165, 0, 0.8), 0 8px 20px rgba(0, 0, 0, 0.2); }
        }
        @keyframes blinkOrangeText { 50% { opacity: 0.6; } }
        .theme-emergency-red {
            --starr-popup-background: #3b1e1e; --starr-border-color: #ff1111;
            --starr-header-color: #ff4f4f; --starr-header-border: #cc0000;
            --starr-input-border: #cc0000; --starr-input-background: #4b2323; --starr-input-text: #ffc2c2;
            --starr-reply-background: #5a2a2a; --starr-reply-border: #ff1111; --starr-reply-text: #ff4f4f;
            --starr-send-button-bg: #ff1111; --starr-send-button-glow-color: #ff4f4f;
            --starr-close-button-bg: #6a3131; --starr-close-button-text: #ff4f4f;
            --starr-regenerate-button-bg: #cc0000;
        }
        .theme-emergency-red #starr-popup { border-width: 3px; animation: blinkRedBorder 1s infinite; }
        .theme-emergency-red #starr-popup h3 { animation: blinkRedText 1s infinite; }
        @keyframes blinkRedBorder { 50% { border-color: #990000; } }
        @keyframes blinkRedText { 50% { color: #cc0000; } }
        #starr-settings-panel {
            display: none; flex-direction: column; gap: 10px; margin-top: 15px; padding: 15px;
            border: 1px solid var(--starr-settings-panel-border); border-radius: 10px;
            background-color: var(--starr-settings-panel-background);
            transition: background-color 0.3s ease, border-color 0.3s ease;
        }
        .settings-section-header { font-weight: bold; margin-top: 10px; margin-bottom: 5px; color: var(--starr-header-color); border-bottom: 1px solid var(--starr-header-border); padding-bottom: 3px; }
        #starr-settings-panel label { display: flex; align-items: center; gap: 8px; color: var(--starr-text-color); }
        #starr-settings-panel label small { font-style: italic; opacity: 0.8; }
        #starr-settings-panel input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
        #starr-settings-panel select {
             background-color: var(--starr-input-background); color: var(--starr-input-text);
             border: 1px solid var(--starr-input-border); border-radius: 4px; padding: 5px;
        }
        .theme-buttons-container { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 5px; }
        .theme-button {
            background-color: var(--starr-settings-button-bg); color: var(--starr-settings-button-text);
            padding: 6px 10px; flex-grow: 0; min-width: unset; max-width: unset;
        }
        .ui-portrait #starr-popup {
            width: 95% !important; max-width: 380px !important; margin: auto;
            max-height: 85vh; flex-direction: column;
        }
        .ui-portrait #starr-pi-editor-popup { width: 90vw; max-width: 350px; }
        .ui-portrait #chat-section { min-height: 0; flex-shrink: 1; }
        .ui-portrait #starr-popup h3 { font-size: 22px; margin-bottom: 10px; }
        .ui-portrait #starr-input { min-height: 60px; margin-bottom: 10px; }
        .ui-portrait #starr-buttons { flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 10px; }
        .ui-portrait #starr-buttons button,
        .ui-portrait #starr-buttons .spicy-regen-main-button {
            font-size: 18px; padding: 8px; border-radius: 50%; width: 40px; height: 40px;
            display: flex; align-items: center; justify-content: center;
            flex-grow: 0; flex-shrink: 0; min-width: 40px; max-width: 40px;
        }
        .ui-portrait #spicy-regen-container { flex-basis: auto; }

        /* --- THEME-AWARE AUTH & PAYMENT UI STYLES --- */
        #starr-expiry-redbar {
            position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
            display: none; align-items: center; justify-content: center; padding: 10px 14px;
            background: var(--starr-warning-bar-bg); color: var(--starr-warning-bar-text);
            font-weight: 700; font-family: inherit; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            animation: starr-blinker 1.5s linear infinite;
        }
        @keyframes starr-blinker { 50% { opacity: 0.6; } }
        #starr-expiry-redbar button {
            background: var(--starr-warning-bar-button-bg); color: var(--starr-warning-bar-button-text);
            padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-weight: 700;
            margin-left: 15px;
        }
        .starr-auth-overlay {
            position: fixed; inset: 0; z-index: 2147483645;
            background: rgba(0,0,0,0.75);
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(5px);
        }
        .starr-auth-modal {
            background: var(--starr-modal-bg); color: var(--starr-modal-text);
            padding: 25px; border-radius: 15px; border: 2px solid var(--starr-border-color);
            max-width: min(720px, 90vw); text-align: center;
            box-shadow: 0 8px 30px rgba(0,0,0,0.5);
        }
        .starr-auth-modal h3, .starr-auth-modal h2 {
            margin: 0 0 10px 0; font-family: 'Georgia', serif;
            color: var(--starr-modal-header);
        }
        .starr-auth-modal p { margin: 0 0 15px 0; opacity: 0.9; }
        .starr-auth-modal .starr-auth-buttons { display: flex; gap: 10px; justify-content: center; }
        #starr-payment-modal-content {
            background: var(--starr-modal-bg); color: var(--starr-modal-text);
            padding: 25px; border-radius: 15px; border: 2px solid var(--starr-border-color);
            width: min(720px, 95%); font-family: inherit;
        }
        #starr-payment-modal-content input {
            width: 100%; box-sizing: border-box; padding: 10px; border-radius: 8px;
            border: 1px solid var(--starr-modal-input-border);
            background: var(--starr-modal-input-bg); color: var(--starr-modal-input-text);
        }
        .starr-plan-btn {
            background: var(--starr-modal-button-secondary-bg); color: var(--starr-modal-button-secondary-text);
            opacity: 0.7; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer;
        }
        .starr-plan-btn.selected {
            opacity: 1;
            box-shadow: 0 0 8px var(--starr-send-button-bg);
            border: 1px solid var(--starr-send-button-bg);
        }
        #starr-payment-notification {
            color: var(--starr-auth-message-color);
            font-size: 0.9em;
            height: 1.2em;
            margin-top: 8px;
        }
        .primary-action {
            background: var(--starr-modal-button-primary-bg) !important;
            color: var(--starr-modal-button-primary-text) !important;
        }
        .secondary-action {
            background: var(--starr-modal-button-secondary-bg) !important;
            color: var(--starr-modal-button-secondary-text) !important;
        }
    `;
    document.head.appendChild(style);

    const button = document.createElement("button");
    button.id = "starr-button";
    button.textContent = "Flirt with Starr 🥰";
    document.body.appendChild(button);

    const popup = document.createElement("div");
    popup.id = "starr-popup";
    popup.innerHTML = `
        <button id="starr-minimize-button" title="Minimize (Ctrl+M)">−</button>
        <h3 id="starr-header">Talk to Starr, baby💦...</h3>
        <div id="auth-section">
            <p>Please enter your CONE ID to access Starr:</p>
            <input type="text" id="cone-id-input" placeholder="Enter CONE ID" style="width: 100%; padding: 8px; margin-bottom: 10px; border-radius: 5px; border: 1px solid #ccc;">
            <button id="submit-cone-id">Submit</button>
            <p id="auth-message" style="color: var(--starr-auth-message-color); margin-top: 10px; min-height: 1.2em;"></p>
        </div>
        <div id="mismatch-section" style="display: none; text-align: center;">
            <h3 id="starr-header" style="color: red;">ACCESS DENIED</h3>
            <p style="color: var(--starr-auth-message-color); font-weight: bold; font-size: 1.1em; line-height: 1.4;">
                YOUR CONE ID ON THE SITE DOESN'T MATCH THE ONE YOU ENTERED, OR IT'S NOT AUTHORIZED. THIS STARR ISN'T FOR YOU 💔.
            </p>
            <p style="margin-top: 20px; font-weight: bold;">WANNA RETRY?</p>
            <div style="display: flex; justify-content: center; margin-top: 10px;">
                <button id="mismatch-retry-button">Retry</button>
            </div>
        </div>
        <div id="chat-section">
            <div id="summary-and-pi-wrapper">
                <div id="starr-summary-container">
                    <div id="starr-summary-box"></div>
                </div>
                <button id="starr-pi-scan-button" title="Intelligently scan for personal info (Tab)">♻️</button>
            </div>
            <textarea id="starr-input" placeholder="Tell Starr something juicy..."></textarea>
            <div class="starr-replies" id="starr-responses"></div>
            <div id="starr-loading" class="starr-loading" style="display: none;">
                <span class="emoji">😘</span><span class="emoji">🥰</span><span class="emoji">💋</span>
            </div>
            <div id="starr-buttons">
                <button id="starr-send" title="Send (Enter or Ctrl+Enter)">Send</button>
                <button id="starr-regenerate" title="Regenerate (Ctrl+R)">Regenerate</button>
                <div id="spicy-regen-container" title="Spicy Regenerate Options (Ctrl+Shift+R)"></div>
                <button id="starr-force-key" title="Force New API Key (Ctrl+Shift+K)">Force New API Key</button>
                <button id="starr-settings-button" title="Settings (T)">Settings</button>
                <button id="starr-close" title="Close (Esc)">Close</button>
            </div>
            <div id="starr-settings-panel">
                <h4 class="settings-section-header">UI Settings</h4>
                <label> <input type="checkbox" id="dark-mode-toggle"> Dark Mode </label>
                <label> <input type="checkbox" id="auto-theme-toggle"> Auto Theme by Time </label>
                <label> <input type="checkbox" id="timer-warning-toggle" checked> Cinematic Timer Alerts </label>
                <label> <input type="checkbox" id="send-button-glow-toggle" checked> Send Button Glow </label>
                <label> <input type="checkbox" id="stylish-button-toggle" checked> Stylish Button Animation </label>
                <label> <input type="checkbox" id="voice-reply-toggle" checked> Voice Reply Mode </label>
                <div class="ui-mode-switcher" style="margin-top: 10px;">
                     <label for="starr-ui-mode-select" style="display: block; margin-bottom: 5px;">UI Mode:</label>
                     <select id="starr-ui-mode-select">
                        <option value="landscape">💻 Landscape (Desktop)</option>
                        <option value="portrait">📱 Portrait (Mobile)</option>
                     </select>
                </div>

                <h4 class="settings-section-header">Feature Settings</h4>
                <label> <input type="checkbox" id="multi-response-toggle"> Enable Multi-Response Mode </label>
                <label> <input type="checkbox" id="pi-scan-toggle" checked> Show PI Scan Button </label>
                <label> <input type="checkbox" id="summary-toggle" checked> Enable Summary for Long Messages </label>
                <div class="model-switcher" style="margin-top: 10px;">
                     <label for="starr-engine-select" style="display: block; margin-bottom: 5px;">Response Style Engine:</label>
                     <select id="starr-engine-select">
                        <option value="zinat">Zinat (Recommended)</option>
                        <option value="bimbo">Bimbo</option>
                        <option value="chioma">Chioma</option>
                     </select>
                </div>

                <h4 class="settings-section-header">Violation Checker</h4>
                <label>
                    <input type="checkbox" id="regex-checker-toggle" checked> Enable Regex Checker (Fast & Free)
                </label>
                <label>
                    <input type="checkbox" id="llm-checker-toggle"> Enable AI Judge (Smart & Context-Aware)<br>
                </label>
                 <small style="margin-left: 24px; margin-top: -5px; display: block;">(Minimal token use; highly recommended for accuracy)</small>


                <div class="theme-switcher">
                    <h4 class="settings-section-header">Theme</h4>
                    <div class="theme-buttons-container">
                        <button class="theme-button" data-theme="bubblegum">Bubblegum</button>
                        <button class="theme-button" data-theme="midnight">Midnight</button>
                        <button class="theme-button" data-theme="halloween">Halloween</button>
                        <button class="theme-button" data-theme="valentine">Valentine</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(popup);

    const piEditorPopup = document.createElement("div");
    piEditorPopup.id = "starr-pi-editor-popup";
    piEditorPopup.innerHTML = `
        <h4>Detected Personal Info</h4>
        <p>Check items to log. You can also edit the text.</p>
        <div id="starr-pi-editor-list"></div>
        <div class="pi-editor-buttons">
            <button id="starr-pi-log-close">Log Checked & Close</button>
            <button id="starr-pi-close">Close</button>
        </div>
    `;
    document.body.appendChild(piEditorPopup);

    const violationWarningOverlay = document.createElement("div");
    violationWarningOverlay.id = "starr-violation-warning-overlay";
    violationWarningOverlay.innerHTML = `
        <div id="starr-violation-warning">
            <div id="violation-title">⚠️ Rule Violation Detected!</div>
            <p id="violation-reason"></p>
            <div id="violation-buttons">
                <button id="violation-edit-anyway" title="Edit Manually (Enter)">Edit Anyway</button>
                <button id="violation-el-vio" title="Auto-Fix Violation (Ctrl+Enter)">EL-VIO</button>
                <button id="violation-regenerate" title="Regenerate Response (Ctrl+R)">Regenerate</button>
            </div>
        </div>
    `;
    document.body.appendChild(violationWarningOverlay);

    const warningSound = new Audio(TIMER_WARNING_CONFIG.sounds.warning);
    warningSound.loop = true;
    const emergencySound = new Audio(TIMER_WARNING_CONFIG.sounds.emergency);
    emergencySound.loop = true;
    const piSound = new Audio(PI_SOUND_URL);
    const violationSound = new Audio(VIOLATION_SOUND_URL);

    const starrHeader = document.getElementById("starr-header");
    const starrResponses = document.getElementById("starr-responses");
    const starrInput = document.getElementById("starr-input");
    const starrLoading = document.getElementById("starr-loading");
    const authSection = document.getElementById("auth-section");
    const chatSection = document.getElementById("chat-section");
    const coneIdInput = document.getElementById("cone-id-input");
    const submitConeIdButton = document.getElementById("submit-cone-id");
    const authMessage = document.getElementById("auth-message");
    const starrSettingsButton = document.getElementById("starr-settings-button");
    const starrSettingsPanel = document.getElementById("starr-settings-panel");
    const darkModeToggle = document.getElementById("dark-mode-toggle");
    const autoThemeToggle = document.getElementById("auto-theme-toggle");
    const summaryToggle = document.getElementById("summary-toggle");
    const piScanToggle = document.getElementById("pi-scan-toggle");
    const summaryContainer = document.getElementById("starr-summary-container");
    const piScanButton = document.getElementById("starr-pi-scan-button");
    const sendButtonGlowToggle = document.getElementById("send-button-glow-toggle");
    const starrSendButton = document.getElementById("starr-send");
    const themeButtons = document.querySelectorAll(".theme-button");
    const voiceReplyToggle = document.getElementById("voice-reply-toggle");
    const piEditorList = document.getElementById('starr-pi-editor-list');
    const piLogCloseButton = document.getElementById('starr-pi-log-close');
    const piCloseButton = document.getElementById('starr-pi-close');
    const violationReason = document.getElementById('violation-reason');
    const violationEditButton = document.getElementById('violation-edit-anyway');
    const violationRegenerateButton = document.getElementById('violation-regenerate');
    const regexCheckerToggle = document.getElementById('regex-checker-toggle');
    const llmCheckerToggle = document.getElementById('llm-checker-toggle');
    const minimizeButton = document.getElementById('starr-minimize-button');
    const timerWarningToggle = document.getElementById('timer-warning-toggle');
    const modelEngineSelect = document.getElementById('starr-engine-select');
    const uiModeSelect = document.getElementById('starr-ui-mode-select');
    const stylishButtonToggle = document.getElementById('stylish-button-toggle');
    const violationElVioButton = document.getElementById('violation-el-vio');
    const mismatchSection = document.getElementById('mismatch-section');
    const mismatchRetryButton = document.getElementById('mismatch-retry-button');
    const multiResponseToggle = document.getElementById('multi-response-toggle');

    let conversationHistory = [];
    let selectedReplyIndex = -1;

    // --- All functions below ---

    // ---- BEGIN STARR FRONTEND AUTH + PAY TRANSPLANT ----

    async function redirectToCheckout(coneId, weeks, email, notificationEl) {
        try {
            notificationEl.textContent = "Generating secure payment link...";
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "POST",
                    url: CREATE_PAYMENT_URL,
                    headers: { "Content-Type": "application/json" },
                    data: JSON.stringify({ cone_id: coneId, weeks, email }),
                    onload: res => resolve(res),
                    onerror: err => reject(err)
                });
            });

            if (response.status < 200 || response.status >= 300) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = JSON.parse(response.responseText);
            if (data.success && data.data.authorization_url) {
                window.location.href = data.data.authorization_url;
            } else {
                console.error("Payment init failed:", data);
                notificationEl.textContent = data.error || "Payment initialization failed. Please try again.";
            }
        } catch (err) {
            console.error("Checkout redirection error:", err);
            notificationEl.textContent = "A network error occurred. Please check your connection.";
        }
    }

    function starrSetMessage(msg, isError = true) {
        GM_setValue('starr_auth_message', msg);
        if (authMessage) {
            authMessage.textContent = msg;
            authMessage.style.color = isError ? 'var(--starr-auth-message-color)' : 'var(--starr-waiting-message-color)';
        }
        console.log("[StarrAuth]", msg);
    }

    function removeRedWarningBar() {
        const ex = document.getElementById('starr-expiry-redbar');
        if (ex) {
            ex.style.display = 'none';
        }
    }

    function ensureRedWarningBar(daysLeft, coneId, isDismissible = false) {
        const text = `Mmm, baby... Your subscription expires in ${daysLeft} day${daysLeft > 1 ? "s" : ""}. Please renew now to keep the fun going.`;
        let bar = document.getElementById('starr-expiry-redbar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'starr-expiry-redbar';
            bar.style.position = 'relative'; // For absolute positioning of close button
            document.documentElement.appendChild(bar);
            bar.innerHTML = `<div class="starr-redbar-text" style="flex-grow:1; text-align:center;"></div><button id="starr-redbar-subbtn" class="starr-std-button">RENEW</button>`;
            document.getElementById('starr-redbar-subbtn').addEventListener('click', async () => {
                 const currentConeId = await GM_getValue('user_cone_id', null);
                 if(currentConeId) openPayModal(currentConeId, 'subscribe', 1, '');
            });
        }

        bar.querySelector('.starr-redbar-text').textContent = text;

        let closeBtn = document.getElementById('starr-redbar-closebtn');
        if (isDismissible) {
            if (!closeBtn) {
                closeBtn = document.createElement('button');
                closeBtn.id = 'starr-redbar-closebtn';
                closeBtn.innerHTML = '&times;';
                closeBtn.style.cssText = 'background:none; border:none; color:white; font-size: 24px; cursor:pointer; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); padding: 0 5px; line-height: 1;';
                closeBtn.onclick = async () => {
                    removeRedWarningBar();
                    await GM_setValue('starr_warning_dismissed_at', Date.now());
                };
                bar.appendChild(closeBtn);
            }
        } else {
            if (closeBtn) {
                closeBtn.remove();
            }
        }
        bar.style.display = 'flex';
    }

    function showPaymentModal(innerHtml) {
        const old = document.getElementById('starr-payment-modal-overlay');
        if (old) old.remove();
        const div = document.createElement('div');
        div.id = 'starr-payment-modal-overlay';
        div.className = 'starr-auth-overlay';
        div.innerHTML = `<div id="starr-payment-modal-content">
            ${innerHtml}
            <div style="text-align:right; margin-top:12px">
                <button id="starr-pay-close" class="starr-std-button secondary-action">Close</button>
            </div>
        </div>`;
        document.body.appendChild(div);
        document.getElementById('starr-pay-close').onclick = () => div.remove();
        return div;
    }

    async function openPayModal(coneId, mode = 'subscribe', defaultWeeks = 1, email = '', debtAmount = 0) {
        const title = mode === 'debt' ? 'Clear Your Debt to Continue' : 'Subscribe / Renew Starr';

        let plansHTML = '';
        if (mode === 'debt' && debtAmount > 0) {
            plansHTML = `
                <div style="display:flex;justify-content:center;margin-bottom:12px">
                    <button class="starr-plan-btn selected" data-weeks="1" disabled style="cursor:default;opacity:1;padding:12px 20px;">Amount Due: ₦${debtAmount.toLocaleString()}</button>
                </div>
            `;
        } else {
            plansHTML = `
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
                    <button class="starr-plan-btn" data-weeks="1">1w - ₦5,000</button>
                    <button class="starr-plan-btn" data-weeks="2">2w - ₦10,000</button>
                    <button class="starr-plan-btn" data-weeks="3">3w - ₦15,000</button>
                    <button class="starr-plan-btn" data-weeks="4">4w - ₦20,000</button>
                </div>
            `;
        }

        const html = `
            <h2 style="margin:0 0 8px 0;font-size:18px">Starr — ${title}</h2>
            <p style="margin:0 0 12px 0">${mode === 'debt' ? 'Omo you dey owe. Balance up, no vex.' : 'Select a plan to subscribe, baby.'}</p>
            ${plansHTML}
            <div style="margin-bottom:8px">
                <input id="starr-pay-email" value="${email || ''}" placeholder="Email for receipt" />
            </div>
            <div id="starr-payment-notification"></div>
            <div style="text-align:right">
                <button id="starr-pay-now" class="starr-std-button primary-action">Pay Now</button>
            </div>
        `;
        const modal = showPaymentModal(html);
        const notificationEl = modal.querySelector('#starr-payment-notification');

        if (mode === 'debt' && debtAmount > 0) {
            modal.dataset.weeks = "1"; // Auto-select the debt payment, backend will use the real debt amount
        } else {
            modal.querySelectorAll('.starr-plan-btn').forEach(b => {
                b.addEventListener('click', () => {
                    modal.querySelectorAll('.starr-plan-btn').forEach(x => x.classList.remove('selected'));
                    b.classList.add('selected');
                    modal.dataset.weeks = b.dataset.weeks;
                });
            });

            const defaultButton = modal.querySelector(`[data-weeks="${defaultWeeks}"]`);
            if (defaultButton) defaultButton.click();
        }

        modal.querySelector('#starr-pay-now').addEventListener('click', async () => {
            const weeks = Number(modal.dataset.weeks || 1);
            const emailInput = modal.querySelector('#starr-pay-email').value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailInput) {
                notificationEl.textContent = "Please enter an email for your receipt, honey.";
                return;
            }
            if (!emailRegex.test(emailInput)) {
                notificationEl.textContent = "That email doesn't look right, baby. Please check it.";
                return;
            }

            const [localPart, domain] = emailInput.split('@');
            const emailVal = `${localPart.split('+')[0]}+${Date.now()}@${domain}`;

            await redirectToCheckout(coneId, weeks, emailVal, notificationEl);
        });
    }

    function showBlockingUI(coneId, title, message, buttonText, buttonAction) {
        const overlayId = 'starr-block-overlay';
        const oldOverlay = document.getElementById(overlayId);
        if (oldOverlay) oldOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = overlayId;
        overlay.className = 'starr-auth-overlay';

        overlay.innerHTML = `
            <div class="starr-auth-modal">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="starr-auth-buttons">
                    <button id="starr-subscribe-btn" class="starr-std-button primary-action">${buttonText}</button>
                    ${buttonText.toLowerCase() === 'subscribe' ? `<button id="starr-close-lite" class="starr-std-button secondary-action">CLOSE</button>` : ''}
                </div>
            </div>`;

        document.documentElement.appendChild(overlay);

        document.getElementById('starr-subscribe-btn').addEventListener('click', () => {
            overlay.remove();
            buttonAction();
        });

        const closeBtn = document.getElementById('starr-close-lite');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => overlay.remove());
        }
    }

    async function checkConeStatusAndAct(coneId, forcePopupUpdate = false, isUserInitiated = false) {
        if (!coneId) {
             isAuthorized = false;
             accessDeniedPermanent = false;
             await GM_setValue('starr_subscription_status', null);
             if (forcePopupUpdate) updatePopupUI(true);
             return;
        }
        try {
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "POST", url: VALIDATE_URL, headers: { "Content-Type": "application/json" },
                    data: JSON.stringify({ cone_id: coneId }),
                    onload: res => resolve(res), onerror: err => reject(err)
                });
            });

            if (response.status < 200 || response.status >= 300) throw new Error("API Error");

            const data = JSON.parse(response.responseText);
            await GM_setValue('starr_subscription_status', data); // Cache the latest status
            console.log("[validate-cone]", data);

            const oldOverlay = document.getElementById('starr-block-overlay');
            if (oldOverlay) oldOverlay.remove();
            // removeRedWarningBar is handled by the polling checkSubscriptionWarning function
            isAuthorized = false;
            accessDeniedPermanent = false;

            if (data.status === "active") {
                isAuthorized = true;
                starrSetMessage("✅ Subscription active. Welcome back!", false);
                // The subscription warning bar is now handled exclusively by the checkSubscriptionWarning poll.
                if(forcePopupUpdate) updatePopupUI(true);
                return;
            }

            accessDeniedPermanent = true;

            if (data.status === "debt") {
                const bal = data.balance_due ?? 0;
                starrSetMessage(`Omo you dey owe ₦${bal}. Balance up, no vex`);
                if (isUserInitiated) {
                    showBlockingUI(coneId, `Owe ₦${bal}`, "You need to clear this debt before you can subscribe again.", "CLEAR BALANCE", () => openPayModal(coneId, 'debt', 1, '', bal));
                }
            } else if (data.status === "expired" || data.status === "not_found") {
                const msg = data.status === "expired"
                    ? "Ogbeni pay money joor... Your sub don finish. You dey whine?"
                    : "I don't know you yet, baby. Subscribe to register your Cone ID.";
                starrSetMessage(msg);
                if (isUserInitiated) {
                    showBlockingUI(coneId, "Subscription Required", msg, "SUBSCRIBE", () => openPayModal(coneId, 'subscribe', 1, ''));
                }
            }
        } catch (err) {
            console.error("checkConeStatusAndAct err", err);
            starrSetMessage("Error checking subscription. Try again later.");
            accessDeniedPermanent = true;
            await GM_setValue('starr_subscription_status', null);
        } finally {
             if (accessDeniedPermanent && forcePopupUpdate) {
                updatePopupUI(true);
             }
        }
    }

    async function checkSubscriptionWarning() {
        if (!isAuthorized) {
            removeRedWarningBar();
            return;
        }
        const status = await GM_getValue('starr_subscription_status', null);
        const coneId = await GM_getValue('user_cone_id', null);

        if (!status || status.status !== 'active' || !coneId) {
            removeRedWarningBar();
            return;
        }

        const daysLeft = status.days_left;
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;

        if (daysLeft === 1) {
            // Persistent warning for 1 day left.
            ensureRedWarningBar(daysLeft, coneId, false);
        } else if (daysLeft === 2) {
            // Dismissible warning, shows again after 10 mins.
            const dismissedAt = await GM_getValue('starr_warning_dismissed_at', 0);
            if (now - dismissedAt > tenMinutes) {
                ensureRedWarningBar(daysLeft, coneId, true);
            } else {
                removeRedWarningBar();
            }
        } else {
            // Not expiring soon.
            removeRedWarningBar();
        }
    }

    async function starrAutoCheckOnLoad() {
        try {
            const saved = await GM_getValue('user_cone_id', null);
            storedUserConeId = saved;
            if (saved) {
                console.log(`Found saved CONE ID: ${saved}. Validating in background...`);
                await checkConeStatusAndAct(saved, false, false);
            }
        } catch (e) { console.error(e); }
    }

    // Refresh subscription status from network periodically
    setInterval(async () => {
        try {
            if (isAuthorized) {
                const saved = await GM_getValue('user_cone_id', null);
                if (saved) await checkConeStatusAndAct(saved, false, false);
            }
        } catch (e) { console.error(e); }
    }, 1000 * 60 * 15); // 15 minutes

    // ---- END STARR FRONTEND AUTH + PAY TRANSPLANT ----

    // --- HELPER FUNCTIONS ---
    function getLatestMessage() { const messages = document.querySelectorAll(ALL_CUSTOMER_MESSAGES_SELECTOR); return messages.length > 0 ? messages[messages.length - 1].innerText.trim() : ''; }
    function getPersonaInfo() { const nameEl = document.querySelector('h5.fw-bold.mb-1'); let name = nameEl ? nameEl.textContent.trim().split('(')[1]?.replace(')', '') || nameEl.textContent.trim() : "the other person"; return { name: name, status: document.querySelector('td.p-1.ps-3.bg-light-subtle')?.textContent.trim() || "unknown", age: document.querySelector('td.p-1.ps-3:not(.bg-light-subtle)')?.textContent.trim() || "unknown", location: document.querySelector('h6.text-black-50')?.textContent.trim() || "an unknown location", about: document.querySelector('#about-profile')?.textContent.trim() || null }; }
    function getCustomerInfo() { return { gender: "male", status: document.querySelector(CUSTOMER_INFO_SELECTORS.status)?.textContent.trim() || "unknown", age: document.querySelector(CUSTOMER_INFO_SELECTORS.age)?.textContent.trim() || "unknown", location: document.querySelector(CUSTOMER_INFO_SELECTORS.location)?.textContent.trim() || "your area", about: document.querySelector(CUSTOMER_INFO_SELECTORS.aboutUser)?.textContent.trim() || null }; }
    function getTimeOfDay() { const timeEl = document.querySelector(CUSTOMER_INFO_SELECTORS.localTime); if (!timeEl) return "the current time"; const hour = parseInt(timeEl.textContent.trim().split(':')[0], 10); if (isNaN(hour)) return "the current time"; if (hour >= 5 && hour < 12) return "morning"; if (hour >= 12 && hour < 18) return "afternoon"; if (hour >= 18 && hour < 21) return "evening"; return "night"; }
    function buildFullConversationHistory() { const history = []; document.querySelectorAll('div.my-2').forEach(el => { const p = el.querySelector(ALL_CUSTOMER_MESSAGES_SELECTOR); if (p && p.innerText.trim()) { history.push({ role: el.classList.contains('flex-row-reverse') ? 'user' : 'assistant', content: p.innerText.trim() }); } }); return history; }
    async function imageToDataURI(url) { const response = await fetch(url); const blob = await response.blob(); return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); }); }

    async function checkAndSummarize() {
        const isSummaryEnabled = GM_getValue('starr_summary_enabled', true);
        const lastMessage = getLatestMessage();
        if (!isSummaryEnabled || lastMessage.length < SUMMARIZER_CONFIG.longMessageChars) {
            summaryContainer.style.display = 'none';
            return;
        }
        await forceSummary(true);
    }

    async function forceSummary(isAuto = false) {
        const isSummaryEnabled = GM_getValue('starr_summary_enabled', true);
        const lastMessage = getLatestMessage();
        const apiKey = GM_getValue("starr_openrouter_api_key", null);
        if (!isSummaryEnabled || lastMessage.length === 0 || !apiKey) return;
        
        const summaryBox = document.getElementById('starr-summary-box');
        if (summaryBox && summaryContainer) {
            summaryContainer.style.display = 'flex';
            summaryBox.innerHTML = `<strong>Summary:</strong> <em>Summarizing...</em>`;
        }

        GM_xmlhttpRequest({
            method: "POST", url: STARR_BACKEND_URL,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify({ action: 'summarize', apiKey, textToSummarize: lastMessage }),
            onload: (res) => {
                if (res.status >= 200 && res.status < 300) {
                    const data = JSON.parse(res.responseText);
                    displaySummary(data.summary || "Could not generate a summary.");
                } else {
                    console.error("Starr: Failed to fetch summary.", res.statusText);
                    displaySummary("Summary failed to load.");
                }
            },
            onerror: (err) => {
                console.error("Starr: Network error fetching summary.", err);
                displaySummary("Summary failed to load.");
            }
        });
    }

    async function scanMessageForPI(text) {
        const apiKey = GM_getValue("starr_openrouter_api_key", null);
        if (!apiKey) { alert("Cannot scan for PI without an API key."); return; }
        
        const originalContent = piScanButton.textContent;
        piScanButton.textContent = '⏳'; piScanButton.disabled = true;

        GM_xmlhttpRequest({
            method: "POST", url: STARR_BACKEND_URL,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify({ action: 'scan_pi', apiKey, textToScan: text }),
            onload: (res) => {
                if (res.status >= 200 && res.status < 300) {
                    const data = JSON.parse(res.responseText);
                    const result = data.pi;
                    if (result && result.toUpperCase().trim() !== 'NONE') {
                        displayAiPiNotification(result);
                    } else {
                        GM_notification({ text: "The intelligent scan found no new personal information.", timeout: 3000, title: "Starr PI Scan" });
                    }
                } else {
                     alert(`Starr: The intelligent PI scan failed. Server responded with status ${res.status}.`);
                }
            },
            onerror: (err) => {
                console.error("Starr: AI PI Scan failed:", err);
                alert("Starr: The intelligent PI scan failed due to a network error. Check the console.");
            },
            finally: () => {
                piScanButton.textContent = originalContent; piScanButton.disabled = false;
            }
        });
    }

    async function fetchResponses(input, tone = 'plain') {
        if (!isAuthorized || idMismatchActive || accessDeniedPermanent) return;

        let apiKey = GM_getValue("starr_openrouter_api_key", null);
        if (!apiKey) {
            apiKey = prompt("🔑 Please enter your OpenRouter.ai API key:");
            if (apiKey) GM_setValue("starr_openrouter_api_key", apiKey.trim());
            else { alert("Starr needs an API key to work."); return; }
        }

        starrLoading.style.setProperty('display', 'flex', 'important');
        starrResponses.innerHTML = "";
        
        const lastUserMessageElement = Array.from(document.querySelectorAll('div.my-2.flex-row-reverse')).pop();
        const imagesToProcess = lastUserMessageElement ? lastUserMessageElement.querySelectorAll('img[alt=""]') : [];
        
        const conversation = buildFullConversationHistory();
        
        // Handle images by converting them to data URIs and modifying the last message
        if (imagesToProcess.length > 0 && conversation.length > 0) {
            try {
                const dataUris = await Promise.all(Array.from(imagesToProcess).map(img => imageToDataURI(img.src)));
                const lastMessage = conversation[conversation.length - 1];
                const textContent = (typeof lastMessage.content === 'string') ? lastMessage.content : (lastMessage.content.find(p => p.type === 'text')?.text || '');
                const newContent = [{ type: 'text', text: textContent }];
                dataUris.forEach(uri => { newContent.push({ type: "image_url", image_url: { url: uri } }); });
                conversation[conversation.length - 1].content = newContent;
            } catch (imageError) { console.error("Starr: Failed to process images.", imageError); }
        }

        const payload = {
            action: 'generate',
            apiKey: apiKey,
            conversationHistory: conversation,
            customerInfo: getCustomerInfo(),
            personaInfo: getPersonaInfo(),
            timeOfDay: getTimeOfDay(),
            tone: tone,
            isMultiResponseEnabled: await GM_getValue('starr_multi_response', false),
            hasImage: imagesToProcess.length > 0,
            preferredEngine: await GM_getValue('starr_engine', 'zinat')
        };
        
        GM_xmlhttpRequest({
            method: "POST",
            url: STARR_BACKEND_URL,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify(payload),
            onload: (res) => {
                starrLoading.style.setProperty('display', 'none', 'important');
                if (res.status >= 200 && res.status < 300) {
                    const responseData = JSON.parse(res.responseText);
                    const rawContent = responseData.choices?.[0]?.message?.content?.trim() || "Mmm... I'm speechless, baby. Try again?";
                    const replies = payload.isMultiResponseEnabled ? rawContent.split('|||').map(r => r.trim()) : [rawContent];
                    
                    starrResponses.innerHTML = "";
                    replies.forEach(replyText => {
                        if (replyText) {
                            const div = document.createElement("div");
                            div.className = "starr-reply";
                            div.textContent = replyText;
                            starrResponses.appendChild(div);
                        }
                    });

                    if (GM_getValue('starr_voice_reply', true) && replies.length > 0 && replies[0]) {
                        try {
                            window.speechSynthesis.cancel();
                            const utterance = new SpeechSynthesisUtterance(replies[0]);
                            const voices = window.speechSynthesis.getVoices();
                            if (voices.length > 0) {
                                const femaleVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Google US English')));
                                if (femaleVoice) utterance.voice = femaleVoice;
                            }
                            window.speechSynthesis.speak(utterance);
                        } catch (ttsError) { console.warn("Starr: Failed to play voice reply:", ttsError); }
                    }
                } else {
                    const errorData = JSON.parse(res.responseText);
                    alert(`Starr Backend Error: ${errorData.error || res.statusText}`);
                }
            },
            onerror: (err) => {
                starrLoading.style.setProperty('display', 'none', 'important');
                alert(`Starr network error. Could not reach the backend. Check console.`);
                console.error("Starr Backend Error:", err);
            }
        });
    }

    async function handleReplyClick(event) {
        if (!event.target.classList.contains('starr-reply') || event.target.classList.contains('checking')) return;

        const clickedReplyElement = event.target;
        textUnderScrutiny = clickedReplyElement.textContent;
        const apiKey = GM_getValue("starr_openrouter_api_key", null);
        
        const checkers = {
            regex: regexCheckerToggle.checked,
            llm: llmCheckerToggle.checked
        };

        if (!checkers.regex && !checkers.llm) {
            pasteIntoSiteChat(textUnderScrutiny);
            conversationHistory.push({ role: "assistant", content: textUnderScrutiny });
            popup.classList.remove('visible');
            setTimeout(() => popup.style.setProperty('display', 'none', 'important'), 300);
            return;
        }

        clickedReplyElement.classList.add('checking');

        GM_xmlhttpRequest({
            method: "POST", url: STARR_BACKEND_URL,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify({
                action: 'check_violation', apiKey, textToScrutinize, checkers,
                userContext: conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1].content : ''
            }),
            onload: (res) => {
                clickedReplyElement.classList.remove('checking');
                if (res.status >= 200 && res.status < 300) {
                    const finalResult = JSON.parse(res.responseText);
                    if (finalResult.verdict === "block") {
                        const reasonText = finalResult.issues.map(issue => issue.reason).join('; ');
                        violationReason.textContent = reasonText || "A policy violation was detected.";
                        violationWarningOverlay.style.display = 'flex';
                        violationSound.play().catch(e => console.error("Violation alarm playback failed:", e));
                    } else {
                        pasteIntoSiteChat(textUnderScrutiny);
                        conversationHistory.push({ role: "assistant", content: textUnderScrutiny });
                        popup.classList.remove('visible');
                        setTimeout(() => popup.style.setProperty('display', 'none', 'important'), 300);
                    }
                } else {
                    alert('Violation check failed. See console for details.');
                    console.error('Violation check error:', res);
                }
            },
            onerror: (err) => {
                clickedReplyElement.classList.remove('checking');
                alert('Violation check failed due to a network error.');
                console.error(err);
            }
        });
    }

    // --- All UI Listeners and Initialization ---
    // (This part of the script remains largely unchanged, as it's UI-focused)
    function displaySummary(summaryText) { const box = document.getElementById('starr-summary-box'); if (box && summaryContainer) { summaryContainer.style.display = 'flex'; box.innerHTML = `<strong>Summary:</strong> ${summaryText}`; } }
    function displayAiPiNotification(piText) { if (piEditorPopup && piEditorList) { piEditorList.innerHTML = ''; piText.split('\n').filter(line => line.trim()).forEach(line => { const itemDiv = document.createElement('div'); itemDiv.className = 'starr-pi-item'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; const textInput = document.createElement('input'); textInput.type = 'text'; textInput.value = `| ${line.trim()}`; itemDiv.appendChild(checkbox); itemDiv.appendChild(textInput); piEditorList.appendChild(itemDiv); }); piEditorPopup.style.display = 'flex'; piSound.play().catch(e => console.error("PI Sound failed:", e)); } }
    function setupSpicyRegenModes() { const container = document.getElementById('spicy-regen-container'); if (!container) return; container.innerHTML = ''; const dropdownContainer = document.createElement('div'); dropdownContainer.className = 'spicy-regen-dropdown'; const mainButton = document.createElement('button'); mainButton.innerHTML = '▼'; mainButton.className = 'spicy-regen-main-button'; const dropdownContent = document.createElement('div'); dropdownContent.className = 'spicy-regen-dropdown-content'; const modes = [ { label: '❤️ Sweet', tone: 'sweet' }, { label: '🔥 Naughty', tone: 'naughty' }, { label: '↩️ Deflect', tone: 'deflect' }, { label: '😈 Savage', tone: 'savage' }, { label: '😠 Sweetly Angry', tone: 'sweetly_angry' }]; modes.forEach(mode => { const link = document.createElement('a'); link.innerHTML = mode.label; link.href = '#'; link.addEventListener('click', (e) => { e.preventDefault(); if (conversationHistory.length === 0) { alert("Nothing to regenerate, baby."); return; } const lastUserMessage = [...conversationHistory].reverse().find(m => m.role === 'user'); if (!lastUserMessage) { alert("Couldn't find a user message to regenerate from."); return; } conversationHistory = conversationHistory.filter(msg => msg.role !== 'assistant'); fetchResponses(lastUserMessage.content, mode.tone); dropdownContent.style.display = 'none'; }); dropdownContent.appendChild(link); }); dropdownContainer.appendChild(mainButton); dropdownContainer.appendChild(dropdownContent); container.appendChild(dropdownContainer); mainButton.addEventListener('click', () => { dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block'; }); window.addEventListener('click', (event) => { if (!dropdownContainer.contains(event.target)) { dropdownContent.style.display = 'none'; } }); }
    function applyTheme(themeName) { const themeClasses = Object.values(AUTO_THEME_MAP).concat(['theme-warning-orange', 'theme-emergency-red']).filter(t => t !== 'bubblegum').map(t => t.startsWith('theme-') ? t : 'theme-' + t); document.documentElement.classList.remove(...themeClasses, 'theme-bubblegum'); if (themeName && themeName !== 'bubblegum' && !themeName.startsWith('theme-')) themeName = 'theme-' + themeName; if (themeName && themeName !== 'theme-bubblegum') document.documentElement.classList.add(themeName); }
    function updateThemeBasedOnTime() { if (!isAutoThemeEnabled) return; const timePeriod = getTimeOfDay(); const themeToSet = AUTO_THEME_MAP[timePeriod] || 'bubblegum'; applyTheme(themeToSet); GM_setValue('starr_current_theme', themeToSet); }
    function updatePopupUI(forceOpen = false) { if (forceOpen) { popup.style.setProperty('display', 'flex', 'important'); requestAnimationFrame(() => popup.classList.add('visible')); } updateButtonIcons(); authSection.style.display = 'none'; chatSection.style.display = 'none'; mismatchSection.style.display = 'none'; if (idMismatchActive) { mismatchSection.style.display = 'block'; return; } if (accessDeniedPermanent) { authSection.style.display = 'block'; starrSetMessage(GM_getValue('starr_auth_message', 'Your subscription has expired. Please subscribe to continue.'), true); return; } if (!isAuthorized) { authSection.style.display = 'block'; authMessage.textContent = GM_getValue('starr_auth_message', ''); coneIdInput.value = storedUserConeId || ""; if (forceOpen) coneIdInput.focus(); } else { chatSection.style.display = 'flex'; if (forceOpen) starrInput.focus(); } starrSettingsPanel.style.display = 'none'; popup.classList.remove('settings-open'); }
    function getLoggedInConeId() { const el = document.querySelector(CONE_ID_UI_SELECTOR); if (el) { const match = el.textContent.trim().match(/(\w+)$/); if (match) return match[1]; } return null; }
    async function initializeStarrPopup() { if (!isAudioUnlocked) unlockAudio(); if (!storedUserConeId) starrSetMessage('', false); const uiConeId = getLoggedInConeId(); if (storedUserConeId && uiConeId && uiConeId !== storedUserConeId) { isAuthorized = false; idMismatchActive = true; updatePopupUI(true); return; } await checkConeStatusAndAct(storedUserConeId, true, true); }
    async function handleManualConeIdSubmit() { unlockAudio(); const enteredConeId = coneIdInput.value.trim(); if (!enteredConeId) { starrSetMessage('CONE ID cannot be empty.'); return; } const uiConeId = getLoggedInConeId(); if (uiConeId && enteredConeId !== uiConeId) { starrSetMessage("The CONE ID you entered doesn't match the one on the site.", true); idMismatchActive = true; updatePopupUI(true); return; } starrSetMessage("Checking subscription... hold on.", false); await GM_setValue('user_cone_id', enteredConeId); storedUserConeId = enteredConeId; await checkConeStatusAndAct(enteredConeId, true, true); }
    submitConeIdButton.addEventListener("click", handleManualConeIdSubmit);
    coneIdInput.addEventListener("keydown", async (e) => { if (e.key === "Enter") { e.preventDefault(); await handleManualConeIdSubmit(); } });
    document.getElementById("starr-close").addEventListener("click", () => { popup.classList.remove('visible'); setTimeout(() => popup.style.setProperty('display', 'none', 'important'), 300); popup.classList.remove('settings-open'); const newHistory = buildFullConversationHistory(); if (newHistory.length > 0) lastProcessedMessageText = newHistory[newHistory.length - 1].content; isUIPopulated = false; });
    minimizeButton.addEventListener("click", () => { popup.classList.remove('visible'); setTimeout(() => popup.style.setProperty('display', 'none', 'important'), 300); });
    document.getElementById("starr-force-key").addEventListener("click", () => { GM_setValue("starr_openrouter_api_key", null); alert("API key cleared. You will be prompted for a new one on next use."); starrResponses.innerHTML = '<div class="starr-reply">API key cleared. Try again.</div>'; });
    function pasteIntoSiteChat(text) { const cleanedText = text.replace(/\s*Copy\s*$/, ''); const input = document.querySelector(REPLY_INPUT_SELECTOR); if (input) { input.focus(); input.value = cleanedText; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); input.focus(); } else { GM_notification({ text: `Could not auto-paste. Check selector: ${REPLY_INPUT_SELECTOR}`, timeout: 5000, title: "Starr Warning" }); } }
    starrResponses.addEventListener("click", handleReplyClick);
    async function pollForNewMessages() { checkSubscriptionWarning(); const customerIdEl = document.querySelector(CUSTOMER_INFO_SELECTORS.customerId); const newCustomerId = customerIdEl ? customerIdEl.textContent.trim() : null; if (newCustomerId && newCustomerId !== currentCustomerId) { console.log(`Starr: New customer detected (${newCustomerId}). Resetting context.`); currentCustomerId = newCustomerId; conversationHistory = []; lastProcessedMessageText = ''; starrResponses.innerHTML = ''; if (summaryContainer) summaryContainer.style.display = 'none'; } const uiConeId = getLoggedInConeId(); if (storedUserConeId && uiConeId && uiConeId !== storedUserConeId) { isAuthorized = false; storedUserConeId = null; isUIPopulated = false; idMismatchActive = true; await GM_setValue('user_cone_id', null); await GM_setValue('starr_subscription_status', null); starrSetMessage(''); updatePopupUI(true); return; } if (!isAuthorized || idMismatchActive || accessDeniedPermanent) return; const newHistory = buildFullConversationHistory(); if (newHistory.length > 0) { const latestMessage = newHistory[newHistory.length - 1]; if (latestMessage.role === 'user' && latestMessage.content !== lastProcessedMessageText) { lastProcessedMessageText = latestMessage.content; conversationHistory = newHistory; if (conversationHistory.filter(m => m.role === 'user').length === 1) updateThemeBasedOnTime(); checkAndSummarize(); popup.style.setProperty('display', 'flex', 'important'); requestAnimationFrame(() => popup.classList.add('visible')); updatePopupUI(true); starrInput.value = latestMessage.content; starrInput.focus(); try { await fetchResponses(latestMessage.content); } catch (error) { console.error("Starr: Error in automatic message processing:", error); } } } }
    setInterval(pollForNewMessages, 1000);
    let currentTimerState = 'normal'; function pollForTimer() { if (!isTimerWarningEnabled || !popup.classList.contains('visible')) { if (currentTimerState !== 'normal') resetTimerState(); return; } const timerElement = document.querySelector(TIMER_WARNING_CONFIG.selector); if (!timerElement) { if (currentTimerState !== 'normal') resetTimerState(); return; } const [minutes, seconds] = timerElement.textContent.trim().split(':').map(Number); const totalSeconds = (minutes * 60) + seconds; if (totalSeconds <= 0) { if (currentTimerState !== 'normal') { resetTimerState(); document.getElementById('starr-close').click(); } } else if (totalSeconds <= 60) { if (currentTimerState !== 'emergency') { currentTimerState = 'emergency'; applyTheme('emergency-red'); starrHeader.innerHTML = "⚠️ REPLY NOW! ⚠️"; warningSound.pause(); emergencySound.play().catch(e => console.error("Emergency sound failed:", e.name)); } } else if (totalSeconds <= 120) { if (currentTimerState !== 'warning') { currentTimerState = 'warning'; applyTheme('warning-orange'); starrHeader.innerHTML = "⚠️ Message time running out..."; emergencySound.pause(); warningSound.play().catch(e => console.error("Warning sound failed:", e.name)); } } else { if (currentTimerState !== 'normal') resetTimerState(); } }
    function resetTimerState() { warningSound.pause(); emergencySound.pause(); warningSound.currentTime = 0; emergencySound.currentTime = 0; starrHeader.innerHTML = "Talk to Starr, baby💦..."; if (isAutoThemeEnabled) updateThemeBasedOnTime(); else applyTheme(GM_getValue('starr_current_theme', 'bubblegum')); currentTimerState = 'normal'; }
    setInterval(pollForTimer, 1000);
    starrSettingsButton.addEventListener("click", () => { const isOpening = starrSettingsPanel.style.display !== 'flex'; starrSettingsPanel.style.display = isOpening ? 'flex' : 'none'; popup.classList.toggle('settings-open', isOpening); });
    darkModeToggle.addEventListener("change", () => { document.documentElement.classList.toggle("dark-mode", darkModeToggle.checked); GM_setValue('starr_dark_mode', darkModeToggle.checked); });
    autoThemeToggle.addEventListener("change", async () => { isAutoThemeEnabled = autoThemeToggle.checked; await GM_setValue('starr_auto_theme_enabled', isAutoThemeEnabled); if (isAutoThemeEnabled) updateThemeBasedOnTime(); else applyTheme(GM_getValue('starr_current_theme', 'bubblegum')); });
    timerWarningToggle.addEventListener("change", () => { isTimerWarningEnabled = timerWarningToggle.checked; GM_setValue('starr_timer_warning_enabled', isTimerWarningEnabled); if (!isTimerWarningEnabled) resetTimerState(); });
    summaryToggle.addEventListener("change", () => GM_setValue('starr_summary_enabled', summaryToggle.checked));
    piScanToggle.addEventListener("change", () => { GM_setValue('starr_pi_scan_enabled', piScanToggle.checked); piScanButton.style.display = piScanToggle.checked ? 'flex' : 'none'; });
    sendButtonGlowToggle.addEventListener("change", () => { starrSendButton.classList.toggle("glow", sendButtonGlowToggle.checked); GM_setValue('starr_send_button_glow', sendButtonGlowToggle.checked); });
    voiceReplyToggle.addEventListener("change", () => GM_setValue('starr_voice_reply', voiceReplyToggle.checked));
    regexCheckerToggle.addEventListener("change", () => GM_setValue('starr_regex_checker_enabled', regexCheckerToggle.checked));
    llmCheckerToggle.addEventListener("change", () => GM_setValue('starr_llm_checker_enabled', llmCheckerToggle.checked));
    modelEngineSelect.addEventListener('change', () => GM_setValue('starr_engine', modelEngineSelect.value));
    multiResponseToggle.addEventListener("change", () => GM_setValue('starr_multi_response', multiResponseToggle.checked));
    stylishButtonToggle.addEventListener("change", () => { button.classList.toggle("animated", stylishButtonToggle.checked); GM_setValue('starr_stylish_button', stylishButtonToggle.checked); });
    uiModeSelect.addEventListener('change', async () => { const selectedMode = uiModeSelect.value; document.body.classList.remove('ui-landscape', 'ui-portrait'); document.body.classList.add(selectedMode === 'portrait' ? 'ui-portrait' : 'ui-landscape'); updateButtonIcons(); await GM_setValue('starr_ui_mode', selectedMode); });
    themeButtons.forEach(b => b.addEventListener("click", (e) => { const theme = e.target.dataset.theme; autoThemeToggle.checked = false; isAutoThemeEnabled = false; GM_setValue('starr_auto_theme_enabled', false); applyTheme(theme); GM_setValue('starr_current_theme', theme); }));
    piScanButton.addEventListener('click', () => { const message = getLatestMessage(); if (message) scanMessageForPI(message); else alert("No message to scan."); });
    piLogCloseButton.addEventListener('click', () => { const items = []; piEditorList.querySelectorAll('.starr-pi-item').forEach(item => { const cb = item.querySelector('input[type="checkbox"]'); const ti = item.querySelector('input[type="text"]'); if (cb?.checked && ti) items.push(ti.value); }); let msg = "No items selected."; if (items.length > 0) { const text = items.join('\n'); GM_setClipboard(text, 'text'); const logbook = pasteIntoLogbook(text); if (logbook) { msg = "Logged & Copied!"; const saveBtn = logbook.closest('form')?.querySelector('button[type="submit"]'); if (saveBtn) { setTimeout(() => { saveBtn.click(); GM_notification({ text: "PI notes saved!", timeout: 5000, title: "Starr Logbook" }); }, 250); msg = "Saving..."; } else { GM_notification({ text: "Pasted, but couldn't find Save button.", timeout: 6000, title: "Starr Logbook" }); } } else msg = "Copied (Logbook not found)!"; } const originalText = piLogCloseButton.textContent; piLogCloseButton.textContent = msg; piLogCloseButton.disabled = true; setTimeout(() => { piLogCloseButton.textContent = originalText; piLogCloseButton.disabled = false; piEditorPopup.style.display = 'none'; }, 1500); });
    piCloseButton.addEventListener('click', () => { piEditorPopup.style.display = 'none'; });
    violationEditButton.addEventListener('click', () => { pasteIntoSiteChat(textUnderScrutiny); conversationHistory.push({ role: "assistant", content: textUnderScrutiny }); violationWarningOverlay.style.display = 'none'; popup.classList.remove('visible'); setTimeout(() => popup.style.setProperty('display', 'none', 'important'), 300); });
    violationRegenerateButton.addEventListener('click', () => { violationWarningOverlay.style.display = 'none'; document.getElementById('starr-regenerate').click(); });
    violationWarningOverlay.addEventListener('click', (e) => { if (e.target === violationWarningOverlay) violationWarningOverlay.style.display = 'none'; });
    violationElVioButton.addEventListener('click', () => { let repaired = textUnderScrutiny.replace(/[-!:;*]/g, m => ({'-':' ', '!':'.', ':':'...', ';':','}[m] || '')).replace(/\s{2,}/g, ' ').trim(); pasteIntoSiteChat(repaired); conversationHistory.push({ role: "assistant", content: repaired }); violationWarningOverlay.style.display = 'none'; popup.classList.remove('visible'); setTimeout(() => popup.style.setProperty('display', 'none', 'important'), 300); });
    mismatchRetryButton.addEventListener('click', () => { idMismatchActive = false; mismatchSection.style.display = 'none'; initializeStarrPopup(); });
    async function applySavedUIPreferences() { darkModeToggle.checked = GM_getValue('starr_dark_mode', false); if (darkModeToggle.checked) document.documentElement.classList.add("dark-mode"); sendButtonGlowToggle.checked = GM_getValue('starr_send_button_glow', true); starrSendButton.classList.toggle("glow", sendButtonGlowToggle.checked); summaryToggle.checked = GM_getValue('starr_summary_enabled', true); piScanToggle.checked = GM_getValue('starr_pi_scan_enabled', true); piScanButton.style.display = piScanToggle.checked ? 'flex' : 'none'; timerWarningToggle.checked = GM_getValue('starr_timer_warning_enabled', true); isTimerWarningEnabled = timerWarningToggle.checked; multiResponseToggle.checked = await GM_getValue('starr_multi_response', false); voiceReplyToggle.checked = GM_getValue('starr_voice_reply', true); regexCheckerToggle.checked = GM_getValue('starr_regex_checker_enabled', true); llmCheckerToggle.checked = GM_getValue('starr_llm_checker_enabled', false); modelEngineSelect.value = await GM_getValue('starr_engine', 'zinat'); stylishButtonToggle.checked = GM_getValue('starr_stylish_button', true); button.classList.toggle("animated", stylishButtonToggle.checked); const savedUiMode = await GM_getValue('starr_ui_mode', 'landscape'); uiModeSelect.value = savedUiMode; document.body.classList.remove('ui-landscape', 'ui-portrait'); document.body.classList.add(savedUiMode === 'portrait' ? 'ui-portrait' : 'ui-landscape'); isAutoThemeEnabled = await GM_getValue('starr_auto_theme_enabled', false); autoThemeToggle.checked = isAutoThemeEnabled; if (isAutoThemeEnabled) updateThemeBasedOnTime(); else applyTheme(GM_getValue('starr_current_theme', 'bubblegum')); }
    document.addEventListener('keydown', (e) => { const isCtrl = e.ctrlKey || e.metaKey; if (violationWarningOverlay.style.display === 'flex') { if (e.key === 'Escape') { e.preventDefault(); violationWarningOverlay.style.display = 'none'; } else if (e.key === 'Enter' && !isCtrl) { e.preventDefault(); violationEditButton.click(); } else if (isCtrl && e.key.toLowerCase() === 'r') { e.preventDefault(); violationRegenerateButton.click(); } else if (isCtrl && e.key === 'Enter') { e.preventDefault(); violationElVioButton.click(); } return; } if (piEditorPopup.style.display === 'flex') { if (e.key === 'Escape') { e.preventDefault(); piEditorPopup.style.display = 'none'; } return; } if (isCtrl && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); if (!popup.classList.contains('visible')) button.click(); else document.getElementById('starr-close').click(); return; } if (isCtrl && e.key.toLowerCase() === 'm') { e.preventDefault(); if (popup.classList.contains('visible')) minimizeButton.click(); else button.click(); return; } if (e.key === 'Tab' && popup.classList.contains('visible')) { e.preventDefault(); piScanButton.click(); return; } if (isCtrl && e.key.toLowerCase() === 'q') { e.preventDefault(); forceSummary(); return; } if (e.key.toLowerCase() === 't') { const activeEl = document.activeElement; if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) return; e.preventDefault(); starrSettingsButton.click(); return; } if (!popup.classList.contains('visible')) return; if (isCtrl && e.key.toLowerCase() === 'r') { e.preventDefault(); document.getElementById('starr-regenerate').click(); return; } if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); const spicyButton = document.querySelector('.spicy-regen-main-button'); if (spicyButton) spicyButton.click(); return; } if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); document.getElementById('starr-force-key').click(); return; } if (e.key === 'Escape') { e.preventDefault(); document.getElementById('starr-close').click(); return; } const replies = starrResponses.querySelectorAll('.starr-reply'); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (replies.length === 0) return; if (selectedReplyIndex > -1 && replies[selectedReplyIndex]) replies[selectedReplyIndex].classList.remove('selected-reply'); if (e.key === 'ArrowDown') selectedReplyIndex = (selectedReplyIndex + 1) % replies.length; else selectedReplyIndex = (selectedReplyIndex - 1 + replies.length) % replies.length; const newSelectedReply = replies[selectedReplyIndex]; newSelectedReply.classList.add('selected-reply'); newSelectedReply.scrollIntoView({ block: 'nearest' }); return; } if (e.key === 'Enter') { if (selectedReplyIndex > -1 && replies[selectedReplyIndex]) { e.preventDefault(); replies[selectedReplyIndex].click(); } else if (document.activeElement === starrInput && (isCtrl || !e.shiftKey)) { e.preventDefault(); document.getElementById('starr-send').click(); } } });
    async function init() { await applySavedUIPreferences(); setupSpicyRegenModes(); updateButtonIcons(); button.addEventListener("click", async () => { unlockAudio(); const hasSeenWelcome = await GM_getValue('hasSeenWelcomePage', false); const savedUiMode = await GM_getValue('starr_ui_mode', null); if (!hasSeenWelcome) displayWelcomeScreen(); else if (!savedUiMode) displayModeSelection(); else initializeStarrPopup(); }); await starrAutoCheckOnLoad(); }
    function unlockAudio() { if (isAudioUnlocked) return; console.log("Starr: Unlocking audio..."); [warningSound, emergencySound, piSound, violationSound].forEach(sound => { const p = sound.play(); if (p) { p.then(() => { sound.pause(); sound.currentTime = 0; }).catch(e => {}); } }); if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(' '); window.speechSynthesis.speak(u); } isAudioUnlocked = true; }
    document.getElementById("starr-send").addEventListener("click", () => { const input = starrInput.value.trim(); if (!input) { alert("You can't send an empty message, darling."); return; } fetchResponses(input, 'plain'); });
    document.getElementById("starr-regenerate").addEventListener("click", () => { if (conversationHistory.length === 0 && buildFullConversationHistory().length === 0) { alert("Nothing to regenerate, baby."); return; } conversationHistory = conversationHistory.filter(msg => msg.role !== 'assistant'); const lastMessageContent = conversationHistory.length > 0 ? conversationHistory[conversationHistory.length-1].content : getLatestMessage(); if (lastMessageContent) fetchResponses(lastMessageContent, 'plain'); else alert("Could not find a previous message to regenerate from."); });
    
    init();

})();
