'use strict';
const clientChatCopy = (() => {
  const languages = ['pt', 'en', 'fr', 'es', 'de'];
  const copy = {
    title: ['Cristal Water - Mensagens do Cliente', 'Cristal Water - Client messages', 'Cristal Water - Messages du client', 'Cristal Water - Mensajes del cliente', 'Cristal Water - Kundennachrichten'],
    heading: ['Conversa com a administração', 'Conversation with the office', 'Conversation avec l’administration', 'Conversación con la administración', 'Gespräch mit der Verwaltung'],
    message: ['Mensagem', 'Message', 'Message', 'Mensaje', 'Nachricht'],
    choose: ['Abra Conversas com clientes no painel administrativo e escolha o cliente.', 'Open Client conversations in the administration panel and select the client.', 'Ouvrez Conversations avec les clients dans le panneau d’administration et choisissez le client.', 'Abra Conversaciones con clientes en el panel de administración y elija el cliente.', 'Öffnen Sie Kundengespräche im Verwaltungsbereich und wählen Sie den Kunden.'],
    attachment: ['Abrir anexo', 'Open attachment', 'Ouvrir la pièce jointe', 'Abrir adjunto', 'Anhang öffnen'],
  };
  const leaves = new Map();
  const language = () => languages.includes(document.documentElement.lang) ? document.documentElement.lang : 'pt';
  const text = key => key === 'history' ? CWClientChat.historyLabel(language()) : copy[key][languages.indexOf(language())];
  function paint() {
    for (const [node, leaf] of leaves) {
      const current = leaf.attribute ? node.getAttribute(leaf.attribute) : leaf.textNode.nodeValue;
      if (!node.isConnected || current !== leaf.rendered || (!leaf.attribute && (node.childNodes.length !== 1 || node.firstChild !== leaf.textNode))) { leaves.delete(node); continue; }
      const rendered = text(leaf.key);
      if (rendered !== leaf.rendered) { if (leaf.attribute) node.setAttribute(leaf.attribute, rendered); else leaf.textNode.nodeValue = rendered; }
      leaf.rendered = rendered;
    }
  }
  function bind(node, key, attribute) {
    const original = key === 'history' ? CWClientChat.historyLabel('pt') : copy[key][0];
    if (!node || (attribute ? node.getAttribute(attribute) !== original : node.childNodes.length !== 1 || node.firstChild.nodeType !== Node.TEXT_NODE || node.firstChild.nodeValue !== original)) return node;
    node.dataset.cwNoI18n = '';
    const rendered = text(key);
    if (attribute) node.setAttribute(attribute, rendered); else node.firstChild.nodeValue = rendered;
    leaves.set(node, { key, attribute, textNode: attribute ? null : node.firstChild, rendered });
    return node;
  }
  bind(document.querySelector('title'), 'title'); bind(document.querySelector('.header h1'), 'heading'); bind(document.getElementById('text'), 'message', 'aria-label');
  window.addEventListener('cw-language-change', paint);
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  return { bind, paint };
})();
let currentClient = 0;
try { const credential = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token'); const user = JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (['CLIENT','CUSTOMER'].includes(String(user.role).toUpperCase())) currentClient = Number(user.clientId || user.id); } catch {}
document.getElementById('clientId').value = currentClient;
const recovery = CWClientChat.create({ clientId: () => currentClient, input: document.getElementById('text'), sendButton: document.getElementById('sendBtn'),
  mount: document.body, list: document.getElementById('messages'), canSend: () => currentClient > 0, confirmed: () => load() });
async function load() {
  await recovery.ready;
  if (!currentClient) { const note = document.createElement('p'); note.textContent = 'Abra Conversas com clientes no painel administrativo e escolha o cliente.'; clientChatCopy.bind(note, 'choose'); document.getElementById('messages').replaceChildren(note); clientChatCopy.paint(); return; }
  const read = recovery.begin(); if (!read) return;
  try {
    const response = await fetch(`/api/chat/client/${currentClient}`, { headers: recovery.headers(), cache: 'no-store' });
    const data = await response.json(); if (!recovery.accepts(read)) return;
    if (!response.ok || data.ok !== true || !Array.isArray(data.messages)) throw Error('Invalid conversation');
    const fragment = document.createDocumentFragment();
    for (const message of data.messages) {
      const node = document.createElement('div'); node.className = 'msg ' + (message.senderType === 'CLIENT' ? 'me' : 'other'); node.dataset.messageId = message.id;
      if (message.senderType === 'LEGACY') { const author = document.createElement('strong'); author.textContent = CWClientChat.historyLabel('pt'); clientChatCopy.bind(author, 'history'); node.append(author); }
      const text = document.createElement('div'); text.textContent = message.text || message.message || ''; text.dataset.cwNoI18n = ''; node.append(text);
      if (message.senderType !== 'LEGACY' && message.fileUrl && Number.isSafeInteger(message.id)) { const link = document.createElement('a'); link.dataset.authDownload = ''; link.href = message.messageType === 'DOCUMENT' && /^\/invoice-document\?id=[1-9]\d{0,9}$/.test(message.fileUrl) ? message.fileUrl : `/api/client-messages/attachments/${message.id}`; link.textContent = message.fileName || 'Abrir anexo'; link.dataset.cwNoI18n = ''; if (!message.fileName) clientChatCopy.bind(link, 'attachment'); node.append(link); }
      const date = document.createElement('small'); date.textContent = new Date(message.createdAt).toLocaleString(document.documentElement.lang === 'pt' ? 'pt-PT' : document.documentElement.lang || 'pt-PT'); node.append(date); fragment.append(node);
    }
    const list = document.getElementById('messages'); list.replaceChildren(fragment); list.scrollTop = list.scrollHeight; clientChatCopy.paint();
  } catch { if (recovery.accepts(read)) recovery.readError(); }
}
async function send() { return recovery.sendText(); }
load();
