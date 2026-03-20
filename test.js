import { plaintextToMindElixir, mindElixirToPlaintext } from "mind-elixir/plaintextConverter";

const plaintext = `- Page Title
  - First node [^uuid-1234]
    - Child node [^uuid-5678]`;

const mindData = plaintextToMindElixir(plaintext);
console.log("Mind Data:", JSON.stringify(mindData.nodeData, null, 2));

const outPlaintext = mindElixirToPlaintext(mindData);
console.log("Output Plaintext:\n" + outPlaintext);
