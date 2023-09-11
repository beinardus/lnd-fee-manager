import { exec } from "child_process";
import logger from "./winston-plugin.js";
import { UPDATE_CMD } from "./settings-provider.js";

const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      }
      resolve(stderr || stdout);
    });
  });
};

const updateFees = async () => {
  try {
    logger.info(await execPromise(UPDATE_CMD));
  } catch (e) {
    logger.error(`updateFees cmd: <${UPDATE_CMD}>`, e);
  }
};

export default updateFees;
