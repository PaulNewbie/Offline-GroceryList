// mock-fs.js
module.exports = {
  readFileSync: (textData) => {
    try {
      // If the data is somehow already JSON, just return it
      if (textData.trim().startsWith('{')) return textData;

      // Otherwise, translate the vocab.txt list into a vocab.json dictionary!
      const lines = textData.split(/\r?\n/);
      const vocabObj = {};
      lines.forEach((word, index) => {
        if (word) vocabObj[word] = index;
      });
      return JSON.stringify(vocabObj);
    } catch (e) {
      return textData;
    }
  }
};