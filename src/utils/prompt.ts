import readline from 'readline';

/**
 * Create a promise-based readline interface
 * @returns readline.Interface
 */
export const createReadlineInterface = (): readline.Interface => {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
};

/**
 * Prompt for user input with a question
 * @param question The question to ask
 * @returns A promise that resolves to the user's answer
 */
export const prompt = async (question: string): Promise<string> => {
  const rl = createReadlineInterface();
  try {
    return await new Promise<string>((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  } finally {
    rl.close();
  }
}; 