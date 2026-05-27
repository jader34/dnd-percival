/* ═══════════════════════════════════════════════════════════════
   D&D 5E — Ficha de Percival "O Triturador"
   JavaScript — Lógica, Cálculos Automáticos & Persistência
   ═══════════════════════════════════════════════════════════════ */

// ── INTEGRAÇÃO COM FIREBASE & SYNC EM TEMPO REAL ─────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, initializeFirestore, doc, onSnapshot, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configurações do Firebase Console. Substitua com os dados do seu projeto.
const firebaseConfig = {
  apiKey: "AIzaSyA-eXP6gCPqDaWklp5eVa1asyXduVcqtfE",
  authDomain: "dnd-aura.firebaseapp.com",
  projectId: "dnd-aura",
  storageBucket: "dnd-aura.firebasestorage.app",
  messagingSenderId: "509686908764",
  appId: "1:509686908764:web:5549c5f521ae076c182399",
  measurementId: "G-8P8L60YRCQ"
};



const isFirebasePlaceholder =
  !firebaseConfig.projectId ||
  firebaseConfig.projectId.includes("SEU_PROJECT_ID_AQUI") ||
  firebaseConfig.apiKey.includes("SUA_API_KEY_AQUI");

let db = null;
let syncEnabled = false;

function updateDbStatusUI(status) {
  const badge = document.getElementById('db-status');
  if (!badge) return;
  const dot = badge.querySelector('.db-status__dot');
  const text = badge.querySelector('.db-status__text');

  if (status === 'online') {
    badge.className = 'db-status db-status--online';
    if (text) text.textContent = 'Conectado';
  } else if (status === 'offline') {
    badge.className = 'db-status db-status--offline';
    if (text) text.textContent = 'Local';
  }
}

// ── DADOS DO PERSONAGEM ──────────────────────────────────────
// Todos os valores base ficam aqui. Ao evoluir de nível,
// basta alterar esses valores e o app recalcula tudo sozinho.

const CHAR = {
  name: 'Percival "O Triturador"',
  level: 4,
  class: 'Paladino',

  // Atributos (scores)
  attributes: {
    FOR: 16,
    DES: 10,
    CON: 14,
    INT: 13,
    SAB: 12,
    CAR: 18
  },

  // Proficiências de Perícias e Salvaguardas (Trained)
  proficiencies: {
    savingThrows: ['SAB', 'CAR'],
    skills: ['Acrobacia', 'Atletismo', 'Intimidação', 'Percepção', 'Persuasão']
  },

  // HP máximo base do personagem
  hpMax: 42,

  // Exemplo: Cota de malha (16) + escudo (0) + outro(1) = 17
  armorClassBase: 17,

  // Espaços de magia por nível de círculo (Paladin level 4 = 3 slots de 1º)
  spellSlots: {
    1: 3  // 3 espaços de 1º círculo
  },

  // Armas
  weapons: [
    {
      name: 'Alabarda',
      type: 'Corpo a Corpo (3m)',
      abilityMod: 'FOR',       // Qual atributo usar no ataque
      damageDice: '1d10',      // Dado de dano
      damageType: 'cortante',
      properties: 'Pesada, Alcance'
    },
    {
      name: 'Alabarda (Ação Bônus)',
      type: 'Corpo a Corpo (3m)',
      abilityMod: 'FOR',
      damageDice: '1d4',
      damageType: 'contundente',
      properties: 'Mestre em Armas de Haste'
    }
  ]
};


// ── FUNÇÕES DE CÁLCULO ───────────────────────────────────────
// O sistema calcula automaticamente modificadores, bônus de
// proficiência, CD de magia, etc. Ao subir de nível basta
// alterar CHAR.level e os atributos.

/**
 * Calcula o modificador de um atributo.
 * Fórmula D&D 5E: Math.floor((score - 10) / 2)
 */
function getModifier(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Retorna o bônus de proficiência baseado no nível.
 * Tabela oficial D&D 5E:
 *   Nível 1-4  → +2
 *   Nível 5-8  → +3
 *   Nível 9-12 → +4
 *   Nível 13-16 → +5
 *   Nível 17-20 → +6
 */
function getProficiencyBonus(level) {
  return Math.floor((level - 1) / 4) + 2;
}

/**
 * Calcula o bônus de ataque de uma arma.
 * Fórmula: Bônus de Proficiência + Modificador do Atributo
 */
function getAttackBonus(weapon) {
  const mod = getModifier(CHAR.attributes[weapon.abilityMod]);
  const prof = getProficiencyBonus(CHAR.level);
  return prof + mod;
}

/**
 * Calcula o modificador de dano de uma arma.
 * Apenas o modificador do atributo é somado ao dado de dano.
 */
function getDamageModifier(weapon) {
  return getModifier(CHAR.attributes[weapon.abilityMod]);
}

/**
 * Calcula a CD (Dificuldade) de magia.
 * Fórmula: 8 + Bônus de Proficiência + Modificador de Carisma
 */
function getSpellSaveDC() {
  return 8 + getProficiencyBonus(CHAR.level) + getModifier(CHAR.attributes.CAR);
}

/**
 * Calcula o bônus de ataque mágico.
 * Fórmula: Bônus de Proficiência + Modificador de Carisma
 */
function getSpellAttackBonus() {
  return getProficiencyBonus(CHAR.level) + getModifier(CHAR.attributes.CAR);
}

/**
 * Calcula o total de Imposição de Mãos.
 * Fórmula: Nível de Paladino × 5
 */
function getLayOnHandsPool() {
  return CHAR.level * 5;
}

/**
 * Calcula usos de Sentido Divino.
 * Fórmula: 1 + Modificador de Carisma
 */
function getDivineSenseUses() {
  return 1 + getModifier(CHAR.attributes.CAR);
}

/**
 * Calcula a quantidade de magias que o paladino pode preparar.
 * Fórmula: Modificador de Carisma + metade do nível de paladino (arredondado para baixo)
 * Mínimo de 1 magia preparada.
 */
function getPreparedSpellsCount() {
  const chaMod = getModifier(CHAR.attributes.CAR);
  const halfLevel = Math.floor(CHAR.level / 2);
  return Math.max(1, chaMod + halfLevel);
}


// ── PERSISTÊNCIA DE DADOS (LOCALSTORAGE & FIRESTORE) ──────────
// Fornecemos persistência híbrida: os dados são salvos localmente
// no localStorage (para fallback instantâneo sem internet) e
// sincronizados na nuvem via Firestore (se configurado).

const STORAGE_KEYS = {
  HP: 'dnd_percival_hp',                   // HP atual do personagem
  SLOTS: 'dnd_percival_slots',             // Estado dos espaços de magia (array de booleans)
  CHANNEL_DIV: 'dnd_percival_channel_div', // Estado do Canalizar Divindade (boolean)
  LOH: 'dnd_percival_loh',                 // Pontos atuais de Cura pelas Mãos (number)
  PO: 'dnd_percival_po',                   // Moedas de ouro (number)
  INVENTORY: 'dnd_percival_inventory',     // Lista de itens do inventário (array de strings)
  BUFF_BENCAO: 'dnd_percival_buff_bencao', // Buff Bênção de Sangue ativo (boolean)
  BUFF_MARCA: 'dnd_percival_buff_marca',   // Buff Marca do Caçador ativo (boolean)
  AC: 'dnd_percival_ac'                    // Classe de armadura (number)
};

function normalizeNumber(value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  const parsed = Number(value);
  const fallbackNumber = Number(fallback);
  const safeFallback = Number.isFinite(fallbackNumber)
    ? fallbackNumber
    : (Number.isFinite(min) ? min : 0);
  const candidate = Number.isFinite(parsed) ? parsed : safeFallback;
  return Math.max(min, Math.min(max, candidate));
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

function normalizeArray(value, fallback) {
  return Array.isArray(value) ? value : fallback;
}

/**
 * Salva o HP e sincroniza com o Firestore
 */
async function saveHP(value) {
  const safeValue = normalizeNumber(value, CHAR.hpMax, 0, CHAR.hpMax);
  localStorage.setItem(STORAGE_KEYS.HP, String(safeValue));
  if (syncEnabled && db) {
    try {
      await updateDoc(doc(db, "characters", "percival"), { hp: safeValue });
    } catch (e) {
      console.error("Erro ao sincronizar HP no Firestore:", e);
    }
  }
}

function loadHP() {
  const saved = localStorage.getItem(STORAGE_KEYS.HP);
  if (saved === null) return CHAR.hpMax;
  const parsed = parseInt(saved, 10);
  if (isNaN(parsed)) return CHAR.hpMax;
  return Math.max(0, Math.min(parsed, CHAR.hpMax));
}

/**
 * Salva o estado dos slots e sincroniza com o Firestore
 */
async function saveSlots(slotsArray) {
  const safeSlots = normalizeArray(slotsArray, new Array(CHAR.spellSlots[1]).fill(true))
    .slice(0, CHAR.spellSlots[1])
    .map(Boolean);
  while (safeSlots.length < CHAR.spellSlots[1]) {
    safeSlots.push(true);
  }

  localStorage.setItem(STORAGE_KEYS.SLOTS, JSON.stringify(safeSlots));
  if (syncEnabled && db) {
    try {
      await updateDoc(doc(db, "characters", "percival"), { slots: safeSlots });
    } catch (e) {
      console.error("Erro ao sincronizar slots no Firestore:", e);
    }
  }
}

function loadSlots() {
  const saved = localStorage.getItem(STORAGE_KEYS.SLOTS);
  if (saved === null) {
    return new Array(CHAR.spellSlots[1]).fill(true);
  }
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length === CHAR.spellSlots[1]) {
      return parsed;
    }
    return new Array(CHAR.spellSlots[1]).fill(true);
  } catch {
    return new Array(CHAR.spellSlots[1]).fill(true);
  }
}

/**
 * Salva o estado do Canalizar Divindade e sincroniza com o Firestore
 */
async function saveChannelDivinity(isAvailable) {
  const safeValue = normalizeBoolean(isAvailable, true);
  localStorage.setItem(STORAGE_KEYS.CHANNEL_DIV, safeValue ? 'true' : 'false');
  if (syncEnabled && db) {
    try {
      await updateDoc(doc(db, "characters", "percival"), { channelDiv: safeValue });
    } catch (e) {
      console.error("Erro ao sincronizar Canalizar Divindade no Firestore:", e);
    }
  }
}

function loadChannelDivinity() {
  const saved = localStorage.getItem(STORAGE_KEYS.CHANNEL_DIV);
  if (saved === null) return true;
  return saved === 'true';
}

/**
 * Salva a reserva de Cura pelas Mãos (LOH) e sincroniza com o Firestore
 */
async function saveLOH(value) {
  const safeValue = normalizeNumber(value, getLayOnHandsPool(), 0, getLayOnHandsPool());
  localStorage.setItem(STORAGE_KEYS.LOH, String(safeValue));
  if (syncEnabled && db) {
    try {
      await updateDoc(doc(db, "characters", "percival"), { loh: safeValue });
    } catch (e) {
      console.error("Erro ao sincronizar LOH no Firestore:", e);
    }
  }
}

function loadLOH() {
  const saved = localStorage.getItem(STORAGE_KEYS.LOH);
  const maxLOH = getLayOnHandsPool();
  if (saved === null) return maxLOH;
  const parsed = parseInt(saved, 10);
  if (isNaN(parsed)) return maxLOH;
  return Math.max(0, Math.min(parsed, maxLOH));
}

/**
 * Salva a quantidade de ouro (PO) e sincroniza com o Firestore
 */
async function savePO(value) {
  const safeValue = normalizeNumber(value, 0, 0, Number.POSITIVE_INFINITY);
  localStorage.setItem(STORAGE_KEYS.PO, String(safeValue));
  if (syncEnabled && db) {
    try {
      await updateDoc(doc(db, "characters", "percival"), { po: safeValue });
    } catch (e) {
      console.error("Erro ao sincronizar PO no Firestore:", e);
    }
  }
}

function loadPO() {
  const saved = localStorage.getItem(STORAGE_KEYS.PO);
  if (saved === null) return 0;
  const parsed = parseInt(saved, 10);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}

/**
 * Salva a lista de itens e sincroniza com o Firestore
 */
async function saveInventory(itemsArray) {
  const safeItems = normalizeArray(itemsArray, []);
  localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(safeItems));
  if (syncEnabled && db) {
    try {
      await updateDoc(doc(db, "characters", "percival"), { inventory: safeItems });
    } catch (e) {
      console.error("Erro ao sincronizar inventário no Firestore:", e);
    }
  }
}

function loadInventory() {
  const saved = localStorage.getItem(STORAGE_KEYS.INVENTORY);
  if (saved === null) {
    // Itens iniciais sugeridos para o Percival (Paladino) com Manto Sanguíneo pré-carregado
    return [
      {
        name: "Manto Sanguíneo",
        description: "Item maravilhoso (incomum), requer sintonia\n\n**Descrição:**\nEsse manto parece ser feito de um tecido que se assemelha a sangue coagulado. Ao ser usado, o manto cria uma conexão com a essência vital do usuário, fortalecendo suas habilidades em combate.\n\n**Propriedades:**\n• **Toque de Sangue:** Enquanto estiver usando o manto sanguíneo, você tem vantagem em testes de resistência contra ser envenenado.\n• **Véu de Sangue (Ação Bônus):** Você faz com que o manto exale uma névoa de sangue por 3 turnos, concedendo a você e seus aliados meia cobertura enquanto estiverem a 1,5m de você. Esta habilidade pode ser usada uma vez por descanso curto ou longo.\n• **Camuflagem de Sangue:** Você tem vantagem em testes de destreza (furtividade) em áreas onde há sangue derramado."
      },
      { name: "Alabarda de Aço", description: "Arma de haste pesada e cortante que concede alcance estendido de 3 metros em seus ataques." },
      { name: "Cota de Malha Pesada", description: "Armadura de malha e anéis de ferro pesados. Concede CA 16 e requer força 13." },
      { name: "Escudo com Emblema Sagrado", description: "Um escudo de aço gravado com seu símbolo sagrado. Concede CA +2 e serve como foco de conjuração divina." },
      { name: "Pacote de Explorador", description: "Uma mochila resistente contendo saco de dormir, kit de refeição, caixa de fogo, 10 tochas, 10 rações diárias e um cantil de água." }
    ];
  }
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Salva a Classe de Armadura (CA) e sincroniza com o Firestore
 */
async function saveAC(value) {
  const safeValue = normalizeNumber(value, CHAR.armorClassBase, 1, 99);
  localStorage.setItem(STORAGE_KEYS.AC, String(safeValue));
  if (syncEnabled && db) {
    try {
      await updateDoc(doc(db, "characters", "percival"), { ac: safeValue });
    } catch (e) {
      console.error("Erro ao sincronizar CA no Firestore:", e);
    }
  }
}

function loadAC() {
  const saved = localStorage.getItem(STORAGE_KEYS.AC);
  if (saved === null) return CHAR.armorClassBase;
  const parsed = parseInt(saved, 10);
  if (isNaN(parsed)) return CHAR.armorClassBase;
  return Math.max(1, Math.min(parsed, 99));
}

// ── ESTADO DO APP ────────────────────────────────────────────
let currentHP = loadHP();
let currentAC = loadAC();
let currentSlots = loadSlots();
let channelDivAvailable = loadChannelDivinity();
let currentLOH = loadLOH();
let currentPO = loadPO();
let currentInventory = loadInventory();

// ── BUFFS ATIVOS ─────────────────────────────────────────────
let buffBencaoActive = loadBuffState(STORAGE_KEYS.BUFF_BENCAO);
let buffMarcaActive = loadBuffState(STORAGE_KEYS.BUFF_MARCA);

/** Carrega estado de um buff do localStorage */
function loadBuffState(key) {
  const saved = localStorage.getItem(key);
  return saved === 'true';
}

/** Salva estado de um buff no localStorage e sincroniza com Firestore */
async function saveBuffState(key, value) {
  localStorage.setItem(key, value ? 'true' : 'false');
  if (syncEnabled && db) {
    try {
      const field = key === STORAGE_KEYS.BUFF_BENCAO ? 'buffBencao' : 'buffMarca';
      await updateDoc(doc(db, "characters", "percival"), { [field]: value });
    } catch (e) {
      console.error("Erro ao sincronizar buff no Firestore:", e);
    }
  }
}


// ── SINCRONIZAÇÃO EM NUVEM (FIREBASE) & LOGICA DE INVENTÁRIO ──

/**
 * Sincroniza o estado completo local com o Firestore (usado para criação inicial)
 */
async function syncStateToFirestore(forceUpload = false) {
  if (!syncEnabled || !db) return;
  try {
    const docRef = doc(db, "characters", "percival");
    const dataToSave = {
      hp: normalizeNumber(currentHP, CHAR.hpMax, 0, CHAR.hpMax),
      slots: normalizeArray(currentSlots, new Array(CHAR.spellSlots[1]).fill(true)).slice(0, CHAR.spellSlots[1]).map(Boolean),
      channelDiv: normalizeBoolean(channelDivAvailable, true),
      loh: normalizeNumber(currentLOH, getLayOnHandsPool(), 0, getLayOnHandsPool()),
      po: normalizeNumber(currentPO, 0, 0, Number.POSITIVE_INFINITY),
      inventory: normalizeArray(currentInventory, []),
      ac: normalizeNumber(currentAC, CHAR.armorClassBase, 1, 99),
      buffBencao: buffBencaoActive,
      buffMarca: buffMarcaActive,
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, dataToSave, { merge: true });
  } catch (error) {
    console.error("Erro ao sincronizar estado com Firestore:", error);
  }
}

/**
 * Inicializa a sincronização em tempo real com o Firestore
 */
function initRealtimeSync() {
  if (isFirebasePlaceholder) {
    console.warn("⚠️ Firebase com credenciais padrão. Rodando no modo Local (Offline Fallback).");
    updateDbStatusUI('offline');
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    // Usa initializeFirestore com fallback forçado de long polling para evitar erros de transporte 400 em algumas redes
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true
    });
    syncEnabled = true;
    console.log("🔥 Firebase inicializado com sucesso!");

    const docRef = doc(db, "characters", "percival");

    // Registra listener em tempo real
    onSnapshot(docRef, (snapshot) => {
      if (!snapshot.exists()) {
        console.log("🆕 Documento 'percival' não encontrado no Firestore. Fazendo upload inicial do estado local...");
        syncStateToFirestore(true);
        updateDbStatusUI('online');
        return;
      }

      const data = snapshot.data();
      console.log("⚡ Sincronização em tempo real recebida do Firestore:", data);

      let needsRender = false;

      // Sincroniza HP
      if (data.hp !== undefined && data.hp !== currentHP) {
        currentHP = normalizeNumber(data.hp, CHAR.hpMax, 0, CHAR.hpMax);
        localStorage.setItem(STORAGE_KEYS.HP, String(currentHP));
        updateHPDisplay();
        needsRender = true;
      }

      // Sincroniza Slots
      if (data.slots !== undefined && JSON.stringify(data.slots) !== JSON.stringify(currentSlots)) {
        currentSlots = normalizeArray(data.slots, new Array(CHAR.spellSlots[1]).fill(true)).slice(0, CHAR.spellSlots[1]).map(Boolean);
        while (currentSlots.length < CHAR.spellSlots[1]) {
          currentSlots.push(true);
        }
        localStorage.setItem(STORAGE_KEYS.SLOTS, JSON.stringify(currentSlots));
        renderSpellSlots();
        needsRender = true;
      }

      // Sincroniza Canalizar Divindade
      if (data.channelDiv !== undefined && data.channelDiv !== channelDivAvailable) {
        channelDivAvailable = normalizeBoolean(data.channelDiv, true);
        localStorage.setItem(STORAGE_KEYS.CHANNEL_DIV, channelDivAvailable ? 'true' : 'false');
        const cbCD = document.getElementById('checkbox-channel-divinity');
        if (cbCD) cbCD.checked = channelDivAvailable;
        needsRender = true;
      }

      // Sincroniza Cura pelas Mãos (LOH)
      if (data.loh !== undefined && data.loh !== currentLOH) {
        currentLOH = normalizeNumber(data.loh, getLayOnHandsPool(), 0, getLayOnHandsPool());
        localStorage.setItem(STORAGE_KEYS.LOH, String(currentLOH));
        updateLOHDisplay();
        needsRender = true;
      }

      // Sincroniza PO
      if (data.po !== undefined && data.po !== currentPO) {
        currentPO = normalizeNumber(data.po, 0, 0, Number.POSITIVE_INFINITY);
        localStorage.setItem(STORAGE_KEYS.PO, String(currentPO));
        const inputPO = document.getElementById('input-po');
        if (inputPO) inputPO.value = currentPO;
        needsRender = true;
      }

      // Sincroniza Inventário
      if (data.inventory !== undefined && JSON.stringify(data.inventory) !== JSON.stringify(currentInventory)) {
        currentInventory = normalizeArray(data.inventory, []);
        localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(currentInventory));
        renderInventory();
        needsRender = true;
      }

      // Sincroniza Buffs Ativos
      if (data.buffBencao !== undefined && data.buffBencao !== buffBencaoActive) {
        buffBencaoActive = normalizeBoolean(data.buffBencao, false);
        localStorage.setItem(STORAGE_KEYS.BUFF_BENCAO, buffBencaoActive ? 'true' : 'false');
        updateBuffToggleUI();
        renderWeapons();
        needsRender = true;
      }
      if (data.buffMarca !== undefined && data.buffMarca !== buffMarcaActive) {
        buffMarcaActive = normalizeBoolean(data.buffMarca, false);
        localStorage.setItem(STORAGE_KEYS.BUFF_MARCA, buffMarcaActive ? 'true' : 'false');
        updateBuffToggleUI();
        renderWeapons();
        needsRender = true;
      }

      // Sincroniza CA
      if (data.ac !== undefined && data.ac !== currentAC) {
        currentAC = normalizeNumber(data.ac, CHAR.armorClassBase, 1, 99);
        localStorage.setItem(STORAGE_KEYS.AC, String(currentAC));
        needsRender = true;
      }

      if (needsRender) {
        renderDerivedValues();
      }

      updateDbStatusUI('online');
    }, (error) => {
      console.error("❌ Erro no listener do Firestore:", error);
      updateDbStatusUI('offline');
    });

  } catch (error) {
    console.error("❌ Falha ao inicializar o Firebase:", error);
    syncEnabled = false;
    updateDbStatusUI('offline');
  }
}

/**
 * Renderiza a lista de itens do inventário no HTML
 */
function renderInventory() {
  const list = document.getElementById('inventory-list');
  if (!list) return;

  if (currentInventory.length === 0) {
    list.innerHTML = `
      <li style="text-align: center; padding: 24px; color: var(--text-muted); font-style: italic; font-size: 0.85rem;">
        Mochila vazia. Digite acima para adicionar itens!
      </li>
    `;
    return;
  }

  list.innerHTML = currentInventory.map((item, index) => {
    // Normaliza para objeto de item
    const normalized = typeof item === 'string' ? { name: item, description: '' } : item;
    const hasDesc = normalized.description && normalized.description.trim() !== "";
    
    // Identificação visual de item mágico (se contiver Manto, Varinha, Anel, etc.)
    const nameLower = normalized.name.toLowerCase();
    const descLower = (normalized.description || "").toLowerCase();
    const isMagic = 
      nameLower.includes("manto") || 
      nameLower.includes("varinha") || 
      nameLower.includes("anel") || 
      nameLower.includes("pergaminho") ||
      descLower.includes("sintonia") || 
      descLower.includes("mágico") ||
      descLower.includes("magia");

    const badgeHTML = isMagic ? `<span class="inventory-item__magic-badge">Mágico</span>` : "";

    if (hasDesc) {
      return `
        <details class="inventory-item-collapsible" id="item-${index}">
          <summary class="inventory-item-header">
            <div class="inventory-item__title-group">
              <span class="inventory-item__arrow">▶</span>
              <span class="inventory-item__name">${normalized.name}</span>
            </div>
            <div class="inventory-item__actions-group">
              ${badgeHTML}
              <button class="btn-delete-item" data-index="${index}" title="Excluir item" aria-label="Excluir ${normalized.name}">×</button>
            </div>
          </summary>
          <div class="inventory-item-body">${normalized.description}</div>
        </details>
      `;
    } else {
      return `
        <li class="inventory-item" id="item-${index}">
          <div class="inventory-item__title-group" style="padding-left: 12px;">
            <span class="inventory-item__name">${normalized.name}</span>
          </div>
          <div class="inventory-item__actions-group">
            ${badgeHTML}
            <button class="btn-delete-item" data-index="${index}" title="Excluir item" aria-label="Excluir ${normalized.name}">×</button>
          </div>
        </li>
      `;
    }
  }).join('');

  // Adiciona listeners para os botões "X"
  list.querySelectorAll('.btn-delete-item').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Impede a abertura/fechamento do details ao clicar no excluir
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      deleteInventoryItem(idx);
    });
  });
}

/**
 * Adiciona um item ao inventário
 */
function addInventoryItem(name, description = "") {
  const cleanName = name.trim();
  if (cleanName === "") return;
  
  const newItem = {
    name: cleanName,
    description: description.trim()
  };
  
  currentInventory.push(newItem);
  saveInventory(currentInventory);
  renderInventory();
}

/**
 * Exclui um item do inventário
 */
function deleteInventoryItem(index) {
  currentInventory.splice(index, 1);
  saveInventory(currentInventory);
  renderInventory();
}

/**
 * Atualiza o dinheiro (PO)
 */
function updatePO(value) {
  const parsed = parseInt(value, 10);
  const newValue = isNaN(parsed) ? 0 : Math.max(0, parsed);
  currentPO = newValue;
  savePO(newValue);
}


// ── RENDERIZAÇÃO ─────────────────────────────────────────────

/** Renderiza os cards de atributos calculando os modificadores automaticamente */
function renderAttributes() {
  const grid = document.getElementById('attributes-grid');
  const labels = {
    FOR: 'Força', DES: 'Destreza', CON: 'Constituição',
    INT: 'Inteligência', SAB: 'Sabedoria', CAR: 'Carisma'
  };

  grid.innerHTML = Object.entries(CHAR.attributes).map(([key, score]) => {
    const mod = getModifier(score);
    // Classes CSS: positivo mostra "+" dourado via ::before, zero fica cinza, negativo fica padrão
    const modClass = mod > 0 ? 'attr-card__mod--positive' : (mod === 0 ? 'attr-card__mod--zero' : '');

    return `
      <div class="attr-card">
        <div class="attr-card__label">${key}</div>
        <div class="attr-card__mod ${modClass}">${Math.abs(mod)}</div>
        <div class="attr-card__score">${score}</div>
      </div>
    `;
  }).join('');
}

/** Renderiza os cards de armas com cálculos automáticos (buff-aware) */
function renderWeapons() {
  const list = document.getElementById('weapons-list');
  const profBonus = getProficiencyBonus(CHAR.level);
  const chaMod = getModifier(CHAR.attributes.CAR);

  list.innerHTML = CHAR.weapons.map(weapon => {
    let atkBonus = getAttackBonus(weapon);
    const dmgMod = getDamageModifier(weapon);
    const modName = weapon.abilityMod === 'FOR' ? 'FOR' : 'DES';
    const baseMod = getModifier(CHAR.attributes[weapon.abilityMod]);
    const baseDmgSign = dmgMod >= 0 ? '+' : '';

    // ── Bênção de Sangue: adiciona CAR ao ataque da alabarda
    const isAlabardaPrincipal = weapon.name === 'Alabarda';
    let atkBuffed = false;
    let atkFormulaExtra = '';
    if (buffBencaoActive && isAlabardaPrincipal) {
      atkBonus += chaMod;
      atkBuffed = true;
      atkFormulaExtra = ` + CAR(+${chaMod})`;
    }

    const atkSign = atkBonus >= 0 ? '+' : '';
    const atkClass = atkBuffed ? 'weapon-stat__value weapon-stat__value--atk weapon-stat__value--atk-buffed' : 'weapon-stat__value weapon-stat__value--atk';

    // ── Marca do Caçador: adiciona +1d6 ao dano da alabarda
    let bonusDamageHTML = '';
    let dmgFormulaExtra = '';
    if (buffMarcaActive && isAlabardaPrincipal) {
      bonusDamageHTML = ' <span class="weapon-stat__bonus-damage">+1d6</span>';
      dmgFormulaExtra = ' + Marca(1d6)';
    }

    return `
      <div class="weapon-card">
        <div class="weapon-card__header">
          <span class="weapon-card__name">${weapon.name}</span>
          <span class="weapon-card__type">${weapon.type}</span>
        </div>
        <div class="weapon-card__stats">
          <div class="weapon-stat">
            <div class="weapon-stat__label">Ataque</div>
            <div class="${atkClass}">${atkSign}${atkBonus}</div>
            <span class="weapon-stat__formula">Prof(+${profBonus}) + ${modName}(${baseDmgSign}${baseMod})${atkFormulaExtra}</span>
          </div>
          <div class="weapon-stat">
            <div class="weapon-stat__label">Dano</div>
            <div class="weapon-stat__value">${weapon.damageDice}${baseDmgSign}${dmgMod}${bonusDamageHTML}</div>
            <span class="weapon-stat__formula">${weapon.damageDice} + mod. ${modName}${dmgFormulaExtra}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/** Renderiza as informações de magia (CD e Ataque Mágico) */
function renderSpellMeta() {
  const container = document.getElementById('spell-meta');
  const dc = getSpellSaveDC();
  const atkBonus = getSpellAttackBonus();
  const profBonus = getProficiencyBonus(CHAR.level);
  const chaMod = getModifier(CHAR.attributes.CAR);

  container.innerHTML = `
    <div class="spell-meta__item">
      <div class="spell-meta__label">CD de Magia</div>
      <div class="spell-meta__value">${dc}</div>
      <span class="weapon-stat__formula" style="margin-top:4px;display:block">8 + Prof(+${profBonus}) + CAR(+${chaMod})</span>
    </div>
    <div class="spell-meta__item">
      <div class="spell-meta__label">Ataque Mágico</div>
      <div class="spell-meta__value">+${atkBonus}</div>
      <span class="weapon-stat__formula" style="margin-top:4px;display:block">Prof(+${profBonus}) + CAR(+${chaMod})</span>
    </div>
  `;
}

/** Renderiza os checkboxes de spell slots */
function renderSpellSlots() {
  const container = document.getElementById('spell-slots');
  const slotCount = CHAR.spellSlots[1];

  container.innerHTML = currentSlots.map((available, i) => `
    <label class="spell-slot">
      <input type="checkbox"
             ${available ? 'checked' : ''}
             disabled
             aria-label="Espaço de Magia ${i + 1}" />
      <div class="spell-slot__visual">✦</div>
    </label>
  `).join('');

  updateSpellUseButtons();
}

/**
 * Insere e atualiza os botões de gasto rápido de espaço de magia.
 */
function updateSpellUseButtons() {
  const spellTagsList = document.querySelectorAll('.accordion-item--spell .spell-tags');
  if (!spellTagsList.length) return;

  const hasAvailableSlot = currentSlots.some(Boolean);

  spellTagsList.forEach((container) => {
    let button = container.querySelector('.spell-use-btn');

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'spell-use-btn';
      button.dataset.slotLevel = '1';
      button.innerHTML = '<span class="spell-use-btn__icon">✦</span><span class="spell-use-btn__text">Gastar</span>';
      container.appendChild(button);
    }

    button.disabled = !hasAvailableSlot;
    button.title = hasAvailableSlot ? 'Gastar 1 espaço de magia de 1º círculo' : 'Sem espaços de magia disponíveis';
    button.setAttribute('aria-label', button.title);
  });

  document.querySelectorAll('.spell-use-btn').forEach((button) => {
    button.disabled = !hasAvailableSlot;
    button.title = hasAvailableSlot ? 'Gastar 1 espaço de magia de 1º círculo' : 'Sem espaços de magia disponíveis';
    button.setAttribute('aria-label', button.title);
  });
}

/**
 * Consome 1 espaço de magia disponível.
 */
function spendSpellSlot(level = 1) {
  if (level !== 1) return false;

  const slotIndex = currentSlots.findIndex((available) => available);
  if (slotIndex === -1) return false;

  currentSlots[slotIndex] = false;
  saveSlots(currentSlots);
  renderSpellSlots();
  return true;
}


// ── HP SYSTEM ────────────────────────────────────────────────

/** Atualiza o display de HP e a barra de vida */
function updateHPDisplay() {
  const currentEl = document.getElementById('display-hp-current');
  const maxEl = document.getElementById('display-hp-max');
  const bar = document.getElementById('hp-bar');
  const hpDisplay = document.querySelector('.hp-display');

  currentEl.textContent = currentHP;
  maxEl.textContent = CHAR.hpMax;

  // Calcula a porcentagem de HP para a barra
  const percent = (currentHP / CHAR.hpMax) * 100;
  bar.style.width = `${percent}%`;

  // Remove todas as classes de estado anteriores
  hpDisplay.classList.remove('hp-display--hurt', 'hp-display--critical', 'hp-display--dead');

  // Aplica classe visual baseada na porcentagem de HP
  if (currentHP === 0) {
    hpDisplay.classList.add('hp-display--dead');
  } else if (percent <= 25) {
    hpDisplay.classList.add('hp-display--critical');
  } else if (percent <= 50) {
    hpDisplay.classList.add('hp-display--hurt');
  }
}

/** Altera o HP com animação e salva no localStorage */
function changeHP(delta) {
  const oldHP = currentHP;
  currentHP = Math.max(0, Math.min(CHAR.hpMax, currentHP + delta));

  if (currentHP !== oldHP) {
    // Salva o novo HP no localStorage para persistência
    saveHP(currentHP);
    updateHPDisplay();

    // Animação de feedback visual
    const currentEl = document.getElementById('display-hp-current');
    currentEl.classList.remove('hp-pulse', 'hp-shake');

    if (currentHP === 0) {
      // Animação especial quando chega a 0 HP
      currentEl.classList.add('hp-shake');
    } else {
      currentEl.classList.add('hp-pulse');
    }

    // Remove a classe de animação após ela terminar
    setTimeout(() => {
      currentEl.classList.remove('hp-pulse', 'hp-shake');
    }, 400);
  }
}

// ── LAY ON HANDS SYSTEM ──────────────────────────────────────
function updateLOHDisplay() {
  const currentEl = document.getElementById('display-lay-on-hands-current');
  if (currentEl) {
    currentEl.textContent = currentLOH;
  }
}

function changeLOH(delta) {
  const maxLOH = getLayOnHandsPool();
  const oldLOH = currentLOH;
  currentLOH = Math.max(0, Math.min(maxLOH, currentLOH + delta));

  if (currentLOH !== oldLOH) {
    saveLOH(currentLOH);
    updateLOHDisplay();

    // Animação visual rápida no número
    const currentEl = document.getElementById('display-lay-on-hands-current');
    if (currentEl) {
      currentEl.classList.remove('hp-pulse', 'hp-shake');
      if (currentLOH === 0) currentEl.classList.add('hp-shake');
      else currentEl.classList.add('hp-pulse');
      setTimeout(() => currentEl.classList.remove('hp-pulse', 'hp-shake'), 400);
    }
  }
}

/** Descanso Longo: restaura HP para o máximo e recupera spell slots */
function longRest() {
  currentHP = CHAR.hpMax;
  saveHP(currentHP);
  updateHPDisplay();

  // Recupera todos os spell slots
  currentSlots = new Array(CHAR.spellSlots[1]).fill(true);
  saveSlots(currentSlots);
  renderSpellSlots();

  // Recupera Canalizar Divindade
  channelDivAvailable = true;
  saveChannelDivinity(channelDivAvailable);
  const cbCD = document.getElementById('checkbox-channel-divinity');
  if (cbCD) cbCD.checked = channelDivAvailable;

  // Recupera Cura pelas Mãos
  currentLOH = getLayOnHandsPool();
  saveLOH(currentLOH);
  updateLOHDisplay();

  // Desativa buffs ativos no descanso
  buffBencaoActive = false;
  buffMarcaActive = false;
  saveBuffState(STORAGE_KEYS.BUFF_BENCAO, false);
  saveBuffState(STORAGE_KEYS.BUFF_MARCA, false);
  updateBuffToggleUI();
  renderWeapons();

  // Animação de brilho dourado no botão de descanso
  const btn = document.getElementById('btn-long-rest');
  btn.classList.add('rest-glow');
  setTimeout(() => btn.classList.remove('rest-glow'), 600);
}


// ── TAB NAVIGATION ───────────────────────────────────────────

function switchTab(tabName) {
  // Esconde todos os painéis
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Remove "active" de todos os botões da nav
  document.querySelectorAll('.bottom-nav__tab').forEach(tab => {
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
  });

  // Ativa o painel e o botão selecionado
  const panel = document.getElementById(`tab-${tabName}`);
  const navBtn = document.querySelector(`[data-tab="${tabName}"]`);

  if (panel) panel.classList.add('active');
  if (navBtn) {
    navBtn.classList.add('active');
    navBtn.setAttribute('aria-selected', 'true');
  }

  // Scroll para o topo ao trocar de aba
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


// ── PERÍCIAS E SALVAGUARDAS ───────────────────────────────────

const ALL_SAVES = [
  { name: 'Força', key: 'FOR' },
  { name: 'Destreza', key: 'DES' },
  { name: 'Constituição', key: 'CON' },
  { name: 'Inteligência', key: 'INT' },
  { name: 'Sabedoria', key: 'SAB' },
  { name: 'Carisma', key: 'CAR' }
];

const ALL_SKILLS = [
  { name: 'Acrobacia', attr: 'DES' },
  { name: 'Adestrar Animais', attr: 'SAB' },
  { name: 'Atletismo', attr: 'FOR' },
  { name: 'Arcana', attr: 'INT' },
  { name: 'Atuação', attr: 'CAR' },
  { name: 'Blefar', attr: 'CAR' },
  { name: 'Furtividade', attr: 'DES' },
  { name: 'História', attr: 'INT' },
  { name: 'Intimidação', attr: 'CAR' },
  { name: 'Intuição', attr: 'SAB' },
  { name: 'Investigação', attr: 'INT' },
  { name: 'Medicina', attr: 'SAB' },
  { name: 'Natureza', attr: 'INT' },
  { name: 'Percepção', attr: 'SAB' },
  { name: 'Persuasão', attr: 'CAR' },
  { name: 'Prestidigitação', attr: 'DES' },
  { name: 'Religião', attr: 'INT' },
  { name: 'Sobrevivência', attr: 'SAB' }
];

function renderSkillsAndSaves() {
  const savesList = document.getElementById('saves-list');
  const skillsList = document.getElementById('skills-list');
  if (!savesList || !skillsList) return;

  const profBonus = getProficiencyBonus(CHAR.level);

  // Renderiza Saves
  savesList.innerHTML = ALL_SAVES.map(save => {
    const isTrained = CHAR.proficiencies.savingThrows.includes(save.key);
    const attrMod = getModifier(CHAR.attributes[save.key]);
    const total = attrMod + (isTrained ? profBonus : 0);
    const sign = total >= 0 ? '+' : '';
    const trainedDot = isTrained ? '●' : '○';
    const trainedClass = isTrained ? 'skill-item--trained' : '';

    return `
      <div class="skill-item ${trainedClass}">
        <span class="skill-item__dot" title="${isTrained ? 'Treinado' : 'Não treinado'}">${trainedDot}</span>
        <span class="skill-item__name">${save.name} <span class="skill-item__attr-tag">${save.key}</span></span>
        <span class="skill-item__modifier">${sign}${total}</span>
      </div>
    `;
  }).join('');

  // Renderiza Perícias
  skillsList.innerHTML = ALL_SKILLS.map(skill => {
    const isTrained = CHAR.proficiencies.skills.includes(skill.name);
    const attrMod = getModifier(CHAR.attributes[skill.attr]);
    const total = attrMod + (isTrained ? profBonus : 0);
    const sign = total >= 0 ? '+' : '';
    const trainedDot = isTrained ? '●' : '○';
    const trainedClass = isTrained ? 'skill-item--trained' : '';

    return `
      <div class="skill-item ${trainedClass}">
        <span class="skill-item__dot" title="${isTrained ? 'Treinado' : 'Não treinado'}">${trainedDot}</span>
        <span class="skill-item__name">${skill.name} <span class="skill-item__attr-tag">${skill.attr}</span></span>
        <span class="skill-item__modifier">${sign}${total}</span>
      </div>
    `;
  }).join('');
}


// ── VALORES DERIVADOS (renderiza em elementos específicos) ───

function renderDerivedValues() {
  // Renderiza Perícias e Salvaguardas
  renderSkillsAndSaves();

  // CA (Classe de Armadura)
  document.getElementById('display-ac').textContent = currentAC;

  // Imposição de Mãos pool maximo
  const layOnHandsMax = document.getElementById('display-lay-on-hands');
  if (layOnHandsMax) layOnHandsMax.textContent = getLayOnHandsPool();

  // Imposição de Mãos atual
  updateLOHDisplay();

  // Sentido Divino usos
  const divineSense = document.getElementById('display-divine-sense');
  if (divineSense) divineSense.textContent = getDivineSenseUses();

  // Curar Ferimentos
  const cureWounds = document.getElementById('display-cure-wounds');
  if (cureWounds) {
    const chaMod = getModifier(CHAR.attributes.CAR);
    const sign = chaMod >= 0 ? '+' : '';
    cureWounds.textContent = `1d8${sign}${chaMod}`;
  }

  // Magias Preparadas (Paladino)
  const preparedCount = document.getElementById('display-prepared-count');
  const preparedFormula = document.getElementById('display-prepared-formula');
  if (preparedCount) {
    const count = getPreparedSpellsCount();
    const chaMod = getModifier(CHAR.attributes.CAR);
    const halfLvl = Math.floor(CHAR.level / 2);
    preparedCount.textContent = count;
    if (preparedFormula) {
      preparedFormula.innerHTML = `CAR(+${chaMod}) +<br>metade nível(${halfLvl}) = ${count}`;
    }
  }

  // Nível
  const levelDisplay = document.getElementById('display-level');
  if (levelDisplay) levelDisplay.textContent = CHAR.level;
}


// ── HP MODAL (Input customizado ao segurar) ──────────────────
// Ao segurar o botão de +/- por 500ms, abre um modal para
// inserir um valor personalizado de dano ou cura.

/**
 * Referências do modal — capturadas uma vez para performance.
 * O modal muda de aparência (vermelho/verde) conforme o modo.
 */
let hpModalMode = null; // 'damage' ou 'heal'

function getModalElements() {
  return {
    overlay: document.getElementById('hp-modal'),
    icon: document.getElementById('hp-modal-icon'),
    title: document.getElementById('hp-modal-title'),
    hint: document.getElementById('hp-modal-hint'),
    input: document.getElementById('hp-modal-input'),
    btnOk: document.getElementById('hp-modal-confirm'),
    btnCancel: document.getElementById('hp-modal-cancel')
  };
}

/**
 * Abre o modal de HP no modo especificado.
 * @param {'damage' | 'heal'} mode — define cor e texto do modal
 */
function openHPModal(mode) {
  hpModalMode = mode;
  const m = getModalElements();

  // Remove classes de modo anteriores e aplica a nova
  m.overlay.classList.remove('modal-overlay--damage', 'modal-overlay--heal');
  m.overlay.classList.add(`modal-overlay--${mode}`);

  if (mode === 'damage') {
    m.icon.textContent = '💔';
    m.title.textContent = 'Dano Recebido';
    m.hint.textContent = 'Quanto dano o Percival tomou?';
    m.btnOk.textContent = 'Aplicar Dano';
  } else {
    m.icon.textContent = '💚';
    m.title.textContent = 'Cura Recebida';
    m.hint.textContent = 'Quanto HP o Percival recuperou?';
    m.btnOk.textContent = 'Aplicar Cura';
  }

  // Limpa o input e abre o modal
  m.input.value = '';
  m.overlay.classList.add('active');
  m.overlay.setAttribute('aria-hidden', 'false');

  // Foca no input após a animação de abertura
  setTimeout(() => m.input.focus(), 200);
}

/** Fecha o modal sem aplicar nenhum valor */
function closeHPModal() {
  const m = getModalElements();
  m.overlay.classList.remove('active');
  m.overlay.setAttribute('aria-hidden', 'true');
  hpModalMode = null;
}

/** Confirma o valor digitado no modal e aplica como dano ou cura */
function confirmHPModal() {
  const m = getModalElements();
  const value = parseInt(m.input.value, 10);

  // Se o valor não é válido ou é zero, apenas fecha
  if (isNaN(value) || value <= 0) {
    closeHPModal();
    return;
  }

  // Aplica o delta: dano é negativo, cura é positivo
  const delta = hpModalMode === 'damage' ? -value : value;
  changeHP(delta);
  closeHPModal();
}

// ── AC MODAL (Editar Classe de Armadura) ────────────────────────
function getACModalElements() {
  return {
    overlay: document.getElementById('ac-modal'),
    input: document.getElementById('ac-modal-input'),
    btnOk: document.getElementById('ac-modal-confirm'),
    btnCancel: document.getElementById('ac-modal-cancel')
  };
}

function openACModal() {
  const m = getACModalElements();
  m.input.value = currentAC;
  m.overlay.classList.add('active');
  m.overlay.setAttribute('aria-hidden', 'false');
  setTimeout(() => {
    m.input.focus();
    m.input.select();
  }, 200);
}

function closeACModal() {
  const m = getACModalElements();
  m.overlay.classList.remove('active');
  m.overlay.setAttribute('aria-hidden', 'true');
}

function confirmACModal() {
  const m = getACModalElements();
  const value = parseInt(m.input.value, 10);
  
  if (isNaN(value) || value <= 0) {
    closeACModal();
    return;
  }
  
  currentAC = value;
  saveAC(currentAC);
  renderDerivedValues();
  
  // Feedback visual
  const acValueEl = document.getElementById('display-ac');
  if (acValueEl) {
    acValueEl.classList.remove('hp-pulse');
    void acValueEl.offsetWidth; // trigger reflow
    acValueEl.classList.add('hp-pulse');
  }
  
  closeACModal();
}

// ── EVENT LISTENERS ──────────────────────────────────────────

function initEventListeners() {
  // ── SISTEMA DE TOQUE/SEGURAR ──────────────────────────────
  // Toque rápido (tap) = +1 ou -1 de HP
  // Segurar por 500ms  = abre modal para inserir valor customizado

  let holdTimeout = null;
  let holdFired = false; // Flag: se o modal já abriu, não faz o tap normal

  /**
   * Inicia o timer de "segurar". Se o usuário soltar antes de
   * 500ms, é um toque rápido (aplica ±1). Se segurar 500ms+,
   * abre o modal.
   */
  function startHold(mode) {
    holdFired = false;
    holdTimeout = setTimeout(() => {
      holdFired = true;       // Marca que o hold ativou o modal
      openHPModal(mode);      // Abre o modal de input customizado
    }, 500);
  }

  /**
   * Cancela o timer de hold. Chamado quando o dedo/mouse sai
   * do botão antes de completar 500ms.
   */
  function cancelHold() {
    clearTimeout(holdTimeout);
    holdTimeout = null;
  }

  // ── BOTÃO MINUS (Dano) ──────────────────────────────────
  const btnMinus = document.getElementById('btn-hp-minus');

  // Mouse: mousedown inicia o hold, mouseup verifica se foi tap ou hold
  btnMinus.addEventListener('mousedown', () => startHold('damage'));
  btnMinus.addEventListener('mouseup', () => {
    cancelHold();
    // Se o modal NÃO abriu, é um toque rápido → aplica -1
    if (!holdFired) changeHP(-1);
  });
  btnMinus.addEventListener('mouseleave', cancelHold);

  // Touch (mobile): mesmo padrão, com preventDefault para evitar
  // o click fantasma que o mobile gera depois do touch
  btnMinus.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startHold('damage');
  }, { passive: false });
  btnMinus.addEventListener('touchend', (e) => {
    e.preventDefault();
    cancelHold();
    if (!holdFired) changeHP(-1);
  }, { passive: false });
  btnMinus.addEventListener('touchcancel', cancelHold);

  // ── BOTÃO PLUS (Cura) ───────────────────────────────────
  const btnPlus = document.getElementById('btn-hp-plus');

  btnPlus.addEventListener('mousedown', () => startHold('heal'));
  btnPlus.addEventListener('mouseup', () => {
    cancelHold();
    if (!holdFired) changeHP(1);
  });
  btnPlus.addEventListener('mouseleave', cancelHold);

  btnPlus.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startHold('heal');
  }, { passive: false });
  btnPlus.addEventListener('touchend', (e) => {
    e.preventDefault();
    cancelHold();
    if (!holdFired) changeHP(1);
  }, { passive: false });
  btnPlus.addEventListener('touchcancel', cancelHold);

  // ── AC BOX (Editar CA ao segurar) ───────────────────────
  const acBox = document.getElementById('ac-box');
  if (acBox) {
    let holdTimeoutAC = null;
    let holdFiredAC = false;

    function startHoldAC() {
      holdFiredAC = false;
      holdTimeoutAC = setTimeout(() => {
        holdFiredAC = true;
        openACModal();
      }, 500);
    }

    function cancelHoldAC() {
      clearTimeout(holdTimeoutAC);
      holdTimeoutAC = null;
    }

    acBox.addEventListener('mousedown', startHoldAC);
    acBox.addEventListener('mouseup', () => {
      cancelHoldAC();
      if (!holdFiredAC) {
        // Opcional: fazer algo no clique simples, se desejar
      }
    });
    acBox.addEventListener('mouseleave', cancelHoldAC);

    acBox.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startHoldAC();
    }, { passive: false });
    acBox.addEventListener('touchend', (e) => {
      e.preventDefault();
      cancelHoldAC();
    }, { passive: false });
    acBox.addEventListener('touchcancel', cancelHoldAC);
  }

  // ── BOTÕES CURA PELAS MÃOS ──────────────────────────────
  const btnLohMinus = document.getElementById('btn-loh-minus');
  const btnLohPlus = document.getElementById('btn-loh-plus');
  if (btnLohMinus) btnLohMinus.addEventListener('click', () => changeLOH(-1));
  if (btnLohPlus) btnLohPlus.addEventListener('click', () => changeLOH(1));

  // ── MODAL: Botões e atalhos ─────────────────────────────
  document.getElementById('hp-modal-confirm').addEventListener('click', confirmHPModal);
  document.getElementById('hp-modal-cancel').addEventListener('click', closeHPModal);

  // Fechar ao clicar no fundo escuro (overlay)
  document.getElementById('hp-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeHPModal();
  });

  // Enter confirma, Escape cancela
  document.getElementById('hp-modal-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmHPModal();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeHPModal();
    }
  });

  // ── MODAL CA: Botões e atalhos ─────────────────────────────
  document.getElementById('ac-modal-confirm').addEventListener('click', confirmACModal);
  document.getElementById('ac-modal-cancel').addEventListener('click', closeACModal);

  document.getElementById('ac-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeACModal();
  });

  document.getElementById('ac-modal-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmACModal();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeACModal();
    }
  });

  // ── DESCANSO LONGO ──────────────────────────────────────
  document.getElementById('btn-long-rest').addEventListener('click', longRest);

  // ── RECUPERAR MAGIAS ────────────────────────────────────
  document.getElementById('btn-recover-slots').addEventListener('click', () => {
    currentSlots = new Array(CHAR.spellSlots[1]).fill(true);
    saveSlots(currentSlots);
    renderSpellSlots();
  });

  // ── CANALIZAR DIVINDADE ─────────────────────────────────
  const cbCD = document.getElementById('checkbox-channel-divinity');
  if (cbCD) {
    // Inicializa o visual
    cbCD.checked = channelDivAvailable;
    // Evento de clique
    cbCD.addEventListener('change', (e) => {
      channelDivAvailable = e.target.checked;
      saveChannelDivinity(channelDivAvailable);
    });
  }

  // ── BUFFS ATIVOS (Toggle Buttons) ───────────────────────
  initBuffToggles();

  // ── NAVEGAÇÃO POR ABAS ──────────────────────────────────
  document.querySelectorAll('.bottom-nav__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // ── GASTO RÁPIDO DE ESPAÇO DE MAGIA ─────────────────────
  document.querySelectorAll('.spell-use-btn').forEach((button) => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const slotLevel = parseInt(e.currentTarget.dataset.slotLevel, 10) || 1;
      const spent = spendSpellSlot(slotLevel);

      if (!spent) {
        e.currentTarget.classList.add('spell-use-btn--shake');
        setTimeout(() => e.currentTarget.classList.remove('spell-use-btn--shake'), 250);
        return;
      }

      e.currentTarget.classList.add('spell-use-btn--spent');
      setTimeout(() => e.currentTarget.classList.remove('spell-use-btn--spent'), 220);
    });
  });

  // ── INVENTÁRIO & PO ──────────────────────────────────────
  const inputPO = document.getElementById('input-po');
  if (inputPO) {
    inputPO.value = currentPO;
    inputPO.addEventListener('input', (e) => {
      updatePO(e.target.value);
    });
  }

  const addForm = document.getElementById('add-item-form');
  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputItem = document.getElementById('input-item-name');
      const inputDesc = document.getElementById('input-item-desc');
      if (inputItem) {
        const descVal = inputDesc ? inputDesc.value : "";
        addInventoryItem(inputItem.value, descVal);
        
        // Limpa os inputs
        inputItem.value = '';
        if (inputDesc) inputDesc.value = '';
        inputItem.focus();
      }
    });
  }
}


// ── SISTEMA DE BUFFS ATIVOS ──────────────────────────────────

/**
 * Atualiza o visual dos botões de buff conforme o estado.
 */
function updateBuffToggleUI() {
  const btnBencao = document.getElementById('buff-bencao-sangue');
  const btnMarca = document.getElementById('buff-marca-cacador');
  if (btnBencao) btnBencao.setAttribute('aria-pressed', String(buffBencaoActive));
  if (btnMarca) btnMarca.setAttribute('aria-pressed', String(buffMarcaActive));
}

/**
 * Inicializa os event listeners dos botões de buff.
 */
function initBuffToggles() {
  const btnBencao = document.getElementById('buff-bencao-sangue');
  const btnMarca = document.getElementById('buff-marca-cacador');

  // Restaura estado visual dos buffs
  updateBuffToggleUI();

  // ── Bênção de Sangue (Canalizar Divindade) ──────────────
  if (btnBencao) {
    btnBencao.addEventListener('click', () => {
      const newState = !buffBencaoActive;

      if (newState) {
        // Verifica se tem Canalizar Divindade disponível
        if (!channelDivAvailable) {
          btnBencao.classList.add('buff-toggle--shake');
          setTimeout(() => btnBencao.classList.remove('buff-toggle--shake'), 250);
          return;
        }
        
        // Lógica bônus: desconta Canalizar Divindade automaticamente
        channelDivAvailable = false;
        saveChannelDivinity(channelDivAvailable);
        const cbCD = document.getElementById('checkbox-channel-divinity');
        if (cbCD) cbCD.checked = false;
      }

      buffBencaoActive = newState;
      saveBuffState(STORAGE_KEYS.BUFF_BENCAO, newState);
      updateBuffToggleUI();
      renderWeapons();
    });
  }

  // ── Marca do Caçador (Espaço de Magia 1º Círculo) ───────
  if (btnMarca) {
    btnMarca.addEventListener('click', () => {
      const newState = !buffMarcaActive;

      if (newState) {
        // Verifica se tem espaço de magia disponível
        const hasSlot = currentSlots.some(Boolean);
        if (!hasSlot) {
          btnMarca.classList.add('buff-toggle--shake');
          setTimeout(() => btnMarca.classList.remove('buff-toggle--shake'), 250);
          return;
        }

        // Lógica bônus: desconta 1 espaço de magia de 1º círculo
        spendSpellSlot(1);
      }

      buffMarcaActive = newState;
      saveBuffState(STORAGE_KEYS.BUFF_MARCA, newState);
      updateBuffToggleUI();
      renderWeapons();
    });
  }
}


// ── INICIALIZAÇÃO ────────────────────────────────────────────
// Quando o DOM estiver pronto, renderiza tudo e liga os eventos.

document.addEventListener('DOMContentLoaded', () => {
  // Renderiza componentes dinâmicos
  renderAttributes();
  renderWeapons();
  renderSpellMeta();
  renderSpellSlots();
  renderInventory();
  renderDerivedValues();
  updateSpellUseButtons();

  // Exibe o HP carregado do localStorage
  updateHPDisplay();

  // Liga todos os event listeners
  initEventListeners();

  // Inicializa o Firebase Firestore
  initRealtimeSync();

  console.log('⚔️ Ficha de Percival carregada com sucesso!');
  console.log(`📊 Nível: ${CHAR.level} | Prof: +${getProficiencyBonus(CHAR.level)} | HP: ${currentHP}/${CHAR.hpMax}`);
});
