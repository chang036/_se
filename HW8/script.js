"use strict";

/* ============================================================
   安心操作助理
   ------------------------------------------------------------
   1. 快速求助：家人的一鍵撥號 / 簡訊、緊急電話
   2. 教學分類：手機、電腦、智慧手錶、安心求助
   3. 一步一步模式：大字、語音朗讀、上一步 / 下一步
   4. 裝置自動判斷、字級記憶、離線使用（PWA）
   ============================================================ */

import { categories, emergencyNumbers, tasks } from "./js/tasks.js";
import * as store from "./js/store.js";
import { speak, stop as stopSpeech, isSpeechSupported } from "./js/speech.js";
import { detectPlatform, isPlatformMatch, preferredSystemId } from "./js/device.js";

const $ = (id) => document.getElementById(id);
const speechOk = isSpeechSupported();
const platform = detectPlatform();

const dom = {
  banner: $("offlineBanner"),
  fontSwitch: $("fontSwitch"),
  voiceToggle: $("voiceToggle"),
  settingsBtn: $("settingsBtn"),
  familyActions: $("familyActions"),
  emergencyActions: $("emergencyActions"),
  resumeCard: $("resumeCard"),
  categoryNav: $("categoryNav"),
  categorySections: $("categorySections"),
  installBtn: $("installBtn"),
  toTop: $("toTop"),
  toast: $("toast"),
  setupDialog: $("setupDialog"),
  setupClose: $("setupClose"),
  contactRows: $("contactRows"),
  addContact: $("addContact"),
  voiceCheckbox: $("voiceCheckbox"),
  saveSetup: $("saveSetup"),
  clearContacts: $("clearContacts"),
  setupStatus: $("setupStatus"),
  installHelpBtn: $("installHelpBtn"),
  guideDialog: $("guideDialog"),
  guideProgress: $("guideProgress"),
  guideBar: $("guideBar"),
  guideTask: $("guideTask"),
  guideIcon: $("guideIcon"),
  guideText: $("guideText"),
  guideStatus: $("guideStatus"),
  guidePrev: $("guidePrev"),
  guideSpeak: $("guideSpeak"),
  guideNext: $("guideNext"),
  guideRestart: $("guideRestart"),
  guideClose: $("guideClose"),
  callDialog: $("callDialog"),
  callDialogIcon: $("callDialogIcon"),
  callDialogTitle: $("callDialogTitle"),
  callDialogText: $("callDialogText"),
  callConfirm: $("callConfirm"),
  callCancel: $("callCancel"),
  installDialog: $("installDialog"),
  installClose: $("installClose"),
  installDone: $("installDone"),
};

const state = {
  contacts: store.loadContacts(),
  voiceEnabled: store.loadVoiceEnabled(),
  lastTask: store.loadLastTask(),
  openTask: null,
  guide: null,
  pendingCall: null,
  deferredInstall: null,
  toastTimer: null,
};

let guideSpeechToken = 0;

/* ============================================================
   初始化
   ============================================================ */

function init() {
  applyFont(store.loadFont(), { persist: false });
  renderCategories();
  renderSections();
  renderEmergencyButtons();
  renderQuickHelp();
  renderResume();
  syncVoiceUI();
  wireHeader();
  wireSections();
  wireDialogs();
  wireGlobal();
  setupPwa();
  updateOnlineState();
}

/* ============================================================
   共用小工具
   ============================================================ */

function getSystem(task, systemId) {
  return task.systems.find((system) => system.id === systemId) || task.systems[0];
}

function familyName() {
  return state.contacts[0] ? state.contacts[0].name : "家人";
}

function personalize(text) {
  return String(text).replace(/\{\{family\}\}/g, () => familyName());
}

function showToast(message) {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    dom.toast.hidden = true;
  }, 2800);
}

function formatTime(timestamp) {
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(timestamp));
  } catch (e) {
    return "";
  }
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ============================================================
   字級
   ============================================================ */

const FONT_MAP = { small: "18px", medium: "20px", large: "24px" };
const FONT_LABEL = { small: "小", medium: "中", large: "大" };

function applyFont(size, options = {}) {
  const { persist = true, announce = false } = options;
  const valid = Object.prototype.hasOwnProperty.call(FONT_MAP, size) ? size : "large";
  document.documentElement.style.fontSize = FONT_MAP[valid];
  if (persist) store.saveFont(valid);
  document.querySelectorAll(".font-btn").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.size === valid));
  });
  if (announce) showToast(`字級已改為「${FONT_LABEL[valid]}」。`);
}

/* ============================================================
   語音開關
   ============================================================ */

function setVoiceEnabled(enabled, options = {}) {
  const { persist = true, announce = false } = options;
  state.voiceEnabled = Boolean(enabled);
  if (persist) store.saveVoiceEnabled(state.voiceEnabled);
  syncVoiceUI();
  if (!state.voiceEnabled) stopSpeech();
  if (announce) {
    showToast(state.voiceEnabled ? "已開啟自動朗讀。" : "已關閉自動朗讀。");
  }
}

function syncVoiceUI() {
  const enabled = state.voiceEnabled && speechOk;
  dom.voiceToggle.disabled = !speechOk;
  dom.voiceToggle.setAttribute("aria-pressed", String(enabled));
  dom.voiceToggle.classList.toggle("is-off", !enabled);
  dom.voiceToggle.textContent = !speechOk
    ? "🔇 不支援語音"
    : enabled
      ? "🔊 自動朗讀：開"
      : "🔇 自動朗讀：關";
  dom.voiceCheckbox.checked = enabled;
  dom.voiceCheckbox.disabled = !speechOk;
  dom.guideSpeak.hidden = !speechOk;
}

/* ============================================================
   分類與教學區塊
   ============================================================ */

function renderCategories() {
  dom.categoryNav.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cat-card";
    button.dataset.target = category.id;

    const icon = document.createElement("span");
    icon.className = "cat-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = category.icon;

    const name = document.createElement("span");
    name.className = "cat-name";
    name.textContent = category.name;

    const sub = document.createElement("span");
    sub.className = "cat-sub";
    sub.textContent = category.sub;

    button.append(icon, name, sub);
    button.addEventListener("click", () => {
      const section = document.getElementById(category.id);
      if (section) {
        section.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "start",
        });
      }
    });
    dom.categoryNav.append(button);
  });
}

function renderSections() {
  dom.categorySections.innerHTML = "";

  categories.forEach((category) => {
    const section = document.createElement("section");
    section.id = category.id;
    section.className = "category-section";
    section.dataset.category = category.id;
    section.setAttribute("aria-labelledby", `${category.id}-title`);

    const title = document.createElement("h2");
    title.id = `${category.id}-title`;
    title.textContent = `${category.icon} ${category.name}`;

    const lead = document.createElement("p");
    lead.className = "lead";
    lead.textContent = category.lead;

    const grid = document.createElement("div");
    grid.className = "task-grid";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", `${category.name}可學習動作`);

    Object.entries(tasks)
      .filter(([, task]) => task.category === category.id)
      .forEach(([taskId, task]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "task-btn";
        button.dataset.task = taskId;
        button.setAttribute("aria-pressed", "false");

        const emoji = document.createElement("span");
        emoji.className = "task-emoji";
        emoji.setAttribute("aria-hidden", "true");
        emoji.textContent = task.icon;

        const label = document.createElement("span");
        label.className = "task-label";
        label.textContent = task.title;

        button.append(emoji, label);
        grid.append(button);
      });

    const detail = createTaskDetail();

    section.append(title, lead, grid, detail);
    dom.categorySections.append(section);
  });
}

function createTaskDetail() {
  const detail = document.createElement("div");
  detail.className = "task-detail";
  detail.hidden = true;
  detail.innerHTML = `
    <div class="task-detail-header">
      <span class="task-detail-icon" aria-hidden="true"></span>
      <h3 class="task-detail-title" tabindex="-1"></h3>
      <button type="button" class="back-btn">← 回選擇</button>
    </div>
    <p class="task-summary"></p>
    <div class="system-tabs" role="group" aria-label="選擇您的裝置" hidden></div>
    <p class="system-note" aria-live="polite" hidden></p>
    <div class="detail-actions">
      <button type="button" class="start-guide">▶ 一步一步帶我做</button>
      <button type="button" class="print-btn">🖨️ 列印這個教學</button>
    </div>
    <div class="task-callout"></div>
    <div class="task-steps"></div>
    <div class="task-extras"></div>
    <button type="button" class="back-btn back-btn-bottom">← 回選擇</button>
  `;
  return detail;
}

/* ============================================================
   開啟 / 關閉教學
   ============================================================ */

function openTask(taskId, systemId) {
  const task = tasks[taskId];
  if (!task) return;
  const section = document.getElementById(task.category);
  if (!section) return;

  closeAllDetails();

  const detail = section.querySelector(".task-detail");
  const chosenId =
    systemId && task.systems.some((system) => system.id === systemId)
      ? systemId
      : preferredSystemId(task, platform);

  state.openTask = { taskId, systemId: chosenId, section };
  section.dataset.openTask = taskId;

  detail.querySelector(".task-detail-icon").textContent = task.icon;
  detail.querySelector(".task-detail-title").textContent = task.title;
  detail.querySelector(".task-summary").textContent = task.summary || "";

  renderTabs(task, chosenId, detail);
  updateSystemNote(task, chosenId, detail);
  renderSteps(task, chosenId, detail);
  renderCallout(task, detail);
  renderExtras(task, detail);

  detail.hidden = false;
  section.classList.add("is-active");
  updateTaskButtonStates(taskId);
  rememberTask(taskId, chosenId);
  renderResume();

  const title = detail.querySelector(".task-detail-title");
  detail.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
  window.setTimeout(() => title.focus({ preventScroll: true }), prefersReducedMotion() ? 0 : 250);
}

function closeTask(section) {
  if (!section) return;
  const taskId = section.dataset.openTask;
  section.classList.remove("is-active");
  section.querySelector(".task-detail").hidden = true;
  delete section.dataset.openTask;
  section.querySelectorAll(".task-btn").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
  });

  if (state.openTask && state.openTask.section === section) {
    state.openTask = null;
  }

  stopSpeech();
  renderResume();

  const button = taskId
    ? section.querySelector(`.task-btn[data-task="${taskId}"]`)
    : section.querySelector(".task-btn");
  if (button) button.focus();
  section.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

function closeAllDetails() {
  dom.categorySections.querySelectorAll(".category-section").forEach((section) => {
    section.classList.remove("is-active");
    const detail = section.querySelector(".task-detail");
    if (detail) detail.hidden = true;
    delete section.dataset.openTask;
    section.querySelectorAll(".task-btn").forEach((button) => {
      button.setAttribute("aria-pressed", "false");
    });
  });
  state.openTask = null;
  stopSpeech();
}

function updateTaskButtonStates(activeTaskId) {
  dom.categorySections.querySelectorAll(".task-btn").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.task === activeTaskId));
  });
}

function rememberTask(taskId, systemId) {
  const record = { taskId, systemId, at: Date.now() };
  state.lastTask = record;
  store.saveLastTask(record);
}

/* ============================================================
   裝置版本切換
   ============================================================ */

function renderTabs(task, activeId, detail) {
  const tabs = detail.querySelector(".system-tabs");
  tabs.innerHTML = "";

  if (task.systems.length < 2) {
    tabs.hidden = true;
    return;
  }

  tabs.hidden = false;
  task.systems.forEach((system) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "system-tab";
    button.dataset.system = system.id;
    button.setAttribute("aria-pressed", String(system.id === activeId));

    const icon = document.createElement("span");
    icon.className = "system-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = system.icon;

    const name = document.createElement("span");
    name.textContent = system.shortName;

    button.append(icon, name);
    tabs.append(button);
  });
}

function updateSystemNote(task, activeId, detail) {
  const note = detail.querySelector(".system-note");
  if (task.systems.length < 2) {
    note.hidden = true;
    return;
  }
  const system = getSystem(task, activeId);
  const isAuto =
    isPlatformMatch(task, platform) && preferredSystemId(task, platform) === activeId;
  note.hidden = false;
  note.textContent = isAuto
    ? `✅ 已自動為您選擇「${system.shortName}」版。`
    : `正在看「${system.shortName}」版，可以按上面的按鈕切換。`;
}

function selectSystem(systemId) {
  const current = state.openTask;
  if (!current) return;
  const task = tasks[current.taskId];
  if (!task.systems.some((system) => system.id === systemId)) return;

  current.systemId = systemId;
  const detail = current.section.querySelector(".task-detail");

  detail.querySelectorAll(".system-tab").forEach((tab) => {
    tab.setAttribute("aria-pressed", String(tab.dataset.system === systemId));
  });

  updateSystemNote(task, systemId, detail);
  renderSteps(task, systemId, detail);
  rememberTask(current.taskId, systemId);
  showToast(`正在看「${getSystem(task, systemId).shortName}」版。`);
}

/* ============================================================
   步驟與補充內容
   ============================================================ */

function renderSteps(task, systemId, detail) {
  const system = getSystem(task, systemId);
  const container = detail.querySelector(".task-steps");
  container.innerHTML = "";

  const list = document.createElement("ol");
  list.className = "steps";

  system.steps.forEach((raw, index) => {
    const text = personalize(raw);
    const item = document.createElement("li");

    const number = document.createElement("span");
    number.className = "step-no";
    number.setAttribute("aria-hidden", "true");
    number.textContent = String(index + 1);

    const paragraph = document.createElement("p");
    paragraph.className = "step-text";
    paragraph.textContent = text;

    item.append(number, paragraph);

    if (speechOk) {
      const speakButton = document.createElement("button");
      speakButton.type = "button";
      speakButton.className = "step-speak";
      speakButton.dataset.step = String(index);
      speakButton.innerHTML =
        '<span aria-hidden="true">🔊</span><span class="sr-only">唸出第 ' +
        (index + 1) +
        " 步</span>";
      item.append(speakButton);
    }

    list.append(item);
  });

  container.append(list);
}

function renderCallout(task, detail) {
  const callout = detail.querySelector(".task-callout");
  callout.innerHTML = "";
  if (!task.quickCall || !task.quickCall.length) return;

  const card = document.createElement("div");
  card.className = "quickcall-card";

  const title = document.createElement("h4");
  title.textContent = "📞 需要時，按一下就能撥打";

  const note = document.createElement("p");
  note.className = "quickcall-note";
  note.textContent = "按下後會先請您確認，才會撥號。";

  const grid = document.createElement("div");
  grid.className = "quickcall-grid";

  task.quickCall.forEach((item) => {
    const link = document.createElement("a");
    link.className = "quickcall-btn" + (item.tone === "danger" ? " is-danger" : "");
    link.href = `tel:${item.tel}`;
    link.dataset.tel = item.tel;
    link.dataset.confirmCall = item.label;

    const number = document.createElement("span");
    number.className = "quickcall-num";
    number.textContent = item.tel;

    const label = document.createElement("span");
    label.className = "quickcall-label";
    label.textContent = item.label;

    link.append(number, label);
    grid.append(link);
  });

  card.append(title, note, grid);
  callout.append(card);
}

function renderExtras(task, detail) {
  const extras = detail.querySelector(".task-extras");
  extras.innerHTML = "";

  if (task.tip) {
    const tip = document.createElement("p");
    tip.className = "task-tip";
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "💡 ";
    tip.append(icon, document.createTextNode(task.tip));
    extras.append(tip);
  }

  if (state.openTask && state.openTask.taskId === "location") {
    const locationCard = createLocationCard();
    extras.append(locationCard);
    wireLocationCard(locationCard);
  }

  if (task.video && task.video.embedUrl) {
    const wrap = document.createElement("div");
    wrap.className = "task-video";

    const title = document.createElement("h4");
    title.textContent = task.video.title || "示意影片";

    const iframe = document.createElement("iframe");
    iframe.src = task.video.embedUrl;
    iframe.title = task.video.title || "示意影片";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";

    wrap.append(title, iframe);
    extras.append(wrap);
  }
}

/* ============================================================
   一步一步教學
   ============================================================ */

function startGuide() {
  if (!state.openTask) return;
  const task = tasks[state.openTask.taskId];
  if (!task) return;
  state.guide = {
    taskId: state.openTask.taskId,
    systemId: state.openTask.systemId,
    index: 0,
    done: false,
  };
  dom.guideDialog.showModal();
  renderGuide({ focus: true });
}

function renderGuide(options = {}) {
  const { focus = false } = options;
  const guide = state.guide;
  if (!guide) return;
  const task = tasks[guide.taskId];
  const system = getSystem(task, guide.systemId);
  const steps = system.steps;
  const text = personalize(steps[guide.index]);

  guide.done = false;
  dom.guideProgress.textContent = `第 ${guide.index + 1} 步，共 ${steps.length} 步`;
  dom.guideTask.textContent = `${task.icon} ${task.title}`;
  dom.guideIcon.textContent = task.icon;
  dom.guideText.textContent = text;
  dom.guideBar.style.width = `${((guide.index + 1) / steps.length) * 100}%`;
  dom.guidePrev.disabled = guide.index === 0;
  dom.guidePrev.hidden = false;
  dom.guideSpeak.hidden = !speechOk;
  dom.guideRestart.hidden = true;
  dom.guideNext.textContent =
    guide.index === steps.length - 1 ? "完成 ✓" : "下一步 →";
  dom.guideStatus.textContent = "";

  if (state.voiceEnabled && speechOk) {
    speakGuide(text);
  } else {
    stopSpeech();
  }

  if (focus) {
    try {
      dom.guideText.focus({ preventScroll: true });
    } catch (e) {
      dom.guideText.focus();
    }
  }
}

function speakGuide(text) {
  const token = ++guideSpeechToken;
  speak(text, {
    onStart: () => {
      if (token === guideSpeechToken) {
        dom.guideStatus.textContent = "🔊 正在為您唸出這一步…";
      }
    },
    onEnd: () => {
      if (token === guideSpeechToken) dom.guideStatus.textContent = "";
    },
    onError: () => {
      if (token === guideSpeechToken) dom.guideStatus.textContent = "";
    },
  });
}

function finishGuide() {
  const guide = state.guide;
  if (!guide) return;
  const task = tasks[guide.taskId];

  guide.done = true;
  guideSpeechToken += 1;
  stopSpeech();

  dom.guideProgress.textContent = "完成";
  dom.guideBar.style.width = "100%";
  dom.guideTask.textContent = `${task.icon} ${task.title}`;
  dom.guideIcon.textContent = "🎉";
  dom.guideText.textContent = "太棒了！您完成了所有步驟。";
  dom.guidePrev.hidden = true;
  dom.guideSpeak.hidden = true;
  dom.guideNext.textContent = "回到教學";
  dom.guideRestart.hidden = false;
  dom.guideStatus.textContent = "";

  if (state.voiceEnabled && speechOk) {
    const token = ++guideSpeechToken;
    speak("太棒了！您完成了所有步驟。", {
      onStart: () => {
        if (token === guideSpeechToken) {
          dom.guideStatus.textContent = "🔊 正在為您唸出…";
        }
      },
      onEnd: () => {
        if (token === guideSpeechToken) dom.guideStatus.textContent = "";
      },
      onError: () => {
        if (token === guideSpeechToken) dom.guideStatus.textContent = "";
      },
    });
  }
}

function goToGuideStep(index) {
  if (!state.guide || state.guide.done) return;
  const task = tasks[state.guide.taskId];
  const system = getSystem(task, state.guide.systemId);
  if (index < 0 || index >= system.steps.length) return;
  state.guide.index = index;
  renderGuide();
}

function speakStep(index) {
  if (!state.openTask) return;
  const task = tasks[state.openTask.taskId];
  const system = getSystem(task, state.openTask.systemId);
  const text = system.steps[index];
  if (!text) return;
  speak(personalize(text), {
    onError: () => showToast("語音無法使用，請看文字。"),
  });
}

/* ============================================================
   快速求助：家人
   ============================================================ */

function renderQuickHelp() {
  dom.familyActions.innerHTML = "";

  if (!state.contacts.length) {
    dom.familyActions.classList.add("is-empty");
    const card = document.createElement("div");
    card.className = "setup-prompt";

    const icon = document.createElement("p");
    icon.className = "setup-prompt-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "👨‍👩‍👧";

    const title = document.createElement("p");
    title.className = "setup-prompt-title";
    title.textContent = "還沒有設定家人的電話";

    const text = document.createElement("p");
    text.className = "setup-prompt-text";
    text.textContent = "請家人幫您設定，之後按一下就能打電話。";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-primary";
    button.textContent = "請家人幫我設定";
    button.addEventListener("click", openSetup);

    card.append(icon, title, text, button);
    dom.familyActions.append(card);
    return;
  }

  dom.familyActions.classList.remove("is-empty");

  state.contacts.forEach((contact) => {
    const card = document.createElement("div");
    card.className = "family-card";

    const name = document.createElement("p");
    name.className = "family-name";
    name.textContent = `👤 ${contact.name}`;

    const buttons = document.createElement("div");
    buttons.className = "family-buttons";

    const call = document.createElement("a");
    call.className = "family-call";
    call.href = `tel:${contact.phone}`;
    call.setAttribute("aria-label", `打電話給${contact.name}`);
    const callIcon = document.createElement("span");
    callIcon.setAttribute("aria-hidden", "true");
    callIcon.textContent = "📞";
    const callText = document.createElement("span");
    callText.textContent = "打電話";
    call.append(callIcon, callText);

    const sms = document.createElement("a");
    sms.className = "family-sms";
    sms.href = `sms:${contact.phone}`;
    sms.setAttribute("aria-label", `傳簡訊給${contact.name}`);
    const smsIcon = document.createElement("span");
    smsIcon.setAttribute("aria-hidden", "true");
    smsIcon.textContent = "💬";
    const smsText = document.createElement("span");
    smsText.textContent = "傳簡訊";
    sms.append(smsIcon, smsText);

    buttons.append(call, sms);
    card.append(name, buttons);
    dom.familyActions.append(card);
  });

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "edit-contacts";
  edit.textContent = "✏️ 修改家人的電話";
  edit.addEventListener("click", openSetup);
  dom.familyActions.append(edit);
}

function renderEmergencyButtons() {
  dom.emergencyActions.innerHTML = "";

  emergencyNumbers.forEach((item) => {
    const link = document.createElement("a");
    link.className = "emergency-btn" + (item.tel === "165" ? " is-info" : "");
    link.href = `tel:${item.tel}`;
    link.dataset.tel = item.tel;
    if (item.confirm) link.dataset.confirmCall = `${item.tel} ${item.name}`;

    const icon = document.createElement("span");
    icon.className = "emergency-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = item.icon;

    const number = document.createElement("span");
    number.className = "emergency-num";
    number.textContent = item.tel;

    const name = document.createElement("span");
    name.className = "emergency-name";
    name.textContent = item.name;

    link.append(icon, number, name);
    dom.emergencyActions.append(link);
  });
}

/* ============================================================
   撥號確認視窗
   ============================================================ */

function openCallDialog(tel, label) {
  state.pendingCall = { tel, label };

  const messages = {
    "110": "遇到壞人、車禍或東西被偷，才需要打 110。",
    "119": "有人受傷、生病很嚴重或發生火災，才需要打 119。",
    "112": "手機沒有訊號或人在國外時使用，會幫您轉接緊急單位。",
  };

  dom.callDialogIcon.textContent = tel === "112" ? "📱" : tel === "119" ? "🚒" : "👮";
  dom.callDialogTitle.textContent = `要撥打 ${label || tel} 嗎？`;
  dom.callDialogText.textContent =
    messages[tel] || "請確認這是您要打的電話，再按「現在撥打」。";
  dom.callConfirm.textContent = `📞 撥打 ${tel}`;
  dom.callDialog.showModal();
  dom.callConfirm.focus();
}

function confirmCall() {
  const pending = state.pendingCall;
  dom.callDialog.close();
  if (!pending) return;
  showToast(`正在為您撥打 ${pending.tel}…`);
  window.location.href = `tel:${pending.tel}`;
  state.pendingCall = null;
}

/* ============================================================
   上次看的教學
   ============================================================ */

function renderResume() {
  const record = state.lastTask;
  dom.resumeCard.innerHTML = "";

  if (!record || !tasks[record.taskId] || state.openTask) {
    dom.resumeCard.hidden = true;
    return;
  }

  const task = tasks[record.taskId];
  const button = document.createElement("button");
  button.type = "button";
  button.className = "resume-btn";

  const top = document.createElement("span");
  top.className = "resume-top";

  const label = document.createElement("span");
  label.className = "resume-label";
  label.textContent = "上次您在看";

  const time = document.createElement("span");
  time.className = "resume-time";
  time.textContent = formatTime(record.at);

  top.append(label, time);

  const title = document.createElement("span");
  title.className = "resume-title";
  title.textContent = `${task.icon} ${task.title}`;

  const arrow = document.createElement("span");
  arrow.className = "resume-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";

  button.append(top, title, arrow);
  button.addEventListener("click", () => openTask(record.taskId, record.systemId));
  dom.resumeCard.append(button);
  dom.resumeCard.hidden = false;
}

/* ============================================================
   設定：家人電話
   ============================================================ */

function openSetup() {
  renderContactRows(state.contacts);
  syncVoiceUI();
  setSetupStatus("");
  dom.setupDialog.showModal();
  window.setTimeout(() => {
    const input = dom.setupDialog.querySelector(".contact-name");
    if (input) input.focus();
  }, 50);
}

function renderContactRows(contacts) {
  dom.contactRows.innerHTML = "";
  const rows = contacts.length ? contacts : [{ name: "", phone: "" }];
  rows.forEach((contact) => dom.contactRows.append(createContactRow(contact)));
  updateContactRowControls();
}

function createContactRow(contact) {
  const row = document.createElement("div");
  row.className = "contact-row";

  const nameField = document.createElement("label");
  nameField.className = "field";
  const nameLabel = document.createElement("span");
  nameLabel.className = "field-label";
  nameLabel.textContent = "家人的稱呼";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "contact-name";
  nameInput.maxLength = 12;
  nameInput.placeholder = "例如：阿明";
  nameInput.autocomplete = "name";
  nameInput.value = contact.name || "";
  nameField.append(nameLabel, nameInput);

  const phoneField = document.createElement("label");
  phoneField.className = "field";
  const phoneLabel = document.createElement("span");
  phoneLabel.className = "field-label";
  phoneLabel.textContent = "電話號碼";
  const phoneInput = document.createElement("input");
  phoneInput.type = "tel";
  phoneInput.className = "contact-phone";
  phoneInput.inputMode = "tel";
  phoneInput.maxLength = 20;
  phoneInput.placeholder = "例如：0912345678";
  phoneInput.autocomplete = "tel";
  phoneInput.value = contact.phone || "";
  phoneField.append(phoneLabel, phoneInput);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-contact";
  remove.textContent = "✕";
  remove.setAttribute("aria-label", "刪除這位家人");
  remove.addEventListener("click", () => {
    row.remove();
    if (!dom.contactRows.querySelector(".contact-row")) {
      dom.contactRows.append(createContactRow({ name: "", phone: "" }));
    }
    updateContactRowControls();
  });

  row.append(nameField, phoneField, remove);
  return row;
}

function updateContactRowControls() {
  const rows = dom.contactRows.querySelectorAll(".contact-row");
  rows.forEach((row) => {
    const remove = row.querySelector(".remove-contact");
    if (remove) remove.disabled = rows.length <= 1;
  });
  dom.addContact.disabled = rows.length >= 4;
  dom.addContact.textContent =
    rows.length >= 4 ? "最多 4 位家人" : "＋ 增加一位家人";
}

function normalizePhone(value) {
  const trimmed = String(value).trim();
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return (plus ? "+" : "") + digits;
}

function isValidPhone(phone) {
  return /^\+?\d{7,15}$/.test(phone);
}

function collectContacts() {
  const rows = Array.from(dom.contactRows.querySelectorAll(".contact-row"));
  const raw = rows
    .map((row) => ({
      name: row.querySelector(".contact-name").value.trim(),
      phone: row.querySelector(".contact-phone").value.trim(),
    }))
    .filter((item) => item.name || item.phone);

  if (!raw.length) {
    return { error: "請至少填一位家人的稱呼和電話。" };
  }

  for (const item of raw) {
    if (!item.name) return { error: "請填寫家人的稱呼。" };
    if (!item.phone) return { error: `請填寫「${item.name}」的電話號碼。` };
    const normalized = normalizePhone(item.phone);
    if (!isValidPhone(normalized)) {
      return { error: `「${item.name}」的電話號碼好像不太對，請再檢查一次。` };
    }
    item.phone = normalized;
  }

  return { contacts: raw };
}

function saveContactsFromForm() {
  const result = collectContacts();
  if (result.error) {
    setSetupStatus(result.error, "error");
    return;
  }

  state.contacts = result.contacts;
  store.saveContacts(state.contacts);
  renderQuickHelp();
  refreshOpenTask();
  dom.setupDialog.close();
  showToast("✅ 已儲存，謝謝您！");
}

function refreshOpenTask() {
  if (!state.openTask) return;
  const task = tasks[state.openTask.taskId];
  const detail = state.openTask.section.querySelector(".task-detail");
  if (task && detail) renderSteps(task, state.openTask.systemId, detail);
}

function clearAllContacts() {
  if (!state.contacts.length) {
    setSetupStatus("目前沒有設定家人的電話。", "info");
    return;
  }
  if (!window.confirm("確定要清除所有家人的電話嗎？")) return;

  state.contacts = [];
  store.saveContacts([]);
  renderQuickHelp();
  refreshOpenTask();
  renderContactRows([]);
  setSetupStatus("已清除家人資料。", "ok");
  showToast("已清除家人電話。");
}

function setSetupStatus(message, type) {
  dom.setupStatus.textContent = message;
  dom.setupStatus.className = "sheet-status";
  if (type) dom.setupStatus.classList.add(`is-${type}`);
}

/* ============================================================
   定位分享（「傳送我的位置」教學裡的功能）
   ============================================================ */

function createLocationCard() {
  const card = document.createElement("div");
  card.className = "location-card";
  card.innerHTML = `
    <h3 class="location-title">📍 傳送我的位置給家人</h3>
    <p class="location-lead">出門在外，按一下下面的按鈕，就能把您現在的位置傳給家人。</p>

    <button type="button" class="location-btn" aria-busy="false">
      <span class="location-btn-icon" aria-hidden="true">📍</span>
      <span class="location-btn-text">取得我的位置</span>
    </button>

    <p class="location-status" role="status" aria-live="polite"></p>

    <div class="location-result" hidden>
      <p class="location-address">✅ 已經找到您的位置</p>
      <p class="location-coords"></p>
      <p class="location-accuracy"></p>
      <p class="location-time"></p>

      <a class="location-map-link" href="#" target="_blank" rel="noopener">
        🗺️ 在地圖上看我的位置
      </a>

      <div class="location-actions">
        <button type="button" class="location-action location-action-primary" data-action="share">
          📤 分享給家人
        </button>
        <button type="button" class="location-action" data-action="copy">
          📋 複製位置連結
        </button>
        <a class="location-action location-action-line" data-action="line" href="#" target="_blank" rel="noopener">
          💚 用 LINE 傳送
        </a>
        <a class="location-action" data-action="sms" href="#">
          💬 用簡訊傳送
        </a>
      </div>

      <p class="location-tip">小提醒：傳送前，請先確認是要傳給認識的家人。</p>
    </div>
  `;
  return card;
}

function wireLocationCard(card) {
  const query = (selector) => card.querySelector(selector);

  const button = query(".location-btn");
  const buttonText = query(".location-btn-text");
  const status = query(".location-status");
  const result = query(".location-result");
  const coords = query(".location-coords");
  const accuracy = query(".location-accuracy");
  const timeEl = query(".location-time");
  const mapLink = query(".location-map-link");
  const shareButton = query('[data-action="share"]');
  const copyButton = query('[data-action="copy"]');
  const lineLink = query('[data-action="line"]');
  const smsLink = query('[data-action="sms"]');

  let lastLocation = null;
  let isLocating = false;

  function setStatus(text, type) {
    status.textContent = text;
    status.classList.remove("is-error", "is-ok");
    if (type) status.classList.add(`is-${type}`);
  }

  function buildMessage(location) {
    return (
      "我現在的位置：\n" +
      location.mapUrl +
      "\n（座標 " +
      location.coordsText +
      "，時間 " +
      location.timeText +
      "）"
    );
  }

  function buildSmsHref(message) {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    return `sms:${isIOS ? "&" : "?"}body=${encodeURIComponent(message)}`;
  }

  function buildLineHref(message) {
    return `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
  }

  function renderPosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const acc = Math.round(position.coords.accuracy || 0);
    const coordsText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const mapUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
    const timeText = new Date().toLocaleString("zh-TW", { hour12: false });

    lastLocation = {
      lat,
      lng,
      accuracy: acc,
      coordsText,
      mapUrl,
      timeText,
    };
    lastLocation.message = buildMessage(lastLocation);

    coords.textContent = `緯度 ${lat.toFixed(6)}　經度 ${lng.toFixed(6)}`;
    accuracy.textContent =
      acc > 0
        ? `定位誤差大約 ${acc} 公尺${acc > 200 ? "（室內或收訊較弱時，位置會比較不準）" : ""}`
        : "";
    timeEl.textContent = `更新時間：${timeText}`;
    mapLink.href = mapUrl;
    smsLink.href = buildSmsHref(lastLocation.message);
    lineLink.href = buildLineHref(lastLocation.message);

    result.hidden = false;
    buttonText.textContent = "🔄 重新取得位置";
    setStatus("位置已取得，可以按下面的按鈕傳給家人。", "ok");
  }

  function errorMessage(error) {
    if (!error) return "取得位置時發生問題，請再按一次。";
    if (error.code === 1) {
      return "沒有取得定位權限。請在瀏覽器網址列旁允許「位置」，再按一次按鈕。";
    }
    if (error.code === 2) return "目前找不到定位訊號。請到窗邊或空曠處，再按一次按鈕。";
    if (error.code === 3) return "等太久沒有收到位置。請再按一次按鈕。";
    return "取得位置時發生問題，請再按一次。";
  }

  function getMyLocation() {
    if (isLocating) return;

    if (!navigator.geolocation) {
      setStatus("這個瀏覽器不支援定位功能，請改用 Safari、Chrome 或 Edge。", "error");
      return;
    }

    if (!window.isSecureContext) {
      setStatus(
        "定位功能需要 HTTPS 網址。用 GitHub Pages 的網址就沒問題；本機測試請用 http://localhost。",
        "error"
      );
      return;
    }

    isLocating = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    buttonText.textContent = "正在找您的位置…";
    setStatus("正在透過 GPS 找位置，請稍等（最多 20 秒）。");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        isLocating = false;
        button.disabled = false;
        button.setAttribute("aria-busy", "false");
        renderPosition(position);
      },
      (error) => {
        isLocating = false;
        button.disabled = false;
        button.setAttribute("aria-busy", "false");
        buttonText.textContent = lastLocation ? "🔄 重新取得位置" : "📍 再試一次";
        setStatus(
          lastLocation
            ? `${errorMessage(error)} 下面顯示的是上一次取得的位置（${lastLocation.timeText}）。`
            : errorMessage(error),
          "error"
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  async function copyText() {
    if (!lastLocation) return false;
    const text = lastLocation.message;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      /* 改用下面的舊方法 */
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-1000px";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  async function shareLocation() {
    if (!lastLocation) {
      setStatus("請先按「取得我的位置」。", "error");
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: "我的位置", text: lastLocation.message });
        setStatus("已開啟分享選單，請選擇要傳給哪位家人。", "ok");
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }

    const copied = await copyText();
    setStatus(
      copied
        ? "這個瀏覽器沒有分享選單，位置連結已複製，請貼到訊息裡傳給家人。"
        : "無法自動分享，請按「在地圖上看」後，複製網址傳給家人。",
      copied ? "ok" : "error"
    );
  }

  button.addEventListener("click", getMyLocation);
  shareButton.addEventListener("click", shareLocation);
  copyButton.addEventListener("click", async () => {
    const ok = await copyText();
    setStatus(
      ok ? "位置資訊已複製！請貼到訊息裡傳給家人。" : "複製失敗，請按「在地圖上看」後複製網址。",
      ok ? "ok" : "error"
    );
  });
}

/* ============================================================
   事件綁定
   ============================================================ */

function wireHeader() {
  document.querySelectorAll(".font-btn").forEach((button) => {
    button.addEventListener("click", () => {
      applyFont(button.dataset.size, { announce: true });
    });
  });

  dom.voiceToggle.addEventListener("click", () => {
    setVoiceEnabled(!state.voiceEnabled, { announce: true });
  });

  dom.settingsBtn.addEventListener("click", openSetup);
}

function wireSections() {
  dom.categorySections.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const taskButton = target.closest(".task-btn");
    if (taskButton) {
      openTask(taskButton.dataset.task);
      return;
    }

    const backButton = target.closest(".back-btn");
    if (backButton) {
      closeTask(backButton.closest(".category-section"));
      return;
    }

    const tab = target.closest(".system-tab");
    if (tab) {
      selectSystem(tab.dataset.system);
      return;
    }

    if (target.closest(".start-guide")) {
      startGuide();
      return;
    }

    const speakButton = target.closest(".step-speak");
    if (speakButton) {
      speakStep(Number(speakButton.dataset.step));
      return;
    }

    if (target.closest(".print-btn")) {
      window.print();
    }
  });
}

function wireDialogs() {
  dom.setupClose.addEventListener("click", () => dom.setupDialog.close());
  dom.addContact.addEventListener("click", () => {
    if (dom.contactRows.querySelectorAll(".contact-row").length >= 4) return;
    const row = createContactRow({ name: "", phone: "" });
    dom.contactRows.append(row);
    updateContactRowControls();
    row.querySelector(".contact-name").focus();
  });
  dom.saveSetup.addEventListener("click", saveContactsFromForm);
  dom.clearContacts.addEventListener("click", clearAllContacts);
  dom.voiceCheckbox.addEventListener("change", () => {
    setVoiceEnabled(dom.voiceCheckbox.checked);
  });
  dom.installHelpBtn.addEventListener("click", () => dom.installDialog.showModal());

  dom.guideClose.addEventListener("click", () => dom.guideDialog.close());
  dom.guidePrev.addEventListener("click", () => {
    if (state.guide) goToGuideStep(state.guide.index - 1);
  });
  dom.guideNext.addEventListener("click", () => {
    if (!state.guide) return;
    if (state.guide.done) {
      dom.guideDialog.close();
      return;
    }
    const task = tasks[state.guide.taskId];
    const system = getSystem(task, state.guide.systemId);
    if (state.guide.index >= system.steps.length - 1) {
      finishGuide();
      return;
    }
    goToGuideStep(state.guide.index + 1);
  });
  dom.guideSpeak.addEventListener("click", () => {
    if (!state.guide || state.guide.done) return;
    const task = tasks[state.guide.taskId];
    const system = getSystem(task, state.guide.systemId);
    speakGuide(personalize(system.steps[state.guide.index]));
  });
  dom.guideRestart.addEventListener("click", () => {
    if (!state.guide) return;
    state.guide.index = 0;
    state.guide.done = false;
    renderGuide({ focus: true });
  });
  dom.guideDialog.addEventListener("close", () => {
    state.guide = null;
    guideSpeechToken += 1;
    stopSpeech();
    dom.guideStatus.textContent = "";
  });
  dom.guideDialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      dom.guideNext.click();
    } else if (event.key === "ArrowLeft" && !dom.guidePrev.hidden && !dom.guidePrev.disabled) {
      event.preventDefault();
      dom.guidePrev.click();
    }
  });

  dom.callCancel.addEventListener("click", () => {
    state.pendingCall = null;
    dom.callDialog.close();
  });
  dom.callConfirm.addEventListener("click", confirmCall);
  dom.callDialog.addEventListener("close", () => {
    state.pendingCall = null;
  });

  dom.installClose.addEventListener("click", () => dom.installDialog.close());
  dom.installDone.addEventListener("click", () => dom.installDialog.close());
  dom.installBtn.addEventListener("click", handleInstall);

  [dom.setupDialog, dom.installDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}

function wireGlobal() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("[data-confirm-call]");
    if (!link) return;
    event.preventDefault();
    openCallDialog(link.dataset.tel || "", link.dataset.confirmCall);
  });

  dom.toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  });

  window.addEventListener(
    "scroll",
    () => {
      dom.toTop.classList.toggle("show", window.scrollY > 400);
    },
    { passive: true }
  );

  window.addEventListener("online", () => {
    updateOnlineState();
    showToast("🌐 網路已恢復。");
  });
  window.addEventListener("offline", () => {
    updateOnlineState();
    showToast("📴 目前沒有網路，教學仍可以看。");
  });
}

function updateOnlineState() {
  dom.banner.hidden = navigator.onLine !== false;
  dom.banner.classList.toggle("is-offline", navigator.onLine === false);
}

/* ============================================================
   PWA：安裝與離線
   ============================================================ */

function setupPwa() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        /* 離線功能無法使用時，網站仍可正常操作 */
      });
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstall = event;
    updateInstallUI();
  });

  window.addEventListener("appinstalled", () => {
    state.deferredInstall = null;
    updateInstallUI();
    showToast("✅ 已加到主畫面，謝謝您！");
  });

  updateInstallUI();
}

function isStandalone() {
  const displayStandalone =
    window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  return displayStandalone || window.navigator.standalone === true;
}

function updateInstallUI() {
  dom.installBtn.hidden = isStandalone();
}

async function handleInstall() {
  if (state.deferredInstall) {
    const prompt = state.deferredInstall;
    state.deferredInstall = null;
    prompt.prompt();
    try {
      await prompt.userChoice;
    } catch (e) {
      /* 使用者取消也沒關係 */
    }
    updateInstallUI();
    return;
  }
  dom.installDialog.showModal();
}

/* ============================================================
   啟動
   ============================================================ */

init();
