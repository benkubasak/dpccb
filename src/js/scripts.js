"use strict";
const settings = {
  datadir: './src/data/',
  datafile: 'data.json',
  contentdir: './src/content/',
  imagedir: './src/img/',
  noreplacements: ["script", "style", "template", "noscript", "code", "pre", "textarea"],
  forcehttps: false,
  forcewww: false,
  forceslash: false,
  forcelowercase: true,
  debug: true
}
function debugLog(s) { if (settings.debug) { console.log(s); } }
const site = {
  type: 'site',
  domain: '',
  published: '',
  title: '',
  description: '',
  author: '',
  image: '',
  homeslug: '',
  homecontentfile: '',
  newsletterurl: '',
  donationurl: '',
  copyright: '',
  load: function () {
    const yStart = new Date(this.published).getFullYear();
    const yCurrent = new Date().getFullYear();
    let copyrightyears = yStart + '';
    if (yCurrent > yStart) { copyrightyears += ' - ' + yCurrent; }
    this.copyright = `&copy;&nbsp;${copyrightyears} ${this.title}`;
  }
};
const page = {
  type: 'page',
  id: '',
  slug: '',
  created: '',
  modified: '',
  published: '',
  type: '',
  visibility: '',
  title: '',
  description: '',
  author: '',
  image: '',
  canonicalurl: '',
  load: function () {
    let _slug = this.slug;
    if (_slug.length > 1) { _slug += '/'; }
    this.canonicalurl = `https://${site.domain}${_slug}`;
  }
};
const replacements = {};
const attrCache = [];

function cacheOriginalAttributes() {
  // meta[content]
  document.querySelectorAll('meta[content]').forEach(meta => {
    attrCache.push({ el: meta, attr: 'content', original: meta.getAttribute('content') });
  });

  // link[href]
  document.querySelectorAll('link[href]').forEach(link => {
    attrCache.push({ el: link, attr: 'href', original: link.getAttribute('href') });
  });

  // a[href|title]
  document.querySelectorAll('a').forEach(a => {
    ['href', 'title'].forEach(attr => {
      if (a.hasAttribute(attr)) {
        attrCache.push({ el: a, attr, original: a.getAttribute(attr) });
      }
    });
  });

  // img[src|alt|title]
  document.querySelectorAll('img').forEach(img => {
    ['src', 'alt', 'title'].forEach(attr => {
      if (img.hasAttribute(attr)) {
        attrCache.push({ el: img, attr, original: img.getAttribute(attr) });
      }
    });
  });
}
function queueObjectKeyReplacements(obj) {
  const prefix = obj.type ? obj.type + '.' : '';
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (key === 'type' || key === 'load') {
        debugLog(`Skipping replacement for ${prefix}${key}.`);
        continue;
      }
      replacements[`${prefix}${key}`] = obj[key];
      debugLog(`Queued replacement for ${prefix}${key}: ${obj[key]}.`);
    }
  }
}
function replacePlaceholders(str, replacements) {
  return str.replace(/{{(.*?)}}/g, (match, key) => {
    const trimmedKey = key.trim();
    if (replacements.hasOwnProperty(trimmedKey)) {
      debugLog(`Replaced placeholder ${match} with ${replacements[trimmedKey]}.`);
      return replacements[trimmedKey];
    }
    debugLog(`No replacement found for ${match}.`);
    return match;
  });
}
function applyReplacements() {
  // Replace attribute placeholders with text for meta, link, a, and img elements
  for (const item of attrCache) {
    const replaced = replacePlaceholders(item.original, replacements);
    item.el.setAttribute(item.attr, replaced);
  }

  // Replace content placeholders with text for title element
  const elTitle = document.querySelector('title');
  if (elTitle) { elTitle.textContent = replacePlaceholders(elTitle.innerHTML, replacements); }

  // Replace content placeholders with HTML for '.content-component' elements
  // TODO:  exclude element types found in settings.noreplacements
  document.querySelectorAll('.content-component').forEach(el => {
    el.innerHTML = replacePlaceholders(el.innerHTML, replacements);
  });
}

function loadPanel(panelSelector, openSelector, closeSelector, isModal) {
  const elPanel = document.querySelector(panelSelector);
  const elOpen = document.querySelector(openSelector);
  const elClose = document.querySelector(closeSelector);
  if (elPanel && elOpen && elClose) {
    if (isModal) {
      elOpen.addEventListener("click", () => { closeAllPanels(); elPanel.showModal(); });
    } else {
      elOpen.addEventListener("click", () => { closeAllPanels(); elPanel.show(); });
    }
    elClose.addEventListener("click", () => {
      elPanel.setAttribute("closing", "");
      elPanel.addEventListener("animationend", () => {
        elPanel.removeAttribute("closing");
        elPanel.close();
      }, { once: true });
    });
  }
}
function closeAllPanels() {
  const elArray = document.querySelectorAll('.template-panel');
  if (elArray.length > 0) { for (const el of elArray) { el.close(); } }
}

function setHrefOnClicks() {
  document.querySelectorAll('a[href^="/"]').forEach(anchor => {
    anchor.onclick = function (event) {
      event.preventDefault();
      window.location.hash = this.getAttribute('href').replace("/", "#");
      window.location.reload();
    };
  });
}

async function loadSiteData() {
  try {
    const dataFile = settings.datadir + settings.datafile;
    const response = await fetch(dataFile);
    if (!response.ok) {
      throw new Error(`Failed to load content: ${response.status}`);
    }
    const data = await response.json();
    if (data) {
      site.domain = data.domain;
      site.published = data.published;
      site.title = data.title;
      site.description = data.description;
      site.author = data.author;
      site.image = data.image;
      site.homeslug = data.homeslug;
      site.homecontentfile = data.homecontentfile;
      site.newsletterurl = data.newsletterurl;
      site.donationurl = data.donationurl;
      if (site.title && site.title.length > 0) { site.load(); queueObjectKeyReplacements(site); }
    }
    return data;
  } catch (error) {
    console.error(`Error fetching content file:`, error);
    throw error;
  }
}
async function loadPageData() {
  // TODO:  implement 404 and 500 error handling
  const elContent = document.querySelector('#article-content');
  const htmlFallback = `<section><h1>Content Not Found</h1><p>This content is not currently available.</p></section>`;
  try {
    const hash = window.location.hash;
    const hashValue = hash.slice(1);
    let contentFile = settings.contentdir + site.homecontentfile;
    if (hashValue && hashValue.length > 0) {
      // TODO:  verify that hash appears in data
      contentFile = settings.contentdir + hashValue + '.html';
    }

    const response = await fetch(contentFile);
    if (!response.ok) {
      throw new Error(`Failed to load content: ${response.status}`);
    }
    const data = await response.text();
    if (data.length && data.length > 0) {
      const temp = document.createElement('div');
      temp.innerHTML = data;

      // get frontmatter
      const scriptEl = temp.querySelector('script[type="application/json"]');
      if (!scriptEl) throw new Error('No frontmatter script tag found.');

      let frontmatter = {};
      try {
        frontmatter = JSON.parse(scriptEl.textContent.trim());
      } catch (e) {
        throw new Error('Invalid JSON frontmatter.');
      }

      // get content
      const contentNodes = [];
      let node = scriptEl.nextSibling;
      while (node) {
        const next = node.nextSibling;
        contentNodes.push(node);
        node = next;
      }

      // set global object
      page.id = frontmatter.id;
      page.slug = frontmatter.slug;
      page.created = frontmatter.created;
      page.modified = frontmatter.modified;
      page.published = frontmatter.published;
      page.type = frontmatter.type;
      page.visibility = frontmatter.visibility;
      page.title = frontmatter.title;
      page.description = frontmatter.description;
      page.author = frontmatter.author;
      page.image = frontmatter.image;
      if (page.title && page.title.length > 0) { page.load(); queueObjectKeyReplacements(page); }

      // set content
      elContent.innerHTML = '';
      contentNodes.forEach(node => elContent.appendChild(node.cloneNode(true)));
    }
    return data;
  } catch (error) {
    elContent.innerHTML = htmlFallback;
    console.error(`Error fetching content file:`, error);
    throw error;
  }
}

async function preLoadPage() {
  if (settings.forcehttps && window.location.protocol === 'http:') {
    window.location.href = window.location.href.replace('http:', 'https:');
  }
  if (settings.forcewww && !window.location.hostname.startsWith('www.')) {
    window.location.href = window.location.href.replace(/^(https?:\/\/)/, '$1www.');
  }
  if (!settings.forcewww && window.location.hostname.startsWith('www.')) {
    window.location.href = window.location.href.replace('www.', '');
  }
  if (settings.forceslash && !window.location.pathname.endsWith('/')) {
    window.location.href = window.location.href + '/' + window.location.search;
  }
  if (settings.forcelowercase) {
    const lowercasePath = window.location.pathname.toLowerCase();
    if (window.location.pathname !== lowercasePath) {
      window.location.href = `${window.location.origin}${lowercasePath}${window.location.search}`;
    }
  }
}
async function postLoadPage() {
  cacheOriginalAttributes();
  applyReplacements();
  loadPanel('#panel-menu', '#menu-open', '#menu-close', false);
  // loadPanel('#panel-contact', '#contact-open', '#contact-close', false);
  setHrefOnClicks();
}
async function loadPage() {
  await preLoadPage();
  await loadSiteData();
  await loadPageData();
  await postLoadPage();
}
function load() {
  if (document.readyState != 'loading') { loadPage(); }
  else if (document.addEventListener) { document.addEventListener('DOMContentLoaded', loadPage); }
  else { document.attachEvent('onreadystatechange', function () { if (document.readyState == 'complete') { loadPage(); } }); }
}

load();
