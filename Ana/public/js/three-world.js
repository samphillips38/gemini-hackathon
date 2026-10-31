// 3D Book & Historical World Visualizer Engine (Three.js WebGL + Built-in 3D Fallback Renderer)

export class LivingTextbook3DEngine {
  constructor({ canvasContainer, labelLayer, onCharacterInteract, onLandmarkInteract, onProximityChange, onModeChange }) {
    this.container = canvasContainer;
    this.labelLayer = labelLayer;
    this.onCharacterInteract = onCharacterInteract;
    this.onLandmarkInteract = onLandmarkInteract;
    this.onProximityChange = onProximityChange;
    this.onModeChange = onModeChange;

    this.bookData = null;
    this.mode = 'book'; // 'book' | 'opening' | 'world'
    this.currentPageIndex = 0;
    this.firstPerson = false;

    // Book animation state
    this.openProgress = 0; // 0 = closed, 1 = fully open
    this.transitionTimer = 0;
    this.bookOrbitYaw = -0.35;
    this.bookOrbitPitch = 0.28;
    this.bookZoom = 7.2;

    // World Player & Camera state
    this.player = {
      x: 0,
      y: 0,
      z: 6,
      vx: 0,
      vz: 0,
      yaw: Math.PI, // facing north (-Z)
      speed: 8.5,
      targetX: null,
      targetZ: null,
      walkCycle: 0
    };
    this.cameraYaw = 0; // looking toward -Z
    this.cameraPitch = 0.36;
    this.cameraDist = 11.5;

    // Input state
    this.keys = {};
    this.isDragging = false;
    this.dragMoved = false;
    this.lastMouse = { x: 0, y: 0 };

    // Active entities
    this.characterEntities = [];
    this.landmarkEntities = [];
    this.nearestCharacter = null;
    this.nearestLandmark = null;
    this.activeTalkingCharacterId = null;

    this.clockStart = performance.now();
    this.lastFrameTime = performance.now();

    this.useThree = Boolean(window.THREE);
    if (this.useThree) {
      this.initThree();
    } else {
      this.initFallbackCanvas3D();
    }

    this.bindEvents();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  // ============================================================================
  // DYNAMIC CANVAS TEXTURE GENERATORS FOR THE 3D BOOK
  // ============================================================================

  createBookCoverTexture(book, isBack = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1400;
    const ctx = canvas.getContext('2d');

    const baseColor = book.coverColor || '#1b365d';
    const accent = book.accentColor || '#e5b84b';

    // Rich leather gradient background
    const grad = ctx.createRadialGradient(512, 650, 80, 512, 700, 900);
    grad.addColorStop(0, this.lightenHex(baseColor, 18));
    grad.addColorStop(0.7, baseColor);
    grad.addColorStop(1, this.darkenHex(baseColor, 35));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle leather grain noise lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 90; i++) {
      const y = (i * 17) % canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y + ((i % 3) - 1) * 8);
      ctx.stroke();
    }

    // Ornate double gold-leaf border
    ctx.strokeStyle = accent;
    ctx.lineWidth = 10;
    ctx.strokeRect(56, 56, canvas.width - 112, canvas.height - 112);
    ctx.lineWidth = 3;
    ctx.strokeRect(76, 76, canvas.width - 152, canvas.height - 152);

    // Corner filigree flourishes
    const corners = [
      [86, 86],
      [canvas.width - 86, 86],
      [86, canvas.height - 86],
      [canvas.width - 86, canvas.height - 86]
    ];
    ctx.fillStyle = accent;
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = accent;

    if (!isBack) {
      // Top era header
      ctx.font = '600 26px "Cinzel", Georgia, serif';
      ctx.fillText((book.era || 'HISTORICAL CHRONICLE').toUpperCase(), 512, 165);

      // Divider line
      ctx.beginPath();
      ctx.moveTo(240, 195);
      ctx.lineTo(784, 195);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Title (multi-line wrapped)
      ctx.fillStyle = '#fff9eb';
      ctx.font = 'bold 58px "Cinzel", Georgia, serif';
      const titleLines = this.wrapTextLines(ctx, book.title || 'Living Textbook', 760);
      let ty = 310;
      for (const line of titleLines.slice(0, 3)) {
        ctx.fillText(line, 512, ty);
        ty += 70;
      }

      // Subtitle
      ctx.fillStyle = accent;
      ctx.font = 'italic 30px Georgia, serif';
      const subLines = this.wrapTextLines(ctx, book.subtitle || '', 740);
      ty += 15;
      for (const line of subLines.slice(0, 2)) {
        ctx.fillText(line, 512, ty);
        ty += 42;
      }

      // Central Astrolabe / Rose Medallion Emblem
      const centerY = 820;
      ctx.save();
      ctx.translate(512, centerY);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 155, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 130, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 45, Math.sin(angle) * 45);
        ctx.lineTo(Math.cos(angle) * 150, Math.sin(angle) * 150);
        ctx.stroke();
      }
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = baseColor;
      ctx.font = 'bold 30px Georgia, serif';
      ctx.fillText('3D', 0, 10);
      ctx.restore();

      // Characters count badge
      ctx.fillStyle = '#f8efd4';
      ctx.font = '26px Georgia, serif';
      const charCount = (book.characters || []).length;
      const landmarkCount = (book.landmarks || []).length;
      ctx.fillText(
        `${charCount} Interactive Historical Figures • ${landmarkCount} 3D Monuments`,
        512,
        1120
      );

      // Author footer
      ctx.fillStyle = accent;
      ctx.font = '600 28px "Cinzel", Georgia, serif';
      ctx.fillText(book.author || 'Chronicle3D Living Archive', 512, 1245);
    } else {
      // Back cover synopsis
      ctx.font = 'bold 38px "Cinzel", Georgia, serif';
      ctx.fillText('CHRONICLE SYNOPSIS', 512, 240);
      ctx.fillStyle = '#f3ead8';
      ctx.font = '29px Georgia, serif';
      const synLines = this.wrapTextLines(ctx, book.synopsis || '', 720);
      let sy = 340;
      for (const line of synLines.slice(0, 10)) {
        ctx.fillText(line, 512, sy);
        sy += 48;
      }
      ctx.fillStyle = accent;
      ctx.font = 'italic 26px Georgia, serif';
      ctx.fillText('Open the cover to enter the 3D historical world', 512, 1220);
    }

    return canvas;
  }

  createBookSpineTexture(book) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1400;
    const ctx = canvas.getContext('2d');

    const baseColor = book.coverColor || '#1b365d';
    const accent = book.accentColor || '#e5b84b';

    ctx.fillStyle = this.darkenHex(baseColor, 18);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Raised spine ribs
    ctx.fillStyle = accent;
    const ribY = [120, 260, 1140, 1280];
    for (const ry of ribY) {
      ctx.fillRect(16, ry, canvas.width - 32, 14);
    }

    // Vertical spine title
    ctx.save();
    ctx.translate(128, 700);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff8e7';
    ctx.font = 'bold 38px "Cinzel", Georgia, serif';
    ctx.fillText((book.title || 'Chronicle').slice(0, 34), 0, 12);
    ctx.restore();

    return canvas;
  }

  createOpenPageTexture(book, side = 'left', chapterIdx = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1400;
    const ctx = canvas.getContext('2d');

    // Aged vellum parchment gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    if (side === 'left') {
      grad.addColorStop(0, '#efe4cc');
      grad.addColorStop(0.88, '#f7f0df');
      grad.addColorStop(1, '#cbbba0'); // inner gutter shadow
    } else {
      grad.addColorStop(0, '#cbbba0'); // inner gutter shadow
      grad.addColorStop(0.12, '#f7f0df');
      grad.addColorStop(1, '#efe4cc');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Inner manuscript border
    ctx.strokeStyle = '#8c6d3f';
    ctx.lineWidth = 4;
    ctx.strokeRect(72, 72, canvas.width - 144, canvas.height - 144);

    const chapters = book.chapters || [];
    const ch = chapters[chapterIdx % Math.max(1, chapters.length)] || {
      number: 1,
      title: 'Historical Overview',
      summary: book.synopsis || '',
      keyExcerpt: ''
    };

    ctx.fillStyle = '#2b2118';
    ctx.textAlign = 'left';

    if (side === 'left') {
      ctx.font = 'bold 30px "Cinzel", Georgia, serif';
      ctx.fillStyle = '#7c2d12';
      ctx.fillText(`DRAMATIS PERSONAE & WORLD MAP`, 115, 150);

      ctx.fillStyle = '#3b2f2f';
      ctx.font = 'italic 24px Georgia, serif';
      ctx.fillText(book.worldSetting?.locationName || book.era || '', 115, 195);

      // List characters from the book
      let y = 265;
      const chars = (book.characters || []).slice(0, 5);
      for (const c of chars) {
        ctx.fillStyle = c.avatarStyle?.robeColor || '#1e3a8a';
        ctx.beginPath();
        ctx.arc(140, y - 10, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1c1917';
        ctx.font = 'bold 28px Georgia, serif';
        ctx.fillText(`${c.name} (${c.years || ''})`, 172, y);
        y += 36;
        ctx.fillStyle = '#57534e';
        ctx.font = '23px Georgia, serif';
        ctx.fillText(c.title, 172, y);
        y += 52;
      }

      // Draw miniature architectural compass map at bottom of left page
      ctx.save();
      ctx.translate(512, 1020);
      ctx.strokeStyle = '#8c6d3f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 190, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 130, 0, Math.PI * 2);
      ctx.stroke();

      // Plot characters on the parchment map
      for (const c of chars) {
        const mx = ((c.position?.x || 0) / 26) * 150;
        const mz = ((c.position?.z || 0) / 26) * 150;
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.arc(mx, mz, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 20px Georgia, serif';
        ctx.fillStyle = '#2b2118';
        ctx.textAlign = 'center';
        ctx.fillText(c.name.split(' ')[0], mx, mz - 15);
      }
      ctx.restore();
    } else {
      // Right page: Active Chapter & Primary Excerpt
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7c2d12';
      ctx.font = 'bold 30px "Cinzel", Georgia, serif';
      ctx.fillText(`CHAPTER ${ch.number}`, 512, 155);

      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 40px "Cinzel", Georgia, serif';
      const chTitleLines = this.wrapTextLines(ctx, ch.title, 760);
      let cy = 215;
      for (const line of chTitleLines.slice(0, 2)) {
        ctx.fillText(line, 512, cy);
        cy += 48;
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#292524';
      ctx.font = '29px Georgia, serif';
      const sumLines = this.wrapTextLines(ctx, ch.summary, 760);
      cy += 35;
      for (const line of sumLines.slice(0, 8)) {
        ctx.fillText(line, 130, cy);
        cy += 44;
      }

      // Highlighted Primary Source Box
      cy += 30;
      ctx.fillStyle = 'rgba(180, 130, 60, 0.14)';
      ctx.fillRect(120, cy, 784, 340);
      ctx.strokeStyle = '#9a6b2f';
      ctx.lineWidth = 3;
      ctx.strokeRect(120, cy, 784, 340);

      ctx.fillStyle = '#5c2810';
      ctx.font = 'italic 28px Georgia, serif';
      const exLines = this.wrapTextLines(ctx, ch.keyExcerpt || '', 720);
      let ey = cy + 55;
      for (const line of exLines.slice(0, 6)) {
        ctx.fillText(line, 150, ey);
        ey += 42;
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#78716c';
      ctx.font = '24px Georgia, serif';
      ctx.fillText(`Page ${chapterIdx * 2 + 2} • Click "Enter 3D World" to walk among these figures`, 512, 1285);
    }

    return canvas;
  }

  wrapTextLines(ctx, text, maxWidth) {
    const words = (text || '').split(/\s+/);
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  lightenHex(hex, percent) {
    const num = parseInt((hex || '#1b365d').replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + percent);
    const g = Math.min(255, ((num >> 8) & 0xff) + percent);
    const b = Math.min(255, (num & 0xff) + percent);
    return `rgb(${r},${g},${b})`;
  }

  darkenHex(hex, percent) {
    const num = parseInt((hex || '#1b365d').replace('#', ''), 16);
    const r = Math.max(0, ((num >> 16) & 0xff) - percent);
    const g = Math.max(0, ((num >> 8) & 0xff) - percent);
    const b = Math.max(0, (num & 0xff) - percent);
    return `rgb(${r},${g},${b})`;
  }

  // ============================================================================
  // THREE.JS WEBGL INITIALIZATION & SCENE CONSTRUCTION
  // ============================================================================

  initThree() {
    const THREE = window.THREE;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0f172a');
    this.scene.fog = new THREE.FogExp2('#0f172a', 0.012);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 300);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Lights
    this.ambientLight = new THREE.AmbientLight(0xfffaed, 0.72);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d0, 1.35);
    this.sunLight.position.set(18, 32, 22);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 110;
    const d = 38;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);

    this.bookGlowLight = new THREE.PointLight(0xfbbf24, 1.8, 18);
    this.bookGlowLight.position.set(0, 2.5, 0);
    this.scene.add(this.bookGlowLight);

    // Scene root groups
    this.bookStageGroup = new THREE.Group();
    this.worldStageGroup = new THREE.Group();
    this.scene.add(this.bookStageGroup);
    this.scene.add(this.worldStageGroup);

    this.raycaster = new THREE.Raycaster();
    this.mouseNDC = new THREE.Vector2();
  }

  loadTextbook(bookData) {
    this.bookData = bookData;
    this.currentPageIndex = 0;
    this.activeTalkingCharacterId = null;

    if (this.useThree) {
      this.buildThreeBookStage(bookData);
      this.buildThreeWorldStage(bookData);
      this.applyStageVisibility();
    } else {
      this.buildFallbackEntities(bookData);
    }

    this.rebuildDOMLabels();
  }

  buildThreeBookStage(book) {
    const THREE = window.THREE;
    while (this.bookStageGroup.children.length > 0) {
      this.bookStageGroup.remove(this.bookStageGroup.children[0]);
    }

    // Sanctuary pedestal beneath the 3D book
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.3
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: book.accentColor || '#e5b84b',
      roughness: 0.25,
      metalness: 0.8
    });

    const baseCylinder = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.7, 0.45, 48), pedestalMat);
    baseCylinder.position.y = -1.65;
    baseCylinder.receiveShadow = true;
    this.bookStageGroup.add(baseCylinder);

    const goldRing = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.07, 16, 64), trimMat);
    goldRing.rotation.x = Math.PI / 2;
    goldRing.position.y = -1.42;
    this.bookStageGroup.add(goldRing);

    // Book root group (tilted towards viewer when closed, flattens when opening)
    this.bookRoot = new THREE.Group();
    this.bookStageGroup.add(this.bookRoot);

    const bookW = 3.2;
    const bookH = 4.3;
    const pageThickness = 0.56;
    const coverThickness = 0.08;

    const frontTex = new THREE.CanvasTexture(this.createBookCoverTexture(book, false));
    const backTex = new THREE.CanvasTexture(this.createBookCoverTexture(book, true));
    const spineTex = new THREE.CanvasTexture(this.createBookSpineTexture(book));
    this.leftPageTex = new THREE.CanvasTexture(this.createOpenPageTexture(book, 'left', this.currentPageIndex));
    this.rightPageTex = new THREE.CanvasTexture(this.createOpenPageTexture(book, 'right', this.currentPageIndex));

    const leatherMat = new THREE.MeshStandardMaterial({
      color: book.coverColor || '#1b365d',
      roughness: 0.55,
      metalness: 0.15
    });
    const goldEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xe8c56b,
      roughness: 0.3,
      metalness: 0.65
    });

    // Back Cover (stationary right half when open)
    const backCoverMesh = new THREE.Mesh(
      new THREE.BoxGeometry(bookW, coverThickness, bookH),
      [
        leatherMat,
        leatherMat,
        new THREE.MeshStandardMaterial({ map: this.rightPageTex, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.5 }),
        leatherMat,
        leatherMat
      ]
    );
    backCoverMesh.position.set(bookW / 2, -pageThickness / 2 - coverThickness / 2, 0);
    backCoverMesh.castShadow = true;
    backCoverMesh.receiveShadow = true;
    this.bookRoot.add(backCoverMesh);

    // Right Page Block resting on Back Cover
    const rightPagesMesh = new THREE.Mesh(
      new THREE.BoxGeometry(bookW - 0.14, pageThickness, bookH - 0.16),
      [
        goldEdgeMat,
        leatherMat,
        new THREE.MeshStandardMaterial({ map: this.rightPageTex, roughness: 0.65 }),
        goldEdgeMat,
        goldEdgeMat,
        goldEdgeMat
      ]
    );
    rightPagesMesh.position.set((bookW - 0.14) / 2 + 0.04, 0, 0);
    rightPagesMesh.castShadow = true;
    rightPagesMesh.receiveShadow = true;
    this.bookRoot.add(rightPagesMesh);
    this.rightPagesMesh = rightPagesMesh;

    // Spine
    const spineMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, pageThickness + coverThickness * 2, bookH),
      new THREE.MeshStandardMaterial({ map: spineTex, roughness: 0.5 })
    );
    spineMesh.position.set(-0.04, 0, 0);
    spineMesh.castShadow = true;
    this.bookRoot.add(spineMesh);

    // Front Cover Pivot at Spine Hinge (x = 0, y = pageThickness/2)
    this.frontCoverPivot = new THREE.Group();
    this.frontCoverPivot.position.set(0, pageThickness / 2, 0);
    this.bookRoot.add(this.frontCoverPivot);

    // Front cover board: when openProgress=0, sits over x in [0, bookW].
    // When rotated around Z by +Math.PI * 0.94, swings left to [-bookW, 0] revealing left page!
    const frontCoverMesh = new THREE.Mesh(
      new THREE.BoxGeometry(bookW, coverThickness, bookH),
      [
        leatherMat,
        leatherMat,
        new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.45 }),
        new THREE.MeshStandardMaterial({ map: this.leftPageTex, roughness: 0.65 }),
        leatherMat,
        leatherMat
      ]
    );
    frontCoverMesh.position.set(bookW / 2, coverThickness / 2, 0);
    frontCoverMesh.castShadow = true;
    frontCoverMesh.receiveShadow = true;
    this.frontCoverPivot.add(frontCoverMesh);

    // Pop-up miniature world silhouette rising out of the book when opening!
    this.popupDioramaGroup = new THREE.Group();
    this.popupDioramaGroup.position.set(0, 0.3, 0);
    this.popupDioramaGroup.scale.set(0.01, 0.01, 0.01);
    this.bookRoot.add(this.popupDioramaGroup);

    // Add miniature glowing pillars & character silhouettes inside popupDioramaGroup
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const miniCol = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.13, 1.3, 12),
        new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: 0xd97706,
          emissiveIntensity: 0.45,
          roughness: 0.3
        })
      );
      miniCol.position.set(Math.cos(angle) * 1.1, 0.65, Math.sin(angle) * 1.1);
      this.popupDioramaGroup.add(miniCol);
    }

    // Floating dust motes around the book pedestal
    const particleGeo = new THREE.BufferGeometry();
    const pCount = 120;
    const pPositions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 14;
      pPositions[i * 3 + 1] = (Math.random() - 0.2) * 8;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xfde68a,
      size: 0.09,
      transparent: true,
      opacity: 0.75
    });
    this.bookParticles = new THREE.Points(particleGeo, particleMat);
    this.bookStageGroup.add(this.bookParticles);
  }

  refreshBookPageTextures() {
    if (!this.bookData || !this.useThree) return;
    const THREE = window.THREE;
    this.leftPageTex = new THREE.CanvasTexture(
      this.createOpenPageTexture(this.bookData, 'left', this.currentPageIndex)
    );
    this.rightPageTex = new THREE.CanvasTexture(
      this.createOpenPageTexture(this.bookData, 'right', this.currentPageIndex)
    );
    if (this.rightPagesMesh && Array.isArray(this.rightPagesMesh.material)) {
      this.rightPagesMesh.material[2].map = this.rightPageTex;
      this.rightPagesMesh.material[2].needsUpdate = true;
    }
    if (this.frontCoverPivot?.children[0]) {
      const fc = this.frontCoverPivot.children[0];
      if (Array.isArray(fc.material)) {
        fc.material[3].map = this.leftPageTex;
        fc.material[3].needsUpdate = true;
      }
    }
  }

  buildThreeWorldStage(book) {
    const THREE = window.THREE;
    while (this.worldStageGroup.children.length > 0) {
      this.worldStageGroup.remove(this.worldStageGroup.children[0]);
    }
    this.characterEntities = [];
    this.landmarkEntities = [];

    const ws = book.worldSetting || {};
    const groundColor = ws.groundColor || '#3a4234';
    const plazaColor = ws.plazaColor || '#c9bfae';
    const accentColor = book.accentColor || '#e5b84b';

    // 1. Expansive Ground Terrain
    const groundMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(85, 85, 0.6, 64),
      new THREE.MeshStandardMaterial({ color: groundColor, roughness: 0.9 })
    );
    groundMesh.position.y = -0.35;
    groundMesh.receiveShadow = true;
    groundMesh.userData = { isGround: true };
    this.worldStageGroup.add(groundMesh);
    this.groundMesh = groundMesh;

    // 2. Central Historical Plaza & Radiating Stone Avenues
    const plazaMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(28, 28.5, 0.12, 48),
      new THREE.MeshStandardMaterial({ color: plazaColor, roughness: 0.75 })
    );
    plazaMesh.position.y = -0.04;
    plazaMesh.receiveShadow = true;
    plazaMesh.userData = { isGround: true };
    this.worldStageGroup.add(plazaMesh);

    // Decorative Plaza Rings
    const ringMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.4, metalness: 0.5 });
    for (const radius of [5.5, 14, 23]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.12, radius + 0.12, 64), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      this.worldStageGroup.add(ring);
    }

    // 3. Giant Open Book Gateway at South Entrance (z = 26) showing you stepped out of the book!
    const gatewayGroup = this.createWorldOpenBookGateway(book);
    gatewayGroup.position.set(0, 0.2, 26);
    this.worldStageGroup.add(gatewayGroup);

    // 4. Waypoint click ring
    this.waypointRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.7, 32),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    this.waypointRing.rotation.x = -Math.PI / 2;
    this.waypointRing.position.y = 0.06;
    this.waypointRing.visible = false;
    this.worldStageGroup.add(this.waypointRing);

    // 5. Build Landmarks from Textbook
    for (const lm of book.landmarks || []) {
      const lmGroup = this.createLandmarkMesh(lm, book);
      lmGroup.position.set(lm.x || 0, 0, lm.z || -18);
      lmGroup.userData = { landmark: lm };
      this.worldStageGroup.add(lmGroup);
      this.landmarkEntities.push({ data: lm, group: lmGroup, x: lm.x || 0, z: lm.z || -18 });
    }

    // 6. Build Perimeter Trees & Atmospheric Braziers/Lanterns
    this.buildWorldSceneryProps(book);

    // 7. Build Interactive 3D Historical Characters
    for (const charData of book.characters || []) {
      const charObj = this.createCharacterMesh(charData);
      const px = charData.position?.x ?? 0;
      const pz = charData.position?.z ?? 0;
      charObj.group.position.set(px, 0, pz);
      this.worldStageGroup.add(charObj.group);
      this.characterEntities.push({
        data: charData,
        ...charObj,
        x: px,
        z: pz
      });
    }

    // 8. Build Player Explorer Avatar
    this.playerAvatar = this.createPlayerAvatarMesh();
    this.worldStageGroup.add(this.playerAvatar.group);
    this.player.x = 0;
    this.player.z = 16;
    this.player.yaw = Math.PI;
    this.player.targetX = null;
    this.player.targetZ = null;
  }

  createWorldOpenBookGateway(book) {
    const THREE = window.THREE;
    const g = new THREE.Group();
    const coverMat = new THREE.MeshStandardMaterial({ color: book.coverColor || '#1b365d', roughness: 0.5 });
    const pageMat = new THREE.MeshStandardMaterial({ color: 0xf5ecd7, roughness: 0.7 });
    const goldMat = new THREE.MeshStandardMaterial({ color: book.accentColor || '#e5b84b', metalness: 0.7, roughness: 0.3 });

    const leftBoard = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.25, 3.8), coverMat);
    leftBoard.position.set(-2.7, 0.2, 0);
    leftBoard.rotation.z = -0.08;
    g.add(leftBoard);

    const rightBoard = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.25, 3.8), coverMat);
    rightBoard.position.set(2.7, 0.2, 0);
    rightBoard.rotation.z = 0.08;
    g.add(rightBoard);

    const leftPage = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.35, 3.5), pageMat);
    leftPage.position.set(-2.55, 0.4, 0);
    leftPage.rotation.z = -0.06;
    g.add(leftPage);

    const rightPage = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.35, 3.5), pageMat);
    rightPage.position.set(2.55, 0.4, 0);
    rightPage.rotation.z = 0.06;
    g.add(rightPage);

    const archRing = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.12, 16, 48, Math.PI), goldMat);
    archRing.position.set(0, 0.4, 0);
    g.add(archRing);

    return g;
  }

  createLandmarkMesh(lm, book) {
    const THREE = window.THREE;
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe7e0d3, roughness: 0.65 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.8 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: book.accentColor || '#e5b84b',
      roughness: 0.3,
      metalness: 0.65
    });
    const vermilionMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 });

    const type = lm.type || 'temple';

    if (type === 'temple') {
      // Stepped stylobate + Doric columns + pediment
      const step1 = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.45, 6.5), stoneMat);
      step1.position.y = 0.22;
      step1.castShadow = true;
      step1.receiveShadow = true;
      g.add(step1);

      const step2 = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.45, 5.6), stoneMat);
      step2.position.y = 0.67;
      step2.castShadow = true;
      g.add(step2);

      for (let ix = -3.6; ix <= 3.6; ix += 1.8) {
        for (const iz of [-2.1, 2.1]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 4.2, 16), stoneMat);
          col.position.set(ix, 3.0, iz);
          col.castShadow = true;
          g.add(col);
        }
      }

      const entablature = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.6, 5.8), stoneMat);
      entablature.position.y = 5.4;
      entablature.castShadow = true;
      g.add(entablature);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 1.8, 4), accentMat);
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(1.15, 1, 0.78);
      roof.position.y = 6.6;
      roof.castShadow = true;
      g.add(roof);
    } else if (type === 'pagoda') {
      // Multi-tiered Tang Pagoda
      const base = new THREE.Mesh(new THREE.BoxGeometry(7, 0.8, 7), stoneMat);
      base.position.y = 0.4;
      g.add(base);

      for (let tier = 0; tier < 4; tier++) {
        const s = 4.6 - tier * 0.85;
        const y = 1.6 + tier * 2.1;
        const body = new THREE.Mesh(new THREE.BoxGeometry(s, 1.6, s), vermilionMat);
        body.position.y = y;
        body.castShadow = true;
        g.add(body);

        const eave = new THREE.Mesh(new THREE.ConeGeometry(s * 0.92, 0.75, 4), accentMat);
        eave.rotation.y = Math.PI / 4;
        eave.position.y = y + 1.1;
        eave.castShadow = true;
        g.add(eave);
      }
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.22, 2.2, 12), accentMat);
      spire.position.y = 10.2;
      g.add(spire);
    } else if (type === 'fortress') {
      // Bastille-style masonry towers & archway
      for (const tx of [-2.6, 2.6]) {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 6.2, 16), darkStoneMat);
        tower.position.set(tx, 3.1, 0);
        tower.castShadow = true;
        g.add(tower);

        const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.6, 12), darkStoneMat);
        rim.position.set(tx, 6.3, 0);
        g.add(rim);
      }
      const wall = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.8, 1.8), darkStoneMat);
      wall.position.set(0, 2.4, 0);
      wall.castShadow = true;
      g.add(wall);
    } else if (type === 'amphitheater') {
      // Stepped stone tiers & speaker's rostrum
      for (let i = 0; i < 3; i++) {
        const arc = new THREE.Mesh(
          new THREE.CylinderGeometry(3.2 + i * 1.1, 3.4 + i * 1.1, 0.55, 24, 1, false, 0, Math.PI),
          stoneMat
        );
        arc.position.y = 0.27 + i * 0.45;
        arc.castShadow = true;
        g.add(arc);
      }
      const bema = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.6), accentMat);
      bema.position.set(0, 0.6, 1.2);
      bema.castShadow = true;
      g.add(bema);
    } else if (type === 'fountain') {
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.65, 32), stoneMat);
      basin.position.y = 0.32;
      g.add(basin);
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(2.9, 2.9, 0.55, 32),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.15, metalness: 0.3 })
      );
      water.position.y = 0.42;
      g.add(water);
      const centerPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.6, 16), accentMat);
      centerPillar.position.y = 1.3;
      g.add(centerPillar);
    } else if (type === 'arch') {
      for (const px of [-2.0, 2.0]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.8, 1.1), stoneMat);
        pillar.position.set(px, 2.4, 0);
        pillar.castShadow = true;
        g.add(pillar);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.1, 1.5), accentMat);
      lintel.position.set(0, 5.1, 0);
      lintel.castShadow = true;
      g.add(lintel);
    } else {
      // Obelisk / Stele / Statue
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 2.2), darkStoneMat);
      plinth.position.y = 0.5;
      g.add(plinth);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, 5.2, 4), stoneMat);
      shaft.rotation.y = Math.PI / 4;
      shaft.position.y = 3.6;
      shaft.castShadow = true;
      g.add(shaft);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 4), accentMat);
      tip.rotation.y = Math.PI / 4;
      tip.position.y = 6.65;
      g.add(tip);
    }

    return g;
  }

  buildWorldSceneryProps(book) {
    const THREE = window.THREE;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 });
    const foliageColor = book.themeStyle === 'imperial' ? 0xd97706 : book.themeStyle === 'revolution' ? 0x3f6212 : 0x2e4f34;
    const leafMat = new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.8 });

    // Ring of trees & braziers around the outer plaza
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      if (Math.abs(Math.sin(angle)) > 0.92 && Math.sin(angle) > 0) continue; // keep south book gateway clear
      const r = 31 + (i % 2) * 4;
      const tx = Math.cos(angle) * r;
      const tz = Math.sin(angle) * r;

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 2.2, 8), trunkMat);
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      tree.add(trunk);

      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.8, 10), leafMat);
      crown.position.y = 3.5;
      crown.castShadow = true;
      tree.add(crown);

      tree.position.set(tx, 0, tz);
      this.worldStageGroup.add(tree);
    }
  }

  createCharacterMesh(charData) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    group.userData = { character: charData };

    const style = charData.avatarStyle || {};
    const robeMat = new THREE.MeshStandardMaterial({ color: style.robeColor || '#1e3a8a', roughness: 0.55 });
    const cloakMat = new THREE.MeshStandardMaterial({ color: style.cloakColor || '#d97706', roughness: 0.5 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xebbe9b, roughness: 0.6 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.7, roughness: 0.25 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.7 });

    // Glowing proximity ring on ground
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.38, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45
      })
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.05;
    group.add(ringMesh);

    // Character Pedestal Base
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.22, 24), darkMat);
    ped.position.y = 0.11;
    ped.receiveShadow = true;
    group.add(ped);

    // Body container for idle breathing animation
    const bodyGroup = new THREE.Group();
    bodyGroup.position.y = 0.22;
    group.add(bodyGroup);

    // Robe / Lower Garment
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.64, 1.35, 18), robeMat);
    robe.position.y = 0.68;
    robe.castShadow = true;
    bodyGroup.add(robe);

    // Upper Torso & Draped Cloak
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.78, 0.44), robeMat);
    torso.position.y = 1.55;
    torso.castShadow = true;
    bodyGroup.add(torso);

    const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.68, 1.55, 16, 1, false, -Math.PI * 0.6, Math.PI * 1.2), cloakMat);
    cloak.position.set(0, 1.15, -0.05);
    cloak.castShadow = true;
    bodyGroup.add(cloak);

    // Sash / Belt
    const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.45, 0.16, 16), goldMat);
    sash.position.y = 1.22;
    bodyGroup.add(sash);

    // Head Group (tracks player when nearby)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 2.22, 0);
    bodyGroup.add(headGroup);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 20), skinMat);
    head.castShadow = true;
    headGroup.add(head);

    // Eyes
    for (const ex of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), darkMat);
      eye.position.set(ex, 0.04, 0.28);
      headGroup.add(eye);
    }

    // Period Headgear
    const hg = style.headgear || 'laurel';
    if (hg === 'helmet') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.65), goldMat);
      dome.position.y = 0.04;
      headGroup.add(dome);
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.62), cloakMat);
      crest.position.set(0, 0.42, -0.04);
      headGroup.add(crest);
    } else if (hg === 'crown' || hg === 'diadem') {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.31, 0.22, 16), goldMat);
      crown.position.y = 0.28;
      headGroup.add(crown);
    } else if (hg === 'tricorne') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.08, 3), darkMat);
      brim.position.y = 0.26;
      headGroup.add(brim);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.31, 0.24, 16), darkMat);
      cap.position.y = 0.34;
      headGroup.add(cap);
    } else if (hg === 'scholar_cap' || hg === 'hood') {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.46), darkMat);
      cap.position.y = 0.3;
      headGroup.add(cap);
    } else if (hg === 'laurel') {
      const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 20), goldMat);
      wreath.rotation.x = Math.PI / 2 - 0.15;
      wreath.position.y = 0.14;
      headGroup.add(wreath);
    }

    // Articulated Arms & Held Historical Prop
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.75, 12), robeMat);
    leftArm.position.set(-0.5, 1.5, 0.08);
    leftArm.rotation.z = 0.22;
    bodyGroup.add(leftArm);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.5, 1.75, 0.08);
    bodyGroup.add(rightArmGroup);

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.75, 12), robeMat);
    rightArm.position.set(0, -0.3, 0.15);
    rightArm.rotation.x = -0.55;
    rightArmGroup.add(rightArm);

    const propType = style.prop || 'scroll';
    if (propType === 'staff' || propType === 'sword') {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, propType === 'staff' ? 2.3 : 1.3, 8),
        propType === 'sword' ? goldMat : darkMat
      );
      shaft.position.set(0.05, propType === 'staff' ? -0.2 : 0.15, 0.42);
      rightArmGroup.add(shaft);
    } else {
      const scroll = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.46, 12),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 })
      );
      scroll.rotation.z = Math.PI / 2;
      scroll.position.set(0, -0.5, 0.42);
      rightArmGroup.add(scroll);
    }

    return { group, bodyGroup, headGroup, rightArmGroup, ringMesh };
  }

  createPlayerAvatarMesh() {
    const THREE = window.THREE;
    const group = new THREE.Group();

    const tunicMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.5 });
    const capeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.6 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 1.35, 16), tunicMat);
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.15, 0.12), capeMat);
    cape.position.set(0, 0.85, -0.26);
    cape.rotation.x = 0.14;
    group.add(cape);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 16), skinMat);
    head.position.y = 1.65;
    head.castShadow = true;
    group.add(head);

    return { group, body, head };
  }

  // ============================================================================
  // STAGE TRANSITIONS: 3D BOOK <-> CINEMATIC BOOK OPENING <-> 3D WORLD
  // ============================================================================

  setMode(targetMode) {
    if (targetMode === 'world' && this.mode === 'book') {
      // Trigger dramatic book-opening animation before diving into the world
      this.mode = 'opening';
      this.transitionTimer = 0;
      if (this.onModeChange) this.onModeChange('opening');
      return;
    }

    this.mode = targetMode;
    if (targetMode === 'book') {
      this.openProgress = 0;
      this.bookOrbitYaw = -0.35;
      this.bookOrbitPitch = 0.28;
      this.bookZoom = 7.2;
    } else if (targetMode === 'world') {
      this.openProgress = 1;
    }

    this.applyStageVisibility();
    if (this.onModeChange) this.onModeChange(this.mode);
  }

  toggleBookCoverInBookMode() {
    this.openProgress = this.openProgress < 0.5 ? 1 : 0;
  }

  nextBookPage(delta = 1) {
    if (!this.bookData) return;
    const total = Math.max(1, (this.bookData.chapters || []).length);
    this.currentPageIndex = (this.currentPageIndex + delta + total) % total;
    this.openProgress = 1; // Ensure book is open to view pages
    this.refreshBookPageTextures();
    return this.currentPageIndex;
  }

  applyStageVisibility() {
    if (!this.useThree || !this.bookData) return;
    const THREE = window.THREE;
    const ws = this.bookData.worldSetting || {};

    if (this.mode === 'book' || this.mode === 'opening') {
      this.bookStageGroup.visible = true;
      this.worldStageGroup.visible = false;
      this.scene.background = new THREE.Color('#0c1322');
      this.scene.fog.color.set('#0c1322');
      this.scene.fog.density = 0.02;
    } else {
      this.bookStageGroup.visible = false;
      this.worldStageGroup.visible = true;
      this.scene.background = new THREE.Color(ws.skyColor || '#1d3557');
      this.scene.fog.color.set(ws.horizonColor || '#e09f67');
      this.scene.fog.density = 0.0095;
    }
  }

  teleportToCharacter(charId) {
    const target = this.characterEntities.find((c) => c.data.id === charId);
    if (!target) return;
    if (this.mode !== 'world') {
      this.mode = 'world';
      this.applyStageVisibility();
      if (this.onModeChange) this.onModeChange('world');
    }
    const angleToCenter = Math.atan2(-target.x, -target.z);
    this.player.x = target.x + Math.sin(angleToCenter) * 2.8;
    this.player.z = target.z + Math.cos(angleToCenter) * 2.8;
    this.player.targetX = null;
    this.player.targetZ = null;
    this.player.yaw = Math.atan2(target.x - this.player.x, target.z - this.player.z);
    this.cameraYaw = this.player.yaw + Math.PI;
    this.activeTalkingCharacterId = target.data.id;
    if (this.onCharacterInteract) {
      this.onCharacterInteract(target.data);
    }
  }

  toggleFirstPerson() {
    this.firstPerson = !this.firstPerson;
    if (this.playerAvatar?.group) {
      this.playerAvatar.group.visible = !this.firstPerson;
    }
    return this.firstPerson;
  }

  // ============================================================================
  // DOM FLOATING 3D NAMEPLATES & PROXIMITY BADGES
  // ============================================================================

  rebuildDOMLabels() {
    if (!this.labelLayer || !this.bookData) return;
    this.labelLayer.innerHTML = '';

    for (const c of this.characterEntities) {
      const el = document.createElement('div');
      el.className = 'world-3d-label character-label';
      el.innerHTML = `
        <div class="label-faction">${c.data.faction || ''}</div>
        <div class="label-name">${c.data.name}</div>
        <div class="label-title">${c.data.title}</div>
        <div class="label-cta">Click or Press [E] to Chat</div>
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.teleportToCharacter(c.data.id);
      });
      this.labelLayer.appendChild(el);
      c.labelEl = el;
    }

    for (const lm of this.landmarkEntities) {
      const el = document.createElement('div');
      el.className = 'world-3d-label landmark-label';
      el.innerHTML = `
        <div class="label-landmark-icon">🏛️</div>
        <div class="label-name">${lm.data.name}</div>
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onLandmarkInteract) this.onLandmarkInteract(lm.data);
      });
      this.labelLayer.appendChild(el);
      lm.labelEl = el;
    }
  }

  updateDOMLabels() {
    if (!this.labelLayer) return;
    const showLabels = this.mode === 'world';
    this.labelLayer.style.display = showLabels ? 'block' : 'none';
    if (!showLabels) return;

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    for (const c of this.characterEntities) {
      if (!c.labelEl) continue;
      const screen = this.project3DToScreen(c.x, 3.35, c.z, w, h);
      if (!screen.visible) {
        c.labelEl.style.display = 'none';
        continue;
      }
      c.labelEl.style.display = 'flex';
      c.labelEl.style.transform = `translate(-50%, -100%) translate(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px)`;
      const isNear = this.nearestCharacter?.data.id === c.data.id;
      c.labelEl.classList.toggle('is-nearby', isNear);
    }

    for (const lm of this.landmarkEntities) {
      if (!lm.labelEl) continue;
      const screen = this.project3DToScreen(lm.x, 5.8, lm.z, w, h);
      if (!screen.visible) {
        lm.labelEl.style.display = 'none';
        continue;
      }
      lm.labelEl.style.display = 'flex';
      lm.labelEl.style.transform = `translate(-50%, -100%) translate(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px)`;
    }
  }

  project3DToScreen(x, y, z, width, height) {
    if (this.useThree && this.camera) {
      const THREE = window.THREE;
      const v = new THREE.Vector3(x, y, z);
      v.project(this.camera);
      if (v.z > 1) return { visible: false, x: 0, y: 0 };
      return {
        visible: true,
        x: (v.x * 0.5 + 0.5) * width,
        y: (-(v.y * 0.5) + 0.5) * height
      };
    }
    return this.projectFallbackPoint(x, y, z, width, height);
  }

  // ============================================================================
  // INPUT & RAYCAST INTERACTION
  // ============================================================================

  bindEvents() {
    window.addEventListener('resize', () => this.handleResize());

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      const k = e.key.toLowerCase();
      this.keys[k] = true;

      if (k === 'e' && this.mode === 'world') {
        if (this.nearestCharacter && this.onCharacterInteract) {
          this.activeTalkingCharacterId = this.nearestCharacter.data.id;
          this.onCharacterInteract(this.nearestCharacter.data);
        } else if (this.nearestLandmark && this.onLandmarkInteract) {
          this.onLandmarkInteract(this.nearestLandmark.data);
        }
      } else if (e.code === 'Space' && this.mode === 'book') {
        e.preventDefault();
        this.setMode('world');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.isDragging = true;
      this.dragMoved = false;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.dragMoved = true;
      }
      this.lastMouse = { x: e.clientX, y: e.clientY };

      if (this.mode === 'book') {
        this.bookOrbitYaw -= dx * 0.007;
        this.bookOrbitPitch = Math.max(-0.4, Math.min(1.1, this.bookOrbitPitch + dy * 0.006));
      } else if (this.mode === 'world') {
        this.cameraYaw -= dx * 0.0065;
        this.cameraPitch = Math.max(0.08, Math.min(1.15, this.cameraPitch + dy * 0.0055));
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (!this.dragMoved) {
        this.handleCanvasClick(e);
      }
    });

    this.container.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.mode === 'book') {
          this.bookZoom = Math.max(4.2, Math.min(12, this.bookZoom + e.deltaY * 0.005));
        } else if (this.mode === 'world') {
          this.cameraDist = Math.max(4.5, Math.min(26, this.cameraDist + e.deltaY * 0.01));
        }
      },
      { passive: false }
    );
  }

  handleCanvasClick(e) {
    if (this.mode === 'book') {
      // Clicking the 3D book opens the cover or enters the world
      if (this.openProgress < 0.5) {
        this.openProgress = 1;
      } else {
        this.setMode('world');
      }
      return;
    }

    if (this.mode !== 'world' || !this.useThree) return;

    const rect = this.container.getBoundingClientRect();
    this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseNDC, this.camera);

    // Check characters first
    const charGroups = this.characterEntities.map((c) => c.group);
    const charHits = this.raycaster.intersectObjects(charGroups, true);
    if (charHits.length > 0) {
      let obj = charHits[0].object;
      while (obj && !obj.userData?.character) {
        obj = obj.parent;
      }
      if (obj?.userData?.character) {
        this.teleportToCharacter(obj.userData.character.id);
        return;
      }
    }

    // Check landmarks
    const lmGroups = this.landmarkEntities.map((l) => l.group);
    const lmHits = this.raycaster.intersectObjects(lmGroups, true);
    if (lmHits.length > 0) {
      let obj = lmHits[0].object;
      while (obj && !obj.userData?.landmark) {
        obj = obj.parent;
      }
      if (obj?.userData?.landmark && this.onLandmarkInteract) {
        this.onLandmarkInteract(obj.userData.landmark);
        return;
      }
    }

    // Check ground for click-to-walk
    if (this.groundMesh) {
      const groundHits = this.raycaster.intersectObject(this.groundMesh, false);
      if (groundHits.length > 0) {
        const pt = groundHits[0].point;
        const distFromOrigin = Math.hypot(pt.x, pt.z);
        if (distFromOrigin < 27) {
          this.player.targetX = pt.x;
          this.player.targetZ = pt.z;
          if (this.waypointRing) {
            this.waypointRing.position.set(pt.x, 0.06, pt.z);
            this.waypointRing.visible = true;
          }
        }
      }
    }
  }

  handleResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (this.useThree && this.renderer && this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    } else if (this.fallbackCanvas) {
      this.fallbackCanvas.width = w;
      this.fallbackCanvas.height = h;
    }
  }

  // ============================================================================
  // MAIN ANIMATION LOOP (60FPS BOOK HINGE, POPUP DIORAMA & WORLD EXPLORATION)
  // ============================================================================

  animate(now) {
    requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    const elapsed = (now - this.clockStart) / 1000;

    if (this.mode === 'book') {
      this.updateBookStage(dt, elapsed);
    } else if (this.mode === 'opening') {
      this.updateBookOpeningTransition(dt, elapsed);
    } else if (this.mode === 'world') {
      this.updateWorldStage(dt, elapsed);
    }

    if (this.useThree && this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderFallbackCanvas3D(elapsed);
    }

    this.updateDOMLabels();
  }

  updateBookStage(dt, elapsed) {
    if (!this.useThree || !this.bookRoot) return;

    // Smoothly interpolate front cover hinge rotation
    const targetAngle = this.openProgress * Math.PI * 0.92;
    const currentAngle = this.frontCoverPivot.rotation.z;
    this.frontCoverPivot.rotation.z += (targetAngle - currentAngle) * Math.min(1, dt * 6);

    // Center the book horizontally depending on whether it's closed or spread open
    const targetOffsetX = -1.6 + (this.frontCoverPivot.rotation.z / (Math.PI * 0.92)) * 1.6;
    this.bookRoot.position.x += (targetOffsetX - this.bookRoot.position.x) * Math.min(1, dt * 6);
    this.bookRoot.position.y = Math.sin(elapsed * 1.6) * 0.12;
    this.bookRoot.rotation.x = 0.35 - (this.frontCoverPivot.rotation.z / Math.PI) * 0.15;

    // Scale miniature pop-up world inside the open pages
    const openRatio = Math.max(0, (this.frontCoverPivot.rotation.z - 0.8) / 2.0);
    if (this.popupDioramaGroup) {
      const s = Math.max(0.001, openRatio);
      this.popupDioramaGroup.scale.set(s, s, s);
      this.popupDioramaGroup.rotation.y = elapsed * 0.45;
    }

    if (this.bookParticles) {
      this.bookParticles.rotation.y = elapsed * 0.08;
    }

    // Orbit camera around 3D book
    const cx = Math.sin(this.bookOrbitYaw) * Math.cos(this.bookOrbitPitch) * this.bookZoom;
    const cy = Math.sin(this.bookOrbitPitch) * this.bookZoom + 0.8;
    const cz = Math.cos(this.bookOrbitYaw) * Math.cos(this.bookOrbitPitch) * this.bookZoom;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(0, 0.1, 0);
  }

  updateBookOpeningTransition(dt, elapsed) {
    this.transitionTimer += dt;
    const duration = 2.3;
    const p = Math.min(1, this.transitionTimer / duration);

    // Phase 1 (0 -> 0.55): Swing cover open to 100% & raise glowing pop-up diorama
    this.openProgress = 1;
    if (this.useThree && this.bookRoot) {
      const targetAngle = Math.PI * 0.94;
      this.frontCoverPivot.rotation.z += (targetAngle - this.frontCoverPivot.rotation.z) * Math.min(1, dt * 9);
      this.bookRoot.position.x += (0 - this.bookRoot.position.x) * Math.min(1, dt * 8);
      this.bookRoot.rotation.x += (0.08 - this.bookRoot.rotation.x) * Math.min(1, dt * 6);

      if (this.popupDioramaGroup) {
        const popScale = Math.min(1.6, p * 2.2);
        this.popupDioramaGroup.scale.set(popScale, popScale, popScale);
        this.popupDioramaGroup.rotation.y = elapsed * 1.4;
      }

      // Phase 2 (0.45 -> 1.0): Camera dives into the glowing heart of the open pages
      const dive = Math.max(0, (p - 0.35) / 0.65);
      const easeDive = dive * dive;
      const dist = 7.0 * (1 - easeDive * 0.88);
      this.camera.position.set(0, 3.2 * (1 - easeDive * 0.7), dist);
      this.camera.lookAt(0, 0.3, 0);
    }

    if (p >= 1) {
      this.setMode('world');
    }
  }

  updateWorldStage(dt, elapsed) {
    // 1. Player WASD / Arrow movement relative to cameraYaw
    let moveForward = 0;
    let moveRight = 0;
    if (this.keys['w'] || this.keys['arrowup']) moveForward += 1;
    if (this.keys['s'] || this.keys['arrowdown']) moveForward -= 1;
    if (this.keys['d'] || this.keys['arrowright']) moveRight += 1;
    if (this.keys['a'] || this.keys['arrowleft']) moveRight -= 1;

    // Optional Q/E or Left/Right rotation when desired
    if (this.keys['q']) this.cameraYaw += 1.8 * dt;

    if (moveForward !== 0 || moveRight !== 0) {
      // Cancel waypoint when using keyboard
      this.player.targetX = null;
      this.player.targetZ = null;
      if (this.waypointRing) this.waypointRing.visible = false;

      const len = Math.hypot(moveForward, moveRight);
      moveForward /= len;
      moveRight /= len;

      // Forward direction is (-sin(cameraYaw), -cos(cameraYaw))
      const forwardX = -Math.sin(this.cameraYaw);
      const forwardZ = -Math.cos(this.cameraYaw);
      const rightX = Math.cos(this.cameraYaw);
      const rightZ = -Math.sin(this.cameraYaw);

      const dx = (forwardX * moveForward + rightX * moveRight) * this.player.speed * dt;
      const dz = (forwardZ * moveForward + rightZ * moveRight) * this.player.speed * dt;

      this.player.x += dx;
      this.player.z += dz;
      this.player.yaw = Math.atan2(dx, dz);
      this.player.walkCycle += dt * 10;
    } else if (this.player.targetX !== null && this.player.targetZ !== null) {
      // Move toward clicked waypoint
      const dx = this.player.targetX - this.player.x;
      const dz = this.player.targetZ - this.player.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.35) {
        this.player.targetX = null;
        this.player.targetZ = null;
        if (this.waypointRing) this.waypointRing.visible = false;
      } else {
        const step = Math.min(dist, this.player.speed * dt);
        this.player.x += (dx / dist) * step;
        this.player.z += (dz / dist) * step;
        this.player.yaw = Math.atan2(dx, dz);
        this.player.walkCycle += dt * 10;
      }
    }

    // Clamp player inside sanctuary plaza radius
    const radialDist = Math.hypot(this.player.x, this.player.z);
    if (radialDist > 26.5) {
      this.player.x = (this.player.x / radialDist) * 26.5;
      this.player.z = (this.player.z / radialDist) * 26.5;
    }

    // Update Player Avatar 3D Mesh
    if (this.useThree && this.playerAvatar?.group) {
      this.playerAvatar.group.position.set(this.player.x, Math.abs(Math.sin(this.player.walkCycle)) * 0.08, this.player.z);
      this.playerAvatar.group.rotation.y = this.player.yaw;
    }

    // 2. Update Historical Characters & Check Proximity
    let closestChar = null;
    let closestCharDist = Infinity;

    for (let i = 0; i < this.characterEntities.length; i++) {
      const c = this.characterEntities[i];
      const dist = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (dist < closestCharDist) {
        closestCharDist = dist;
        closestChar = c;
      }

      if (this.useThree) {
        // Idle breathing & gesturing
        c.bodyGroup.position.y = 0.22 + Math.sin(elapsed * 2.2 + i) * 0.04;
        if (this.activeTalkingCharacterId === c.data.id) {
          c.rightArmGroup.rotation.z = Math.sin(elapsed * 5.0) * 0.18;
        } else {
          c.rightArmGroup.rotation.z = 0;
        }

        // Turn toward player when within 10 units
        if (dist < 10) {
          const targetAngle = Math.atan2(this.player.x - c.x, this.player.z - c.z);
          c.group.rotation.y = targetAngle;
        }

        // Pulse ground ring when nearby
        const isNear = dist < 4.8;
        c.ringMesh.scale.setScalar(isNear ? 1.08 + Math.sin(elapsed * 4) * 0.07 : 1.0);
        c.ringMesh.material.opacity = isNear ? 0.9 : 0.35;
      }
    }

    let closestLandmark = null;
    let closestLandmarkDist = Infinity;
    for (const lm of this.landmarkEntities) {
      const dist = Math.hypot(lm.x - this.player.x, lm.z - this.player.z);
      if (dist < closestLandmarkDist) {
        closestLandmarkDist = dist;
        closestLandmark = lm;
      }
    }

    const newNearChar = closestCharDist <= 4.8 ? closestChar : null;
    const newNearLandmark = closestLandmarkDist <= 5.5 ? closestLandmark : null;

    if (
      newNearChar?.data.id !== this.nearestCharacter?.data.id ||
      newNearLandmark?.data.id !== this.nearestLandmark?.data.id
    ) {
      this.nearestCharacter = newNearChar;
      this.nearestLandmark = newNearLandmark;
      if (this.onProximityChange) {
        this.onProximityChange({
          character: newNearChar ? newNearChar.data : null,
          landmark: newNearLandmark ? newNearLandmark.data : null
        });
      }
    }

    // 3. Update Camera in World Mode
    if (this.useThree && this.camera) {
      if (this.firstPerson) {
        this.camera.position.set(this.player.x, 2.1, this.player.z);
        const lookX = this.player.x - Math.sin(this.cameraYaw) * 10;
        const lookY = 2.1 - Math.sin(this.cameraPitch - 0.3) * 6;
        const lookZ = this.player.z - Math.cos(this.cameraYaw) * 10;
        this.camera.lookAt(lookX, lookY, lookZ);
      } else {
        const camX = this.player.x + Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDist;
        const camY = Math.sin(this.cameraPitch) * this.cameraDist + 1.6;
        const camZ = this.player.z + Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDist;
        this.camera.position.set(camX, camY, camZ);
        this.camera.lookAt(this.player.x, 1.4, this.player.z);
      }
    }
  }

  // ============================================================================
  // BUILT-IN 3D FALLBACK RENDERER (IF THREE.JS CDN IS OFFLINE)
  // ============================================================================

  initFallbackCanvas3D() {
    this.fallbackCanvas = document.createElement('canvas');
    this.fallbackCanvas.width = this.container.clientWidth || window.innerWidth;
    this.fallbackCanvas.height = this.container.clientHeight || window.innerHeight;
    this.container.innerHTML = '';
    this.container.appendChild(this.fallbackCanvas);
    this.fallbackCtx = this.fallbackCanvas.getContext('2d');
  }

  buildFallbackEntities(book) {
    this.characterEntities = (book.characters || []).map((c) => ({
      data: c,
      x: c.position?.x || 0,
      z: c.position?.z || 0
    }));
    this.landmarkEntities = (book.landmarks || []).map((lm) => ({
      data: lm,
      x: lm.x || 0,
      z: lm.z || -18
    }));
  }

  projectFallbackPoint(x, y, z, w, h) {
    const camX = this.player.x + Math.sin(this.cameraYaw) * this.cameraDist;
    const camY = Math.sin(this.cameraPitch) * this.cameraDist + 2.0;
    const camZ = this.player.z + Math.cos(this.cameraYaw) * this.cameraDist;

    const dx = x - camX;
    const dy = y - camY;
    const dz = z - camZ;

    const cosY = Math.cos(-this.cameraYaw);
    const sinY = Math.sin(-this.cameraYaw);
    const rx = dx * cosY - dz * sinY;
    const rz = dx * sinY + dz * cosY;

    if (rz >= -0.5) return { visible: false, x: 0, y: 0 };
    const fov = 520;
    return {
      visible: true,
      x: w / 2 + (rx / -rz) * fov,
      y: h / 2 - (dy / -rz) * fov
    };
  }

  renderFallbackCanvas3D(elapsed) {
    if (!this.fallbackCtx || !this.bookData) return;
    const ctx = this.fallbackCtx;
    const w = this.fallbackCanvas.width;
    const h = this.fallbackCanvas.height;
    ctx.clearRect(0, 0, w, h);

    if (this.mode === 'book' || this.mode === 'opening') {
      ctx.fillStyle = '#0c1322';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.fillStyle = this.bookData.coverColor || '#1b365d';
      ctx.strokeStyle = this.bookData.accentColor || '#e5b84b';
      ctx.lineWidth = 6;
      ctx.fillRect(-160, -210, 320, 420);
      ctx.strokeRect(-150, -200, 300, 400);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px Georgia, serif';
      ctx.fillText(this.bookData.title || 'Living Textbook', 0, -40);
      ctx.restore();
    } else {
      const ws = this.bookData.worldSetting || {};
      ctx.fillStyle = ws.skyColor || '#1d3557';
      ctx.fillRect(0, 0, w, h * 0.5);
      ctx.fillStyle = ws.groundColor || '#3a4234';
      ctx.fillRect(0, h * 0.5, w, h * 0.5);
    }
  }
}
