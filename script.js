/**
 * Pilot AI - Omega 2.0 Stable
 * Developed by Wind Developers (Mirac Özkan)
 * 2026 Next-Gen AI Engine
 */

window.PilotAI = {
    isSending: false,
    // API KEYS
    groqKey: "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", 
    geminiKey: "AIzaSyBJ4fS005XYgo33bFP77-03Zm56N307O_U", // <--- Burayı doldur kanka!
    
    userName: localStorage.getItem('p_user_name') || "Guest",
    isAuth: localStorage.getItem('p_is_auth') === 'true',
    
    selectedImageBase64: null,
    chatHistory: [] 
};

// --- 1. DEBUG LOG ---
function debugLog(title, data) {
    console.log(`%c[Pilot AI Debug - ${title}]`, "color: #4ade80; font-weight: bold;", data);
}

// --- 2. AUTH & WMAIL ---
function checkAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const hasLogin = urlParams.get('login') === 'true';
    const wmailName = urlParams.get('name');

    if (hasLogin && wmailName) {
        window.PilotAI.isAuth = true;
        window.PilotAI.userName = decodeURIComponent(wmailName);
        localStorage.setItem('p_is_auth', 'true');
        localStorage.setItem('p_user_name', window.PilotAI.userName);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (window.PilotAI.isAuth) {
        const overlay = document.getElementById('auth-overlay');
        if (overlay) overlay.style.display = 'none';
        document.getElementById('user-name').innerText = window.PilotAI.userName;
    }
}

// --- 3. GEMINI 2.0 ENGINE (METİN + GÖRSEL) ---
async function callGemmaEngine(text, imageBase64) {
    // Model ismini en güncel 2.0 yaptık
    const model = "gemini-2.0-flash"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${window.PilotAI.geminiKey}`;
    
    debugLog("Engine Call", `Requesting Gemini 2.0 Flash...`);

    let parts = [{ text: `Sen Wind Developers tarafından geliştirilen Pilot AI'sın. Kullanıcı: ${window.PilotAI.userName}. Daima Türkçe yanıt ver. Profesyonel ve zeki ol. Soru: ${text || "Bu görseli analiz et."}` }];
    
    if (imageBase64) {
        debugLog("Image Process", "Görsel verisi Vision motoruna yükleniyor...");
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
    
    if (data.error) {
        console.error("!!! GOOGLE API HATASI !!!", data.error);
        throw new Error(`${data.error.message} (${data.error.status})`);
    }

    if (!data.candidates || data.candidates.length === 0) {
        throw new Error("Yanıt boş döndü. Güvenlik filtreleri veya kısıtlı içerik olabilir.");
    }

    return data.candidates[0].content.parts[0].text;
}

// --- 4. GROQ ENGINE (HIZLI METİN) ---
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
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
}

// --- 5. ANA GÖNDERME MOTORU ---
async function handleSend() {
    const input = document.getElementById('user-input');
    const modelSelect = document.getElementById('model-select');
    const text = input.value.trim();
    const currentImg = window.PilotAI.selectedImageBase64;
    const selectedModel = modelSelect.value;

    if (!text && !currentImg) return;
    if (window.PilotAI.isSending) return;

    addMessage(text || "(Görsel Analiz Ediliyor...)", 'user-msg');
    input.value = '';
    window.PilotAI.isSending = true;

    try {
        let result = "";
        // Eğer Gemma seçiliyse veya model ismi gemma içeriyorsa
        if (selectedModel === "gemma" || selectedModel.includes("gemini")) {
            result = await callGemmaEngine(text, currentImg);
        } else {
            if (currentImg) {
                result = "⚠️ Bu model görsel desteklemez. Lütfen 'Gemma Engine' seçin kanka.";
            } else {
                result = await callGroqEngine(text, selectedModel);
            }
        }
        addMessage(result, 'ai-msg');
    } catch (e) {
        console.error("Kritik Hata:", e);
        addMessage(`⚠️ Engine Error: ${e.message}`, 'ai-msg');
    } finally {
        // Görseli gönderdikten sonra temizle
        if (currentImg && document.getElementById('remove-img-btn')) {
            document.getElementById('remove-img-btn').click();
        }
        window.PilotAI.isSending = false;
    }
}

// --- 6. ARAYÜZ VE BAŞLATMA ---
function addMessage(text, className) {
    const chat = document.getElementById('chat-window');
    const div = document.createElement('div');
    div.className = className;
    div.innerText = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

// Görsel Yükleme Butonları
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

// Başlangıç Ayarları
window.onload = () => {
    checkAuth();
    debugLog("System", "Pilot AI Omega Engine Ready.");
};

// Buton ve Enter Dinleyicileri
document.getElementById('send-btn').onclick = handleSend;
document.getElementById('user-input').onkeydown = (e) => { if(e.key === 'Enter') handleSend(); };
