/* Easy settings for the team */
var WIN_MARK = 1;       // correct answers needed for the full coupon (0 correct gets the funny coupon)
var VALID_DAYS = 7;     // days the coupon stays valid
var STORE_KEY = "pp_naruto_coupon_v2";
var SHEET_URL = "https://script.google.com/macros/s/AKfycbzigdhqhY7aR94VnOM0Ep9SnOcZEdATos4-ouzR6XHK3Rs5m6UrHcuxBZkujNbmEzrECA/exec";   // Web app URL from Google Apps Script
var QUEUE_KEY = "pp_sheet_queue";

/* Meta Pixel helper */
function fbTrack(name, params, custom) {
  try {
    if (window.fbq) { custom ? fbq("trackCustom", name, params || {}) : fbq("track", name, params || {}); }
  } catch (e) {}
}

/* Campaign source, read from the ad link (utm tags and fbclid) */
var QS = new URLSearchParams(window.location.search);
var SRC = {
  source: QS.get("utm_source") || "",
  medium: QS.get("utm_medium") || "",
  campaign: QS.get("utm_campaign") || "",
  content: QS.get("utm_content") || "",
  fbclid: QS.get("fbclid") || ""
};

/* Google Sheet sender. Keeps a small retry queue so nothing is lost on a weak connection */
function readQueue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch (e) { return []; } }
function writeQueue(q) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) {} }
function sheetReady() { return SHEET_URL && SHEET_URL.indexOf("PASTE") !== 0; }
function dropFromQueue(code) {
  writeQueue(readQueue().filter(function (x) { return x.code !== code; }));
}

/* Debug readout. Open the page with ?debug=1 to see whether the sheet replied. */
var DEBUG = QS.get("debug") === "1";
function dbg(msg) {
  if (!DEBUG) return;
  var box = $("dbg");
  if (!box) {
    box = document.createElement("div");
    box.id = "dbg";
    box.className = "dbg";
    document.body.appendChild(box);
  }
  box.textContent = (new Date()).toLocaleTimeString() + "  " + msg + "\n" + box.textContent;
}

/* Fallback: a plain image request. It ignores CORS completely, so it still
   reaches the script when fetch is blocked. Handled by doGet in Apps Script. */
function beacon(item) {
  var p = new URLSearchParams();
  for (var k in item) { if (item.hasOwnProperty(k)) p.set(k, item[k]); }
  p.set("via", "img");
  var img = new Image();
  img.src = SHEET_URL + "?" + p.toString();
  dbg("fallback image request sent");
}

function flushQueue() {
  if (!sheetReady()) return;
  readQueue().forEach(function (item) {
    item.tries = (item.tries || 0) + 1;
    fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(item),
      keepalive: true
    })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        dbg("sheet replied: " + t.slice(0, 160));
        if (t.indexOf("ok") === 0) { dropFromQueue(item.code); }
        else { beacon(item); dropFromQueue(item.code); }
      })
      .catch(function (e) {
        dbg("post failed (" + e.message + "), using fallback");
        beacon(item);
        if (item.tries >= 3) dropFromQueue(item.code);
        else writeQueue(readQueue().map(function (x) { return x.code === item.code ? item : x; }));
      });
  });
}

function sendToSheet(c) {
  if (!sheetReady()) { dbg("no sheet url set"); return; }
  var q = readQueue().slice(-20);
  q.push({
    name: c.name,
    score: c.score,
    tier: c.tier,
    code: c.code,
    expiry: c.expiry,
    answers: state.answers.join(" "),
    source: SRC.source, medium: SRC.medium, campaign: SRC.campaign, content: SRC.content, fbclid: SRC.fbclid,
    device: navigator.userAgent.slice(0, 120)
  });
  writeQueue(q);
  flushQueue();
}

var QUESTIONS = [
  { q: "What is Naruto's favourite food?", o: ["Sushi", "Ramen", "Curry", "Dango"], a: 1 },
  { q: "What is the name of Naruto's favourite ramen shop?", o: ["Ichiraku Ramen", "Ramen Ichiban", "Konoha Ramen", "Uzumaki Ramen"], a: 0 },
  { q: "What is Naruto's dream?", o: ["Become the strongest Shinobi", "Become Hokage", "Become a Jonin", "Become a village leader"], a: 1 }
];
var GOOD = ["DATTEBAYO!", "NICE ONE!", "YOU KNOW IT!", "BOOM!"];
var BAD = ["OOPS!", "NOT QUITE!", "NEXT ONE!", "NO WORRIES!"];
var LETTERS = ["A", "B", "C", "D"];
var STAR = '<svg viewBox="0 0 100 100" aria-hidden="true"><path class="sh" d="M50 4 L60 40 L96 50 L60 60 L50 96 L40 60 L4 50 L40 40 Z M50 43 a7 7 0 1 0 .01 0 Z"/></svg>';

var $ = function (id) { return document.getElementById(id); };
var state = { idx: 0, score: 0, locked: false, tier: "win", answers: [], started: false };

function show(id) {
  ["s-quiz", "s-name", "s-win"].forEach(function (s) { $(s).classList.toggle("on", s === id); });
  $("hero").hidden = (id === "s-win");
  $("logobar").hidden = (id === "s-win");
  window.scrollTo(0, 0);
}

function titleCase(s) {
  return s.trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); });
}
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function renderQ() {
  var q = QUESTIONS[state.idx];
  state.locked = false;

  var bar = $("bar");
  bar.innerHTML = "";
  for (var i = 0; i < QUESTIONS.length; i++) {
    var s = document.createElement("span");
    s.className = i < state.idx ? "done" : (i === state.idx ? "now" : "");
    s.innerHTML = STAR;
    bar.appendChild(s);
  }
  $("sub").textContent = "Answer " + QUESTIONS.length + " questions. Win your coupon.";
  $("qCount").textContent = (state.idx + 1) + "/" + QUESTIONS.length;
  $("qText").textContent = q.q;

  var box = $("opts");
  box.innerHTML = "";
  q.o.forEach(function (text, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "opt";
    var k = document.createElement("span");
    k.className = "k";
    k.textContent = LETTERS[i];
    var t = document.createElement("span");
    t.textContent = text;
    b.appendChild(k);
    b.appendChild(t);
    b.addEventListener("click", function () { pick(i); });
    box.appendChild(b);
  });

  $("fb").textContent = "";
  $("fb").className = "fb";
  $("nextBtn").hidden = true;
}

function pick(i) {
  if (state.locked) return;
  state.locked = true;
  var q = QUESTIONS[state.idx];
  var btns = $("opts").children;
  var correct = i === q.a;

  for (var k = 0; k < btns.length; k++) {
    btns[k].disabled = true;
    if (k === q.a) btns[k].classList.add("right");
    else if (k === i) btns[k].classList.add("wrong");
    else btns[k].classList.add("dim");
  }
  if (correct) state.score++;
  state.answers.push(LETTERS[i]);
  if (!state.started) { state.started = true; fbTrack("QuizStart", {}, true); }

  $("fb").textContent = correct ? rand(GOOD) : rand(BAD);
  $("fb").className = "fb " + (correct ? "good" : "bad");

  var last = state.idx === QUESTIONS.length - 1;
  $("nextBtn").textContent = last ? "SEE MY RESULT" : "NEXT";
  $("nextBtn").hidden = false;
  $("nextBtn").focus({ preventScroll: true });
}

function nextStep() {
  if (!state.locked) return;
  if (state.idx === QUESTIONS.length - 1) { submitQuiz(); return; }
  state.idx++;
  renderQ();
}

function submitQuiz() {
  var win = state.score >= WIN_MARK;
  state.tier = win ? "win" : "funny";
  fbTrack("QuizComplete", { score: state.score, coupon_type: state.tier }, true);
  $("nA").textContent = win ? "YOU" : "WELL...";
  $("nB").textContent = win ? "WIN!" : "OOPS!";
  $("roast").hidden = win;
  $("nameLead").textContent = win
    ? state.score + " out of " + QUESTIONS.length + ". Enter your name for your coupon."
    : state.score + " out of " + QUESTIONS.length + ", but you still get a coupon. Enter your name.";
  show("s-name");
  if (win) confetti();
  $("name").focus({ preventScroll: true });
}

function makeCoupon(name) {
  var now = new Date();
  var exp = new Date(now.getTime() + VALID_DAYS * 24 * 60 * 60 * 1000);
  var letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  var prefix = state.tier === "win" ? "URF" : "LTD";
  var code = prefix + letters.charAt(Math.floor(Math.random() * letters.length)) + (1000 + Math.floor(Math.random() * 9000));
  return { name: name, tier: state.tier, code: code, issued: now.getTime(), expiry: exp.getTime() };
}

function fmtDate(ms) { return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
function fmtTime(ms) { return new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }); }

function getCoupon() {
  var n = titleCase($("name").value);
  if (n.length < 2) {
    $("nameErr").textContent = "Type your name so we can put it on your coupon.";
    $("name").focus();
    return;
  }
  $("nameErr").textContent = "";
  var c = makeCoupon(n);
  c.score = state.score;
  saveCoupon(c);
  fbTrack("Lead", { content_name: "Naruto Quiz Coupon", content_category: c.tier });
  sendToSheet(c);
  showCoupon(c);
}

function showCoupon(c) {
  $("cName").textContent = c.name;
  $("cCode").textContent = c.code;
  $("cIssued").textContent = fmtDate(c.issued) + ", " + fmtTime(c.issued);
  $("cExpiry").textContent = fmtDate(c.expiry);
  $("offerWin").hidden = c.tier !== "win";
  $("offerFunny").hidden = c.tier === "win";
  show("s-win");
}

function saveCoupon(c) { try { localStorage.setItem(STORE_KEY, JSON.stringify(c)); } catch (e) {} }
function loadCoupon() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    var c = JSON.parse(raw);
    if (c && c.name && c.code && c.expiry && c.tier) return c;
  } catch (e) {}
  return null;
}
function clearCoupon() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }

function restart() {
  state.idx = 0;
  state.score = 0;
  state.answers = [];
  state.started = false;
  $("name").value = "";
  renderQ();
  show("s-quiz");
}

function confetti() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var colors = ["#F26B1D", "#FFC533", "#FFF7E8", "#1A110C"];
  for (var i = 0; i < 36; i++) {
    var p = document.createElement("div");
    p.className = "confetti";
    var w = 8 + Math.random() * 8;
    p.style.width = w + "px";
    p.style.height = (w * 1.5) + "px";
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = (2.2 + Math.random() * 2) + "s";
    p.style.animationDelay = (Math.random() * .5) + "s";
    document.body.appendChild(p);
    (function (el) { setTimeout(function () { el.remove(); }, 5200); })(p);
  }
}

$("nextBtn").addEventListener("click", nextStep);
$("couponBtn").addEventListener("click", getCoupon);
$("name").addEventListener("keydown", function (e) { if (e.key === "Enter") getCoupon(); });
$("resetBtn").addEventListener("click", function () { clearCoupon(); restart(); });

flushQueue();
var saved = loadCoupon();
renderQ();
if (saved) showCoupon(saved);
