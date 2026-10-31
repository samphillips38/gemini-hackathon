import {
  PRESET_TEXTBOOKS,
  parseCustomTextbookLocally,
  generateContextualCharacterReply
} from './data-presets.js';
import { LivingTextbook3DEngine } from './three-world.js';

class ChronicleApp {
  constructor() {
    this.customBooks = {};
    this.activeBook = PRESET_TEXTBOOKS.athens;
    this.activeCharacter = null;

    // Store multi-turn conversation history and Gemini previous_interaction_id per character
    this.chatHistories = {}; // { [charId]: [{ role, text, source }] }
    this.interactionIds = {}; // { [charId]: string }

    // Discovery / Field Journal progress
    this.interviewedCharacters = new Set();
    this.inspectedLandmarks = new Set();

    // Settings
    this.apiKey = localStorage.getItem('chronicle_gemini_api_key') || '';
    this.selectedModel = localStorage.getItem('chronicle_gemini_model') || 'gemini-3.8-flash';
    this.voiceEnabled = false;
    this.hasServerKey = false;

    this.initDOMReferences();
    this.initEngine();
    this.bindUIEvents();
    this.checkServerStatus();
    this.loadBook(this.activeBook, 'book');
  }

  initDOMReferences() {
    this.canvasContainer = document.getElementById('canvas-container');
    this.labelLayer = document.getElementById('world-label-layer');

    // Top Navigation Bar
    this.bookSelectEl = document.getElementById('book-preset-select');
    this.uploadBtn = document.getElementById('open-upload-modal-btn');
    this.modeToggleBtn = document.getElementById('toggle-stage-mode-btn');
    this.readerToggleBtn = document.getElementById('open-reader-drawer-btn');
    this.journalBtn = document.getElementById('open-journal-btn');
    this.journalBadge = document.getElementById('journal-progress-badge');
    this.voiceToggleBtn = document.getElementById('toggle-voice-btn');
    this.apiKeyBtn = document.getElementById('open-api-modal-btn');
    this.apiStatusDot = document.getElementById('api-status-dot');

    // Book Mode Overlay HUD
    this.bookStageHud = document.getElementById('book-stage-hud');
    this.bookHudEra = document.getElementById('book-hud-era');
    this.bookHudTitle = document.getElementById('book-hud-title');
    this.bookHudSubtitle = document.getElementById('book-hud-subtitle');
    this.bookHudSynopsis = document.getElementById('book-hud-synopsis');
    this.enterWorldBtn = document.getElementById('enter-3d-world-btn');
    this.peekCoverBtn = document.getElementById('peek-book-cover-btn');
    this.turnPageBtn = document.getElementById('turn-book-page-btn');

    // Transition Banner
    this.openingBanner = document.getElementById('book-opening-banner');

    // World Mode HUD
    this.worldStageHud = document.getElementById('world-stage-hud');
    this.worldLocationName = document.getElementById('world-location-name');
    this.worldAtmosphereDesc = document.getElementById('world-atmosphere-desc');
    this.characterRosterBar = document.getElementById('character-roster-bar');
    this.proximityPrompt = document.getElementById('proximity-prompt');
    this.proximityPromptText = document.getElementById('proximity-prompt-text');
    this.cameraPovBtn = document.getElementById('toggle-pov-btn');
    this.minimapCanvas = document.getElementById('minimap-canvas');

    // Character Chat Panel
    this.chatPanel = document.getElementById('character-chat-panel');
    this.closeChatBtn = document.getElementById('close-chat-panel-btn');
    this.chatCharName = document.getElementById('chat-char-name');
    this.chatCharTitle = document.getElementById('chat-char-title');
    this.chatCharFaction = document.getElementById('chat-char-faction');
    this.chatCharBio = document.getElementById('chat-char-bio');
    this.chatKeyFactsList = document.getElementById('chat-key-facts-list');
    this.chatSuggestedChips = document.getElementById('chat-suggested-chips');
    this.chatMessagesEl = document.getElementById('chat-messages');
    this.chatForm = document.getElementById('chat-input-form');
    this.chatInput = document.getElementById('chat-input-field');

    // Textbook Reader & Landmark Drawer
    this.readerModal = document.getElementById('textbook-reader-modal');
    this.closeReaderBtn = document.getElementById('close-reader-modal-btn');
    this.readerChaptersContainer = document.getElementById('reader-chapters-container');

    // Upload Textbook Modal
    this.uploadModal = document.getElementById('upload-textbook-modal');
    this.closeUploadBtn = document.getElementById('close-upload-modal-btn');
    this.fileDropZone = document.getElementById('file-drop-zone');
    this.fileInput = document.getElementById('textbook-file-input');
    this.selectedFileLabel = document.getElementById('selected-file-label');
    this.customTextPaste = document.getElementById('custom-textbook-paste');
    this.generateBookBtn = document.getElementById('generate-3d-book-btn');
    this.uploadStatusMsg = document.getElementById('upload-status-msg');

    // API Settings Modal
    this.apiModal = document.getElementById('api-settings-modal');
    this.closeApiModalBtn = document.getElementById('close-api-modal-btn');
    this.apiKeyInput = document.getElementById('gemini-api-key-input');
    this.modelSelectInput = document.getElementById('gemini-model-select');
    this.saveApiBtn = document.getElementById('save-api-settings-btn');
  }

  initEngine() {
    this.engine = new LivingTextbook3DEngine({
      canvasContainer: this.canvasContainer,
      labelLayer: this.labelLayer,
      onCharacterInteract: (charData) => this.openCharacterChat(charData),
      onLandmarkInteract: (lmData) => this.openLandmarkPopup(lmData),
      onProximityChange: ({ character, landmark }) => this.handleProximityUpdate(character, landmark),
      onModeChange: (newMode) => this.handleModeChange(newMode)
    });

    // Update minimap radar continuously
    setInterval(() => this.drawMinimap(), 80);
  }

  async checkServerStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.ok) {
        this.hasServerKey = Boolean(data.hasServerApiKey);
      }
    } catch {
      this.hasServerKey = false;
    }
    this.updateApiIndicator();
  }

  updateApiIndicator() {
    const active = Boolean(this.apiKey || this.hasServerKey);
    if (this.apiStatusDot) {
      this.apiStatusDot.className = `status-dot ${active ? 'online' : 'demo'}`;
    }
    if (this.apiKeyBtn) {
      this.apiKeyBtn.title = active
        ? `Gemini Live (${this.selectedModel})`
        : 'Configure Gemini API Key (Currently using built-in AI & local parser)';
    }
  }

  loadBook(bookData, initialMode = 'book') {
    this.activeBook = bookData;
    this.activeCharacter = null;
    this.interviewedCharacters.clear();
    this.inspectedLandmarks.clear();
    this.closeCharacterChat();

    // Update Book Stage HUD
    this.bookHudEra.textContent = bookData.era || 'Historical Textbook';
    this.bookHudTitle.textContent = bookData.title || 'Untitled Textbook';
    this.bookHudSubtitle.textContent = bookData.subtitle || '';
    this.bookHudSynopsis.textContent = bookData.synopsis || '';

    // Update World Stage HUD
    this.worldLocationName.textContent = bookData.worldSetting?.locationName || bookData.title;
    this.worldAtmosphereDesc.textContent = bookData.worldSetting?.atmosphereDescription || '';

    // Populate Quick-Teleport Character Roster Bar
    this.renderCharacterRoster(bookData.characters || []);

    // Populate Textbook Chapters Reader
    this.renderTextbookReader(bookData);

    // Update Journal Progress Counter
    this.updateJournalCounter();

    // Load into 3D Engine
    this.engine.loadTextbook(bookData);
    this.engine.setMode(initialMode);
  }

  handleModeChange(mode) {
    if (mode === 'book') {
      this.bookStageHud.classList.remove('hidden');
      this.worldStageHud.classList.add('hidden');
      this.openingBanner.classList.add('hidden');
      this.modeToggleBtn.innerHTML = `<span class="btn-icon">🌍</span> Open Book into 3D World`;
      this.closeCharacterChat();
    } else if (mode === 'opening') {
      this.bookStageHud.classList.add('hidden');
      this.worldStageHud.classList.add('hidden');
      this.openingBanner.classList.remove('hidden');
      this.modeToggleBtn.innerHTML = `<span class="btn-icon">✨</span> Opening Textbook...`;
    } else if (mode === 'world') {
      this.bookStageHud.classList.add('hidden');
      this.openingBanner.classList.add('hidden');
      this.worldStageHud.classList.remove('hidden');
      this.modeToggleBtn.innerHTML = `<span class="btn-icon">📖</span> Fold Back to 3D Book`;
    }
  }

  renderCharacterRoster(characters) {
    this.characterRosterBar.innerHTML = '';
    for (const c of characters) {
      const chip = document.createElement('button');
      chip.className = 'character-roster-chip';
      chip.dataset.charId = c.id;
      const dotColor = c.avatarStyle?.robeColor || '#3b82f6';
      chip.innerHTML = `
        <span class="chip-avatar-dot" style="background:${dotColor}"></span>
        <span class="chip-info">
          <strong>${c.name}</strong>
          <small>${c.title}</small>
        </span>
      `;
      chip.addEventListener('click', () => {
        this.engine.teleportToCharacter(c.id);
      });
      this.characterRosterBar.appendChild(chip);
    }
  }

  handleProximityUpdate(character, landmark) {
    if (character) {
      this.proximityPrompt.classList.remove('hidden');
      this.proximityPromptText.innerHTML = `Near <strong>${character.name}</strong> (${character.title}) — Press <kbd>E</kbd> or Click to Converse`;
      this.proximityPrompt.onclick = () => this.openCharacterChat(character);
    } else if (landmark) {
      this.proximityPrompt.classList.remove('hidden');
      this.proximityPromptText.innerHTML = `Near <strong>${landmark.name}</strong> — Press <kbd>E</kbd> or Click to Inspect Monument`;
      this.proximityPrompt.onclick = () => this.openLandmarkPopup(landmark);
    } else {
      this.proximityPrompt.classList.add('hidden');
    }
  }

  // ============================================================================
  // INTERACTIVE HISTORICAL CHARACTER CHAT (GEMINI 3.8 FLASH INTERACTIONS API)
  // ============================================================================

  openCharacterChat(charData) {
    this.activeCharacter = charData;
    this.engine.activeTalkingCharacterId = charData.id;
    this.interviewedCharacters.add(charData.id);
    this.updateJournalCounter();

    // Highlight active roster chip
    document.querySelectorAll('.character-roster-chip').forEach((el) => {
      el.classList.toggle('active', el.dataset.charId === charData.id);
    });

    this.chatCharName.textContent = `${charData.name} (${charData.years || ''})`;
    this.chatCharTitle.textContent = charData.title;
    this.chatCharFaction.textContent = charData.faction || this.activeBook.era;
    this.chatCharBio.textContent = charData.bio;

    // Render Key Textbook Facts
    this.chatKeyFactsList.innerHTML = '';
    for (const fact of charData.keyFacts || []) {
      const li = document.createElement('li');
      li.textContent = fact;
      this.chatKeyFactsList.appendChild(li);
    }

    // Render Suggested Questions
    this.chatSuggestedChips.innerHTML = '';
    for (const q of charData.suggestedQuestions || []) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suggested-question-btn';
      btn.textContent = q;
      btn.addEventListener('click', () => {
        this.sendUserMessageToCharacter(q);
      });
      this.chatSuggestedChips.appendChild(btn);
    }

    // Initialize greeting if first time talking to this character
    if (!this.chatHistories[charData.id] || this.chatHistories[charData.id].length === 0) {
      this.chatHistories[charData.id] = [
        {
          role: 'character',
          text: charData.greeting,
          source: 'Textbook Persona'
        }
      ];
      this.speakText(charData.greeting);
    }

    this.renderChatMessages(charData.id);
    this.chatPanel.classList.remove('hidden');
  }

  closeCharacterChat() {
    this.activeCharacter = null;
    if (this.engine) {
      this.engine.activeTalkingCharacterId = null;
    }
    this.chatPanel.classList.add('hidden');
    document.querySelectorAll('.character-roster-chip').forEach((el) => el.classList.remove('active'));
  }

  renderChatMessages(charId) {
    const messages = this.chatHistories[charId] || [];
    this.chatMessagesEl.innerHTML = '';

    for (const msg of messages) {
      const div = document.createElement('div');
      div.className = `chat-bubble ${msg.role === 'user' ? 'user-bubble' : 'character-bubble'}`;
      const formattedHtml = this.formatMarkdownText(msg.text);
      div.innerHTML = `
        <div class="bubble-content">${formattedHtml}</div>
        ${msg.source ? `<div class="bubble-meta">${msg.source}</div>` : ''}
      `;
      this.chatMessagesEl.appendChild(div);
    }
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
  }

  formatMarkdownText(raw) {
    return (raw || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');
  }

  async sendUserMessageToCharacter(userText) {
    if (!this.activeCharacter || !userText.trim()) return;
    const char = this.activeCharacter;
    const charId = char.id;
    const cleanText = userText.trim();

    this.chatInput.value = '';
    if (!this.chatHistories[charId]) this.chatHistories[charId] = [];
    this.chatHistories[charId].push({ role: 'user', text: cleanText });

    // Add temporary thinking indicator
    this.chatHistories[charId].push({
      role: 'character',
      text: `_${char.name} is consulting the chronicle..._`,
      isPending: true
    });
    this.renderChatMessages(charId);

    let replyText = '';
    let sourceLabel = '';

    try {
      if (this.apiKey || this.hasServerKey) {
        const res = await fetch('/api/character-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: char,
            bookContext: {
              title: this.activeBook.title,
              era: this.activeBook.era,
              synopsis: this.activeBook.synopsis,
              chapters: this.activeBook.chapters
            },
            userMessage: cleanText,
            previousInteractionId: this.interactionIds[charId] || undefined,
            apiKey: this.apiKey || undefined,
            model: this.selectedModel
          })
        });

        const data = await res.json();
        if (data.ok && data.reply) {
          replyText = data.reply;
          if (data.interactionId) {
            this.interactionIds[charId] = data.interactionId;
          }
          sourceLabel = `${this.selectedModel} • Stateful Interaction`;
        } else {
          throw new Error(data.error || 'Fallback to local');
        }
      } else {
        replyText = generateContextualCharacterReply(char, this.activeBook, cleanText);
        sourceLabel = 'Textbook Knowledge Engine';
      }
    } catch {
      replyText = generateContextualCharacterReply(char, this.activeBook, cleanText);
      sourceLabel = 'Textbook Knowledge Engine';
    }

    // Replace pending bubble
    this.chatHistories[charId] = this.chatHistories[charId].filter((m) => !m.isPending);
    this.chatHistories[charId].push({
      role: 'character',
      text: replyText,
      source: sourceLabel
    });

    this.renderChatMessages(charId);
    this.speakText(replyText);
  }

  speakText(text) {
    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = (text || '').replace(/[*_#>]/g, '');
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 0.96;
    window.speechSynthesis.speak(utterance);
  }

  // ============================================================================
  // TEXTBOOK READER & LANDMARK POPUP
  // ============================================================================

  renderTextbookReader(book) {
    this.readerChaptersContainer.innerHTML = '';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'reader-book-header';
    headerDiv.innerHTML = `
      <div class="reader-era">${book.era}</div>
      <h2>${book.title}</h2>
      <p class="reader-subtitle">${book.subtitle} — ${book.author}</p>
      <p class="reader-synopsis">${book.synopsis}</p>
    `;
    this.readerChaptersContainer.appendChild(headerDiv);

    for (const ch of book.chapters || []) {
      const card = document.createElement('div');
      card.className = 'reader-chapter-card';
      card.innerHTML = `
        <div class="chapter-num">CHAPTER ${ch.number}</div>
        <h3>${ch.title}</h3>
        <p>${ch.summary}</p>
        <blockquote>${ch.keyExcerpt}</blockquote>
      `;
      this.readerChaptersContainer.appendChild(card);
    }

    // Also list landmarks & artifacts in the reader
    const lmSection = document.createElement('div');
    lmSection.className = 'reader-landmarks-section';
    lmSection.innerHTML = `<h3>🏛️ 3D Historical Monuments & Primary Artifacts</h3>`;
    for (const lm of book.landmarks || []) {
      const item = document.createElement('div');
      item.className = 'reader-landmark-item';
      item.innerHTML = `
        <strong>${lm.name} (${lm.type.toUpperCase()})</strong>
        <p>${lm.description}</p>
      `;
      lmSection.appendChild(item);
    }
    this.readerChaptersContainer.appendChild(lmSection);
  }

  openLandmarkPopup(landmark) {
    this.inspectedLandmarks.add(landmark.id);
    this.updateJournalCounter();
    this.readerModal.classList.remove('hidden');
  }

  updateJournalCounter() {
    const totalChars = (this.activeBook.characters || []).length;
    const doneChars = this.interviewedCharacters.size;
    if (this.journalBadge) {
      this.journalBadge.textContent = `${doneChars}/${totalChars} Met`;
    }
  }

  // ============================================================================
  // UPLOAD CUSTOM TEXTBOOK (PDF / TXT / MD -> GEMINI 3.8 FLASH OR LOCAL PARSER)
  // ============================================================================

  async handleUploadAndGenerate() {
    const file = this.fileInput.files?.[0];
    const pastedText = this.customTextPaste.value.trim();

    if (!file && !pastedText) {
      this.uploadStatusMsg.textContent = 'Please select a textbook file (.pdf, .txt, .md) or paste a textbook chapter below.';
      this.uploadStatusMsg.className = 'upload-status error';
      return;
    }

    this.generateBookBtn.disabled = true;
    this.uploadStatusMsg.className = 'upload-status loading';
    this.uploadStatusMsg.textContent =
      'Analyzing textbook, extracting historical characters, and constructing 3D book & world...';

    let fileName = file ? file.name : 'Custom Historical Textbook';
    let textContent = pastedText;
    let pdfBase64 = null;

    try {
      if (file) {
        if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
          pdfBase64 = await this.readFileAsBase64(file);
          // Also extract readable ASCII/UTF-8 strings from the PDF buffer as fallback for local mode
          const rawStrings = await this.extractFallbackTextFromPdfFile(file);
          if (!textContent) textContent = rawStrings;
        } else {
          const fileText = await file.text();
          textContent = fileText + (pastedText ? '\n\n' + pastedText : '');
        }
      }

      let generatedWorld = null;

      // If Gemini API key is available, call /api/analyze-textbook with gemini-3.8-flash structured JSON schema
      if (this.apiKey || this.hasServerKey) {
        try {
          const res = await fetch('/api/analyze-textbook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName,
              textContent,
              pdfBase64,
              apiKey: this.apiKey || undefined,
              model: this.selectedModel
            })
          });
          const data = await res.json();
          if (data.ok && data.worldData) {
            generatedWorld = {
              id: 'custom_' + Date.now(),
              ...data.worldData
            };
          }
        } catch {
          // Fallback to local textbook analyzer if network/key fails
        }
      }

      if (!generatedWorld) {
        generatedWorld = parseCustomTextbookLocally(textContent || fileName, fileName);
      }

      // Add to dropdown selector and load in 3D Book Mode!
      this.customBooks[generatedWorld.id] = generatedWorld;
      const opt = document.createElement('option');
      opt.value = generatedWorld.id;
      opt.textContent = `📘 ${generatedWorld.title} (Uploaded)`;
      this.bookSelectEl.appendChild(opt);
      this.bookSelectEl.value = generatedWorld.id;

      this.uploadModal.classList.add('hidden');
      this.uploadStatusMsg.textContent = '';
      this.loadBook(generatedWorld, 'book');
    } catch (err) {
      this.uploadStatusMsg.className = 'upload-status error';
      this.uploadStatusMsg.textContent = `Error processing file: ${err.message}`;
    } finally {
      this.generateBookBtn.disabled = false;
    }
  }

  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || '');
        const commaIdx = res.indexOf(',');
        resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async extractFallbackTextFromPdfFile(file) {
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let raw = '';
      for (let i = 0; i < Math.min(bytes.length, 300000); i++) {
        const c = bytes[i];
        if ((c >= 32 && c <= 126) || c === 10 || c === 13) {
          raw += String.fromCharCode(c);
        } else {
          raw += ' ';
        }
      }
      // Extract parenthesized PDF text tokens
      const matches = raw.match(/\(([A-Za-z0-9 ,.;:'"?!-]{4,})\)/g) || [];
      if (matches.length > 10) {
        return matches.map((m) => m.slice(1, -1)).join(' ');
      }
      return file.name.replace(/\.pdf$/i, '');
    } catch {
      return file.name;
    }
  }

  // ============================================================================
  // MINIMAP RADAR RENDERER
  // ============================================================================

  drawMinimap() {
    if (!this.minimapCanvas || !this.engine || this.engine.mode !== 'world') return;
    const ctx = this.minimapCanvas.getContext('2d');
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = (w * 0.44) / 28;

    ctx.clearRect(0, 0, w, h);

    // Radar background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.47, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(229, 184, 75, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner plaza rings
    ctx.strokeStyle = 'rgba(229, 184, 75, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.25, 0, Math.PI * 2);
    ctx.stroke();

    // Landmarks (squares)
    for (const lm of this.engine.landmarkEntities) {
      const lx = cx + lm.x * scale;
      const lz = cy + lm.z * scale;
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(lx - 3, lz - 3, 6, 6);
    }

    // Characters (colored dots)
    for (const c of this.engine.characterEntities) {
      const px = cx + c.x * scale;
      const pz = cy + c.z * scale;
      ctx.fillStyle = c.data.avatarStyle?.robeColor || '#fbbf24';
      ctx.beginPath();
      ctx.arc(px, pz, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Player position & direction cone
    const plx = cx + this.engine.player.x * scale;
    const plz = cy + this.engine.player.z * scale;
    ctx.save();
    ctx.translate(plx, plz);
    ctx.rotate(-this.engine.cameraYaw);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 18, -Math.PI * 0.7, -Math.PI * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ============================================================================
  // UI EVENT LISTENERS
  // ============================================================================

  bindUIEvents() {
    this.bookSelectEl.addEventListener('change', (e) => {
      const id = e.target.value;
      const book = PRESET_TEXTBOOKS[id] || this.customBooks[id];
      if (book) {
        this.loadBook(book, 'book');
      }
    });

    this.modeToggleBtn.addEventListener('click', () => {
      if (this.engine.mode === 'book') {
        this.engine.setMode('world');
      } else if (this.engine.mode === 'world') {
        this.engine.setMode('book');
      }
    });

    this.enterWorldBtn.addEventListener('click', () => {
      this.engine.setMode('world');
    });

    this.peekCoverBtn.addEventListener('click', () => {
      this.engine.toggleBookCoverInBookMode();
    });

    this.turnPageBtn.addEventListener('click', () => {
      const pageIdx = this.engine.nextBookPage(1);
      this.turnPageBtn.textContent = `📖 Flip Chapter (${pageIdx + 1}/${(this.activeBook.chapters || []).length})`;
    });

    this.cameraPovBtn.addEventListener('click', () => {
      const isFirst = this.engine.toggleFirstPerson();
      this.cameraPovBtn.textContent = isFirst ? '🎥 View: 1st Person' : '🎥 View: 3rd Person';
    });

    this.closeChatBtn.addEventListener('click', () => this.closeCharacterChat());

    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendUserMessageToCharacter(this.chatInput.value);
    });

    // Reader Modal
    this.readerToggleBtn.addEventListener('click', () => {
      this.readerModal.classList.remove('hidden');
    });
    this.journalBtn.addEventListener('click', () => {
      this.readerModal.classList.remove('hidden');
    });
    this.closeReaderBtn.addEventListener('click', () => {
      this.readerModal.classList.add('hidden');
    });

    // Voice TTS Toggle
    this.voiceToggleBtn.addEventListener('click', () => {
      this.voiceEnabled = !this.voiceEnabled;
      this.voiceToggleBtn.classList.toggle('active-toggle', this.voiceEnabled);
      this.voiceToggleBtn.textContent = this.voiceEnabled ? '🔊 Voice: ON' : '🔈 Voice: OFF';
      if (!this.voiceEnabled && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    });

    // Upload Textbook Modal
    this.uploadBtn.addEventListener('click', () => {
      this.uploadModal.classList.remove('hidden');
    });
    this.closeUploadBtn.addEventListener('click', () => {
      this.uploadModal.classList.add('hidden');
    });
    this.fileDropZone.addEventListener('click', () => this.fileInput.click());
    this.fileDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.fileDropZone.classList.add('drag-over');
    });
    this.fileDropZone.addEventListener('dragleave', () => {
      this.fileDropZone.classList.remove('drag-over');
    });
    this.fileDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.fileDropZone.classList.remove('drag-over');
      if (e.dataTransfer.files?.length) {
        this.fileInput.files = e.dataTransfer.files;
        this.selectedFileLabel.textContent = `Selected: ${e.dataTransfer.files[0].name}`;
      }
    });
    this.fileInput.addEventListener('change', () => {
      if (this.fileInput.files?.length) {
        this.selectedFileLabel.textContent = `Selected: ${this.fileInput.files[0].name}`;
      }
    });
    this.generateBookBtn.addEventListener('click', () => this.handleUploadAndGenerate());

    // API Settings Modal
    this.apiKeyBtn.addEventListener('click', () => {
      this.apiKeyInput.value = this.apiKey;
      this.modelSelectInput.value = this.selectedModel;
      this.apiModal.classList.remove('hidden');
    });
    this.closeApiModalBtn.addEventListener('click', () => {
      this.apiModal.classList.add('hidden');
    });
    this.saveApiBtn.addEventListener('click', () => {
      this.apiKey = this.apiKeyInput.value.trim();
      this.selectedModel = this.modelSelectInput.value;
      localStorage.setItem('chronicle_gemini_api_key', this.apiKey);
      localStorage.setItem('chronicle_gemini_model', this.selectedModel);
      this.updateApiIndicator();
      this.apiModal.classList.add('hidden');
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.chronicleApp = new ChronicleApp();
});
