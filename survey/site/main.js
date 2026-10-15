// The survey site: the screens around the <tessera-respond> widget, from the
// welcome to the published response. `flow.js` says which screen comes next;
// this file shows it, in the respondent's language.

import "cardano-tessera-respond";
import { decodeMetadata, decodePayload } from "cip-179";
// The survey this site is built for (`cip179/site.js`).
import built from "built-survey";

import { fromDetailedJson } from "../cip179/metadatum.js";
import { epochAt, epochEnd, transactionUrl } from "../cip179/network.js";
import { fromHex, respondent, turnstileChallenge } from "../cip179/respondent.js";
import { next, start } from "./flow.js";
import en from "./texts/en.js";
import fr from "./texts/fr.js";

const TEXTS = { en, fr };

const $ = (selector) => document.querySelector(selector);

const [definition] = decodeMetadata(new Map([[17n, fromDetailedJson(built.definition)]])).definitions;
const [txId, index] = built.survey.split("#");
const endEpoch = Number(definition.endEpoch);
// Each survey has its own respondent: key, answers and language.
const me = respondent(`survey.${built.survey}.`);
const challenge = turnstileChallenge("#challenge");

// The languages the page and the survey both have.
const { defaultLanguage, translations } = built.translations;
const languages = Object.keys(TEXTS).filter((tag) => tag === defaultLanguage || Object.hasOwn(translations, tag));
let language =
  [me.get("language"), ...navigator.languages.map((tag) => tag.split("-")[0])].find((tag) => languages.includes(tag)) ??
  defaultLanguage;

let state = start({ epoch: epochAt(built.network), endEpoch, submitted: me.submitted() });
// The widget, made when the questions are first shown, and its last response.
let widget, payload;

$("#language").append(...languages.map((tag) => new Option(TEXTS[tag].language, tag)));
$("#language").hidden = languages.length < 2;
$("#language").addEventListener("change", () => {
  language = $("#language").value;
  me.set("language", language);
  show();
});
$("#start").addEventListener("click", () => dispatch({ type: "start" }));
$("#restart").addEventListener("click", () => {
  me.forgetAnswers();
  dispatch({ type: "start" });
});
$("#return").addEventListener("click", () => dispatch({ type: "return" }));
$("#back").addEventListener("click", () => dispatch({ type: "back" }));
$("#publish").addEventListener("click", publish);
show();
$("#loading").remove();

// ----------------------------------------------------------------------------

function dispatch(event) {
  const previous = state.screen;
  state = next(state, event);
  show();
  if (state.screen !== previous) {
    scrollTo(0, 0);
    $(`#${state.screen}`).focus({ preventScroll: true });
  }
}

/** The sponsor publishes the widget's response, which takes a few seconds. */
async function publish() {
  if (state.step === "sending") return;
  dispatch({ type: "publish" });
  try {
    const published = await me.submit(payload, { challenge, onAttempt: (attempt) => dispatch({ type: "attempt", attempt }) });
    dispatch({ type: "published", txId: published });
  } catch (error) {
    console.error(error);
    dispatch({ type: "refused", code: error.code, txId: error.txId });
  }
}

/** Shows the state's screen, in the current language. */
function show() {
  const texts = TEXTS[language];
  const survey = translations[language] ?? {};
  document.documentElement.lang = language;
  document.title = survey.title ?? definition.title;
  $("#language").value = language;
  for (const element of document.querySelectorAll("[data-text]")) {
    element.textContent = element.dataset.text.split(".").reduce((group, key) => group[key], texts);
  }
  for (const section of document.querySelectorAll("main > section")) section.hidden = section.id !== state.screen;

  switch (state.screen) {
    case "welcome": {
      const unsent = me.stash.get(`${txId}:${index}`) !== undefined;
      const closing = new Intl.DateTimeFormat(language, { dateStyle: "long", timeStyle: "short" });
      $("#welcome .survey-title").textContent = survey.title ?? definition.title;
      $("#welcome .survey-description").textContent = survey.description ?? definition.description;
      $("#until").textContent = texts.welcome.until(closing.format(epochEnd(built.network, endEpoch)));
      $("#start").textContent = unsent ? texts.welcome.continue : texts.welcome.start;
      $("#restart").hidden = !unsent;
      // The answers that end the survey: nothing is recorded for them.
      $("#exits").replaceChildren(
        ...built.exits.map((label) => {
          const button = Object.assign(document.createElement("button"), { type: "button", textContent: label[language] ?? label[defaultLanguage] });
          button.addEventListener("click", () => dispatch({ type: "leave" }));
          return button;
        }),
      );
      break;
    }
    case "questions":
      widget ??= makeWidget();
      widget.locale = language;
      widget.messages = texts.widget;
      break;
    case "submit": {
      const sending = state.step === "sending";
      challenge.load();
      $("#answered").textContent = texts.submit.answered(state.answered);
      $("#problem").hidden = state.step !== "failed";
      $("#problem").textContent = state.step === "failed" ? texts.submit.problems[state.problem] : "";
      $("#publish").textContent = state.step === "failed" ? texts.submit.retry : texts.submit.publish;
      $("#publish").disabled = $("#back").disabled = sending;
      $("#progress").textContent = !sending ? "" : state.attempt === 1 ? texts.submit.sending : texts.submit.retrying(state.attempt);
      break;
    }
    case "thanks":
      // The published answers are no longer the widget's to change.
      widget?.remove();
      widget = undefined;
      $("#published").textContent = state.repeated ? texts.thanks.repeated : texts.thanks.body;
      $("#transaction").hidden = !state.txId;
      if (state.txId) $("#transaction").href = transactionUrl(built.network, state.txId);
      break;
    case "closed":
      $("#closed-body").textContent = state.cancelled ? texts.closed.cancelled : texts.closed.body;
      $("#closed .results").hidden = Boolean(state.cancelled);
      break;
  }
}

/**
 * The widget, with one question per screen. The respondent is the browser's
 * key, a Keyholder; the survey's description stays on the welcome screen.
 */
function makeWidget() {
  const element = Object.assign(document.createElement("tessera-respond"), {
    definition: { ...definition, description: "" },
    surveyRef: { txId: fromHex(txId), index: Number(index) },
    responder: { 4: { type: "key", keyHash: me.keyHash } },
    showRole: false,
    tipEpoch: epochAt(built.network),
    conditions: built.conditions,
    noneLabels: built.noneLabels,
    translations: {
      defaultLanguage,
      translations: Object.fromEntries(Object.entries(translations).map(([tag, { description, ...texts }]) => [tag, texts])),
    },
    maxTextBytes: built.maxTextBytes,
    // Text answers have one schema, which respondents needn't see.
    hiddenSchemas: definition.questions.flatMap((question) => (question.type === "custom" ? [question.methodSchema.uri] : [])),
    stash: me.stash,
  });
  element.addEventListener("tessera:response", (event) => {
    payload = event.detail.payload;
    const [response] = decodePayload(payload).responses;
    dispatch({ type: "finish", answered: response.answers.answers.length });
  });
  $("#questions").append(element);
  return element;
}
