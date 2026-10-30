/* ============================================================
   教學內容資料
   ------------------------------------------------------------
   每個任務的欄位：
     category  分類 id（phone / computer / watch / safety）
     icon      圖示
     title     標題
     summary   一句話說明
     video     示意影片（可為 null）
     tip       小提醒（可省略）
     quickCall 需要時可直接撥打的電話（可省略）
     systems   裝置版本，每個版本有 steps 步驟陣列
   步驟文字中的 {{family}} 會換成設定的第一位家人名字。
   ============================================================ */

export const categories = [
  {
    id: "phone",
    icon: "📱",
    name: "手機",
    sub: "iPhone / Android",
    lead: "選一個要教您的動作，我們會一步一步說明。",
  },
  {
    id: "computer",
    icon: "💻",
    name: "電腦",
    sub: "Windows / Mac",
    lead: "選一個要教您的動作，我們會一步一步說明。",
  },
  {
    id: "watch",
    icon: "⌚",
    name: "智慧手錶",
    sub: "Apple Watch / Wear OS",
    lead: "選一個要教您的動作，我們會一步一步說明。",
  },
  {
    id: "safety",
    icon: "🛡️",
    name: "安心求助",
    sub: "防詐騙 / 緊急電話",
    lead: "遇到可疑電話或緊急狀況時，先看這裡。",
  },
];

export const emergencyNumbers = [
  { tel: "110", name: "警察", icon: "👮", confirm: true },
  { tel: "119", name: "消防／救護", icon: "🚒", confirm: true },
  { tel: "112", name: "手機緊急", icon: "📱", confirm: true },
  { tel: "165", name: "反詐騙", icon: "🛡️", confirm: false },
];

export const tasks = {
  /* ==================== 手機 ==================== */
  call: {
    category: "phone",
    icon: "📞",
    title: "打電話給家人",
    summary: "用電話號碼或家人的名字，撥電話給家人。",
    tip: "電話接通前，先確認號碼是對的，避免打錯。",
    systems: [
      {
        id: "ios",
        name: "蘋果手機（iPhone）",
        shortName: "iPhone",
        icon: "🍎",
        steps: [
          "在手機畫面找到綠色的「電話」圖示，點一下打開它。",
          "點下面的「通話記錄」，找{{family}}的名字；或點「數字鍵盤」輸入電話號碼。",
          "按綠色的「撥打」按鈕，電話就會打出去。",
          "接通後，把手機拿到耳邊說話。",
          "說完話，按紅色的「結束」按鈕掛斷。",
        ],
      },
      {
        id: "android",
        name: "安卓手機（Android）",
        shortName: "Android",
        icon: "🤖",
        steps: [
          "找到綠色話筒圖示的「電話」app，點一下打開。",
          "點「聯絡人」或「通話記錄」，找{{family}}；也可以按鍵盤輸入號碼。",
          "按綠色話筒按鈕撥打。",
          "接通後，把手機拿到耳邊說話。",
          "說完話，按紅色按鈕掛斷。",
        ],
      },
    ],
  },

  message: {
    category: "phone",
    icon: "💬",
    title: "傳訊息給家人",
    summary: "用簡訊傳一句話給家人，讓家人知道您的情況。",
    systems: [
      {
        id: "ios",
        name: "蘋果手機（iPhone）",
        shortName: "iPhone",
        icon: "🍎",
        steps: [
          "找到藍色對話框的「訊息」app，點一下打開。",
          "點右上角的「撰寫」圖示（一支筆和紙）。",
          "在「收件人」輸入{{family}}的名字或電話。",
          "點下面的輸入框，輸入要說的話。",
          "按右邊藍色向上的箭頭「傳送」。",
        ],
      },
      {
        id: "android",
        name: "安卓手機（Android）",
        shortName: "Android",
        icon: "🤖",
        steps: [
          "找到「訊息」app（藍色對話框），點一下打開。",
          "點右下角的「開始對話」。",
          "輸入{{family}}的名字或電話號碼。",
          "點輸入框，輸入要說的話。",
          "按送出箭頭，訊息就會傳出去。",
        ],
      },
    ],
  },

  video: {
    category: "phone",
    icon: "🎥",
    title: "用 LINE 視訊通話",
    summary: "讓家人看到您，就像面對面說話。",
    tip: "兩邊都要有網路，而且要先加好家人的 LINE 好友。",
    systems: [
      {
        id: "ios",
        name: "蘋果手機（iPhone）",
        shortName: "iPhone",
        icon: "🍎",
        steps: [
          "打開綠色的「LINE」app。",
          "點{{family}}的名字，進入聊天畫面。",
          "點右上角的「視訊通話」相機圖示。",
          "等對方接起來，就可以看到對方。",
          "說完話，按紅色的「結束通話」。",
        ],
      },
      {
        id: "android",
        name: "安卓手機（Android）",
        shortName: "Android",
        icon: "🤖",
        steps: [
          "打開綠色的「LINE」app。",
          "點{{family}}的名字，進入聊天畫面。",
          "點右上角的「視訊通話」相機圖示。",
          "等對方接起來，就可以看到對方。",
          "說完話，按紅色的「結束通話」。",
        ],
      },
    ],
  },

  location: {
    category: "phone",
    icon: "📍",
    title: "傳送我的位置給家人",
    summary: "出門在外，把現在的位置傳給家人，讓家人安心。",
    tip: "在室內定位可能比較不準，走到窗邊或戶外會更準。",
    systems: [
      {
        id: "ios",
        name: "蘋果手機（iPhone）",
        shortName: "iPhone",
        icon: "🍎",
        steps: [
          "用 Safari 打開這個網站「安心操作助理」。",
          "在「手機」分類裡，點「傳送我的位置給家人」。",
          "按藍色大按鈕「取得我的位置」。",
          "畫面問「是否允許使用位置」時，按「允許」。",
          "等幾秒鐘，畫面會顯示您的位置與地圖。",
          "按「分享給家人」選{{family}}，或按「用 LINE 傳送」。",
        ],
      },
      {
        id: "android",
        name: "安卓手機（Android）",
        shortName: "Android",
        icon: "🤖",
        steps: [
          "用 Chrome 打開這個網站「安心操作助理」。",
          "在「手機」分類裡，點「傳送我的位置給家人」。",
          "按藍色大按鈕「取得我的位置」。",
          "畫面問「是否允許使用位置」時，按「允許」。",
          "等幾秒鐘，畫面會顯示您的位置與地圖。",
          "按「分享給家人」選{{family}}，或按「用 LINE 傳送」。",
        ],
      },
    ],
  },

  photo: {
    category: "phone",
    icon: "📷",
    title: "拍照",
    summary: "用相機拍下照片，存在手機裡。",
    systems: [
      {
        id: "ios",
        name: "蘋果手機（iPhone）",
        shortName: "iPhone",
        icon: "🍎",
        steps: [
          "找到「相機」圖示（灰色相機），點一下打開。",
          "把手機對準要拍的東西。",
          "按下面白色的大圓圈「快門」。",
          "照片會自動存到「照片」app，點左下角小圖可以看。",
          "要自拍時，按畫面下方的翻轉鏡頭圖示。",
        ],
      },
      {
        id: "android",
        name: "安卓手機（Android）",
        shortName: "Android",
        icon: "🤖",
        steps: [
          "找到「相機」app，點一下打開。",
          "把手機對準要拍的東西。",
          "按下面的白色圓形快門。",
          "照片會存到「相簿」或「照片」。",
          "要自拍時，按翻轉鏡頭的圖示。",
        ],
      },
    ],
  },

  phone_font: {
    category: "phone",
    icon: "🔠",
    title: "把字變大",
    summary: "調整手機的字體大小，看字更輕鬆。",
    tip: "每種手機的畫面可能略有不同；找不到時，請家人幫忙。",
    systems: [
      {
        id: "ios",
        name: "蘋果手機（iPhone）",
        shortName: "iPhone",
        icon: "🍎",
        steps: [
          "打開「設定」（灰色齒輪圖示）。",
          "點「螢幕顯示與亮度」。",
          "點「文字大小」。",
          "左右拖曳下面的滑桿，字就會變大或變小。",
          "覺得還不夠大，回上一頁點「放大文字」，選更大的字。",
        ],
      },
      {
        id: "android",
        name: "安卓手機（Android）",
        shortName: "Android",
        icon: "🤖",
        steps: [
          "打開「設定」（齒輪圖示）。",
          "點「顯示」。",
          "點「字型大小」或「字體大小」。",
          "拖曳滑桿調整，上面會顯示預覽。",
          "按「套用」，或直接返回上一頁。",
        ],
      },
    ],
  },

  /* ==================== 電腦 ==================== */
  browse: {
    category: "computer",
    icon: "🌐",
    title: "開啟網頁",
    summary: "打開瀏覽器，找到想看的網站。",
    tip: "在網址列直接打想找的字，按 Enter 也能搜尋。",
    systems: [
      {
        id: "windows",
        name: "Windows 電腦",
        shortName: "Windows",
        icon: "🪟",
        steps: [
          "在桌面上找到瀏覽器圖示，例如 Microsoft Edge 或 Google Chrome。",
          "用滑鼠左鍵快速點兩下打開。",
          "點最上面的「網址列」。",
          "輸入網址，例如 www.google.com。",
          "按鍵盤上的 Enter 鍵。",
        ],
      },
      {
        id: "mac",
        name: "Mac 電腦",
        shortName: "Mac",
        icon: "🍎",
        steps: [
          "在下方工具列找到 Safari 或 Chrome。",
          "點一下打開。",
          "點最上面的「網址列」。",
          "輸入網址，例如 www.google.com。",
          "按鍵盤上的 Return 鍵。",
        ],
      },
    ],
  },

  screenshot: {
    category: "computer",
    icon: "📸",
    title: "截圖",
    summary: "把螢幕畫面存成一張圖片。",
    tip: "截圖不會自動傳給別人，要自己貼上或分享。",
    systems: [
      {
        id: "windows",
        name: "Windows 電腦",
        shortName: "Windows",
        icon: "🪟",
        steps: [
          "同時按鍵盤上的 Windows 鍵、Shift 鍵和 S 鍵。",
          "畫面變暗後，用滑鼠按住左鍵，框出要截圖的範圍。",
          "放開滑鼠，圖片會先存到「剪貼簿」。",
          "螢幕右下角會出現通知，點它可以存成檔案。",
        ],
      },
      {
        id: "mac",
        name: "Mac 電腦",
        shortName: "Mac",
        icon: "🍎",
        steps: [
          "同時按 Command、Shift 和 3，截取整個畫面。",
          "只要一部分時，按 Command、Shift 和 4，再框選範圍。",
          "圖片會自動存到桌面。",
        ],
      },
    ],
  },

  fontsize: {
    category: "computer",
    icon: "🔍",
    title: "調整字體大小",
    summary: "把電腦的字和畫面放大，看得更清楚。",
    tip: "看網頁時，也可以按 Ctrl 加 +（Mac 是 Command 加 +）把畫面放大。",
    systems: [
      {
        id: "windows",
        name: "Windows 電腦",
        shortName: "Windows",
        icon: "🪟",
        steps: [
          "按「開始」→「設定」（齒輪圖示）。",
          "點「協助工具」。",
          "點「文字大小」。",
          "拖曳滑桿調整，右邊可以預覽。",
          "按「套用」。",
        ],
      },
      {
        id: "mac",
        name: "Mac 電腦",
        shortName: "Mac",
        icon: "🍎",
        steps: [
          "點左上角蘋果圖示 →「系統設定」。",
          "點「輔助使用」。",
          "點「顯示」→「文字大小」。",
          "選擇比較大的字級。",
        ],
      },
    ],
  },

  /* ==================== 智慧手錶 ==================== */
  watch_call: {
    category: "watch",
    icon: "⌚",
    title: "打電話 / 傳訊息",
    summary: "用手錶打電話給家人，不用拿手機。",
    tip: "有些手錶沒有喇叭，聲音會從手機出來。",
    systems: [
      {
        id: "watch-ios",
        name: "Apple Watch",
        shortName: "Apple Watch",
        icon: "⌚",
        steps: [
          "按一下手錶右側的「數位錶冠」，回到應用程式列表。",
          "點「電話」圖示（綠色話筒）。",
          "轉動錶冠找{{family}}，點一下名字。",
          "點綠色「撥打」。",
          "手錶要連著手機或 Wi-Fi 才能通話。",
        ],
      },
      {
        id: "watch-android",
        name: "安卓手錶（Wear OS）",
        shortName: "Wear OS",
        icon: "⌚",
        steps: [
          "按一下手錶電源鍵，或往上滑，打開應用程式列表。",
          "點「電話」app。",
          "選{{family}}，或輸入電話號碼。",
          "按綠色話筒撥打。",
        ],
      },
    ],
  },

  watch_health: {
    category: "watch",
    icon: "❤️",
    title: "看健康數據",
    summary: "用手錶看心跳，注意自己的身體。",
    tip: "手錶的數字只能參考；身體不舒服時，請聯絡家人或看醫生。",
    systems: [
      {
        id: "watch-ios",
        name: "Apple Watch",
        shortName: "Apple Watch",
        icon: "⌚",
        steps: [
          "按一下數位錶冠，找到「心率」app（紅色愛心）。",
          "點一下打開，手錶會開始測量。",
          "等幾秒鐘，畫面上會出現每分鐘心跳次數。",
          "往下滑，還可以看到最近的心率紀錄。",
        ],
      },
      {
        id: "watch-android",
        name: "安卓手錶（Wear OS）",
        shortName: "Wear OS",
        icon: "⌚",
        steps: [
          "打開應用程式列表，點「心率」app。",
          "把手錶貼緊手腕，等它測量。",
          "看畫面上的心跳數字。",
        ],
      },
    ],
  },

  watch_alarm: {
    category: "watch",
    icon: "⏰",
    title: "設定鬧鐘",
    summary: "讓手錶在指定時間叫您起床或提醒您。",
    tip: "設定好後，手錶要戴著或放在床邊才聽得到。",
    systems: [
      {
        id: "watch-ios",
        name: "Apple Watch",
        shortName: "Apple Watch",
        icon: "⌚",
        steps: [
          "按數位錶冠找到「鬧鐘」app（時鐘圖示）。",
          "點「新增鬧鐘」。",
          "轉動錶冠設定小時和分鐘。",
          "點「完成」。",
          "鬧鐘響時，點「停止」。",
        ],
      },
      {
        id: "watch-android",
        name: "安卓手錶（Wear OS）",
        shortName: "Wear OS",
        icon: "⌚",
        steps: [
          "打開應用程式列表，點「鬧鐘」。",
          "點「＋」新增鬧鐘。",
          "設定時間。",
          "點「完成」或「儲存」。",
        ],
      },
    ],
  },

  watch_sos: {
    category: "watch",
    icon: "🆘",
    title: "緊急求助（SOS）",
    summary: "跌倒或身體不舒服時，用手錶打電話求救。",
    tip: "請家人先幫您確認手錶的緊急設定和聯絡人是否正確。",
    systems: [
      {
        id: "watch-ios",
        name: "Apple Watch",
        shortName: "Apple Watch",
        icon: "⌚",
        steps: [
          "遇到緊急狀況，按住手錶右側的長條按鈕。",
          "畫面出現滑桿後，向右拖曳「緊急服務電話」。",
          "手錶會自動撥打 110 或 119。",
          "接通後，說明地點和狀況。",
          "如果手錶偵測到您跌倒，也會問您要不要打緊急電話。",
        ],
      },
      {
        id: "watch-android",
        name: "安卓手錶（Wear OS）",
        shortName: "Wear OS",
        icon: "⌚",
        steps: [
          "快速連按手錶的電源鍵 5 次（不同品牌可能不同）。",
          "或打開「緊急求助」app。",
          "按「緊急電話」。",
          "接通後，說明地點和狀況。",
        ],
      },
    ],
  },

  /* ==================== 安心求助 ==================== */
  scam: {
    category: "safety",
    icon: "🚫",
    title: "接到可疑電話怎麼辦",
    summary: "有人叫您去 ATM、給密碼或不要告訴家人，就是詐騙。",
    tip: "記得：只要對方叫您「不要告訴家人」，就一定是詐騙。",
    quickCall: [{ tel: "165", label: "165 反詐騙專線", tone: "info" }],
    systems: [
      {
        id: "any",
        name: "所有手機與電腦",
        shortName: "通用",
        icon: "🛡️",
        steps: [
          "接到陌生電話，說「帳戶被凍結」「檢察官要查你」「健保卡被盜用」，先不要緊張，也不要照他的話做。",
          "直接掛掉電話。真正的警察、銀行、醫院，不會叫您去 ATM 或網路銀行操作。",
          "不要給對方：身分證號碼、銀行帳號、密碼，還有手機收到的驗證碼。",
          "掛電話後，自己撥 165 反詐騙專線查證，不要撥對方給您的號碼。",
          "打電話告訴{{family}}，請家人陪您一起確認。",
          "如果已經匯款，馬上撥 165 或 110 報案，並保留通話紀錄。",
        ],
      },
    ],
  },

  emergency: {
    category: "safety",
    icon: "🚨",
    title: "緊急電話怎麼打",
    summary: "110、119、112 要怎麼用，接通後要說什麼。",
    tip: "不是緊急的事，請不要打 110 或 119，把線路留給真正需要的人。",
    quickCall: [
      { tel: "110", label: "110 警察", tone: "danger" },
      { tel: "119", label: "119 消防／救護", tone: "danger" },
      { tel: "112", label: "112 手機緊急", tone: "danger" },
    ],
    systems: [
      {
        id: "any",
        name: "所有手機與電腦",
        shortName: "通用",
        icon: "🛡️",
        steps: [
          "有人受傷、生病很嚴重，或發生火災：撥 119。",
          "遇到壞人、車禍、東西被偷：撥 110。",
          "手機沒有訊號，或人在國外：撥 112，會幫您轉接。",
          "電話接通後，先說地點：縣市、路名、門牌號碼，或附近的大地標。",
          "再說發生什麼事、有幾個人受傷。",
          "不要先掛電話，等對方說可以掛再掛。",
        ],
      },
    ],
  },
};
