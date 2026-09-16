'use strict';
let currentClient = 0;
try { const credential = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token'); const user = JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (['CLIENT','CUSTOMER'].includes(String(user.role).toUpperCase())) currentClient = Number(user.clientId || user.id); } catch {}
document.getElementById('clientId').value = currentClient;
const recovery = CWClientChat.create({ clientId: () => currentClient, input: document.getElementById('text'), sendButton: document.getElementById('sendBtn'),
  mount: document.body, list: document.getElementById('messages'), canSend: () => currentClient > 0, confirmed: () => load() });
async function load() {
  await recovery.ready;
  if (!currentClient) { document.getElementById('messages').textContent = 'Abra Conversas com clientes no painel administrativo e escolha o cliente.'; return; }
  const read = recovery.begin(); if (!read) return;
  try {
    const response = await fetch(`/api/chat/client/${currentClient}`, { headers: recovery.headers(), cache: 'no-store' });
    const data = await response.json(); if (!recovery.accepts(read)) return;
    if (!response.ok || data.ok !== true || !Array.isArray(data.messages)) throw Error('Invalid conversation');
    const fragment = document.createDocumentFragment();
    for (const message of data.messages) {
      const node = document.createElement('div'); node.className = 'msg ' + (message.senderType === 'CLIENT' ? 'me' : 'other'); node.dataset.messageId = message.id;
      if (message.senderType === 'LEGACY') { const author = document.createElement('strong'); author.textContent = CWClientChat.historyLabel(); author.dataset.cwNoI18n = ''; node.append(author); }
      const text = document.createElement('div'); text.textContent = message.text || message.message || ''; node.append(text);
      if (message.senderType !== 'LEGACY' && message.fileUrl && Number.isSafeInteger(message.id)) { const link = document.createElement('a'); link.dataset.authDownload = ''; link.href = message.messageType === 'DOCUMENT' && /^\/invoice-document\?id=[1-9]\d{0,9}$/.test(message.fileUrl) ? message.fileUrl : `/api/client-messages/attachments/${message.id}`; link.textContent = message.fileName || 'Abrir anexo'; node.append(link); }
      const date = document.createElement('small'); date.textContent = new Date(message.createdAt).toLocaleString(document.documentElement.lang === 'pt' ? 'pt-PT' : document.documentElement.lang || 'pt-PT'); node.append(date); fragment.append(node);
    }
    const list = document.getElementById('messages'); list.replaceChildren(fragment); list.scrollTop = list.scrollHeight;
  } catch { if (recovery.accepts(read)) recovery.readError(); }
}
async function send() { return recovery.sendText(); }
load();
