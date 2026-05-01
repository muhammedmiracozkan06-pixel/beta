/**
 * Pilot AI - Full Integrated Omega Engine
 * Developed by Wind Developers (Mirac Özkan)
 * Engines: Google Gemma (Vision + Text) & Groq (Speed)
 */

window.PilotAI = {
    isSending: false,
    // API KEYS
    groqKey: "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", 
    geminiKey: "AIzaSyBJ4fS005XYgo33bFP77-03Zm56N307O_U", // <--- Burayı doldur kanka!
    
    // User Data
    userName: localStorage.getItem('p_user_name') || "Guest",
    isAuth: localStorage.getItem('p_is_auth') === 'true',
    
    // Config
    googleClientId: '897971776455-vvenka1rngn5bcmksht7m13t5jgl6ek7.apps.googleusercontent.com',
    fixedRedirectUri: "https://pilotwebai.vercel.app",
    
    // State
    selectedImageBase64: null,
    chatHistory: [] 
};

// --- 1. WMAIL & AUTH LOGIC ---
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

// --- 2. IMAGE HANDLING ---
const imageInput = document.getElementById('image-input');
const uploadBtn = document.getElementById('upload-btn');
const previewContainer = document.getElementById('image-preview-container');
const previewImg = document.getElementById('preview-img');
const removeImgBtn = document.getElementById('remove-img-btn');

if (uploadBtn) uploadBtn.onclick = () => imageInput.click();

if (imageInput) {
    imageInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                window.PilotAI.selectedImageBase64 = event.target.result;
                previewImg.src = event.target.result;
                previewContainer.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        }
    };
}

if (removeImgBtn) {
    removeImgBtn.onclick = () => {
        window.PilotAI.selectedImageBase64 = null;
        imageInput.value = "";
        previewContainer.style.display = 'none';
    };
}

// --- 3. GOOGLE DOCS INTEGRATION ---
async function createGoogleDoc(title, content = "") {
    const token = localStorage.getItem('google_access_token');
    if (!token) {
        addMessage("🔑 Google linking required. Redirecting...", 'ai-msg');
        const scope = 'https://www.googleapis.com/auth/documents';
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${window.PilotAI.googleClientId}&redirect_uri=${encodeURIComponent(window.PilotAI.fixedRedirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}`;
        window.location.href = authUrl;
        return;
    }

    try {
        const response = await fetch('https://docs.googleapis.com/v1/documents', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title })
        });
        const doc = await response.json();

        if (doc.documentId && content) {
            await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [{ insertText: { location: { index: 1 }, text: content } }]
                })
            });
            window.open(`https://docs.google.com/document/d/${doc.documentId}/edit`, '_blank');
        }
    } catch (e) {
        addMessage("❌ Google Docs Error.", 'ai-msg');
    }
}

// --- 4. MAIN ENGINES (GEMMA & GROQ) ---
async function callGemmaEngine(text, imageBase64) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${window.PilotAI.geminiKey}`;
    
    let parts = [{ text: `You are Pilot AI. User: ${window.PilotAI.userName}. Respond in Turkish. ${text}` }];
    
    if (imageBase64) {
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
    return data.candidates[0].content.parts[0].text;
}

async function callGroqEngine(text, model) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${window.PilotAI.groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            model: model, 
            messages: [{ role: "system", content: "You are Pilot AI. Talk in Turkish." }, { role: "user", content: text }] 
        })
    });
    const data = await response.json();
    return data.choices[0].message.content;
}

// --- 5. CHAT HANDLER ---
async function handleSend() {
    const input = document.getElementById('user-input');
    const modelSelect = document.getElementById('model-select');
    const text = input.value.trim();
    const currentImg = window.PilotAI.selectedImageBase64;
    const selectedModel = modelSelect.value;

    if (!text && !currentImg) return;
    if (window.PilotAI.isSending) return;

    addMessage(text || "(Image Attached)", 'user-msg');
    input.value = '';
    window.PilotAI.isSending = true;

    // Docs Command Check
    const docCmds = ["create doc", "create docs", "belge oluştur", "dosya oluştur"];
    if (docCmds.some(cmd => text.toLowerCase().startsWith(cmd))) {
        let title = text.split(' ').slice(2).join(' ') || "New Pilot Doc";
        await createGoogleDoc(title, "Content generated by Wind Developers Pilot AI.");
        window.PilotAI.isSending = false;
        return;
    }

    try {
        let aiResult = "";
        if (selectedModel === "gemma") {
            aiResult = await callGemmaEngine(text, currentImg);
        } else {
            if (currentImg) {
                aiResult = "⚠️ This model doesn't support images. Switch to 'Gemma Engine'.";
            } else {
                aiResult = await callGroqEngine(text, selectedModel);
            }
        }
        addMessage(aiResult, 'ai-msg');
    } catch (e) {
        addMessage("⚠️ Engine Error: " + e.message, 'ai-msg');
    } finally {
        if (currentImg) removeImgBtn.click();
        window.PilotAI.isSending = false;
    }
}

// --- 6. INITIALIZATION ---
function addMessage(text, className) {
    const chat = document.getElementById('chat-window');
    const div = document.createElement('div');
    div.className = className;
    div.innerText = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

window.onload = () => {
    checkAuth();
    // Handle Google Token
    const hash = new URLSearchParams(window.location.hash.substring(1));
    const token = hash.get('access_token');
    if (token) {
        localStorage.setItem('google_access_token', token);
        window.history.replaceState({}, document.title, window.location.pathname);
        addMessage("✅ Google Drive/Docs connected.", 'ai-msg');
    }
};

document.getElementById('send-btn').onclick = handleSend;
document.getElementById('user-input').onkeydown = (e) => { if(e.key === 'Enter') handleSend(); };
