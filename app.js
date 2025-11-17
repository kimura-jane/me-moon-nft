
// ====== 設定 ======

// スプレッドシートのCSVエクスポートURL
// スプシ側で「ウェブに公開」したあと、必要ならここを書き換えればOK。
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1-JlO7JOQEZ-RlADjJgTri1xiCUDhsti_Bh9YR4NNvxQ/gviz/tq?tqx=out:csv";

// CSVのヘッダー名に合わせてキーを指定
// 例: email, MeMoon_First1000, MeMoon_1000Plus, ChargeAL, NFTCollabAL, GuildMissionAL, GreetingTapAL
const COLUMN_MAP = {
  email: "email",
  memoonFirst1000: "MeMoon_First1000",
  memoon1000plus: "MeMoon_1000Plus",
  chargeAL: "ChargeAL",
  nftCollabAL: "NFTCollabAL",
  guildMissionAL: "GuildMissionAL",
  greetingTapAL: "GreetingTapAL",
};

// ====== 状態管理 ======
let sheetRows = null;
let isLoading = false;

// ====== ユーティリティ ======

function normalizeEmail(value) {
  if (!value) return "";
  return value.trim().toLowerCase();
}

function parseCSV(text) {
  // シンプルなCSVパーサー（カンマ + ダブルクォート対応の軽量版）
  const rows = [];
  let current = [];
  let currentValue = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentValue += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentValue += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      current.push(currentValue);
      currentValue = "";
    } else if (char === "\n") {
      current.push(currentValue);
      rows.push(current);
      current = [];
      currentValue = "";
    } else if (char === "\r") {
      // ignore
    } else {
      currentValue += char;
    }
  }

  if (currentValue !== "" || current.length > 0) {
    current.push(currentValue);
    rows.push(current);
  }

  return rows;
}

function csvToObjects(csvText) {
  const rows = parseCSV(csvText);
  if (!rows.length) return [];

  const header = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);

  return dataRows
    .filter((r) => r.some((v) => v && v.trim() !== ""))
    .map((row) => {
      const obj = {};
      header.forEach((key, idx) => {
        obj[key] = row[idx] ?? "";
      });
      return obj;
    });
}

function toBool(value) {
  if (!value) return false;
  const v = String(value).trim();
  const lower = v.toLowerCase();
  if (["true", "1", "yes"].includes(lower)) return true;
  if (["false", "0", "no"].includes(lower)) return false;
  // ○や⭕などでも true 扱い
  if (/[◯○⭕◎]/.test(v)) return true;
  if (/[×✕✖]/.test(v)) return false;
  return false;
}

// ====== スプレッドシート読み込み ======

async function ensureSheetLoaded() {
  if (sheetRows) return;
  if (isLoading) return;

  isLoading = true;
  const msgEl = document.getElementById("search-message");
  msgEl.textContent = "スプレッドシートを読み込み中…";

  try {
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }
    const text = await res.text();
    const rawRows = csvToObjects(text);

    sheetRows = rawRows.map((row) => ({
      email: normalizeEmail(row[COLUMN_MAP.email]),
      memoonFirst1000: toBool(row[COLUMN_MAP.memoonFirst1000]),
      memoon1000plus: toBool(row[COLUMN_MAP.memoon1000plus]),
      chargeAL: toBool(row[COLUMN_MAP.chargeAL]),
      nftCollabAL: toBool(row[COLUMN_MAP.nftCollabAL]),
      guildMissionAL: toBool(row[COLUMN_MAP.guildMissionAL]),
      greetingTapAL: toBool(row[COLUMN_MAP.greetingTapAL]),
    }));

    msgEl.textContent = "スプレッドシート読み込み完了。メールアドレスを入力して検索できます。";
  } catch (err) {
    console.error("シート読み込みエラー:", err);
    msgEl.textContent = "スプレッドシートの読み込みに失敗しました。URLや公開設定を確認してください。";
  } finally {
    isLoading = false;
  }
}

// ====== UI 更新 ======

function updateStatusPills(result) {
  const items = document.querySelectorAll(".nft-item");
  items.forEach((item) => {
    const key = item.getAttribute("data-key");
    const pill = item.querySelector(".status-pill[data-status-label]");
    const iconEl = pill.querySelector(".status-icon");
    const textEl = pill.querySelector(".status-text");

    const has = result ? !!result[key] : false;

    item.classList.toggle("is-active", has);
    pill.classList.remove("is-yes", "is-no");

    if (has) {
      pill.classList.add("is-yes");
      iconEl.textContent = "⭕";
      textEl.textContent = "対象";
    } else {
      pill.classList.add("is-no");
      iconEl.textContent = "❌";
      textEl.textContent = "対象外";
    }
  });
}

function handleSearchResult(emailInput, row) {
  const emailLabel = document.getElementById("result-email");
  const statusLabel = document.getElementById("result-status");
  const msgEl = document.getElementById("search-message");

  emailLabel.textContent = emailInput || "—";

  if (!row) {
    statusLabel.textContent = "対象が見つかりませんでした。";
    msgEl.textContent = "スプシに登録されていないメールアドレスです。";
    updateStatusPills(null);
    return;
  }

  statusLabel.textContent = "対象が見つかりました。";
  msgEl.textContent = "各項目の⭕ / ❌ を確認してください。";
  updateStatusPills(row);
}

// ====== イベント初期化 ======

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("lookup-form");
  const input = document.getElementById("email-input");
  const msgEl = document.getElementById("search-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailRaw = input.value;
    const normalized = normalizeEmail(emailRaw);

    if (!normalized) {
      msgEl.textContent = "メールアドレスを入力してください。";
      return;
    }

    msgEl.textContent = "照会中…";

    await ensureSheetLoaded();
    if (!sheetRows) {
      // すでにエラーメッセージは表示済み
      return;
    }

    const hit = sheetRows.find((row) => row.email === normalized) || null;
    handleSearchResult(emailRaw, hit);
  });
});
