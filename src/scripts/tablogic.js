
// src/scripts/tablogic.js

let CONFIG = {
  defaultCommand: 'g',
  bgColor: '#21252d',
  textColor: '#1b91d6',
  showClock: false,
  alwaysNewTab: false,
  gistID: '',
  links: [],
};

let aliases = {
  cal: 'gc',
  gk: 'k',
  ddg: 'dg',
  map: 'gm',
  '?': 'help'
};

let lastEnteredCommand = '';
let newTab = false;
let messageTimer = null;

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
  document.querySelector('#clock').style.display = CONFIG.showClock ? 'inline' : 'none';
}

function handleKeyDown(e) {
  const key = e.which || e.keyCode;
  if (key === 13) evaluateInput();
  else if (key === 38 && lastEnteredCommand !== '') {
    const input = document.querySelector('#input');
    input.focus();
    input.value = lastEnteredCommand;
    setTimeout(() => {
      input.setSelectionRange(input.value.length, input.value.length);
    }, 2);
  }
}

function evaluateInput() {
  const inputField = document.querySelector('#input');
  let input = inputField.value.trim();
  inputField.value = '';
  clearMessage();

  if (input === '') return;

  lastEnteredCommand = input;
  let args = input.split('/');
  let command = args[0].toLowerCase();

  args = args.map(a => a.trim());

  if (aliases[command]) {
    command = aliases[command];
    args.shift();
  }

  if (args[args.length - 1] === 'n') {
    newTab = true;
    args.pop();
  }

  const isURL = checkIfURL(command);
  if (isURL) {
    redirect(buildURL(command));
    return;
  }

  if (commands[command]) {
    args.shift();
    commands[command](args);
  } else {
    commands[CONFIG.defaultCommand](args);
  }
}

function redirect(url) {
  if (newTab || CONFIG.alwaysNewTab) window.open(url, '_blank').focus();
  else window.location.href = url;
  newTab = false;
}

function buildURL(base, search = '', query = '') {
  let url = base.match(/^https?:\/\//) ? base : 'http://' + base;
  return url + search + encodeURIComponent(query);
}

function checkIfURL(str) {
  const pattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
  return pattern.test(str);
}

function clearMessage() {
  const msg = document.querySelector('#message');
  msg.innerHTML = '';
}

function updateClock() {
  const d = new Date();
  const h = d.getHours();
  const hours = h > 12 ? h - 12 : h;
  const minutes = ('0' + d.getMinutes()).slice(-2);
  document.querySelector('#clock').innerText = `${hours}:${minutes}`;
  setTimeout(updateClock, 1000);
}

const commands = {
  g: (args) => redirect(buildURL('https://google.com', '/search?q=', args.join(' '))),
  dg: (args) => redirect(buildURL('https://duckduckgo.com', '/?q=', args.join(' '))),
  r: (args) => redirect(buildURL('https://reddit.com', '/r/', args.join('/'))),
  y: (args) => redirect(buildURL('https://youtube.com', '/results?search_query=', args.join(' '))),
  a: (args) => redirect(buildURL('https://amazon.com', '/s?k=', args.join(' '))),
  so: (args) => redirect(buildURL('https://stackoverflow.com', '/search?q=', args.join(' '))),
  mdn: (args) => redirect(buildURL('https://developer.mozilla.org', '/search?q=', args.join(' '))),
  help: () => redirect('https://github.com/conquestace/conquestace'),

  // 4chan — empty command is valid
  '': (args) => {
    const url = 'https://4chan.org', search = '/';
    if (args.length === 0) {
      redirect(url);
    } else {
      redirect(buildURL(url, search, args.join('/')));
    }
  },

  // Wolfram Alpha
  wa: (args) => {
    const url = 'https://wolframalpha.com', search = '/input/?i=';
    if (args.length === 0) {
      redirect(url);
    } else {
      redirect(buildURL(url, search, args.join(' ')));
    }
  },
};
