// Korean is the source language: UI strings stay in Korean in the code and act as
// keys into the English table. Non-Korean browsers get English.
import { en, enHtml } from "./i18n-en.js";

// Settings can pin the language; "auto" follows the browser. localStorage is
// shared by the popup and options pages and can be read synchronously.
const LANGUAGE_KEY = "tidymark.uiLanguage";
export function languagePreference() {
  try {
    const saved = globalThis.localStorage?.getItem(LANGUAGE_KEY);
    return saved === "ko" || saved === "en" ? saved : "auto";
  } catch {
    return "auto";
  }
}
export function setLanguagePreference(value) {
  try {
    if (value === "ko" || value === "en") globalThis.localStorage.setItem(LANGUAGE_KEY, value);
    else globalThis.localStorage.removeItem(LANGUAGE_KEY);
  } catch {
    // Storage blocked: the choice lasts only for this page.
  }
}

const preference = languagePreference();
const uiLanguage = preference !== "auto" ? preference : globalThis.chrome?.i18n?.getUILanguage?.() || "ko";
export const lang = uiLanguage.toLowerCase().startsWith("ko") ? "ko" : "en";
export const locale = lang === "ko" ? "ko-KR" : "en-US";

// Placeholders are positional: t("‘{0}’에 저장", folder.title).
export function t(source, ...args) {
  const template = lang === "en" ? en[source] ?? source : source;
  return template.replace(/\{(\d+)\}/g, (match, index) => (index in args ? String(args[index]) : match));
}

const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"];

// Translates static HTML in place. Elements whose sentence is split around inline
// markup carry data-i18n-html and get their whole inner HTML from enHtml.
export function localizeDocument(root = document) {
  document.documentElement.lang = lang;
  if (lang === "ko") return;
  for (const element of root.querySelectorAll("[data-i18n-html]")) {
    const html = enHtml[element.dataset.i18nHtml];
    if (html) element.innerHTML = html;
  }
  const walker = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue.replace(/\s+/g, " ").trim();
    if (text && en[text]) node.nodeValue = node.nodeValue.replace(/\S[\s\S]*\S|\S/, en[text]);
  }
  for (const attribute of ATTRIBUTES) {
    for (const element of root.querySelectorAll(`[${attribute}]`)) {
      const value = element.getAttribute(attribute);
      if (en[value]) element.setAttribute(attribute, en[value]);
    }
  }
  if (en[document.title]) document.title = en[document.title];
}
