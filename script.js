/**
 * Pilot AI - Omega Debug Edition
 * Developed by Wind Developers (Mirac Özkan)
 */

window.PilotAI = {
    isSending: false,
    groqKey: "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", 
    geminiKey: "AIzaSyBJ4fS005XYgo33bFP77-03Zm56N307O_U", // <--- Burayı doldur kanka!
    userName: localStorage.getItem('p_user_name') || "Guest",
    isAuth: localStorage.getItem('p_is_auth') === 'true',
    selectedImageBase64: null
};

// --- 1. DEBUG LOG FONKSİYONU ---
function debugLog(title, data) {
    console.log(`%c[Pilot AI Debug - ${title}]`, "color: #4ade80; font-weight: bold;", data);
}

// --- 2. AUTH & WMAIL ---
function checkAuth() {
    debugLog("Auth Check", "Checking URL parameters...");
    const urlParams = new URLSearchParams(window.location.search);
    const hasLogin = urlParams.get('login') === 'true';
    const wmailName = urlParams.get('name');

    if (hasLogin && wmailName) {
        window.PilotAI.isAuth = true;
        window.PilotAI.userName = decodeURIComponent(wmailName);
        localStorage.setItem('p_is_auth', 'true');
        localStorage.setItem('p_user_name', window.PilotAI.userName);
        window.history.replaceState({}, document.title, window.location.pathname);
        debugLog("Auth Success", `Welcome ${window.PilotAI.userName}`);
    }

    if (window.PilotAI.isAuth) {
        const overlay = document.getElementById('auth-overlay');
        if (overlay) overlay.style.display = 'none';
        document.getElementById('user-name').innerText = window.PilotAI.userName;
    }
}

// --- 3. GEMMA ENGINE (HATA AYIKLAMALI) ---
async function callGemmaEngine(text, imageBase64) {
    const model = "models/gemini-1.5-flash"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${window.PilotAI.geminiKey}`;
    
    debugLog("Engine Call", `Using model: ${model}`);

    let parts = [{ text: `Sen Pilot AI'sın. Kullanıcı: ${window.PilotAI.userName}. Daima Türkçe yanıt ver. Soru: ${text || "Görseli analiz et."}` }];
    
    if (imageBase64) {
        debugLog("Image Info", "Image detected, adding to payload...");
        parts.push({
            inline_data: {
                mime_type: "image/jpeg",
                data: imageBase64.split(',')[1]
            }
        });
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
    });

    const data = await res.json();
    
    // EĞER HATA VARSA KONSOLA YAZDIR
    if (data.error) {
        console.error("!!! GOOGLE API HATASI !!!", data.error);
        throw new Error(`${data.error.message} (${data.error.status})`);
    }

    if (!data.candidates || data.candidates.length === 0) {
        debugLog("Empty Response", data);
        throw new Error("Google response is empty. (Check Safety Filters)");
    }

    debugLog("Full Response Data", data);
    return data.candidates[0].content.parts[0].text;
}

// --- 4. GROQ ENGINE ---
async function callGroqEngine(text, model) {
    debugLog("Groq Call", `Using model: ${model}`);
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${window.PilotAI.groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            model: model, 
            messages: [{ role: "system", content: "You are Pilot AI. Talk in Turkish." }, { role: "user", content: text }] 
        })
    });
    
    const data = await res.json();
    if (data.error) {
        console.error("!!! GROQ API HATASI !!!", data.error);
        throw new Error(data.error.message);
    }
    return data.choices[0].message.content;
}

// --- 5. MAIN HANDLER ---
async function handleSend() {
    const input = document.getElementById('user-input');
    const modelSelect = document.getElementById('model-select');
    const text = input.value.trim();
    const currentImg = window.PilotAI.selectedImageBase64;
    const selectedModel = modelSelect.value;

    if (!text && !currentImg) return;
    if (window.PilotAI.isSending) return;

    addMessage(text || "(Görsel Analizi Bekleniyor)", 'user-msg');
    input.value = '';
    window.PilotAI.isSending = true;

    try {
        let result = "";
        if (selectedModel === "gemma") {
            result = await callGemmaEngine(text, currentImg);
        } else {
            if (currentImg) {
                result = "⚠️ Bu model görsel desteklemez. 'Gemma' seç kanka.";
            } else {
                result = await callGroqEngine(text, selectedModel);
            }
        }
        addMessage(result, 'ai-msg');
    } catch (e) {
        console.error("Kritik Hata:", e);
        addMessage(`⚠️ Engine Error: ${e.message}`, 'ai-msg');
    } finally {
        if (currentImg && document.getElementById('remove-img-btn')) {
            document.getElementById('remove-img-btn').click();
        }
        window.PilotAI.isSending = false;
    }
}

// --- 6. UTILS & INIT ---
function addMessage(text, className) {
    const chat = document.getElementById('chat-window');
    const div = document.createElement('div');
    div.className = className;
    div.innerText = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

// Görsel Seçme İşlemleri
document.getElementById('upload-btn').onclick = () => document.getElementById('image-input').click();
document.getElementById('image-input').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            window.PilotAI.selectedImageBase64 = event.target.result;
            document.getElementById('preview-img').src = event.target.result;
            document.getElementById('image-preview-container').style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
};
document.getElementById('remove-img-btn').onclick = () => {
    window.PilotAI.selectedImageBase64 = null;
    document.getElementById('image-input').value = "";
    document.getElementById('image-preview-container').style.display = 'none';
};

window.onload = () => {
    checkAuth();
};

document.getElementById('send-btn').onclick = handleSend;
document.getElementById('user-input').onkeydown = (e) => { if(e.key === 'Enter') handleSend(); };
