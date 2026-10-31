// メールのリンク（確認・メールアドレスの変更・パスワードの再設定）を処理するページ。
// Firebase Authentication の「アクションURL」に、このページ（https://akkowan.jp/auth-action.html）を設定して使う。
// リンクには ?mode=…&oobCode=…（確認コード）が付く。確認コードは、一度だけ使える。
//
// 安全のための決まり：
//  - 画面に出す文字は、すべて textContent で入れる（URLの値を、HTMLとして解釈しない）
//  - リンクの continueUrl・lang など、こちらで使わない値は、無視する
//  - 確認コードは、読み取ったらすぐ、URLと履歴から消す
//  - メールアドレスやパスワードを、このページの外へ送らない（Firebase Authentication への通信だけ）

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  applyActionCode,
  checkActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// ===== 設定 =====================================================================
// Firebase Console →「プロジェクトの設定」→「全般」→「マイアプリ」→ ウェブアプリの firebaseConfig の値を入れる。
// これらは、ウェブに公開される前提の値なので、公式サイトのリポジトリに置いて問題ない。
// projectId と authDomain は、DNSの「firebase=…」の値から推測した値。Consoleの値と違う場合は、Consoleの値にする。
const firebaseConfig = {
  apiKey: "AIzaSyBeRiSuiAR_zTl6Ei9o57iVD5Mapjq1kXs",
  authDomain: "kokowan-8410a.firebaseapp.com",
  projectId: "kokowan-8410a",
  appId: "1:479858980056:web:922f1f30772374fdbc13ad",
};
// ================================================================================

const $ = (id) => document.getElementById(id);
const card = $("card");
const icon = $("icon");
const title = $("title");
const body = $("body");
const extra = $("extra");

// 画面を、指定の内容に切り替える。kind: "success" | "error" | "info"
function render(kind, heading, lines = []) {
  card.className = "card card--" + kind;
  icon.textContent = kind === "success" ? "✅" : kind === "error" ? "⚠️" : "🐾";
  title.textContent = heading;
  body.replaceChildren(
    ...lines.map((text) => {
      const p = document.createElement("p");
      p.textContent = text;
      return p;
    }),
  );
  extra.replaceChildren();
}

function describeError(code) {
  switch (code) {
    case "auth/expired-action-code":
      return "このリンクは、有効期限が切れています。";
    case "auth/invalid-action-code":
      return "このリンクは、すでに使われているか、正しくありません。";
    case "auth/user-disabled":
      return "このアカウントは、現在、利用できません。";
    case "auth/user-not-found":
      return "このアカウントは、見つかりませんでした。";
    case "auth/weak-password":
      return "パスワードが短いか、推測されやすいものです（6文字以上にしてください）。";
    case "auth/network-request-failed":
      return "通信できませんでした。電波の状態を確かめて、もう一度、メールのリンクを開いてください。";
    default:
      return "処理を完了できませんでした。";
  }
}

const RESEND_HINT = "あっこワン！のアプリの設定「アカウントとわんこ」から、確認メールを再送できます。";

function renderLinkError(error, hint) {
  render("error", "処理を完了できませんでした", [describeError(error && error.code), hint]);
}

async function handleVerifyEmail(auth, oobCode) {
  try {
    await applyActionCode(auth, oobCode);
    render("success", "メールアドレスの確認が完了しました", [
      "あっこワン！のアプリに戻って、設定の「アカウントとわんこ」で「確認しました」を押してください。",
      "アプリを開き直したときにも、自動で反映されます。",
    ]);
  } catch (error) {
    renderLinkError(error, RESEND_HINT);
  }
}

async function handleVerifyAndChangeEmail(auth, oobCode) {
  try {
    await applyActionCode(auth, oobCode);
    render("success", "メールアドレスの変更が完了しました", [
      "あっこワン！のアプリでは、新しいメールアドレスで、もう一度サインインしてください。",
      "家族グループへの参加と、共有した散歩は、そのまま残ります。",
    ]);
  } catch (error) {
    renderLinkError(error, "あっこワン！のアプリの設定「アカウントとわんこ」から、もう一度、メールアドレスの変更をお試しください。");
  }
}

async function handleRecoverEmail(auth, oobCode) {
  try {
    await checkActionCode(auth, oobCode);
    await applyActionCode(auth, oobCode);
    render("success", "メールアドレスを元に戻しました", [
      "あっこワン！のアプリでは、元のメールアドレスで、もう一度サインインしてください。",
      "心当たりがない場合は、お問い合わせください。",
    ]);
  } catch (error) {
    renderLinkError(error, "心当たりがない場合は、お問い合わせください。");
  }
}

async function handleResetPassword(auth, oobCode) {
  try {
    // コードが有効かを、先に確かめる（無効なら、フォームを出さない）
    await verifyPasswordResetCode(auth, oobCode);
  } catch (error) {
    renderLinkError(error, "お手数ですが、もう一度、パスワードの再設定を、お試しください。");
    return;
  }

  render("info", "新しいパスワードを設定します", ["新しいパスワードを、2回、入力してください（6文字以上）。"]);

  const form = document.createElement("form");
  form.className = "form";

  const makeField = (id, labelText) => {
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = labelText;
    const input = document.createElement("input");
    input.id = id;
    input.type = "password";
    input.minLength = 6;
    input.required = true;
    input.autocomplete = "new-password";
    form.append(label, input);
    return input;
  };
  const password = makeField("pw1", "新しいパスワード");
  const confirm = makeField("pw2", "もう一度、入力");

  const message = document.createElement("p");
  message.className = "error-text";
  message.setAttribute("role", "alert");

  const button = document.createElement("button");
  button.type = "submit";
  button.className = "button";
  button.textContent = "パスワードを変更する";

  form.append(message, button);
  extra.replaceChildren(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    if (password.value.length < 6) {
      message.textContent = "パスワードは、6文字以上にしてください。";
      return;
    }
    if (password.value !== confirm.value) {
      message.textContent = "2回の入力が、一致していません。";
      return;
    }
    button.disabled = true;
    try {
      await confirmPasswordReset(auth, oobCode, password.value);
      render("success", "パスワードを変更しました", [
        "あっこワン！のアプリで、新しいパスワードで、サインインしてください。",
      ]);
    } catch (error) {
      button.disabled = false;
      message.textContent = describeError(error && error.code);
    }
  });
}

async function main() {
  // URLの値を読み取ったら、すぐ、URLと履歴から消す（確認コードを、残さない）
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const oobCode = params.get("oobCode");
  window.history.replaceState(null, "", window.location.pathname);

  // 設定の値が、まだ入っていない（管理者向け）
  const configured = Object.values(firebaseConfig).every(
    (value) => typeof value === "string" && value !== "" && !value.startsWith("YOUR_"),
  );
  if (!configured) {
    render("error", "設定が完了していません", ["このページの設定（firebaseConfig）を確認してください。"]);
    return;
  }

  if (!mode || !oobCode) {
    render("info", "メールのリンクから開いてください", [
      "このページは、あっこワン！から届いたメールの、リンクを開いたときに表示されます。",
    ]);
    return;
  }

  const auth = getAuth(initializeApp(firebaseConfig));
  auth.languageCode = "ja";

  switch (mode) {
    case "verifyEmail":
      await handleVerifyEmail(auth, oobCode);
      break;
    case "verifyAndChangeEmail":
      await handleVerifyAndChangeEmail(auth, oobCode);
      break;
    case "recoverEmail":
      await handleRecoverEmail(auth, oobCode);
      break;
    case "resetPassword":
      await handleResetPassword(auth, oobCode);
      break;
    default:
      render("error", "このリンクは、処理できません", ["お手数ですが、あっこワン！のアプリから、もう一度お試しください。"]);
  }
}

main();
