const db = require('../db/db');

function createPrompt({ id, user_id, prompt_text, ai_response, analysis }) {
  return new Promise((resolve, reject) => {
    db.run(
      `
        INSERT INTO prompts (id, user_id, prompt_text, ai_response, analysis)
        VALUES (?, ?, ?, ?, ?)
      `,
      [id, user_id, prompt_text, ai_response, analysis],
      function (err) {
        if (err) {
          console.error('[PromptModel] Error creating prompt record:', err.message);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

module.exports = {
  createPrompt
};
