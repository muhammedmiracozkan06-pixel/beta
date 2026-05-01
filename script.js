/**
 * Pilot AI - Full Integrated Engine (Wmail + Vision + Google Docs)
 * Developed by Wind Developers (Mirac Özkan)
 */

window.PilotAI = {
    isSending: false,
    apiKey: "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", 
    userName: localStorage.getItem('p_user_name') || "Guest",
    isAuth: localStorage.getItem('p_is_auth') === 'true',
    googleClientId: '897971776455-vvenka1rngn5bcmksht7m13t5jgl6ek7.apps.googleusercontent.com',
    fixedRedirectUri: "https://pilotwebai.vercel.app",
    selectedImageBase64: null // Seçilen görseli burada tutacağız
};

// --- WMAIL AUTH CHECK ---
function checkWmailAuth() {
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
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('user-name').innerText = window.PilotAI.userName;
    }
}

// --- IMAGE HANDLING (Görsel Atma İşlemi) ---
const imageInput = document.getElementById('image-input');
const uploadBtn = document.getElementById('upload-btn');
const previewContainer = document.getElementById('image-preview-container');
const previewImg = document.getElementById('preview-img');
const removeImgBtn = document.getElementById('remove-img-btn');

uploadBtn.onclick = () => imageInput.click();

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

removeImgBtn.onclick = () => {
    window.PilotAI.selectedImageBase64 = null;
    imageInput.value = "";
    previewContainer.style.display = 'none';
};

// --- GOOGLE DOCS LOGIC ---
async function createGoogleDoc(title, content = "") {
    const token = localStorage.getItem('google_access_token');
    if (!token) {
        addMessage("🔑 Google Link required. Redirecting...", 'ai-msg');
        const scope = 'https://www.googleapis.com/auth/documents';
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${window.PilotAI.googleClientId}&redirect_uri=${encodeURIComponent(window.PilotAI.fixedRedirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}`;
        window.location.href = authUrl;
        return;
    }
    try {
        const res = await fetch('https://docs.googleapis.com/v1/documents', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title })
        });
        const doc = await res.json();
        if (doc.documentId && content) {
            await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: content } }] })
            });
        }
        window.open(`https://docs.google.com/document/d/${doc.documentId}/edit`, '_blank');
    } catch (e) { addMessage("❌ Docs Error.", 'ai-msg'); }
}

// --- MAIN CHAT ENGINE ---
async function handleSend() {
    const userInput = document.getElementById('user-input');
    const text = userInput.value.trim();
    if ((!text && !window.PilotAI.selectedImageBase64) || window.PilotAI.isSending) return;

    addMessage(text || "(Sent an image)", 'user-msg');
    userInput.value = '';
    window.PilotAI.isSending = true;

    // Komut Kontrolü (TR/EN)
    const docCommands = ["create doc", "create docs", "belge oluştur", "dosya oluştur", "yeni belge"];
    let isDoc = docCommands.some(cmd => text.toLowerCase().startsWith(cmd));

    if (isDoc) {
        let title = text.replace(/[^ ]+ [^ ]+ /i, "").trim() || "Untitled Pilot Doc";
        await createGoogleDoc(title, "Generated content for " + title);
        window.PilotAI.isSending = false;
        return;
    }

    try {
        let messages = [{ role: "system", content: "You are Pilot AI. User: " + window.PilotAI.userName }];
        
        // Eğer görsel varsa Vision modeline gönder
        let userContent = [{ type: "text", text: text || "What is in this image?" }];
        if (window.PilotAI.selectedImageBase64) {
            userContent.push({
                type: "image_url",
                image_url: { url: window.PilotAI.selectedImageBase64 }
            });
        }
        messages.push({ role: "user", content: userContent });

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.PilotAI.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                model: window.PilotAI.selectedImageBase64 ? "meta-llama/llama-4-scout-17b-16e-instruct" : "meta-llama/llama-4-scout-17b-16e-instruct", 
                messages: messages 
            })
        });

        const data = await response.json();
        addMessage(data.choices[0].message.content, 'ai-msg');
        
        // Görseli temizle
        removeImgBtn.click();
    } catch (e) {
        addMessage("⚠️ Connection error.", 'ai-msg');
    }

    window.PilotAI.isSending = false;
}

// --- HELPERS ---
function addMessage(text, className) {
    const chat = document.getElementById('chat-window');
    const div = document.createElement('div');
    div.className = className;
    div.innerText = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

window.addEventListener('load', () => {
    checkWmailAuth();
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('access_token')) {
        localStorage.setItem('google_access_token', hashParams.get('access_token'));
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

document.getElementById('send-btn').onclick = handleSend;
document.getElementById('user-input').onkeydown = (e) => { if(e.key === 'Enter') handleSend(); };
