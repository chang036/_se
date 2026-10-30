/* ============================================================
   語音朗讀（Web Speech API）
   ------------------------------------------------------------
   優先挑選台灣中文（zh-TW）的聲音；如果裝置只有別的中文
   聲音，也會使用。瀏覽器不支援時，介面會自動隱藏語音按鈕。
   ============================================================ */

let cachedVoices = [];

function supported() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

function refreshVoices() {
  if (!supported()) return;
  try {
    cachedVoices = window.speechSynthesis.getVoices() || [];
  } catch (e) {
    cachedVoices = [];
  }
}

if (supported()) {
  refreshVoices();
  if (typeof window.speechSynthesis.addEventListener === "function") {
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
  } else {
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }
}

function pickVoice() {
  if (!cachedVoices.length) refreshVoices();
  const score = (voice) => {
    const lang = String(voice.lang || "").toLowerCase();
    const name = String(voice.name || "").toLowerCase();
    if (lang === "zh-tw" || lang === "zh_hant" || lang === "zh-hant") return 5;
    if (name.includes("taiwan") || name.includes("台灣") || name.includes("台湾")) return 4;
    if (lang.startsWith("zh")) return 3;
    return 0;
  };
  let best = null;
  let bestScore = 0;
  cachedVoices.forEach((voice) => {
    const value = score(voice);
    if (value > bestScore) {
      best = voice;
      bestScore = value;
    }
  });
  return best;
}

export function isSpeechSupported() {
  return supported();
}

/**
 * 唸出一段文字。會先停止前一段，避免聲音重疊。
 * @param {string} text
 * @param {{onStart?: Function, onEnd?: Function, onError?: Function}} handlers
 * @returns {boolean} 是否成功開始朗讀
 */
export function speak(text, handlers = {}) {
  if (!supported() || !text) {
    if (handlers.onError) handlers.onError();
    return false;
  }

  stop();

  const utterance = new SpeechSynthesisUtterance(String(text));
  utterance.lang = "zh-TW";
  utterance.rate = 0.85;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voice = pickVoice();
  if (voice) utterance.voice = voice;

  utterance.onstart = () => {
    if (handlers.onStart) handlers.onStart();
  };
  utterance.onend = () => {
    if (handlers.onEnd) handlers.onEnd();
  };
  utterance.onerror = () => {
    if (handlers.onError) handlers.onError();
  };

  try {
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (e) {
    if (handlers.onError) handlers.onError();
    return false;
  }
}

export function stop() {
  if (!supported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch (e) {
    /* 忽略 */
  }
}
