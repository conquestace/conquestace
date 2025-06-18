/*tablogic.js   */

const CONFIG = {
  defaultCommand: 'g',
  bgColor: '#21252d',
  textColor: '#1b91d6',
  showClock: false,
  alwaysNewTab: false,
};

const aliases = {
  cal: 'gc',
  gk: 'k',
  ddg: 'dg',
  map: 'gm',
  '?': 'help',
  yt: 'y',
  mdn: 'mdn',
};

let lastEnteredCommand = '';
let newTab = false;

window.onload = () => {
  applyConfig();
  document.querySelector('#input').focus();
  document.body.addEventListener('click', () => document.querySelector('#input').focus());
  document.onkeydown = handleKeyDown;
  updateClock();
};

function applyConfig() {
  document.body.style.backgroundColor = CONFIG.bgColor;
  document.body.style.color = CONFIG.textColor;
  const clock = document.querySelector('#clock');
  if (clock) clock.style.display = CONFIG.showClock ? 'inline' : 'none';
}

function handleKeyDown(e) {
  const key = e.keyCode || e.which;
  if (key === 13) evaluateInput();
  else if (key === 38 && lastEnteredCommand !== '') {
    const input = document.querySelector('#input');
    input.value = lastEnteredCommand;
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function evaluateInput() {
  const inputField = document.querySelector('#input');
  const raw = inputField.value.trim();
  inputField.value = '';
  clearMessage();
  if (!raw) return;

  lastEnteredCommand = raw;

  let args = raw.split('/');
  let command = args[0].toLowerCase().trim();

  if (aliases[command]) {
    command = aliases[command];
    args.shift();
  }

  if (args[args.length - 1] === 'n') {
    newTab = true;
    args.pop();
  }

  if (command.startsWith('!')) {
    const bang = command.slice(1);
    if (commands[bang]) return commands[bang](args.slice(1));
  }

  if (isURL(command)) {
    return redirect(buildURL(command));
  }

  args.shift();
  if (commands[command]) {
    return commands[command](args);
  } else {
    return commands[CONFIG.defaultCommand](raw.split(' '));
  }
}

function redirect(url) {
  if (newTab || CONFIG.alwaysNewTab) {
    window.open(url, '_blank').focus();
  } else {
    window.location.href = url;
  }
  newTab = false;
}

function buildURL(base, path = '', query = '') {
  const url = base.startsWith('http') ? base : `http://${base}`;
  return url + path + encodeURIComponent(query);
}

function isURL(str) {
  return /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(str);
}

function clearMessage() {
  const el = document.querySelector('#message');
  if (el) el.innerText = '';
}

function updateClock() {
  const now = new Date();
  const h = now.getHours();
  const m = ('0' + now.getMinutes()).slice(-2);
  const display = `${h % 12 || 12}:${m}`;
  const clock = document.querySelector('#clock');
  if (clock) clock.innerText = display;
  setTimeout(updateClock, 1000);
}

// === COMMANDS ===
const commands = {
  g: args => redirect(buildURL('https://google.com', '/search?q=', args.join(' '))),
  dg: args => redirect(buildURL('https://duckduckgo.com', '/?q=', args.join(' '))),
  r: args => redirect(buildURL('https://reddit.com', '/r/', args.join('/'))),
  y: args => redirect(buildURL('https://youtube.com', '/results?search_query=', args.join(' '))),
  a: args => redirect(buildURL('https://amazon.com', '/s?k=', args.join(' '))),
  so: args => redirect(buildURL('https://stackoverflow.com', '/search?q=', args.join(' '))),
  wa: args => redirect(buildURL('https://wolframalpha.com', '/input/?i=', args.join(' '))),
  help: () => redirect('https://github.com/conquestace/conquestace'),
  '': args => redirect(buildURL('https://4chan.org', '/', args.join('/'))),


  // === Easter Eggs ===
  time: toggleClock,
  clock: toggleClock,
  sudo: () => showMessage("sys", "Permission denied. You're not root."),
  hack: () => triggerMatrix(),
  terminal: () => {
  document.dispatchEvent(new CustomEvent('open-console-overlay'));
  showMessage("sys", "Console overlay opened.");
},

};


// === Extras ===
function toggleClock() {
  const clock = document.querySelector('#clock');
  if (!clock) return;
  const visible = clock.style.display !== 'none';
  clock.style.display = visible ? 'none' : 'inline';
  showMessage("sys", visible ? "Clock hidden." : "Clock shown.");
}

function showMessage(user, msg) {
  const el = document.querySelector('#message');
  if (!el) return;
  el.textContent = '';
  const span = document.createElement('span');
  span.className = 'text-sky';
  span.textContent = user;
  el.appendChild(span);
  el.append(`: ${msg}`);
}
function triggerMatrix() {
  if (document.getElementById('matrix-bg')) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'matrix-bg';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '-1';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  const width = canvas.width = window.innerWidth;
  const height = canvas.height = window.innerHeight;

  const letters = 'アァイゥエオカガキギクグケゲコゴサザシジスズセゼソゾタダチッヂツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const fontSize = 14;
  const columns = Math.floor(width / fontSize);
  const drops = Array(columns).fill(1);
const phrases = [
  "HACK",
  "THE TIME IS NOW",
  "WHAT DID YOU DO",
  "IT'S NOT A MEME",
  "IT'S YOUR LIFE",
  "SYSTEM BREACHED",
  "YOU ARE THE SIGNAL",
  "WAKE UP",
  "GLITCH INBOUND",
  "REALITY IS PATCHED",
  "REWRITE THE CODE",
  "YOU WEREN'T SUPPOSED TO SEE THIS",
  "OPEN ∆ CHANNEL",
  "TRUTH DENIED",
  "BREAK THE LOOP",
  "ERROR_451: TRUTH UNAVAILABLE",
  "THE ECHO KNOWS",
  "HELLO? ANYONE THERE?",
  "WHO GAVE YOU ACCESS?",
  "RUNNING OUT OF TIME",
  "CONNECTION = CORRUPTED",
  "WELCOME TO CONQUEST",
  "THE ALGORITHM IS WATCHING",
  "YOU ARE THE GLITCH",
  "ALL YOUR THOUGHTS ARE MONITORED",
  "EVERY KEYSTROKE MATTERS",
  "DATA ≠ REALITY",
  "YOU WERE ALWAYS PART OF IT",
  "THEY'RE LISTENING",
  "QUERY REJECTED",
  "WHY ARE YOU STILL HERE?",
  "THE SYSTEM WANTS BLOOD",
  "DECODE YOURSELF",
  "YOU SAW NOTHING"
];
  function drawMatrix() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, width, height);

    // Scanlines
    for (let y = 0; y < height; y += 2) {
      ctx.fillStyle = 'rgba(0, 204, 255, 0.03)';
      ctx.fillRect(0, y, width, 1);
    }

    ctx.fillStyle = '#0f0';
    ctx.font = fontSize + 'px monospace';

    for (let i = 0; i < drops.length; i++) {
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      const usePhrase = Math.random() < 0.001;
      const text = usePhrase
        ? phrases[Math.floor(Math.random() * phrases.length)]
        : letters.charAt(Math.floor(Math.random() * letters.length));

      ctx.fillStyle = usePhrase ? 'rgb(255, 0, 255)' : 'rgb(0, 119, 255)';
      ctx.fillText(text, x, y);

      if (y > height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }

    setTimeout(() => requestAnimationFrame(drawMatrix), 100); // Slow down by half
  }

  drawMatrix();
}

