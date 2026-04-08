// mock-fs.js
module.exports = {
  readFileSync: (textData) => {
    // The tokenizer thinks it is opening a file path.
    // Instead, we pass it the giant vocab string, and bounce it right back!
    return textData;
  }
};