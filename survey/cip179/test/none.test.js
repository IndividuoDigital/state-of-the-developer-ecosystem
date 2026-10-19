// How a SurveyJS None item maps to CIP-179: on a multi-select it is no option
// selected, which the widget shows as its None box, worded by `noneLabels`; on
// a single choice it stays an option.

import assert from "node:assert/strict";
import { test } from "node:test";

import { decodeMetadata, describeProblems, encodeMetadata, validateResponse } from "cip-179";

import { answersToRow, rowToAnswers, withoutHiddenAnswers } from "../answers.js";
import { buildSurvey } from "../definition.js";

const build = (elements) =>
  buildSurvey(
    { title: "None", pages: [{ name: "p", elements }] },
    {
      owner: { type: "key", keyHash: new Uint8Array(28) },
      endEpoch: 600,
      freeTextSchema: { uri: "https://example.org/free-text.schema.json", hash: new Uint8Array(32) },
    },
  );

const chains = {
  type: "checkbox",
  name: "chains",
  title: "Which other chains have you built on?",
  isRequired: true,
  showNoneItem: true,
  noneText: { default: "None, only Cardano", fr: "Aucune, seulement Cardano" },
  choices: ["Ethereum", "Solana"],
};
const text = (name, visibleIf) => ({ type: "comment", name, title: name, visibleIf });

test("a multi-select's None is its None box, with no option", () => {
  const { definition, mapping, noneLabels, translations, problems } = build([chains]);
  assert.deepEqual(problems, []);
  assert.deepEqual(definition.questions, [
    {
      type: "multiSelect",
      prompt: "Which other chains have you built on?",
      options: { type: "options", labels: ["Ethereum", "Solana"] },
      minSelections: 0,
      maxSelections: 2,
      required: true,
    },
  ]);
  assert.deepEqual(mapping.questions, [{ name: "chains", values: ["Ethereum", "Solana"], none: "none" }]);
  assert.deepEqual(noneLabels, { 0: "None, only Cardano" });
  assert.deepEqual(translations.translations, { fr: { questions: [{ noneLabel: "Aucune, seulement Cardano" }] } });
});

test("without its own text, the box reads as SurveyJS's None", () => {
  const title = { default: chains.title, fr: "Sur quelles autres chaînes avez-vous développé ?" };
  const { noneLabels, translations } = build([{ ...chains, title, noneText: undefined }]);
  assert.deepEqual(noneLabels, { 0: "None" });
  assert.equal(translations.translations.fr.questions[0].noneLabel, "Aucun");
});

test("SurveyJS's own texts don't add a language to the survey", () => {
  const { translations } = build([{ ...chains, noneText: undefined, showOtherItem: true }]);
  assert.deepEqual(translations.translations, {});
});

test("a single choice keeps None as an option", () => {
  const { definition, mapping, noneLabels } = build([{ ...chains, type: "radiogroup" }]);
  assert.deepEqual(definition.questions[0].options.labels, ["Ethereum", "Solana", "None, only Cardano"]);
  assert.deepEqual(mapping.questions[0], { name: "chains", values: ["Ethereum", "Solana", "none"] });
  assert.deepEqual(noneLabels, {});
});

test("conditions name the None box \"none\"", () => {
  const { conditions, problems } = build([
    chains,
    text("only", "{chains} contains 'none'"),
    text("others", "{chains} notcontains 'none'"),
    text("either", "{chains} anyof ['Solana', 'none']"),
  ]);
  assert.deepEqual(problems, []);
  assert.deepEqual(conditions, {
    1: { question: 0, anyOf: ["none"] },
    2: { question: 0, noneOf: ["none"] },
    3: { question: 0, anyOf: [1, "none"] },
  });
});

test("a None answer survives the round trip", () => {
  const { definition, mapping } = build([chains]);
  for (const original of [{ chains: ["none"] }, { chains: ["Solana", "Ethereum"] }]) {
    const { answers, problems } = rowToAnswers(original, definition, mapping);
    assert.deepEqual(problems, []);
    const response = {
      specVersion: definition.specVersion,
      surveyRef: { txId: new Uint8Array(32), index: 0 },
      role: 4,
      credential: { type: "key", keyHash: new Uint8Array(28) },
      answers: { type: "public", answers },
    };
    assert.deepEqual(describeProblems(validateResponse(definition, response)), []);
    const [decoded] = decodeMetadata(encodeMetadata({ type: "responses", responses: [response] })).responses;
    assert.deepEqual(answersToRow(decoded.answers.answers, mapping), { row: original, problems: [] });
  }
  assert.deepEqual(rowToAnswers({ chains: ["none"] }, definition, mapping).answers, [
    { type: "multiSelect", questionIndex: 0, optionIndices: [] },
  ]);
});

test("a None answer shows the questions that ask for it, a skip doesn't", () => {
  const { definition, conditions } = build([
    { ...chains, isRequired: false },
    text("only", "{chains} contains 'none'"),
    text("others", "{chains} notcontains 'none'"),
  ]);
  const texts = [1, 2].map((questionIndex) => ({ type: "custom", questionIndex, value: ["text"] }));
  const hidden = (chainsAnswer) =>
    withoutHiddenAnswers(definition, conditions, [...(chainsAnswer ? [{ type: "multiSelect", questionIndex: 0, ...chainsAnswer }] : []), ...texts])
      .hidden;
  assert.deepEqual(hidden({ optionIndices: [] }), [2]);
  assert.deepEqual(hidden({ optionIndices: [1] }), [1]);
  assert.deepEqual(hidden(undefined), [1]);
});

test("what doesn't fit is reported", () => {
  const long = "None of these, as I only ever built on Cardano and nothing else at all";
  const { problems } = build([
    { ...chains, minSelectedChoices: 2, noneText: { default: "None", fr: long } },
  ]);
  assert.deepEqual(
    problems.map((p) => `${p.level}: ${p.message}`),
    [
      "warning: minSelectedChoices 2 isn't kept with None: on chain, one option is enough",
      `error: None label is over 64 bytes: "${long}"`,
    ],
  );
});
