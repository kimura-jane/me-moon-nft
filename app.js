// ====== 設定 ======

// スプレッドシートの CSV エクスポートURL
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1-JlO7JOQEZ-RlADjJgTri1xiCUDhsti_Bh9YR4NNvxQ/export?format=csv";

// CSV のヘッダー名に合わせてキーを指定
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

// カンマを含まない想定のシンプルCSVパーサー
function csvToObjects(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const dataLines = lines.slice(1);

  return dataLines
    .map((line) => line.split(","))
    .filter((cols) => cols.some((v) => v && v.trim() !== ""))
    .map((cols) => {
      const obj = {};
      headers.forEach((key, idx) => {
        obj[key] = cols[idx] !== undefined ? cols[idx] : "";
      });
      return obj;
    });
}

function toBool(value) {
  if (value === undefined || value === null) return false;
  const v = String(value).trim();
  if (!v) return false;

  const lower = v.toLowerCase();
  if (["true", "1", "yes"].includes(lower)) return true;
  if (["false", "0", "no"].includes(lower)) return false;

  // ○/⭕ 系 → true、× 系 → false
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

    msgEl.textContent =
      "スプレッドシート読み込み完了。メールアドレスを入力して検索できます。";
  } catch (err) {
    console.error("シート読み込みエラー:", err);
    msgEl.textContent =
      "スプレッドシートの読み込みに失敗しました。URLや公開設定を確認してください。";
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
    if (!pill) return;

    const iconEl = pill.querySelector(".status-icon");
    const textEl = pill.querySelector(".status-text");

    const has = result ? !!result[key] : false;

    item.classList.toggle("is-active", has);
    pill.classList.remove("is-yes", "is-no");

    if (has) {
      pill.classList.add("is-yes");
      iconEl.textContent = "🙆";
      textEl.textContent = "対象";
    } else {
      pill.classList.add("is-no");
      iconEl.textContent = "🙅";
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
  msgEl.textContent = "各項目の 🙆 / 🙅 を確認してください。";
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
      return; // エラー時は ensureSheetLoaded 側で表示済み
    }

    const hit =
      sheetRows.find((row) => row.email === normalized) || null;

    handleSearchResult(emailRaw, hit);
  });
});
